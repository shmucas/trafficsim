/**
 * RingBarrierEditor — visual NEMA dual-ring barrier diagram editor.
 *
 * Ring layout (standard):
 *   Ring 1:  [φ1][φ2] ‖ [φ5][φ6]
 *   Ring 2:  [φ3][φ4] ‖ [φ7][φ8]
 *              ↑ barrier (draggable between slots)
 *
 * Stored in ix.ring_config: { ring1: number[], ring2: number[], barrier_pos: number }
 * Phase params live in ix.nema_phases (shared across plans).
 * Splits live in ix.timing_plans[plan].splits (per plan).
 * Ped phases live in ix.ped_phases [{ phase, walk_s, ped_clearance_s }].
 */

import React, { useState, useRef, useCallback } from 'react'
import { DEFAULT_RING_CONFIG } from '../store/projectStore'

const PLANS = ['AM', 'PM', 'Off-Peak']
const RECALL_MODES = ['None', 'Min', 'Max', 'Ped']
const OVERLAP_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const ALL_PHASES = [1, 2, 3, 4, 5, 6, 7, 8]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRingConfig(ix) {
  const rc = ix.ring_config || DEFAULT_RING_CONFIG
  return {
    ring1: [...(rc.ring1 || [1, 2, 5, 6])],
    ring2: [...(rc.ring2 || [3, 4, 7, 8])],
    barrier_pos: rc.barrier_pos ?? 2,
  }
}

function getPhase(ix, key) {
  return ix.nema_phases?.[String(key)] || {}
}

function getSplit(ix, plan, key) {
  return Number(ix.timing_plans?.[plan]?.splits?.[String(key)] || 0)
}

function isActive(ix, key) {
  return getPhase(ix, key).active !== false
}

function effGreen(ix, key, split) {
  const ph = getPhase(ix, key)
  return Math.max(0, split - (ph.yellow ?? 4) - (ph.all_red ?? 1))
}

