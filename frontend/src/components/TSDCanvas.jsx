import React, { useRef, useEffect } from 'react'

/**
 * TSDCanvas — Time-Space Diagram
 * Phase 3 stub: renders a placeholder SVG with axis labels and corridor structure.
 * Full green-band rendering and vehicle trajectories will be added in Phase 3.
 */
export default function TSDCanvas({ intersections = [], activePlan = 'AM' }) {
  const svgRef = useRef(null)

  const PAD_LEFT = 160
  const PAD_RIGHT = 20
  const PAD_TOP = 30
  const PAD_BOTTOM = 40
  const ROW_HEIGHT = 60
  const TIME_AXIS_WIDTH = 600

  // Compute cumulative distances
  let cumDist = 0
  const ixPositions = intersections.map((ix, i) => {
    if (i > 0) cumDist += Number(ix.distance_from_prev_ft) || 0
    return { ...ix, cumDist }
  })
  const maxDist = cumDist || 1000

  const svgH = PAD_TOP + PAD_BOTTOM + Math.max(intersections.length, 1) * ROW_HEIGHT
  const svgW = PAD_LEFT + TIME_AXIS_WIDTH + PAD_RIGHT

  function distToY(dist) {
    return PAD_TOP + (dist / maxDist) * (svgH - PAD_TOP - PAD_BOTTOM)
  }

  const cycleLength = intersections[0]?.timing_plans?.[activePlan]?.cycle || 120
  const timeWindow = cycleLength * 2

  function timeToX(t) {
    return PAD_LEFT + (t / timeWindow) * TIME_AXIS_WIDTH
  }

  // Draw green bands for an intersection based on active timing plan
  function renderGreenBands(ix, ixY) {
    const plan = ix.timing_plans?.[activePlan]
    if (!plan) return null
    const { cycle, offset = 0, splits } = plan
    const phases = ix.nema_phases || {}
    const bands = []

    let t = offset % cycle
    Object.entries(splits || {}).forEach(([phaseKey, split]) => {
      const phase = phases[phaseKey]
      if (!phase || !phase.active) { t += split; return }
      const yellow = phase.yellow || 4
      const allRed = phase.all_red || 1
      const green = split - yellow - allRed

      if (green > 0) {
        // Draw for 2 cycles
        for (let c = 0; c < 2; c++) {
          const tStart = t + c * cycle
          const tEnd = tStart + green
          if (tEnd > 0 && tStart < timeWindow) {
            const x1 = timeToX(Math.max(0, tStart))
            const x2 = timeToX(Math.min(timeWindow, tEnd))
            bands.push(
              <rect
                key={`${phaseKey}-${c}`}
                x={x1}
                y={ixY - 16}
                width={x2 - x1}
                height={32}
                fill="#16a34a"
                opacity={0.45}
                rx={2}
              />
            )
          }
        }
      }
      t += split
    })
    return bands
  }

  if (intersections.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-700 flex items-center justify-center h-40">
        <p className="text-gray-600 text-sm">Add intersections to see the Time-Space Diagram.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="block"
        style={{ minWidth: svgW, background: '#0d1117' }}
      >
        {/* Background */}
        <rect width={svgW} height={svgH} fill="#0d1117" rx={8} />

        {/* Plot area background */}
        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={TIME_AXIS_WIDTH}
          height={svgH - PAD_TOP - PAD_BOTTOM}
          fill="#111827"
          rx={4}
        />

        {/* Time axis grid lines */}
        {Array.from({ length: Math.floor(timeWindow / 30) + 1 }, (_, i) => i * 30).map((t) => {
          if (t > timeWindow) return null
          const x = timeToX(t)
          return (
            <g key={t}>
              <line
                x1={x} y1={PAD_TOP}
                x2={x} y2={svgH - PAD_BOTTOM}
                stroke="#1f2937"
                strokeWidth={1}
              />
              <text
                x={x}
                y={svgH - PAD_BOTTOM + 14}
                textAnchor="middle"
                fill="#6b7280"
                fontSize={9}
                fontFamily="monospace"
              >
                {t}s
              </text>
            </g>
          )
        })}

        {/* Cycle boundary lines */}
        {[cycleLength].map((t) => {
          const x = timeToX(t)
          return (
            <g key={`cycle-${t}`}>
              <line
                x1={x} y1={PAD_TOP}
                x2={x} y2={svgH - PAD_BOTTOM}
                stroke="#374151"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text
                x={x + 3}
                y={PAD_TOP + 10}
                fill="#4b5563"
                fontSize={8}
                fontFamily="sans-serif"
              >
                Cycle {cycleLength}s
              </text>
            </g>
          )
        })}

        {/* Intersection rows */}
        {ixPositions.map((ix, i) => {
          const ixY = PAD_TOP + (i + 0.5) * ((svgH - PAD_TOP - PAD_BOTTOM) / Math.max(intersections.length, 1))

          return (
            <g key={ix.id}>
              {/* Horizontal row line */}
              <line
                x1={PAD_LEFT}
                y1={ixY}
                x2={PAD_LEFT + TIME_AXIS_WIDTH}
                y2={ixY}
                stroke="#1e2a3a"
                strokeWidth={1}
              />

              {/* Green bands */}
              {renderGreenBands(ix, ixY)}

              {/* Intersection label */}
              <text
                x={PAD_LEFT - 8}
                y={ixY + 4}
                textAnchor="end"
                fill="#9ca3af"
                fontSize={10}
                fontFamily="sans-serif"
              >
                {ix.name?.length > 22 ? ix.name.slice(0, 20) + '…' : (ix.name || `#${ix.id}`)}
              </text>

              {/* Distance label */}
              {i > 0 && (
                <text
                  x={PAD_LEFT - 8}
                  y={ixY + 15}
                  textAnchor="end"
                  fill="#4b5563"
                  fontSize={8}
                  fontFamily="monospace"
                >
                  {ix.cumDist.toLocaleString()} ft
                </text>
              )}

              {/* Row separator */}
              {i < intersections.length - 1 && (
                <line
                  x1={PAD_LEFT}
                  y1={ixY + (svgH - PAD_TOP - PAD_BOTTOM) / (2 * intersections.length)}
                  x2={PAD_LEFT + TIME_AXIS_WIDTH}
                  y2={ixY + (svgH - PAD_TOP - PAD_BOTTOM) / (2 * intersections.length)}
                  stroke="#1f2937"
                  strokeWidth={0.5}
                  strokeDasharray="2 4"
                />
              )}
            </g>
          )
        })}

        {/* Phase 3 overlay label */}
        <rect
          x={PAD_LEFT + TIME_AXIS_WIDTH / 2 - 100}
          y={svgH / 2 - 22}
          width={200}
          height={44}
          fill="#1f2937"
          stroke="#374151"
          rx={6}
          opacity={0.92}
        />
        <text
          x={PAD_LEFT + TIME_AXIS_WIDTH / 2}
          y={svgH / 2 - 4}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize={11}
          fontFamily="sans-serif"
          fontWeight="bold"
        >
          Full TSD — Phase 3
        </text>
        <text
          x={PAD_LEFT + TIME_AXIS_WIDTH / 2}
          y={svgH / 2 + 12}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={9}
          fontFamily="sans-serif"
        >
          Green bands, progression, trajectories
        </text>

        {/* Axis labels */}
        <text
          x={PAD_LEFT + TIME_AXIS_WIDTH / 2}
          y={svgH - 4}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={10}
          fontFamily="sans-serif"
        >
          Time (seconds) — {activePlan} Plan, Cycle {cycleLength}s
        </text>
        <text
          x={10}
          y={svgH / 2}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={10}
          fontFamily="sans-serif"
          transform={`rotate(-90, 10, ${svgH / 2})`}
        >
          Distance
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-3 rounded" style={{ background: 'rgba(22,163,74,0.45)' }} />
          <span>Green phase</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 bg-gray-600" style={{ borderTop: '1.5px dashed #374151' }} />
          <span>Cycle boundary</span>
        </div>
        <span className="ml-auto text-gray-600">Full diagram in Phase 3</span>
      </div>
    </div>
  )
}
