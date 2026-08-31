import React, { useState, useEffect } from 'react'
import { EXERCISE_GROUPS } from './exercises.js'
import { supabase } from './supabaseClient.js'

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

// Common training-session sections; coaches can also type their own.
export const SECTIONS = ['Warm-up', 'Activation', 'Strength', 'Power', 'Accessories', 'Conditioning', 'Cool-down']

// A fresh exercise starts with 3 empty sets, each with its own reps + weight.
// A set may also carry `drops` — how many drop sets hang off it (Paul's ask:
// specify the working sets, then put drops on all of them or just some).
export function newExerciseRow(patch) {
  return { name: '', custom: false, section: '', cue: '', set_type: 'straight', group: '', rpe: '', video: '', sets: [{ reps: '', weight: '' }, { reps: '', weight: '' }, { reps: '', weight: '' }], ...patch }
}

// Next free superset letter, so the coach never types one.
export function nextGroupLetter(rows) {
  const used = new Set((rows || []).map((r) => (r.group || '').trim().toUpperCase()).filter(Boolean))
  for (let i = 0; i < 26; i++) { const L = String.fromCharCode(65 + i); if (!used.has(L)) return L }
  return 'A'
}

// True if a row (or a draft) actually has something worth keeping.
function rowHasContent(r) {
  return !!(r.name?.trim() || (r.sets || []).some((s) => String(s.reps).trim() || String(s.weight).trim()))
}

// Persist an in-progress workout build (title / focus / exercise rows) to
// localStorage so switching apps mid-build on a phone doesn't lose it — the PWA
// reloads on resume and would otherwise remount the builder empty. Keyed per
// builder (per client / template / squad). Call clear() after a successful save.
export function useWorkoutDraft(key) {
  const storeKey = 'cbk_wbdraft:' + key
  const [restored] = useState(() => {
    try {
      const raw = localStorage.getItem(storeKey)
      if (raw) {
        const d = JSON.parse(raw)
        // Restore on the same condition the draft is SAVED on below. These
        // disagreed: a draft with a name but no exercises yet was written to
        // storage and then silently ignored on the way back in.
        if (d && Array.isArray(d.rows) && (d.title || d.focus || d.rows.some(rowHasContent))) return d
      }
    } catch { /* ignore */ }
    return null
  })
  const [draft, setDraft] = useState(restored || { title: '', focus: '', rows: [newExerciseRow()] })
  useEffect(() => {
    try {
      const keep = draft.title || draft.focus || (draft.rows || []).some(rowHasContent)
      if (keep) localStorage.setItem(storeKey, JSON.stringify(draft))
      else localStorage.removeItem(storeKey)
    } catch { /* ignore */ }
  }, [draft, storeKey])
  const apply = (k) => (v) => setDraft((d) => ({ ...d, [k]: typeof v === 'function' ? v(d[k]) : v }))
  const clear = () => {
    try { localStorage.removeItem(storeKey) } catch { /* ignore */ }
    setDraft({ title: '', focus: '', rows: [newExerciseRow()] })
  }
  return {
    title: draft.title, focus: draft.focus, rows: draft.rows,
    setTitle: apply('title'), setFocus: apply('focus'), setRows: apply('rows'),
    clear, hasDraft: !!restored,
  }
}

