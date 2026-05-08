import json
import textwrap
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from .models import ProjectCreate, ProjectUpdate
from storage import project_db
from simulation.engine import run_simulation
from ntcip.parser import parse_ntcip_file
from ntcip.mappers import map_to_project_schema
from export.pdf_report import generate_pdf_report
import io

router = APIRouter(prefix="/api")


@router.get("/projects")
async def list_projects():
    projects = await project_db.list_projects()
    return projects


@router.post("/projects", status_code=201)
async def create_project(body: ProjectCreate):
    project = await project_db.create_project(
        name=body.name,
        extra_data={
            "corridor_speed_mph": body.corridor_speed_mph,
            "active_plan": body.active_plan,
            "intersections": body.intersections,
            "demand": body.demand,
        },
    )
    return project


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    project = await project_db.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate):
    updates = body.model_dump(exclude_none=True)
    project = await project_db.update_project(project_id, updates)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: str):
    deleted = await project_db.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")


@router.post("/projects/{project_id}/simulate")
async def simulate_project(project_id: str):
    project = await project_db.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    results = run_simulation(project)
    # Persist simulation results on the project
    await project_db.update_project(project_id, {"simulation_results": results})
    return results


@router.post("/projects/{project_id}/intersections/{intersection_id}/import-ntcip")
async def import_ntcip(
    project_id: str,
    intersection_id: str,
    file: UploadFile = File(...),
):
    project = await project_db.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    ix_list = project.get("intersections", [])
    ix = next((i for i in ix_list if str(i.get("id")) == str(intersection_id)), None)
    if ix is None:
        raise HTTPException(status_code=404, detail="Intersection not found")

    content = await file.read()
    parsed = parse_ntcip_file(content, file.filename or "upload")
    mapped = map_to_project_schema(parsed)

    # Merge warnings from mapper into log
    for w in mapped.get("warnings", []):
        parsed["log"].append({"level": "warn", "message": w})

    return {
        "format": parsed["format"],
        "log": parsed["log"],
        "mapped": {
            "nema_phases": mapped["nema_phases"],
            "timing_plans": mapped["timing_plans"],
            "overlaps": mapped["overlaps"],
            "detectors": mapped["detectors"],
        },
    }


