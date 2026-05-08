# Traffic Corridor Simulation Software — Full Specification

> **For Claude Code:** This document is the authoritative specification for building a locally hosted web-based traffic corridor simulation tool. Follow the build phases in order. Each section maps directly to implementation requirements.

---

## 1. Project Overview

A locally hosted web application for corridor-level traffic signal simulation. Targets traffic engineers familiar with Synchro-style workflows. Supports up to 12 intersections per corridor, HCM 7th Edition methodology, and NTCIP-compliant controller database import.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | Python (FastAPI) |
| Simulation Engine | Python (custom, HCM 7th Edition logic) |
| Storage | SQLite (project files), JSON (config export/import) |
| PDF Export | ReportLab or WeasyPrint |
| NTCIP Import | Python SNMP library or MDB/CSV parser |
| Local Server | Uvicorn |

---

## 3. Core Input Parameters

### 3.1 Corridor-Level Inputs

| Parameter | Description |
|---|---|
| Corridor name | Project identifier |
| Number of intersections | 1–12 |
| Corridor speed | Posted speed (mph) |
| Active timing plan | AM / PM / Off-Peak (switchable) |

### 3.2 Per-Intersection Inputs

| Parameter | Description |
|---|---|
| Intersection name / ID | Label |
| Intersection type | 2-leg (mid-block/driveway signal), 3-leg (T), or 4-leg |
| Distance from previous intersection | Feet |
| Number of approaches | 2, 3, or 4 |
| Lane configuration per approach | Number of lanes, movement per lane (L / T / R / shared) |
| Lane width | Feet per lane |
| Turn bay lengths | Feet (optional, per movement) |
| Cycle length | 60–200 seconds |
| NEMA phase numbering | Standard 1–8 ring-barrier |
| Phase splits | Seconds per phase, per timing plan |
| Offsets | Seconds, per timing plan |
| Overlap phases | Defined per NEMA standard |
| Pedestrian phases | Associated NEMA phase, walk / ped clearance timing |
| Detector configuration | Stop bar / advance detector, per approach and lane |

#### 2-Leg Intersection Notes
- Represents mid-block signals or driveway signals with only two opposing approaches
- NEMA phases assigned to the two approaches only; unused phases marked inactive
- Supports pedestrian phases and overlaps same as 3-leg and 4-leg

### 3.3 Demand Inputs

| Parameter | Description |
|---|---|
| Turning movement counts | Per movement (L / T / R), per approach |
| Time resolution | Per 15-minute bin across the analysis hour (4 bins) |
| Heavy vehicle percentage | Per approach |
| Peak hour factor (PHF) | Per approach or corridor-wide |

---

## 4. Signal Control Model

### 4.1 Control Type
- Fully actuated control on all phases
- **Simplified actuation:** no gap/extension modeling — phase timing governed by input splits as effective green times
- Min green and max green inputs per phase
- Recall modes: None / Min / Max / Ped

### 4.2 NEMA Ring-Barrier Structure
- Standard dual-ring, 8-phase NEMA structure
- Ring 1: Phases 1, 2, 5, 6 — Ring 2: Phases 3, 4, 7, 8
- Barrier groups: Phases 1–4 (first barrier) and Phases 5–8 (second barrier)
- Overlaps defined as standard NEMA overlaps (A–D or custom-labeled)
- Phase sequence editable per intersection
- For 2-leg and 3-leg intersections, unused NEMA phases are marked inactive; the ring-barrier diagram renders only active phases

### 4.3 Timing Plans
- Three plans per intersection: **AM**, **PM**, **Off-Peak**
- Each plan stores: cycle length, splits, offset, min green, max green per phase
- Plans are switchable corridor-wide from a persistent toggle in the UI header
- NTCIP-imported plans populate all three plan slots; user can override any value post-import

---

## 5. Simulation Engine

### 5.1 Model Type
- Deterministic, time-step based simulation (recommended resolution: 0.1 seconds)
- Arrival profiles derived from 15-minute TMC inputs
- Platoon dispersion modeled using **Robertson's platoon dispersion model** (consistent with HCM 7th Edition)

### 5.2 Vehicle Behavior
- Vehicles generated from arrival rate inputs per movement per 15-minute bin
- Queue discharge modeled using saturation flow rate (HCM 7th, Chapter 19)
- Saturation flow base rate: **1,900 pcphgpl**, adjusted for:
  - Lane width
  - Heavy vehicle percentage
  - Turn movements (left-turn and right-turn adjustment factors)
- Macroscopic flow model — no car-following or microscopic vehicle dynamics

### 5.3 Per-Phase Calculations (HCM 7th Edition)

| Output | Method |
|---|---|
| Control delay | HCM 7th Eq. 19-18: d = d1 + d2 + d3 |
| 95th percentile queue length | HCM 7th Eq. 19-26 |
| Throughput | Vehicles discharged per phase per cycle |
| Arrival type | Derived from TSD progression — not a manual input |

