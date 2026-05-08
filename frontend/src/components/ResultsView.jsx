import React, { useState } from 'react'
import useProjectStore from '../store/projectStore'
import TSDCanvas from './TSDCanvas'

function downloadPDF(projectId) {
  window.open(`/api/projects/${projectId}/report`, '_blank')
}

const LOS_COLORS = {
  A: 'text-green-400', B: 'text-green-400',
  C: 'text-yellow-400', D: 'text-yellow-500',
  E: 'text-orange-400', F: 'text-red-400',
}

const LOS_BG = {
  A: 'bg-green-900/30 text-green-300',
  B: 'bg-green-900/20 text-green-400',
  C: 'bg-yellow-900/30 text-yellow-300',
  D: 'bg-yellow-900/40 text-yellow-300',
  E: 'bg-orange-900/30 text-orange-300',
  F: 'bg-red-900/30 text-red-300',
}

function LOSBadge({ los }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${LOS_BG[los] || 'bg-gray-700 text-gray-300'}`}>
      {los}
    </span>
  )
}

function VCBadge({ vc }) {
  const color = vc >= 1.0 ? 'text-red-400' : vc >= 0.85 ? 'text-orange-400' : 'text-gray-300'
  return <span className={`font-mono text-xs ${color}`}>{vc.toFixed(3)}</span>
}

function exportCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => r[h]).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

export default function ResultsView() {
  const { currentProject, setActiveView, activePlan, runSimulation, isSimulating } = useProjectStore()
  const [activeTab, setActiveTab] = useState('delay')

  if (!currentProject) return null

  const results = currentProject.simulation_results

  if (!results || results.status !== 'complete') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-gray-800 border border-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">No results yet</h3>
          <p className="text-gray-400 text-sm mb-6">Run the simulation first to see HCM 7th Edition results.</p>
          <button onClick={() => setActiveView('simulation')} className="btn-primary">
            Go to Simulation
          </button>
        </div>
      </div>
    )
  }

  const { corridor_summary, intersections } = results

  // Flatten all movements for tables
  const allRows = []
  for (const ix of intersections) {
    for (const ap of ix.approaches) {
      for (const mv of ap.movements) {
        allRows.push({
          intersection: ix.name,
          approach: ap.direction,
          movement: mv.movement,
          lanes: mv.lanes,
          phase: mv.phase,
          volume_vph: mv.volume_vph,
          capacity_vph: mv.capacity_vph,
          vc_ratio: mv.vc_ratio,
          eff_green_s: mv.effective_green_s,
          sat_flow: mv.saturation_flow,
          delay_s_veh: mv.delay_s_veh,
          queue_95th_veh: mv.queue_95th_veh,
          queue_95th_ft: mv.queue_95th_ft,
          throughput_vph: mv.throughput_vph,
          los: mv.los,
        })
      }
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Results</h2>
          <p className="text-gray-400 text-sm mt-1">
            {currentProject.name} — {results.active_plan} plan · HCM 7th Edition
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runSimulation()}
            disabled={isSimulating}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            {isSimulating ? 'Running…' : `Re-run ${activePlan}`}
          </button>
          <button
            onClick={() => downloadPDF(currentProject.id)}
            className="btn-primary text-xs flex items-center gap-1.5"
            title="Download PDF report"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* Corridor summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <div className="label mb-1">Corridor Delay</div>
          <div className="text-2xl font-bold text-white">{corridor_summary.avg_delay_s_veh}</div>
          <div className="text-xs text-gray-500 mt-0.5">s/veh</div>
        </div>
        <div className="card text-center">
          <div className="label mb-1">Corridor LOS</div>
          <div className={`text-3xl font-bold ${LOS_COLORS[corridor_summary.corridor_los] || 'text-white'}`}>
            {corridor_summary.corridor_los}
          </div>
        </div>
        <div className="card text-center">
          <div className="label mb-1">Total Throughput</div>
          <div className="text-2xl font-bold text-white">{corridor_summary.total_throughput_vph.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-0.5">vph</div>
        </div>
        <div className="card text-center">
          <div className="label mb-1">Intersections</div>
          <div className="text-2xl font-bold text-white">{corridor_summary.intersections_analyzed}</div>
          <div className="text-xs text-gray-500 mt-0.5">analyzed</div>
        </div>
      </div>

      {/* Time-Space Diagram — primary Phase 3 deliverable */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-header mb-0">Time-Space Diagram</h3>
          <span className="text-xs text-blue-400 bg-blue-900/30 border border-blue-800 px-2 py-1 rounded">
            Phase 3
          </span>
        </div>
        <TSDCanvas
          intersections={currentProject.intersections || []}
          activePlan={activePlan}
          corridorSpeedMph={currentProject.corridor_speed_mph || 35}
        />
      </div>

      {/* Intersection-level summary row */}
      <div className="card mb-6">
        <h3 className="section-header">Intersection Summary</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Intersection</th>
                <th>Type</th>
                <th className="text-center">Plan</th>
                <th className="text-right">Cycle (s)</th>
                <th className="text-right">Int. Delay (s/veh)</th>
                <th className="text-center">Int. LOS</th>
              </tr>
            </thead>
            <tbody>
              {intersections.map((ix) => (
                <tr key={ix.id}>
                  <td className="font-medium text-gray-100">{ix.name}</td>
                  <td className="text-gray-400">{ix.type}</td>
                  <td className="text-center">
                    <span className="px-2 py-0.5 bg-blue-900/40 border border-blue-800 text-blue-300 rounded text-xs">
                      {ix.active_plan}
                    </span>
                  </td>
                  <td className="text-right font-mono text-gray-300">{ix.cycle}</td>
                  <td className="text-right font-mono text-gray-200">{ix.intersection_delay_s_veh}</td>
                  <td className="text-center"><LOSBadge los={ix.intersection_los} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabbed detail tables */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {[
              { key: 'delay', label: 'Delay & LOS' },
              { key: 'queue', label: 'Queue Length' },
              { key: 'throughput', label: 'Throughput' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.key ? 'tab-active' : 'tab-inactive'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const filename = `${currentProject.name.replace(/\s+/g, '_')}_${activeTab}.csv`
              const rows = allRows.map((r) => {
                if (activeTab === 'delay') return {
                  Intersection: r.intersection, Approach: r.approach, Movement: r.movement,
                  'Volume (vph)': r.volume_vph, 'Capacity (vph)': r.capacity_vph,
                  'v/c': r.vc_ratio, 'Eff Green (s)': r.eff_green_s,
                  'Delay (s/veh)': r.delay_s_veh, LOS: r.los,
                }
                if (activeTab === 'queue') return {
                  Intersection: r.intersection, Approach: r.approach, Movement: r.movement,
                  'Q95 (veh)': r.queue_95th_veh, 'Q95 (ft)': r.queue_95th_ft,
                }
                return {
                  Intersection: r.intersection, Approach: r.approach, Movement: r.movement,
                  'Volume (vph)': r.volume_vph, 'Throughput (vph)': r.throughput_vph,
                  'Capacity (vph)': r.capacity_vph,
                }
              })
              exportCSV(rows, filename)
            }}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          {/* Delay & LOS tab */}
          {activeTab === 'delay' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intersection</th>
                  <th>Dir</th>
                  <th>Mvmt</th>
                  <th className="text-center">Ph</th>
                  <th className="text-right">Vol (vph)</th>
                  <th className="text-right">Cap (vph)</th>
                  <th className="text-right">v/c</th>
                  <th className="text-right">g (s)</th>
                  <th className="text-right">Delay (s/veh)</th>
                  <th className="text-center">LOS</th>
                </tr>
              </thead>
              <tbody>
                {intersections.map((ix) =>
                  ix.approaches.map((ap) =>
                    ap.movements.map((mv, mvi) => (
                      <tr key={`${ix.id}-${ap.direction}-${mv.movement}`}>
                        {mvi === 0 && ap === ix.approaches[0] ? (
                          <td
                            rowSpan={ix.approaches.reduce((s, a) => s + a.movements.length, 0)}
                            className="font-medium text-gray-100 align-top pt-2.5 border-l-2 border-blue-700"
                          >
                            {ix.name}
                          </td>
                        ) : null}
                        {mvi === 0 ? (
                          <td
                            rowSpan={ap.movements.length}
                            className="text-blue-300 font-medium align-top pt-2.5"
                          >
                            {ap.direction}
                          </td>
                        ) : null}
                        <td className="font-mono text-gray-300">{mv.movement}</td>
                        <td className="text-center text-gray-500 font-mono text-xs">{mv.phase}</td>
                        <td className="text-right font-mono text-gray-300">{mv.volume_vph}</td>
                        <td className="text-right font-mono text-gray-400">{mv.capacity_vph}</td>
                        <td className="text-right"><VCBadge vc={mv.vc_ratio} /></td>
                        <td className="text-right font-mono text-gray-400">{mv.effective_green_s}</td>
                        <td className="text-right font-mono text-gray-200 font-semibold">{mv.delay_s_veh}</td>
                        <td className="text-center"><LOSBadge los={mv.los} /></td>
                      </tr>
                    ))
                  )
                )}
                {/* Approach subtotals */}
                {intersections.map((ix) =>
                  ix.approaches.map((ap) => (
                    <tr key={`sub-${ix.id}-${ap.direction}`} className="bg-gray-900/60">
                      <td className="text-xs text-gray-500 italic pl-4" colSpan={2}>
                        {ap.direction} approach total
                      </td>
                      <td colSpan={6} />
                      <td className="text-right font-mono text-gray-300 font-semibold text-xs">
                        {ap.approach_delay_s_veh} s/veh
                      </td>
                      <td className="text-center"><LOSBadge los={ap.approach_los} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Queue Length tab */}
          {activeTab === 'queue' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intersection</th>
                  <th>Dir</th>
                  <th>Mvmt</th>
                  <th className="text-right">Volume (vph)</th>
                  <th className="text-right">v/c</th>
                  <th className="text-right">Q95 (veh)</th>
                  <th className="text-right">Q95 (ft)</th>
                  <th className="text-center">LOS</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium text-gray-100">{r.intersection}</td>
                    <td className="text-blue-300 font-medium">{r.approach}</td>
                    <td className="font-mono text-gray-300">{r.movement}</td>
                    <td className="text-right font-mono text-gray-300">{r.volume_vph}</td>
                    <td className="text-right"><VCBadge vc={r.vc_ratio} /></td>
                    <td className="text-right font-mono text-gray-200 font-semibold">{r.queue_95th_veh}</td>
                    <td className="text-right font-mono text-gray-200">{r.queue_95th_ft}</td>
                    <td className="text-center"><LOSBadge los={r.los} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Throughput tab */}
          {activeTab === 'throughput' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intersection</th>
                  <th>Dir</th>
                  <th>Mvmt</th>
                  <th className="text-right">Volume (vph)</th>
                  <th className="text-right">Capacity (vph)</th>
                  <th className="text-right">Throughput (vph)</th>
                  <th className="text-right">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((r, i) => {
                  const util = r.capacity_vph > 0
                    ? Math.min(1, r.throughput_vph / r.capacity_vph)
                    : 0
                  return (
                    <tr key={i}>
                      <td className="font-medium text-gray-100">{r.intersection}</td>
                      <td className="text-blue-300 font-medium">{r.approach}</td>
                      <td className="font-mono text-gray-300">{r.movement}</td>
                      <td className="text-right font-mono text-gray-300">{r.volume_vph}</td>
                      <td className="text-right font-mono text-gray-400">{r.capacity_vph}</td>
                      <td className="text-right font-mono text-gray-200 font-semibold">{r.throughput_vph}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${util >= 1 ? 'bg-red-500' : util >= 0.85 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(100, util * 100).toFixed(0)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-mono ${util >= 1 ? 'text-red-400' : util >= 0.85 ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {(util * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {/* Corridor total */}
                <tr className="bg-gray-900 border-t-2 border-gray-600">
                  <td colSpan={5} className="font-semibold text-gray-300 text-xs uppercase tracking-wider">
                    Corridor Total
                  </td>
                  <td className="text-right font-mono font-bold text-white">
                    {corridor_summary.total_throughput_vph.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
        <button onClick={() => setActiveView('simulation')} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Simulation
        </button>
      </div>
    </div>
  )
}
