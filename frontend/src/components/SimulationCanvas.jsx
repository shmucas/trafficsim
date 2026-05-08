import React, { useRef, useEffect, useCallback, useMemo } from 'react'

const LANE_W = 22
const APPR_DEPTH = 180
const CAR_L = 14
const CAR_W = 10
const SAT_HEAD = 1.9  // seconds headway at saturation
const YELLOW_DUR = 4

const DIR_PHASE = {
  NB: { L: 3, T: 4, R: 4 },
  SB: { L: 7, T: 8, R: 8 },
  EB: { L: 1, T: 2, R: 2 },
  WB: { L: 5, T: 6, R: 6 },
}

const SIG_COLORS = { R: '#ef4444', Y: '#eab308', G: '#22c55e', dark: '#1f2937' }

function phaseColor(phStart, split, yellow, t, cycle) {
  const tmod = ((t % cycle) + cycle) % cycle
  const gEnd = (phStart + split - yellow) % cycle
  const yEnd = (phStart + split) % cycle

  // check green
  const inGreen = rangeContains(phStart, gEnd, tmod, cycle)
  if (inGreen) return 'G'
  const inYellow = rangeContains(gEnd, yEnd, tmod, cycle)
  if (inYellow) return 'Y'
  return 'R'
}

function rangeContains(start, end, t, cycle) {
  if (start <= end) return t >= start && t < end
  return t >= start || t < end
}

function computePhaseStarts(plan, nema) {
  if (!plan) return {}
  const { cycle, offset, splits } = plan
  const s = (ph) => splits?.[String(ph)] ?? 0

  // outbound through = EB phase 2, inbound through = WB phase 6
  // offset = start of outbound through green
  const starts = {}
  starts[2] = ((offset % cycle) + cycle) % cycle
  starts[1] = (starts[2] - s(1) + cycle) % cycle
  starts[6] = (starts[2] + s(2) + s(5)) % cycle
  starts[5] = (starts[6] - s(5) + cycle) % cycle
  starts[4] = (starts[2] + s(2) + s(1)) % cycle  // barrier 2 start = after barrier 1
  // Barrier 2 start is after all of barrier 1 phases
  const bar1 = Math.max(s(1) + s(2), s(5) + s(6))
  starts[4] = (starts[2] - s(2) + bar1 + s(3)) % cycle
  starts[3] = (starts[4] - s(3) + cycle) % cycle
  starts[8] = (starts[4] + s(4) + s(7)) % cycle
  starts[7] = (starts[8] - s(7) + cycle) % cycle
  return starts
}

function buildGeometry(ix) {
  const approaches = ix.approaches || []
  const dirs = ['NB', 'SB', 'EB', 'WB']
  const info = {}
  dirs.forEach((d) => {
    const ap = approaches.find((a) => a.direction === d)
    const lanes = ap?.lanes ?? [{ movement: 'T', width_ft: 12 }, { movement: 'T', width_ft: 12 }]
    info[d] = { lanes, count: lanes.length, ap }
  })

  const ns = Math.max(info.NB.count, info.SB.count, 1)
  const ew = Math.max(info.EB.count, info.WB.count, 1)
  const roadNS = ns * LANE_W
  const roadEW = ew * LANE_W
  const W = roadEW * 2 + APPR_DEPTH * 2 + roadNS * 2
  const H = roadNS * 2 + APPR_DEPTH * 2 + roadEW * 2
  const cx = W / 2
  const cy = H / 2

  return { info, ns, ew, roadNS, roadEW, W, H, cx, cy }
}

