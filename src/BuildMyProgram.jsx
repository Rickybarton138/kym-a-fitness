import React, { useState } from 'react'
import { supabase } from './supabaseClient.js'
import { EquipmentScan } from './EquipmentScan.jsx'
import { buildProgramRows } from './programBuild.js'
import { sortDays } from './lib.js'
import { WEEKDAYS } from './booking.js'
import { TRAIN_WHERE } from './programMeta.js'

// Paul, 4 Sept: "The program library is awesome but I wonder if it could be an
// option to let people use the ai to create a programme where they can state if
// it's home, home gym or gym, if it's home gym they could upload photos of what
// they have. State what days they can train and it builds a programme for them?"
//
// Three answers, one draft, then it goes on their plan. The draft is shown
// BEFORE anything is saved: a programme is twelve weeks of someone's training,
// and they should see week one before they commit to it.
//
// Saving goes through create_client_program, which derives the coach from the
// caller and forces client_id — a client cannot write into their coach's
// library, and the programme is stamped 'client_ai' so the coach can always
// tell it apart from his own.

const WEEK_BUTTONS = [1, 2, 3, 4, 5, 6, 0]
const GOALS = ['Build muscle', 'Lose fat', 'Get stronger', 'General fitness']

export function BuildMyProgram({ clientId, onDone }) {
  const [where, setWhere] = useState('gym')
  const [kit, setKit] = useState([])
  const [days, setDays] = useState([1, 3, 5])
  const [goal, setGoal] = useState('Build muscle')
  const [level, setLevel] = useState('Beginner')
  const [weeks, setWeeks] = useState(4)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const toggleDay = (d) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : sortDays([...ds, d])))

  const equipmentText = where === 'gym'
    ? 'Full commercial gym'
    : kit.length ? kit.join(', ') : (where === 'home' ? 'Bodyweight only' : '')

  async function generate() {
    if (!days.length) { setErr('Pick at least one day you can train.'); return }
    if (where === 'home_gym' && !kit.length) { setErr('Add the kit you have, or photograph it, so the plan actually fits your setup.'); return }
    setBusy(true); setErr(''); setDraft(null)
    try {
      const res = await fetch('/.netlify/functions/program-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal, days: days.length, equipment: equipmentText, level, weeks, location: where, notes: notes.trim().slice(0, 400) }),
      })
      const j = await res.json()
      if (!j.sessions?.length) throw new Error(j.error || 'Nothing came back — try again.')
      setDraft(j)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  async function keep() {
    setSaving(true); setErr('')
    try {
      const weeksN = Math.min(Math.max(Number(draft.weeks) || weeks, 1), 16)
      const rows = buildProgramRows(draft.sessions, weeksN, days)
      const { data, error } = await supabase.rpc('create_client_program', {
        p_title: draft.title,
        p_description: draft.description || '',
        p_weeks: weeksN,
        p_level: level,
        p_location: where,
        p_equipment: equipmentText,
        p_rows: rows,
        p_days: sortDays(days),
      })
      if (error) throw new Error(error.message)
      onDone?.(data)
    } catch (e) { setErr(e.message); setSaving(false) }
  }

  if (draft) {
    return (
      <div className="stack">
        <p className="eyebrow accent">Your plan — have a look before you start it</p>
        <div className="session-title">{draft.title}</div>
        <p className="muted-note">{draft.description}</p>
        <p className="muted-note">
          {draft.weeks} weeks · {sortDays(days).map((d) => WEEKDAYS[d]).join(', ')} · it gets harder each week, with an easier week every fourth.
        </p>
        {draft.sessions.map((s, i) => (
          <div className="card session-card" key={i}>
            <div className="session-title">{s.title}</div>
            <div className="session-sub">{s.focus}{sortDays(days)[i] != null ? ` · ${WEEKDAYS[sortDays(days)[i]]}` : ''}</div>
            <ol className="ex-list">
              {(s.exercises || []).map((e, j) => (
                <li className="ex" key={j}>
                  <span className="ex-n">{j + 1}</span>
                  <div className="ex-body">
                    <div className="ex-name">{e.name}</div>
                    <div className="ex-sets">{e.sets} × {e.reps}{e.rpe ? ` · RPE ${e.rpe}` : ''}</div>
                  </div>
                </li>
              ))}
            </ol>
            {s.finisher && <p className="finisher"><b>Finisher:</b> {s.finisher}</p>}
          </div>
        ))}
        {err && <p className="error">{err}</p>}
        <div className="nudge-actions">
          <button className="btn primary" disabled={saving} onClick={keep}>{saving ? 'Setting it up…' : 'Start this plan'}</button>
          <button type="button" className="btn ghost" disabled={saving} onClick={() => setDraft(null)}>Change something</button>
        </div>
        <p className="muted-note">Your coach can see this and tweak it any time.</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="muted-note">Answer three things and the AI builds you a plan that fits where you train and the days you can do.</p>

      <p className="eyebrow">Where do you train?</p>
      {TRAIN_WHERE.map((w) => (
        <button
          type="button" key={w.key}
          className={'opt-row' + (where === w.key ? ' on' : '')}
          onClick={() => setWhere(w.key)}
        >
          <span style={{ fontWeight: 600 }}>{w.label}</span>
          <span className="muted" style={{ display: 'block', fontSize: 13 }}>{w.sub}</span>
        </button>
      ))}

      {where === 'home_gym' && (
        <EquipmentScan
          items={kit} setItems={setKit}
          label="What have you got?"
          hint="Photograph your setup — up to four photos — and you will get a list to check. Or just type it in."
        />
      )}
      {where === 'home' && (
        <EquipmentScan
          items={kit} setItems={setKit}
          label="Anything at all? (optional)"
          hint="A couple of dumbbells or a band changes what is possible. Leave it empty for bodyweight only."
        />
      )}

      <p className="eyebrow" style={{ marginTop: 6 }}>Which days can you train?</p>
      <div className="seg" style={{ flexWrap: 'wrap' }}>
        {WEEK_BUTTONS.map((d) => (
          <button type="button" key={d} className={days.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)}>{WEEKDAYS[d]}</button>
        ))}
      </div>
      <p className="muted-note">{days.length ? `${days.length} session${days.length === 1 ? '' : 's'} a week, on ${sortDays(days).map((d) => WEEKDAYS[d]).join(', ')}.` : 'Pick the days that realistically work.'}</p>

      <div className="grid-2">
        <label className="field">Goal
          <select className="ex-select" value={goal} onChange={(e) => setGoal(e.target.value)}>
            {GOALS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label className="field">Experience
          <select className="ex-select" value={level} onChange={(e) => setLevel(e.target.value)}>
            {['Beginner', 'Intermediate', 'Advanced'].map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
      </div>
      {/* Paul, 13 Sept: "can we add a text box where they can give a prompt for
          the type of program they want. For example being able to specify they
          want a program for the gym with weights that also includes scheduled
          running to increase distance and pace with running."
          His own example is the placeholder, because the thing people get wrong
          with a box like this is not knowing how much they are allowed to ask
          for. */}
      <label className="field">Anything in particular? (optional)
        <textarea
          className="food-input" style={{ minHeight: 84 }} maxLength={400}
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. weights in the gym, but with running built in to get my distance and pace up · upper/lower split, nothing overhead, my shoulder is dodgy · training for a Hyrox in November"
        />
      </label>

      <label className="field">How many weeks
        <select className="ex-select" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
          {[4, 6, 8, 12].map((w) => <option key={w} value={w}>{w} weeks</option>)}
        </select>
      </label>

      {err && <p className="error">{err}</p>}
      <button className="btn primary big" disabled={busy} onClick={generate}>{busy ? 'Building your plan…' : 'Build my plan'}</button>
    </div>
  )
}