---

## 6. Outputs & Analysis

### 6.1 Time-Space Diagram (TSD)
- **Horizontal axis:** Time (seconds) — full cycle or user-defined window
- **Vertical axis:** Distance (feet) — one row per intersection, spaced to scale
- **Green bands** displayed per approach direction (inbound and outbound)
- **Progression bands** overlaid showing ideal platoon travel paths at corridor speed
- **Vehicle trajectories** plotted from simulation (individual platoon traces)
- Cycle boundaries clearly marked
- Toggle controls: show/hide trajectories, progression bands, individual phase bands
- Inbound and outbound directions shown simultaneously with color differentiation

### 6.2 Delay Summary Table
- Reported per movement, per approach, per intersection, and corridor average
- Units: seconds per vehicle

### 6.3 Queue Length Table
- 95th percentile queue reported per movement and per approach
- Units: feet and estimated number of vehicles

### 6.4 Throughput Summary
- Vehicles per hour per movement
- Corridor-wide total served volume

### 6.5 2D Visual Simulation
- Top-down bird's eye view, per intersection, to scale
- Vehicles represented as scaled rectangles positioned within lanes
- Signal head states displayed per phase in real time (red / yellow / green)
- Corridor view showing all intersections with correct distance spacing
- **Playback controls:** Play, pause, seek (scrubable timeline)
- **Playback speeds:** 1x and 2x
- Vehicles animate through intersection geometry based on simulation output

---

## 7. NTCIP Import

### 7.1 Supported Import Source
- Saved controller database files (not live SNMP polling at this time)
- Primary target formats: **Econolite ASC/3**, **Intelight**
- Fallback: generic NTCIP-structured CSV or MDB export

### 7.2 Imported NTCIP Objects

| NTCIP Object | Mapped Input Field |
|---|---|
| Phase parameters | Min green, max green, yellow, all-red, walk, ped clearance |
| Timing plans | Splits, cycle length, offset per plan (AM / PM / Off-Peak) |
| Overlap definitions | Overlap phase assignments |
| Detector configuration | Detector type, channel assignment, associated phase |

### 7.3 Post-Import Behavior
- All imported values populate the standard input fields identically to manual entry
- User can manually override any imported value after import
- Import summary log displayed: fields parsed, fields unmapped, warnings

---

## 8. Project File System

### 8.1 Save / Reload
- Projects saved as structured JSON files
- Stores: all intersection geometry, lane configurations, phasing, demand inputs, all three timing plans
- Project dashboard screen manages multiple saved projects (open, rename, delete)

### 8.2 PDF Export

The exported report contains:
1. Project metadata (name, date, analyst name)
2. Input summary table (corridor geometry, timing plan parameters)
3. Time-Space Diagram image (high resolution)
4. Delay summary table
5. Queue length table
6. Throughput summary
7. Simulation parameters and methodology note (HCM 7th Edition)

---

## 9. UI Structure

### 9.1 Screen Flow

```
1. Project Dashboard
   └── New project / Open existing / Recent files

2. Corridor Setup
   └── Add intersections, set corridor speed, set distances between intersections

3. Intersection Editor (per intersection, Synchro-style tabbed layout)
   ├── Tab: Geometry (intersection type, approaches, lanes, lane widths, turn bays)
   ├── Tab: Phasing (NEMA ring-barrier diagram, phase sequence, overlaps, ped phases)
   ├── Tab: Timing (splits, cycle length, offset — per plan: AM / PM / Off-Peak)
   ├── Tab: Detectors (stop bar / advance, per approach and lane)
   └── Tab: NTCIP Import (upload controller DB file, review import log, override values)

4. Demand Input
   └── TMC grid per intersection — L / T / R per approach, 4 × 15-minute bins

5. Simulation View
   └── 2D corridor animation with signal head states, playback controls, speed toggle

6. Results View
   ├── Time-Space Diagram (with progression bands, trajectory toggle)
   ├── Delay summary table
   ├── Queue length table
   ├── Throughput summary
   └── Export to PDF button
```

### 9.2 Design Principles
- Tab-based intersection editor mirrors Synchro workflow for familiarity
- NEMA ring-barrier diagram rendered visually in the Phasing tab — inactive phases clearly indicated for 2-leg and 3-leg intersections
- Timing plan switcher (AM / PM / Off-Peak) always visible in the top navigation header when in Simulation or Results views
- All tables sortable; delay and queue tables exportable to CSV independently

---

## 10. Known Simplifications & Limitations

