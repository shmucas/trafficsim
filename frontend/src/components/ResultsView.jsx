import React from 'react'
import useProjectStore from '../store/projectStore'
import TSDCanvas from './TSDCanvas'

export default function ResultsView() {
  const { currentProject, setActiveView, activePlan } = useProjectStore()

  if (!currentProject) return null

  const intersections = currentProject.intersections || []

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Results</h2>
          <p className="text-gray-400 text-sm mt-1">
            Corridor analysis results — {activePlan} plan
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary text-xs flex items-center gap-1.5 opacity-50 cursor-not-allowed"
            disabled
            title="PDF export available in Phase 6"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF (Phase 6)
          </button>
        </div>
      </div>

      {/* Time-Space Diagram stub */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-header mb-0">Time-Space Diagram</h3>
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">Phase 3</span>
        </div>
        <TSDCanvas intersections={intersections} activePlan={activePlan} />
      </div>

      {/* Results placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          {
            title: 'Delay Summary',
            description: 'Control delay per movement (s/veh), LOS, and corridor average. HCM 7th Ed. Eq. 19-18.',
            icon: (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            ),
            phase: 'Phase 2',
          },
          {
            title: 'Queue Length',
            description: '95th percentile queue (ft and vehicles) per movement and approach. HCM 7th Ed. Eq. 19-26.',
            icon: (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            ),
            phase: 'Phase 2',
          },
          {
            title: 'Throughput',
            description: 'Vehicles per hour per movement and corridor-wide total served volume.',
            icon: (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            ),
            phase: 'Phase 2',
          },
        ].map((card) => (
          <div key={card.title} className="card flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {card.icon}
                </svg>
              </div>
              <span className="text-xs text-gray-600 bg-gray-700/50 px-2 py-0.5 rounded">{card.phase}</span>
            </div>
            <h4 className="font-semibold text-gray-200 text-sm mb-2">{card.title}</h4>
            <p className="text-gray-500 text-xs leading-relaxed flex-1">{card.description}</p>
            <div className="mt-3 pt-3 border-t border-gray-700">
              <span className="text-xs text-gray-600 italic">
                Results will appear here after simulation
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed placeholder tables */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-header mb-0">Delay Summary by Movement</h3>
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">Phase 2</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Intersection</th>
                <th>Approach</th>
                <th>Movement</th>
                <th className="text-right">d1 (s/veh)</th>
                <th className="text-right">d2 (s/veh)</th>
                <th className="text-right">Total Delay</th>
                <th className="text-center">LOS</th>
                <th className="text-right">Queue 95th (ft)</th>
                <th className="text-right">Throughput (vph)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={9} className="text-center py-8 text-gray-600 italic">
                  Simulation results will appear here after Phase 2 implementation.
                  Run the simulation to populate this table.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Corridor Summary Banner */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-900/30 border border-yellow-800/50 text-yellow-400 text-sm mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Phase 1 Complete
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">
          Results will appear here after simulation
        </h3>
        <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
          Phase 1 establishes the full project infrastructure: corridor setup, intersection geometry,
          phasing, timing plans, demand input, and project save/load. The simulation engine
          (Phase 2) and Time-Space Diagram (Phase 3) will populate this view with results.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
        <button
          onClick={() => setActiveView('simulation')}
          className="btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Simulation
        </button>
      </div>
    </div>
  )
}
