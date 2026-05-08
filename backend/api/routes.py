import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from .models import ProjectCreate, ProjectUpdate
from storage import project_db
from simulation.engine import run_simulation
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