// What was logged last time for one exercise, as a compact reference line —
// e.g. "Last time (12 Aug): 8×60kg, 8×60kg, 6×65kg".
export function lastTimeLabel(last) {
  if (!last || !last.sets?.length) return ''
  const when = last.date ? new Date(last.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
  const sets = last.sets.map((s) => (s.weight ? `${s.reps || '-'}×${s.weight}kg` : s.reps || '-')).join(', ')
  return `Last time${when ? ` (${when})` : ''}: ${sets}`
}

// Shared exercise editor: pick an exercise, then log each set's reps and weight
// (different per set). Used by the client's "Build your own" and the coach's
// "Assign a workout" / squad builders. `lastByName` (optional) maps a lowercased
// exercise name to their last logged sets, so whoever's logging can see what was
// done last time instead of guessing at a starting weight.
// `coachId` (optional) persists typed-in exercise names to coach_exercises and
// offers them back in the dropdown, so a name is typed once and then reusable —
// same idea as coach_foods for manually added foods.
export function ExerciseRowsEditor({ rows, setRows, lastByName, coachId, contributorId }) {
  const [coachEx, setCoachEx] = useState([])
  useEffect(() => {
    if (!coachId) return
    supabase.from('coach_exercises').select('name').eq('coach_id', coachId).order('name')
      .then(({ data }) => setCoachEx((data || []).map((x) => x.name)))
  }, [coachId])

  const update = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))
  const addRow = () => setRows((r) => [...r, newExerciseRow()])
  // Add another exercise into the same superset: sits directly beneath, already
  // tagged and lettered. Paul's "a button to add in the other exercises of the
  // superset" — a superset is 2+ exercises back to back making up one set.
  const addToSuperset = (i) => setRows((r) => {
    const letter = (r[i].group || '').trim().toUpperCase() || nextGroupLetter(r)
    const copy = r.slice()
    copy[i] = { ...copy[i], set_type: 'superset', group: letter }
    let at = i + 1
    while (at < copy.length && (copy[at].group || '').trim().toUpperCase() === letter) at++
    copy.splice(at, 0, newExerciseRow({ set_type: 'superset', group: letter }))
    return copy
  })
  const removeRow = (i) => setRows((r) => (r.length > 1 ? r.filter((_, j) => j !== i) : r))
  const move = (i, dir) => setRows((r) => {
    const j = i + dir
    if (j < 0 || j >= r.length) return r
    const copy = r.slice()
    const [it] = copy.splice(i, 1)
    copy.splice(j, 0, it)
    return copy
  })
  const addSet = (i) => setRows((r) => r.map((row, j) => (j === i ? { ...row, sets: [...(row.sets || []), { reps: '', weight: '' }] } : row)))
  // Put the same number of drops on every working set of this exercise.
  const dropsToAll = (i, n) => setRows((r) => r.map((row, j) => (j === i ? { ...row, sets: (row.sets || []).map((s) => ({ ...s, drops: n })) } : row)))
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
          <div className={'ex-input' + (r.set_type === 'superset' && (r.group || '').trim() ? ' in-superset' : '')} key={i}>
            <div className="ex-top">
              <select className="ex-select" value={r.custom ? '__other__' : r.name || ''} onChange={(e) => onSelect(i, e.target.value)}>
                <option value="" disabled>Choose an exercise…</option>
                {coachEx.length > 0 && (
                  <optgroup label="Your exercises">
                    {coachEx.map((o) => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                )}
                {EXERCISE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                ))}
                <option value="__other__">Other (type your own)…</option>
              </select>
              <button type="button" className="row-move" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">↑</button>
              <button type="button" className="row-move" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" title="Move down">↓</button>
              <button type="button" className="row-del" onClick={() => removeRow(i)} aria-label="Remove exercise">×</button>
            </div>
            {r.custom && (
              <input className="ex-name-in" placeholder="Exercise name" value={r.name} onChange={(e) => update(i, 'name', e.target.value)} />
            )}

            <input className="ex-name-in" list="wr-sections" placeholder="Section (optional) — e.g. Warm-up, Strength"
              value={r.section || ''} onChange={(e) => update(i, 'section', e.target.value)} />

            <div className="ex-settype">
              <select className="ex-select" value={r.set_type || 'straight'} onChange={(e) => update(i, 'set_type', e.target.value)}>
                {SET_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {(r.set_type === 'superset') && (
                <input className="ex-group-in" placeholder="Group (e.g. A)" maxLength={2}
                  value={r.group || ''} onChange={(e) => update(i, 'group', e.target.value.toUpperCase())} />
              )}
              {(r.set_type === 'dropset') && (
                <input className="ex-rpe-in" type="number" min="1" max="5" placeholder="Drops" title="Drop sets on every working set"
                  value={(r.sets || []).every((s) => s.drops) && new Set((r.sets || []).map((s) => s.drops)).size === 1 ? (r.sets[0].drops || '') : ''}
                  onChange={(e) => dropsToAll(i, e.target.value === '' ? undefined : Number(e.target.value))} />
              )}
              <input className="ex-rpe-in" type="number" min="1" max="10" placeholder="RPE" title="Target intensity, 1–10"
                value={r.rpe || ''} onChange={(e) => update(i, 'rpe', e.target.value)} />
            </div>
            {(r.set_type && r.set_type !== 'straight') && <p className="muted-note ex-settype-note">{setTypeNote(r.set_type)}</p>}
            {(() => {
              const last = lastByName?.[(r.name || '').trim().toLowerCase()]
              const label = last && lastTimeLabel(last)
              return label ? <p className="muted-note ex-last-time">{label}</p> : null
            })()}

            <div className={'set-grid' + (r.set_type === 'dropset' ? ' with-drops' : '')}>
              <div className="set-head">
                <span>Set</span><span>Reps</span><span>Weight (kg)</span>
                {r.set_type === 'dropset' && <span>Drops</span>}
                <span aria-hidden="true" />
              </div>
              {(r.sets || []).map((s, si) => (
                <div className="set-row" key={si}>
                  <span className="set-n">{si + 1}</span>
                  <input placeholder="10 / AMRAP" value={s.reps} onChange={(e) => updateSet(i, si, 'reps', e.target.value)} />
                  <input inputMode="decimal" placeholder="40" value={s.weight} onChange={(e) => updateSet(i, si, 'weight', e.target.value)} />
                  {r.set_type === 'dropset' && (
                    <input type="number" min="0" max="5" placeholder="0" title="Drop sets on this set"
                      value={s.drops ?? ''} onChange={(e) => updateSet(i, si, 'drops', e.target.value === '' ? undefined : Number(e.target.value))} />
                  )}
                  <button type="button" className="set-del" onClick={() => removeSet(i, si)} aria-label="Remove set">×</button>
                </div>
              ))}
            </div>
            <div className="row-actions">
              <button type="button" className="add-set-btn" onClick={() => addSet(i)}>+ Add set</button>
              {r.set_type === 'superset' && (
                <button type="button" className="add-set-btn" onClick={() => addToSuperset(i)}>+ Add exercise to this superset</button>
              )}
            </div>
            {r.set_type === 'dropset' && (
              <p className="muted-note ex-settype-note">Set the drops per set above, or use the Drops box to put the same number on every working set.</p>
            )}

            <input className="ex-cue-in" placeholder="Note (optional)" value={r.cue} onChange={(e) => update(i, 'cue', e.target.value)} />
            <input className="ex-cue-in" placeholder="How-to video link (optional)" value={r.video || ''} onChange={(e) => update(i, 'video', e.target.value)} />
          </div>
        ))}
      </div>
      <datalist id="wr-sections">{SECTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      <button type="button" className="btn ghost" onClick={addRow}>+ Add exercise</button>
    </>
  )
}

