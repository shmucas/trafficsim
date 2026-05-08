import React, { useRef, useEffect, useCallback, useMemo } from 'react'

// ── Layout constants ──────────────────────────────────────────────────────────
const CANVAS_H    = 340
const CY          = CANVAS_H / 2   // arterial center Y
const LANE_W      = 20             // px per lane
const EW_ROAD_H   = LANE_W * 2    // total EW road height (1 EB + 1 WB lane = 40px)
const NS_ROAD_W   = LANE_W * 2    // NS road width
const NS_HALF     = 115            // NS road extends this far above + below CY
const PADDING_X   = 70
const MIN_SEG_PX  = 110            // minimum px between intersections
const CAR_L       = 17
const CAR_W       = 11
const SAT_HEAD    = 1.9
const YELLOW_DUR  = 4
const DISCHARGE_SPD = 40           // px per simulated-second

export const CANVAS_HEIGHT = CANVAS_H  // exported so SimulationView can size the wrapper

// ── Math helpers ──────────────────────────────────────────────────────────────

function rangeContains(start, end, t, cycle) {
  if (start <= end) return t >= start && t < end
  return t >= start || t < end
}

function phaseColor(phStart, split, yellow, t, cycle) {
  const tmod = ((t % cycle) + cycle) % cycle
  const gEnd = (phStart + split - yellow) % cycle
  const yEnd = (phStart + split) % cycle
  if (rangeContains(phStart, gEnd, tmod, cycle)) return 'G'
  if (rangeContains(gEnd, yEnd, tmod, cycle)) return 'Y'
  return 'R'
}

function computePhaseStarts(plan) {
  if (!plan) return {}
  const { cycle, offset = 0, splits = {} } = plan
  const s = (ph) => splits[String(ph)] ?? 0
  const starts = {}
  starts[2] = ((offset % cycle) + cycle) % cycle
  starts[1] = (starts[2] - s(1) + cycle) % cycle
  starts[5] = (starts[2] + s(2)) % cycle
  starts[6] = (starts[5] + s(5)) % cycle
  const bar1 = s(1) + s(2)
  starts[3] = (starts[2] - s(2) + bar1 + cycle) % cycle
  starts[4] = (starts[3] + s(3)) % cycle
  starts[7] = (starts[4] + s(4)) % cycle
  starts[8] = (starts[7] + s(7)) % cycle
  return starts
}

// ── Rounded-rect path helper ──────────────────────────────────────────────────

function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ── Car sprite (top-down) ─────────────────────────────────────────────────────
//
//  horiz=true  → car driving left (dir=-1) or right (dir=1) along arterial
//  horiz=false → car driving up   (dir=-1) or down  (dir=1) on cross-street

