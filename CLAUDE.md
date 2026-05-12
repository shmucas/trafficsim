# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Traffic Simulation Web App is a locally-hosted full-stack application for simulating signalized corridor performance using HCM 7th Edition Chapter 19 methodology. It ingests turning movement counts (TMCs) and NTCIP controller databases, runs delay calculations, and visualizes results through time-space diagrams.

**Stack:**
- Frontend: React 18, Vite, Tailwind CSS, Zustand (state management), Axios (HTTP)
- Backend: Python FastAPI, Uvicorn, SQLite (aiosqlite)
- Standards: NTCIP (controller imports), NEMA TS-2 (phase mapping), HCM 7th Edition (delay calculations)

## Getting Started

### Backend Setup & Run
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload  # Runs on http://localhost:8000
```

### Frontend Setup & Run
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

The frontend proxies `/api/*` requests to `http://localhost:8000` via Vite's proxy config.

### Database
SQLite database persists to `backend/traffic_sim.db`. Schema is auto-created on backend startup (single `projects` table with id, name, analyst, created, updated, data JSON columns).

## High-Level Architecture

### Frontend Data Flow
The frontend uses a **Zustand store** (`src/store/projectStore.js`) as the single source of truth. When users navigate between tabs (Corridor, Intersection, Demand, Simulation, Results), they're editing in-memory project state. The Save button persists the entire project object to the backend via a PUT request.

**Key UI Views:**
- **ProjectDashboard** — List/create/delete projects
- **CorridorSetup** — Edit corridor metadata (speed, analyst) and intersection ordering
- **IntersectionEditor** — Tabbed editor with 4 approaches, lane geometry, NEMA phases, timing plans, overlaps, detectors, and NTCIP import
- **DemandInput** — 15-minute turning movement count (TMC) grid (L/T/R) × 4 time bins per approach
- **SimulationView** — Trigger simulation run, displays status/progress
- **ResultsView** — Delay/queue/LOS table (per lane group) and time-space diagram (TSD canvas)

### Backend Request Handlers
FastAPI routes in `api/routes.py` handle:
- **Project CRUD** — `/projects` (GET/POST/PUT/DELETE)
- **Simulation** — POST `/projects/{id}/simulate` calls `simulation.engine.run_simulation()`
- **NTCIP Import** — POST `/projects/{id}/intersections/{iid}/import-ntcip` parses file → maps to schema
- **Export** — GET `/projects/{id}/report` (PDF), `/projects/{id}/export` (JSON)

### Simulation Engine Architecture
The simulation pipeline (`backend/simulation/engine.py`) is the computational core:

1. **Per-intersection processing** (`_process_intersection`):
   - Extract timing plan (cycle, splits, phase min/max/yellow/all-red)
   - For each approach (NB/SB/EB/WB):
     - For each movement (L/T/R or combinations):
       - Sum demand across 4 × 15-min time bins → peak-hour flow rate
       - Look up NEMA phase number (default or custom assignment)
       - Calculate effective green = split - yellow - all-red
       - Compute adjusted saturation flow (base 1900 pc/h/ln with factors for lane width, HV%, turn movement)
       - Apply HCM 7th uniform delay (d1) and incremental delay (d2) formulas
       - Calculate 95th percentile queue, v/c, capacity, LOS

2. **Key sub-modules:**
   - `saturation.py` — `adjusted_saturation_flow()` applies HCM 7th Eq. 19-7 (lane width), 19-9 (HV), 19-11/12 (turns)
   - `hcm7.py` — `uniform_delay()` (Eq. 19-18a), `incremental_delay()` (Eq. 19-18b), `queue_95th()` (Eq. 19-26), `los_from_delay()` (thresholds A–F)
   - `platoon.py` — `robertson_dispersion()` propagates arrival profiles between intersections for time-space diagram

3. **Output structure:**
   - Per-movement results: volume_vph, saturation_flow, effective_green, capacity, v_c, delay_s_veh, queue_95th, los
   - Per-approach aggregates: weighted average delay
   - Corridor-level KPIs: average delay, total throughput
   - **Stored back on project** under `simulation_results` field

### NTCIP Parser
`backend/ntcip/parser.py` auto-detects controller export format by inspecting file content:
- **Generic NTCIP CSV** (fallback) — columns `SECTION,FIELD,PHASE_OR_CHANNEL,PLAN,VALUE`
- **Econolite ASC/3** — recognizes header keywords and column structure
- **Intelight** — detects "intelight"/"intelli" in header
- **JSON** — pass-through to schema (no parsing needed)

Parsed output includes a structured log (parse events + warnings) and extracted phase parameters, timing plans, overlaps, detectors. The mapper (`ntcip/mappers.py`) then translates to project schema format (NEMA phases dict, timing plans dict, etc.).

### Project Schema Structure
A project JSON object contains:
```
{
  id, name, analyst, created, updated,
  corridor_speed_mph,
  active_plan: "AM" | "PM" | "Off-Peak",
  intersections: [
    {
      id, name, type, distance_from_prev_ft,
      approaches: [
        { direction: "NB"|"SB"|"EB"|"WB",
          lanes: [{movement, width_ft}, ...],
          phf, heavy_vehicle_pct, detector: {...} }
      ],
      nema_phases: { "1": {active, min_green, max_green, yellow, all_red, recall}, ... },
      timing_plans: { "AM": {cycle, offset, splits: {"1": ..., ...}}, ... },
      phase_assignments: { "NB": {L, T, R: phase_nums}, ... },  # optional override
      overlaps: [{name, phases: [1,2]}, ...],
      detectors: [{channel, type, phase}, ...],
      ring_config: { ring1, ring2, barrier_pos }
    }
  ],
  demand: { "NB": {L: [bin1, bin2, bin3, bin4], T: [...], R: [...]}, ... },
  simulation_results: { status, active_plan, intersections: [...] }  # if simulated
}
```

## Phase Mapping & Ring-Barrier

The engine uses **NEMA TS-2 standard phase-to-direction mapping** by default (hardcoded in `_DIRECTION_PHASE`):
- Ring 1 (actuated phases): 1=EB-L, 2=EB-T/R, 5=WB-L, 6=WB-T/R
- Ring 2 (side streets): 3=NB-L, 4=NB-T/R, 7=SB-L, 8=SB-T/R

Intersections can override this via `phase_assignments` (a custom mapping dict). The UI (IntersectionEditor, NEMADiagram component) allows editing ring config and phase assignments.

## PDF Report Generation
`backend/export/pdf_report.py` generates a multi-section ReportLab PDF:
1. Cover page with project metadata and corridor KPIs
2. Input summary (geometry, timing, approach data)
3. Time-space diagram (rendered programmatically on page)
4. Delay summary table (per movement)
5. Queue length results
6. Throughput summary
7. Methodology note (HCM 7th reference)

## Common Development Tasks

### Adding a New Simulation Parameter
1. Add to project schema (e.g., `frontend/src/store/projectStore.js` default intersection)
2. Update API models (`backend/api/models.py`)
3. Add UI input in relevant component (e.g., IntersectionEditor.jsx)
4. Reference in simulation logic (`backend/simulation/engine.py`)
5. Test via POST `/simulate`

### Modifying HCM 7th Calculations
Edit equations in `backend/simulation/hcm7.py`, `saturation.py`. Tests verify against manual HCM 7th Chapter 19 calcs. Changes propagate through `engine.py` → `run_simulation()` → project results.

### Extending NTCIP Parser
Add detection logic to `backend/ntcip/parser.py` (check file header/format), then create a mapper function in `mappers.py` to convert parsed format to project schema. Test with sample controller export files.

### Frontend State Updates
All mutable state lives in Zustand store (`projectStore.js`). Components dispatch actions (e.g., `updateIntersection(id, data)`) which trigger re-renders. Use `saveProject()` to persist to backend.

## Important Conventions

- **Demand format:** Turning movement counts are stored as arrays of 4 × 15-minute bins per movement per direction (e.g., `demand.NB.L = [100, 120, 110, 130]`). The engine sums these and divides by PHF to get peak-hour flow rate.
- **Phase numbering:** Always 1–8 per NEMA TS-2 standard.
- **Time units:** Speed in mph, distances in feet, all delays/times in seconds. Cycle, offset, splits, green times in seconds.
- **Effective green:** split − yellow − all_red (must be ≥ 0, clamped by engine).
- **LOS thresholds (HCM 7th):** A ≤10s, B ≤15s, C ≤25s, D ≤40s, E ≤80s, F >80s.

## Debugging & Testing

- **Backend logs:** Uvicorn prints request/response to stdout.
- **Frontend logs:** Browser console (F12) shows Axios errors and Zustand state changes.
- **Database inspection:** Use `sqlite3 backend/traffic_sim.db` to query/inspect projects table.
- **Simulation validation:** Compare engine output against HCM 7th Chapter 19 manual calcs or industry tools (Synchro, SIDRA).

## File Organization

```
backend/
  main.py              # FastAPI app setup, CORS, lifespan handler
  api/
    routes.py          # All endpoint handlers
    models.py          # Pydantic request/response schemas
  simulation/
    engine.py          # Main simulation loop, per-intersection processing
    hcm7.py            # HCM 7th Eq. 19-18a (d1), 19-18b (d2), 19-26 (queue), LOS
    saturation.py      # Saturation flow with lane width/HV/turn factors
    platoon.py         # Robertson dispersion for TSD
  ntcip/
    parser.py          # Format detection & parsing (Econolite, Intelight, generic CSV, JSON)
    mappers.py         # Convert parsed format → project schema
  export/
    pdf_report.py      # ReportLab PDF generation
  storage/
    project_db.py      # SQLite CRUD (async)

frontend/
  src/
    App.jsx            # Main router, nav bar, view dispatch
    store/
      projectStore.js  # Zustand store (CRUD, UI state, sim trigger)
    components/
      ProjectDashboard.jsx
      CorridorSetup.jsx
      IntersectionEditor.jsx    # 5-tab editor
      DemandInput.jsx
      SimulationView.jsx
      ResultsView.jsx
      RingBarrierEditor.jsx
      NEMADiagram.jsx
      TSDCanvas.jsx              # Time-space diagram canvas
      SimulationCanvas.jsx        # Animation during sim run
    data/
      sampleCorridor.js          # Sample project template
```
