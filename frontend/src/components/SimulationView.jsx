import React from 'react'
import useProjectStore from '../store/projectStore'

export default function SimulationView() {
  const { currentProject, setActiveView, activePlan } = useProjectStore()

  if (!currentProject) return null

  const intersections = currentProject.intersections || []

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Simulation</h2>
        <p className="text-gray-400 text-sm mt-1">
          Run the corridor simulation using HCM 7th Edition methodology
        </p>
      </div>

      {/* Project Summary */}
      <div className="card mb-6">
        <h3 className="section-header">Project Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="label mb-1">Corridor</div>
            <div className="text-white font-medium">{currentProject.name}</div>
          </div>
          <div>
            <div className="label mb-1">Active Plan</div>
            <div className="text-blue-300 font-semibold">{activePlan}</div>
          </div>
          <div>
            <div className="label mb-1">Intersections</div>
            <div className="text-white font-medium">{intersections.length}</div>
          </div>
        </div>
      </div>

      {/* Intersection checklist */}
      {intersections.length > 0 && (
        <div className="card mb-6">
          <h3 className="section-header">Intersection Readiness</h3>
          <div className="space-y-2">
            {intersections.map((ix) => {
              const demand = currentProject.demand?.[ix.id]
              const hasDemand = demand && Object.values(demand).some(
                (dir) => Object.values(dir).some((arr) => arr.some((v) => v > 0))
              )
              const hasApproaches = (ix.approaches || []).length > 0
              const hasActivePlan = !!ix.timing_plans?.[activePlan]

              return (
                <div
                  key={ix.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-900/50 border border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      hasApproaches && hasActivePlan ? 'bg-green-400' : 'bg-yellow-500'
                    }`} />
                    <span className="text-gray-200 text-sm font-medium">{ix.name}</span>
                    <span className="text-xs text-gray-500">{ix.type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className={hasApproaches ? 'text-green-400' : 'text-gray-600'}>
                      {hasApproaches ? '✓ Geometry' : '✗ Geometry'}
                    </span>
                    <span className={hasActivePlan ? 'text-green-400' : 'text-gray-600'}>
                      {hasActivePlan ? '✓ Timing' : '✗ Timing'}
                    </span>
                    <span className={hasDemand ? 'text-green-400' : 'text-yellow-500'}>
                      {hasDemand ? '✓ Demand' : '⚠ No demand'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Simulation Engine Placeholder */}
      <div className="card">
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-blue-900/30 border border-blue-800/50 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Simulation Engine — Coming in Phase 2
          </h3>
          <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed mb-6">
            The HCM 7th Edition simulation engine will be implemented in Phase 2.
            It will calculate control delay (d1+d2+d3), 95th percentile queue lengths,
            throughput per movement, saturation flow adjustments, and Robertson platoon dispersion.
          </p>

          <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-500 mb-8">
            {[
              'HCM 7th Edition delay calculations',
              'Robertson platoon dispersion',
              'Saturation flow adjustments',
              '95th percentile queue',
              'Arrival type derivation',
            ].map((item) => (
              <span
                key={item}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                {item}
              </span>
            ))}
          </div>

          <button
            onClick={() => setActiveView('results')}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            View Results (Placeholder)
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
        <button
          onClick={() => setActiveView('demand')}
          className="btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Demand Input
        </button>
        <button
          onClick={() => setActiveView('results')}
          className="btn-primary flex items-center gap-2"
        >
          View Results
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
