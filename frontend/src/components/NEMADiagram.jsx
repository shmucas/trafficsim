import React from 'react'

/**
 * NEMA Ring-Barrier Diagram
 *
 * Ring 1 (top):    [Ph1] [Ph2] | BARRIER | [Ph5] [Ph6]
 * Ring 2 (bottom): [Ph3] [Ph4] | BARRIER | [Ph7] [Ph8]
 */

const PHASE_COLORS = {
  active:   { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  inactive: { bg: '#1c1c1c', border: '#374151', text: '#4b5563' },
}

// Ring layout: [ring index][position index] = phase number
const RING_LAYOUT = [
  [1, 2, 5, 6],  // Ring 1
  [3, 4, 7, 8],  // Ring 2
]

export default function NEMADiagram({ phases = {}, onPhaseClick = null }) {
  const BOX_W = 72
  const BOX_H = 48
  const GAP_X = 12
  const BARRIER_W = 24
  const RING_GAP_Y = 14
  const PAD_X = 20
  const PAD_Y = 20
  const LABEL_H = 20

  // Layout positions for 4 boxes per ring (2 before barrier, 2 after)
  // Cols: 0,1 | barrier | 2,3
  function colX(col) {
    if (col < 2) return PAD_X + col * (BOX_W + GAP_X)
    // after barrier
    return PAD_X + 2 * (BOX_W + GAP_X) + BARRIER_W + GAP_X + (col - 2) * (BOX_W + GAP_X)
  }

  function rowY(row) {
    return PAD_Y + LABEL_H + row * (BOX_H + RING_GAP_Y)
  }

  const totalW = PAD_X * 2 + 4 * BOX_W + 3 * GAP_X + BARRIER_W + GAP_X
  const totalH = PAD_Y * 2 + LABEL_H + 2 * BOX_H + RING_GAP_Y

  const barrierX = PAD_X + 2 * (BOX_W + GAP_X) + GAP_X / 2

  return (
    <div className="overflow-x-auto">
      <svg
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="select-none"
        style={{ minWidth: totalW }}
      >
        {/* Background */}
        <rect width={totalW} height={totalH} fill="#111827" rx={8} />

        {/* Barrier line */}
        <line
          x1={barrierX + BARRIER_W / 2}
          y1={PAD_Y}
          x2={barrierX + BARRIER_W / 2}
          y2={totalH - PAD_Y}
          stroke="#6b7280"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <rect
          x={barrierX}
          y={totalH / 2 - 12}
          width={BARRIER_W}
          height={24}
          fill="#1f2937"
          rx={4}
        />
        <text
          x={barrierX + BARRIER_W / 2}
          y={totalH / 2 + 5}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize={9}
          fontFamily="monospace"
          fontWeight="bold"
          letterSpacing="0.05em"
        >
          BAR
        </text>

        {/* Ring labels */}
        {RING_LAYOUT.map((ring, ringIdx) => (
          <text
            key={`ring-label-${ringIdx}`}
            x={PAD_X - 6}
            y={rowY(ringIdx) + BOX_H / 2 + 4}
            textAnchor="end"
            fill="#6b7280"
            fontSize={9}
            fontFamily="sans-serif"
          >
            R{ringIdx + 1}
          </text>
        ))}

        {/* "Barrier 1" and "Barrier 2" header labels */}
        {[0, 1].map((group) => {
          const startX = group === 0
            ? PAD_X
            : barrierX + BARRIER_W + GAP_X / 2
          const groupW = 2 * BOX_W + GAP_X
          return (
            <text
              key={`group-label-${group}`}
              x={startX + groupW / 2}
              y={PAD_Y + LABEL_H - 6}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize={9}
              fontFamily="sans-serif"
            >
              {group === 0 ? 'Barrier Group 1' : 'Barrier Group 2'}
            </text>
          )
        })}

        {/* Phase boxes */}
        {RING_LAYOUT.map((ring, ringIdx) =>
          ring.map((phaseNum, colIdx) => {
            const phaseKey = String(phaseNum)
            const phaseData = phases[phaseKey] || {}
            const isActive = phaseData.active !== false
            const colors = isActive ? PHASE_COLORS.active : PHASE_COLORS.inactive

            // Map column: 0,1 = first two, 2,3 = second two
            const x = colX(colIdx)
            const y = rowY(ringIdx)

            return (
              <g
                key={`phase-${phaseNum}`}
                onClick={() => onPhaseClick && onPhaseClick(phaseKey)}
                style={{ cursor: onPhaseClick ? 'pointer' : 'default' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={BOX_W}
                  height={BOX_H}
                  fill={colors.bg}
                  stroke={colors.border}
                  strokeWidth={isActive ? 1.5 : 1}
                  rx={6}
                  style={{ transition: 'fill 0.15s, stroke 0.15s' }}
                />
                {/* Phase number */}
                <text
                  x={x + BOX_W / 2}
                  y={y + 18}
                  textAnchor="middle"
                  fill={colors.text}
                  fontSize={15}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {phaseNum}
                </text>
                {/* Active/inactive label */}
                <text
                  x={x + BOX_W / 2}
                  y={y + 34}
                  textAnchor="middle"
                  fill={isActive ? '#60a5fa' : '#4b5563'}
                  fontSize={8}
                  fontFamily="sans-serif"
                >
                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                </text>
              </g>
            )
          })
        )}

        {/* Recall mode badges for active phases */}
        {RING_LAYOUT.map((ring, ringIdx) =>
          ring.map((phaseNum, colIdx) => {
            const phaseKey = String(phaseNum)
            const phaseData = phases[phaseKey] || {}
            if (!phaseData.active || !phaseData.recall || phaseData.recall === 'None') return null
            const x = colX(colIdx)
            const y = rowY(ringIdx)
            const recallColors = {
              Min: '#92400e',
              Max: '#1e3a5f',
              Ped: '#1a2e1a',
            }
            return (
              <g key={`recall-badge-${phaseNum}`}>
                <rect
                  x={x + BOX_W - 22}
                  y={y + 4}
                  width={18}
                  height={12}
                  fill={recallColors[phaseData.recall] || '#374151'}
                  rx={3}
                />
                <text
                  x={x + BOX_W - 13}
                  y={y + 13}
                  textAnchor="middle"
                  fill="#d1d5db"
                  fontSize={7}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {phaseData.recall}
                </text>
              </g>
            )
          })
        )}
      </svg>
    </div>
  )
}
