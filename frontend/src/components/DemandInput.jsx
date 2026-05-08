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
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-gray-400 mb-4">No intersections defined. Go back to Corridor Setup first.</p>
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
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Demand Input</h2>
          <p className="text-gray-400 text-sm mt-1">
            Enter turning movement counts (TMC) per 15-minute bin for each intersection
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="label">Intersection:</label>
          <select
            className="select-field w-64"
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
        <div className="flex gap-2 mb-4 flex-wrap">
          {intersections.map((i) => (
            <button
              key={i.id}
              onClick={() => setSelectedIxId(i.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                selectedIxId === i.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {i.name || `Intersection ${i.id}`}
            </button>
          ))}
        </div>
      )}

      {/* Demand hint */}
      <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-2 text-xs text-blue-300 mb-4">
        <strong>How to read this table:</strong> Each row is an approach direction. Columns show
        L/T/R movements for each 15-minute bin of the peak hour (veh/15-min).
        PHF-adjusted hourly volumes are shown in the last column.
      </div>

      {/* TMC Grid */}
      {activeDirections.map((dir) => {
        const approach = ix.approaches?.find((a) => a.direction === dir)
        const lanes = approach?.lanes || []
        const hasTurn = (mv) => lanes.some((l) => l.movement && l.movement.includes(mv))

        return (
          <div key={dir} className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-900 border border-blue-700 text-blue-200 font-bold text-sm">
                  {dir}
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">{dir} Approach</h4>
                  <p className="text-xs text-gray-500">
                    {lanes.length} lane{lanes.length !== 1 ? 's' : ''} — HV: {approach?.heavy_vehicle_pct ?? 2}% — PHF: {approach?.phf ?? 0.95}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleClear(dir)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="text-sm border-separate" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase tracking-wider w-10">Mvmt</th>
                    {TIME_BINS.map((bin) => (
                      <th
                        key={bin}
                        className="px-2 py-2 text-center text-xs text-gray-500 uppercase tracking-wider w-24"
                        colSpan={1}
                      >
                        {bin} min
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right text-xs text-gray-500 uppercase tracking-wider w-24">
                      Total
                    </th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500 uppercase tracking-wider w-24">
                      PHF-Adj (vph)
                    </th>
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
                        className={`border-t border-gray-700 ${!active ? 'opacity-30' : ''}`}
                      >
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                            active
                              ? 'bg-gray-700 text-gray-200'
                              : 'bg-gray-800 text-gray-600'
                          }`}>
                            {movement}
                          </span>
                        </td>
                        {TIME_BINS.map((_, binIdx) => (
                          <td key={binIdx} className="px-1 py-1.5">
                            <input
                              type="number"
                              className={`input-field text-xs py-1 text-center w-20 ${
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
                        <td className="px-3 py-1.5 text-right">
                          <span className={`text-sm font-medium ${total > 0 ? 'text-white' : 'text-gray-600'}`}>
                            {total}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <span className={`text-xs ${phfAdj > 0 ? 'text-blue-300' : 'text-gray-600'}`}>
                            {phfAdj > 0 ? phfAdj : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}

                  {/* Approach totals row */}
                  <tr className="border-t-2 border-gray-600 bg-gray-900/50">
                    <td className="px-3 py-1.5 text-xs text-gray-400 font-semibold uppercase">Total</td>
                    {TIME_BINS.map((_, binIdx) => {
                      const binTotal = MOVEMENTS.reduce(
                        (sum, mv) => sum + getCell(dir, mv, binIdx),
                        0
                      )
                      return (
                        <td key={binIdx} className="px-1 py-1.5 text-center">
                          <span className={`text-xs font-medium ${binTotal > 0 ? 'text-gray-300' : 'text-gray-600'}`}>
                            {binTotal}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 text-right">
                      <span className="text-sm font-bold text-white">
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
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
        <button
          onClick={() => setActiveView('corridor')}
          className="btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Corridor
        </button>
        <button
          onClick={() => setActiveView('simulation')}
          className="btn-primary flex items-center gap-2"
        >
          Next: Run Simulation
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
