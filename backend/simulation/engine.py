"""
Main simulation engine — HCM 7th Edition corridor simulation.
"""

from .hcm7 import control_delay, queue_95th, los_from_delay
from .saturation import adjusted_saturation_flow
from .platoon import travel_time_seconds, robertson_dispersion

# Standard NEMA phase-to-approach-direction mapping (conventional TS-2).
#   Ring 1: 1(EB-L), 2(EB-T/R), 5(WB-L), 6(WB-T/R)
#   Ring 2: 3(NB-L), 4(NB-T/R), 7(SB-L), 8(SB-T/R)
_DIRECTION_PHASE = {
    "NB": {"L": 3, "T": 4, "R": 4},
    "SB": {"L": 7, "T": 8, "R": 8},
    "EB": {"L": 1, "T": 2, "R": 2},
    "WB": {"L": 5, "T": 6, "R": 6},
}


def _movement_phase(direction: str, movement: str) -> int:
    dir_map = _DIRECTION_PHASE.get(direction, {})
    for m in ("L", "T", "R"):
        if m in movement:
            return dir_map.get(m, 2)
    return 2


def _effective_green(phase_num: int, timing_plan: dict, nema_phases: dict) -> float:
    """split − yellow − all-red  (≥ 0)."""
    key = str(phase_num)
    split = timing_plan.get("splits", {}).get(key, 0)
    ph = nema_phases.get(key, {})
    g = split - ph.get("yellow", 4) - ph.get("all_red", 1)
    return max(0.0, g)


def _demand_flow(bins: list, phf: float) -> float:
    """Sum 15-min bin counts → peak-hour adjusted flow rate (veh/h)."""
    total = sum(float(b) for b in (bins or []))
    return total / max(phf, 0.01)


def _weighted_avg_delay(movements: list) -> float:
    total_vol = sum(m["volume_vph"] for m in movements)
    if total_vol == 0:
        return 0.0
    return sum(m["delay_s_veh"] * m["volume_vph"] for m in movements) / total_vol


def _process_intersection(intersection: dict, demand: dict, active_plan: str) -> dict:
    timing_plan = intersection.get("timing_plans", {}).get(active_plan, {})
    nema_phases = intersection.get("nema_phases", {})
    cycle = float(timing_plan.get("cycle", 120))

    approach_results = []

    for approach in intersection.get("approaches", []):
        direction = approach.get("direction", "NB")
        phf = float(approach.get("phf", 0.95))
        hv_pct = float(approach.get("heavy_vehicle_pct", 2))
        demand_dir = demand.get(direction, {})
        lanes = approach.get("lanes", [])

        # Group lanes by movement label
        movement_lanes: dict[str, list[float]] = {}
        for lane in lanes:
            mov = lane.get("movement", "T")
            w = float(lane.get("width_ft", 12))
            movement_lanes.setdefault(mov, []).append(w)

        movement_results = []

        for movement, lane_widths in movement_lanes.items():
            n_lanes = len(lane_widths)
            avg_width = sum(lane_widths) / n_lanes

            # Aggregate demand for all movement components (L, T, R)
            total_volume = 0.0
            for m in ("L", "T", "R"):
                if m in movement:
                    bins = demand_dir.get(m, [0, 0, 0, 0])
                    total_volume += _demand_flow(bins, phf)

            phase_num = _movement_phase(direction, movement)
            phase_data = nema_phases.get(str(phase_num), {})

            # Skip inactive phases
            if not phase_data.get("active", True):
                continue

            g = _effective_green(phase_num, timing_plan, nema_phases)
            s_per_lane = adjusted_saturation_flow(movement, avg_width, hv_pct)
            s_total = s_per_lane * n_lanes
            cap = s_total * (g / cycle) if cycle > 0 else 0.0
            vc = total_volume / cap if cap > 0 else 0.0

            # Delay and queue use total-group saturation flow
            delay = control_delay(total_volume, s_total, g, cycle)

            # Queue per lane for Q95 calculation
            q95_veh = queue_95th(
                total_volume / n_lanes if n_lanes else total_volume,
                s_per_lane,
                g,
                cycle,
            ) * n_lanes  # scale back to lane group

            q95_ft = q95_veh * 25.0  # average vehicle spacing = 25 ft

            throughput = min(total_volume, cap)
            los = los_from_delay(delay)

            movement_results.append(
                {
                    "movement": movement,
                    "lanes": n_lanes,
                    "phase": phase_num,
                    "volume_vph": round(total_volume, 1),
                    "capacity_vph": round(cap, 1),
                    "vc_ratio": round(vc, 3),
                    "effective_green_s": round(g, 1),
                    "saturation_flow": round(s_total, 0),
                    "delay_s_veh": round(delay, 1),
                    "queue_95th_veh": round(q95_veh, 1),
                    "queue_95th_ft": round(q95_ft, 0),
                    "throughput_vph": round(throughput, 1),
                    "los": los,
                }
            )

        if movement_results:
            ap_delay = _weighted_avg_delay(movement_results)
            approach_results.append(
                {
                    "direction": direction,
                    "movements": movement_results,
                    "approach_delay_s_veh": round(ap_delay, 1),
                    "approach_los": los_from_delay(ap_delay),
                }
            )

    all_movements = [m for a in approach_results for m in a["movements"]]
    int_delay = _weighted_avg_delay(all_movements)

    return {
        "id": intersection.get("id"),
        "name": intersection.get("name"),
        "type": intersection.get("type"),
        "cycle": cycle,
        "active_plan": active_plan,
        "approaches": approach_results,
        "intersection_delay_s_veh": round(int_delay, 1),
        "intersection_los": los_from_delay(int_delay),
    }


