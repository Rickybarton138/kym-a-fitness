import React, { useEffect, useState } from 'react'
import { aggregateLifts } from './lifts.js'
import { supabase } from './supabaseClient.js'
import { TrendChart } from './ui.jsx'

// Per-exercise weight progression, built from saved sessions. Shown to the client
// (their own lifts) and the coach (their client's lifts).
//
// Pass clientId to also fold in lift_entries — weights typed in after the fact,
// so someone arriving from another coach can backdate their starting numbers the
// way they already can with photos and measurements (Paul's ask). Those live in
// their own table and never touch workout_plans, whose created_at ordering the
// "last time" readings depend on.
export function LiftProgress({ plans, title = 'Weights lifted', clientId, canAdd }) {
  const [manual, setManual] = useState([])
  const [adding, setAdding] = useState(false)

  async function loadManual() {
    if (!clientId) return
    const { data } = await supabase.from('lift_entries').select('*')
      .eq('client_id', clientId).order('performed_on', { ascending: true })
    setManual(data || [])
  }
  useEffect(() => { loadManual() }, [clientId])

  const lifts = aggregateLifts(plans, manual)
  if (lifts.length === 0 && !canAdd) return null
  return (
    <div className="card">
      <p className="eyebrow">{title}</p>
      <p className="muted-note">Weight lifted over time, pulled from saved sessions. Tap a lift to see the trend.</p>
      {lifts.map((l) => <LiftRow key={l.name} lift={l} />)}
      {lifts.length === 0 && <p className="muted-note" style={{ marginTop: 8 }}>Nothing logged yet — add a past lift below to set your starting point.</p>}
      {canAdd && clientId && (
        adding
          ? <AddPastLift clientId={clientId} onDone={() => { setAdding(false); loadManual() }} onCancel={() => setAdding(false)} />
          : <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>+ Add a past lift</button>
      )}
    </div>
  )
}

// Backdated entry: the lift, the weight, and when it was actually done.
function AddPastLift({ clientId, onDone, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ready = name.trim().length > 1 && Number(weight) > 0 && date

  async function save() {
    setSaving(true); setError('')
    const { error: e } = await supabase.from('lift_entries').insert({
      client_id: clientId, name: name.trim(), weight: Number(weight), performed_on: date,
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    onDone()
  }

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <p className="eyebrow">Add a past lift</p>
      <p className="muted-note">Use the same exercise name as your sessions so it joins onto the same trend.</p>
      <label className="field" style={{ marginTop: 8 }}>Exercise
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Back Squat" />
      </label>
      <label className="field" style={{ marginTop: 8 }}>Weight (kg)
        <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 60" />
      </label>
      <label className="field" style={{ marginTop: 8 }}>Date
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="seg" style={{ marginTop: 10 }}>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="on" disabled={!ready || saving} onClick={save}>{saving ? 'Saving…' : 'Add'}</button>
      </div>
    </div>
  )
}

function LiftRow({ lift }) {
  const [open, setOpen] = useState(false)
  const hasHistory = lift.points.length > 1
  const up = hasHistory && lift.latest > lift.start
  const down = hasHistory && lift.latest < lift.start
  return (
    <div className="lift-row">
      <button type="button" className="lift-head" onClick={() => setOpen((o) => !o)}>
        <span className="lift-name">{lift.name}</span>
        <span className="lift-val">
          {hasHistory ? (
            <>Started {lift.start}kg → now {lift.latest}kg{up && <span className="delta good"> ↑</span>}{down && <span className="delta"> ↓</span>}</>
          ) : (
            <>{lift.latest}kg <span className="muted-note">· first log</span></>
          )}
          {lift.best !== lift.latest && <span className="muted-note"> · best {lift.best}kg</span>}
        </span>
      </button>
      {open && (lift.points.length >= 2
        ? <TrendChart data={lift.points} field="weight" />
        : <p className="muted-note">Log this lift again to see the trend.</p>)}
    </div>
  )
}