function getPedPhase(ix, phNum) {
  return (ix.ped_phases || []).find((p) => p.phase === phNum) || null
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(ix, plan) {
  const { ring1, ring2, barrier_pos } = getRingConfig(ix)
  const warnings = []

  const r1L = ring1.slice(0, barrier_pos)
  const r1R = ring1.slice(barrier_pos)
  const r2L = ring2.slice(0, barrier_pos)
  const r2R = ring2.slice(barrier_pos)

  // At least one active phase per quadrant
  const activeCount = (arr) => arr.filter((n) => isActive(ix, n)).length
  if (r1L.length > 0 && activeCount(r1L) === 0)
    warnings.push({ ring: 1, side: 'left',  msg: 'Ring 1 left: no active phases before barrier.' })
  if (r1R.length > 0 && activeCount(r1R) === 0)
    warnings.push({ ring: 1, side: 'right', msg: 'Ring 1 right: no active phases after barrier.' })
  if (r2L.length > 0 && activeCount(r2L) === 0)
    warnings.push({ ring: 2, side: 'left',  msg: 'Ring 2 left: no active phases before barrier.' })
  if (r2R.length > 0 && activeCount(r2R) === 0)
    warnings.push({ ring: 2, side: 'right', msg: 'Ring 2 right: no active phases after barrier.' })

  // Ring-barrier termination balance: active split sums must match at barrier
  const splitSum = (arr) =>
    arr.filter((n) => isActive(ix, n)).reduce((s, n) => s + getSplit(ix, plan, n), 0)

  const r1LSum = splitSum(r1L)
  const r2LSum = splitSum(r2L)
  const r1RSum = splitSum(r1R)
  const r2RSum = splitSum(r2R)

  if (r1LSum !== r2LSum && (r1L.length > 0 || r2L.length > 0))
    warnings.push({
      side: 'left',
      msg: `Left-of-barrier split sums differ: Ring 1 = ${r1LSum}s, Ring 2 = ${r2LSum}s.`,
    })
  if (r1RSum !== r2RSum && (r1R.length > 0 || r2R.length > 0))
    warnings.push({
      side: 'right',
      msg: `Right-of-barrier split sums differ: Ring 1 = ${r1RSum}s, Ring 2 = ${r2RSum}s.`,
    })

  // Concurrent conflict: same phase number in both rings
  const r1Set = new Set(ring1)
  const r2Set = new Set(ring2)
  ring1.forEach((n) => {
    if (r2Set.has(n)) warnings.push({ msg: `Phase φ${n} appears in both rings.` })
  })

  return warnings
}

// ── Phase Cell ────────────────────────────────────────────────────────────────

function PhaseCell({
  phNum, ix, plan, isDragOver, isDragging,
  onPhaseUpdate, onSplitUpdate, onPedUpdate,
  onDragStart, onDragOver, onDrop, onDragEnd,
  isBarrierDropTarget, onBarrierDrop, onBarrierDragOver,
}) {
  const key      = String(phNum)
  const phase    = getPhase(ix, phNum)
  const active   = isActive(ix, phNum)
  const split    = getSplit(ix, plan, phNum)
  const ped      = getPedPhase(ix, phNum)
  const hasPed   = !!ped
  const yellow   = phase.yellow   ?? 4
  const allRed   = phase.all_red  ?? 1
  const minG     = phase.min_green ?? 5
  const maxG     = phase.max_green ?? 30
  const eg       = effGreen(ix, phNum, split)
  const cycle    = ix.timing_plans?.[plan]?.cycle || 120

  const pctG = cycle > 0 ? (eg    / cycle) * 100 : 0
  const pctY = cycle > 0 ? (yellow / cycle) * 100 : 0
  const pctR = cycle > 0 ? (allRed / cycle) * 100 : 0

  const minViol = split > 0 && eg < minG
  const maxViol = split > 0 && eg > maxG

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e) }}
      onDrop={(e) => { e.preventDefault(); onDrop(e) }}
      onDragEnd={onDragEnd}
      className={`relative flex flex-col border transition-all select-none cursor-grab active:cursor-grabbing
        ${active
          ? isDragOver
            ? 'border-blue-400 bg-blue-950/60'
            : 'border-gray-600 bg-gray-800/80 hover:border-gray-500'
          : 'border-gray-700/50 bg-gray-900/40 opacity-40'
        }
        ${isDragging ? 'opacity-30 ring-1 ring-blue-500' : ''}
      `}
      style={{ minWidth: 88, width: 88, borderRadius: 3 }}
    >
      {/* Header: phase number + toggles */}
      <div className="flex items-center justify-between px-1.5 pt-1.5 pb-1">
        <span className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-600'}`}>
          φ{phNum}
        </span>
        <div className="flex items-center gap-1">
          {/* Ped toggle */}
          <button
            title={hasPed ? 'Ped phase ON — click to remove' : 'Add pedestrian phase'}
            onClick={() => {
              if (hasPed) {
                onPedUpdate({ remove: phNum })
              } else {
                onPedUpdate({ add: { phase: phNum, walk_s: 7, ped_clearance_s: 14 } })
              }
            }}
            className={`text-[9px] px-1 py-0 leading-4 transition-colors ${
              hasPed
                ? 'bg-teal-800 text-teal-300 border border-teal-600'
                : 'text-gray-600 hover:text-gray-400'
            }`}
            style={{ borderRadius: 2 }}
          >P</button>
          {/* Active toggle */}
          <button
            title={active ? 'Deactivate phase' : 'Activate phase'}
            onClick={() => onPhaseUpdate(key, { active: !active })}
            className={`w-3 h-3 border flex items-center justify-center transition-colors ${
              active
                ? 'bg-green-500 border-green-400'
                : 'bg-gray-700 border-gray-600 hover:border-gray-500'
            }`}
            style={{ borderRadius: '50%' }}
          >
            <span className={`block w-1.5 h-1.5 ${active ? 'bg-white' : 'bg-gray-500'}`} style={{ borderRadius: '50%' }} />
          </button>
        </div>
      </div>

      {/* Body — only shown when active */}
      {active && (
        <div className="px-1.5 pb-1.5 space-y-1 flex-1">
          {/* Split input */}
          <div className="flex items-center gap-0.5">
            <label className="text-gray-500 text-[9px] w-6 shrink-0">Spl</label>
            <input
              type="number"
              className="bg-gray-900 border border-gray-600 text-white text-[10px] text-center w-full focus:border-blue-500 focus:outline-none"
              style={{ borderRadius: 2, height: 18, padding: '0 2px' }}
              value={split}
              onChange={(e) => onSplitUpdate(key, e.target.value)}
              min={0} max={cycle} step={1}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-gray-500 text-[9px]">s</span>
          </div>

          {/* Green bar */}
          <div className="flex h-1.5 overflow-hidden" style={{ borderRadius: 2 }} title={`Eff green ${eg}s / Yellow ${yellow}s / All-red ${allRed}s`}>
            <div className="bg-green-500" style={{ width: `${pctG}%` }} />
            <div className="bg-yellow-500" style={{ width: `${pctY}%` }} />
            <div className="bg-red-700"   style={{ width: `${pctR}%` }} />
            <div className="bg-gray-700 flex-1" />
          </div>

          {/* Min / Max green */}
          <div className="grid grid-cols-2 gap-0.5">
            <div>
              <div className={`text-[8px] mb-0.5 ${minViol ? 'text-orange-400' : 'text-gray-500'}`}>
                Min{minViol ? '!' : ''}
              </div>
              <input
                type="number"
                className="bg-gray-900 border border-gray-600 text-white text-[10px] text-center w-full focus:border-blue-500 focus:outline-none"
                style={{ borderRadius: 2, height: 18, padding: '0 2px' }}
                value={minG}
                onChange={(e) => onPhaseUpdate(key, { min_green: Number(e.target.value) })}
                min={1} max={120} step={1}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div>
              <div className={`text-[8px] mb-0.5 ${maxViol ? 'text-amber-400' : 'text-gray-500'}`}>
                Max{maxViol ? '!' : ''}
              </div>
              <input
                type="number"
                className="bg-gray-900 border border-gray-600 text-white text-[10px] text-center w-full focus:border-blue-500 focus:outline-none"
                style={{ borderRadius: 2, height: 18, padding: '0 2px' }}
                value={maxG}
                onChange={(e) => onPhaseUpdate(key, { max_green: Number(e.target.value) })}
                min={1} max={200} step={1}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Yellow / All-Red */}
          <div className="grid grid-cols-2 gap-0.5">
            <div>
              <div className="text-[8px] text-gray-500 mb-0.5">Yel</div>
              <input
                type="number"
                className="bg-gray-900 border border-gray-600 text-white text-[10px] text-center w-full focus:border-blue-500 focus:outline-none"
                style={{ borderRadius: 2, height: 18, padding: '0 2px' }}
                value={yellow}
                onChange={(e) => onPhaseUpdate(key, { yellow: Number(e.target.value) })}
                min={1} max={10} step={0.5}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div>
              <div className="text-[8px] text-gray-500 mb-0.5">AR</div>
              <input
                type="number"
                className="bg-gray-900 border border-gray-600 text-white text-[10px] text-center w-full focus:border-blue-500 focus:outline-none"
                style={{ borderRadius: 2, height: 18, padding: '0 2px' }}
                value={allRed}
                onChange={(e) => onPhaseUpdate(key, { all_red: Number(e.target.value) })}
                min={0} max={10} step={0.5}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Recall */}
          <select
            className="bg-gray-900 border border-gray-600 text-gray-300 w-full focus:border-blue-500 focus:outline-none"
            style={{ borderRadius: 2, height: 18, fontSize: 9, padding: '0 2px' }}
            value={phase.recall || 'None'}
            onChange={(e) => onPhaseUpdate(key, { recall: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          >
            {RECALL_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Ped inputs */}
          {hasPed && (
            <div className="pt-0.5 border-t border-teal-800/50 space-y-0.5">
              <div className="flex items-center gap-0.5">
                <span className="text-[8px] text-teal-400 w-5">Wlk</span>
                <input
                  type="number"
                  className="bg-gray-900 border border-teal-800 text-teal-300 text-[10px] text-center w-full focus:outline-none"
                  style={{ borderRadius: 2, height: 18, padding: '0 2px' }}
                  value={ped.walk_s}
                  onChange={(e) => onPedUpdate({ update: { phase: phNum, walk_s: Number(e.target.value) } })}
                  min={1} max={60}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-[8px] text-teal-400 w-5">Clr</span>
                <input
                  type="number"
                  className="bg-gray-900 border border-teal-800 text-teal-300 text-[10px] text-center w-full focus:outline-none"
                  style={{ borderRadius: 2, height: 18, padding: '0 2px' }}
                  value={ped.ped_clearance_s}
                  onChange={(e) => onPedUpdate({ update: { phase: phNum, ped_clearance_s: Number(e.target.value) } })}
                  min={1} max={90}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drag grip indicator */}
      <div className="absolute top-1 left-1 opacity-20 pointer-events-none">
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </div>
    </div>
  )
}

// ── Barrier drop slot ─────────────────────────────────────────────────────────

function BarrierSlot({ pos, isBarrier, onDrop, onDragOver, dragActive }) {
  const [over, setOver] = useState(false)
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: isBarrier ? 24 : 8, minHeight: '100%', flexShrink: 0 }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); onDragOver?.() }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(pos) }}
    >
      {isBarrier ? (
        /* The actual barrier line */
        <div
          className={`relative flex flex-col items-center justify-center h-full transition-colors ${
            dragActive && over ? 'opacity-100' : ''
          }`}
          title="Drag a cell here to move barrier"
        >
          <div className="w-0.5 h-full bg-gray-400 absolute" style={{ left: '50%' }} />
          <div className={`z-10 px-0.5 py-1 rounded text-[9px] font-bold bg-gray-700 border border-gray-500 text-gray-300 rotate-90 tracking-widest`}
            style={{ writingMode: 'horizontal-tb' }}>
            ‖
          </div>
          {dragActive && (
            <div className={`absolute inset-0 rounded border-2 transition-colors ${
              over ? 'border-blue-400 bg-blue-900/20' : 'border-transparent'
            }`} />
          )}
        </div>
      ) : (
        /* A slot where the barrier can snap to */
        dragActive && (
          <div className={`w-1 h-full rounded transition-colors ${
            over ? 'bg-blue-400 w-1.5' : 'bg-transparent'
          }`} />
        )
      )}
    </div>
  )
}