def run_simulation(project: dict) -> dict:
    """
    Run the full HCM 7th Edition corridor simulation.
    Returns structured results for all intersections and corridor summary.
    """
    active_plan = project.get("active_plan", "AM")
    corridor_speed_mph = float(project.get("corridor_speed_mph", 35))
    intersections = project.get("intersections", [])
    demand = project.get("demand", {})

    if not intersections:
        return {
            "status": "error",
            "message": "No intersections defined in this project.",
            "intersections": [],
            "corridor_summary": None,
        }

    ix_results = []
    for ix in intersections:
        ix_id = ix.get("id")
        # demand keys may be int or string
        ix_demand = demand.get(str(ix_id), demand.get(ix_id, {}))
        ix_results.append(_process_intersection(ix, ix_demand, active_plan))

    # Platoon dispersion: build arrival profiles for TSD (Phase 3)
    platoon_data = _build_platoon_profiles(ix_results, intersections, corridor_speed_mph)

    # Corridor-level summary (volume-weighted average of all movements)
    all_movements = [
        m
        for r in ix_results
        for a in r["approaches"]
        for m in a["movements"]
    ]
    corridor_delay = _weighted_avg_delay(all_movements) if all_movements else 0.0
    total_throughput = sum(m["throughput_vph"] for m in all_movements)

    return {
        "status": "complete",
        "active_plan": active_plan,
        "corridor_summary": {
            "avg_delay_s_veh": round(corridor_delay, 1),
            "corridor_los": los_from_delay(corridor_delay),
            "total_throughput_vph": round(total_throughput, 1),
            "intersections_analyzed": len(ix_results),
        },
        "intersections": ix_results,
        "platoon_data": platoon_data,
    }


def _build_platoon_profiles(
    ix_results: list,
    intersections: list,
    corridor_speed_mph: float,
) -> list:
    """
    Compute Robertson-dispersed platoon arrival profiles between intersections.
    Returns per-intersection travel time and dispersion parameters for TSD.
    """
    profiles = []
    for i, (ix_result, ix) in enumerate(zip(ix_results, intersections)):
        dist_ft = float(ix.get("distance_from_prev_ft", 0)) if i > 0 else 0.0
        tt = travel_time_seconds(dist_ft, corridor_speed_mph) if dist_ft > 0 else 0.0
        profiles.append(
            {
                "intersection_id": ix_result["id"],
                "distance_from_prev_ft": dist_ft,
                "travel_time_s": round(tt, 1),
            }
        )
    return profiles
