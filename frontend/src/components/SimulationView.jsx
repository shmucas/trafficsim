import React, { useState, useEffect, useRef, useCallback } from 'react'
import useProjectStore from '../store/projectStore'
import SimulationCanvas, { CANVAS_HEIGHT } from './SimulationCanvas'

const LOS_COLORS = {
  A: 'text-green-400',
  B: 'text-green-400',
  C: 'text-yellow-400',
  D: 'text-yellow-500',
  E: 'text-orange-400',
  F: 'text-red-400',
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

  const intersections = currentProject?.intersections || []
  const results = currentProject?.simulation_results

  // playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [simT, setSimT] = useState(0)
  const [speed, setSpeed] = useState(1)
  const rafRef = useRef(null)
  const lastTsRef = useRef(null)

  const maxCycle = Math.max(
    120,
    ...intersections.map((ix) => ix.timing_plans?.[activePlan]?.cycle ?? 120)
  )
  const totalT = maxCycle * 3

  const tick = useCallback((ts) => {
    if (lastTsRef.current == null) lastTsRef.current = ts
    const dt = ((ts - lastTsRef.current) / 1000) * speed
    lastTsRef.current = ts
    setSimT((t) => {
      const next = t + dt
      return next >= totalT ? next % totalT : next
    })
    rafRef.current = requestAnimationFrame(tick)
  }, [speed, totalT])

  useEffect(() => {
    if (isPlaying) {
      lastTsRef.current = null
      rafRef.current = requestAnimationFrame(tick)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying, tick])

  useEffect(() => {
    setSimT(0)
    setIsPlaying(false)
  }, [activePlan])

  if (!currentProject) return null

  const tmod = totalT > 0 ? ((simT % totalT) + totalT) % totalT : 0

  async function handleRun() {
    try {
      await runSimulation()
      setActiveView('results')
    } catch {
      // error stored in store
    }
  }

  const readyCount = intersections.filter(
    (ix) => (ix.approaches || []).length > 0 && !!ix.timing_plans?.[activePlan]
  ).length

  return (
    <div className="max-w-5xl mx-auto p-6">
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

      {/* 2D Visual Simulation — full corridor */}
      {intersections.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-header mb-0">Corridor Visual</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Queued
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-400" /> Moving
              </span>
              <span>{intersections.length} intersection{intersections.length !== 1 ? 's' : ''} · {activePlan}</span>
            </div>
          </div>

          {/* Scrollable canvas wrapper */}
          <div className="mb-4 overflow-x-auto rounded-lg" style={{ maxHeight: CANVAS_HEIGHT + 4 }}>
            <SimulationCanvas
              intersections={intersections}
              activePlan={activePlan}
              simT={tmod}
            />
          </div>

          {/* Playback controls */}
          <div className="flex flex-col gap-3">
            {/* Seek bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-10 text-right">
                {tmod.toFixed(1)}s
              </span>
              <input
                type="range"
                min={0}
                max={totalT}
                step={0.1}
                value={tmod}
                onChange={(e) => {
                  setIsPlaying(false)
                  setSimT(Number(e.target.value))
                }}
                className="flex-1 accent-blue-500"
              />
              <span className="text-xs text-gray-500 w-12">
                {totalT}s
              </span>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 justify-center">
              {/* Rewind to start */}
              <button
                onClick={() => { setSimT(0); setIsPlaying(false) }}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"
                title="Reset"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                </svg>
              </button>

              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="btn-primary px-5 py-2 flex items-center gap-2"
              >
                {isPlaying ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Play
                  </>
                )}
              </button>

              {/* Speed toggle */}
              <button
                onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
                className="btn-secondary px-3 py-1.5 text-xs font-semibold min-w-[44px]"
              >
                {speed}x
              </button>
            </div>

            {/* Cycle progress bar */}
            <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-blue-600 rounded-full transition-none"
                style={{ width: `${((tmod % maxCycle) / maxCycle) * 100}%` }}
              />
            </div>
            <div className="text-center text-xs text-gray-500">
              Cycle position: {(tmod % maxCycle).toFixed(1)}s / {maxCycle}s
            </div>
          </div>
        </div>
      )}

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

      {/* Last run summary */}
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
