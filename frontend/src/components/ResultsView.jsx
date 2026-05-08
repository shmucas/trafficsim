import React, { useState } from 'react'
import useProjectStore from '../store/projectStore'
import TSDCanvas from './TSDCanvas'

function downloadPDF(projectId) {
  window.open(`/api/projects/${projectId}/report`, '_blank')
}

const LOS_COLORS = {
  A: '#16A34A', B: '#16A34A',
  C: '#CA8A04', D: '#D97706',
  E: '#EA580C', F: '#DC2626',
}

const LOS_BG = {
  A: { bg: '#DCFCE7', text: '#166534' },
  B: { bg: '#DCFCE7', text: '#166534' },
  C: { bg: '#FEF9C3', text: '#854D0E' },
  D: { bg: '#FEF3C7', text: '#92400E' },
  E: { bg: '#FFEDD5', text: '#9A3412' },
  F: { bg: '#FEE2E2', text: '#991B1B' },
}

function LOSBadge({ los }) {
  const colors = LOS_BG[los] || { bg: '#F8F8F7', text: '#888888' }
  return (
    <span
      className="inline-block px-1.5 py-0 text-[11px] font-bold"
      style={{ backgroundColor: colors.bg, color: colors.text, borderRadius: 2 }}
    >
      {los}
    </span>
  )
}

