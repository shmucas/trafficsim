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
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">No intersections defined. Go back to Corridor Setup first.</p>
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Demand Input</h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
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
              className={`text-[11px] px-2.5 py-0.5 border transition-colors duration-150 ${
                selectedIxId === i.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-500'
              }`}
              style={{ borderRadius: 3 }}
            >
              {i.name || `Intersection ${i.id}`}
            </button>
          ))}
        </div>
      )}

      {/* Demand hint */}
      <div className="border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/10 px-3 py-1.5 text-[11px] text-blue-700 dark:text-blue-300 mb-3" style={{ borderRadius: 3 }}>
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
                <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 font-bold text-xs" style={{ borderRadius: 3 }}>
                  {dir}
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">{dir} Approach</h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500">
                    {lanes.length} lane{lanes.length !== 1 ? 's' : ''} · HV {approach?.heavy_vehicle_pct ?? 2}% · PHF {approach?.phf ?? 0.95}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleClear(dir)}
                className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="text-xs border-separate" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left label w-8">Mvmt</th>
                    {TIME_BINS.map((bin) => (
                      <th key={bin} className="px-1.5 py-1 text-center label w-20">
                        {bin} min
                      </th>
                    ))}
                    <th className="px-2 py-1 text-right label w-16">Total</th>
                    <th className="px-2 py-1 text-right label w-20">PHF-Adj</th>
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
                        className={`border-t border-gray-100 dark:border-gray-700 ${!active ? 'opacity-30' : ''}`}
                      >
                        <td className="px-2 py-1">
                          <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold ${
                            active
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-600'
                          }`} style={{ borderRadius: 2 }}>
                            {movement}
                          </span>
                        </td>
                        {TIME_BINS.map((_, binIdx) => (
                          <td key={binIdx} className="px-1 py-1">
                            <input
                              type="number"
                              className={`input-field text-[11px] text-center w-16 ${
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
                          <span className={`text-xs font-medium ${total > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                            {total}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right">
                          <span className={`text-[11px] ${phfAdj > 0 ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400 dark:text-gray-600'}`}>
                            {phfAdj > 0 ? phfAdj : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}

                  {/* Approach totals row */}
                  <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                    <td className="px-2 py-1 text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Total</td>
                    {TIME_BINS.map((_, binIdx) => {
                      const binTotal = MOVEMENTS.reduce(
                        (sum, mv) => sum + getCell(dir, mv, binIdx),
                        0
                      )
                      return (
                        <td key={binIdx} className="px-1 py-1 text-center">
                          <span className={`text-[11px] font-medium ${binTotal > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>
                            {binTotal}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-2 py-1 text-right">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
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
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
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
