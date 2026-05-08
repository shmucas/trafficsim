"""
PDF report generation using ReportLab.

Report sections:
  1. Cover — project metadata + corridor KPIs
  2. Input Summary — intersection geometry and timing
  3. Time-Space Diagram — programmatic TSD
  4. Delay Summary — per movement
  5. Queue Length — 95th percentile
  6. Throughput Summary
  7. Methodology note
"""

import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer,
    Table, TableStyle, PageBreak, HRFlowable,
)
from reportlab.platypus.flowables import Flowable

# ── Palette ──────────────────────────────────────────────────────────────────
C_DARK   = colors.HexColor("#111827")
C_BLUE   = colors.HexColor("#3b82f6")
C_HEADER = colors.HexColor("#1e3a5f")
C_GRAY   = colors.HexColor("#6b7280")
C_LGRAY  = colors.HexColor("#e5e7eb")
C_ROW_A  = colors.HexColor("#f0f4ff")
C_ROW_B  = colors.white

LOS_COLORS = {
    "A": colors.HexColor("#16a34a"),
    "B": colors.HexColor("#22c55e"),
    "C": colors.HexColor("#ca8a04"),
    "D": colors.HexColor("#d97706"),
    "E": colors.HexColor("#ea580c"),
    "F": colors.HexColor("#dc2626"),
}


def _los_color(los):
    return LOS_COLORS.get(los, C_GRAY)


# ── Styles ────────────────────────────────────────────────────────────────────

def _styles():
    st = {}
    st["title"] = ParagraphStyle(
        "title", fontSize=22, leading=28, textColor=C_DARK, fontName="Helvetica-Bold",
    )
    st["subtitle"] = ParagraphStyle(
        "subtitle", fontSize=11, leading=16, textColor=C_GRAY, fontName="Helvetica",
    )
    st["h1"] = ParagraphStyle(
        "h1", fontSize=14, leading=20, textColor=C_HEADER, fontName="Helvetica-Bold",
        spaceBefore=14, spaceAfter=6,
    )
    st["h2"] = ParagraphStyle(
        "h2", fontSize=11, leading=16, textColor=C_DARK, fontName="Helvetica-Bold",
        spaceBefore=10, spaceAfter=4,
    )
    st["body"] = ParagraphStyle(
        "body", fontSize=9, leading=13, textColor=C_DARK, fontName="Helvetica",
    )
    st["note"] = ParagraphStyle(
        "note", fontSize=8, leading=12, textColor=C_GRAY, fontName="Helvetica-Oblique",
    )
    return st


# ── Table helpers ─────────────────────────────────────────────────────────────

def _base_table_style():
    return TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), C_HEADER),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 8),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("ROWBACKGROUND", (0, 1), (-1, -1), [C_ROW_A, C_ROW_B]),
        ("GRID",          (0, 0), (-1, -1), 0.3, C_LGRAY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
    ])


# ── Phase timing helpers ──────────────────────────────────────────────────────

def _eff_green(nema_phases, ph, plan):
    ph_str = str(ph)
    split = plan.get("splits", {}).get(ph_str, 0)
    yellow = (nema_phases or {}).get(ph_str, {}).get("yellow", 4)
    all_red = (nema_phases or {}).get(ph_str, {}).get("all_red", 1)
    return max(0, split - yellow - all_red)


def _phase_starts(plan, nema_phases):
    if not plan:
        return {}
    cycle = plan.get("cycle", 120)
    offset = plan.get("offset", 0)
    splits = plan.get("splits", {})

    def s(ph):
        return splits.get(str(ph), 0)

    starts = {}
    starts[2] = offset % cycle
    starts[1] = (starts[2] - s(1) + cycle) % cycle
    bar1 = max(s(1) + s(2), s(5) + s(6))
    starts[4] = (starts[2] - s(2) + bar1 + s(3)) % cycle
    starts[3] = (starts[4] - s(3) + cycle) % cycle
    starts[6] = (starts[2] + s(2) + s(5)) % cycle
    starts[5] = (starts[6] - s(5) + cycle) % cycle
    starts[8] = (starts[4] + s(4) + s(7)) % cycle
    starts[7] = (starts[8] - s(7) + cycle) % cycle
    return starts