function drawCar(ctx, cx, cy, horiz, dir, color) {
  ctx.save()
  ctx.translate(cx, cy)

  if (horiz) {
    if (dir < 0) ctx.scale(-1, 1)
    // Body
    ctx.fillStyle = color
    rrPath(ctx, -CAR_L / 2, -CAR_W / 2, CAR_L, CAR_W, 2.5)
    ctx.fill()
    // Windshield (front = right when dir=1)
    ctx.fillStyle = 'rgba(160,215,255,0.65)'
    ctx.fillRect(CAR_L / 2 - CAR_L * 0.3, -CAR_W / 2 + 1.5, CAR_L * 0.26, CAR_W - 3)
    // Rear window
    ctx.fillStyle = 'rgba(160,215,255,0.3)'
    ctx.fillRect(-CAR_L / 2 + 1, -CAR_W / 2 + 1.5, CAR_L * 0.2, CAR_W - 3)
    // Roof shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(-CAR_L / 2 + CAR_L * 0.22, -CAR_W / 2 + 1.5, CAR_L * 0.52, CAR_W - 3)
  } else {
    if (dir > 0) ctx.scale(1, -1)  // SB: flip so windshield points down in screen space
    // Body (vertical orientation)
    ctx.fillStyle = color
    rrPath(ctx, -CAR_W / 2, -CAR_L / 2, CAR_W, CAR_L, 2.5)
    ctx.fill()
    // Windshield (top of sprite = front when going up)
    ctx.fillStyle = 'rgba(160,215,255,0.65)'
    ctx.fillRect(-CAR_W / 2 + 1.5, -CAR_L / 2 + 1, CAR_W - 3, CAR_L * 0.26)
    // Rear window
    ctx.fillStyle = 'rgba(160,215,255,0.3)'
    ctx.fillRect(-CAR_W / 2 + 1.5, CAR_L / 2 - CAR_L * 0.22, CAR_W - 3, CAR_L * 0.2)
    // Roof shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(-CAR_W / 2 + 1.5, -CAR_L / 2 + CAR_L * 0.27, CAR_W - 3, CAR_L * 0.5)
  }

  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 0.5
  if (horiz) {
    rrPath(ctx, -CAR_L / 2, -CAR_W / 2, CAR_L, CAR_W, 2.5)
  } else {
    rrPath(ctx, -CAR_W / 2, -CAR_L / 2, CAR_W, CAR_L, 2.5)
  }
  ctx.stroke()
  ctx.restore()
}

// ── Corridor layout ───────────────────────────────────────────────────────────

function buildLayout(intersections) {
  const n = intersections.length
  if (n === 0) return { positions: [], totalWidth: 900 }

  // Pixel spacing between adjacent intersection centres
  const gaps = intersections.map((ix, i) =>
    i === 0 ? 0 : Math.max(MIN_SEG_PX, (ix.distance_from_prev_ft || 500) * 0.06)
  )

  const positions = []
  let x = PADDING_X + NS_ROAD_W / 2
  gaps.forEach((g, i) => {
    if (i > 0) x += NS_ROAD_W + g
    positions.push(x)
  })

  const totalWidth = Math.max(
    positions[n - 1] + NS_ROAD_W / 2 + PADDING_X,
    900
  )
  return { positions, totalWidth }
}

// ── Vehicle animation for one intersection ────────────────────────────────────

