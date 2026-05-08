"""
Saturation flow rate adjustments per HCM 7th Edition, Chapter 19.
Base saturation flow: 1,900 pcphgpl.
"""

BASE_SATURATION_FLOW = 1900  # pc/h/g/ln


def heavy_vehicle_factor(heavy_vehicle_pct: float) -> float:
    """HCM Eq. 19-9: fHV = 1 / (1 + PHV*(ET-1)), ET=2.0 for signalized."""
    ET = 2.0
    phv = heavy_vehicle_pct / 100.0
    return 1.0 / (1.0 + phv * (ET - 1.0))


def lane_width_factor(width_ft: float) -> float:
    """HCM Eq. 19-7: fw = 1 + (W - 12) / 30. Clipped to [0.96, 1.05] range."""
    fw = 1.0 + (width_ft - 12.0) / 30.0
    return max(0.96, min(fw, 1.05))


def left_turn_factor(proportion_left: float = 1.0) -> float:
    """HCM Eq. 19-11: fLT = 0.95 for exclusive left-turn lanes."""
    return 0.95


def right_turn_factor(proportion_right: float = 1.0) -> float:
    """HCM Eq. 19-12: fRT = 0.85 for exclusive right-turn lanes."""
    return 0.85


def adjusted_saturation_flow(
    movement: str,
    width_ft: float = 12.0,
    heavy_vehicle_pct: float = 2.0,
) -> float:
    """
    Return adjusted saturation flow rate in veh/h/g/ln.
    movement: 'L', 'T', 'R', 'LT', 'TR', 'LR', 'LTR'
    """
    s0 = BASE_SATURATION_FLOW
    fw = lane_width_factor(width_ft)
    fhv = heavy_vehicle_factor(heavy_vehicle_pct)

    if movement == "L":
        fmov = left_turn_factor()
    elif movement == "R":
        fmov = right_turn_factor()
    else:
        fmov = 1.0

    return s0 * fw * fhv * fmov
