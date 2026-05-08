"""
NTCIP controller database parser.
Supports:
  - Generic NTCIP CSV (primary / fallback format)
  - Econolite ASC/3 tabular export
  - Intelight tabular export
  - JSON project-schema pass-through
"""

import csv
import io
import json
import re


PLAN_ALIASES = {
    "am": "AM",
    "am peak": "AM",
    "morning": "AM",
    "plan 1": "AM",
    "plan1": "AM",
    "pm": "PM",
    "pm peak": "PM",
    "afternoon": "PM",
    "evening": "PM",
    "plan 2": "PM",
    "plan2": "PM",
    "off-peak": "Off-Peak",
    "offpeak": "Off-Peak",
    "off peak": "Off-Peak",
    "free": "Off-Peak",
    "plan 3": "Off-Peak",
    "plan3": "Off-Peak",
}

RECALL_ALIASES = {
    "none": "None",
    "min": "Min",
    "minimum": "Min",
    "max": "Max",
    "maximum": "Max",
    "ped": "Ped",
    "pedestrian": "Ped",
    "0": "None",
    "1": "Min",
    "2": "Max",
    "3": "Ped",
}


def _norm_plan(s: str) -> str:
    return PLAN_ALIASES.get(s.strip().lower(), s.strip())


def _norm_recall(s: str) -> str:
    return RECALL_ALIASES.get(s.strip().lower(), "None")


def _to_bool(s: str) -> bool:
    return s.strip().lower() in ("true", "1", "yes", "active", "enabled")


def _to_float(s: str, default=None):
    try:
        return float(s.strip())
    except (ValueError, AttributeError):
        return default


def _to_int(s: str, default=None):
    v = _to_float(s, None)
    return int(v) if v is not None else default


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

