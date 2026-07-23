import React from 'react'
import { EXERCISE_GROUPS } from './exercises.js'

// Set structures a coach can build. 'straight' is the default; the rest are a
// per-exercise tag. Only 'superset' adds data (a group letter so two exercises
// pair up) — the others are label-only over the same reps/weight shape.
export const SET_TYPES = [
  { key: 'straight', label: 'Straight sets', note: '' },
  { key: 'superset', label: 'Superset', note: 'Back-to-back with its pair, no rest between.' },
  { key: 'dropset',  label: 'Drop set',  note: 'Drop the weight and go again — minimal rest.' },
  { key: 'pyramid',  label: 'Pyramid',   note: 'Ramp the weight up (or reps down) each set.' },
  { key: 'cluster',  label: 'Cluster',   note: 'Short rests inside the set to keep the weight heavy.' },
]
export const setTypeLabel = (k) => (SET_TYPES.find((t) => t.key === k) || SET_TYPES[0]).label
export const setTypeNote = (k) => (SET_TYPES.find((t) => t.key === k) || SET_TYPES[0]).note

// A fresh exercise starts with 3 empty sets, each with its own reps + weight.
export function newExerciseRow() {
  return { name: '', custom: false, cue: '', set_type: 'straight', group: '', sets: [{ reps: '', weight: '' }, { reps: '', weight: '' }, { reps: '', weight: '' }] }
}

// Shared exercise editor: pick an exercise, then log each set's reps and weight
// (different per set). Used by the client's "Build your own" and the coach's
// "Assign a workout" / squad builders.
export function ExerciseRowsEditor({ rows, setRows }) {
  const update = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))
  const addRow = () => setRows((r) => [...r, newExerciseRow()])
  const removeRow = (i) => setRows((r) => (r.length > 1 ? r.filter((_, j) => j !== i) : r))
  const addSet = (i) => setRows((r) => r.map((row, j) => (j === i ? { ...row, sets: [...(row.sets || []), { reps: '', weight: '' }] } : row)))
  const removeSet = (i, si) => setRows((r) => r.map((row, j) => (j === i ? { ...row, sets: row.sets.length > 1 ? row.sets.filter((_, k) => k !== si) : row.sets } : row)))
  const updateSet = (i, si, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, sets: row.sets.map((s, k2) => (k2 === si ? { ...s, [k]: v } : s)) } : row)))

  function onSelect(i, value) {
    if (value === '__other__') setRows((r) => r.map((row, j) => (j === i ? { ...row, custom: true, name: '' } : row)))
    else setRows((r) => r.map((row, j) => (j === i ? { ...row, custom: false, name: value } : row)))
  }

  return (
    <>
      <div className="stack">
        {rows.map((r, i) => (
          <div className="ex-input" key={i}>
            <div className="ex-top">
              <select className="ex-select" value={r.custom ? '__other__' : r.name || ''} onChange={(e) => onSelect(i, e.target.value)}>
                <option value="" disabled>Choose an exercise…</option>
                {EXERCISE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                ))}
                <option value="__other__">Other (type your own)…</option>
              </select>
              <button type="button" className="row-del" onClick={() => removeRow(i)} aria-label="Remove exercise">×</button>
            </div>
            {r.custom && (
              <input className="ex-name-in" placeholder="Exercise name" value={r.name} onChange={(e) => update(i, 'name', e.target.value)} />
            )}

            <div className="ex-settype">
              <select className="ex-select" value={r.set_type || 'straight'} onChange={(e) => update(i, 'set_type', e.target.value)}>
                {SET_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {(r.set_type === 'superset') && (
                <input className="ex-group-in" placeholder="Group (e.g. A)" maxLength={2}
                  value={r.group || ''} onChange={(e) => update(i, 'group', e.target.value.toUpperCase())} />
              )}
            </div>
            {(r.set_type && r.set_type !== 'straight') && <p className="muted-note ex-settype-note">{setTypeNote(r.set_type)}</p>}

            <div className="set-grid">
              <div className="set-head"><span>Set</span><span>Reps</span><span>Weight (kg)</span><span aria-hidden="true" /></div>
              {(r.sets || []).map((s, si) => (
                <div className="set-row" key={si}>
                  <span className="set-n">{si + 1}</span>
                  <input inputMode="numeric" placeholder="10" value={s.reps} onChange={(e) => updateSet(i, si, 'reps', e.target.value)} />
                  <input inputMode="decimal" placeholder="40" value={s.weight} onChange={(e) => updateSet(i, si, 'weight', e.target.value)} />
                  <button type="button" className="set-del" onClick={() => removeSet(i, si)} aria-label="Remove set">×</button>
                </div>
              ))}
            </div>
            <button type="button" className="add-set-btn" onClick={() => addSet(i)}>+ Add set</button>

            <input className="ex-cue-in" placeholder="Note (optional)" value={r.cue} onChange={(e) => update(i, 'cue', e.target.value)} />
          </div>
        ))}
      </div>
      <button type="button" className="btn ghost" onClick={addRow}>+ Add exercise</button>
    </>
  )
}

const KNOWN_NAMES = new Set(EXERCISE_GROUPS.flatMap((g) => g.options))

// Turn a saved plan's exercises into editable rows — expands an AI/old plan
// (sets = a count) into that many set-rows so weights can be added per set.
export function planToRows(exercises) {
  return (exercises || []).map((ex) => {
    const sets = Array.isArray(ex.sets)
      ? ex.sets.map((s) => ({ reps: String(s.reps ?? ''), weight: String(s.weight ?? '') }))
      : Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, () => ({ reps: String(ex.reps ?? ''), weight: String(ex.weight ?? '') }))
    return { name: ex.name || '', custom: !KNOWN_NAMES.has(ex.name), cue: ex.cue || '', set_type: ex.set_type || 'straight', group: ex.group || '', sets }
  })
}

// Turn editor rows into stored exercise objects (keeps only real sets).
export function rowsToExercises(rows, equipmentLabel) {
  return rows
    .filter((r) => r.name.trim() && (r.sets || []).some((s) => String(s.reps).trim() || String(s.weight).trim()))
    .map((r) => {
      const set_type = r.set_type && r.set_type !== 'straight' ? r.set_type : undefined
      const group = set_type === 'superset' && (r.group || '').trim() ? r.group.trim() : undefined
      return {
        name: r.name.trim(),
        equipment: equipmentLabel || 'Own choice',
        cue: (r.cue || '').trim(),
        ...(set_type ? { set_type } : {}),
        ...(group ? { group } : {}),
        sets: (r.sets || [])
          .filter((s) => String(s.reps).trim() || String(s.weight).trim())
          .map((s) => ({ reps: String(s.reps).trim(), weight: String(s.weight).trim() || null })),
      }
    })
}
