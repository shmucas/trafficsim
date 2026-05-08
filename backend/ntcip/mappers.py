"""
NTCIP object-to-input-field mappers (Phase 5 stub).
Maps parsed NTCIP objects to the project JSON schema.
"""


def map_to_project_schema(parsed: dict) -> dict:
    """
    Convert parsed NTCIP data to project intersection schema fields.
    Phase 5 implementation — currently returns empty mapping.
    """
    return {
        "nema_phases": {},
        "timing_plans": {},
        "overlaps": [],
        "detectors": [],
    }
