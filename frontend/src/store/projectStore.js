import { create } from 'zustand'
import axios from 'axios'

const DEFAULT_NEMA_PHASES = {
  '1': { active: true, min_green: 5,  max_green: 30, yellow: 4, all_red: 1, recall: 'None' },
  '2': { active: true, min_green: 10, max_green: 60, yellow: 4, all_red: 1, recall: 'None' },
  '3': { active: true, min_green: 5,  max_green: 30, yellow: 4, all_red: 1, recall: 'None' },
  '4': { active: true, min_green: 10, max_green: 60, yellow: 4, all_red: 1, recall: 'None' },
  '5': { active: true, min_green: 5,  max_green: 30, yellow: 4, all_red: 1, recall: 'None' },
  '6': { active: true, min_green: 10, max_green: 60, yellow: 4, all_red: 1, recall: 'None' },
  '7': { active: true, min_green: 5,  max_green: 30, yellow: 4, all_red: 1, recall: 'None' },
  '8': { active: true, min_green: 10, max_green: 60, yellow: 4, all_red: 1, recall: 'None' },
}

const DEFAULT_TIMING_PLANS = {
  AM:       { cycle: 120, offset: 0,  splits: { '1':10,'2':50,'3':10,'4':50,'5':10,'6':50,'7':10,'8':50 } },
  PM:       { cycle: 140, offset: 15, splits: { '1':12,'2':58,'3':12,'4':58,'5':12,'6':58,'7':12,'8':58 } },
  'Off-Peak': { cycle: 90, offset: 0, splits: { '1':8,'2':37,'3':8,'4':37,'5':8,'6':37,'7':8,'8':37 } },
}

export function makeDefaultApproach(direction) {
  return {
    direction,
    lanes: [
      { movement: 'L', width_ft: 12 },
      { movement: 'T', width_ft: 12 },
      { movement: 'R', width_ft: 12 },
    ],
    turn_bay_lengths: { L: null, R: null },
    heavy_vehicle_pct: 2,
    phf: 0.95,
    detector: { stop_bar: true, advance: false },
  }
}

export function makeDefaultIntersection(id, name = '') {
  return {
    id,
    name: name || `Intersection ${id}`,
    type: '4-leg',
    distance_from_prev_ft: 0,
    approaches: [
      makeDefaultApproach('NB'),
      makeDefaultApproach('SB'),
      makeDefaultApproach('EB'),
      makeDefaultApproach('WB'),
    ],
    nema_phases: JSON.parse(JSON.stringify(DEFAULT_NEMA_PHASES)),
    overlaps: [],
    ped_phases: [],
    detectors: [],
    timing_plans: JSON.parse(JSON.stringify(DEFAULT_TIMING_PLANS)),
  }
}

const useProjectStore = create((set, get) => ({
  currentProject: null,
  activeView: 'dashboard',
  selectedIntersectionId: null,
  activePlan: 'AM',
  isSaving: false,
  saveError: null,

  // Actions
  setProject: (project) => set({ currentProject: project }),

  updateProject: (partial) =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, ...partial }
        : null,
    })),

  updateIntersection: (id, data) =>
    set((state) => {
      if (!state.currentProject) return {}
      const intersections = state.currentProject.intersections.map((ix) =>
        ix.id === id ? { ...ix, ...data } : ix
      )
      return {
        currentProject: { ...state.currentProject, intersections },
      }
    }),

  updateDemand: (intersectionId, data) =>
    set((state) => {
      if (!state.currentProject) return {}
      const demand = {
        ...state.currentProject.demand,
        [intersectionId]: data,
      }
      return {
        currentProject: { ...state.currentProject, demand },
      }
    }),

  setActiveView: (view) => set({ activeView: view }),

  setActivePlan: (plan) => set({ activePlan: plan }),

  setSelectedIntersection: (id) => set({ selectedIntersectionId: id }),

  // API actions
  saveProject: async () => {
    const { currentProject } = get()
    if (!currentProject) return
    set({ isSaving: true, saveError: null })
    try {
      const response = await axios.put(
        `/api/projects/${currentProject.id}`,
        currentProject
      )
      set({ currentProject: response.data, isSaving: false })
    } catch (err) {
      set({ isSaving: false, saveError: err.message })
    }
  },

  loadProject: async (id) => {
    const response = await axios.get(`/api/projects/${id}`)
    set({
      currentProject: response.data,
      activePlan: response.data.active_plan || 'AM',
      activeView: 'corridor',
    })
  },

  closeProject: () =>
    set({
      currentProject: null,
      activeView: 'dashboard',
      selectedIntersectionId: null,
    }),
}))

export default useProjectStore
