import React, { useState } from 'react'
import useProjectStore from '../store/projectStore'

const TIME_BINS = ['0–15', '15–30', '30–45', '45–60']
const MOVEMENTS = ['L', 'T', 'R']

function getActiveDirections(type) {
  switch (type) {
    case '2-leg': return ['NB', 'SB']
    case '3-leg': return ['NB', 'SB', 'EB']
    case '4-leg': return ['NB', 'SB', 'EB', 'WB']
    default:      return ['NB', 'SB', 'EB', 'WB']
  }
}

function makeDirDefault() {
  return {
    L: [0, 0, 0, 0],
    T: [0, 0, 0, 0],
    R: [0, 0, 0, 0],
  }
}

export default function DemandInput() {
  const {
    currentProject,
    updateDemand,
    setActiveView,
  } = useProjectStore()

  const [selectedIxId, setSelectedIxId] = useState(
    currentProject?.intersections?.[0]?.id ?? null
  )

  if (!currentProject) return null

  const intersections = currentProject.intersections || []

  if (intersections.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-4 text-center">
        <p className="text-sm mb-3" style={{ color: '#888888' }}>No intersections defined. Go back to Corridor Setup first.</p>
        <button className="btn-secondary" onClick={() => setActiveView('corridor')}>
          Back to Corridor Setup
        </button>
      </div>
    )
  }

  const ix = intersections.find((i) => i.id === selectedIxId) || intersections[0]
  const activeDirections = getActiveDirections(ix.type)
  const demand = currentProject.demand || {}
  const ixDemand = demand[ix.id] || {}

  function getCell(dir, movement, binIndex) {
    const dirData = ixDemand[dir] || makeDirDefault()
    return (dirData[movement] || [0, 0, 0, 0])[binIndex] ?? 0
  }

  function setCell(dir, movement, binIndex, value) {
    const existingDirData = ixDemand[dir] || makeDirDefault()
    const arr = [...(existingDirData[movement] || [0, 0, 0, 0])]
    arr[binIndex] = Number(value) || 0

    const updatedIxDemand = {
      ...ixDemand,
      [dir]: {
        ...existingDirData,
        [movement]: arr,
      },
    }
    updateDemand(ix.id, updatedIxDemand)
  }

  function dirTotal(dir, movement) {
    const dirData = ixDemand[dir] || makeDirDefault()
    return (dirData[movement] || [0, 0, 0, 0]).reduce((a, b) => a + b, 0)
  }

  function phfAdjusted(dir, movement) {
    const approach = ix.approaches?.find((a) => a.direction === dir)
    const phf = approach?.phf || 0.95
    const peak15 = Math.max(...((ixDemand[dir]?.[movement]) || [0, 0, 0, 0]))
    return phf > 0 ? Math.round(peak15 * 4 * phf) : 0
  }

  function handleClear(dir) {
    const clearedDir = { L: [0,0,0,0], T: [0,0,0,0], R: [0,0,0,0] }
    updateDemand(ix.id, { ...ixDemand, [dir]: clearedDir })
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: '#111111' }}>Demand Input</h2>
          <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
            Turning movement counts (TMC) per 15-min bin — veh/15-min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="label">Intersection:</label>
          <select
            className="select-field w-52"
            value={selectedIxId}
            onChange={(e) => setSelectedIxId(Number(e.target.value))}
          >
            {intersections.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name || `Intersection ${i.id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Intersection quick-nav */}
      {intersections.length > 1 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {intersections.map((i) => (
            <button
              key={i.id}
              onClick={() => setSelectedIxId(i.id)}
              className="text-[11px] px-2.5 py-0.5 transition-colors duration-150"
              style={{
                borderRadius: 3,
                border: selectedIxId === i.id ? '1px solid #111111' : '1px solid #E2E2E0',
                backgroundColor: selectedIxId === i.id ? '#111111' : '#F8F8F7',
                color: selectedIxId === i.id ? '#FFFFFF' : '#888888',
              }}
              onMouseEnter={(e) => {
                if (selectedIxId !== i.id) {
                  e.currentTarget.style.borderColor = '#111111'
                  e.currentTarget.style.color = '#111111'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedIxId !== i.id) {
                  e.currentTarget.style.borderColor = '#E2E2E0'
                  e.currentTarget.style.color = '#888888'
                }
              }}
            >
              {i.name || `Intersection ${i.id}`}
            </button>
          ))}
        </div>
      )}

      {/* Demand hint */}
      <div
        className="px-3 py-1.5 text-[11px] mb-3"
        style={{ border: '1px solid #E2E2E0', backgroundColor: '#F8F8F7', color: '#888888', borderRadius: 3 }}
      >
        Each row = approach direction. Columns show L/T/R movements for each 15-min bin. PHF-adjusted vph in last column.
      </div>

      {/* TMC Grid */}
      {activeDirections.map((dir) => {
        const approach = ix.approaches?.find((a) => a.direction === dir)
        const lanes = approach?.lanes || []
        const hasTurn = (mv) => lanes.some((l) => l.movement && l.movement.includes(mv))

        return (
          <div key={dir} className="card mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-7 h-7 font-bold text-xs"
                  style={{ backgroundColor: '#F8F8F7', border: '1px solid #E2E2E0', color: '#111111', borderRadius: 3 }}
                >
                  {dir}
                </span>
                <div>
                  <h4 className="text-xs font-semibold" style={{ color: '#111111' }}>{dir} Approach</h4>
                  <p className="text-[11px]" style={{ color: '#888888' }}>
                    {lanes.length} lane{lanes.length !== 1 ? 's' : ''} · HV {approach?.heavy_vehicle_pct ?? 2}% · PHF {approach?.phf ?? 0.95}
                  </p>
                </div>
              </div>
              <button
                className="text-[11px] transition-colors"
                style={{ color: '#AAAAAA', background: 'none', border: 'none' }}
                onClick={() => handleClear(dir)}
                onMouseEnter={(e) => e.currentTarget.style.color = '#111111'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#AAAAAA'}
              >
                Clear
              </button>
            </div>

            <div className="overflow-x-auto">
              <table
                className="text-xs"
                style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: '100%', minWidth: 520 }}
              >
                <colgroup>
                  <col style={{ width: 44 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 72 }} />
                  <col style={{ width: 80 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left label">Mvmt</th>
                    {TIME_BINS.map((bin) => (
                      <th key={bin} className="px-1.5 py-1 text-center label">
                        {bin} min
                      </th>
                    ))}
                    <th className="px-2 py-1 text-right label">Total</th>
                    <th className="px-2 py-1 text-right label">PHF-Adj</th>
                  </tr>
                </thead>
                <tbody>
                  {MOVEMENTS.map((movement) => {
                    const active = hasTurn(movement)
                    const total = dirTotal(dir, movement)
                    const phfAdj = phfAdjusted(dir, movement)

                    return (
                      <tr
                        key={movement}
                        className={!active ? 'opacity-30' : ''}
                        style={{ borderTop: '1px solid #E2E2E0' }}
                      >
                        <td className="px-2 py-1">
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold"
                            style={{
                              borderRadius: 2,
                              backgroundColor: active ? '#E2E2E0' : '#F5F5F4',
                              color: active ? '#333333' : '#AAAAAA',
                            }}
                          >
                            {movement}
                          </span>
                        </td>
                        {TIME_BINS.map((_, binIdx) => (
                          <td key={binIdx} className="px-1 py-1">
                            <input
                              type="number"
                              className={`input-field text-[11px] text-center w-full ${
                                !active ? 'cursor-not-allowed' : ''
                              }`}
                              value={getCell(dir, movement, binIdx)}
                              disabled={!active}
                              onChange={(e) => setCell(dir, movement, binIdx, e.target.value)}
                              min={0}
                              step={1}
                              placeholder="0"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-right">
                          <span
                            className="text-xs font-medium"
                            style={{ color: total > 0 ? '#111111' : '#AAAAAA' }}
                          >
                            {total}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right">
                          <span
                            className="text-[11px]"
                            style={{ color: phfAdj > 0 ? '#444444' : '#AAAAAA' }}
                          >
                            {phfAdj > 0 ? phfAdj : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}

                  {/* Approach totals row */}
                  <tr style={{ borderTop: '2px solid #E2E2E0', backgroundColor: '#FAFAF9' }}>
                    <td className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#888888' }}>Total</td>
                    {TIME_BINS.map((_, binIdx) => {
                      const binTotal = MOVEMENTS.reduce(
                        (sum, mv) => sum + getCell(dir, mv, binIdx),
                        0
                      )
                      return (
                        <td key={binIdx} className="px-1 py-1 text-center">
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: binTotal > 0 ? '#444444' : '#AAAAAA' }}
                          >
                            {binTotal}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-2 py-1 text-right">
                      <span className="text-xs font-bold" style={{ color: '#111111' }}>
                        {MOVEMENTS.reduce((sum, mv) => sum + dirTotal(dir, mv), 0)}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid #E2E2E0' }}>
        <button
          onClick={() => setActiveView('corridor')}
          className="btn-secondary gap-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Corridor
        </button>
        <button
          onClick={() => setActiveView('simulation')}
          className="btn-primary gap-2"
        >
          Next: Run Simulation
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
