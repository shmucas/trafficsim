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

// ── Phase colour palette ──────────────────────────────────────────────────────
const PH_COLORS = {
  '1': '#f59e0b', '2': '#10b981', '3': '#3b82f6', '4': '#6366f1',
  '5': '#ec4899', '6': '#0ea5e9', '7': '#f97316', '8': '#a855f7',
}
function phColor(ph) { return PH_COLORS[String(ph)] || '#9ca3af' }

// ── Intersection Phasing Schematic ────────────────────────────────────────────
//  Top-down view of the intersection showing each L/T/R movement
//  coloured by its assigned NEMA phase number.

function PhasingSchematic({ ix }) {
  const pa = ix.phase_assignments || {}
  const ixType = ix.type || '4-leg'

  const activeDirs = ixType === '2-leg' ? ['NB', 'SB']
    : ixType === '3-leg' ? ['NB', 'SB', 'EB']
    : ['NB', 'SB', 'EB', 'WB']

  const W = 360, H = 300
  const cx = W / 2, cy = H / 2
  // Intersection box
  const bW = 76, bH = 76
  const bx = cx - bW / 2, by = cy - bH / 2
  // Road half-widths
  const rHalf = 16   // 16px each direction → 32px total road width
  // Approach arrow geometry
  const STUB = 72    // length of road stub beyond box edge

  // Badge element: coloured rect + movement + phase label
  function Badge({ x, y, mv, ph, rotate = 0 }) {
    if (!ph) return null
    const bg = phColor(ph)
    return (
      <g transform={`translate(${x},${y}) rotate(${rotate})`}>
        <rect x={-18} y={-11} width={36} height={22} rx={5} fill={bg} />
        <text textAnchor="middle" y={-1} fill="#fff" fontSize={9} fontWeight="bold" fontFamily="monospace">{mv}</text>
        <text textAnchor="middle" y={9}  fill="#fff" fontSize={8} fontFamily="monospace">φ{ph}</text>
      </g>
    )
  }

  // Arrow head helper (draws a filled triangle arrowhead)
  function Arrowhead({ x, y, angle }) {
    const r = 5
    return (
      <polygon
        points={`0,${-r} ${r * 0.6},${r * 0.5} ${-r * 0.6},${r * 0.5}`}
        fill="#9ca3af"
        transform={`translate(${x},${y}) rotate(${angle})`}
      />
    )
  }

  // Lane centrelines for each direction (right-hand traffic)
  // NB: right half of NS road → x = cx + rHalf/2
  // SB: left  half of NS road → x = cx - rHalf/2
  // EB: bottom half of EW road → y = cy + rHalf/2
  // WB: top   half of EW road → y = cy - rHalf/2
  const NB_X = cx + rHalf / 2
  const SB_X = cx - rHalf / 2
  const EB_Y = cy + rHalf / 2
  const WB_Y = cy - rHalf / 2

  return (
    <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
      <div>
        <div className="text-xs font-semibold mb-2" style={{ color: '#111111' }}>Movement → Phase Map</div>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          {/* Background */}
          <rect width={W} height={H} fill="#f3f4f6" rx={8} />

          {/* EW road */}
          <rect x={0} y={cy - rHalf} width={W} height={rHalf * 2} fill="#374151" />
          {/* NS road */}
          {activeDirs.some(d => d === 'NB' || d === 'SB') && (
            <rect x={cx - rHalf} y={0} width={rHalf * 2} height={H} fill="#374151" />
          )}
          {/* Intersection box */}
          <rect x={bx} y={by} width={bW} height={bH} fill="#4b5563" />

          {/* Centre dashes */}
          <line x1={0} y1={cy} x2={bx} y2={cy} stroke="#9ca3af" strokeWidth={1} strokeDasharray="6 5" />
          <line x1={bx + bW} y1={cy} x2={W} y2={cy} stroke="#9ca3af" strokeWidth={1} strokeDasharray="6 5" />
          {activeDirs.some(d => d === 'NB' || d === 'SB') && <>
            <line x1={cx} y1={0} x2={cx} y2={by} stroke="#9ca3af" strokeWidth={1} strokeDasharray="6 5" />
            <line x1={cx} y1={by + bH} x2={cx} y2={H} stroke="#9ca3af" strokeWidth={1} strokeDasharray="6 5" />
          </>}

          {/* Stop bars */}
          {activeDirs.includes('NB') && <line x1={cx} y1={by + bH} x2={cx + rHalf} y2={by + bH} stroke="#f9fafb" strokeWidth={2} />}
          {activeDirs.includes('SB') && <line x1={cx - rHalf} y1={by} x2={cx} y2={by} stroke="#f9fafb" strokeWidth={2} />}
          {activeDirs.includes('EB') && <line x1={bx} y1={cy} x2={bx} y2={cy + rHalf} stroke="#f9fafb" strokeWidth={2} />}
          {activeDirs.includes('WB') && <line x1={bx + bW} y1={cy - rHalf} x2={bx + bW} y2={cy} stroke="#f9fafb" strokeWidth={2} />}

          {/* Direction travel arrows (thin grey lines with arrowheads) */}
          {activeDirs.includes('NB') && <>
            <line x1={NB_X} y1={by + bH + STUB} x2={NB_X} y2={by + bH + 10} stroke="#9ca3af" strokeWidth={1.5} />
            <Arrowhead x={NB_X} y={by + bH + 10} angle={0} />
          </>}
          {activeDirs.includes('SB') && <>
            <line x1={SB_X} y1={by - STUB} x2={SB_X} y2={by - 10} stroke="#9ca3af" strokeWidth={1.5} />
            <Arrowhead x={SB_X} y={by - 10} angle={180} />
          </>}
          {activeDirs.includes('EB') && <>
            <line x1={bx - STUB} y1={EB_Y} x2={bx - 10} y2={EB_Y} stroke="#9ca3af" strokeWidth={1.5} />
            <Arrowhead x={bx - 10} y={EB_Y} angle={90} />
          </>}
          {activeDirs.includes('WB') && <>
            <line x1={bx + bW + STUB} y1={WB_Y} x2={bx + bW + 10} y2={WB_Y} stroke="#9ca3af" strokeWidth={1.5} />
            <Arrowhead x={bx + bW + 10} y={WB_Y} angle={-90} />
          </>}

          {/* "N" label */}
          {activeDirs.includes('NB') && (
            <text x={cx} y={14} textAnchor="middle" fill="#6b7280" fontSize={10} fontWeight="bold" fontFamily="sans-serif">N</text>
          )}

          {/* ── NB movement badges (south leg, entering from bottom) ── */}
          {activeDirs.includes('NB') && (() => {
            const yRow = by + bH + 42
            return <>
              <Badge x={NB_X - 26} y={yRow} mv="L" ph={pa.NB?.L} />
              <Badge x={NB_X}      y={yRow + 18} mv="T" ph={pa.NB?.T} />
              <Badge x={NB_X + 26} y={yRow} mv="R" ph={pa.NB?.R} />
            </>
          })()}

          {/* ── SB movement badges (north leg, entering from top) ── */}
          {activeDirs.includes('SB') && (() => {
            const yRow = by - 42
            return <>
              <Badge x={SB_X + 26} y={yRow} mv="L" ph={pa.SB?.L} />
              <Badge x={SB_X}      y={yRow - 18} mv="T" ph={pa.SB?.T} />
              <Badge x={SB_X - 26} y={yRow} mv="R" ph={pa.SB?.R} />
            </>
          })()}

          {/* ── EB movement badges (west leg, entering from left) ── */}
          {activeDirs.includes('EB') && (() => {
            const xCol = bx - 44
            return <>
              <Badge x={xCol} y={EB_Y - 26} mv="L" ph={pa.EB?.L} />
              <Badge x={xCol - 18} y={EB_Y}    mv="T" ph={pa.EB?.T} />
              <Badge x={xCol} y={EB_Y + 26} mv="R" ph={pa.EB?.R} />
            </>
          })()}

          {/* ── WB movement badges (east leg, entering from right) ── */}
          {activeDirs.includes('WB') && (() => {
            const xCol = bx + bW + 44
            return <>
              <Badge x={xCol} y={WB_Y + 26} mv="L" ph={pa.WB?.L} />
              <Badge x={xCol + 18} y={WB_Y}    mv="T" ph={pa.WB?.T} />
              <Badge x={xCol} y={WB_Y - 26} mv="R" ph={pa.WB?.R} />
            </>
          })()}

          {/* Intersection label */}
          <text x={cx} y={cy + 5} textAnchor="middle" fill="#9ca3af" fontSize={9} fontFamily="monospace" fontWeight="bold">
            {ix.name ? (ix.name.length > 10 ? ix.name.slice(0, 9) + '…' : ix.name) : 'INTERSECTION'}
          </text>
        </svg>

        {/* Phase colour legend */}
        <div className="flex flex-wrap gap-2 mt-2 justify-center">
          {Object.entries(PH_COLORS).map(([ph, color]) => (
            <span
              key={ph}
              className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5"
              style={{ backgroundColor: color, color: '#fff', borderRadius: 4 }}
            >
              φ{ph}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

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

  const activeCount = (arr) => arr.filter((n) => isActive(ix, n)).length
  if (r1L.length > 0 && activeCount(r1L) === 0)
    warnings.push({ ring: 1, side: 'left',  msg: 'Ring 1 left: no active phases before barrier.' })
  if (r1R.length > 0 && activeCount(r1R) === 0)
    warnings.push({ ring: 1, side: 'right', msg: 'Ring 1 right: no active phases after barrier.' })
  if (r2L.length > 0 && activeCount(r2L) === 0)
    warnings.push({ ring: 2, side: 'left',  msg: 'Ring 2 left: no active phases before barrier.' })
  if (r2R.length > 0 && activeCount(r2R) === 0)
    warnings.push({ ring: 2, side: 'right', msg: 'Ring 2 right: no active phases after barrier.' })

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

  const cellStyle = {
    minWidth: 88,
    width: 88,
    borderRadius: 3,
    backgroundColor: active ? '#FFFFFF' : '#F5F5F4',
    border: active
      ? (isDragOver ? '1px solid #111111' : '1px solid #111111')
      : '1px solid #E2E2E0',
    borderLeft: active ? '3px solid #111111' : '1px solid #E2E2E0',
    opacity: active ? 1 : 0.5,
    outline: isDragging ? '2px solid #111111' : 'none',
    outlineOffset: 1,
  }

  const inputStyle = {
    borderRadius: 2,
    height: 18,
    padding: '0 2px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E2E0',
    color: '#111111',
    fontSize: 10,
    textAlign: 'center',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const inputFocus = (e) => { e.target.style.borderColor = '#111111' }
  const inputBlur  = (e) => { e.target.style.borderColor = '#E2E2E0' }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e) }}
      onDrop={(e) => { e.preventDefault(); onDrop(e) }}
      onDragEnd={onDragEnd}
      className="relative flex flex-col select-none cursor-grab active:cursor-grabbing transition-all"
      style={cellStyle}
    >
      {/* Header: phase number + toggles */}
      <div className="flex items-center justify-between px-1.5 pt-1.5 pb-1">
        <span className="text-xs font-bold" style={{ color: active ? '#111111' : '#AAAAAA' }}>
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
            className="text-[9px] px-1 py-0 leading-4 transition-colors font-bold"
            style={{
              borderRadius: 2,
              backgroundColor: hasPed ? '#111111' : 'transparent',
              color: hasPed ? '#FFFFFF' : '#BBBBBB',
              border: hasPed ? 'none' : 'none',
            }}
          >P</button>
          {/* Active toggle */}
          <button
            title={active ? 'Deactivate phase' : 'Activate phase'}
            onClick={() => onPhaseUpdate(key, { active: !active })}
            className="w-3 h-3 border flex items-center justify-center transition-colors"
            style={{
              borderRadius: '50%',
              backgroundColor: active ? '#111111' : '#FFFFFF',
              borderColor: active ? '#111111' : '#CCCCCC',
            }}
          >
            <span
              className="block w-1.5 h-1.5"
              style={{ borderRadius: '50%', backgroundColor: active ? '#FFFFFF' : '#DDDDDD' }}
            />
          </button>
        </div>
      </div>

      {/* Body — only shown when active */}
      {active && (
        <div className="px-1.5 pb-1.5 space-y-1 flex-1">
          {/* Split input */}
          <div className="flex items-center gap-0.5">
            <label className="text-[9px] w-6 shrink-0" style={{ color: '#888888' }}>Spl</label>
            <input
              type="number"
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
              value={split}
              onChange={(e) => onSplitUpdate(key, e.target.value)}
              min={0} max={cycle} step={1}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-[9px]" style={{ color: '#888888' }}>s</span>
          </div>

          {/* Green bar */}
          <div
            className="flex h-1.5 overflow-hidden"
            style={{ borderRadius: 2 }}
            title={`Eff green ${eg}s / Yellow ${yellow}s / All-red ${allRed}s`}
          >
            <div style={{ width: `${pctG}%`, backgroundColor: '#16A34A' }} />
            <div style={{ width: `${pctY}%`, backgroundColor: '#CA8A04' }} />
            <div style={{ width: `${pctR}%`, backgroundColor: '#DC2626' }} />
            <div style={{ flex: 1, backgroundColor: '#F0F0EE' }} />
          </div>

          {/* Min / Max green */}
          <div className="grid grid-cols-2 gap-0.5">
            <div>
              <div className="text-[8px] mb-0.5" style={{ color: minViol ? '#EF4444' : '#888888' }}>
                Min{minViol ? '!' : ''}
              </div>
              <input
                type="number"
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
                value={minG}
                onChange={(e) => onPhaseUpdate(key, { min_green: Number(e.target.value) })}
                min={1} max={120} step={1}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div>
              <div className="text-[8px] mb-0.5" style={{ color: maxViol ? '#EF4444' : '#888888' }}>
                Max{maxViol ? '!' : ''}
              </div>
              <input
                type="number"
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
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
              <div className="text-[8px] mb-0.5" style={{ color: '#888888' }}>Yel</div>
              <input
                type="number"
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
                value={yellow}
                onChange={(e) => onPhaseUpdate(key, { yellow: Number(e.target.value) })}
                min={1} max={10} step={0.5}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div>
              <div className="text-[8px] mb-0.5" style={{ color: '#888888' }}>AR</div>
              <input
                type="number"
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
                value={allRed}
                onChange={(e) => onPhaseUpdate(key, { all_red: Number(e.target.value) })}
                min={0} max={10} step={0.5}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Recall */}
          <select
            style={{
              ...inputStyle,
              fontSize: 9,
              padding: '0 2px',
            }}
            onFocus={inputFocus}
            onBlur={inputBlur}
            value={phase.recall || 'None'}
            onChange={(e) => onPhaseUpdate(key, { recall: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          >
            {RECALL_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Ped inputs */}
          {hasPed && (
            <div className="pt-0.5 space-y-0.5" style={{ borderTop: '1px solid #E2E2E0' }}>
              <div className="flex items-center gap-0.5">
                <span className="text-[8px] w-5" style={{ color: '#888888' }}>Wlk</span>
                <input
                  type="number"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                  value={ped.walk_s}
                  onChange={(e) => onPedUpdate({ update: { phase: phNum, walk_s: Number(e.target.value) } })}
                  min={1} max={60}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-[8px] w-5" style={{ color: '#888888' }}>Clr</span>
                <input
                  type="number"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
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
      <div className="absolute top-1 left-1 pointer-events-none" style={{ opacity: 0.15 }}>
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
        <div
          className="relative flex flex-col items-center justify-center h-full transition-colors"
          title="Drag a cell here to move barrier"
        >
          <div className="w-px h-full absolute" style={{ left: '50%', backgroundColor: '#111111' }} />
          <div
            className="z-10 px-0.5 py-1 text-[9px] font-bold tracking-widest"
            style={{
              writingMode: 'horizontal-tb',
              backgroundColor: '#F8F8F7',
              border: '1px solid #E2E2E0',
              color: '#111111',
              borderRadius: 2,
            }}
          >
            ‖
          </div>
          {dragActive && (
            <div
              className="absolute inset-0 transition-colors"
              style={{
                border: over ? '2px solid #111111' : '2px solid transparent',
                backgroundColor: over ? 'rgba(17,17,17,0.05)' : 'transparent',
                borderRadius: 2,
              }}
            />
          )}
        </div>
      ) : (
        dragActive && (
          <div
            className="h-full transition-colors"
            style={{
              width: over ? 6 : 4,
              backgroundColor: over ? '#111111' : 'transparent',
              borderRadius: 1,
            }}
          />
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
  function handleDragStart(phNum, pos) {
    setDragState({ phNum, ring: ringNum, pos })
  }

  function handleDragOver(phNum) {}

  function handleDrop(targetPos, targetPhNum) {
    if (!dragState) return
    const { phNum: srcPh, ring: srcRing, pos: srcPos } = dragState

    if (srcRing === ringNum) {
      const newPhases = [...phases]
      newPhases.splice(srcPos, 1)
      const insertAt = newPhases.indexOf(targetPhNum)
      newPhases.splice(insertAt >= 0 ? insertAt : newPhases.length, 0, srcPh)
      onRingConfigUpdate({ [`ring${ringNum}`]: newPhases })
    } else {
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
    if (dragState && dragState.ring !== ringNum) return
    onRingConfigUpdate({ barrier_pos: slotPos })
    setDragState(null)
  }

  const dragActive = !!dragState

  const elements = []
  phases.forEach((phNum, i) => {
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

  const isEmpty = phases.length === 0
  return (
    <div className="flex items-stretch min-h-[110px]">
      <div className="flex items-center justify-center w-10 shrink-0">
        <span
          className="text-xs font-semibold tracking-wider"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: '#888888' }}
        >
          Ring {ringNum}
        </span>
      </div>
      <div
        className="flex items-start gap-0 flex-1 py-2 pr-2 transition-colors"
        style={isEmpty ? {
          border: '1px dashed #E2E2E0',
          backgroundColor: '#F8F8F7',
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 3,
        } : {}}
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
          <span className="text-xs italic" style={{ color: '#AAAAAA' }}>Drop phases here</span>
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
          <h4 className="text-sm font-semibold" style={{ color: '#111111' }}>Overlap Phases</h4>
          <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
            NEMA overlaps A–D run concurrent with selected phases.
          </p>
        </div>
        <button onClick={addOverlap} className="btn-secondary gap-1.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Overlap
        </button>
      </div>

      {overlaps.length === 0 ? (
        <p className="text-xs italic" style={{ color: '#AAAAAA' }}>No overlaps defined.</p>
      ) : (
        <div className="space-y-2">
          {overlaps.map((ov, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 px-3 py-2.5"
              style={{ border: '1px solid #E2E2E0', borderRadius: 3, backgroundColor: '#FAFAF9' }}
            >
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs" style={{ color: '#888888' }}>Overlap</span>
                <input
                  type="text"
                  className="text-xs text-center font-bold w-10 py-0.5 uppercase"
                  style={{ border: '1px solid #E2E2E0', borderRadius: 3, color: '#111111', backgroundColor: '#FFFFFF', outline: 'none' }}
                  value={ov.label}
                  maxLength={4}
                  onChange={(e) => updateOverlap(idx, { label: e.target.value.toUpperCase() })}
                  onFocus={(e) => e.target.style.borderColor = '#111111'}
                  onBlur={(e) => e.target.style.borderColor = '#E2E2E0'}
                />
              </div>
              <div className="flex items-center gap-1 flex-1 flex-wrap">
                <span className="text-xs mr-1" style={{ color: '#888888' }}>phases:</span>
                {activePhaseNums.map((n) => {
                  const on = (ov.phases || []).includes(n)
                  return (
                    <button
                      key={n}
                      onClick={() => togglePhase(idx, n)}
                      className="w-7 h-7 rounded-full text-xs font-bold transition-colors"
                      style={{
                        backgroundColor: on ? '#111111' : '#FFFFFF',
                        border: on ? '1px solid #111111' : '1px solid #E2E2E0',
                        color: on ? '#FFFFFF' : '#888888',
                      }}
                    >{n}</button>
                  )
                })}
              </div>
              <button
                onClick={() => removeOverlap(idx)}
                className="transition-colors shrink-0"
                style={{ color: '#BBBBBB' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#BBBBBB'}
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
  const [dragState, setDragState] = useState(null)

  const { ring1, ring2, barrier_pos } = getRingConfig(ix)
  const warnings = validate(ix, plan)

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
      {/* ── Phasing schematic ────────────────────────────────────────────── */}
      <div className="card">
        <PhasingSchematic ix={ix} />
      </div>

      {/* Plan switcher + reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex gap-0.5 p-0.5"
            style={{ backgroundColor: '#F0F0EE', border: '1px solid #E2E2E0', borderRadius: 3 }}
          >
            {PLANS.map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className="px-3 py-1 text-xs font-semibold transition-colors"
                style={{
                  borderRadius: 2,
                  backgroundColor: plan === p ? '#111111' : 'transparent',
                  color: plan === p ? '#FFFFFF' : '#888888',
                  border: 'none',
                }}
              >{p}</button>
            ))}
          </div>
          <span className="text-xs" style={{ color: '#888888' }}>
            Cycle: <strong style={{ color: '#111111' }}>{ix.timing_plans?.[plan]?.cycle || 120}s</strong>
            &nbsp;·&nbsp;Offset: <strong style={{ color: '#111111' }}>{ix.timing_plans?.[plan]?.offset ?? 0}s</strong>
          </span>
        </div>
        <button
          onClick={resetToDefault}
          className="text-xs transition-colors"
          style={{ color: '#AAAAAA', background: 'none', border: 'none' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#111111'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#AAAAAA'}
          title="Reset ring-barrier layout to standard NEMA 4+4"
        >
          Reset to 4+4 default
        </button>
      </div>

      {/* ── Ring-barrier diagram ─────────────────────────────────────────── */}
      <div className="card !p-0 overflow-hidden">
        {/* Legend */}
        <div
          className="px-4 pt-3 pb-2 flex items-center justify-between"
          style={{ borderBottom: '1px solid #E2E2E0' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: '#111111' }}>Ring-Barrier Diagram</h3>
          <div className="flex items-center gap-4 text-[10px]" style={{ color: '#888888' }}>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3"
                style={{ backgroundColor: '#111111', borderRadius: '50%' }}
              /> Active
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-1" style={{ backgroundColor: '#111111' }} /> Barrier ‖
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold"
                style={{ border: '1px solid #111111', borderRadius: 2, color: '#111111' }}
              >P</span> Ped phase
            </span>
            <span className="italic" style={{ color: '#AAAAAA' }}>Drag cells to reorder</span>
          </div>
        </div>

        <div className="p-3 space-y-0 overflow-x-auto" onDragOver={(e) => e.preventDefault()}>
          <RingRow ringNum={1} phases={ring1} barrier_pos={barrier_pos} {...sharedProps} />

          {/* Divider between rings */}
          <div className="flex items-center my-1">
            <div className="w-14 shrink-0" />
            <div className="flex-1 h-px relative" style={{ backgroundColor: '#E2E2E0' }}>
              <span
                className="absolute left-2 -top-2 text-[9px] px-1"
                style={{ color: '#AAAAAA', backgroundColor: '#FFFFFF' }}
              >concurrent</span>
            </div>
          </div>

          <RingRow ringNum={2} phases={ring2} barrier_pos={barrier_pos} {...sharedProps} />
        </div>

        {/* Unassigned phases pool */}
        {unassigned.length > 0 && (
          <div className="px-4 pb-3 pt-3" style={{ borderTop: '1px solid #E2E2E0' }}>
            <div className="flex items-start gap-3">
              <span className="text-xs shrink-0 mt-1.5" style={{ color: '#888888' }}>Unassigned:</span>
              <div className="flex gap-3 flex-wrap">
                {unassigned.map((n) => {
                  const active = isActive(ix, n)
                  return (
                    <div key={n} className="flex items-center gap-1">
                      <div
                        draggable
                        onDragStart={() => setDragState({ phNum: n, ring: 0, pos: -1 })}
                        onDragEnd={() => setDragState(null)}
                        className="flex items-center gap-1 px-2 py-1 cursor-grab text-xs transition-colors"
                        style={{
                          border: '1px dashed #E2E2E0',
                          backgroundColor: '#F8F8F7',
                          borderRadius: 3,
                          color: '#888888',
                        }}
                        title="Drag into a ring"
                      >
                        <span className="font-bold" style={{ color: active ? '#111111' : '#BBBBBB' }}>φ{n}</span>
                        <span style={{ color: '#CCCCCC' }}>{active ? '●' : '○'}</span>
                      </div>
                      <button
                        title="Add to Ring 1"
                        onClick={() => onRingConfigUpdate({ ring1: [...ring1, n] })}
                        className="text-[10px] px-1.5 py-0.5 font-mono leading-none transition-colors"
                        style={{ border: '1px solid #E2E2E0', borderRadius: 2, color: '#888888', backgroundColor: '#FFFFFF' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#111111'; e.currentTarget.style.color = '#111111' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E2E0'; e.currentTarget.style.color = '#888888' }}
                      >→R1</button>
                      <button
                        title="Add to Ring 2"
                        onClick={() => onRingConfigUpdate({ ring2: [...ring2, n] })}
                        className="text-[10px] px-1.5 py-0.5 font-mono leading-none transition-colors"
                        style={{ border: '1px solid #E2E2E0', borderRadius: 2, color: '#888888', backgroundColor: '#FFFFFF' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#111111'; e.currentTarget.style.color = '#111111' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E2E0'; e.currentTarget.style.color = '#888888' }}
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
          <div className="px-4 pb-3 space-y-1.5 pt-3" style={{ borderTop: '1px solid #E2E2E0' }}>
            {warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs px-2.5 py-1.5"
                style={{
                  color: '#92400E',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  borderRadius: 3,
                }}
              >
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#D97706' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <h4 className="text-sm font-semibold" style={{ color: '#111111' }}>Direction &#8594; Phase Assignment</h4>
        <button
          onClick={() => onUpdate({
            phase_assignments: {
              EB: { L: 1, T: 2, R: 2 }, WB: { L: 5, T: 6, R: 6 },
              NB: { L: 3, T: 4, R: 4 }, SB: { L: 7, T: 8, R: 8 },
            }
          })}
          className="text-xs transition-colors"
          style={{ color: '#AAAAAA', background: 'none', border: 'none' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#111111'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#AAAAAA'}
        >Reset to standard</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left px-2 py-1.5 label">Dir</th>
              <th className="px-2 py-1.5 label text-center">Left (φ)</th>
              <th className="px-2 py-1.5 label text-center">Thru (φ)</th>
              <th className="px-2 py-1.5 label text-center">Right (φ)</th>
            </tr>
          </thead>
          <tbody>
            {activeDirections.map((dir) => {
              const dirPa = pa[dir] || {}
              return (
                <tr key={dir} style={{ borderTop: '1px solid #E2E2E0' }}>
                  <td className="px-2 py-1.5 font-semibold" style={{ color: '#111111' }}>{dir}</td>
                  {['L', 'T', 'R'].map((mv) => (
                    <td key={mv} className="px-2 py-1.5 text-center">
                      <select
                        className="text-xs py-0.5 px-1 w-16"
                        style={{
                          border: '1px solid #E2E2E0',
                          borderRadius: 3,
                          color: '#111111',
                          backgroundColor: '#FFFFFF',
                          outline: 'none',
                        }}
                        value={dirPa[mv] ?? ''}
                        onChange={(e) => updateAssignment(dir, mv, e.target.value)}
                        onFocus={(e) => e.target.style.borderColor = '#111111'}
                        onBlur={(e) => e.target.style.borderColor = '#E2E2E0'}
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
