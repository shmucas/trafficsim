/**
 * Main St Sample Corridor
 *
 * 4 signalized intersections · 35 mph arterial · standard NEMA 8-phase
 * Ped phases on φ2, φ4, φ6, φ8 · AM green wave offsets at 35 mph
 * Symmetric ring-barrier (B1=60s, B2=60s, cycle=120s AM/PM · 90s Off-Peak)
 */

// ── NEMA phase parameters ─────────────────────────────────────────────────────
// Phases 2/6 = EW arterial through  (wider crossing → longer ped clearance)
// Phases 4/8 = NS cross-street through

const NEMA_PHASES = {
  '1': { active: true, min_green: 5,  max_green: 30, yellow: 4.0, all_red: 1.0, recall: 'None' },
  '2': { active: true, min_green: 15, max_green: 60, yellow: 4.5, all_red: 1.5, recall: 'Min'  },
  '3': { active: true, min_green: 5,  max_green: 25, yellow: 4.0, all_red: 1.0, recall: 'None' },
  '4': { active: true, min_green: 10, max_green: 50, yellow: 4.0, all_red: 1.0, recall: 'Min'  },
  '5': { active: true, min_green: 5,  max_green: 30, yellow: 4.0, all_red: 1.0, recall: 'None' },
  '6': { active: true, min_green: 15, max_green: 60, yellow: 4.5, all_red: 1.5, recall: 'Min'  },
  '7': { active: true, min_green: 5,  max_green: 25, yellow: 4.0, all_red: 1.0, recall: 'None' },
  '8': { active: true, min_green: 10, max_green: 50, yellow: 4.0, all_red: 1.0, recall: 'Min'  },
}

// ── Timing plan splits ────────────────────────────────────────────────────────
// AM  120s: B1=φ1(10)+φ2(50)=60 = φ3(10)+φ4(50)=60 ✓  B2=φ5(10)+φ6(50)=60 = φ7(10)+φ8(50)=60 ✓
// PM  120s: same splits, different offsets (WB progression)
// OP   90s: B1=φ1(8)+φ2(37)=45  = φ3(8)+φ4(37)=45  ✓  B2=φ5(8)+φ6(37)=45  = φ7(8)+φ8(37)=45  ✓

const SPLITS_AM = { '1':10,'2':50,'3':10,'4':50,'5':10,'6':50,'7':10,'8':50 }
const SPLITS_PM = { '1':10,'2':50,'3':10,'4':50,'5':10,'6':50,'7':10,'8':50 }
const SPLITS_OP = { '1': 8,'2':37,'3': 8,'4':37,'5': 8,'6':37,'7': 8,'8':37 }

// ── Phase assignments (standard NEMA) ─────────────────────────────────────────
const PHASE_ASSIGNMENTS = {
  EB: { L: 1, T: 2, R: 2 },
  WB: { L: 5, T: 6, R: 6 },
  NB: { L: 3, T: 4, R: 4 },
  SB: { L: 7, T: 8, R: 8 },
}

// ── Ring-barrier layout ───────────────────────────────────────────────────────
const RING_CONFIG = { ring1: [1,2,5,6], ring2: [3,4,7,8], barrier_pos: 2 }

// ── Ped phases on φ2,4,6,8 ───────────────────────────────────────────────────
const PED_PHASES = [
  { phase: 2, walk_s: 7, ped_clearance_s: 14 },  // EW arterial (wide crossing)
  { phase: 4, walk_s: 7, ped_clearance_s: 12 },  // NB cross-street
  { phase: 6, walk_s: 7, ped_clearance_s: 14 },  // EW arterial
  { phase: 8, walk_s: 7, ped_clearance_s: 12 },  // SB cross-street
]

// ── Approach geometry ─────────────────────────────────────────────────────────

function makeArtApproach(dir) {
  // Main arterial (EB/WB): L + T + T + R, turn bay on left
  return {
    direction: dir,
    lanes: [
      { movement: 'L', width_ft: 12 },
      { movement: 'T', width_ft: 12 },
      { movement: 'T', width_ft: 12 },
      { movement: 'R', width_ft: 12 },
    ],
    turn_bay_lengths: { L: 150, R: null },
    heavy_vehicle_pct: 3,
    phf: 0.93,
    detector: { stop_bar: true, advance: true },
  }
}

function makeXApproach(dir) {
  // Cross-street (NB/SB): L + T + R
  return {
    direction: dir,
    lanes: [
      { movement: 'L', width_ft: 12 },
      { movement: 'T', width_ft: 12 },
      { movement: 'R', width_ft: 12 },
    ],
    turn_bay_lengths: { L: 100, R: null },
    heavy_vehicle_pct: 2,
    phf: 0.90,
    detector: { stop_bar: true, advance: false },
  }
}

