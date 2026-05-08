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
      newIx.distance_from_prev_ft = 1320
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

  function onDragStart(index) { setDragIndex(index) }

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
    <div className="max-w-4xl mx-auto p-4">
      {/* Page Header */}
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: '#111111' }}>Corridor Setup</h2>
        <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
          Configure corridor properties and add intersections
        </p>
      </div>

      {/* Corridor Properties */}
      <div className="card mb-4">
        <h3 className="section-header">Corridor Properties</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1">Project Name</label>
            <input
              type="text"
              className="input-field"
              value={currentProject.name}
              onChange={(e) => updateProject({ name: e.target.value })}
            />
          </div>
          <div>
            <label className="label block mb-1">Corridor Speed (mph)</label>
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
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="section-header mb-0">Intersections</h3>
            {intersections.length > 1 && (
              <p className="text-[11px] mt-0.5" style={{ color: '#888888' }}>
                Total length: {totalCorridor().toLocaleString()} ft ({(totalCorridor() / 5280).toFixed(2)} mi)
              </p>
            )}
          </div>
          <button
            onClick={handleAddIntersection}
            disabled={intersections.length >= 12}
            className="btn-primary gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Intersection
          </button>
        </div>

        {intersections.length === 0 && (
          <div className="text-center py-8">
            <div
              className="w-10 h-10 flex items-center justify-center mx-auto mb-2"
              style={{ backgroundColor: '#F8F8F7', border: '1px solid #E2E2E0', borderRadius: 4 }}
            >
              <svg className="w-5 h-5" style={{ color: '#AAAAAA' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <p className="text-xs" style={{ color: '#888888' }}>
              No intersections yet. Add up to 12 intersections to your corridor.
            </p>
          </div>
        )}

        {intersections.length > 0 && (
          <div className="space-y-1.5">
            {/* Column headers */}
            <div
              className="grid items-center gap-2 px-1 pb-1"
              style={{ gridTemplateColumns: '1.5rem 1fr 120px 120px 6rem 2rem', borderBottom: '1px solid #E2E2E0' }}
            >
              <div />
              <div className="label">Intersection Name</div>
              <div className="label">Type</div>
              <div className="label">Dist. from Prev (ft)</div>
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
                className="grid items-center gap-2 p-1.5 transition-colors duration-100"
                style={{
                  gridTemplateColumns: '1.5rem 1fr 120px 120px 6rem 2rem',
                  borderRadius: 3,
                  border: overIndex === index && dragIndex !== index
                    ? '1px solid #111111'
                    : '1px solid transparent',
                  backgroundColor: overIndex === index && dragIndex !== index
                    ? '#F8F8F7'
                    : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!(overIndex === index && dragIndex !== index)) {
                    e.currentTarget.style.backgroundColor = '#FAFAF9'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(overIndex === index && dragIndex !== index)) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                {/* Drag Handle + Index */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px]" style={{ color: '#AAAAAA' }}>{index + 1}</span>
                  <svg
                    className="w-3 h-3 cursor-grab active:cursor-grabbing"
                    style={{ color: '#AAAAAA' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 8h16M4 16h16" />
                  </svg>
                </div>

                {/* Name */}
                <input
                  type="text"
                  className="input-field text-xs"
                  value={ix.name}
                  onChange={(e) => handleFieldChange(ix.id, 'name', e.target.value)}
                  placeholder={`Intersection ${index + 1}`}
                />

                {/* Type */}
                <select
                  className="select-field text-xs"
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
                  className={`input-field text-xs ${index === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
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
                  className="btn-secondary w-full justify-center"
                >
                  Edit
                </button>

                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="disabled:opacity-30 transition-colors p-0.5"
                    style={{ color: '#AAAAAA', background: 'none', border: 'none' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#333333' }}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#AAAAAA'}
                    title="Move up"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === intersections.length - 1}
                    className="disabled:opacity-30 transition-colors p-0.5"
                    style={{ color: '#AAAAAA', background: 'none', border: 'none' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#333333' }}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#AAAAAA'}
                    title="Move down"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {intersections.length > 0 && (
          <div className="mt-3 pt-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid #E2E2E0' }}>
            {intersections.map((ix, index) => (
              <div key={ix.id} className="flex items-center justify-between text-[11px]" style={{ color: '#888888' }}>
                <span className="font-medium" style={{ color: '#444444' }}>{ix.name || `Intersection ${index + 1}`}</span>
                <button
                  className="transition-colors"
                  style={{ color: '#DC2626', background: 'none', border: 'none' }}
                  onClick={() => handleRemoveIntersection(ix.id)}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#991B1B'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#DC2626'}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-end mt-4">
        <button
          onClick={() => setActiveView('demand')}
          disabled={intersections.length === 0}
          className="btn-primary gap-2"
        >
          Next: Demand Input
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