def parse_ntcip_file(file_bytes: bytes, filename: str) -> dict:
    """
    Auto-detect format and parse. Returns:
        {
            "format": str,
            "phases": {ph_num_str: {...}},
            "timing_plans": {plan_name: {"cycle": int, "offset": int, "splits": {ph: int}}},
            "overlaps": [{"label": str, "phases": [int, ...]}],
            "detectors": [{"channel": str, "type": str, "phase": int|None}],
            "log": [{"level": "info"|"warn"|"error", "message": str}],
        }
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    text = ""
    try:
        text = file_bytes.decode("utf-8", errors="replace")
    except Exception:
        pass

    if ext == "json" or text.lstrip().startswith("{"):
        return _parse_json(text)

    # Detect format from header hints
    first_lines = text[:800].lower()
    if "econolite" in first_lines or ("min green" in first_lines and "max green" in first_lines and "yellow" in first_lines and "section" not in first_lines):
        return _parse_econolite(text)

    if "intelight" in first_lines or "intelli" in first_lines:
        return _parse_intelight(text)

    # Generic NTCIP CSV (SECTION,FIELD,PHASE_OR_CH,PLAN,VALUE)
    if "section" in first_lines and "field" in first_lines:
        return _parse_generic_csv(text)

    # Last-resort: try generic, then econolite
    try:
        result = _parse_generic_csv(text)
        if result["phases"] or result["timing_plans"]:
            return result
    except Exception:
        pass

    return _parse_econolite(text)


# ---------------------------------------------------------------------------
# Generic NTCIP CSV
# ---------------------------------------------------------------------------
# Expected columns: SECTION, FIELD, PH_OR_CH, PLAN, VALUE
# Comment lines start with # or ;

def _parse_generic_csv(text: str) -> dict:
    log = []
    phases = {}
    timing_plans = {}
    overlaps = []
    detectors = []

    reader = csv.reader(io.StringIO(text))
    header_skipped = False
    row_count = 0

    for row in reader:
        # Skip blanks and comments
        if not row or row[0].strip().startswith("#") or row[0].strip().startswith(";"):
            continue

        # Skip header row
        stripped = [c.strip() for c in row]
        if not header_skipped and stripped[0].upper() == "SECTION":
            header_skipped = True
            continue

        if len(stripped) < 5:
            continue

        section, field, ph_ch, plan_raw, value = (stripped + ["", "", "", "", ""])[:5]
        section = section.upper()
        field = field.upper()
        ph_ch = ph_ch.strip()
        plan = _norm_plan(plan_raw) if plan_raw else ""
        value = value.strip()
        row_count += 1

        if section == "PHASE":
            ph = ph_ch
            if not ph:
                continue
            if ph not in phases:
                phases[ph] = {}
            _apply_phase_field(phases[ph], field, value, ph, log)

        elif section == "PLAN":
            if field == "CYCLE":
                v = _to_int(value)
                if v and plan:
                    timing_plans.setdefault(plan, {}).setdefault("cycle", v)
                    timing_plans[plan]["cycle"] = v
            elif field == "OFFSET":
                v = _to_int(value)
                if v is not None and plan:
                    timing_plans.setdefault(plan, {})["offset"] = v
            elif field == "SPLIT":
                v = _to_int(value)
                if v is not None and ph_ch and plan:
                    timing_plans.setdefault(plan, {}).setdefault("splits", {})[ph_ch] = v

        elif section == "OVERLAP":
            if field == "PHASES":
                phases_list = [int(p) for p in re.split(r"[|,\s]+", value) if p.strip().isdigit()]
                overlaps.append({"label": ph_ch or value, "phases": phases_list})

        elif section == "DETECTOR":
            ch = ph_ch
            if ch:
                det = next((d for d in detectors if d["channel"] == ch), None)
                if det is None:
                    det = {"channel": ch, "type": "stop_bar", "phase": None}
                    detectors.append(det)
                if field == "TYPE":
                    det["type"] = "advance" if "adv" in value.lower() else "stop_bar"
                elif field == "PHASE":
                    det["phase"] = _to_int(value)

    if row_count == 0:
        log.append({"level": "error", "message": "No data rows found — check file format."})
    else:
        log.insert(0, {"level": "info", "message": f"Parsed {row_count} data rows (Generic NTCIP CSV format)."})

    _finalize_log(log, phases, timing_plans, overlaps, detectors)
    return {
        "format": "Generic NTCIP CSV",
        "phases": phases,
        "timing_plans": timing_plans,
        "overlaps": overlaps,
        "detectors": detectors,
        "log": log,
    }


def _apply_phase_field(ph_dict, field, value, ph_num, log):
    mapping = {
        "MIN_GREEN": "min_green",
        "MINGREEN": "min_green",
        "MIN GREEN": "min_green",
        "MAX_GREEN": "max_green",
        "MAXGREEN": "max_green",
        "MAX GREEN": "max_green",
        "YELLOW": "yellow",
        "ALL_RED": "all_red",
        "ALLRED": "all_red",
        "ALL RED": "all_red",
        "RECALL": "recall",
        "ACTIVE": "active",
        "WALK": "walk",
        "PED_CLEAR": "ped_clear",
        "PEDCLEAR": "ped_clear",
        "PED CLEAR": "ped_clear",
        "PED_CLEARANCE": "ped_clear",
    }
    key = mapping.get(field.replace("-", "_").upper())
    if key is None:
        return
    if key == "active":
        ph_dict[key] = _to_bool(value)
    elif key == "recall":
        ph_dict[key] = _norm_recall(value)
    else:
        v = _to_float(value)
        if v is not None:
            ph_dict[key] = v
        else:
            log.append({"level": "warn", "message": f"Phase {ph_num}: invalid value for {field} ({value!r})."})


# ---------------------------------------------------------------------------
# Econolite ASC/3 tabular export
# ---------------------------------------------------------------------------
# Section headers like "Phase Parameters", "Plan AM", "Plan PM" etc.
# Columns: Phase | Min Green | Max Green | Yellow | All Red | ...
# Plan sections: Cycle Length: 120 / Offset: 0 / Phase | Split

def _parse_econolite(text: str) -> dict:
    log = [{"level": "info", "message": "Detected Econolite ASC/3 format."}]
    phases = {}
    timing_plans = {}
    overlaps = []
    detectors = []

    lines = [l.rstrip() for l in text.splitlines()]
    section = None
    current_plan = None
    plan_sub = None  # "cycle"/"offset"/"splits"

    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith(";"):
            continue

        low = line.lower()

        # Detect section headers
        if "phase parameter" in low or (low.startswith("phase") and "min green" in low):
            section = "phases"
            continue
        if "overlap" in low:
            section = "overlaps"
            continue
        if "detector" in low:
            section = "detectors"
            continue

        # Detect plan header: "Plan AM", "AM Peak", etc.
        plan_match = re.match(r"^plan\s+(\S+.*?)$", low)
        if plan_match:
            current_plan = _norm_plan(plan_match.group(1))
            section = "plan"
            plan_sub = None
            timing_plans.setdefault(current_plan, {"cycle": None, "offset": 0, "splits": {}})
            continue

        # Within plan section
        if section == "plan" and current_plan:
            cycle_m = re.match(r"cycle.*?(\d+)", low)
            if cycle_m:
                timing_plans[current_plan]["cycle"] = int(cycle_m.group(1))
                continue
            offset_m = re.match(r"offset.*?(\d+)", low)
            if offset_m:
                timing_plans[current_plan]["offset"] = int(offset_m.group(1))
                continue
            # Phase/split row: "1,10" or "1  10"
            split_m = re.match(r"^(\d+)[,\t\s]+(\d+)$", line)
            if split_m:
                timing_plans[current_plan]["splits"][split_m.group(1)] = int(split_m.group(2))
                continue

        if section == "phases":
            # Try to parse: Phase, Min Green, Max Green, Yellow, All Red [, Recall]
            parts = re.split(r"[,\t]+", line)
            if len(parts) >= 5 and parts[0].strip().isdigit():
                ph = parts[0].strip()
                phases.setdefault(ph, {})
                phases[ph]["min_green"] = _to_float(parts[1]) or 5
                phases[ph]["max_green"] = _to_float(parts[2]) or 30
                phases[ph]["yellow"] = _to_float(parts[3]) or 4
                phases[ph]["all_red"] = _to_float(parts[4]) or 1
                if len(parts) >= 6:
                    phases[ph]["recall"] = _norm_recall(parts[5])
                phases[ph].setdefault("active", True)
                continue

        if section == "overlaps":
            # "A: 2, 6" or "A,2|6"
            ov_m = re.match(r"^([A-Za-z])[:\s,]+(.+)$", line)
            if ov_m:
                label = ov_m.group(1).upper()
                ph_list = [int(p) for p in re.split(r"[|,\s]+", ov_m.group(2)) if p.strip().isdigit()]
                overlaps.append({"label": label, "phases": ph_list})
                continue

        if section == "detectors":
            parts = re.split(r"[,\t]+", line)
            if len(parts) >= 2:
                ch = parts[0].strip()
                det_type = "advance" if len(parts) > 2 and "adv" in parts[2].lower() else "stop_bar"
                ph = _to_int(parts[1]) if len(parts) > 1 else None
                detectors.append({"channel": ch, "type": det_type, "phase": ph})

    _finalize_log(log, phases, timing_plans, overlaps, detectors)
    return {
        "format": "Econolite ASC/3",
        "phases": phases,
        "timing_plans": timing_plans,
        "overlaps": overlaps,
        "detectors": detectors,
        "log": log,
    }


# ---------------------------------------------------------------------------
# Intelight tabular export
# ---------------------------------------------------------------------------
# Similar to Econolite but uses different section labels

def _parse_intelight(text: str) -> dict:
    log = [{"level": "info", "message": "Detected Intelight format."}]
    # Intelight exports are very similar to Econolite in tabular layout;
    # reuse the econolite parser then fix up the log entry.
    result = _parse_econolite(text)
    result["format"] = "Intelight"
    result["log"][0] = {"level": "info", "message": "Detected Intelight format."}
    return result


# ---------------------------------------------------------------------------
# JSON pass-through
# ---------------------------------------------------------------------------

def _parse_json(text: str) -> dict:
    log = []
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        return {
            "format": "JSON",
            "phases": {},
            "timing_plans": {},
            "overlaps": [],
            "detectors": [],
            "log": [{"level": "error", "message": f"JSON parse error: {e}"}],
        }

    log.append({"level": "info", "message": "Parsed JSON format."})

    phases = {}
    timing_plans = {}
    overlaps = data.get("overlaps", [])
    detectors = data.get("detectors", [])

    # Accept our own nema_phases schema directly
    if "nema_phases" in data:
        phases = {str(k): v for k, v in data["nema_phases"].items()}
        log.append({"level": "info", "message": f"Loaded {len(phases)} phases from nema_phases."})

    if "timing_plans" in data:
        timing_plans = data["timing_plans"]
        log.append({"level": "info", "message": f"Loaded {len(timing_plans)} timing plans."})

    _finalize_log(log, phases, timing_plans, overlaps, detectors)
    return {
        "format": "JSON",
        "phases": phases,
        "timing_plans": timing_plans,
        "overlaps": overlaps,
        "detectors": detectors,
        "log": log,
    }


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _finalize_log(log, phases, timing_plans, overlaps, detectors):
    if phases:
        log.append({"level": "info", "message": f"Mapped {len(phases)} phase(s): {', '.join(sorted(phases.keys(), key=lambda x: int(x) if x.isdigit() else 99))}."})
    else:
        log.append({"level": "warn", "message": "No phase parameters found."})

    for plan, pd in timing_plans.items():
        n_splits = len(pd.get("splits", {}))
        cycle = pd.get("cycle")
        if cycle:
            log.append({"level": "info", "message": f"Plan {plan}: cycle={cycle}s, offset={pd.get('offset', 0)}s, {n_splits} split(s)."})
        else:
            log.append({"level": "warn", "message": f"Plan {plan}: cycle length not found."})

    if overlaps:
        log.append({"level": "info", "message": f"Mapped {len(overlaps)} overlap(s)."})
    if detectors:
        log.append({"level": "info", "message": f"Mapped {len(detectors)} detector channel(s)."})