// ── Ring row ──────────────────────────────────────────────────────────────────

function RingRow({
  ringNum, phases, barrier_pos, ix, plan,
  dragState, setDragState,
  onPhaseUpdate, onSplitUpdate, onPedUpdate, onRingConfigUpdate,
}) {
  // phases = ordered array of phase numbers for this ring

  function handleDragStart(phNum, pos) {
    setDragState({ phNum, ring: ringNum, pos })
  }

  function handleDragOver(phNum) {
    // visual feedback handled inside cell
  }

  function handleDrop(targetPos, targetPhNum) {
    if (!dragState) return
    const { phNum: srcPh, ring: srcRing, pos: srcPos } = dragState

    if (srcRing === ringNum) {
      // Reorder within same ring
      const newPhases = [...phases]
      newPhases.splice(srcPos, 1)
      const insertAt = newPhases.indexOf(targetPhNum)
      newPhases.splice(insertAt >= 0 ? insertAt : newPhases.length, 0, srcPh)
      onRingConfigUpdate({ [`ring${ringNum}`]: newPhases })
    } else {
      // Move between rings: remove from source ring, insert in target ring
      const srcKey = `ring${srcRing}`
      const tgtKey = `ring${ringNum}`
      const srcRingPhases = [...(ix.ring_config?.[srcKey] || [])]
      const tgtRingPhases = [...phases]
      srcRingPhases.splice(srcRingPhases.indexOf(srcPh), 1)
      const insertAt = tgtRingPhases.indexOf(targetPhNum)
      tgtRingPhases.splice(insertAt >= 0 ? insertAt : tgtRingPhases.length, 0, srcPh)
      onRingConfigUpdate({ [srcKey]: srcRingPhases, [tgtKey]: tgtRingPhases })
    }
    setDragState(null)
  }

  function handleDropOnBarrierSlot(slotPos) {
    // slotPos = new barrier_pos value (how many cells are to its left)
    if (dragState && dragState.ring !== ringNum) return
    onRingConfigUpdate({ barrier_pos: slotPos })
    setDragState(null)
  }

  const dragActive = !!dragState

  // Build rendered elements: cells interleaved with slot dividers, plus the barrier
  const elements = []
  phases.forEach((phNum, i) => {
    // Slot before each cell (for barrier drop)
    elements.push(
      <BarrierSlot
        key={`slot-${i}`}
        pos={i}
        isBarrier={i === barrier_pos}
        onDrop={handleDropOnBarrierSlot}
        onDragOver={() => {}}
        dragActive={dragActive}
      />
    )
    elements.push(
      <PhaseCell
        key={phNum}
        phNum={phNum}
        ix={ix}
        plan={plan}
        isDragOver={dragState && dragState.phNum !== phNum && dragState.ring === ringNum}
        isDragging={dragState?.phNum === phNum}
        onPhaseUpdate={onPhaseUpdate}
        onSplitUpdate={onSplitUpdate}
        onPedUpdate={onPedUpdate}
        onDragStart={() => handleDragStart(phNum, i)}
        onDragOver={() => handleDragOver(phNum)}
        onDrop={() => handleDrop(i, phNum)}
        onDragEnd={() => setDragState(null)}
      />
    )
  })
  // Trailing slot (for barrier at end)
  elements.push(
    <BarrierSlot
      key="slot-end"
      pos={phases.length}
      isBarrier={barrier_pos >= phases.length}
      onDrop={handleDropOnBarrierSlot}
      onDragOver={() => {}}
      dragActive={dragActive}
    />
  )

  // Drop zone when ring is empty
  const isEmpty = phases.length === 0
  return (
    <div className="flex items-stretch min-h-[110px]">
      <div className="flex items-center justify-center w-10 shrink-0">
        <span className="text-xs font-semibold text-gray-500 tracking-wider"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          Ring {ringNum}
        </span>
      </div>
      <div
        className={`flex items-start gap-0 flex-1 py-2 pr-2 rounded-lg transition-colors ${
          isEmpty
            ? 'border-2 border-dashed border-gray-600 bg-gray-900/30 justify-center items-center'
            : ''
        }`}
        onDragOver={(e) => { if (isEmpty) e.preventDefault() }}
        onDrop={(e) => {
          if (!isEmpty || !dragState) return
          e.preventDefault()
          const { phNum: srcPh, ring: srcRing } = dragState
          const srcKey = `ring${srcRing}`
          const tgtKey = `ring${ringNum}`
          const srcPhases = [...(ix.ring_config?.[srcKey] || [])]
          srcPhases.splice(srcPhases.indexOf(srcPh), 1)
          onRingConfigUpdate({ [srcKey]: srcPhases, [tgtKey]: [srcPh] })
          setDragState(null)
        }}
      >
        {isEmpty ? (
          <span className="text-xs text-gray-600 italic">Drop phases here</span>
        ) : (
          elements
        )}
      </div>
    </div>
  )
}

