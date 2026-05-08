"""
HCM 7th Edition signalized intersection calculations (Chapter 19).
Control delay: d = d1 + d2 + d3
"""

import math


def uniform_delay(
    v: float,
    s: float,
    g: float,
    C: float,
) -> float:
    """
    d1 — Uniform control delay (HCM 7th Eq. 19-18a).

    Parameters
    ----------
    v : demand flow rate (veh/h)
    s : adjusted saturation flow rate (veh/h)
    g : effective green time (s)
    C : cycle length (s)
    """
    if s <= 0 or C <= 0:
        return 0.0
    g_over_C = g / C
    X = v / (s * g_over_C) if (s * g_over_C) > 0 else 0.0
    X = min(X, 1.0)

    numerator = 0.5 * C * (1.0 - g_over_C) ** 2
    denominator = 1.0 - min(1.0, X) * g_over_C
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def incremental_delay(
    v: float,
    s: float,
    g: float,
    C: float,
    k: float = 0.5,
    I: float = 1.0,
) -> float:
    """
    d2 — Incremental delay (HCM 7th Eq. 19-18b).

    Parameters
    ----------
    k : incremental delay factor (0.5 for pre-timed, 0.4–0.6 for actuated)
    I : upstream filtering/metering adjustment (1.0 = isolated)
    """
    if s <= 0 or C <= 0:
        return 0.0
    g_over_C = g / C
    cap = s * g_over_C
    if cap <= 0:
        return 0.0
    X = v / cap
    T = 0.25  # analysis period hours (15-min)
    d2 = 900 * T * (
        (X - 1) + math.sqrt((X - 1) ** 2 + (8 * k * I * X) / (cap * T))
    )
    return max(0.0, d2)


def initial_queue_delay(Q_b: float = 0.0) -> float:
    """
    d3 — Initial queue delay (HCM 7th Eq. 19-18c).
    Q_b: initial queue at start of analysis period (veh).
    Simplified: returns 0 for Phase 1 (no residual queue tracking).
    """
    return 0.0


def control_delay(
    v: float,
    s: float,
    g: float,
    C: float,
    k: float = 0.5,
    I: float = 1.0,
) -> float:
    """Total control delay d = d1 + d2 + d3 (seconds per vehicle)."""
    d1 = uniform_delay(v, s, g, C)
    d2 = incremental_delay(v, s, g, C, k, I)
    d3 = initial_queue_delay()
    return d1 + d2 + d3


def queue_95th(
    v: float,
    s: float,
    g: float,
    C: float,
) -> float:
    """
    95th percentile queue length (HCM 7th Eq. 19-26), in vehicles.

    Q95 = Q_bar * (1 + 8 * k_b * c_b / Q_bar)^0.5 ... simplified form:
    Uses the HCM overflow queue approximation.
    """
    if s <= 0 or C <= 0:
        return 0.0
    g_over_C = g / C
    cap = s * g_over_C
    if cap <= 0:
        return 0.0
    X = v / cap
    T = 0.25
    # Average queue
    Q_avg = (v * C / 3600.0) * (1.0 - g_over_C)
    # Overflow component
    if X < 1.0:
        overflow = 0.0
    else:
        overflow = 900 * T * ((X - 1) + math.sqrt((X - 1) ** 2 + (4 * X) / (cap * T)))
    Q95 = 1.5 * Q_avg + overflow
    return max(0.0, Q95)


def los_from_delay(delay_s: float) -> str:
    """Return HCM LOS letter from control delay (s/veh)."""
    if delay_s <= 10:
        return "A"
    elif delay_s <= 20:
        return "B"
    elif delay_s <= 35:
        return "C"
    elif delay_s <= 55:
        return "D"
    elif delay_s <= 80:
        return "E"
    else:
        return "F"