@router.get("/ntcip/sample-csv")
async def ntcip_sample_csv():
    """Return a filled-in sample NTCIP CSV the user can edit and re-upload."""
    sample = textwrap.dedent("""\
        # NTCIP Controller Database — Generic CSV Export
        # Columns: SECTION, FIELD, PHASE_OR_CHANNEL, PLAN, VALUE
        # Lines starting with # are comments.
        #
        # SECTION values : PHASE | PLAN | OVERLAP | DETECTOR
        # PHASE FIELDs   : MIN_GREEN, MAX_GREEN, YELLOW, ALL_RED, RECALL, ACTIVE
        # PLAN FIELDs    : CYCLE, OFFSET, SPLIT
        # OVERLAP FIELD  : PHASES  (pipe-separated list, e.g. 2|6)
        # DETECTOR FIELDs: TYPE (stop_bar|advance), PHASE
        # PLAN names     : AM | PM | Off-Peak
        # RECALL values  : None | Min | Max | Ped
        #
        SECTION,FIELD,PHASE_OR_CHANNEL,PLAN,VALUE
        # ── Phase Parameters ─────────────────────────────
        PHASE,MIN_GREEN,1,,5
        PHASE,MAX_GREEN,1,,30
        PHASE,YELLOW,1,,4
        PHASE,ALL_RED,1,,1
        PHASE,RECALL,1,,None
        PHASE,MIN_GREEN,2,,10
        PHASE,MAX_GREEN,2,,60
        PHASE,YELLOW,2,,4
        PHASE,ALL_RED,2,,1
        PHASE,RECALL,2,,None
        PHASE,MIN_GREEN,3,,5
        PHASE,MAX_GREEN,3,,30
        PHASE,YELLOW,3,,4
        PHASE,ALL_RED,3,,1
        PHASE,RECALL,3,,None
        PHASE,MIN_GREEN,4,,10
        PHASE,MAX_GREEN,4,,60
        PHASE,YELLOW,4,,4
        PHASE,ALL_RED,4,,1
        PHASE,RECALL,4,,None
        PHASE,MIN_GREEN,5,,5
        PHASE,MAX_GREEN,5,,30
        PHASE,YELLOW,5,,4
        PHASE,ALL_RED,5,,1
        PHASE,RECALL,5,,None
        PHASE,MIN_GREEN,6,,10
        PHASE,MAX_GREEN,6,,60
        PHASE,YELLOW,6,,4
        PHASE,ALL_RED,6,,1
        PHASE,RECALL,6,,None
        PHASE,MIN_GREEN,7,,5
        PHASE,MAX_GREEN,7,,30
        PHASE,YELLOW,7,,4
        PHASE,ALL_RED,7,,1
        PHASE,RECALL,7,,None
        PHASE,MIN_GREEN,8,,10
        PHASE,MAX_GREEN,8,,60
        PHASE,YELLOW,8,,4
        PHASE,ALL_RED,8,,1
        PHASE,RECALL,8,,None
        # ── AM Timing Plan ───────────────────────────────
        PLAN,CYCLE,,AM,120
        PLAN,OFFSET,,AM,0
        PLAN,SPLIT,1,AM,10
        PLAN,SPLIT,2,AM,50
        PLAN,SPLIT,3,AM,10
        PLAN,SPLIT,4,AM,50
        PLAN,SPLIT,5,AM,10
        PLAN,SPLIT,6,AM,50
        PLAN,SPLIT,7,AM,10
        PLAN,SPLIT,8,AM,50
        # ── PM Timing Plan ───────────────────────────────
        PLAN,CYCLE,,PM,140
        PLAN,OFFSET,,PM,15
        PLAN,SPLIT,1,PM,12
        PLAN,SPLIT,2,PM,58
        PLAN,SPLIT,3,PM,12
        PLAN,SPLIT,4,PM,58
        PLAN,SPLIT,5,PM,12
        PLAN,SPLIT,6,PM,58
        PLAN,SPLIT,7,PM,12
        PLAN,SPLIT,8,PM,58
        # ── Off-Peak Timing Plan ─────────────────────────
        PLAN,CYCLE,,Off-Peak,90
        PLAN,OFFSET,,Off-Peak,0
        PLAN,SPLIT,1,Off-Peak,8
        PLAN,SPLIT,2,Off-Peak,37
        PLAN,SPLIT,3,Off-Peak,8
        PLAN,SPLIT,4,Off-Peak,37
        PLAN,SPLIT,5,Off-Peak,8
        PLAN,SPLIT,6,Off-Peak,37
        PLAN,SPLIT,7,Off-Peak,8
        PLAN,SPLIT,8,Off-Peak,37
        # ── Overlaps ─────────────────────────────────────
        OVERLAP,PHASES,A,,2|6
        OVERLAP,PHASES,B,,4|8
        # ── Detectors ────────────────────────────────────
        DETECTOR,TYPE,CH1,,stop_bar
        DETECTOR,PHASE,CH1,,2
        DETECTOR,TYPE,CH2,,stop_bar
        DETECTOR,PHASE,CH2,,6
        DETECTOR,TYPE,CH3,,advance
        DETECTOR,PHASE,CH3,,2
    """)
    return StreamingResponse(
        io.StringIO(sample),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="ntcip_sample.csv"'},
    )


@router.get("/projects/{project_id}/report")
async def export_pdf(project_id: str):
    project = await project_db.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    results = project.get("simulation_results")
    if not results or results.get("status") != "complete":
        raise HTTPException(status_code=400, detail="No simulation results — run simulation first")
    pdf_bytes = generate_pdf_report(project, results)
    safe_name = project.get("name", "report").replace(" ", "_")
    plan = results.get("active_plan", "AM")
    filename = f"{safe_name}_{plan}_report.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/projects/{project_id}/export")
async def export_project(project_id: str):
    project = await project_db.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    content = json.dumps(project, indent=2)
    filename = f"{project.get('name', 'project').replace(' ', '_')}.json"
    return StreamingResponse(
        io.StringIO(content),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
