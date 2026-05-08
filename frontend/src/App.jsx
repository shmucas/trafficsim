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
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Navigation Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center gap-4 sticky top-0 z-50 shadow-lg">
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-max">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">
            TS
          </div>
          <span className="font-semibold text-white text-sm tracking-wide hidden sm:block">
            Traffic Corridor Sim
          </span>
        </div>

        {/* Separator */}
        {isProjectOpen && (
          <div className="h-6 w-px bg-gray-600 hidden sm:block" />
        )}

        {/* Project name */}
        {isProjectOpen && (
          <span className="text-gray-300 text-sm font-medium truncate max-w-xs">
            {currentProject.name}
          </span>
        )}

        {/* Nav tabs — only when project open */}
        {isProjectOpen && (
          <nav className="flex items-center gap-1 ml-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.view}
                onClick={() => setActiveView(item.view)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 ${
                  activeView === item.view
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Timing plan toggle — only when project open */}
        {isProjectOpen && (
          <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1">
            {PLANS.map((plan) => (
              <button
                key={plan}
                onClick={() => setActivePlan(plan)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors duration-150 ${
                  activePlan === plan
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
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
              <span className="text-red-400 text-xs">Save failed</span>
            )}
            {savedToast && !saveError && (
              <span className="text-green-400 text-xs flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
            <button
              onClick={saveProject}
              disabled={isSaving}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
            onClick={() => {
              saveProject()
              closeProject()
            }}
            className="btn-ghost text-xs py-1.5 px-3"
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
