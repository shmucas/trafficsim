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

  // Theme management
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top Navigation Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-0 flex items-center gap-3 sticky top-0 z-50" style={{ height: 40 }}>
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-max">
          <div className="w-6 h-6 bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white" style={{ borderRadius: 3 }}>
            TS
          </div>
          <span className="font-semibold text-gray-900 dark:text-white text-xs tracking-wide hidden sm:block">
            Traffic Corridor Sim
          </span>
        </div>

        {/* Separator */}
        {isProjectOpen && (
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 hidden sm:block" />
        )}

        {/* Project name */}
        {isProjectOpen && (
          <span className="text-gray-600 dark:text-gray-400 text-xs truncate max-w-[200px]">
            {currentProject.name}
          </span>
        )}

        {/* Nav tabs — only when project open */}
        {isProjectOpen && (
          <nav className="flex items-center gap-0.5 ml-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.view}
                onClick={() => setActiveView(item.view)}
                className={`px-2.5 py-0 text-[12px] font-medium transition-colors duration-150 ${
                  activeView === item.view
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                style={{ height: 40, borderBottom: activeView === item.view ? '2px solid #3b82f6' : '2px solid transparent' }}
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
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-900 p-0.5" style={{ borderRadius: 3 }}>
            {PLANS.map((plan) => (
              <button
                key={plan}
                onClick={() => setActivePlan(plan)}
                className={`px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-150 ${
                  activePlan === plan
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                style={{ borderRadius: 2 }}
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
              <span className="text-red-500 text-[11px]">Save failed</span>
            )}
            {savedToast && !saveError && (
              <span className="text-green-500 dark:text-green-400 text-[11px] flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
            <button
              onClick={saveProject}
              disabled={isSaving}
              className="btn-primary gap-1"
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

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          className="btn-ghost px-2"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Dashboard button */}
        {isProjectOpen && (
          <button
            onClick={() => {
              saveProject()
              closeProject()
            }}
            className="btn-ghost"
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