# ── TSD Flowable ──────────────────────────────────────────────────────────────

class TSDFlowable(Flowable):
    N_CYCLES = 2

    def __init__(self, project, active_plan, width, height):
        super().__init__()
        self.project = project
        self.active_plan = active_plan
        self.width = width
        self.height = height

    def wrap(self, aw, ah):
        return self.width, self.height

    def draw(self):
        c = self.canv
        ixs = self.project.get("intersections", [])
        if not ixs:
            return

        plan_name = self.active_plan
        speed_mph = self.project.get("corridor_speed_mph", 35)
        speed_fps = speed_mph * 5280 / 3600

        cum_dist = [0]
        for ix in ixs[1:]:
            cum_dist.append(cum_dist[-1] + ix.get("distance_from_prev_ft", 0))
        total_dist = max(cum_dist[-1], 1)

        ML, MR, MT, MB = 58, 10, 12, 32
        pw = self.width - ML - MR
        ph = self.height - MT - MB

        cycle_ref = ixs[0].get("timing_plans", {}).get(plan_name, {}).get("cycle", 120)
        total_t = cycle_ref * self.N_CYCLES

        def xT(t):
            return ML + (t / total_t) * pw

        def yD(dist):
            return MB + (dist / total_dist) * ph

        # Background
        c.setFillColor(colors.HexColor("#f8fafc"))
        c.rect(ML, MB, pw, ph, fill=1, stroke=0)

        # Vertical grid + time labels
        c.setLineWidth(0.3)
        for tick in range(0, int(total_t) + 1, 30):
            x = xT(tick)
            c.setStrokeColor(C_LGRAY)
            c.line(x, MB, x, MB + ph)
            c.setFillColor(C_GRAY)
            c.setFont("Helvetica", 6)
            c.drawCentredString(x, MB - 10, f"{tick}s")

        # Cycle separator
        c.setStrokeColor(colors.HexColor("#94a3b8"))
        c.setLineWidth(0.8)
        c.setDash(4, 3)
        x_sep = xT(cycle_ref)
        c.line(x_sep, MB, x_sep, MB + ph)
        c.setDash()

        # Determine corridor direction (EB/WB vs NB/SB)
        ix0 = ixs[0]
        plan0 = ix0.get("timing_plans", {}).get(plan_name, {})
        splits0 = plan0.get("splits", {})
        ew = splits0.get("2", 0) + splits0.get("6", 0)
        ns = splits0.get("4", 0) + splits0.get("8", 0)
        out_ph, in_ph = (2, 6) if ew >= ns else (4, 8)

        BAND_H = 7

        # Green bands and horizontal intersection lines
        for i, ix in enumerate(ixs):
            plan = ix.get("timing_plans", {}).get(plan_name)
            nema = ix.get("nema_phases", {})
            y = yD(cum_dist[i])

            c.setStrokeColor(colors.HexColor("#94a3b8"))
            c.setLineWidth(0.3)
            c.line(ML, y, ML + pw, y)

            if not plan:
                continue
            cycle = plan.get("cycle", cycle_ref)
            ph_st = _phase_starts(plan, nema)

            def draw_band(ph, col, yoff):
                g = _eff_green(nema, ph, plan)
                if g <= 0:
                    return
                st = ph_st.get(ph, 0)
                for k in range(-1, self.N_CYCLES + 1):
                    t0 = st + k * cycle
                    t1 = t0 + g
                    x0 = max(xT(t0), ML)
                    x1 = min(xT(t1), ML + pw)
                    if x1 > ML and x0 < ML + pw:
                        c.setFillColor(col)
                        c.setFillAlpha(0.7)
                        c.rect(x0, y + yoff, x1 - x0, BAND_H, fill=1, stroke=0)
                        c.setFillAlpha(1.0)

            draw_band(out_ph, colors.HexColor("#16a34a"), 1)
            draw_band(in_ph,  colors.HexColor("#1d4ed8"), -BAND_H - 1)

        # Progression bands
        if len(ixs) > 1:
            for k in range(self.N_CYCLES):
                plan_f = ixs[0].get("timing_plans", {}).get(plan_name, {})
                ph_st0 = _phase_starts(plan_f, ixs[0].get("nema_phases", {}))
                g0 = _eff_green(ixs[0].get("nema_phases", {}), out_ph, plan_f)
                cyc0 = plan_f.get("cycle", cycle_ref)
                tL = ph_st0.get(out_ph, 0) + k * cyc0
                tT = tL + g0

                # Outbound polygon
                poly = []
                for i, ix in enumerate(ixs):
                    tt = cum_dist[i] / speed_fps
                    poly.append((xT(tL + tt), yD(cum_dist[i])))
                for i in range(len(ixs) - 1, -1, -1):
                    tt = cum_dist[i] / speed_fps
                    poly.append((xT(tT + tt), yD(cum_dist[i])))

                c.setFillColor(colors.HexColor("#16a34a"))
                c.setFillAlpha(0.13)
                p = c.beginPath()
                p.moveTo(*poly[0])
                for pt in poly[1:]:
                    p.lineTo(*pt)
                p.close()
                c.drawPath(p, fill=1, stroke=0)
                c.setFillAlpha(1.0)

                # Inbound polygon
                last_d = cum_dist[-1]
                plan_l = ixs[-1].get("timing_plans", {}).get(plan_name, {})
                ph_stL = _phase_starts(plan_l, ixs[-1].get("nema_phases", {}))
                gL = _eff_green(ixs[-1].get("nema_phases", {}), in_ph, plan_l)
                cycL = plan_l.get("cycle", cycle_ref)
                iL = ph_stL.get(in_ph, 0) + k * cycL
                iT = iL + gL

                poly_in = []
                for i in range(len(ixs)):
                    tt = (last_d - cum_dist[i]) / speed_fps
                    poly_in.append((xT(iL + tt), yD(cum_dist[i])))
                for i in range(len(ixs) - 1, -1, -1):
                    tt = (last_d - cum_dist[i]) / speed_fps
                    poly_in.append((xT(iT + tt), yD(cum_dist[i])))

                c.setFillColor(colors.HexColor("#1d4ed8"))
                c.setFillAlpha(0.13)
                p = c.beginPath()
                p.moveTo(*poly_in[0])
                for pt in poly_in[1:]:
                    p.lineTo(*pt)
                p.close()
                c.drawPath(p, fill=1, stroke=0)
                c.setFillAlpha(1.0)

        # Border
        c.setStrokeColor(C_GRAY)
        c.setLineWidth(0.5)
        c.rect(ML, MB, pw, ph, fill=0, stroke=1)

        # Y-axis labels
        for i, ix in enumerate(ixs):
            y = yD(cum_dist[i])
            label = ix.get("name", f"Ix {i+1}")
            if len(label) > 20:
                label = label[:18] + "…"
            c.setFillColor(C_DARK)
            c.setFont("Helvetica", 6.5)
            c.drawRightString(ML - 3, y - 3, label)
            if cum_dist[i] > 0:
                c.setFillColor(C_GRAY)
                c.setFont("Helvetica", 5.5)
                c.drawRightString(ML - 3, y - 11, f"{int(cum_dist[i])} ft")

        # Title
        c.setFillColor(C_DARK)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(ML, MB + ph + 4,
                     f"Time-Space Diagram — {plan_name} Plan  |  Speed: {speed_mph} mph")

        # Legend
        legend = [
            (colors.HexColor("#16a34a"), "Out Green"),
            (colors.HexColor("#1d4ed8"), "In Green"),
            (colors.HexColor("#16a34a"), "Out Progression"),
            (colors.HexColor("#1d4ed8"), "In Progression"),
        ]
        for j, (col, lbl) in enumerate(legend):
            lx = ML + j * 108
            ly = MB - 22
            c.setFillColor(col)
            c.rect(lx, ly, 8, 6, fill=1, stroke=0)
            c.setFillColor(C_DARK)
            c.setFont("Helvetica", 6)
            c.drawString(lx + 11, ly, lbl)


