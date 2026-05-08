import React, { useState } from 'react'
import useProjectStore, { makeDefaultApproach } from '../store/projectStore'
import NEMADiagram from './NEMADiagram'

const TABS = ['Geometry', 'Phasing', 'Timing', 'Detectors', 'NTCIP Import']
const MOVEMENTS = ['L', 'T', 'R', 'LT', 'TR', 'LR', 'LTR']
const RECALL_MODES = ['None', 'Min', 'Max', 'Ped']
const PLANS = ['AM', 'PM', 'Off-Peak']

// Which approaches are active per intersection type
function getActiveDirections(type) {
  switch (type) {
    case '2-leg': return ['NB', 'SB']
    case '3-leg': return ['NB', 'SB', 'EB']
    case '4-leg': return ['NB', 'SB', 'EB', 'WB']
    default:      return ['NB', 'SB', 'EB', 'WB']
  }
}

export default function IntersectionEditor() {
  const {
    currentProject,
    selectedIntersectionId,
    updateIntersection,
    setActiveView,
    setSelectedIntersection,
    activePlan,
  } = useProjectStore()

  const [activeTab, setActiveTab] = useState('Geometry')
  const [timingPlan, setTimingPlan] = useState(activePlan || 'AM')

  if (!currentProject) return null

  const intersections = currentProject.intersections || []
  const ix = intersections.find((i) => i.id === selectedIntersectionId)
  const ixIndex = intersections.findIndex((i) => i.id === selectedIntersectionId)

  if (!ix) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>No intersection selected. Go back to Corridor Setup.</p>
        <button className="btn-secondary mt-4" onClick={() => setActiveView('corridor')}>
          Back to Corridor
        </button>
      </div>
    )
  }

  function update(data) {
    updateIntersection(ix.id, data)
  }

  function getApproach(direction) {
    return ix.approaches?.find((a) => a.direction === direction) || makeDefaultApproach(direction)
  }

  function updateApproach(direction, changes) {
    const approaches = [...(ix.approaches || [])]
    const idx = approaches.findIndex((a) => a.direction === direction)
    if (idx >= 0) {
      approaches[idx] = { ...approaches[idx], ...changes }
    } else {
      approaches.push({ ...makeDefaultApproach(direction), ...changes })
    }
    update({ approaches })
  }

  function updateLane(direction, laneIndex, changes) {
    const approach = getApproach(direction)
    const lanes = [...(approach.lanes || [])]
    lanes[laneIndex] = { ...lanes[laneIndex], ...changes }
    updateApproach(direction, { lanes })
  }

  function addLane(direction) {
    const approach = getApproach(direction)
    const lanes = [...(approach.lanes || []), { movement: 'T', width_ft: 12 }]
    updateApproach(direction, { lanes })
  }

  function removeLane(direction, laneIndex) {
    const approach = getApproach(direction)
    const lanes = [...(approach.lanes || [])]
    lanes.splice(laneIndex, 1)
    updateApproach(direction, { lanes })
  }

  function updatePhase(phaseKey, changes) {
    const nema_phases = { ...(ix.nema_phases || {}) }
    nema_phases[phaseKey] = { ...(nema_phases[phaseKey] || {}), ...changes }
    update({ nema_phases })
  }

  function updateTiming(plan, changes) {
    const timing_plans = { ...(ix.timing_plans || {}) }
    timing_plans[plan] = { ...(timing_plans[plan] || {}), ...changes }
    update({ timing_plans })
  }

  function updateSplit(plan, phaseKey, value) {
    const timing_plans = { ...(ix.timing_plans || {}) }
    const planData = { ...(timing_plans[plan] || {}) }
    const splits = { ...(planData.splits || {}), [phaseKey]: Number(value) }
    timing_plans[plan] = { ...planData, splits }
    update({ timing_plans })
  }

  function updateDetector(direction, field, value) {
    const approach = getApproach(direction)
    const detector = { ...(approach.detector || {}), [field]: value }
    updateApproach(direction, { detector })
  }

  function handleTypeChange(newType) {
    const dirs = getActiveDirections(newType)
    // Ensure all needed approaches exist
    const existingApproaches = ix.approaches || []
    const updatedApproaches = dirs.map((dir) => {
      const existing = existingApproaches.find((a) => a.direction === dir)
      return existing || makeDefaultApproach(dir)
    })
    update({ type: newType, approaches: updatedApproaches })
  }

  const activeDirections = getActiveDirections(ix.type)
  const activePhaseKeys = Object.entries(ix.nema_phases || {})
    .filter(([, p]) => p.active)
    .map(([k]) => k)
    .sort((a, b) => Number(a) - Number(b))

  function splitTotal(plan) {
    const splits = ix.timing_plans?.[plan]?.splits || {}
    return activePhaseKeys.reduce((sum, k) => sum + (Number(splits[k]) || 0), 0)
  }

  // Navigate between intersections
  function navigateTo(newIx) {
    setSelectedIntersection(newIx.id)
    setActiveTab('Geometry')
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Breadcrumb / Top Bar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveView('corridor')}
          className="text-gray-400 hover:text-gray-200 text-sm flex items-center gap-1 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Corridor
        </button>
        <span className="text-gray-600">/</span>
        <span className="text-white font-medium text-sm">{ix.name}</span>

        {/* Intersection picker */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => ixIndex > 0 && navigateTo(intersections[ixIndex - 1])}
            disabled={ixIndex === 0}
            className="btn-ghost text-xs py-1 px-2 disabled:opacity-30"
            title="Previous intersection"
          >
            ← Prev
          </button>
          <select
            className="select-field text-xs py-1 w-48"
            value={ix.id}
            onChange={(e) => {
              const found = intersections.find((i) => String(i.id) === e.target.value)
              if (found) navigateTo(found)
            }}
          >
            {intersections.map((i) => (
              <option key={i.id} value={i.id}>{i.name || `Intersection ${i.id}`}</option>
            ))}
          </select>
          <button
            onClick={() => ixIndex < intersections.length - 1 && navigateTo(intersections[ixIndex + 1])}
            disabled={ixIndex === intersections.length - 1}
            className="btn-ghost text-xs py-1 px-2 disabled:opacity-30"
            title="Next intersection"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150 ${
              activeTab === tab
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Geometry */}
      {activeTab === 'Geometry' && (
        <div className="space-y-4">
          {/* Intersection type + basic info */}
          <div className="card">
            <h3 className="section-header">Intersection Properties</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label block mb-1.5">Intersection Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={ix.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </div>
              <div>
                <label className="label block mb-1.5">Intersection Type</label>
                <select
                  className="select-field"
                  value={ix.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                >
                  <option value="2-leg">2-leg (Mid-block/Driveway)</option>
                  <option value="3-leg">3-leg (T-intersection)</option>
                  <option value="4-leg">4-leg (Full intersection)</option>
                </select>
              </div>
              <div>
                <label className="label block mb-1.5">Distance from Previous (ft)</label>
                <input
                  type="number"
                  className="input-field"
                  value={ix.distance_from_prev_ft || 0}
                  onChange={(e) => update({ distance_from_prev_ft: Number(e.target.value) })}
                  min={0}
                  step={50}
                />
              </div>
            </div>
          </div>

          {/* Per-approach lane config */}
          {activeDirections.map((dir) => {
            const approach = getApproach(dir)
            return (
              <div key={dir} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="section-header mb-0">
                    {dir} Approach
                  </h3>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <label className="label">HV%</label>
                      <input
                        type="number"
                        className="input-field text-xs w-16"
                        value={approach.heavy_vehicle_pct ?? 2}
                        onChange={(e) =>
                          updateApproach(dir, { heavy_vehicle_pct: Number(e.target.value) })
                        }
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="label">PHF</label>
                      <input
                        type="number"
                        className="input-field text-xs w-16"
                        value={approach.phf ?? 0.95}
                        onChange={(e) =>
                          updateApproach(dir, { phf: Number(e.target.value) })
                        }
                        min={0.01}
                        max={1.0}
                        step={0.01}
                      />
                    </div>
                  </div>
                </div>

                {/* Lane table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-1.5 text-xs text-gray-500 uppercase tracking-wider w-8">#</th>
                        <th className="text-left px-2 py-1.5 text-xs text-gray-500 uppercase tracking-wider">Movement</th>
                        <th className="text-left px-2 py-1.5 text-xs text-gray-500 uppercase tracking-wider">Width (ft)</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {(approach.lanes || []).map((lane, laneIdx) => (
                        <tr key={laneIdx} className="border-t border-gray-700">
                          <td className="px-2 py-1.5 text-gray-500 text-xs">{laneIdx + 1}</td>
                          <td className="px-2 py-1.5">
                            <select
                              className="select-field text-xs py-1"
                              value={lane.movement}
                              onChange={(e) => updateLane(dir, laneIdx, { movement: e.target.value })}
                            >
                              {MOVEMENTS.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              className="input-field text-xs py-1 w-20"
                              value={lane.width_ft}
                              onChange={(e) => updateLane(dir, laneIdx, { width_ft: Number(e.target.value) })}
                              min={9}
                              max={20}
                              step={0.5}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => removeLane(dir, laneIdx)}
                              disabled={(approach.lanes || []).length <= 1}
                              className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
                              title="Remove lane"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    onClick={() => addLane(dir)}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors px-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Lane
                  </button>
                </div>

                {/* Turn bay lengths */}
                <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center gap-6">
                  <span className="label">Turn Bay Lengths</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">L:</span>
                    <input
                      type="number"
                      className="input-field text-xs py-1 w-20"
                      value={approach.turn_bay_lengths?.L ?? ''}
                      onChange={(e) =>
                        updateApproach(dir, {
                          turn_bay_lengths: {
                            ...approach.turn_bay_lengths,
                            L: e.target.value === '' ? null : Number(e.target.value),
                          },
                        })
                      }
                      placeholder="—"
                      min={0}
                    />
                    <span className="text-xs text-gray-500">ft</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">R:</span>
                    <input
                      type="number"
                      className="input-field text-xs py-1 w-20"
                      value={approach.turn_bay_lengths?.R ?? ''}
                      onChange={(e) =>
                        updateApproach(dir, {
                          turn_bay_lengths: {
                            ...approach.turn_bay_lengths,
                            R: e.target.value === '' ? null : Number(e.target.value),
                          },
                        })
                      }
                      placeholder="—"
                      min={0}
                    />
                    <span className="text-xs text-gray-500">ft</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Phasing */}
      {activeTab === 'Phasing' && (
        <div className="space-y-4">
          {/* NEMA Diagram */}
          <div className="card">
            <h3 className="section-header">NEMA Ring-Barrier Structure</h3>
            <NEMADiagram phases={ix.nema_phases || {}} />
            <p className="text-xs text-gray-500 mt-2">
              Click phase boxes below to toggle active state. The diagram updates in real time.
            </p>
          </div>

          {/* Phase parameters table */}
          <div className="card">
            <h3 className="section-header">Phase Parameters</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-2 text-xs text-gray-500 uppercase tracking-wider">Phase</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Active</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Min Green</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Max Green</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Yellow</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">All-Red</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Recall</th>
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5,6,7,8].map((num) => {
                    const key = String(num)
                    const phase = ix.nema_phases?.[key] || {}
                    const isActive = phase.active !== false
                    return (
                      <tr key={key} className={`border-t border-gray-700 ${!isActive ? 'opacity-40' : ''}`}>
                        <td className="px-2 py-2">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            isActive ? 'bg-blue-900 text-blue-300 border border-blue-700' : 'bg-gray-800 text-gray-600 border border-gray-700'
                          }`}>
                            {num}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => updatePhase(key, { active: e.target.checked })}
                            className="w-4 h-4 rounded accent-blue-500"
                          />
                        </td>
                        {['min_green', 'max_green', 'yellow', 'all_red'].map((field) => (
                          <td key={field} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              className="input-field text-xs py-1 w-16 text-center mx-auto"
                              value={phase[field] ?? 0}
                              disabled={!isActive}
                              onChange={(e) => updatePhase(key, { [field]: Number(e.target.value) })}
                              min={0}
                              max={field === 'yellow' || field === 'all_red' ? 10 : 200}
                              step={1}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center">
                          <select
                            className="select-field text-xs py-1 w-20 mx-auto"
                            value={phase.recall || 'None'}
                            disabled={!isActive}
                            onChange={(e) => updatePhase(key, { recall: e.target.value })}
                          >
                            {RECALL_MODES.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overlaps */}
          <div className="card">
            <h3 className="section-header">Overlap Phases</h3>
            <p className="text-xs text-gray-500">
              Define overlap phases (NEMA standard overlaps A–D or custom).
              Overlap configuration is optional for Phase 1.
            </p>
            <div className="mt-3 space-y-2">
              {(ix.overlaps || []).length === 0 && (
                <p className="text-gray-600 text-xs italic">No overlap phases defined.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Timing */}
      {activeTab === 'Timing' && (
        <div className="space-y-4">
          {/* Plan sub-tabs */}
          <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit">
            {PLANS.map((plan) => (
              <button
                key={plan}
                onClick={() => setTimingPlan(plan)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 ${
                  timingPlan === plan ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {plan}
              </button>
            ))}
          </div>

          {/* Plan settings */}
          <div className="card">
            <div className="flex items-center gap-6 mb-4">
              <div>
                <label className="label block mb-1.5">Cycle Length (s)</label>
                <input
                  type="number"
                  className="input-field w-28"
                  value={ix.timing_plans?.[timingPlan]?.cycle || 120}
                  onChange={(e) => updateTiming(timingPlan, { cycle: Number(e.target.value) })}
                  min={30}
                  max={300}
                  step={5}
                />
              </div>
              <div>
                <label className="label block mb-1.5">Offset (s)</label>
                <input
                  type="number"
                  className="input-field w-28"
                  value={ix.timing_plans?.[timingPlan]?.offset || 0}
                  onChange={(e) => updateTiming(timingPlan, { offset: Number(e.target.value) })}
                  min={0}
                  max={300}
                  step={1}
                />
              </div>
            </div>

            {/* Splits table */}
            <h4 className="label mb-2">Phase Splits</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-2 text-xs text-gray-500 uppercase tracking-wider">Phase</th>
                    <th className="text-left px-2 py-2 text-xs text-gray-500 uppercase tracking-wider">Split (s)</th>
                    <th className="text-left px-2 py-2 text-xs text-gray-500 uppercase tracking-wider">Effective Green (s)</th>
                    <th className="text-left px-2 py-2 text-xs text-gray-500 uppercase tracking-wider">% of Cycle</th>
                  </tr>
                </thead>
                <tbody>
                  {activePhaseKeys.map((key) => {
                    const split = ix.timing_plans?.[timingPlan]?.splits?.[key] || 0
                    const phase = ix.nema_phases?.[key] || {}
                    const yellow = phase.yellow || 4
                    const allRed = phase.all_red || 1
                    const effGreen = Math.max(0, split - yellow - allRed)
                    const cycle = ix.timing_plans?.[timingPlan]?.cycle || 120
                    const pct = cycle > 0 ? ((split / cycle) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={key} className="border-t border-gray-700">
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-blue-900 text-blue-300 border border-blue-700">
                            {key}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            className="input-field text-xs py-1 w-20"
                            value={split}
                            onChange={(e) => updateSplit(timingPlan, key, e.target.value)}
                            min={0}
                            max={ix.timing_plans?.[timingPlan]?.cycle || 300}
                            step={1}
                          />
                        </td>
                        <td className="px-2 py-2 text-gray-400 text-xs">{effGreen}s</td>
                        <td className="px-2 py-2 text-gray-400 text-xs">{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Running total validation */}
            {(() => {
              const total = splitTotal(timingPlan)
              const cycle = ix.timing_plans?.[timingPlan]?.cycle || 120
              const diff = total - cycle
              const isValid = Math.abs(diff) < 1
              return (
                <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                  isValid ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isValid ? 'bg-green-400' : 'bg-red-400'}`} />
                  Splits total: {total}s / {cycle}s cycle
                  {!isValid && (
                    <span className="ml-2 font-medium">
                      ({diff > 0 ? '+' : ''}{diff}s {diff > 0 ? 'over' : 'short'})
                    </span>
                  )}
                  {isValid && <span className="ml-1 font-medium">✓ Valid</span>}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Tab: Detectors */}
      {activeTab === 'Detectors' && (
        <div className="card">
          <h3 className="section-header">Detector Configuration</h3>
          <p className="text-xs text-gray-500 mb-4">
            Configure stop bar and advance detectors for each approach.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 uppercase tracking-wider">Approach</th>
                  <th className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Stop Bar</th>
                  <th className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Advance Detector</th>
                </tr>
              </thead>
              <tbody>
                {activeDirections.map((dir) => {
                  const approach = getApproach(dir)
                  const det = approach.detector || {}
                  return (
                    <tr key={dir} className="border-t border-gray-700">
                      <td className="px-3 py-3">
                        <span className="font-medium text-gray-200">{dir}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          ({(approach.lanes || []).length} lane{(approach.lanes || []).length !== 1 ? 's' : ''})
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={det.stop_bar !== false}
                          onChange={(e) => updateDetector(dir, 'stop_bar', e.target.checked)}
                          className="w-4 h-4 rounded accent-blue-500"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!det.advance}
                          onChange={(e) => updateDetector(dir, 'advance', e.target.checked)}
                          className="w-4 h-4 rounded accent-blue-500"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: NTCIP Import */}
      {activeTab === 'NTCIP Import' && (
        <div className="card">
          <h3 className="section-header">NTCIP Controller Database Import</h3>
          <div className="mt-4 border-2 border-dashed border-gray-600 rounded-xl p-10 text-center">
            <div className="w-14 h-14 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h4 className="text-gray-300 font-semibold text-base mb-2">
              NTCIP Import — Coming in Phase 5
            </h4>
            <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
              NTCIP controller database import (Econolite ASC/3, Intelight, and generic NTCIP CSV/MDB formats)
              will be implemented in Phase 5. Imported values will automatically populate all phasing,
              timing, detector, and overlap fields.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-900/30 border border-yellow-800/50 text-yellow-400 text-xs">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Phase 5 Feature
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
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
          onClick={() => setActiveView('demand')}
          className="btn-primary flex items-center gap-2"
        >
          Next: Demand Input
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