const KNOWN_NAMES = new Set(EXERCISE_GROUPS.flatMap((g) => g.options))

// Remember any exercise name that isn't in the static catalogue, so it's in the
// dropdown next time instead of being retyped (Paul's ask). Best-effort: the
// unique index makes a repeat insert a harmless no-op, and a failure here must
// never block saving the actual session.
export async function rememberExercises(exercises, coachId, contributorId) {
  if (!coachId) return
  const names = [...new Set((exercises || [])
    .map((ex) => (ex.name || '').trim())
    .filter((n) => n && !KNOWN_NAMES.has(n)))]
  if (!names.length) return
  try {
    // The unique index is on lower(name), which onConflict can't target, so
    // filter against what's already stored first — same as coach_foods does.
    const { data: have } = await supabase.from('coach_exercises').select('name').eq('coach_id', coachId)
    const known = new Set((have || []).map((x) => x.name.toLowerCase()))
    const fresh = names.filter((n) => !known.has(n.toLowerCase()))
    if (!fresh.length) return
    await supabase.from('coach_exercises')
      .insert(fresh.map((name) => ({ coach_id: coachId, created_by: contributorId || coachId, name })))
  } catch { /* never block the save */ }
}

// Turn a saved plan's exercises into editable rows — expands an AI/old plan
// (sets = a count) into that many set-rows so weights can be added per set.
export function planToRows(exercises) {
  return (exercises || []).map((ex) => {
    const sets = Array.isArray(ex.sets)
      ? ex.sets.map((s) => ({ reps: String(s.reps ?? ''), weight: String(s.weight ?? ''), ...(s.drops ? { drops: s.drops } : {}) }))
      : Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, () => ({ reps: String(ex.reps ?? ''), weight: String(ex.weight ?? '') }))
    return { name: ex.name || '', custom: !KNOWN_NAMES.has(ex.name), section: ex.section || '', cue: ex.cue || '', set_type: ex.set_type || 'straight', group: ex.group || '', rpe: ex.rpe != null ? String(ex.rpe) : '', video: ex.video || '', sets }
  })
}

