# Traffic Simulation Web App

A locally hosted full-stack web application for simulating signalized corridor performance. It ingests turning movement counts and NTCIP controller databases, runs HCM 7th Edition Chapter 19 delay calculations, and visualizes results through a time-space diagram.

---

## Features

- **Turning Movement Count Input** — Enter 15-minute bin counts (L/T/R) per approach with PHF and heavy vehicle percentage. Volumes are PHF-adjusted to peak-hour flow rates.
- **NTCIP Controller Database Parser** — Parses Econolite ASC/3, Intelight, and generic NTCIP CSV exports. Extracts phase parameters (min/max green, yellow, all-red, recall), timing plans, cycle lengths, offsets, phase splits, overlaps, and detector channels.
- **HCM 7th Edition Signalized Intersection Engine** — Computes adjusted saturation flow rates (lane width, heavy vehicle, and turn movement factors), uniform delay (d1), incremental delay (d2), 95th percentile queue length, v/c ratio, capacity, and LOS A–F per lane group and approach.
- **NEMA Ring-Barrier Structure** — Maps NEMA TS-2 phases to intersection approach movements (NB/SB/EB/WB) with support for custom phase assignments.
- **Robertson Platoon Dispersion** — Propagates arrival profiles between intersections using Robertson's recursive model and generates a time-space diagram.
- **Results Export** — CSV export for movement-level results and PDF report generation.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI |
| Database | SQLite |
| Standards | NTCIP, NEMA TS-2, HCM 7th Edition |

---

## Project Structure

```
my_traffic_sim/
├── backend/
│   ├── api/            # FastAPI routes and request models
│   ├── export/         # PDF report generation
│   ├── ntcip/          # NTCIP controller database parser
│   ├── simulation/     # HCM 7th engine, saturation flow, platoon dispersion
│   ├── storage/        # SQLite project persistence
│   └── main.py
├── frontend/
│   └── src/
│       ├── components/ # React UI components
│       ├── store/      # Zustand project state
│       └── App.jsx
└── TRAFFIC_SIM_SPEC.md
```

---

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies API requests to the FastAPI backend on `http://localhost:8000`.

---

## NTCIP Parser

The parser auto-detects controller export format from file content and supports:

| Format | Detection |
|---|---|
| Econolite ASC/3 | Header keywords or column structure |
| Intelight | `intelight` / `intelli` in file header |
| Generic NTCIP CSV | `SECTION`, `FIELD` column headers |
| JSON | Project schema pass-through |

Parsed output includes phases, timing plans, overlaps, and detector channels with a structured parse log.

---

## HCM 7th Edition Implementation

Calculations follow Chapter 19 — Signalized Intersections.

- **Saturation flow** — Base 1,900 pc/h/g/ln adjusted for lane width (Eq. 19-7), heavy vehicles (Eq. 19-9), and turn movements (Eq. 19-11/12)
- **Uniform delay d1** — Eq. 19-18a
- **Incremental delay d2** — Eq. 19-18b
- **95th percentile queue** — Eq. 19-26
- **LOS** — A (≤10s) through F (>80s) per HCM thresholds

---

## License

Open source — MIT