# ── Section builders ──────────────────────────────────────────────────────────

def _cover(project, results, S):
    cs = results.get("corridor_summary", {})
    plan = results.get("active_plan", "AM")
    los = cs.get("corridor_los", "—")
    today = date.today().strftime("%B %d, %Y")

    elems = [
        Spacer(1, 0.5 * inch),
        HRFlowable(width="100%", thickness=3, color=C_BLUE, spaceAfter=12),
        Paragraph("Traffic Signal Corridor Analysis", S["subtitle"]),
        Spacer(1, 6),
        Paragraph(project.get("name", "Untitled Corridor"), S["title"]),
        Spacer(1, 4),
        HRFlowable(width="100%", thickness=1, color=C_LGRAY, spaceAfter=18),
    ]

    meta = Table(
        [["Date:", today],
         ["Active Plan:", plan],
         ["Corridor Speed:", f"{project.get('corridor_speed_mph', 35)} mph"],
         ["Methodology:", "HCM 7th Edition — Signalized Intersections"],
         ["Intersections Analyzed:", str(cs.get("intersections_analyzed", "—"))]],
        colWidths=[1.6 * inch, 4 * inch],
    )
    meta.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",      (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 9),
        ("TEXTCOLOR",     (0, 0), (0, -1), C_GRAY),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(meta)
    elems.append(Spacer(1, 0.3 * inch))

    kpi = Table(
        [["Corridor Delay", "Corridor LOS", "Total Throughput", "Intersections"],
         [f"{cs.get('avg_delay_s_veh', '—')} s/veh",
          los,
          f"{cs.get('total_throughput_vph', 0):,.0f} vph",
          str(cs.get("intersections_analyzed", 0))]],
        colWidths=[1.6 * inch] * 4,
    )
    kpi.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), C_HEADER),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 8),
        ("FONTNAME",      (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 1), (-1, 1), 16),
        ("TEXTCOLOR",     (1, 1), (1, 1), _los_color(los)),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("GRID",          (0, 0), (-1, -1), 0.5, C_LGRAY),
        ("BOX",           (0, 0), (-1, -1), 1, C_BLUE),
    ]))
    elems.append(kpi)
    return elems


