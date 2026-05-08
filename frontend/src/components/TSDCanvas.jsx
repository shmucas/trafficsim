import React, { useState, useMemo } from 'react'

// ─── Layout constants ─────────────────────────────────────────────────────────
const ML = 158   // left margin (intersection labels)
const MR = 20
const MT = 44    // top margin (cycle labels)
const MB = 52    // bottom margin (time axis + legend)
const PW = 740   // plot width (fixed)
const BAND_H   = 10   // px height of each green band
const TRAJ_SPG = 4    // seconds between trajectory lines

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  bg:     '#030712',
  plot:   '#050b14',
  grid:   'rgba(255,255,255,0.04)',
  sep:    'rgba(255,255,255,0.20)',
  axis:   '#374151',
  lbl:    '#6b7280',
  ixLbl:  '#d1d5db',
  gOut:   '#22c55e',
  gIn:    '#3b82f6',
  pOut:   'rgba(34,197,94,0.12)',
  pIn:    'rgba(59,130,246,0.12)',
  tOut:   'rgba(250,204,21,0.60)',
  tIn:    'rgba(251,146,60,0.60)',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Which pair of through phases dominates this timing plan?
function coordPhases(plan) {
  const s = plan.splits || {}
  const ew = +(s['2'] || 0) + +(s['6'] || 0)
  const ns = +(s['4'] || 0) + +(s['8'] || 0)
  // inLPh = the left-turn phase on the inbound side (used to compute inbound green start)
  return ew >= ns
    ? { outPh: 2, inPh: 6, outDir: 'EB', inDir: 'WB', inLPh: 5 }
    : { outPh: 4, inPh: 8, outDir: 'NB', inDir: 'SB', inLPh: 7 }
}

// Effective green = split − yellow − all-red
function effG(ix, ph, plan) {
  const sp = +(plan.splits?.[String(ph)] ?? 0)
  const nm = ix.nema_phases?.[String(ph)] ?? {}
  return Math.max(0, sp - +(nm.yellow ?? 4) - +(nm.all_red ?? 1))
}