// ── Demand volumes (15-min bins, veh per bin) ─────────────────────────────────
// Peak-hour volumes & PHF:
//   Arterial EW: PHF=0.93  →  sum(bins) = target_vph × 0.93
//   Cross-street: PHF=0.90 →  sum(bins) = target_vph × 0.90
//
// Bin distribution: slightly peaked in second bin (typical AM shape)

const DEMAND = {
  // ─ IX 1: Main St & Oak Ave ──────────────────────────────────────────────────
  1: {
    EB: { L:[37,38,38,36], T:[197,199,198,197], R:[23,24,23,23] },
    WB: { L:[28,28,28,28], T:[163,163,163,162], R:[19,18,19,18] },
    NB: { L:[20,21,20,20], T:[ 86, 85, 86, 85], R:[16,16,16,15] },
    SB: { L:[18,18,18,18], T:[ 72, 72, 72, 72], R:[14,13,14,13] },
  },
  // ─ IX 2: Main St & Elm St ───────────────────────────────────────────────────
  2: {
    EB: { L:[30,31,30,30], T:[191,191,190,191], R:[21,21,21,21] },
    WB: { L:[23,24,23,23], T:[158,158,158,158], R:[16,17,16,16] },
    NB: { L:[16,16,16,15], T:[ 95, 95, 94, 94], R:[14,13,14,13] },
    SB: { L:[14,13,14,13], T:[ 81, 81, 81, 81], R:[11,11,12,11] },
  },
  // ─ IX 3: Main St & Maple Ave ────────────────────────────────────────────────
  3: {
    EB: { L:[40,39,40,39], T:[182,181,182,180], R:[26,25,26,25] },
    WB: { L:[33,32,33,32], T:[151,152,151,151], R:[21,21,21,21] },
    NB: { L:[27,27,27,27], T:[113,112,113,112], R:[18,18,18,18] },
    SB: { L:[25,25,25,24], T:[101,102,101,101], R:[16,16,16,15] },
  },
  // ─ IX 4: Main St & Pine St ──────────────────────────────────────────────────
  4: {
    EB: { L:[26,25,26,25], T:[177,177,177,176], R:[19,18,19,18] },
    WB: { L:[21,21,21,21], T:[144,145,144,144], R:[14,14,14,14] },
    NB: { L:[14,13,14,13], T:[ 63, 63, 63, 63], R:[11,12,11,11] },
    SB: { L:[11,12,11,11], T:[ 54, 54, 54, 54], R:[ 9, 9, 9, 9] },
  },
}

// ── Intersection builder ──────────────────────────────────────────────────────

function makeIntersection(id, name, distFt, amOffset, pmOffset, opOffset) {
  return {
    id,
    name,
    type: '4-leg',
    distance_from_prev_ft: distFt,
    approaches: [
      makeArtApproach('EB'),
      makeArtApproach('WB'),
      makeXApproach('NB'),
      makeXApproach('SB'),
    ],
    nema_phases:      JSON.parse(JSON.stringify(NEMA_PHASES)),
    phase_assignments: JSON.parse(JSON.stringify(PHASE_ASSIGNMENTS)),
    ring_config:       JSON.parse(JSON.stringify(RING_CONFIG)),
    overlaps:    [],
    ped_phases:  JSON.parse(JSON.stringify(PED_PHASES)),
    detectors:   [],
    timing_plans: {
      AM:         { cycle: 120, offset: amOffset, splits: { ...SPLITS_AM } },
      PM:         { cycle: 120, offset: pmOffset, splits: { ...SPLITS_PM } },
      'Off-Peak': { cycle:  90, offset: opOffset, splits: { ...SPLITS_OP } },
    },
  }
}

// ── Public builder ────────────────────────────────────────────────────────────
// Offsets computed for a 35 mph (51.3 ft/s) green wave:
//   Oak → Elm:   800 ft → 15.6 s ≈ 16 s
//   Elm → Maple: 1200 ft → 23.4 s ≈ 23 s
//   Maple → Pine: 700 ft → 13.7 s ≈ 14 s
//
//   AM (EB progression): [0, 16, 39, 53]
//   PM (WB progression): reverse travel → [53, 37, 14, 0]
//   Off-Peak (EB):       scaled 90/120 → [0, 12, 29, 40]

export function buildSampleProject(projectId) {
  return {
    id:                  projectId,
    name:                'Main St — Sample Corridor',
    corridor_speed_mph:  35,
    active_plan:         'AM',
    intersections: [
      //                id  name                      dist   AM  PM  OP
      makeIntersection( 1, 'Main St & Oak Ave',          0,  0, 53,  0),
      makeIntersection( 2, 'Main St & Elm St',         800, 16, 37, 12),
      makeIntersection( 3, 'Main St & Maple Ave',     1200, 39, 14, 29),
      makeIntersection( 4, 'Main St & Pine St',        700, 53,  0, 40),
    ],
    demand: DEMAND,
    simulation_results: null,
  }
}