def _input_summary(project, active_plan, S):
    ixs = project.get("intersections", [])
    elems = [
        Paragraph("Input Summary", S["h1"]),
        Paragraph("Intersection geometry and timing plan parameters.", S["note"]),
        Spacer(1, 8),
    ]

    if not ixs:
        elems.append(Paragraph("No intersections defined.", S["body"]))
        return elems

    rows = [["Intersection", "Type", "Dist (ft)", "Cycle (s)", "Offset (s)", "Approaches"]]
    for ix in ixs:
        plan = ix.get("timing_plans", {}).get(active_plan, {})
        rows.append([
            ix.get("name", "—"), ix.get("type", "4-leg"),
            str(ix.get("distance_from_prev_ft", 0)),
            str(plan.get("cycle", "—")), str(plan.get("offset", "—")),
            str(len(ix.get("approaches", []))),
        ])
    t = Table(rows, colWidths=[2.4*inch, 0.7*inch, 0.75*inch, 0.75*inch, 0.75*inch, 0.8*inch],
              repeatRows=1)
    t.setStyle(_base_table_style())
    elems.append(t)

    elems += [Spacer(1, 14), Paragraph(f"Phase Splits — {active_plan} Plan", S["h2"])]
    split_rows = [["Intersection"] + [f"φ{i}" for i in range(1, 9)]]
    for ix in ixs:
        plan = ix.get("timing_plans", {}).get(active_plan, {})
        splits = plan.get("splits", {})
        split_rows.append([ix.get("name", "—")] + [str(splits.get(str(i), "—")) for i in range(1, 9)])
    t2 = Table(split_rows, colWidths=[2.4*inch] + [0.5*inch]*8, repeatRows=1)
    t2.setStyle(_base_table_style())
    elems.append(t2)
    return elems


def _tsd_section(project, results, S):
    plan = results.get("active_plan", "AM")
    speed = project.get("corridor_speed_mph", 35)
    return [
        Paragraph("Time-Space Diagram", S["h1"]),
        Paragraph(
            f"Green bands show effective green windows. Shaded regions show outbound (green) "
            f"and inbound (blue) progression bands at {speed} mph.", S["note"]),
        Spacer(1, 8),
        TSDFlowable(project, plan, width=6.5 * inch, height=3.3 * inch),
    ]


