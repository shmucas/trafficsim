import React, { useState } from 'react'
import useProjectStore, { makeDefaultIntersection } from '../store/projectStore'

const INTERSECTION_TYPES = ['2-leg', '3-leg', '4-leg']

export default function CorridorSetup() {
  const {
    currentProject,
    updateProject,
    updateIntersection,
    setActiveView,
    setSelectedIntersection,
  } = useProjectStore()

  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  if (!currentProject) return null

  const intersections = currentProject.intersections || []

  function handleSpeedChange(val) {
    const speed = parseFloat(val)
    if (!isNaN(speed) && speed > 0) {
      updateProject({ corridor_speed_mph: speed })
    }
  }

  function handleAddIntersection() {
    const nextId = intersections.length > 0
      ? Math.max(...intersections.map((ix) => ix.id)) + 1
      : 1
    const newIx = makeDefaultIntersection(nextId)
    if (intersections.length > 0) {
      newIx.distance_from_prev_ft = 1320 // default 1/4 mile
    }
    updateProject({ intersections: [...intersections, newIx] })
  }

  function handleRemoveIntersection(id) {
    const updated = intersections.filter((ix) => ix.id !== id)
    updateProject({ intersections: updated })
  }

  function handleFieldChange(id, field, value) {
    updateIntersection(id, { [field]: value })
  }

  function handleEdit(id) {
    setSelectedIntersection(id)
    setActiveView('intersection')
  }

  function handleMoveUp(index) {
    if (index === 0) return
    const arr = [...intersections]
    ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
    updateProject({ intersections: arr })
  }

  function handleMoveDown(index) {
    if (index === intersections.length - 1) return
    const arr = [...intersections]
    ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
    updateProject({ intersections: arr })
  }

  // Drag-and-drop handlers
  function onDragStart(index) {
    setDragIndex(index)
  }

  function onDragOver(e, index) {
    e.preventDefault()
    setOverIndex(index)
  }

  function onDrop(index) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const arr = [...intersections]
    const [removed] = arr.splice(dragIndex, 1)
    arr.splice(index, 0, removed)
    updateProject({ intersections: arr })
    setDragIndex(null)
    setOverIndex(null)
  }

  function totalCorridor() {
    return intersections.reduce((sum, ix, i) => {
      return i > 0 ? sum + (Number(ix.distance_from_prev_ft) || 0) : sum
    }, 0)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Corridor Setup</h2>
        <p className="text-gray-400 text-sm mt-1">
          Configure the corridor properties and add intersections
        </p>
      </div>

      {/* Corridor Properties */}
      <div className="card mb-6">
        <h3 className="section-header">Corridor Properties</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Project Name</label>
            <input
              type="text"
              className="input-field"
              value={currentProject.name}
              onChange={(e) => updateProject({ name: e.target.value })}
            />
          </div>
          <div>
            <label className="label block mb-1.5">Corridor Speed (mph)</label>
            <input
              type="number"
              className="input-field"
              value={currentProject.corridor_speed_mph || 35}
              onChange={(e) => handleSpeedChange(e.target.value)}
              min={5}
              max={85}
              step={5}
            />
          </div>
        </div>
      </div>

      {/* Intersections */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-header mb-0">Intersections</h3>
            {intersections.length > 1 && (
              <p className="text-xs text-gray-500 mt-0.5">
                Total corridor length: {totalCorridor().toLocaleString()} ft
                ({(totalCorridor() / 5280).toFixed(2)} mi)
              </p>
            )}
          </div>
          <button
            onClick={handleAddIntersection}
            disabled={intersections.length >= 12}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Intersection
          </button>
        </div>

        {intersections.length === 0 && (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              No intersections yet. Add up to 12 intersections to your corridor.
            </p>
          </div>
        )}

        {intersections.length > 0 && (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="grid items-center gap-3 px-2 pb-1 border-b border-gray-700"
              style={{ gridTemplateColumns: '2rem 1fr 140px 140px 7rem 2.5rem' }}>
              <div />
              <div className="label">Intersection Name</div>
              <div className="label">Type</div>
              <div className="label">Dist. from Prev. (ft)</div>
              <div />
              <div />
            </div>

            {intersections.map((ix, index) => (
              <div
                key={ix.id}
                draggable
                onDragStart={() => onDragStart(index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDrop={() => onDrop(index)}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
                className={`grid items-center gap-3 p-2 rounded-lg border transition-colors duration-100 ${
                  overIndex === index && dragIndex !== index
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-transparent hover:bg-gray-700/40'
                }`}
                style={{ gridTemplateColumns: '2rem 1fr 140px 140px 7rem 2.5rem' }}
              >
                {/* Drag Handle + Index */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-gray-600 text-xs">{index + 1}</span>
                  <svg
                    className="w-3.5 h-3.5 text-gray-600 cursor-grab active:cursor-grabbing"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 8h16M4 16h16" />
                  </svg>
                </div>

                {/* Name */}
                <input
                  type="text"
                  className="input-field text-sm"
                  value={ix.name}
                  onChange={(e) => handleFieldChange(ix.id, 'name', e.target.value)}
                  placeholder={`Intersection ${index + 1}`}
                />

                {/* Type */}
                <select
                  className="select-field text-sm"
                  value={ix.type}
                  onChange={(e) => handleFieldChange(ix.id, 'type', e.target.value)}
                >
                  {INTERSECTION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                {/* Distance */}
                <input
                  type="number"
                  className={`input-field text-sm ${index === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  value={index === 0 ? 0 : (ix.distance_from_prev_ft || 0)}
                  disabled={index === 0}
                  onChange={(e) =>
                    handleFieldChange(ix.id, 'distance_from_prev_ft', Number(e.target.value))
                  }
                  min={0}
                  step={100}
                />

                {/* Edit button */}
                <button
                  onClick={() => handleEdit(ix.id)}
                  className="btn-secondary text-xs py-1 px-3 w-full text-center"
                >
                  Edit
                </button>

                {/* Reorder / Delete */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors p-0.5"
                    title="Move up"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === intersections.length - 1}
                    className="text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors p-0.5"
                    title="Move down"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {intersections.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col gap-2">
            {intersections.map((ix, index) => (
              <div key={ix.id} className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-400">{ix.name || `Intersection ${index + 1}`}</span>
                <button
                  onClick={() => handleRemoveIntersection(ix.id)}
                  className="text-red-600 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-end mt-6">
        <button
          onClick={() => setActiveView('demand')}
          disabled={intersections.length === 0}
          className="btn-primary flex items-center gap-2"
        >
          Next: Demand Input
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
