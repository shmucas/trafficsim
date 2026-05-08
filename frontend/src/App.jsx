import React, { useState, useEffect, useRef } from 'react'
import useProjectStore from './store/projectStore'
import ProjectDashboard from './components/ProjectDashboard'
import CorridorSetup from './components/CorridorSetup'
import IntersectionEditor from './components/IntersectionEditor'
import DemandInput from './components/DemandInput'
import SimulationView from './components/SimulationView'
import ResultsView from './components/ResultsView'

const PLANS = ['AM', 'PM', 'Off-Peak']

const NAV_ITEMS = [
  { view: 'corridor',      label: 'Corridor' },
  { view: 'intersection',  label: 'Intersection' },
  { view: 'demand',        label: 'Demand' },
  { view: 'simulation',    label: 'Simulation' },
  { view: 'results',       label: 'Results' },
]

export default function App() {
  const {
    currentProject,
    activeView,
    activePlan,
    isSaving,
    saveError,
    setActiveView,
    setActivePlan,
    saveProject,
    closeProject,
  } = useProjectStore()

  const isProjectOpen = !!currentProject

  // Save confirmation toast
  const [savedToast, setSavedToast] = useState(false)
  const prevSavingRef = useRef(false)
  useEffect(() => {
    if (prevSavingRef.current && !isSaving && !saveError) {
      setSavedToast(true)
      const t = setTimeout(() => setSavedToast(false), 2000)
      return () => clearTimeout(t)
    }
    prevSavingRef.current = isSaving
  }, [isSaving, saveError])

  function renderView() {
    switch (activeView) {
      case 'corridor':     return <CorridorSetup />
      case 'intersection': return <IntersectionEditor />
      case 'demand':       return <DemandInput />
      case 'simulation':   return <SimulationView />
      case 'results':      return <ResultsView />
      default:             return <ProjectDashboard />
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F8F7' }}>
      {/* Top Navigation — dark */}
      <header
        className="flex items-center gap-3 px-4 sticky top-0 z-50"
        style={{ height: 40, backgroundColor: '#111111', borderBottom: '1px solid #2A2A2A' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-max">
          <div
            className="w-6 h-6 flex items-center justify-center text-[11px] font-bold"
            style={{ backgroundColor: '#FFFFFF', color: '#111111', borderRadius: 3 }}
          >
            TS
          </div>
          <span className="font-semibold text-xs tracking-wide hidden sm:block" style={{ color: '#FFFFFF' }}>
            Traffic Corridor Sim
          </span>
        </div>

        {/* Separator */}
        {isProjectOpen && (
          <div className="h-4 w-px hidden sm:block" style={{ backgroundColor: '#333333' }} />
        )}

        {/* Project name */}
        {isProjectOpen && (
          <span className="text-xs truncate max-w-[200px]" style={{ color: '#888888' }}>
            {currentProject.name}
          </span>
        )}

        {/* Nav tabs */}
        {isProjectOpen && (
          <nav className="flex items-center gap-0.5 ml-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.view}
                onClick={() => setActiveView(item.view)}
                className="px-2.5 py-0 text-[12px] font-medium transition-colors duration-150"
                style={{
                  height: 40,
                  color: activeView === item.view ? '#FFFFFF' : '#888888',
                  borderBottom: activeView === item.view ? '2px solid #FFFFFF' : '2px solid transparent',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeView === item.view ? '2px solid #FFFFFF' : '2px solid transparent',
                }}
                onMouseEnter={(e) => { if (activeView !== item.view) e.currentTarget.style.color = '#CCCCCC' }}
                onMouseLeave={(e) => { if (activeView !== item.view) e.currentTarget.style.color = '#888888' }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Timing plan toggle */}
        {isProjectOpen && (
          <div
            className="flex items-center gap-0.5 p-0.5"
            style={{ backgroundColor: '#1E1E1E', borderRadius: 3 }}
          >
            {PLANS.map((plan) => (
              <button
                key={plan}
                onClick={() => setActivePlan(plan)}
                className="px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-150"
                style={{
                  borderRadius: 2,
                  backgroundColor: activePlan === plan ? '#FFFFFF' : 'transparent',
                  color: activePlan === plan ? '#111111' : '#888888',
                  border: 'none',
                }}
              >
                {plan}
              </button>
            ))}
          </div>
        )}

        {/* Save button + status */}
        {isProjectOpen && (
          <div className="flex items-center gap-2">
            {saveError && (
              <span className="text-[11px]" style={{ color: '#EF4444' }}>Save failed</span>
            )}
            {savedToast && !saveError && (
              <span className="text-[11px] flex items-center gap-1" style={{ color: '#22C55E' }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
            <button
              onClick={saveProject}
              disabled={isSaving}
              className="inline-flex items-center font-medium text-[12px] transition-colors disabled:opacity-40"
              style={{ height: 28, padding: '0 12px', borderRadius: 3, backgroundColor: '#FFFFFF', color: '#111111', border: 'none', whiteSpace: 'nowrap' }}
            >
              {isSaving ? (
                <>
                  <svg className="w-3 h-3 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : 'Save'}
            </button>
          </div>
        )}

        {/* Dashboard button */}
        {isProjectOpen && (
          <button
            onClick={() => { saveProject(); closeProject() }}
            className="text-[12px] font-medium transition-colors"
            style={{ color: '#888888', background: 'transparent', border: 'none', padding: '0 8px', height: 28, borderRadius: 3 }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
          >
            Dashboard
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>
    </div>
  )
}