function drawVehicles(ctx, ix, ixX, activePlan, phStarts, simT) {
  const plan = ix.timing_plans?.[activePlan]
  if (!plan) return
  const { cycle = 120, splits = {} } = plan
  const nema = ix.nema_phases ?? {}
  const pa   = ix.phase_assignments || {}

  const ewTop = CY - EW_ROAD_H / 2
  const ewBot = CY + EW_ROAD_H / 2
  const nsL   = ixX - NS_ROAD_W / 2
  const nsR   = ixX + NS_ROAD_W / 2
  const maxQ  = 5
  const spacing = CAR_L + 4

  function animateDir({ ph, isHoriz, dir, stopCoord, laneCoord }) {
    const split  = splits[String(ph)] ?? 0
    const yellow = nema[String(ph)]?.yellow ?? YELLOW_DUR
    const allRed = nema[String(ph)]?.all_red ?? 1
    const green  = Math.max(0, split - yellow - allRed)
    const col    = phaseColor(phStarts[ph] ?? 0, split, yellow, simT, cycle)
    const tmod   = ((simT % cycle) + cycle) % cycle
    const phStart = phStarts[ph] ?? 0
    const tig    = tmod >= phStart ? tmod - phStart : cycle - phStart + tmod

    if (col !== 'G') {
      const redT = col === 'R' ? tig : split - yellow
      const qLen = Math.min(Math.floor(redT / 2.5), maxQ)
      for (let qi = 0; qi < qLen; qi++) {
        const pos = stopCoord + dir * (qi * spacing + spacing / 2)
        const [px, py] = isHoriz ? [pos, laneCoord] : [laneCoord, pos]
        drawCar(ctx, px, py, isHoriz, -dir, '#3b82f6')
      }
    } else {
      const qAtGreen = Math.min(Math.floor((split - green) / 2.5), maxQ)
      const discharged = Math.floor(tig / SAT_HEAD)
      const remaining  = Math.max(0, qAtGreen - discharged)
      for (let qi = 0; qi < remaining; qi++) {
        const pos = stopCoord + dir * (qi * spacing + spacing / 2)
        const [px, py] = isHoriz ? [pos, laneCoord] : [laneCoord, pos]
        drawCar(ctx, px, py, isHoriz, -dir, '#3b82f6')
      }
      for (let di = 0; di < Math.min(discharged, 4); di++) {
        const elapsed = tig - di * SAT_HEAD
        const pos = stopCoord - dir * (elapsed * DISCHARGE_SPD + CAR_L / 2)
        const [px, py] = isHoriz ? [pos, laneCoord] : [laneCoord, pos]
        drawCar(ctx, px, py, isHoriz, -dir, '#34d399')
      }
    }
  }

  const ebPh = pa.EB?.T ?? 2
  const wbPh = pa.WB?.T ?? 6
  const nbPh = pa.NB?.T ?? 4
  const sbPh = pa.SB?.T ?? 8

  // EB: traveling right (+1), queue grows left of nsL, lane in bottom half of EW road
  animateDir({ ph: ebPh, isHoriz: true,  dir: -1, stopCoord: nsL - 2, laneCoord: CY + EW_ROAD_H / 4 })
  // WB: traveling left (-1), queue grows right of nsR, lane in top half
  animateDir({ ph: wbPh, isHoriz: true,  dir:  1, stopCoord: nsR + 2, laneCoord: CY - EW_ROAD_H / 4 })
  // NB: traveling up (-1), queue grows below ewBot, lane on right side of NS road
  animateDir({ ph: nbPh, isHoriz: false, dir:  1, stopCoord: ewBot + 2, laneCoord: ixX + NS_ROAD_W / 4 })
  // SB: traveling down (+1), queue grows above ewTop, lane on left side
  animateDir({ ph: sbPh, isHoriz: false, dir: -1, stopCoord: ewTop - 2, laneCoord: ixX - NS_ROAD_W / 4 })
}

// ── Main draw ─────────────────────────────────────────────────────────────────

const SIG = { G: '#22c55e', Y: '#eab308', R: '#ef4444' }