// ── Overlaps editor ───────────────────────────────────────────────────────────

function OverlapsEditor({ ix, onUpdate }) {
  const overlaps = ix.overlaps || []
  const activePhaseNums = ALL_PHASES.filter((n) => isActive(ix, n))

  function addOverlap() {
    const used = overlaps.map((o) => o.label)
    const label = OVERLAP_LABELS.find((l) => !used.includes(l)) || `OL${overlaps.length + 1}`
    onUpdate({ overlaps: [...overlaps, { label, phases: [] }] })
  }

  function updateOverlap(idx, changes) {
    const next = [...overlaps]
    next[idx] = { ...next[idx], ...changes }
    onUpdate({ overlaps: next })
  }

  function removeOverlap(idx) {
    const next = [...overlaps]
    next.splice(idx, 1)
    onUpdate({ overlaps: next })
  }

  function togglePhase(idx, phNum) {
    const ov = overlaps[idx]
    const phases = [...(ov.phases || [])]
    const pos = phases.indexOf(phNum)
    if (pos >= 0) phases.splice(pos, 1)
    else phases.push(phNum)
    phases.sort((a, b) => a - b)
    updateOverlap(idx, { phases })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-300">Overlap Phases</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            NEMA overlaps A–D run concurrent with selected phases.
          </p>
        </div>
        <button onClick={addOverlap} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Overlap
        </button>
      </div>

      {overlaps.length === 0 ? (
        <p className="text-gray-600 text-xs italic">No overlaps defined.</p>
      ) : (
        <div className="space-y-2">
          {overlaps.map((ov, idx) => (
            <div key={idx} className="flex items-center gap-3 px-3 py-2.5 bg-gray-900/60 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-500">Overlap</span>
                <input
                  type="text"
                  className="bg-gray-800 border border-gray-600 rounded text-white text-xs text-center w-10 py-0.5 font-bold focus:border-blue-500 focus:outline-none uppercase"
                  value={ov.label}
                  maxLength={4}
                  onChange={(e) => updateOverlap(idx, { label: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="flex items-center gap-1 flex-1 flex-wrap">
                <span className="text-xs text-gray-500 mr-1">phases:</span>
                {activePhaseNums.map((n) => {
                  const on = (ov.phases || []).includes(n)
                  return (
                    <button
                      key={n}
                      onClick={() => togglePhase(idx, n)}
                      className={`w-7 h-7 rounded-full text-xs font-bold border transition-colors ${
                        on
                          ? 'bg-purple-700 border-purple-500 text-white'
                          : 'bg-gray-800 border-gray-600 text-gray-500 hover:border-gray-400'
                      }`}
                    >{n}</button>
                  )
                })}
              </div>
              <button
                onClick={() => removeOverlap(idx)}
                className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main exported component ───────────────────────────────────────────────────

export default function RingBarrierEditor({ ix, activePlan, onUpdate }) {
  const [plan, setPlan] = useState(activePlan || 'AM')
  const [dragState, setDragState] = useState(null) // { phNum, ring, pos }

  const { ring1, ring2, barrier_pos } = getRingConfig(ix)
  const warnings = validate(ix, plan)

  // All phase numbers that exist in neither ring (unassigned)
  const assignedPhases = new Set([...ring1, ...ring2])
  const unassigned = ALL_PHASES.filter((n) => !assignedPhases.has(n))

  function onPhaseUpdate(key, changes) {
    const nema_phases = { ...(ix.nema_phases || {}) }
    nema_phases[key] = { ...(nema_phases[key] || {}), ...changes }
    onUpdate({ nema_phases })
  }

  function onSplitUpdate(key, value) {
    const timing_plans = { ...(ix.timing_plans || {}) }
    const pd = { ...(timing_plans[plan] || {}) }
    pd.splits = { ...(pd.splits || {}), [key]: Number(value) }
    timing_plans[plan] = pd
    onUpdate({ timing_plans })
  }

  function onPedUpdate(action) {
    const ped_phases = [...(ix.ped_phases || [])]
    if (action.add) {
      if (!ped_phases.find((p) => p.phase === action.add.phase))
        ped_phases.push(action.add)
    } else if (action.remove != null) {
      const i = ped_phases.findIndex((p) => p.phase === action.remove)
      if (i >= 0) ped_phases.splice(i, 1)
    } else if (action.update) {
      const i = ped_phases.findIndex((p) => p.phase === action.update.phase)
      if (i >= 0) ped_phases[i] = { ...ped_phases[i], ...action.update }
    }
    onUpdate({ ped_phases })
  }

  function onRingConfigUpdate(changes) {
    const rc = getRingConfig(ix)
    onUpdate({ ring_config: { ...rc, ...changes } })
  }

  function resetToDefault() {
    onUpdate({ ring_config: { ...DEFAULT_RING_CONFIG } })
  }

  const dragActive = !!dragState
  const sharedProps = { ix, plan, dragState, setDragState, onPhaseUpdate, onSplitUpdate, onPedUpdate, onRingConfigUpdate }

  return (
    <div className="space-y-4">
      {/* Plan switcher + reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
            {PLANS.map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  plan === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >{p}</button>
            ))}
          </div>
          <span className="text-xs text-gray-500">
            Cycle: <strong className="text-gray-300">{ix.timing_plans?.[plan]?.cycle || 120}s</strong>
            &nbsp;·&nbsp;Offset: <strong className="text-gray-300">{ix.timing_plans?.[plan]?.offset ?? 0}s</strong>
          </span>
        </div>
        <button
          onClick={resetToDefault}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          title="Reset ring-barrier layout to standard NEMA 4+4"
        >
          Reset to 4+4 default
        </button>
      </div>

      {/* ── Ring-barrier diagram ─────────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden">
        {/* Legend */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-700/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Ring-Barrier Diagram</h3>
          <div className="flex items-center gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500" /> Active
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-1 bg-gray-400" /> Barrier ‖
            </span>
            <span className="flex items-center gap-1">
              <span>🚶</span> Ped phase
            </span>
            <span className="text-gray-600 italic">Drag cells to reorder · Drag over barrier slot to move barrier</span>
          </div>
        </div>

        <div className="p-3 space-y-0 overflow-x-auto" onDragOver={(e) => e.preventDefault()}>
          {/* Ring 1 */}
          <RingRow ringNum={1} phases={ring1} barrier_pos={barrier_pos} {...sharedProps} />

          {/* Divider between rings with concurrent phase labels */}
          <div className="flex items-center my-1">
            <div className="w-14 shrink-0" />
            <div className="flex-1 h-px bg-gray-700/60 relative">
              <span className="absolute left-2 -top-2 text-[9px] text-gray-600 bg-gray-900 px-1">concurrent</span>
            </div>
          </div>

          {/* Ring 2 */}
          <RingRow ringNum={2} phases={ring2} barrier_pos={barrier_pos} {...sharedProps} />
        </div>

        {/* Unassigned phases pool */}
        {unassigned.length > 0 && (
          <div className="px-4 pb-3 border-t border-gray-700/50 pt-3">
            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-500 shrink-0 mt-1.5">Unassigned:</span>
              <div className="flex gap-3 flex-wrap">
                {unassigned.map((n) => {
                  const active = isActive(ix, n)
                  return (
                    <div key={n} className="flex items-center gap-1">
                      {/* Draggable chip */}
                      <div
                        draggable
                        onDragStart={() => setDragState({ phNum: n, ring: 0, pos: -1 })}
                        onDragEnd={() => setDragState(null)}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-gray-600 bg-gray-800/50 cursor-grab text-xs text-gray-400 hover:border-gray-400 hover:text-gray-300 transition-colors"
                        title="Drag into a ring"
                      >
                        <span className={`font-bold ${active ? 'text-white' : 'text-gray-600'}`}>φ{n}</span>
                        <span className="text-gray-600">{active ? '●' : '○'}</span>
                      </div>
                      {/* Click-to-add buttons */}
                      <button
                        title="Add to Ring 1"
                        onClick={() => onRingConfigUpdate({ ring1: [...ring1, n] })}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-500 hover:text-blue-300 hover:border-blue-600 transition-colors font-mono leading-none"
                      >→R1</button>
                      <button
                        title="Add to Ring 2"
                        onClick={() => onRingConfigUpdate({ ring2: [...ring2, n] })}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-500 hover:text-blue-300 hover:border-blue-600 transition-colors font-mono leading-none"
                      >→R2</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Validation warnings */}
        {warnings.length > 0 && (
          <div className="px-4 pb-3 space-y-1.5 border-t border-gray-700/50 pt-3">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded px-2.5 py-1.5">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {w.msg}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Direction assignment ─────────────────────────────────────────── */}
      <DirectionAssignment ix={ix} ring1={ring1} ring2={ring2} onUpdate={onUpdate} />

      {/* ── Overlaps ─────────────────────────────────────────────────────── */}
      <div className="card">
        <OverlapsEditor ix={ix} onUpdate={onUpdate} />
      </div>
    </div>
  )
}

// ── Direction assignment (compact inline) ─────────────────────────────────────

function DirectionAssignment({ ix, ring1, ring2, onUpdate }) {
  const allPhaseNums = [...ring1, ...ring2].filter((n) => isActive(ix, n))

  function updateAssignment(dir, mv, phNum) {
    const pa = { ...(ix.phase_assignments || {}) }
    pa[dir] = { ...(pa[dir] || {}), [mv]: Number(phNum) }
    onUpdate({ phase_assignments: pa })
  }

  const activeDirections = (() => {
    switch (ix.type) {
      case '2-leg': return ['NB', 'SB']
      case '3-leg': return ['NB', 'SB', 'EB']
      default:      return ['NB', 'SB', 'EB', 'WB']
    }
  })()

  const pa = ix.phase_assignments || {}

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-300">Direction → Phase Assignment</h4>
        <button
          onClick={() => onUpdate({
            phase_assignments: {
              EB: { L: 1, T: 2, R: 2 }, WB: { L: 5, T: 6, R: 6 },
              NB: { L: 3, T: 4, R: 4 }, SB: { L: 7, T: 8, R: 8 },
            }
          })}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >Reset to standard</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Dir</th>
              <th className="px-2 py-1.5 text-gray-500 font-medium text-center">Left (φ)</th>
              <th className="px-2 py-1.5 text-gray-500 font-medium text-center">Thru (φ)</th>
              <th className="px-2 py-1.5 text-gray-500 font-medium text-center">Right (φ)</th>
            </tr>
          </thead>
          <tbody>
            {activeDirections.map((dir) => {
              const dirPa = pa[dir] || {}
              return (
                <tr key={dir} className="border-t border-gray-700/50">
                  <td className="px-2 py-1.5 font-semibold text-gray-300">{dir}</td>
                  {['L', 'T', 'R'].map((mv) => (
                    <td key={mv} className="px-2 py-1.5 text-center">
                      <select
                        className="bg-gray-800 border border-gray-600 rounded text-gray-200 text-xs py-0.5 px-1 focus:border-blue-500 focus:outline-none w-16"
                        value={dirPa[mv] ?? ''}
                        onChange={(e) => updateAssignment(dir, mv, e.target.value)}
                      >
                        {allPhaseNums.map((n) => (
                          <option key={n} value={n}>φ{n}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
