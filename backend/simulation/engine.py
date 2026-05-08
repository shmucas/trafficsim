"""
Main simulation engine (Phase 2 — placeholder structure for Phase 1).
Phase 1: returns empty results. Full HCM 7th calculations in Phase 2.
"""

from .hcm7 import control_delay, queue_95th, los_from_delay
from .saturation import adjusted_saturation_flow
from .platoon import travel_time_seconds, robertson_dispersion


def run_simulation(project: dict) -> dict:
    """
    Run the corridor simulation for the active timing plan.
    Phase 1 returns a stub result structure.
    Full simulation engine implemented in Phase 2.
    """
    return {
        "status": "pending",
        "message": "Simulation engine will be implemented in Phase 2.",
        "results": [],
    }
