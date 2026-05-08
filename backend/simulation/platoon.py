"""
Robertson's platoon dispersion model (HCM 7th Edition).
Used to propagate arrival profiles between intersections.
"""

import math


def robertson_dispersion(
    arrivals: list[float],
    travel_time_s: float,
    alpha: float = 0.5,
    beta: float = 0.8,
) -> list[float]:
    """
    Apply Robertson's recursive platoon dispersion model.

    Parameters
    ----------
    arrivals    : list of arrival counts per time step (0.1s resolution)
    travel_time_s : link travel time in seconds
    alpha       : smoothing factor (typically 0.5)
    beta        : fraction of platoon that remains in platoon (typically 0.8)

    Returns
    -------
    Dispersed arrival profile (same length as input).
    """
    if not arrivals:
        return []

    n = len(arrivals)
    lag = max(1, round(travel_time_s / 0.1))  # steps

    dispersed = [0.0] * n
    for t in range(n):
        src_t = t - lag
        if src_t < 0:
            q_in = 0.0
        else:
            q_in = arrivals[src_t]

        prev = dispersed[t - 1] if t > 0 else 0.0
        dispersed[t] = alpha * beta * q_in + (1 - alpha * beta) * prev

    return dispersed


def travel_time_seconds(distance_ft: float, speed_mph: float) -> float:
    """Convert distance (ft) and speed (mph) to travel time (s)."""
    if speed_mph <= 0:
        return 0.0
    speed_fps = speed_mph * 5280.0 / 3600.0
    return distance_ft / speed_fps