def _delay_table(results, S):
    headers = ["Intersection", "Approach", "Mvmt", "Phase",
               "Vol\n(vph)", "Cap\n(vph)", "v/c", "Delay\n(s/veh)", "LOS"]
    rows = [headers]

    for ix_r in results.get("intersections", []):
        ix_name = ix_r.get("name", "—")
        for ap in ix_r.get("approaches", []):
            ap_dir = ap.get("direction", "—")
            for mv in ap.get("movements", []):
                los = mv.get("los", "—")
                rows.append([
                    ix_name, ap_dir, mv.get("movement", "—"),
                    f"φ{mv.get('phase','—')}",
                    f"{mv.get('volume_vph',0):.0f}",
                    f"{mv.get('capacity_vph',0):.0f}",
                    f"{mv.get('vc_ratio',0):.3f}",
                    f"{mv.get('delay_s_veh',0):.1f}",
                    los,
                ])
            rows.append(["", f"  {ap_dir} Sub", "", "", "", "", "",
                         f"{ap.get('approach_delay_s_veh',0):.1f}",
                         ap.get("approach_los", "—")])
        rows.append([f"  {ix_name} Total", "", "", "", "", "", "",
                     f"{ix_r.get('intersection_delay_s_veh',0):.1f}",
                     ix_r.get("intersection_los", "—")])

    col_w = [1.55*inch, 0.58*inch, 0.52*inch, 0.48*inch,
             0.52*inch, 0.52*inch, 0.48*inch, 0.72*inch, 0.38*inch]
    t = Table(rows, colWidths=col_w, repeatRows=1)
    style = _base_table_style()
    for r_idx, row in enumerate(rows):
        if r_idx == 0:
            continue
        los = row[-1]
        if los in LOS_COLORS:
            style.add("BACKGROUND", (-1, r_idx), (-1, r_idx), _los_color(los))
            style.add("TEXTCOLOR",  (-1, r_idx), (-1, r_idx), colors.white)
            style.add("FONTNAME",   (-1, r_idx), (-1, r_idx), "Helvetica-Bold")
        if row[0] == "" and "Sub" in str(row[1]):
            style.add("BACKGROUND", (0, r_idx), (-1, r_idx), colors.HexColor("#dbeafe"))
        elif "Total" in str(row[0]):
            style.add("BACKGROUND", (0, r_idx), (-1, r_idx), colors.HexColor("#bfdbfe"))
            style.add("FONTNAME",   (0, r_idx), (-1, r_idx), "Helvetica-Bold")
    t.setStyle(style)
    return [
        Paragraph("Delay Summary", S["h1"]),
        Paragraph("HCM 7th Edition control delay d = d₁ + d₂ + d₃ (seconds per vehicle).", S["note"]),
        Spacer(1, 8), t,
    ]


def _queue_table(results, S):
    headers = ["Intersection", "Approach", "Mvmt",
               "Vol (vph)", "v/c", "Q95 (veh)", "Q95 (ft)"]
    rows = [headers]
    for ix_r in results.get("intersections", []):
        for ap in ix_r.get("approaches", []):
            for mv in ap.get("movements", []):
                rows.append([
                    ix_r.get("name", "—"), ap.get("direction", "—"),
                    mv.get("movement", "—"),
                    f"{mv.get('volume_vph',0):.0f}",
                    f"{mv.get('vc_ratio',0):.3f}",
                    f"{mv.get('queue_95th_veh',0):.1f}",
                    f"{mv.get('queue_95th_ft',0):.0f}",
                ])

    col_w = [1.7*inch, 0.7*inch, 0.6*inch, 0.7*inch, 0.55*inch, 0.75*inch, 0.75*inch]
    t = Table(rows, colWidths=col_w, repeatRows=1)
    t.setStyle(_base_table_style())
    return [
        Paragraph("Queue Length — 95th Percentile", S["h1"]),
        Paragraph("HCM 7th Ed. Eq. 19-26. Vehicle length assumed 25 ft.", S["note"]),
        Spacer(1, 8), t,
    ]