function drawIntersection(ctx, ix, geo, phStarts, plan, simT) {
  const { info, roadNS, roadEW, W, H, cx, cy } = geo
  const cycle = plan?.cycle ?? 120
  const splits = plan?.splits ?? {}
  const nema = ix.nema_phases ?? {}

  ctx.clearRect(0, 0, W, H)

  // Background
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, W, H)

  // Road surface
  ctx.fillStyle = '#374151'
  // NS road
  ctx.fillRect(cx - roadNS, 0, roadNS * 2, H)
  // EW road
  ctx.fillRect(0, cy - roadEW, W, roadEW * 2)

  // Box
  ctx.fillStyle = '#4b5563'
  ctx.fillRect(cx - roadNS, cy - roadEW, roadNS * 2, roadEW * 2)

  // Lane markings
  ctx.strokeStyle = '#9ca3af'
  ctx.setLineDash([12, 8])
  ctx.lineWidth = 1

  // NB lanes (right side of NS road, going up)
  for (let i = 1; i < info.NB.count; i++) {
    const x = cx + (i - info.NB.count / 2) * LANE_W
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cy - roadEW); ctx.stroke()
  }
  // SB lanes (left side of NS road, going down)
  for (let i = 1; i < info.SB.count; i++) {
    const x = cx - (i - info.SB.count / 2) * LANE_W
    ctx.beginPath(); ctx.moveTo(x, cy + roadEW); ctx.lineTo(x, H); ctx.stroke()
  }
  // EB lanes (bottom side of EW road, going right)
  for (let i = 1; i < info.EB.count; i++) {
    const y = cy + (i - info.EB.count / 2) * LANE_W
    ctx.beginPath(); ctx.moveTo(cx + roadNS, y); ctx.lineTo(W, y); ctx.stroke()
  }
  // WB lanes (top side of EW road, going left)
  for (let i = 1; i < info.WB.count; i++) {
    const y = cy - (i - info.WB.count / 2) * LANE_W
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cx - roadNS, y); ctx.stroke()
  }

  ctx.setLineDash([])

  // Stop bars
  ctx.strokeStyle = '#f9fafb'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(cx, cy - roadEW); ctx.lineTo(cx + roadNS, cy - roadEW); ctx.stroke() // NB
  ctx.beginPath(); ctx.moveTo(cx - roadNS, cy + roadEW); ctx.lineTo(cx, cy + roadEW); ctx.stroke() // SB
  ctx.beginPath(); ctx.moveTo(cx + roadNS, cy); ctx.lineTo(cx + roadNS, cy + roadEW); ctx.stroke() // EB
  ctx.beginPath(); ctx.moveTo(cx - roadNS, cy - roadEW); ctx.lineTo(cx - roadNS, cy); ctx.stroke() // WB

  // Signal heads
  const sigR = 5
  const sigOff = 14
  const dirSigs = {
    NB: { x: cx + roadNS + sigOff, y: cy - roadEW - sigOff, ph: DIR_PHASE.NB.T },
    SB: { x: cx - roadNS - sigOff, y: cy + roadEW + sigOff, ph: DIR_PHASE.SB.T },
    EB: { x: cx + roadNS + sigOff, y: cy + roadEW + sigOff, ph: DIR_PHASE.EB.T },
    WB: { x: cx - roadNS - sigOff, y: cy - roadEW - sigOff, ph: DIR_PHASE.WB.T },
  }

  Object.entries(dirSigs).forEach(([dir, sig]) => {
    const ph = sig.ph
    const phStart = phStarts[ph] ?? 0
    const split = splits[String(ph)] ?? 0
    const yellow = nema[String(ph)]?.yellow ?? YELLOW_DUR
    const col = phaseColor(phStart, split, yellow, simT, cycle)

    // Housing
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(sig.x - sigR - 2, sig.y - sigR - 2, sigR * 2 + 4, sigR * 2 + 4)
    // Light
    ctx.fillStyle = col === 'G' ? SIG_COLORS.G : col === 'Y' ? SIG_COLORS.Y : SIG_COLORS.R
    ctx.beginPath()
    ctx.arc(sig.x, sig.y, sigR, 0, Math.PI * 2)
    ctx.fill()
  })

  // Vehicles
  drawVehicles(ctx, ix, geo, phStarts, plan, simT)
}