function VCBadge({ vc }) {
  const color = vc >= 1.0 ? '#DC2626' : vc >= 0.85 ? '#EA580C' : '#444444'
  return <span className="font-mono text-[11px]" style={{ color }}>{vc.toFixed(3)}</span>
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
      <div className="max-w-4xl mx-auto p-4">
        <div className="card text-center py-12">
          <div
            className="w-12 h-12 flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: '#F8F8F7', border: '1px solid #E2E2E0', borderRadius: 4 }}
          >
            <svg className="w-6 h-6" style={{ color: '#AAAAAA' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: '#111111' }}>No results yet</h3>
          <p className="text-xs mb-4" style={{ color: '#888888' }}>Run the simulation first to see HCM 7th Edition results.</p>
          <button onClick={() => setActiveView('simulation')} className="btn-primary mx-auto">
            Go to Simulation
          </button>
        </div>
      </div>
    )
  }

  const { corridor_summary, intersections } = results

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
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: '#111111' }}>Results</h2>
          <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
            {currentProject.name} — {results.active_plan} plan · HCM 7th Edition
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runSimulation()}
            disabled={isSimulating}
            className="btn-secondary gap-1.5"
          >
            {isSimulating ? 'Running…' : `Re-run ${activePlan}`}
          </button>
          <button
            onClick={() => downloadPDF(currentProject.id)}
            className="btn-primary gap-1.5"
            title="Download PDF report"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* Corridor stat bar */}
      <div
        className="flex items-stretch mb-4 overflow-hidden"
        style={{ border: '1px solid #E2E2E0', borderRadius: 4 }}
      >
        <div className="flex-1 px-4 py-2.5" style={{ borderRight: '1px solid #E2E2E0' }}>
          <div className="label mb-0.5">Corridor Delay</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold" style={{ color: '#111111' }}>{corridor_summary.avg_delay_s_veh}</span>
            <span className="text-[11px]" style={{ color: '#888888' }}>s/veh</span>
          </div>
        </div>
        <div className="flex-1 px-4 py-2.5" style={{ borderRight: '1px solid #E2E2E0' }}>
          <div className="label mb-0.5">Corridor LOS</div>
          <div className="text-2xl font-bold" style={{ color: LOS_COLORS[corridor_summary.corridor_los] || '#111111' }}>
            {corridor_summary.corridor_los}
          </div>
        </div>
        <div className="flex-1 px-4 py-2.5" style={{ borderRight: '1px solid #E2E2E0' }}>
          <div className="label mb-0.5">Total Throughput</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold" style={{ color: '#111111' }}>{corridor_summary.total_throughput_vph.toLocaleString()}</span>
            <span className="text-[11px]" style={{ color: '#888888' }}>vph</span>
          </div>
        </div>
        <div className="flex-1 px-4 py-2.5">
          <div className="label mb-0.5">Intersections</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold" style={{ color: '#111111' }}>{corridor_summary.intersections_analyzed}</span>
            <span className="text-[11px]" style={{ color: '#888888' }}>analyzed</span>
          </div>
        </div>
      </div>

      {/* Time-Space Diagram */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-header mb-0">Time-Space Diagram</h3>
          <span
            className="text-[11px] px-2 py-0.5"
            style={{ color: '#888888', backgroundColor: '#F8F8F7', border: '1px solid #E2E2E0', borderRadius: 3 }}
          >
            Phase 3
          </span>
        </div>
        <TSDCanvas
          intersections={currentProject.intersections || []}
          activePlan={activePlan}
          corridorSpeedMph={currentProject.corridor_speed_mph || 35}
        />
      </div>

      {/* Intersection-level summary */}
      <div className="card mb-4">
        <h3 className="section-header">Intersection Summary</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Intersection</th>
                <th>Type</th>
                <th className="text-center">Plan</th>
                <th className="text-right">Cycle (s)</th>
                <th className="text-right">Delay (s/veh)</th>
                <th className="text-center">LOS</th>
              </tr>
            </thead>
            <tbody>
              {intersections.map((ix) => (
                <tr key={ix.id}>
                  <td className="font-medium" style={{ color: '#111111' }}>{ix.name}</td>
                  <td style={{ color: '#888888' }}>{ix.type}</td>
                  <td className="text-center">
                    <span
                      className="px-1.5 py-0 text-[11px]"
                      style={{ backgroundColor: '#F8F8F7', border: '1px solid #E2E2E0', color: '#444444', borderRadius: 3 }}
                    >
                      {ix.active_plan}
                    </span>
                  </td>
                  <td className="text-right font-mono" style={{ color: '#444444' }}>{ix.cycle}</td>
                  <td className="text-right font-mono font-semibold" style={{ color: '#111111' }}>{ix.intersection_delay_s_veh}</td>
                  <td className="text-center"><LOSBadge los={ix.intersection_los} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabbed detail tables */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-0.5">
            {[
              { key: 'delay', label: 'Delay & LOS' },
              { key: 'queue', label: 'Queue Length' },
              { key: 'throughput', label: 'Throughput' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-3 py-1 text-[12px] font-medium transition-colors"
                style={{
                  borderRadius: 3,
                  backgroundColor: activeTab === tab.key ? '#111111' : 'transparent',
                  color: activeTab === tab.key ? '#FFFFFF' : '#888888',
                }}
                onMouseEnter={(e) => { if (activeTab !== tab.key) e.currentTarget.style.backgroundColor = '#F8F8F7' }}
                onMouseLeave={(e) => { if (activeTab !== tab.key) e.currentTarget.style.backgroundColor = 'transparent' }}
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
            className="btn-secondary gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <th className="text-right">Vol</th>
                  <th className="text-right">Cap</th>
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
                            className="font-medium align-top pt-2"
                            style={{ color: '#111111', borderLeft: '3px solid #111111' }}
                          >
                            {ix.name}
                          </td>
                        ) : null}
                        {mvi === 0 ? (
                          <td
                            rowSpan={ap.movements.length}
                            className="font-medium align-top pt-2"
                            style={{ color: '#444444' }}
                          >
                            {ap.direction}
                          </td>
                        ) : null}
                        <td className="font-mono" style={{ color: '#444444' }}>{mv.movement}</td>
                        <td className="text-center font-mono" style={{ color: '#AAAAAA' }}>{mv.phase}</td>
                        <td className="text-right font-mono" style={{ color: '#444444' }}>{mv.volume_vph}</td>
                        <td className="text-right font-mono" style={{ color: '#AAAAAA' }}>{mv.capacity_vph}</td>
                        <td className="text-right"><VCBadge vc={mv.vc_ratio} /></td>
                        <td className="text-right font-mono" style={{ color: '#AAAAAA' }}>{mv.effective_green_s}</td>
                        <td className="text-right font-mono font-semibold" style={{ color: '#111111' }}>{mv.delay_s_veh}</td>
                        <td className="text-center"><LOSBadge los={mv.los} /></td>
                      </tr>
                    ))
                  )
                )}
                {intersections.map((ix) =>
                  ix.approaches.map((ap) => (
                    <tr key={`sub-${ix.id}-${ap.direction}`} style={{ backgroundColor: '#FAFAF9' }}>
                      <td className="text-[11px] italic pl-3" colSpan={2} style={{ color: '#AAAAAA' }}>
                        {ap.direction} approach total
                      </td>
                      <td colSpan={6} />
                      <td className="text-right font-mono font-semibold text-[11px]" style={{ color: '#444444' }}>
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
                    <td className="font-medium" style={{ color: '#111111' }}>{r.intersection}</td>
                    <td className="font-medium" style={{ color: '#444444' }}>{r.approach}</td>
                    <td className="font-mono" style={{ color: '#444444' }}>{r.movement}</td>
                    <td className="text-right font-mono" style={{ color: '#444444' }}>{r.volume_vph}</td>
                    <td className="text-right"><VCBadge vc={r.vc_ratio} /></td>
                    <td className="text-right font-mono font-semibold" style={{ color: '#111111' }}>{r.queue_95th_veh}</td>
                    <td className="text-right font-mono" style={{ color: '#111111' }}>{r.queue_95th_ft}</td>
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
                  const utilColor = util >= 1 ? '#DC2626' : util >= 0.85 ? '#D97706' : '#888888'
                  const barColor = util >= 1 ? '#DC2626' : util >= 0.85 ? '#D97706' : '#16A34A'
                  return (
                    <tr key={i}>
                      <td className="font-medium" style={{ color: '#111111' }}>{r.intersection}</td>
                      <td className="font-medium" style={{ color: '#444444' }}>{r.approach}</td>
                      <td className="font-mono" style={{ color: '#444444' }}>{r.movement}</td>
                      <td className="text-right font-mono" style={{ color: '#444444' }}>{r.volume_vph}</td>
                      <td className="text-right font-mono" style={{ color: '#AAAAAA' }}>{r.capacity_vph}</td>
                      <td className="text-right font-mono font-semibold" style={{ color: '#111111' }}>{r.throughput_vph}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 h-1.5 overflow-hidden" style={{ borderRadius: 2, backgroundColor: '#E2E2E0' }}>
                            <div
                              style={{ width: `${Math.min(100, util * 100).toFixed(0)}%`, height: '100%', borderRadius: 2, backgroundColor: barColor }}
                            />
                          </div>
                          <span className="text-[11px] font-mono" style={{ color: utilColor }}>
                            {(util * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ backgroundColor: '#F8F8F7', borderTop: '2px solid #E2E2E0' }}>
                  <td colSpan={5} className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#444444' }}>
                    Corridor Total
                  </td>
                  <td className="text-right font-mono font-bold" style={{ color: '#111111' }}>
                    {corridor_summary.total_throughput_vph.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid #E2E2E0' }}>
        <button onClick={() => setActiveView('simulation')} className="btn-secondary gap-2">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Simulation
        </button>
      </div>
    </div>
  )
}
