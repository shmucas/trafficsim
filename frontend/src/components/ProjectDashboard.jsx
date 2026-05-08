import React, { useEffect, useState } from 'react'
import axios from 'axios'
import useProjectStore from '../store/projectStore'
import { buildSampleProject } from '../data/sampleCorridor'

export default function ProjectDashboard() {
  const { loadProject, setProject, setActiveView } = useProjectStore()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [loadingSample, setLoadingSample] = useState(false)

  async function fetchProjects() {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get('/api/projects')
      setProjects(res.data)
    } catch (e) {
      setError('Failed to connect to backend. Make sure the server is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await axios.post('/api/projects', { name: newName.trim() })
      setProject(res.data)
      setActiveView('corridor')
    } catch (e) {
      setError('Failed to create project.')
    } finally {
      setCreating(false)
      setShowModal(false)
      setNewName('')
    }
  }

  async function handleOpen(id) {
    try {
      await loadProject(id)
    } catch (e) {
      setError('Failed to load project.')
    }
  }

  async function handleLoadSample() {
    setLoadingSample(true)
    setError(null)
    try {
      const createRes = await axios.post('/api/projects', { name: 'Main St — Sample Corridor' })
      const projectId = createRes.data.id
      const sampleData = buildSampleProject(projectId)
      const saveRes = await axios.put(`/api/projects/${projectId}`, sampleData)
      setProject(saveRes.data)
      setActiveView('simulation')
    } catch (e) {
      setError('Failed to load sample corridor.')
    } finally {
      setLoadingSample(false)
    }
  }

  async function handleDelete(id) {
    try {
      await axios.delete(`/api/projects/${id}`)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      setError('Failed to delete project.')
    } finally {
      setDeleteId(null)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="min-h-full p-5" style={{ backgroundColor: '#F8F8F7' }}>
      <div className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-base font-semibold" style={{ color: '#111111' }}>Project Dashboard</h1>
            <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
              Traffic corridor simulation projects
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              disabled={loadingSample}
              className="btn-secondary gap-1.5"
              title="Create a 4-intersection corridor with standard NEMA 8-phase timing and sample volumes"
            >
              {loadingSample ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              {loadingSample ? 'Loading…' : 'Load Sample'}
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            className="px-3 py-2 mb-4 text-xs flex items-start gap-2"
            style={{ border: '1px solid #FECACA', backgroundColor: '#FEF2F2', color: '#DC2626', borderRadius: 4 }}
          >
            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#E2E2E0', borderTopColor: '#111111' }} />
            <span className="ml-3 text-sm" style={{ color: '#888888' }}>Loading projects…</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && projects.length === 0 && !error && (
          <div className="text-center py-12">
            <div
              className="w-12 h-12 flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: '#F8F8F7', border: '1px solid #E2E2E0', borderRadius: 4 }}
            >
              <svg className="w-6 h-6" style={{ color: '#AAAAAA' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="font-semibold mb-1" style={{ color: '#111111' }}>No projects yet</h2>
            <p className="text-xs mb-6" style={{ color: '#888888' }}>Start from scratch or try the sample corridor to explore the app.</p>

            {/* Sample corridor card */}
            <div className="max-w-sm mx-auto mb-4 text-left card">
              <div className="flex items-start gap-3 mb-2">
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: '#F8F8F7', border: '1px solid #E2E2E0', borderRadius: 3 }}
                >
                  <svg className="w-4 h-4" style={{ color: '#111111' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-xs" style={{ color: '#111111' }}>Main St — Sample Corridor</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: '#888888' }}>
                    4 intersections · 35 mph · NEMA 8-phase · ped ph2/4/6/8
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {['AM green wave', 'Standard volumes', 'Oak / Elm / Maple / Pine'].map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5"
                    style={{ backgroundColor: '#F8F8F7', color: '#888888', border: '1px solid #E2E2E0', borderRadius: 3 }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <button
                onClick={handleLoadSample}
                disabled={loadingSample}
                className="btn-primary w-full justify-center"
              >
                {loadingSample ? 'Loading…' : 'Open Sample Corridor'}
              </button>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="text-xs transition-colors"
              style={{ color: '#888888', background: 'none', border: 'none' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#111111'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
            >
              Or create a blank project →
            </button>
          </div>
        )}

        {/* Project Grid */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="card flex flex-col transition-colors duration-150"
                style={{ cursor: 'default' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#111111'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E2E2E0'}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate text-sm leading-tight" style={{ color: '#111111' }}>
                      {project.name}
                    </h3>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: '#F8F8F7', color: '#111111', border: '1px solid #E2E2E0', borderRadius: 3 }}
                    >
                      {project.active_plan || 'AM'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] mb-3" style={{ color: '#888888' }}>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {(project.intersections || []).length} intersection{(project.intersections || []).length !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {project.corridor_speed_mph || 35} mph
                  </span>
                </div>

                <div className="text-[11px] mb-3 space-y-0.5" style={{ color: '#AAAAAA' }}>
                  <div>Created: {formatDate(project.created)}</div>
                  <div>Updated: {formatDate(project.updated)}</div>
                </div>

                <div
                  className="flex items-center gap-2 mt-auto pt-2.5"
                  style={{ borderTop: '1px solid #E2E2E0' }}
                >
                  <button onClick={() => handleOpen(project.id)} className="btn-primary flex-1 justify-center">
                    Open
                  </button>
                  <button onClick={() => setDeleteId(project.id)} className="btn-danger">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E2E0', borderRadius: 4, padding: 20, width: '100%', maxWidth: 448 }}>
            <h2 className="text-sm font-semibold mb-0.5" style={{ color: '#111111' }}>New Project</h2>
            <p className="text-xs mb-4" style={{ color: '#888888' }}>Configure your corridor simulation project</p>
            <div className="space-y-3">
              <div>
                <label className="label block mb-1">Project Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Main St Corridor"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="btn-primary flex-1 justify-center"
              >
                {creating ? 'Creating…' : 'Create Project'}
              </button>
              <button
                onClick={() => { setShowModal(false); setNewName('') }}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E2E0', borderRadius: 4, padding: 20, width: '100%', maxWidth: 384 }}>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-8 h-8 flex items-center justify-center"
                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 3 }}
              >
                <svg className="w-4 h-4" style={{ color: '#DC2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: '#111111' }}>Delete Project</h3>
                <p className="text-xs" style={{ color: '#888888' }}>This action cannot be undone</p>
              </div>
            </div>
            <p className="text-xs mb-4" style={{ color: '#444444' }}>
              Are you sure you want to permanently delete this project?
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteId)} className="btn-danger flex-1 justify-center">
                Delete
              </button>
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