function drawVehicles(ctx, ix, geo, phStarts, plan, simT) {
  const { cx, cy, roadNS, roadEW } = geo
  const cycle = plan?.cycle ?? 120
  const splits = plan?.splits ?? {}
  const nema = ix.nema_phases ?? {}
  const demand = ix._demand ?? {}

  const dirConfig = {
    NB: {
      stopY: cy - roadEW - 2,
      laneX: (laneIdx, total) => cx + (laneIdx + 0.5) * LANE_W,
      axis: 'y', dir: -1,
    },
    SB: {
      stopY: cy + roadEW + 2,
      laneX: (laneIdx, total) => cx - (total - laneIdx - 0.5) * LANE_W,
      axis: 'y', dir: 1,
    },
    EB: {
      stopY: cx + roadNS + 2,
      laneX: (laneIdx, total) => cy + (laneIdx + 0.5) * LANE_W,
      axis: 'x', dir: 1,
    },
    WB: {
      stopY: cx - roadNS - 2,
      laneX: (laneIdx, total) => cy - (total - laneIdx - 0.5) * LANE_W,
      axis: 'x', dir: -1,
    },
  }

  const DISCHARGE_SPEED = 8  // px/s
  const ARRIVAL_SPEED = 6

  ;(ix.approaches || []).forEach((ap) => {
    const d = ap.direction
    const cfg = dirConfig[d]
    if (!cfg) return
    const lanes = ap.lanes || []
    lanes.forEach((lane, li) => {
      const ph = DIR_PHASE[d]?.[lane.movement[0]] ?? DIR_PHASE[d]?.T
      const phStart = phStarts[ph] ?? 0
      const split = splits[String(ph)] ?? 0
      const yellow = nema[String(ph)]?.yellow ?? YELLOW_DUR
      const green = Math.max(0, split - yellow - (nema[String(ph)]?.all_red ?? 1))
      const col = phaseColor(phStart, split, yellow, simT, cycle)

      const lx = cfg.laneX(li, lanes.length)

      // Simulate a queue that forms on red, discharges on green
      const tmod = ((simT % cycle) + cycle) % cycle
      let timeIntoPhase
      if (phStart <= tmod) timeIntoPhase = tmod - phStart
      else timeIntoPhase = cycle - phStart + tmod

      const isGreen = col === 'G'
      const maxQueue = Math.min(Math.floor(APPR_DEPTH / (CAR_L + 4)), 6)

      if (!isGreen) {
        // Red: show queue growing
        const redTime = col === 'R' ? timeIntoPhase : (split - yellow)
        const queueLen = Math.min(Math.floor(redTime / 2.5), maxQueue)
        for (let qi = 0; qi < queueLen; qi++) {
          const distFromStop = qi * (CAR_L + 4) + 6
          drawCar(ctx, lx, cfg.stopY, distFromStop, cfg.axis, cfg.dir, '#60a5fa')
        }
      } else {
        // Green: discharge from front, show trailing vehicles
        const discharged = Math.floor(timeIntoPhase / SAT_HEAD)
        const queueAtGreen = Math.min(Math.floor((split - green) / 2.5), maxQueue)
        const remaining = Math.max(0, queueAtGreen - discharged)
        for (let qi = 0; qi < remaining; qi++) {
          const distFromStop = qi * (CAR_L + 4) + 6
          drawCar(ctx, lx, cfg.stopY, distFromStop, cfg.axis, cfg.dir, '#60a5fa')
        }
        // Show discharged vehicles moving through intersection
        for (let di = 0; di < Math.min(discharged, 3); di++) {
          const elapsed = timeIntoPhase - di * SAT_HEAD
          const dist = elapsed * DISCHARGE_SPEED
          drawCar(ctx, lx, cfg.stopY, -dist, cfg.axis, cfg.dir, '#34d399')
        }
      }
    })
  })
}

function drawCar(ctx, lanePos, stopLine, distFromStop, axis, dir, color) {
  const hw = CAR_W / 2
  const hl = CAR_L / 2

  ctx.fillStyle = color
  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = 0.5

  if (axis === 'y') {
    const y = stopLine + dir * distFromStop
    if (dir < 0) {
      ctx.fillRect(lanePos - hw, y - hl, CAR_W, CAR_L)
      ctx.strokeRect(lanePos - hw, y - hl, CAR_W, CAR_L)
    } else {
      ctx.fillRect(lanePos - hw, y - hl, CAR_W, CAR_L)
      ctx.strokeRect(lanePos - hw, y - hl, CAR_W, CAR_L)
    }
  } else {
    const x = stopLine + dir * distFromStop
    ctx.fillRect(x - hl, lanePos - hw, CAR_L, CAR_W)
    ctx.strokeRect(x - hl, lanePos - hw, CAR_L, CAR_W)
  }
}

export default function SimulationCanvas({ intersection, activePlan, simT }) {
  const canvasRef = useRef(null)

  const geo = useMemo(() => buildGeometry(intersection), [intersection])

  const plan = intersection?.timing_plans?.[activePlan]
  const phStarts = useMemo(
    () => computePhaseStarts(plan, intersection?.nema_phases),
    [plan, intersection?.nema_phases]
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    drawIntersection(ctx, intersection, geo, phStarts, plan, simT)
  }, [intersection, geo, phStarts, plan, simT])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={geo.W}
      height={geo.H}
      className="rounded-lg"
      style={{ maxWidth: '100%', background: '#111827' }}
    />
  )
}