def _throughput_table(results, S):
    headers = ["Intersection", "Approach", "Mvmt",
               "Volume (vph)", "Throughput (vph)", "Utilization"]
    rows = [headers]
    for ix_r in results.get("intersections", []):
        for ap in ix_r.get("approaches", []):
            for mv in ap.get("movements", []):
                cap = mv.get("capacity_vph", 1) or 1
                util = min(mv.get("volume_vph", 0) / cap, 1.0)
                rows.append([
                    ix_r.get("name", "—"), ap.get("direction", "—"),
                    mv.get("movement", "—"),
                    f"{mv.get('volume_vph',0):.0f}",
                    f"{mv.get('throughput_vph',0):.0f}",
                    f"{util:.1%}",
                ])

    col_w = [1.7*inch, 0.7*inch, 0.6*inch, 0.9*inch, 1.0*inch, 0.8*inch]
    t = Table(rows, colWidths=col_w, repeatRows=1)
    t.setStyle(_base_table_style())
    return [
        Paragraph("Throughput Summary", S["h1"]),
        Paragraph("Vehicles served per hour per movement.", S["note"]),
        Spacer(1, 8), t,
    ]


def _methodology(S):
    today = date.today().strftime("%B %d, %Y")
    return [
        Paragraph("Simulation Methodology", S["h1"]),
        Spacer(1, 6),
        Paragraph("<b>Standard:</b> Highway Capacity Manual, 7th Edition (HCM 7th), "
                  "Chapter 19 — Signalized Intersections.", S["body"]),
        Spacer(1, 4),
        Paragraph("<b>Control Delay:</b> d = d₁ + d₂ + d₃ — uniform delay d₁, "
                  "incremental delay d₂ (T = 0.25 h), and d₃ = 0 (no initial queue).", S["body"]),
        Spacer(1, 4),
        Paragraph("<b>Saturation Flow:</b> Base 1,900 pc/h/ln adjusted for lane width, "
                  "heavy vehicle % (E_T = 2.0), left-turn factor (0.95), right-turn factor (0.85).",
                  S["body"]),
        Spacer(1, 4),
        Paragraph("<b>95th Percentile Queue:</b> HCM 7th Eq. 19-26.", S["body"]),
        Spacer(1, 4),
        Paragraph("<b>Timing Model:</b> Simplified actuated control — splits used as effective "
                  "green times. No gap/extension modeling.", S["body"]),
        Spacer(1, 4),
        Paragraph("<b>Progression:</b> Robertson platoon dispersion consistent with HCM 7th. "
                  "Arrival type derived from TSD progression.", S["body"]),
        Spacer(1, 14),
        HRFlowable(width="100%", thickness=0.5, color=C_LGRAY),
        Spacer(1, 6),
        Paragraph(f"Generated by Traffic Signal Corridor Simulator · HCM 7th Edition · {today}",
                  S["note"]),
    ]


# ── Header / Footer ───────────────────────────────────────────────────────────

def _header_footer(project_name, plan):
    def on_page(canvas, doc):
        canvas.saveState()
        W, H = letter
        canvas.setFillColor(C_HEADER)
        canvas.rect(0, H - 0.42 * inch, W, 0.42 * inch, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(0.5 * inch, H - 0.28 * inch, project_name)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(W - 0.5 * inch, H - 0.28 * inch,
                               f"{plan} Plan  ·  HCM 7th Edition")
        canvas.setFillColor(C_GRAY)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(0.5 * inch, 0.28 * inch,
                          "Traffic Signal Corridor Analysis — Confidential")
        canvas.drawRightString(W - 0.5 * inch, 0.28 * inch, f"Page {doc.page}")
        canvas.restoreState()
    return on_page


# ── Public entry point ────────────────────────────────────────────────────────

def generate_pdf_report(project: dict, results: dict) -> bytes:
    buf = io.BytesIO()
    plan = results.get("active_plan", "AM")
    name = project.get("name", "Corridor Analysis")
    S = _styles()

    doc = BaseDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.5 * inch, rightMargin=0.5 * inch,
        topMargin=0.6 * inch, bottomMargin=0.5 * inch,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=_header_footer(name, plan))
    ])

    story = (
        _cover(project, results, S) + [PageBreak()]
        + _input_summary(project, plan, S) + [PageBreak()]
        + _tsd_section(project, results, S) + [PageBreak()]
        + _delay_table(results, S) + [PageBreak()]
        + _queue_table(results, S) + [PageBreak()]
        + _throughput_table(results, S) + [PageBreak()]
        + _methodology(S)
    )

    doc.build(story)
    buf.seek(0)
    return buf.read()
