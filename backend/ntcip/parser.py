"""
NTCIP controller database parser (Phase 5 stub).
Supports Econolite ASC/3 and Intelight DB formats.
"""


def parse_ntcip_file(file_bytes: bytes, filename: str) -> dict:
    """
    Parse an NTCIP controller database file.
    Returns a normalized dict with phase parameters, timing plans,
    overlap definitions, and detector configuration.

    Phase 5 implementation — currently returns a stub.
    """
    return {
        "status": "stub",
        "message": "NTCIP import will be implemented in Phase 5.",
        "phases": {},
        "timing_plans": {},
        "overlaps": [],
        "detectors": [],
        "log": [],
    }