function drawCorridor(ctx, intersections, layout, activePlan, simT, W) {
  const { positions } = layout
  const ewTop = CY - EW_ROAD_H / 2
  const ewBot = CY + EW_ROAD_H / 2

  ctx.clearRect(0, 0, W, CANVAS_H)
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, W, CANVAS_H)

  // EW arterial road (full width)
  ctx.fillStyle = '#374151'
  ctx.fillRect(0, ewTop, W, EW_ROAD_H)

  // NS cross-streets + intersection boxes
  positions.forEach((ixX) => {
    ctx.fillStyle = '#374151'
    ctx.fillRect(ixX - NS_ROAD_W / 2, CY - NS_HALF, NS_ROAD_W, NS_HALF * 2)
    ctx.fillStyle = '#4b5563'  // intersection box slightly lighter
    ctx.fillRect(ixX - NS_ROAD_W / 2, ewTop, NS_ROAD_W, EW_ROAD_H)
  })

  // Lane markings
  ctx.strokeStyle = '#9ca3af'
  ctx.setLineDash([14, 10])
  ctx.lineWidth = 1

  // EW centre line
  ctx.beginPath()
  ctx.moveTo(0, CY)
  ctx.lineTo(W, CY)
  ctx.stroke()

  // NS centre lines (above + below arterial)
  positions.forEach((ixX) => {
    ctx.beginPath()
    ctx.moveTo(ixX, ewBot)
    ctx.lineTo(ixX, CY + NS_HALF)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ixX, CY - NS_HALF)
    ctx.lineTo(ixX, ewTop)
    ctx.stroke()
  })
  ctx.setLineDash([])

  // ── Per-intersection: stop bars, signal heads, vehicles, labels ───────────
  positions.forEach((ixX, i) => {
    const ix    = intersections[i]
    const plan  = ix.timing_plans?.[activePlan]
    const phStarts = plan ? computePhaseStarts(plan) : {}
    const { cycle = 120, splits = {} } = plan ?? {}
    const nema  = ix.nema_phases ?? {}
    const pa    = ix.phase_assignments || {}
    const nsL   = ixX - NS_ROAD_W / 2
    const nsR   = ixX + NS_ROAD_W / 2

    // Stop bars (white lines at each approach)
    ctx.strokeStyle = '#f9fafb'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(nsL, CY); ctx.lineTo(nsL, ewBot); ctx.stroke()      // EB
    ctx.beginPath(); ctx.moveTo(nsR, ewTop); ctx.lineTo(nsR, CY); ctx.stroke()      // WB
    ctx.beginPath(); ctx.moveTo(ixX - NS_ROAD_W / 2, ewTop); ctx.lineTo(ixX, ewTop); ctx.stroke() // NB
    ctx.beginPath(); ctx.moveTo(ixX, ewBot); ctx.lineTo(ixX + NS_ROAD_W / 2, ewBot); ctx.stroke() // SB

    // Signal heads
    if (plan) {
      const sigR = 4.5
      const so   = 10  // offset from stop bar
      ;[
        { ph: pa.EB?.T ?? 2, x: nsL - so,     y: CY + EW_ROAD_H / 4 },
        { ph: pa.WB?.T ?? 6, x: nsR + so,     y: CY - EW_ROAD_H / 4 },
        { ph: pa.NB?.T ?? 4, x: ixX - NS_ROAD_W / 4, y: ewTop - so },
        { ph: pa.SB?.T ?? 8, x: ixX + NS_ROAD_W / 4, y: ewBot + so },
      ].forEach(({ ph, x, y }) => {
        const split  = splits[String(ph)] ?? 0
        const yellow = nema[String(ph)]?.yellow ?? YELLOW_DUR
        const col    = phaseColor(phStarts[ph] ?? 0, split, yellow, simT, cycle)
        // Housing
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(x - sigR - 2, y - sigR - 2, sigR * 2 + 4, sigR * 2 + 4)
        // Lens
        ctx.fillStyle = SIG[col]
        ctx.beginPath()
        ctx.arc(x, y, sigR, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Vehicles
    drawVehicles(ctx, ix, ixX, activePlan, phStarts, simT)

    // Intersection name label (bottom)
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillStyle = '#9ca3af'
    ctx.textAlign = 'center'
    const label = ix.name || `IX ${i + 1}`
    ctx.fillText(label.length > 14 ? label.slice(0, 13) + '…' : label, ixX, CANVAS_H - 6)
  })

  // Distance labels between adjacent intersections
  ctx.font = '9px ui-monospace, monospace'
  ctx.fillStyle = '#6b7280'
  ctx.textAlign = 'center'
  for (let i = 1; i < positions.length; i++) {
    const midX = (positions[i - 1] + positions[i]) / 2
    const dist = intersections[i].distance_from_prev_ft
    if (dist > 0) ctx.fillText(`${dist} ft`, midX, CY - EW_ROAD_H / 2 - 7)
  }
}

// ── React component ───────────────────────────────────────────────────────────

export default function SimulationCanvas({ intersections, activePlan, simT }) {
  const canvasRef = useRef(null)
  const layout = useMemo(() => buildLayout(intersections), [intersections])
  const W = layout.totalWidth

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawCorridor(canvas.getContext('2d'), intersections, layout, activePlan, simT, W)
  }, [intersections, layout, activePlan, simT, W])

  useEffect(() => { draw() }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={CANVAS_H}
      className="rounded-lg block"
      style={{ background: '#111827' }}
    />
  )
}