// Reusable edit form for an existing workout / template / programme session:
// seeds title, focus and exercise rows from the saved object, then hands the
// cleaned { title, focus, exercises } back via onSave (which does the DB update
// and can throw to surface an error). Shared by the coach's Edit buttons.
// `extra` renders between the name/focus row and the exercises — used by the
// programme builder to let the coach move a session to a different week/day
// without rebuilding it. `coachId` surfaces their saved exercises here too;
// without it the edit form showed only the static catalogue.
export function WorkoutEditForm({ initial, showFocus = true, titleLabel = 'Session name', focusLabel = 'Focus', equipment = 'Coach plan', saveLabel = 'Save changes', onSave, onCancel, coachId, extra }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [focus, setFocus] = useState(initial?.focus || '')
  const [rows, setRows] = useState(() => {
    const r = planToRows(initial?.exercises)
    return r.length ? r : [newExerciseRow()]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    const exercises = rowsToExercises(rows, equipment)
    if (!exercises.length) { setError('Add at least one exercise with a set.'); return }
    setSaving(true); setError('')
    try {
      if (coachId) await rememberExercises(exercises, coachId, coachId)
      await onSave({ title: title.trim(), focus: focus.trim(), exercises })
    } catch (e) {
      setError(e?.message || 'Save failed.'); setSaving(false); return
    }
    setSaving(false)
  }
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <div className={showFocus ? 'grid-2' : ''}>
        <label className="field">{titleLabel}<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        {showFocus && <label className="field">{focusLabel}<input value={focus} onChange={(e) => setFocus(e.target.value)} /></label>}
      </div>
      {extra}
      <ExerciseRowsEditor rows={rows} setRows={setRows} coachId={coachId} />
      {error && <p className="error">{error}</p>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
        <button type="button" className="btn primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : saveLabel}</button>
        <button type="button" className="link-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// Turn editor rows into stored exercise objects (keeps only real sets).
export function rowsToExercises(rows, equipmentLabel) {
  return rows
    .filter((r) => r.name.trim() && (r.sets || []).some((s) => String(s.reps).trim() || String(s.weight).trim()))
    .map((r) => {
      const set_type = r.set_type && r.set_type !== 'straight' ? r.set_type : undefined
      const group = set_type === 'superset' && (r.group || '').trim() ? r.group.trim() : undefined
      const rpeNum = Number(r.rpe)
      const rpe = r.rpe !== '' && r.rpe != null && rpeNum >= 1 && rpeNum <= 10 ? rpeNum : undefined
      const video = (r.video || '').trim() || undefined
      const section = (r.section || '').trim() || undefined
      return {
        name: r.name.trim(),
        equipment: equipmentLabel || 'Own choice',
        cue: (r.cue || '').trim(),
        ...(section ? { section } : {}),
        ...(set_type ? { set_type } : {}),
        ...(group ? { group } : {}),
        ...(rpe ? { rpe } : {}),
        ...(video ? { video } : {}),
        sets: (r.sets || [])
          .filter((s) => String(s.reps).trim() || String(s.weight).trim())
          .map((s) => {
            const drops = Number(s.drops)
            return {
              reps: String(s.reps).trim(),
              weight: String(s.weight).trim() || null,
              // Only on drop-set exercises, and only when there actually are
              // some — keeps every other stored set byte-identical to before.
              ...(set_type === 'dropset' && drops >= 1 ? { drops } : {}),
            }
          }),
      }
    })
}
