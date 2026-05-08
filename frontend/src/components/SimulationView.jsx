import React from 'react'
import useProjectStore from '../store/projectStore'

const LOS_COLORS = {
  A: 'text-green-400',
  B: 'text-green-400',
  C: 'text-yellow-400',
  D: 'text-yellow-500',
  E: 'text-orange-400',
  F: 'text-red-400',
}

const LOS_BG = {
  A: 'bg-green-900/40 border-green-700 text-green-300',
  B: 'bg-green-900/30 border-green-800 text-green-400',
  C: 'bg-yellow-900/40 border-yellow-700 text-yellow-300',
  D: 'bg-yellow-900/50 border-yellow-600 text-yellow-300',
  E: 'bg-orange-900/40 border-orange-700 text-orange-300',
  F: 'bg-red-900/40 border-red-700 text-red-300',
}

export default function SimulationView() {
  const {
    currentProject,
    setActiveView,
    activePlan,
    isSimulating,
    simulationError,
    runSimulation,
  } = useProjectStore()

  if (!currentProject) return null

  const intersections = currentProject.intersections || []
  const results = currentProject.simulation_results

  async function handleRun() {
    try {
      await runSimulation()
      setActiveView('results')
    } catch {
      // error is stored in store
    }
  }

  const readyCount = intersections.filter((ix) => {
    return (ix.approaches || []).length > 0 && !!ix.timing_plans?.[activePlan]
  }).length

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Simulation</h2>
        <p className="text-gray-400 text-sm mt-1">
          HCM 7th Edition corridor analysis — {activePlan} timing plan
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
            <div className="text-white font-medium">
              {readyCount} / {intersections.length} ready
            </div>
          </div>
        </div>
      </div>

      {/* Intersection readiness checklist */}
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

      {/* Last run summary (if available) */}
      {results?.status === 'complete' && (
        <div className="card mb-6 border-blue-800/50">
          <h3 className="section-header">Last Run — {results.active_plan} Plan</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="label mb-1">Corridor Delay</div>
              <div className="text-white font-bold text-lg">
                {results.corridor_summary.avg_delay_s_veh}
                <span className="text-gray-400 text-xs ml-1">s/veh</span>
              </div>
            </div>
            <div>
              <div className="label mb-1">Corridor LOS</div>
              <div className={`font-bold text-2xl ${LOS_COLORS[results.corridor_summary.corridor_los] || 'text-white'}`}>
                {results.corridor_summary.corridor_los}
              </div>
            </div>
            <div>
              <div className="label mb-1">Total Throughput</div>
              <div className="text-white font-bold text-lg">
                {results.corridor_summary.total_throughput_vph.toLocaleString()}
                <span className="text-gray-400 text-xs ml-1">vph</span>
              </div>
            </div>
            <div>
              <div className="label mb-1">Intersections</div>
              <div className="text-white font-bold text-lg">
                {results.corridor_summary.intersections_analyzed}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {simulationError && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
          Simulation error: {simulationError}
        </div>
      )}

      {/* Run button */}
      <div className="card text-center py-10">
        {intersections.length === 0 ? (
          <p className="text-gray-500 text-sm mb-4">
            Add intersections in Corridor Setup before running the simulation.
          </p>
        ) : (
          <>
            <div className="w-16 h-16 bg-blue-900/30 border border-blue-800/50 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {results ? 'Re-run Simulation' : 'Run Simulation'}
            </h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
              Calculates HCM 7th Edition control delay (d1+d2+d3), 95th percentile
              queue lengths, throughput, and LOS for all intersections.
            </p>
            <button
              onClick={handleRun}
              disabled={isSimulating || intersections.length === 0}
              className="btn-primary flex items-center gap-2 mx-auto px-6 py-2.5"
            >
              {isSimulating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  Run {activePlan} Plan
                </>
              )}
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
        <button onClick={() => setActiveView('demand')} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Demand
        </button>
        {results?.status === 'complete' && (
          <button onClick={() => setActiveView('results')} className="btn-primary flex items-center gap-2">
            View Results
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
