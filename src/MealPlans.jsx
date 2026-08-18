import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Coach-authored meal-plan templates. Kim writes a reusable skeleton (e.g. a
// 5-day starter), saves it to her library, then ASSIGNS it to a client — which
// copies the plan into client_meal_plans so she can adapt that client's version
// without touching the template. The client sees their active plan in the app.

const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
const newMeal = (name = '') => ({ name, detail: '', kcal: '' })
const newDay = (n) => ({ label: `Day ${n}`, meals: [newMeal('Breakfast'), newMeal('Lunch'), newMeal('Dinner')] })
// Kim's "5-day starter that can be adapted" — one tap lays out the skeleton.
const starterPlan = () => Array.from({ length: 5 }, (_, i) => ({
  label: `Day ${i + 1}`,
  meals: MEAL_NAMES.map((n) => newMeal(n)),
}))

// Shared editor for both a template and a client's adapted copy.
export function PlanEditor({ initial, saveLabel = 'Save plan', onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [days, setDays] = useState(() => (Array.isArray(initial?.plan) && initial.plan.length ? initial.plan : [newDay(1)]))
  const [busy, setBusy] = useState(false)

  const setDay = (di, patch) => setDays((d) => d.map((x, i) => (i === di ? { ...x, ...patch } : x)))
  const setMeal = (di, mi, patch) => setDays((d) => d.map((x, i) => (i !== di ? x : { ...x, meals: x.meals.map((m, j) => (j === mi ? { ...m, ...patch } : m)) })))
  const addDay = () => setDays((d) => [...d, newDay(d.length + 1)])
  const removeDay = (di) => setDays((d) => d.filter((_, i) => i !== di))
  const addMeal = (di) => setDays((d) => d.map((x, i) => (i === di ? { ...x, meals: [...x.meals, newMeal()] } : x)))
  const removeMeal = (di, mi) => setDays((d) => d.map((x, i) => (i !== di ? x : { ...x, meals: x.meals.filter((_, j) => j !== mi) })))

  async function save() {
    if (!title.trim()) return
    setBusy(true)
    // Trim empties so a skeleton with blank meals stays tidy.
    const plan = days.map((d) => ({
      label: (d.label || '').trim() || 'Day',
      meals: d.meals.filter((m) => (m.name || '').trim() || (m.detail || '').trim())
        .map((m) => ({ name: (m.name || '').trim(), detail: (m.detail || '').trim(), kcal: m.kcal === '' || m.kcal == null ? null : Number(m.kcal) || null })),
    }))
    await onSave({ title: title.trim(), notes: notes.trim() || null, plan })
    setBusy(false)
  }

  return (
    <div className="stack">
      <label className="field">Plan name<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 5-Day Starter" /></label>
      <label className="field">Notes (optional)<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How to use this plan, swaps allowed, etc." /></label>
      {days.length === 0 && <button type="button" className="btn ghost sm" onClick={() => setDays(starterPlan())}>Start from a 5-day skeleton</button>}
      {days.map((d, di) => (
        <div className="card" key={di} style={{ background: 'var(--surface-2)' }}>
          <div className="nudge-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <input className="plan-day-label" value={d.label} onChange={(e) => setDay(di, { label: e.target.value })} style={{ fontWeight: 700, border: 'none', background: 'transparent', color: 'var(--text)' }} />
            <button type="button" className="link-btn inline" onClick={() => removeDay(di)}>Remove day</button>
          </div>
          <div className="stack" style={{ marginTop: 8 }}>
            {d.meals.map((m, mi) => (
              <div key={mi} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={m.name} onChange={(e) => setMeal(di, mi, { name: e.target.value })} placeholder="Meal (e.g. Breakfast)" style={{ flex: 2 }} />
                  <input value={m.kcal ?? ''} onChange={(e) => setMeal(di, mi, { kcal: e.target.value })} placeholder="kcal" inputMode="numeric" style={{ flex: 1, minWidth: 0 }} />
                  <button type="button" className="link-btn inline" onClick={() => removeMeal(di, mi)} aria-label="Remove meal">×</button>
                </div>
                <input value={m.detail} onChange={(e) => setMeal(di, mi, { detail: e.target.value })} placeholder="e.g. 3 eggs, oats & berries" />
              </div>
            ))}
            <button type="button" className="btn ghost sm" onClick={() => addMeal(di)}>+ Meal</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={addDay}>+ Day</button>
      <div className="nudge-actions">
        <button className="btn primary sm" disabled={busy || !title.trim()} onClick={save}>{busy ? 'Saving…' : saveLabel}</button>
        {onCancel && <button type="button" className="btn ghost sm" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  )
}

// Read-only render of a plan (client app + coach preview).
export function PlanView({ plan, notes }) {
  const days = Array.isArray(plan) ? plan : []
  if (!days.length) return <p className="muted-note">No days in this plan yet.</p>
  return (
    <div className="stack">
      {notes && <p className="muted-note">{notes}</p>}
      {days.map((d, di) => (
        <div className="card" key={di} style={{ background: 'var(--surface-2)' }}>
          <p className="eyebrow accent">{d.label || `Day ${di + 1}`}</p>
          <div className="stack" style={{ marginTop: 6 }}>
            {(d.meals || []).map((m, mi) => (
              <div key={mi} className="checkin-line">
                <b>{m.name}</b>{m.kcal ? ` · ${m.kcal} kcal` : ''}{m.detail ? <><br /><span className="muted-note">{m.detail}</span></> : null}
              </div>
            ))}
            {(d.meals || []).length === 0 && <p className="muted-note">Rest / free choice.</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// COACH: template library — author, edit, delete, and assign to a client.
export function CoachMealPlans({ coachId, clients = [] }) {
  const [plans, setPlans] = useState([])
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState(null)
  const [assignFor, setAssignFor] = useState(null) // plan id currently choosing a client
  const [assignPick, setAssignPick] = useState('')
  const [flash, setFlash] = useState('')

  async function load() {
    const { data } = await supabase.from('meal_plans').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
    setPlans(data || [])
  }
  useEffect(() => { load() }, [coachId])

  async function create({ title, notes, plan }) {
    const { data } = await supabase.from('meal_plans').insert({ coach_id: coachId, title, notes, plan }).select().single()
    if (data) setPlans((p) => [data, ...p])
    setCreating(false)
  }
  async function saveEdit(id, { title, notes, plan }) {
    const { data } = await supabase.from('meal_plans').update({ title, notes, plan }).eq('id', id).select().single()
    if (data) setPlans((p) => p.map((x) => (x.id === id ? data : x)))
    setEditId(null)
  }
  async function remove(id) {
    await supabase.from('meal_plans').delete().eq('id', id)
    setPlans((p) => p.filter((x) => x.id !== id))
  }
  async function assign(pl) {
    if (!assignPick) return
    // One active plan per client — retire any current one, then copy this template.
    await supabase.from('client_meal_plans').update({ active: false }).eq('client_id', assignPick).eq('active', true)
    await supabase.from('client_meal_plans').insert({ client_id: assignPick, coach_id: coachId, source_plan_id: pl.id, title: pl.title, notes: pl.notes, plan: pl.plan, active: true })
    const who = clients.find((c) => c.id === assignPick)?.full_name || 'client'
    setFlash(`Assigned “${pl.title}” to ${who}`)
    setAssignFor(null); setAssignPick(''); setTimeout(() => setFlash(''), 2400)
  }

  return (
    <div className="card">
      <p className="eyebrow">Meal plans</p>
      <p className="muted-note">Write a plan once — a skeleton or a full week — then assign it to a client. Assigning copies it to them so you can tweak their version without changing your template.</p>
      {flash && <p className="logged-ok" style={{ marginTop: 8 }}>{flash} ✓</p>}

      <div style={{ margin: '10px 0 12px' }}>
        {!creating && <button type="button" className="btn ghost" onClick={() => setCreating(true)}>New meal plan</button>}
        {creating && (
          <div className="stack" style={{ marginTop: 8 }}>
            <p className="eyebrow accent">New plan</p>
            <PlanEditor initial={{ plan: starterPlan() }} saveLabel="Save plan" onSave={create} onCancel={() => setCreating(false)} />
          </div>
        )}
      </div>

      <div className="stack">
        {plans.map((pl) => (
          <div className="card session-card" key={pl.id}>
            {editId === pl.id ? (
              <PlanEditor initial={pl} saveLabel="Save changes" onSave={(v) => saveEdit(pl.id, v)} onCancel={() => setEditId(null)} />
            ) : (
              <>
                <div className="session-title">{pl.title}</div>
                <div className="session-sub">{(pl.plan || []).length} day{(pl.plan || []).length === 1 ? '' : 's'}{pl.notes ? ' · ' + pl.notes : ''}</div>
                <div className="nudge-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="btn ghost sm" onClick={() => setEditId(pl.id)}>Edit</button>
                  <button type="button" className="btn ghost sm" onClick={() => { setAssignFor(assignFor === pl.id ? null : pl.id); setAssignPick('') }}>Assign to client</button>
                  <button type="button" className="link-btn inline" onClick={() => remove(pl.id)}>Delete</button>
                </div>
                {assignFor === pl.id && (
                  <div className="nudge-actions" style={{ marginTop: 8 }}>
                    <select value={assignPick} onChange={(e) => setAssignPick(e.target.value)}>
                      <option value="">Choose a client…</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                    <button type="button" className="btn primary sm" disabled={!assignPick} onClick={() => assign(pl)}>Assign</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {plans.length === 0 && !creating && <p className="muted-note">No plans yet — create your first skeleton above.</p>}
      </div>
    </div>
  )
}

// COACH (client detail): the client's active plan, with adapt + remove.
export function ClientMealPlanPanel({ clientId, coachId }) {
  const [cp, setCp] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)

  async function load() {
    const { data } = await supabase.from('client_meal_plans').select('*').eq('client_id', clientId).eq('active', true).order('created_at', { ascending: false }).limit(1)
    setCp(data?.[0] || null); setLoaded(true)
  }
  useEffect(() => { load() }, [clientId])

  async function saveAdapt({ title, notes, plan }) {
    const { data } = await supabase.from('client_meal_plans').update({ title, notes, plan }).eq('id', cp.id).select().single()
    if (data) setCp(data)
    setEditing(false)
  }
  async function removePlan() {
    await supabase.from('client_meal_plans').update({ active: false }).eq('id', cp.id)
    setCp(null)
  }

  if (!loaded) return null
  return (
    <div className="card">
      <p className="eyebrow">Meal plan</p>
      {!cp && <p className="muted-note">No plan assigned. Assign one from “Meal plans” below the client list.</p>}
      {cp && !editing && (
        <>
          <div className="session-title">{cp.title}</div>
          <PlanView plan={cp.plan} notes={cp.notes} />
          <div className="nudge-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn ghost sm" onClick={() => setEditing(true)}>Adapt for this client</button>
            <button type="button" className="link-btn inline" onClick={removePlan}>Remove</button>
          </div>
        </>
      )}
      {cp && editing && (
        <PlanEditor initial={cp} saveLabel="Save changes" onSave={saveAdapt} onCancel={() => setEditing(false)} />
      )}
    </div>
  )
}

// CLIENT: read their active plan.
export function ClientMealPlan({ clientId, coachName, onBack }) {
  const [cp, setCp] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const coachFirst = coachName?.split(' ')[0] || 'your coach'

  useEffect(() => {
    supabase.from('client_meal_plans').select('*').eq('client_id', clientId).eq('active', true).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { setCp(data?.[0] || null); setLoaded(true) })
  }, [clientId])

  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Meal plan</p>
      <h1 className="h1">Your plan.</h1>
      {!loaded && <p className="muted-note">Loading…</p>}
      {loaded && !cp && <p className="muted-note">{coachFirst} hasn’t set you a meal plan yet — it’ll show here when they do.</p>}
      {loaded && cp && (
        <>
          <p className="muted-note">{cp.title} — a guide from {coachFirst}. Use it for ideas; adapt portions to your day.</p>
          <div style={{ marginTop: 12 }}><PlanView plan={cp.plan} notes={cp.notes} /></div>
        </>
      )}
    </div>
  )
}
