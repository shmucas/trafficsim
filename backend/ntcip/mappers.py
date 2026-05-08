"""
NTCIP object-to-input-field mappers.
Maps parsed NTCIP data to the project intersection schema.
"""

DEFAULT_PHASE = {
    "active": True,
    "min_green": 5,
    "max_green": 30,
    "yellow": 4,
    "all_red": 1,
    "recall": "None",
}

VALID_PLANS = {"AM", "PM", "Off-Peak"}


def map_to_project_schema(parsed: dict) -> dict:
    """
    Convert parsed NTCIP data to intersection schema fields.

    Returns:
        {
            "nema_phases": {ph_str: {active, min_green, max_green, yellow, all_red, recall}},
            "timing_plans": {plan: {cycle, offset, splits}},
            "overlaps": [...],
            "detectors": [...],
            "warnings": [str, ...],
        }
    """
    warnings = []
    raw_phases = parsed.get("phases", {})
    raw_plans = parsed.get("timing_plans", {})
    raw_overlaps = parsed.get("overlaps", [])
    raw_detectors = parsed.get("detectors", [])

    # --- NEMA phases ---
    nema_phases = {}
    for ph_num in [str(i) for i in range(1, 9)]:
        raw = raw_phases.get(ph_num, {})
        built = dict(DEFAULT_PHASE)
        built.update({k: v for k, v in raw.items() if k in DEFAULT_PHASE})
        nema_phases[ph_num] = built

    # Phases not in 1-8 that were parsed
    extra = [k for k in raw_phases if k not in [str(i) for i in range(1, 9)]]
    if extra:
        warnings.append(f"Ignored phases outside NEMA 1–8: {', '.join(extra)}.")

    # --- Timing plans ---
    timing_plans = {}
    for plan_name, pd in raw_plans.items():
        mapped_name = plan_name  # already normalized by parser
        if mapped_name not in VALID_PLANS:
            warnings.append(f"Unknown plan '{plan_name}' — skipped. Expected AM / PM / Off-Peak.")
            continue

        cycle = pd.get("cycle")
        if not cycle:
            warnings.append(f"Plan {mapped_name}: cycle length missing, plan skipped.")
            continue

        splits = {}
        for ph_num in [str(i) for i in range(1, 9)]:
            if ph_num in pd.get("splits", {}):
                splits[ph_num] = int(pd["splits"][ph_num])

        # Validate splits sum <= cycle
        total = sum(splits.values())
        if total > cycle:
            warnings.append(
                f"Plan {mapped_name}: splits total {total}s exceeds cycle {cycle}s — values kept, verify in editor."
            )

        timing_plans[mapped_name] = {
            "cycle": int(cycle),
            "offset": int(pd.get("offset", 0)),
            "splits": splits,
        }

    # --- Overlaps ---
    overlaps = []
    for ov in raw_overlaps:
        label = ov.get("label", "")
        phases = [p for p in ov.get("phases", []) if 1 <= p <= 8]
        if label and phases:
            overlaps.append({"label": label, "phases": phases})

    # --- Detectors ---
    detectors = []
    for det in raw_detectors:
        ch = det.get("channel", "")
        det_type = det.get("type", "stop_bar")
        ph = det.get("phase")
        if ch:
            detectors.append({
                "channel": ch,
                "type": det_type if det_type in ("stop_bar", "advance") else "stop_bar",
                "phase": ph,
            })

    return {
        "nema_phases": nema_phases,
        "timing_plans": timing_plans,
        "overlaps": overlaps,
        "detectors": detectors,
        "warnings": warnings,
    }
