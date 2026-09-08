import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient.js'
import { searchFoods } from './foods.js'
import { mealByHour, MEALS } from './lib.js'

// Local YYYY-MM-DD for today, and a noon-of-day ISO so a chosen day lands cleanly
// on that date regardless of timezone.
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dayISO = (s) => new Date(s + 'T12:00:00').toISOString()
const dayLabel = (s) => {
  if (s === todayStr()) return 'today'
  try { return new Date(s + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) } catch { return s }
}

// Type-search a food/drink (built-in list + live database + the coach's own
// library — see below), pick a portion, log the macros. Or add anything
// manually if it isn't found. Logs to today by default but the day picker
// lets a client back-fill or pre-log a meal on any date.
//
// coachFoods: when a client can't find something and adds it manually, it's
// saved to `coach_foods` (Paul's ask) — remembered so they don't retype it
// next time, and shared with every other client of the same coach. Unlike
// the per-100g static/API foods, these are a FIXED serving (exactly what was
// logged has no meaningful per-100g breakdown), so they skip the portion
// picker and log directly at their stored macros.
// contributorId is whoever is actually adding this entry (the authenticated
// user) — the client themselves when logging their own diary, or the coach
// when adding on a client's behalf from ClientDetail. NOT the same as whose
// diary this is: a coach adding food to a client's diary is still the
// contributor for library-attribution/RLS purposes.
export function FoodSearch({ onLog, defaultMeal, contributorId, coachId }) {
  const [q, setQ] = useState('')
  const [api, setApi] = useState([])
  const [coachFoods, setCoachFoods] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [grams, setGrams] = useState('')
  const [logged, setLogged] = useState('')
  const [manual, setManual] = useState(false)
  const [meal, setMeal] = useState(defaultMeal || mealByHour())
  const [day, setDay] = useState(todayStr())
  const timer = useRef(null)

  const local = searchFoods(q)

  useEffect(() => {
    if (!coachId) return
    supabase.from('coach_foods').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
      .then(({ data }) => setCoachFoods(data || []))
  }, [coachId])

  useEffect(() => {
    if (q.trim().length < 2) { setApi([]); setSearching(false); return }
    // Mark it as searching IMMEDIATELY, not inside the debounce. It used to be
    // set when the timer fired, so for the first 450ms the state was "not
    // searching, no results" and the screen said "No matches — add it manually"
    // before the request had even been sent. Paul: "One of my clients thought
    // nothing was in there as she saw it every time."
    setSearching(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/.netlify/functions/food-search?q=' + encodeURIComponent(q.trim()))
        const j = await res.json()
        setApi(j.results || [])
      } catch { setApi([]) } finally { setSearching(false) }
    }, 250)
    return () => clearTimeout(timer.current)
  }, [q])

  const qLower = q.trim().toLowerCase()
  const coachMatches = qLower.length >= 1
    ? coachFoods.filter((cf) => cf.name.toLowerCase().includes(qLower))
      .map((cf) => ({ n: cf.name, k: cf.calories, p: cf.protein_g, c: cf.carbs_g, f: cf.fat_g, fb: cf.fibre_g, fixed: true }))
    : []
  const seen = new Set([...coachMatches.map((f) => f.n.toLowerCase()), ...local.map((f) => f.n.toLowerCase())])
  const results = [...coachMatches, ...local, ...api.filter((r) => r.n && !seen.has(r.n.toLowerCase()))].slice(0, 20)

  // A client-contributed food is saved once per coach (first entry wins —
  // this is a quick shared list, not something worth a rename/merge UI for).
  async function saveToLibrary(m) {
    if (!coachId || !contributorId) return
    if (coachFoods.some((cf) => cf.name.toLowerCase() === m.name.toLowerCase())) return
    const { data } = await supabase.from('coach_foods').insert({
      coach_id: coachId, created_by: contributorId, name: m.name,
      calories: m.calories, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, fibre_g: m.fibre_g,
    }).select().single()
    if (data) setCoachFoods((cf) => [data, ...cf])
  }

  function pick(f) { setSelected(f); if (!f.fixed) setGrams(String(f.s || 100)) }
  function logSelected() {
    const g = Number(grams) || 0
    if (!g || !selected) return
    const factor = g / 100
    onLog({
      name: `${selected.n} (${g}g)`,
      calories: Math.round(selected.k * factor),
      protein_g: Math.round((selected.p || 0) * factor),
      carbs_g: Math.round((selected.c || 0) * factor),
      fat_g: Math.round((selected.f || 0) * factor),
      fibre_g: Math.round((selected.fb || 0) * factor),
      meal_type: meal,
      logged_at: dayISO(day),
    })
    setLogged(selected.n); setSelected(null); setQ(''); setApi([]); setGrams('')
    setTimeout(() => setLogged(''), 2200)
  }
  function logFixed() {
    if (!selected) return
    onLog({
      name: selected.n,
      calories: selected.k,
      protein_g: selected.p || 0,
      carbs_g: selected.c || 0,
      fat_g: selected.f || 0,
      fibre_g: selected.fb || 0,
      meal_type: meal,
      logged_at: dayISO(day),
    })
    setLogged(selected.n); setSelected(null); setQ(''); setApi([])
    setTimeout(() => setLogged(''), 2200)
  }

  if (selected && selected.fixed) {
    return (
      <div className="card">
        <button type="button" className="link-btn" onClick={() => setSelected(null)}>‹ Back to search</button>
        <p className="eyebrow accent">{selected.n}</p>
        <div className="macro-row">
          <span><b>{selected.p || 0}g</b> protein</span>
          <span><b>{selected.c || 0}g</b> carbs</span>
          <span><b>{selected.f || 0}g</b> fat</span>
          <span className="kcal"><b>{selected.k}</b> kcal</span>
        </div>
        <div className="grid-2">
          <label className="field">Meal<select value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="field">Day<input type="date" value={day} onChange={(e) => setDay(e.target.value || todayStr())} /></label>
        </div>
        <button className="btn primary" onClick={logFixed}>Add food{day !== todayStr() ? ` · ${dayLabel(day)}` : ''}</button>
      </div>
    )
  }

  if (selected) {
    const g = Number(grams) || 0, factor = g / 100
    return (
      <div className="card">
        <button type="button" className="link-btn" onClick={() => setSelected(null)}>‹ Back to search</button>
        <p className="eyebrow accent">{selected.n}</p>
        <label className="field">Portion (g / ml)<input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} /></label>
        {selected.s ? (
          <div className="serving-chips">
            <button type="button" className={grams === String(selected.s) ? 'on' : ''} onClick={() => setGrams(String(selected.s))}>Standard serving · {selected.s}g</button>
            <button type="button" className={grams === '100' ? 'on' : ''} onClick={() => setGrams('100')}>100g</button>
          </div>
        ) : (
          <p className="muted-note" style={{ marginTop: -4 }}>Weigh it for accuracy — enter the grams.</p>
        )}
        <div className="macro-row">
          <span><b>{Math.round((selected.p || 0) * factor)}g</b> protein</span>
          <span><b>{Math.round((selected.c || 0) * factor)}g</b> carbs</span>
          <span><b>{Math.round((selected.f || 0) * factor)}g</b> fat</span>
          <span className="kcal"><b>{Math.round(selected.k * factor)}</b> kcal</span>
        </div>
        <div className="grid-2">
          <label className="field">Meal<select value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="field">Day<input type="date" value={day} onChange={(e) => setDay(e.target.value || todayStr())} /></label>
        </div>
        <button className="btn primary" disabled={!g} onClick={logSelected}>Add food{day !== todayStr() ? ` · ${dayLabel(day)}` : ''}</button>
      </div>
    )
  }

  return (
    <div className="stack">
      <input className="food-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a food or drink…" autoFocus />
      {logged && <p className="logged-ok">Added {logged} ✓</p>}

      {q.trim().length >= 1 && (
        <div className="card food-results">
          {results.map((f, i) => (
            <button type="button" className="food-row" key={f.n + i} onClick={() => pick(f)}>
              <span className="food-name">{f.n}</span>
              <span className="food-kcal">{f.k} kcal{!f.fixed && <span className="muted-note"> /100g</span>}</span>
            </button>
          ))}
          {searching && <p className="muted-note">Searching…</p>}
          {!searching && results.length === 0 && <p className="muted-note">No matches — add it manually below.</p>}
        </div>
      )}

      {!manual
        ? <button className="btn ghost" onClick={() => setManual(true)}>Can’t find it? Add manually</button>
        : <><div className="grid-2">
            <label className="field">Meal<select value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label className="field">Day<input type="date" value={day} onChange={(e) => setDay(e.target.value || todayStr())} /></label>
          </div>
          <ManualFood dayLabel={day !== todayStr() ? dayLabel(day) : ''} onLog={(m) => { onLog({ ...m, meal_type: meal, logged_at: dayISO(day) }); saveToLibrary(m); setLogged(m.name); setManual(false); setTimeout(() => setLogged(''), 2200) }} onCancel={() => setManual(false)} /></>}
    </div>
  )
}

function ManualFood({ onLog, onCancel, dayLabel }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const [fb, setFb] = useState('')
  function add() {
    if (!name.trim() || !kcal) return
    onLog({ name: name.trim(), calories: Math.round(Number(kcal)) || 0, protein_g: Math.round(Number(p)) || 0, carbs_g: Math.round(Number(c)) || 0, fat_g: Math.round(Number(f)) || 0, fibre_g: Math.round(Number(fb)) || 0 })
  }
  return (
    <div className="card">
      <p className="eyebrow">Add manually</p>
      <label className="field">Food or drink<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mum’s lasagne" /></label>
      <div className="grid-2">
        <label className="field">Calories<input type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} /></label>
        <label className="field">Protein (g)<input type="number" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></label>
        <label className="field">Carbs (g)<input type="number" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} /></label>
        <label className="field">Fat (g)<input type="number" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} /></label>
        <label className="field">Fibre (g)<input type="number" inputMode="decimal" value={fb} onChange={(e) => setFb(e.target.value)} /></label>
      </div>
      <div className="nudge-actions">
        <button className="btn primary sm" disabled={!name.trim() || !kcal} onClick={add}>Add food{dayLabel ? ` · ${dayLabel}` : ''}</button>
        <button className="btn ghost sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
