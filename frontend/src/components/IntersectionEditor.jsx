import React, { useState, useRef } from 'react'
import axios from 'axios'
import useProjectStore, { makeDefaultApproach, DEFAULT_PHASE_ASSIGNMENTS } from '../store/projectStore'
import RingBarrierEditor from './RingBarrierEditor'

const TABS = ['Geometry', 'Phasing', 'Timing', 'Detectors', 'NTCIP Import']
const MOVEMENTS = ['L', 'T', 'R', 'LT', 'TR', 'LR', 'LTR']
const RECALL_MODES = ['None', 'Min', 'Max', 'Ped']
const PLANS = ['AM', 'PM', 'Off-Peak']
const DIRS = ['NB', 'SB', 'EB', 'WB']
const PHASES = [1, 2, 3, 4, 5, 6, 7, 8]

function getActiveDirections(type) {
  switch (type) {
    case '2-leg': return ['NB', 'SB']
    case '3-leg': return ['NB', 'SB', 'EB']
    default:      return ['NB', 'SB', 'EB', 'WB']
  }
}

// ── Reusable phase badge ──────────────────────────────────────────────────────
function PhaseBadge({ num, active = true }) {
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
      active
        ? 'bg-blue-900 text-blue-300 border border-blue-700'
        : 'bg-gray-800 text-gray-600 border border-gray-700'
    }`}>
      {num}
    </span>
  )
}

// ── Green-time bar ────────────────────────────────────────────────────────────
function GreenBar({ split, yellow, allRed, cycle }) {
  if (!split || !cycle) return null
  const effG = Math.max(0, split - yellow - allRed)
  const pctG = (effG / cycle) * 100
  const pctY = (yellow / cycle) * 100
  const pctR = (allRed / cycle) * 100
  return (
    <div className="flex h-3 rounded overflow-hidden w-full min-w-[80px]" title={`Green ${effG}s / Yellow ${yellow}s / All-Red ${allRed}s`}>
      <div className="bg-green-600" style={{ width: `${pctG}%` }} />
      <div className="bg-yellow-500" style={{ width: `${pctY}%` }} />
      <div className="bg-red-800"   style={{ width: `${pctR}%` }} />
      <div className="bg-gray-800 flex-1" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntersectionEditor() {
  const {
    currentProject,
    selectedIntersectionId,
    updateIntersection,
    setActiveView,
    setSelectedIntersection,
    activePlan,
  } = useProjectStore()

  const [activeTab, setActiveTab]     = useState('Geometry')
  const [timingPlan, setTimingPlan]   = useState(activePlan || 'AM')

  if (!currentProject) return null

  const intersections = currentProject.intersections || []
  const ix      = intersections.find((i) => i.id === selectedIntersectionId)
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

  function update(data) { updateIntersection(ix.id, data) }

  function getApproach(dir) {
    return ix.approaches?.find((a) => a.direction === dir) || makeDefaultApproach(dir)
  }

  function updateApproach(dir, changes) {
    const approaches = [...(ix.approaches || [])]
    const idx = approaches.findIndex((a) => a.direction === dir)
    if (idx >= 0) approaches[idx] = { ...approaches[idx], ...changes }
    else approaches.push({ ...makeDefaultApproach(dir), ...changes })
    update({ approaches })
  }

  function updateLane(dir, laneIndex, changes) {
    const ap = getApproach(dir)
    const lanes = [...(ap.lanes || [])]
    lanes[laneIndex] = { ...lanes[laneIndex], ...changes }
    updateApproach(dir, { lanes })
  }

  function addLane(dir) {
    const ap = getApproach(dir)
    updateApproach(dir, { lanes: [...(ap.lanes || []), { movement: 'T', width_ft: 12 }] })
  }

  function removeLane(dir, laneIndex) {
    const ap = getApproach(dir)
    const lanes = [...(ap.lanes || [])]
    lanes.splice(laneIndex, 1)
    updateApproach(dir, { lanes })
  }

  function updatePhase(key, changes) {
    const nema_phases = { ...(ix.nema_phases || {}) }
    nema_phases[key] = { ...(nema_phases[key] || {}), ...changes }
    update({ nema_phases })
  }

  function updatePhaseAssignment(dir, movement, phaseNum) {
    const pa = { ...(ix.phase_assignments || DEFAULT_PHASE_ASSIGNMENTS) }
    pa[dir] = { ...(pa[dir] || {}), [movement]: Number(phaseNum) }
    update({ phase_assignments: pa })
  }

  function updateTiming(plan, changes) {
    const timing_plans = { ...(ix.timing_plans || {}) }
    timing_plans[plan] = { ...(timing_plans[plan] || {}), ...changes }
    update({ timing_plans })
  }

  function updateSplit(plan, key, value) {
    const timing_plans = { ...(ix.timing_plans || {}) }
    const pd = { ...(timing_plans[plan] || {}) }
    pd.splits = { ...(pd.splits || {}), [key]: Number(value) }
    timing_plans[plan] = pd
    update({ timing_plans })
  }

  function copyPlan(fromPlan, toPlan) {
    const src = ix.timing_plans?.[fromPlan]
    if (!src) return
    const timing_plans = { ...(ix.timing_plans || {}) }
    timing_plans[toPlan] = {
      ...timing_plans[toPlan],
      splits: { ...src.splits },
      cycle: src.cycle,
      offset: src.offset,
    }
    update({ timing_plans })
  }

  function updateDetector(dir, field, value) {
    const ap = getApproach(dir)
    updateApproach(dir, { detector: { ...(ap.detector || {}), [field]: value } })
  }

  function handleTypeChange(newType) {
    const dirs = getActiveDirections(newType)
    const existing = ix.approaches || []
    const updatedApproaches = dirs.map((d) => existing.find((a) => a.direction === d) || makeDefaultApproach(d))
    update({ type: newType, approaches: updatedApproaches })
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  const activeDirections = getActiveDirections(ix.type)
  const activePhaseKeys  = PHASES
    .map(String)
    .filter((k) => ix.nema_phases?.[k]?.active !== false)

  function splitTotal(plan) {
    const splits = ix.timing_plans?.[plan]?.splits || {}
    return activePhaseKeys.reduce((s, k) => s + (Number(splits[k]) || 0), 0)
  }

  function navigateTo(newIx) {
    setSelectedIntersection(newIx.id)
    setActiveTab('Geometry')
  }

  const pa = ix.phase_assignments || DEFAULT_PHASE_ASSIGNMENTS

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto p-4">

      {/* Breadcrumb */}
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

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => ixIndex > 0 && navigateTo(intersections[ixIndex - 1])}
            disabled={ixIndex === 0}
            className="btn-ghost text-xs py-1 px-2 disabled:opacity-30"
          >← Prev</button>
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
          >Next →</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >{tab}</button>
        ))}
      </div>

      {/* ── Tab: Geometry ─────────────────────────────────────────────────── */}
      {activeTab === 'Geometry' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header">Intersection Properties</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label block mb-1.5">Intersection Name</label>
                <input
                  type="text" className="input-field"
                  value={ix.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </div>
              <div>
                <label className="label block mb-1.5">Intersection Type</label>
                <select className="select-field" value={ix.type} onChange={(e) => handleTypeChange(e.target.value)}>
                  <option value="2-leg">2-leg (Mid-block / Driveway)</option>
                  <option value="3-leg">3-leg (T-intersection)</option>
                  <option value="4-leg">4-leg (Full intersection)</option>
                </select>
              </div>
              <div>
                <label className="label block mb-1.5">Distance from Previous (ft)</label>
                <input
                  type="number" className="input-field"
                  value={ix.distance_from_prev_ft || 0}
                  onChange={(e) => update({ distance_from_prev_ft: Number(e.target.value) })}
                  min={0} step={50}
                />
              </div>
            </div>
          </div>

          {activeDirections.map((dir) => {
            const approach = getApproach(dir)
            return (
              <div key={dir} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="section-header mb-0">{dir} Approach</h3>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <label className="label">HV%</label>
                      <input
                        type="number" className="input-field text-xs w-16"
                        value={approach.heavy_vehicle_pct ?? 2}
                        onChange={(e) => updateApproach(dir, { heavy_vehicle_pct: Number(e.target.value) })}
                        min={0} max={100} step={0.5}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="label">PHF</label>
                      <input
                        type="number" className="input-field text-xs w-16"
                        value={approach.phf ?? 0.95}
                        onChange={(e) => updateApproach(dir, { phf: Number(e.target.value) })}
                        min={0.01} max={1.0} step={0.01}
                      />
                    </div>
                  </div>
                </div>

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
                      {(approach.lanes || []).map((lane, li) => (
                        <tr key={li} className="border-t border-gray-700">
                          <td className="px-2 py-1.5 text-gray-500 text-xs">{li + 1}</td>
                          <td className="px-2 py-1.5">
                            <select
                              className="select-field text-xs py-1"
                              value={lane.movement}
                              onChange={(e) => updateLane(dir, li, { movement: e.target.value })}
                            >
                              {MOVEMENTS.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number" className="input-field text-xs py-1 w-20"
                              value={lane.width_ft}
                              onChange={(e) => updateLane(dir, li, { width_ft: Number(e.target.value) })}
                              min={9} max={20} step={0.5}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => removeLane(dir, li)}
                              disabled={(approach.lanes || []).length <= 1}
                              className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
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

                <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center gap-6">
                  <span className="label">Turn Bay Lengths</span>
                  {['L', 'R'].map((mv) => (
                    <div key={mv} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{mv}:</span>
                      <input
                        type="number"
                        className="input-field text-xs py-1 w-20"
                        value={approach.turn_bay_lengths?.[mv] ?? ''}
                        onChange={(e) => updateApproach(dir, {
                          turn_bay_lengths: { ...approach.turn_bay_lengths, [mv]: e.target.value === '' ? null : Number(e.target.value) },
                        })}
                        placeholder="—" min={0}
                      />
                      <span className="text-xs text-gray-500">ft</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Phasing ──────────────────────────────────────────────────── */}
      {activeTab === 'Phasing' && (
        <RingBarrierEditor ix={ix} activePlan={activePlan} onUpdate={update} />
      )}

      {/* ── Tab: Timing ───────────────────────────────────────────────────── */}
      {activeTab === 'Timing' && (
        <div className="space-y-4">

          {/* Plan sub-tabs */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
              {PLANS.map((plan) => (
                <button
                  key={plan}
                  onClick={() => setTimingPlan(plan)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    timingPlan === plan ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >{plan}</button>
              ))}
            </div>
            {/* Copy from another plan */}
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
              <span>Copy from:</span>
              {PLANS.filter((p) => p !== timingPlan).map((src) => (
                <button
                  key={src}
                  onClick={() => copyPlan(src, timingPlan)}
                  className="btn-secondary text-xs px-2 py-1"
                  title={`Copy cycle, offset, and splits from ${src} into ${timingPlan}`}
                >{src}</button>
              ))}
            </div>
          </div>

          {/* Cycle + Offset */}
          <div className="card">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div>
                <label className="label block mb-1.5">Cycle Length (s)</label>
                <input
                  type="number" className="input-field"
                  value={ix.timing_plans?.[timingPlan]?.cycle || 120}
                  onChange={(e) => updateTiming(timingPlan, { cycle: Number(e.target.value) })}
                  min={30} max={300} step={5}
                />
                <p className="text-xs text-gray-600 mt-1">Range: 60–200 s (spec)</p>
              </div>
              <div>
                <label className="label block mb-1.5">Offset (s)</label>
                <input
                  type="number" className="input-field"
                  value={ix.timing_plans?.[timingPlan]?.offset ?? 0}
                  onChange={(e) => updateTiming(timingPlan, { offset: Number(e.target.value) })}
                  min={0} max={300} step={1}
                />
                <p className="text-xs text-gray-600 mt-1">0 to cycle length</p>
              </div>
            </div>

            {/* Splits table */}
            <h4 className="label mb-3">Phase Splits</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-2 text-xs text-gray-500 uppercase tracking-wider">Phase</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Split (s)</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Min Green (s)</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Max Green (s)</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Eff Green (s)</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">% Cycle</th>
                    <th className="px-2 py-2 text-xs text-gray-500 uppercase tracking-wider">Green Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activePhaseKeys.map((key) => {
                    const split    = Number(ix.timing_plans?.[timingPlan]?.splits?.[key] || 0)
                    const phase    = ix.nema_phases?.[key] || {}
                    const yellow   = phase.yellow   ?? 4
                    const allRed   = phase.all_red  ?? 1
                    const minG     = phase.min_green ?? 5
                    const maxG     = phase.max_green ?? 30
                    const effG     = Math.max(0, split - yellow - allRed)
                    const cycle    = ix.timing_plans?.[timingPlan]?.cycle || 120
                    const pct      = cycle > 0 ? ((split / cycle) * 100).toFixed(1) : '0.0'
                    const minViol  = split > 0 && effG < minG
                    const maxViol  = split > 0 && effG > maxG
                    return (
                      <tr key={key} className="border-t border-gray-700">
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <PhaseBadge num={key} />
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <input
                            type="number"
                            className="input-field text-xs py-1 w-20 text-center mx-auto"
                            value={split}
                            onChange={(e) => updateSplit(timingPlan, key, e.target.value)}
                            min={0}
                            max={cycle}
                            step={1}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <input
                            type="number"
                            className="input-field text-xs py-1 w-16 text-center mx-auto"
                            value={minG}
                            onChange={(e) => updatePhase(key, { min_green: Number(e.target.value) })}
                            min={1} max={120} step={1}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <input
                            type="number"
                            className="input-field text-xs py-1 w-16 text-center mx-auto"
                            value={maxG}
                            onChange={(e) => updatePhase(key, { max_green: Number(e.target.value) })}
                            min={1} max={200} step={1}
                          />
                        </td>
                        <td className={`px-2 py-2.5 text-center text-xs font-mono ${
                          minViol ? 'text-orange-400' : maxViol ? 'text-amber-400' : 'text-gray-300'
                        }`}>
                          {effG}s
                          {minViol && <span className="ml-1 text-orange-400" title="Below min green">↓</span>}
                          {maxViol && <span className="ml-1 text-amber-400" title="Exceeds max green">↑</span>}
                        </td>
                        <td className="px-2 py-2.5 text-center text-gray-400 text-xs">{pct}%</td>
                        <td className="px-2 py-2.5">
                          <GreenBar split={split} yellow={yellow} allRed={allRed} cycle={cycle} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Running total */}
            {(() => {
              const total = splitTotal(timingPlan)
              const cycle = ix.timing_plans?.[timingPlan]?.cycle || 120
              const diff  = total - cycle
              const valid = Math.abs(diff) < 1
              return (
                <div className={`mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                  valid ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${valid ? 'bg-green-400' : 'bg-red-400'}`} />
                  Splits total: <strong>{total}s</strong> / {cycle}s cycle
                  {!valid && (
                    <span className="ml-2 font-medium">
                      ({diff > 0 ? '+' : ''}{diff}s {diff > 0 ? 'over' : 'short'})
                    </span>
                  )}
                  {valid && <span className="ml-1 font-medium">✓ Valid</span>}
                </div>
              )
            })()}

            {/* Green time legend */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-green-600" /> Eff. green
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-yellow-500" /> Yellow
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-red-800" /> All-red
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-gray-800 border border-gray-700" /> Unused
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Detectors ────────────────────────────────────────────────── */}
      {activeTab === 'Detectors' && (
        <div className="card">
          <h3 className="section-header">Detector Configuration</h3>
          <p className="text-xs text-gray-500 mb-4">
            Stop bar and advance detectors per approach. Channel assignments imported from NTCIP are visible in the NTCIP Import tab.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 uppercase tracking-wider">Approach</th>
                  <th className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Stop Bar</th>
                  <th className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider text-center">Advance</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 uppercase tracking-wider">NTCIP Channels</th>
                </tr>
              </thead>
              <tbody>
                {activeDirections.map((dir) => {
                  const approach = getApproach(dir)
                  const det = approach.detector || {}
                  const ntcipChans = (ix.detectors || [])
                    .filter((d) => {
                      // match channels whose phase is in this approach's phases
                      const apPhases = Object.values(pa[dir] || {})
                      return apPhases.includes(d.phase)
                    })
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
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {ntcipChans.length > 0
                          ? ntcipChans.map((d) => `${d.channel} (${d.type === 'advance' ? 'Adv' : 'SB'})`).join(', ')
                          : <span className="italic">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: NTCIP Import ─────────────────────────────────────────────── */}
      {activeTab === 'NTCIP Import' && (
        <NTCIPImportTab intersection={ix} onApply={update} />
      )}

      {/* Bottom navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
        <button onClick={() => setActiveView('corridor')} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Corridor
        </button>
        <button onClick={() => setActiveView('demand')} className="btn-primary flex items-center gap-2">
          Next: Demand Input
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── NTCIP Import Tab ─────────────────────────────────────────────────────────

function NTCIPImportTab({ intersection, onApply }) {
  const { currentProject } = useProjectStore()
  const fileRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [result, setResult] = useState(null)
  const [applied, setApplied] = useState(false)
  const [applyScope, setApplyScope] = useState({ phases: true, timing: true, overlaps: true, detectors: true })

  async function uploadFile(file) {
    if (!file) return
    setIsUploading(true)
    setUploadError(null)
    setResult(null)
    setApplied(false)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post(
        `/api/projects/${currentProject.id}/intersections/${intersection.id}/import-ntcip`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setResult(res.data)
    } catch (err) {
      setUploadError(err.response?.data?.detail || err.message)
    } finally {
      setIsUploading(false)
    }
  }

  function handleFileInput(e) { uploadFile(e.target.files?.[0]); e.target.value = '' }
  function handleDrop(e) { e.preventDefault(); setIsDragging(false); uploadFile(e.dataTransfer.files?.[0]) }

  function handleApply() {
    if (!result?.mapped) return
    const patch = {}
    if (applyScope.phases) patch.nema_phases = result.mapped.nema_phases
    if (applyScope.timing && Object.keys(result.mapped.timing_plans).length > 0)
      patch.timing_plans = { ...intersection.timing_plans, ...result.mapped.timing_plans }
    if (applyScope.overlaps) patch.overlaps = result.mapped.overlaps
    if (applyScope.detectors) patch.detectors = result.mapped.detectors
    onApply(patch)
    setApplied(true)
  }

  const logCounts = result ? {
    info:  result.log.filter((l) => l.level === 'info').length,
    warn:  result.log.filter((l) => l.level === 'warn').length,
    error: result.log.filter((l) => l.level === 'error').length,
  } : null

  const hasData = result && (
    Object.keys(result.mapped?.nema_phases || {}).length > 0 ||
    Object.keys(result.mapped?.timing_plans || {}).length > 0
  )

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-header mb-0">NTCIP Controller Database Import</h3>
          <a href="/api/ntcip/sample-csv" download="ntcip_sample.csv"
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Sample CSV
          </a>
        </div>
        <p className="text-gray-400 text-xs mb-4">
          Supports Econolite ASC/3, Intelight, and Generic NTCIP CSV exports.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <input ref={fileRef} type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleFileInput} />
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Parsing file…</span>
            </div>
          ) : (
            <>
              <svg className="w-10 h-10 text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="text-gray-300 font-medium text-sm mb-1">Drop file here or click to browse</p>
              <p className="text-gray-500 text-xs">.csv · .txt · .json</p>
            </>
          )}
        </div>

        {uploadError && (
          <div className="mt-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-3 py-2 text-sm">
            {uploadError}
          </div>
        )}
      </div>

      {result && (
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="section-header mb-0">Import Log</h3>
            <span className="text-xs bg-gray-700 text-gray-300 rounded px-2 py-0.5">{result.format}</span>
            {logCounts.warn > 0 && (
              <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-800/50 rounded px-2 py-0.5">
                {logCounts.warn} warning{logCounts.warn !== 1 ? 's' : ''}
              </span>
            )}
            {logCounts.error > 0 && (
              <span className="text-xs bg-red-900/40 text-red-400 border border-red-800/50 rounded px-2 py-0.5">
                {logCounts.error} error{logCounts.error !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto text-xs font-mono">
            {result.log.map((entry, i) => (
              <div key={i} className={`flex gap-2 px-2 py-1 rounded ${
                entry.level === 'error' ? 'bg-red-900/30 text-red-300' :
                entry.level === 'warn'  ? 'bg-yellow-900/20 text-yellow-400' : 'text-gray-400'
              }`}>
                <span className={`shrink-0 ${
                  entry.level === 'error' ? 'text-red-500' : entry.level === 'warn' ? 'text-yellow-500' : 'text-blue-500'
                }`}>
                  {entry.level === 'error' ? '✗' : entry.level === 'warn' ? '⚠' : '✓'}
                </span>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && hasData && (
        <div className="card">
          <h3 className="section-header">Review & Apply</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { key: 'phases',    label: 'Phase Parameters', count: Object.keys(result.mapped.nema_phases || {}).length },
              { key: 'timing',    label: 'Timing Plans',     count: Object.keys(result.mapped.timing_plans || {}).length },
              { key: 'overlaps',  label: 'Overlaps',         count: (result.mapped.overlaps || []).length },
              { key: 'detectors', label: 'Detectors',        count: (result.mapped.detectors || []).length },
            ].map(({ key, label, count }) => (
              <label key={key} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                applyScope[key] ? 'bg-blue-900/30 border-blue-700 text-blue-200' : 'bg-gray-800 border-gray-700 text-gray-500'
              }`}>
                <input
                  type="checkbox"
                  checked={applyScope[key]}
                  onChange={(e) => setApplyScope((s) => ({ ...s, [key]: e.target.checked }))}
                  className="accent-blue-500"
                />
                <span className="text-xs">
                  <div className="font-medium">{label}</div>
                  <div className="text-gray-400">{count} found</div>
                </span>
              </label>
            ))}
          </div>

          {Object.keys(result.mapped.timing_plans || {}).length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-2">Timing plans to import:</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(result.mapped.timing_plans).map(([plan, pd]) => (
                  <div key={plan} className="bg-gray-900 rounded-lg px-3 py-2 text-xs">
                    <div className="text-blue-300 font-semibold mb-1">{plan}</div>
                    <div className="text-gray-400">Cycle: <span className="text-white">{pd.cycle}s</span></div>
                    <div className="text-gray-400">Offset: <span className="text-white">{pd.offset}s</span></div>
                    <div className="text-gray-400">Splits: <span className="text-white">{Object.keys(pd.splits).length} phases</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {applied ? (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800/50 rounded-lg px-4 py-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Applied. Review the Phasing and Timing tabs to verify.
            </div>
          ) : (
            <button onClick={handleApply} className="btn-primary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Apply to Intersection
            </button>
          )}
        </div>
      )}

      {result && !hasData && logCounts?.error === 0 && (
        <div className="card text-center py-6 text-gray-500 text-sm">
          No mappable data found. Check the file format or download the sample CSV.
        </div>
      )}
    </div>
  )
}