| Limitation | Notes |
|---|---|
| No gap/extension actuation modeling | Phase timing uses input splits as effective greens |
| No adaptive control | No SCOOT, InSync, or similar adaptive logic |
| No grade or elevation effects | Flat terrain assumed |
| No pedestrian or bicycle demand volumes | Ped phases are timed but no ped volume inputs |
| No protected-permissive left-turn modeling | Initial version uses protected-only |
| Macroscopic flow model only | No car-following or lane-changing dynamics |
| Maximum 12 intersections per corridor | Scalability limit for initial version |
| No live NTCIP polling | Import from saved DB files only |

---

## 11. Build Phases

Complete phases in order. Do not begin a phase until the prior phase is functionally tested.

### Phase 1 — Input UI + Project Infrastructure
- Project dashboard (new, open, save, reload)
- Corridor setup screen
- Intersection editor with all tabs (geometry, phasing, NEMA diagram, timing, detectors)
- Demand input TMC grid (15-min bins)
- Timing plan switcher (AM / PM / Off-Peak)
- JSON project save/load

### Phase 2 — Simulation Engine
- HCM 7th Edition delay calculations (d1 + d2 + d3)
- 95th percentile queue length
- Throughput per movement
- Saturation flow rate adjustments (lane width, heavy vehicles, turn factors)
- Robertson platoon dispersion model
- Arrival type derivation from TSD

### Phase 3 — Time-Space Diagram
- TSD rendering (green bands, cycle boundaries, distance scale)
- Progression band overlay at corridor speed
- Vehicle trajectory traces from simulation output
- Toggle controls (trajectories, bands, directions)

### Phase 4 — 2D Visual Simulation
- Top-down corridor view with to-scale intersection geometry
- Vehicle rectangle animation within lanes
- Signal head state display (R/Y/G) per phase
- Playback controls (play, pause, seek, 1x/2x speed)

### Phase 5 — NTCIP Import
- File upload and parser for Econolite ASC/3 and Intelight DB formats
- NTCIP object mapping to input fields
- Import log and manual override capability

### Phase 6 — PDF Export + Polish
- PDF report generation (ReportLab or WeasyPrint)
- Report contents: metadata, input summary, TSD image, delay table, queue table, throughput
- UI polish, error handling, input validation

---

## 12. File & Folder Structure (Recommended)

```
/traffic-sim
├── /frontend                  # React app
│   ├── /src
│   │   ├── /components
│   │   │   ├── ProjectDashboard.jsx
│   │   │   ├── CorridorSetup.jsx
│   │   │   ├── IntersectionEditor.jsx
│   │   │   ├── DemandInput.jsx
│   │   │   ├── SimulationView.jsx
│   │   │   ├── ResultsView.jsx
│   │   │   ├── TSDCanvas.jsx
│   │   │   └── NEMADiagram.jsx
│   │   ├── /store             # State management (Zustand or Redux)
│   │   └── App.jsx
│   └── package.json
│
├── /backend                   # FastAPI app
│   ├── /api
│   │   ├── routes.py
│   │   └── models.py
│   ├── /simulation
│   │   ├── engine.py          # Main simulation loop
│   │   ├── hcm7.py            # HCM 7th Edition calculations
│   │   ├── platoon.py         # Robertson dispersion model
│   │   └── saturation.py      # Saturation flow rate adjustments
│   ├── /ntcip
│   │   ├── parser.py          # NTCIP DB file parser
│   │   └── mappers.py         # NTCIP object → input field mapping
│   ├── /export
│   │   └── pdf_report.py      # PDF generation
│   ├── /storage
│   │   └── project_db.py      # SQLite project save/load
│   └── main.py
│
├── /projects                  # Saved project JSON files
└── README.md
```

---

## 13. Key Data Schemas (JSON)

### Project File Schema (abbreviated)
```json
{
  "project": {
    "name": "Main St Corridor",
    "created": "2026-01-01",
    "analyst": "Engineer Name",
    "corridor_speed_mph": 35,
    "active_plan": "AM"
  },
  "intersections": [
    {
      "id": 1,
      "name": "Main St & 1st Ave",
      "type": "4-leg",
      "distance_from_prev_ft": 0,
      "approaches": [...],
      "nema_phases": {...},
      "overlaps": [...],
      "ped_phases": [...],
      "detectors": [...],
      "timing_plans": {
        "AM":       { "cycle": 120, "offset": 0, "splits": {...} },
        "PM":       { "cycle": 140, "offset": 15, "splits": {...} },
        "Off-Peak": { "cycle": 90,  "offset": 0,  "splits": {...} }
      }
    }
  ],
  "demand": {
    "intersection_1": {
      "NB": { "L": [10,12,14,11], "T": [80,95,100,88], "R": [15,18,20,16] },
      "SB": {...},
      "EB": {...},
      "WB": {...}
    }
  }
}
```

---

*Specification version 1.0 — Last updated May 2026*
*HCM methodology: Highway Capacity Manual, 7th Edition (TRB)*
*NEMA standard: NEMA TS-2*