// Start time of a phase within the cycle.
// Convention: offset = time from cycle start to beginning of OUTBOUND through green.
// Inbound through green (in opposite barrier group) starts after:
//   outbound through green + inbound left-turn green
function phaseStart(outPh, inPh, inLPh, splits, offset, ph, cyc) {
  const s = p => +(splits?.[String(p)] ?? 0)
  if (ph === outPh) return offset % cyc
  if (ph === inPh)  return (offset + s(outPh) + s(inLPh)) % cyc
  return offset % cyc
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function TSDCanvas({
  intersections    = [],
  activePlan       = 'AM',
  corridorSpeedMph = 35,
}) {
  const [vis,  setVis]  = useState({ out: true, in: true, prog: true, traj: true })
  const [nCyc, setNCyc] = useState(2)
  const tog = k => setVis(v => ({ ...v, [k]: !v[k] }))

  // Plot height scales with intersection count
  const PH = Math.max(260, Math.min(580, (intersections.length + 1) * 80))
  const W = ML + PW + MR
  const H = MT + PH + MB

  // ── Core TSD computation ──────────────────────────────────────────────────
  const tsd = useMemo(() => {
    if (!intersections.length) return null

    // Cumulative distances (ft from first intersection)
    const pos = [0]
    for (let i = 1; i < intersections.length; i++) {
      pos.push(pos[i - 1] + +(intersections[i].distance_from_prev_ft ?? 0))
    }
    const totDist = pos[pos.length - 1] || 1

    const fp     = intersections[0].timing_plans?.[activePlan] ?? {}
    const refCyc = +(fp.cycle ?? 120)
    const totT   = nCyc * refCyc
    const spd    = (corridorSpeedMph * 5280) / 3600  // ft/s

    // Scale functions (capture PH, PW, totT, totDist in closure)
    const xT = t => ML + (t / totT) * PW
    const yT = d => MT + (d / totDist) * PH

    // Per-intersection derived data
    const ixd = intersections.map((ix, i) => {
      const plan = ix.timing_plans?.[activePlan] ?? {}
      const cyc  = +(plan.cycle  ?? refCyc)
      const off  = +(plan.offset ?? 0)
      const { outPh, inPh, outDir, inDir, inLPh } = coordPhases(plan)
      const splits = plan.splits ?? {}
      return {
        ix, i,
        pos: pos[i], cyc, off,
        outPh, inPh, outDir, inDir,
        gOut: effG(ix, outPh, plan),
        gIn:  effG(ix, inPh,  plan),
        outStart: phaseStart(outPh, inPh, inLPh, splits, off, outPh, cyc),
        inStart:  phaseStart(outPh, inPh, inLPh, splits, off, inPh,  cyc),
      }
    })

    // ── Green bands ─────────────────────────────────────────────────────────
    const bands = []
    // Draw one extra cycle on each side so clipping handles partial bands cleanly
    for (let k = -1; k <= nCyc + 1; k++) {
      for (const d of ixd) {
        const y = yT(d.pos)

        if (d.gOut > 0) {
          const t0 = k * d.cyc + d.outStart
          const c0 = Math.max(0, t0), c1 = Math.min(totT, t0 + d.gOut)
          if (c1 > c0) bands.push({ type: 'out', x: xT(c0), w: (c1 - c0) / totT * PW, y })
        }
        if (d.gIn > 0) {
          const t0 = k * d.cyc + d.inStart
          const c0 = Math.max(0, t0), c1 = Math.min(totT, t0 + d.gIn)
          if (c1 > c0) bands.push({ type: 'in', x: xT(c0), w: (c1 - c0) / totT * PW, y })
        }
      }
    }

    // ── Progression bands (parallelogram polygons) ────────────────────────
    // Outbound: platoon departs ix[0] at start of its outbound green window.
    //   At intersection i: arrives at t0 + pos[i]/spd
    // Inbound: platoon departs ix[N] at start of its inbound green window.
    //   At intersection i: arrives at tN + (posN − pos[i])/spd
    const progs = []
    if (ixd.length > 1 && spd > 0) {
      for (let k = -1; k <= nCyc; k++) {
        // Outbound band
        const d0 = ixd[0]
        if (d0.gOut > 0) {
          const tL = k * d0.cyc + d0.outStart
          const tT = tL + d0.gOut
          const lead  = ixd.map(d => `${xT(tL + d.pos / spd)},${yT(d.pos)}`)
          const trail = [...ixd].reverse().map(d => `${xT(tT + d.pos / spd)},${yT(d.pos)}`)
          progs.push({ pts: [...lead, ...trail].join(' '), type: 'out' })
        }

        // Inbound band
        const dN   = ixd[ixd.length - 1]
        const posN = dN.pos
        if (dN.gIn > 0) {
          const tL = k * dN.cyc + dN.inStart
          const tT = tL + dN.gIn
          // Leading edge goes from ix[0] (top-right) to ix[N] (bottom-left)
          const lead  = ixd.map(d => `${xT(tL + (posN - d.pos) / spd)},${yT(d.pos)}`)
          // Trailing edge reversed: from ix[N] (bottom) back to ix[0] (top)
          const trail = [...ixd].reverse().map(d => `${xT(tT + (posN - d.pos) / spd)},${yT(d.pos)}`)
          progs.push({ pts: [...lead, ...trail].join(' '), type: 'in' })
        }
      }
    }

    // ── Vehicle trajectories ─────────────────────────────────────────────
    // Simplified: straight lines at corridor speed (no queue modeling).
    const trajs = []
    if (spd > 0) {
      for (let k = 0; k < nCyc; k++) {
        // Outbound trajectories, departing ix[0]
        const d0 = ixd[0]
        for (let dt = 0; dt <= d0.gOut; dt += TRAJ_SPG) {
          const t0 = k * d0.cyc + d0.outStart + dt
          const pts = ixd.map(d => `${xT(t0 + d.pos / spd)},${yT(d.pos)}`).join(' ')
          trajs.push({ pts, type: 'out' })
        }

        // Inbound trajectories, departing ix[N]
        const dN   = ixd[ixd.length - 1]
        const posN = dN.pos
        for (let dt = 0; dt <= dN.gIn; dt += TRAJ_SPG) {
          const tN  = k * dN.cyc + dN.inStart + dt
          const pts = ixd.map(d => `${xT(tN + (posN - d.pos) / spd)},${yT(d.pos)}`).join(' ')
          trajs.push({ pts, type: 'in' })
        }
      }
    }

    // ── Time-axis ticks ──────────────────────────────────────────────────
    const tickStep = refCyc <= 90 ? 10 : 20
    const tTicks = []
    for (let t = 0; t <= totT; t += tickStep) tTicks.push(t)

    // Cycle boundary separators (between cycles 1-2, 2-3 …)
    const cycSeps = []
    for (let k = 1; k < nCyc; k++) cycSeps.push(k * refCyc)

    return { xT, yT, ixd, bands, progs, trajs, tTicks, cycSeps, refCyc, totT }
  }, [intersections, activePlan, corridorSpeedMph, nCyc, PH])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!intersections.length) {
    return (
      <div className="rounded-lg border border-gray-800 flex items-center justify-center h-40 bg-gray-950">
        <p className="text-gray-500 text-sm">Add intersections to view the Time-Space Diagram</p>
      </div>
    )
  }
  if (!tsd) return null

  const { xT, yT, ixd, bands, progs, trajs, tTicks, cycSeps, refCyc } = tsd
  const outDir = ixd[0]?.outDir ?? 'Out'
  const inDir  = ixd[0]?.inDir  ?? 'In'

  return (
    <div>
      {/* ── Toggle controls ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {[
          { k: 'out',  lbl: `Outbound (${outDir})`, clr: C.gOut },
          { k: 'in',   lbl: `Inbound (${inDir})`,   clr: C.gIn  },
          { k: 'prog', lbl: 'Progression Bands',     clr: 'rgba(200,200,200,0.5)' },
          { k: 'traj', lbl: 'Trajectories',           clr: C.tOut },
        ].map(({ k, lbl, clr }) => (
          <button key={k} onClick={() => tog(k)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              vis[k] ? 'border-gray-500 text-gray-200 bg-gray-700'
                     : 'border-gray-700 text-gray-600'
            }`}>
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: vis[k] ? clr : '#374151' }} />
            {lbl}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Cycles:</span>
          {[1, 2, 3].map(n => (
            <button key={n} onClick={() => setNCyc(n)}
              className={`w-7 h-6 rounded text-xs font-mono transition-colors ${
                nCyc === n ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}>{n}</button>
          ))}
        </div>
      </div>

      {/* ── SVG diagram ─────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" style={{ minWidth: W }}>
          <defs>
            <clipPath id="tsd-clip">
              <rect x={ML} y={MT} width={PW} height={PH} />
            </clipPath>
          </defs>

          {/* Backgrounds */}
          <rect width={W} height={H} fill={C.bg} />
          <rect x={ML} y={MT} width={PW} height={PH} fill={C.plot} />

          {/* Horizontal grid at each intersection y-position */}
          {ixd.map((d, i) => (
            <line key={`hg${i}`} x1={ML} y1={yT(d.pos)} x2={ML + PW} y2={yT(d.pos)}
              stroke={C.grid} strokeWidth={1} />
          ))}

          {/* Vertical time grid */}
          {tTicks.map(t => (
            <line key={`vg${t}`} x1={xT(t)} y1={MT} x2={xT(t)} y2={MT + PH}
              stroke={C.grid} strokeWidth={1} />
          ))}

          {/* Cycle separator lines */}
          {cycSeps.map((t, i) => (
            <g key={`cs${i}`}>
              <line x1={xT(t)} y1={MT - 10} x2={xT(t)} y2={MT + PH + 4}
                stroke={C.sep} strokeWidth={1.5} strokeDasharray="5 3" />
              <text x={xT(t)} y={MT - 14} textAnchor="middle"
                fill={C.sep} fontSize={9} fontFamily="sans-serif">
                cycle {i + 2}
              </text>
            </g>
          ))}
          {/* Cycle 1 label */}
          <text
            x={ML + PW / (2 * nCyc)}
            y={MT - 14}
            textAnchor="middle" fill={C.sep} fontSize={9} fontFamily="sans-serif">
            cycle 1
          </text>

          {/* Progression bands (behind green bands and trajectories) */}
          {vis.prog && progs.map((p, i) => (
            <polygon key={`pg${i}`} points={p.pts}
              fill={p.type === 'out' ? C.pOut : C.pIn}
              clipPath="url(#tsd-clip)" />
          ))}

          {/* Vehicle trajectories */}
          {vis.traj && trajs.map((tr, i) => (
            <polyline key={`tr${i}`} points={tr.pts} fill="none"
              stroke={tr.type === 'out' ? C.tOut : C.tIn}
              strokeWidth={0.9} opacity={0.55} clipPath="url(#tsd-clip)" />
          ))}

          {/* Green bands — outbound ABOVE the intersection line, inbound BELOW */}
          {bands.map((b, i) => {
            if (!vis.out && b.type === 'out') return null
            if (!vis.in  && b.type === 'in')  return null
            const yOff = b.type === 'out' ? -(BAND_H / 2 + 2) : 2
            return (
              <rect key={`b${i}`}
                x={b.x} y={b.y + yOff}
                width={Math.max(0.5, b.w)} height={BAND_H}
                fill={b.type === 'out' ? C.gOut : C.gIn}
                opacity={0.88} rx={2} clipPath="url(#tsd-clip)" />
            )
          })}

          {/* Plot border */}
          <rect x={ML} y={MT} width={PW} height={PH}
            fill="none" stroke={C.axis} strokeWidth={1} />

          {/* Time axis ticks and labels */}
          {tTicks.map(t => (
            <g key={`xt${t}`}>
              <line x1={xT(t)} y1={MT + PH} x2={xT(t)} y2={MT + PH + 5}
                stroke={C.axis} strokeWidth={1} />
              <text x={xT(t)} y={MT + PH + 16} textAnchor="middle"
                fill={C.lbl} fontSize={9} fontFamily="monospace">{t}</text>
            </g>
          ))}
          <text x={ML + PW / 2} y={H - 8} textAnchor="middle"
            fill={C.lbl} fontSize={11} fontFamily="sans-serif">
            Time (seconds) · {activePlan} Plan · Ref cycle {refCyc}s
          </text>

          {/* Y-axis: intersection labels and cumulative distances */}
          {ixd.map((d, i) => {
            const y = yT(d.pos)
            return (
              <g key={`yl${i}`}>
                <line x1={ML - 4} y1={y} x2={ML} y2={y} stroke={C.axis} strokeWidth={1} />
                {i > 0 && (
                  <text x={ML - 6} y={y + 4} textAnchor="end"
                    fill={C.lbl} fontSize={8} fontFamily="monospace">
                    {d.pos.toLocaleString()} ft
                  </text>
                )}
                <text
                  x={ML - (i > 0 ? 54 : 8)} y={y - BAND_H / 2 - 4}
                  textAnchor="end" fill={C.ixLbl} fontSize={10} fontFamily="sans-serif">
                  {d.ix.name?.length > 20 ? d.ix.name.slice(0, 18) + '…' : (d.ix.name || `#${i + 1}`)}
                </text>
              </g>
            )
          })}

          {/* Y-axis label */}
          <text x={14} y={MT + PH / 2} textAnchor="middle"
            fill={C.lbl} fontSize={11} fontFamily="sans-serif"
            transform={`rotate(-90,14,${MT + PH / 2})`}>
            Distance (ft) ↓
          </text>

          {/* Legend */}
          <g transform={`translate(${ML}, ${MT + PH + 32})`}>
            {[
              [C.gOut, `Outbound (${outDir}) green`],
              [C.gIn,  `Inbound (${inDir}) green`],
              [C.tOut, 'Outbound trajectories'],
              [C.tIn,  'Inbound trajectories'],
            ].map(([clr, lbl], i) => (
              <g key={i} transform={`translate(${i * 175}, 0)`}>
                <rect width={14} height={8} fill={clr} rx={2} opacity={0.9} />
                <text x={18} y={8} fill={C.lbl} fontSize={9} fontFamily="sans-serif">{lbl}</text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <p className="text-xs text-gray-600 mt-2 text-right">
        Progression bands at {corridorSpeedMph} mph corridor speed ·
        HCM 7th Robertson dispersion not applied to trajectories until Phase 4
      </p>
    </div>
  )
}
