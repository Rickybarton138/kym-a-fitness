import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient.js'
import { sumMacros, mealByHour, targetOn } from './lib.js'
import { FoodSearch } from './FoodSearch.jsx'
import { Metric, Loader } from './ui.jsx'
import { THEME } from './themes.js'
import { BarcodeScan, MealScan } from './FoodCapture.jsx'
import { RecipeCreator, RecipeEditor } from './RecipeCreator.jsx'
import { queueFood } from './foodQueue.js'

// Per-day food diary — itemised entries grouped by meal, with delete + daily totals
// vs target, and a weekly-averages summary. Shared by the client (their own diary)
// and the coach (a client's diary, editable). Meals are inferred from the log time.

const dayBounds = (d) => {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return [start, end]
}
const mealOf = (iso) => {
  const h = new Date(iso).getHours()
  if (h < 11) return 'Breakfast'
  if (h < 16) return 'Lunch'
  if (h < 21) return 'Dinner'
  return 'Snacks'
}
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
const isToday = (d) => d.toDateString() === new Date().toDateString()

const MAX_AHEAD = 14 // days you can pre-log into the future

// Monday of the week containing d. Weeks start Monday here because that is what
// a UK coach means by "last week", and because a Sunday-start week splits a
// weekend across two of them.
const mondayOf = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const weekStartFor = (offset) => {
  const m = mondayOf(new Date())
  m.setDate(m.getDate() + offset * 7)
  return m
}
// Whole weeks between the week containing `d` and this one. Rounded, because a
// clock change makes one of those spans 6 days and 23 hours.
const offsetForDate = (d) => Math.round((mondayOf(d) - mondayOf(new Date())) / (7 * 86400000))
const shortDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// The client's own saved recipes, loggable by the portion, plus a way to build
// a new one without leaving the diary. Paul: "a tab for their recipes ... or
// they can create a new one as part of the logging ... recipe creation at the
// client level asks them how many servings a recipe makes and then the app
// works out the calories per serving." That maths already existed in
// RecipeCreator; what was missing was a way to reach it while logging, and a
// way to log what you had made.
function MyRecipes({ clientId, onLog, defaultMeal }) {
  const [rows, setRows] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [portions, setPortions] = useState({})
  const [meal, setMeal] = useState(defaultMeal)
  const [logged, setLogged] = useState(null)

  async function load() {
    const { data } = await supabase.from('recipes')
      .select('id, title, servings, calories, protein_g, carbs_g, fat_g, fibre_g')
      .eq('client_id', clientId).order('created_at', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { load() }, [clientId])

  if (creating) {
    return <RecipeCreator clientId={clientId} onSaved={() => load()} onClose={() => { setCreating(false); load() }} />
  }
  if (rows === null) return <Loader text="Loading your recipes…" />

  const log = (r) => {
    // Stored macros are already PER SERVING, so a portion count multiplies them.
    const n = Number(portions[r.id] || 1) || 1
    onLog({
      name: n === 1 ? r.title : `${r.title} (${n} servings)`,
      calories: Math.round((r.calories || 0) * n),
      protein_g: Math.round((r.protein_g || 0) * n),
      carbs_g: Math.round((r.carbs_g || 0) * n),
      fat_g: Math.round((r.fat_g || 0) * n),
      fibre_g: Math.round((r.fibre_g || 0) * n),
      meal_type: meal,
      // The link back to the recipe, so the diary entry can be re-costed later
      // if the recipe changes. Paul, 12 Oct: someone pre-tracks Thursday, then
      // adjusts the recipe when Thursday comes round.
      recipe_id: r.id,
      portions: n,
    })
    setLogged(r.id)
    setTimeout(() => setLogged(null), 2000)
  }

  return (
    <div className="stack">
      <label className="field">Meal
        <select className="ex-select" value={meal} onChange={(e) => setMeal(e.target.value)}>
          {MEALS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>

      {rows.length === 0 && (
        <p className="muted-note">No recipes saved yet. Build one and the app works out the calories for a single portion from the whole batch.</p>
      )}

      {rows.map((r) => (
        <div className="card" key={r.id} style={{ background: 'var(--surface-2)' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
          <p className="muted-note" style={{ margin: '2px 0 0' }}>
            {r.calories} kcal per serving · {r.protein_g}g P · {r.carbs_g}g C · {r.fat_g}g F
            {r.servings > 1 ? ` · makes ${r.servings}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
            <label className="field" style={{ flex: '0 0 96px' }}>Portions
              <input type="text" inputMode="decimal"
                value={portions[r.id] ?? '1'}
                onChange={(e) => setPortions((p) => ({ ...p, [r.id]: e.target.value }))} />
            </label>
            <button type="button" className="btn ghost sm" style={{ marginBottom: 2 }} onClick={() => setEditing(r)}>Edit</button>
            <button type="button" className="btn primary sm" style={{ marginBottom: 2 }} onClick={() => log(r)}>
              {logged === r.id ? 'Added ✓' : 'Log this'}
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="btn ghost" onClick={() => setCreating(true)}>Create a recipe</button>

      {editing && (
        <RecipeEditor
          recipe={editing}
          onSaved={() => load()}
          onDeleted={(id) => setRows((rs) => (rs || []).filter((x) => x.id !== id))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

export function FoodDiary({ clientId, coachId, contributorId, title = 'Food diary', onBack, onChanged }) {
  const [day, setDay] = useState(() => new Date())
  const [logs, setLogs] = useState(null)
  const [editing, setEditing] = useState(null) // nutrition_logs row being corrected
  const [mult, setMult] = useState('1')
  const [eMeal, setEMeal] = useState('')
  const [eDate, setEDate] = useState('')
  const [addTab, setAddTab] = useState('search')
  const [copying, setCopying] = useState(null)   // the meal name being copied
  const [copyTo, setCopyTo] = useState('')       // target date
  const [copyMeal, setCopyMeal] = useState('')   // target meal
  const [copyBusy, setCopyBusy] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')
  const [yesterday, setYesterday] = useState(null) // what was eaten this meal, the day before
  const [savingEdit, setSavingEdit] = useState(false)
  const [editErr, setEditErr] = useState('')
  const [eRecipe, setERecipe] = useState(null)   // the recipe this entry came from, if any
  const [eRecipeState, setERecipeState] = useState('none') // none | loading | unavailable | loaded
  const [eServings, setEServings] = useState('1')
  const [refresh, setRefresh] = useState(false)  // "update from the recipe" was tapped
  const [targets, setTargets] = useState(null)
  const [week, setWeek] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, -1 = last week
  // The dated trail of what the target HAS been, so a past day is scored against
  // the target it was actually chasing. Newest first.
  const [history, setHistory] = useState([])
  const [adding, setAdding] = useState(false)
  // "I've finished logging for today" — Paul's ask, so the agenda tick means the
  // day is done rather than merely started. Flag-gated; brands without it never
  // query the table and their agenda behaves exactly as before.
  const dayComplete = THEME.features?.foodDayComplete
  const [complete, setComplete] = useState(false)
  const [marking, setMarking] = useState(false)
  const dayKey = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

  async function loadDay(d) {
    const [start, end] = dayBounds(d)
    const { data } = await supabase.from('nutrition_logs').select('*').eq('client_id', clientId)
      .gte('logged_at', start.toISOString()).lt('logged_at', end.toISOString()).order('logged_at', { ascending: true })
    setLogs(data || [])
    if (dayComplete) {
      const { data: c } = await supabase.from('food_day_complete').select('day')
        .eq('client_id', clientId).eq('day', dayKey(d)).maybeSingle()
      setComplete(!!c)
    }
  }

  async function toggleComplete() {
    setMarking(true)
    if (complete) {
      await supabase.from('food_day_complete').delete().eq('client_id', clientId).eq('day', dayKey(day))
      setComplete(false)
    } else {
      await supabase.from('food_day_complete').upsert({ client_id: clientId, day: dayKey(day) })
      setComplete(true)
    }
    setMarking(false)
    onChanged?.()
  }
  // Paul, 21 Sept: "the weekly overview with the graph. Can we have the option
  // both for me and the client to go back week by week and maybe have a calendar
  // drop down too so they and I can see previous weeks to spot trends?"
  //
  // This turned the week from a ROLLING last-7-days into real Monday-to-Sunday
  // weeks, and that was not optional: "go back a week" on a rolling window gives
  // you an arbitrary overlapping range, and a date picker has to answer "the
  // week containing this date". Weeks you can name are also the only ones you
  // can compare, which is the whole point of the ask.
  async function loadWeek(offset = weekOffset) {
    const start = weekStartFor(offset)
    const end = new Date(start); end.setDate(end.getDate() + 7)
    const { data } = await supabase.from('nutrition_logs').select('calories, protein_g, carbs_g, fat_g, fibre_g, logged_at')
      .eq('client_id', clientId).gte('logged_at', start.toISOString()).lt('logged_at', end.toISOString())
    const byDay = {}
    ;(data || []).forEach((l) => { const k = new Date(l.logged_at).toDateString(); (byDay[k] = byDay[k] || []).push(l) })
    const todayKey = new Date(); todayKey.setHours(0, 0, 0, 0)
    const days = []
    for (let i = 0; i < 7; i++) {
      const dd = new Date(start); dd.setDate(dd.getDate() + i)
      const k = dd.toDateString()
      // The current week is only partly lived. Future days keep their column so
      // the chart does not change width mid-week, but they are not "a day with
      // nothing logged" — counting them as a zero would drag every average down.
      days.push({ date: dd, ...sumMacros(byDay[k] || []), logged: !!byDay[k], future: dd > todayKey, target: targetOn(history, dd, targets) })
    }
    setWeek(days)
  }
  useEffect(() => { loadDay(day) }, [day])
  useEffect(() => {
    supabase.from('macro_targets').select('*').eq('client_id', clientId).maybeSingle().then(({ data }) => setTargets(data))
    supabase.from('macro_target_history').select('*').eq('client_id', clientId)
      .order('effective_from', { ascending: false })
      .then(({ data }) => setHistory(data || []))
  }, [])
  useEffect(() => { loadWeek(weekOffset) }, [weekOffset, history, targets])

  // Correcting an entry after the fact: the portion it was logged at, which meal
  // it belongs to, and which day. Macros are stored as absolutes, so a portion
  // change is a multiplier applied to what's there now.
  function openEdit(l) {
    setEditing(l)
    setMult('1')
    setEMeal(l.meal_type || mealOf(l.logged_at))
    setEDate(dayKey(new Date(l.logged_at)))
    setEditErr('')
    // Paul, 12 Oct: "If someone has pretracked a recipe in advance ... but when
    // that day rolls around they make some adjustments to the recipe". An entry
    // logged from a recipe carries recipe_id, so the current recipe is fetched
    // here and the sheet offers to re-cost THIS entry from it. Deliberately
    // only this entry - the same recipe may sit in a dozen other days that were
    // eaten as they were written, and rewriting those would be a lie.
    setERecipe(null)
    setRefresh(false)
    setEServings(String(l.portions || 1))
    // Three states, not two. "I haven't fetched it yet" and "it isn't there"
    // are different things: the coach opens this same diary, and a client's own
    // recipe is not readable by anyone else, so Paul seeing a client's entry
    // would otherwise be told a recipe that exists has been deleted.
    if (!l.recipe_id) { setERecipeState('none'); return }
    setERecipeState('loading')
    supabase.from('recipes').select('id, title, servings, calories, protein_g, carbs_g, fat_g, fibre_g')
      .eq('id', l.recipe_id).maybeSingle()
      .then(({ data }) => { setERecipe(data || null); setERecipeState(data ? 'loaded' : 'unavailable') })
  }
  // The one rule that decides whether a save re-costs from the recipe. The
  // sheet's preview and saveEdit both read it, so the preview cannot promise
  // something the save then doesn't do.
  function recostPlan() {
    if (!editing) return null
    if (eRecipeState !== 'loaded' || !eRecipe) return null
    const loggedServings = Math.max(0.05, Number(editing.portions) || 1)
    const asked = Math.max(0.05, Number(String(eServings).replace(/[,\s]/g, '')) || 1)
    if (!refresh && asked === loggedServings) return null
    return { n: asked, calories: Math.round((eRecipe.calories || 0) * asked) }
  }
  const recostPreview = recostPlan()?.calories ?? null

  async function saveEdit() {
    const when = new Date(editing.logged_at)
    const [y, m, d] = eDate.split('-').map(Number)
    when.setFullYear(y, m - 1, d) // keep the time of day, move the date

    // Two different sums, and WHICH one runs is deliberately narrow.
    //
    // Re-costing from the recipe only happens when the client actually asked
    // for it: they changed the servings, or they tapped "Update from the
    // recipe". Moving an entry from Lunch to Dinner must not quietly rewrite
    // its macros - an entry logged at 1 serving and later corrected by hand
    // would otherwise be reset to whatever the recipe says today, and the 66
    // entries backfilled with portions=1 are exactly the ones that would get
    // it. Anything else keeps the old behaviour: scale what is stored.
    const plan = recostPlan()

    let patch
    if (plan) {
      const n = plan.n
      const per = (v) => Math.round((v || 0) * n)
      patch = {
        name: n === 1 ? eRecipe.title : `${eRecipe.title} (${n} servings)`,
        calories: per(eRecipe.calories), protein_g: per(eRecipe.protein_g),
        carbs_g: per(eRecipe.carbs_g), fat_g: per(eRecipe.fat_g), fibre_g: per(eRecipe.fibre_g),
        portions: n,
      }
    } else {
      const f = Math.max(0.05, Number(String(mult).replace(/[,\s]/g, '')) || 1)
      const scale = (v) => Math.round((v || 0) * f)
      patch = {
        calories: scale(editing.calories), protein_g: scale(editing.protein_g),
        carbs_g: scale(editing.carbs_g), fat_g: scale(editing.fat_g), fibre_g: scale(editing.fibre_g),
      }
    }

    setSavingEdit(true)
    const { error } = await supabase.from('nutrition_logs').update({
      ...patch, meal_type: eMeal, logged_at: when.toISOString(),
    }).eq('id', editing.id)
    setSavingEdit(false)
    if (error) { setEditErr(error.message); return }
    setEditing(null)
    loadDay(day); loadWeek(); onChanged && onChanged()
  }

  async function del(id) {
    await supabase.from('nutrition_logs').delete().eq('id', id)
    setLogs((l) => l.filter((x) => x.id !== id)); loadWeek()
  }
  // Returns false when the row only reached this device. Same contract as
  // ClientApp's logFood — FoodSearch waits on it before it says "Added".
  async function addFood(m) {
    const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0)
    const row = {
      client_id: clientId, source: 'manual', name: m.name || 'Food',
      calories: m.calories || 0, protein_g: m.protein_g || 0, carbs_g: m.carbs_g || 0, fat_g: m.fat_g || 0, fibre_g: m.fibre_g || 0,
      meal_type: m.meal_type || mealByHour(day), logged_at: when.toISOString(),
      // Only set when the food came from a recipe. queueFood replays the row
      // object verbatim, so an offline log keeps the link too.
      ...(m.recipe_id ? { recipe_id: m.recipe_id, portions: m.portions || 1 } : {}),
    }
    const { error } = await supabase.from('nutrition_logs').insert(row)
    if (error) { queueFood(row); return false }
    loadDay(day); loadWeek()
    return true
  }
  // Paul: "in the food diary, is it possible to copy meals from previous days?
  // MyFitnessPal allows it ... You can also go to a previous day and select copy
  // on a meal and then put in what day and meal you want to copy it to."
  //
  // Both halves of that: copy a whole meal somewhere else, and — because the
  // commonest case by far is eating the same breakfast again — a one-tap repeat
  // of yesterday's version of the meal you are already adding to.
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  async function copyMealTo(mealName, targetDay, targetMeal) {
    const items = (logs || []).filter((l) => (l.meal_type || mealOf(l.logged_at)) === mealName)
    if (!items.length) return 0
    const [y, m, d] = targetDay.split('-').map(Number)
    const when = new Date(y, m - 1, d, 12, 0, 0)
    const rows = items.map((l) => ({
      client_id: clientId, source: 'manual', name: l.name,
      calories: l.calories, protein_g: l.protein_g, carbs_g: l.carbs_g, fat_g: l.fat_g, fibre_g: l.fibre_g,
      meal_type: targetMeal, logged_at: when.toISOString(),
    }))
    const { error } = await supabase.from('nutrition_logs').insert(rows)
    if (error) throw new Error(error.message)
    return rows.length
  }

  async function runCopy() {
    setCopyBusy(true); setCopyMsg('')
    try {
      const n = await copyMealTo(copying, copyTo, copyMeal)
      const sameDay = copyTo === ymd(day)
      setCopyMsg(`${n} item${n === 1 ? '' : 's'} copied to ${copyMeal}${sameDay ? '' : ' on ' + copyTo}.`)
      if (sameDay) { loadDay(day); loadWeek() }
      setTimeout(() => { setCopying(null); setCopyMsg('') }, 2200)
    } catch (e) {
      setCopyMsg(e.message || 'Could not copy that — try again.')
    } finally { setCopyBusy(false) }
  }

  // What they ate for this meal yesterday, offered inside the add sheet.
  async function loadYesterday(mealName) {
    const prev = new Date(day); prev.setDate(prev.getDate() - 1)
    const from = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), 0, 0, 0)
    const to = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), 23, 59, 59)
    const { data } = await supabase.from('nutrition_logs').select('*')
      .eq('client_id', clientId).gte('logged_at', from.toISOString()).lte('logged_at', to.toISOString())
    const items = (data || []).filter((l) => (l.meal_type || mealOf(l.logged_at)) === mealName)
    setYesterday(items.length ? { meal: mealName, items, label: ymd(prev) } : null)
  }

  async function repeatYesterday() {
    if (!yesterday) return
    const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0)
    await supabase.from('nutrition_logs').insert(yesterday.items.map((l) => ({
      client_id: clientId, source: 'manual', name: l.name,
      calories: l.calories, protein_g: l.protein_g, carbs_g: l.carbs_g, fat_g: l.fat_g, fibre_g: l.fibre_g,
      meal_type: yesterday.meal, logged_at: when.toISOString(),
    })))
    setYesterday(null)
    loadDay(day); loadWeek()
  }

  const maxDay = () => { const m = new Date(); m.setDate(m.getDate() + MAX_AHEAD); return m }
  const shift = (n) => { const d = new Date(day); d.setDate(d.getDate() + n); if (d <= maxDay()) setDay(d) }
  const canForward = (() => { const d = new Date(day); d.setDate(d.getDate() + 1); return d <= maxDay() })()

  const totals = sumMacros(logs || [])
  const grouped = MEALS.map((m) => ({ meal: m, items: (logs || []).filter((l) => (l.meal_type || mealOf(l.logged_at)) === m) })).filter((g) => g.items.length)
  const isFuture = day > new Date() && !isToday(day)
  const inPast = (week || []).filter((d) => !d.future)
  const loggedDays = inPast.filter((d) => d.logged)
  const avg = loggedDays.length ? {
    calories: Math.round(loggedDays.reduce((a, d) => a + d.calories, 0) / loggedDays.length),
    protein_g: Math.round(loggedDays.reduce((a, d) => a + d.protein_g, 0) / loggedDays.length),
    carbs_g: Math.round(loggedDays.reduce((a, d) => a + d.carbs_g, 0) / loggedDays.length),
    fat_g: Math.round(loggedDays.reduce((a, d) => a + d.fat_g, 0) / loggedDays.length),
    fibre_g: Math.round(loggedDays.reduce((a, d) => a + d.fibre_g, 0) / loggedDays.length),
  } : null
  // What this particular day was aiming at, not what the client aims at now.
  const dayTarget = targetOn(history, day, targets)
  const maxCal = Math.max((dayTarget?.calories || 0), ...(week || []).map((d) => d.calories), 1)
  // Net weekly calories — real total intake (blank days count as zero, same
  // as the bar chart) vs the full weekly target. Paul's check-in question:
  // "are they over or under for the week", not just an average day.
  // Against the days actually lived, not a flat seven. On a Tuesday the old
  // maths compared two days of eating with a whole week's target and reported
  // the client 5,000 kcal under.
  const weekTotalCal = inPast.reduce((s, d) => s + d.calories, 0)
  const daysSoFar = Math.max(inPast.length, 1)
  const weekTargetCal = inPast.reduce((s, d) => s + (Number(d.target?.calories) || 0), 0)
  const netCal = weekTargetCal ? weekTotalCal - weekTargetCal : null
  // Only worth naming a single number when the target did not move mid-week.
  const oneTarget = inPast.length && inPast.every((d) => d.target?.calories === inPast[0].target?.calories)
    ? Number(inPast[0].target?.calories) || 0 : null

  return (
    <div>
      {onBack && <button className="link-btn" onClick={onBack}>‹ Back</button>}
      <p className="eyebrow accent">{title}</p>
      <div className="diary-nav">
        <button type="button" className="btn ghost sm" onClick={() => shift(-1)}>‹</button>
        <b>{isToday(day) ? 'Today' : day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{isFuture ? ' · planned' : ''}</b>
        <button type="button" className="btn ghost sm" disabled={!canForward} onClick={() => shift(1)}>›</button>
      </div>

      <div className="card">
        <div className="macro-row">
          <span><b>{totals.calories}</b>{dayTarget?.calories ? ` / ${dayTarget.calories}` : ''} kcal</span>
          <span><b>{totals.protein_g}</b>g P</span>
          <span><b>{totals.carbs_g}</b>g C</span>
          <span><b>{totals.fat_g}</b>g F</span>
          <span><b>{totals.fibre_g}</b>g fibre</span>
        </div>
      </div>

      <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={() => { setAdding(true); loadYesterday(mealByHour(day)) }}>
        + Add food{isFuture ? ' (plan ahead)' : ''}
      </button>

      {/* Only the client can finish their own day — the coach viewing this diary
          can still add and amend entries, but RLS won't let them write the flag. */}
      {dayComplete && !isFuture && contributorId === clientId && (
        <>
          <button type="button" className={'btn ' + (complete ? 'ghost' : 'primary')} style={{ marginTop: 8 }} disabled={marking} onClick={toggleComplete}>
            {marking ? '…' : complete ? 'Logging complete ✓ · undo' : 'Complete logging for the day'}
          </button>
          {!complete && (logs || []).length > 0 && (
            <p className="muted-note" style={{ marginTop: 6 }}>Tap this once you’ve logged everything — that’s what ticks it off on your home screen.</p>
          )}
        </>
      )}

      {logs === null && <p className="muted-note" style={{ marginTop: 12 }}>Loading…</p>}
      {logs !== null && logs.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>{isFuture || !isToday(day) ? 'Nothing here — plan the day by adding food above.' : 'Nothing logged yet — add food above.'}</p>}
      {grouped.map((g) => (
        <div className="card" key={g.meal}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p className="eyebrow">{g.meal}</p>
            <button
              type="button" className="link-btn"
              onClick={() => {
                setCopying(copying === g.meal ? null : g.meal)
                setCopyTo(ymd(day)); setCopyMeal(g.meal); setCopyMsg('')
              }}
            >{copying === g.meal ? 'Cancel' : 'Copy'}</button>
          </div>

          {copying === g.meal && (
            <div className="card" style={{ background: 'var(--surface-2)', marginBottom: 10 }}>
              <p className="muted-note" style={{ marginTop: 0 }}>
                Copy all {g.items.length} item{g.items.length === 1 ? '' : 's'} to:
              </p>
              <div className="grid-2">
                <label className="field">Day
                  <input type="date" value={copyTo} max={ymd(maxDay())} onChange={(e) => setCopyTo(e.target.value)} />
                </label>
                <label className="field">Meal
                  <select className="ex-select" value={copyMeal} onChange={(e) => setCopyMeal(e.target.value)}>
                    {MEALS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
              </div>
              {copyMsg && <p className="logged-ok">{copyMsg}</p>}
              <button type="button" className="btn primary sm" disabled={copyBusy || !copyTo} onClick={runCopy}>
                {copyBusy ? 'Copying…' : 'Copy it'}
              </button>
            </div>
          )}

          {g.items.map((l) => (
            <div className="diary-item" key={l.id}>
              <button type="button" className="diary-name diary-edit" onClick={() => openEdit(l)} aria-label={`Edit ${l.name || 'entry'}`}>
                {l.name || 'Food'}<span className="diary-macros">{l.calories} kcal · {l.protein_g}P {l.carbs_g}C {l.fat_g}F</span>
              </button>
              {/* The whole name has always opened the editor, but nothing said so
                  - Paul asked for an edit button because there wasn't one to see. */}
              <button type="button" className="diary-act" onClick={() => openEdit(l)} aria-label={`Edit ${l.name || 'entry'}`}>Edit</button>
              <button type="button" className="diary-del" onClick={() => del(l.id)} aria-label={`Delete ${l.name || 'entry'}`}>×</button>
            </div>
          ))}
        </div>
      ))}

      {editing && (
        <div className="sheet-overlay" onClick={() => setEditing(null)}>
          <div className="card sheet" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow accent">Edit entry</p>
            <div className="session-title" style={{ marginTop: 2 }}>{editing.name || 'Food'}</div>
            <p className="muted-note">Currently {editing.calories} kcal · {editing.protein_g}P {editing.carbs_g}C {editing.fat_g}F</p>

            {eRecipeState === 'loading' && <p className="muted-note" style={{ marginTop: 10 }}>Checking the recipe this came from…</p>}

            {eRecipeState === 'loaded' ? (
              <>
                <p className="muted-note" style={{ marginTop: 10 }}>
                  From your recipe <b>{eRecipe.title}</b> — {eRecipe.calories} kcal a serving as the recipe stands now.
                  This entry is logged at {editing.calories} kcal.
                </p>
                <label className="field" style={{ marginTop: 10 }}>Servings eaten
                  <input type="text" inputMode="decimal" value={eServings} onChange={(e) => { setEServings(e.target.value); setRefresh(false) }} />
                </label>
                <div className="seg" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                  {['0.5', '1', '1.5', '2'].map((v) => (
                    <button type="button" key={v} className={eServings === v ? 'on' : ''} onClick={() => { setEServings(v); setRefresh(false) }}>{v}</button>
                  ))}
                </div>
                {/* Paul's Thursday case in one tap: the recipe changed after the
                    day was pre-tracked. Without this, saving a meal or day
                    correction would re-cost the entry whether you wanted it or
                    not, which would quietly undo any hand-tuned figures. */}
                <button type="button" className={'btn sm ' + (refresh ? 'primary' : 'ghost')} style={{ marginTop: 8 }} onClick={() => setRefresh(true)}>
                  {refresh ? 'Will update from the recipe ✓' : 'Update from the recipe'}
                </button>
                <p className="muted-note" style={{ marginTop: 6 }}>
                  {recostPreview === null
                    ? 'The amounts stay as they are unless you change the servings or tap the button above.'
                    : `Saves as ${recostPreview} kcal. Only this entry changes — other days you logged it stay as they were.`}
                </p>
              </>
            ) : (
              <>
                {eRecipeState === 'unavailable' && (
                  <p className="muted-note" style={{ marginTop: 10 }}>
                    This came from a recipe that can’t be opened from here — it may have been deleted, or it belongs to the client. It can still be scaled.
                  </p>
                )}
                <label className="field" style={{ marginTop: 10 }}>Portion
                  <input type="text" inputMode="decimal" value={mult} onChange={(e) => setMult(e.target.value)} />
                </label>
                <div className="seg" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                  {['0.5', '1', '1.5', '2'].map((v) => (
                    <button type="button" key={v} className={mult === v ? 'on' : ''} onClick={() => setMult(v)}>{v}×</button>
                  ))}
                </div>
                <p className="muted-note" style={{ marginTop: 6 }}>
                  {Number(mult) === 1 ? 'Leave at 1× to keep the amounts as they are.' : `Saves as ${Math.round((editing.calories || 0) * (Number(mult) || 1))} kcal.`}
                </p>
              </>
            )}

            <div className="grid-2" style={{ marginTop: 10 }}>
              <label className="field">Meal
                <select className="ex-select" value={eMeal} onChange={(e) => setEMeal(e.target.value)}>
                  {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="field">Day<input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} /></label>
            </div>

            {editErr && <p className="error">{editErr}</p>}
            <div className="nudge-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn primary sm" disabled={savingEdit || !eDate || eRecipeState === 'loading'} onClick={saveEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</button>
              <button type="button" className="btn ghost sm" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card week-snapshot">
        {/* Paul, 21 Sept: "can we have the option both for me and the client to
            go back week by week and maybe have a calendar drop down too so they
            and I can see previous weeks to spot trends?" Both, and because this
            card is the same component for the coach and the client, one set of
            controls serves them both. Forward is capped at this week — there is
            nothing to see in a week nobody has eaten yet. */}
        <div className="wk-nav">
          <button type="button" className="btn ghost sm" onClick={() => setWeekOffset((o) => o - 1)} aria-label="Previous week">‹</button>
          <div className="wk-nav-label">
            <p className="eyebrow" style={{ margin: 0 }}>
              {weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : 'Week of'}
            </p>
            {/* The dates only when the name alone does not locate the week —
                "Last week · 8 Sep – 14 Sep" is useful, "This week" twice is not. */}
            {weekOffset !== 0 && (
              <span className="muted-note">
                {shortDate(weekStartFor(weekOffset))} – {shortDate(new Date(weekStartFor(weekOffset).getTime() + 6 * 86400000))}
              </span>
            )}
          </div>
          <button type="button" className="btn ghost sm" disabled={weekOffset >= 0} onClick={() => setWeekOffset((o) => Math.min(0, o + 1))} aria-label="Next week">›</button>
        </div>
        <div className="wk-nav-jump">
          <label className="field">Jump to a week
            <input
              type="date" max={dayKey(new Date())}
              value={dayKey(weekStartFor(weekOffset))}
              onChange={(e) => { if (e.target.value) setWeekOffset(Math.min(0, offsetForDate(new Date(e.target.value + 'T12:00:00')))) }}
            />
          </label>
          {weekOffset !== 0 && <button type="button" className="link-btn inline" onClick={() => setWeekOffset(0)}>Back to this week</button>}
        </div>
        {/* Paul, 12 Sept: "be able to show each day what the actual total
            calories was for that day... and maybe have a bar at the end there
            as well that shows what the average was."
            The average is drawn INSIDE the chart so it can be compared against
            the days by eye, which is the point of asking for it — but hollow and
            behind a divider, because it is a summary of the seven and not an
            eighth day. Days with nothing logged show a dimmed 0 rather than
            nothing: "I didn't log" and "I ate nothing" look identical otherwise,
            and the average already excludes them. */}
        <div className="diary-week">
          {(week || []).map((d, i) => (
            <div className={'dw-col' + (d.future ? ' ahead' : '')} key={i}>
              <span className={'dw-val' + (d.logged ? '' : ' none')}>{d.future ? '' : d.logged ? d.calories.toLocaleString() : '0'}</span>
              <div className="dw-bar-wrap"><div className="dw-bar" style={{ height: `${Math.round((d.calories / maxCal) * 100)}%`, background: d.target?.calories && d.calories > d.target.calories * 1.05 ? '#e5533c' : 'var(--accent)' }} /></div>
              <span className="dw-day">{d.date.toLocaleDateString('en-GB', { weekday: 'narrow' })}</span>
            </div>
          ))}
          {avg && (
            <div className="dw-col avg">
              <span className="dw-val">{avg.calories.toLocaleString()}</span>
              <div className="dw-bar-wrap"><div className="dw-bar" style={{ height: `${Math.round((avg.calories / maxCal) * 100)}%` }} /></div>
              <span className="dw-day">Avg</span>
            </div>
          )}
        </div>
        {netCal != null && avg && (
          <p className="muted-note" style={{ marginTop: 8 }}>
            Net <b className={netCal > 0 ? 'over' : 'under'}>{netCal > 0 ? '+' : ''}{netCal} kcal</b> vs target ({oneTarget ? `${oneTarget} × ${daysSoFar} day${daysSoFar === 1 ? '' : 's'}` : `${weekTargetCal.toLocaleString()} over ${daysSoFar} day${daysSoFar === 1 ? '' : 's'} — your target changed`})
          </p>
        )}
        {avg ? (
          <>
            <p className="muted-note" style={{ marginTop: netCal != null ? 4 : 8 }}>Average over {loggedDays.length} logged day{loggedDays.length === 1 ? '' : 's'}: <b>{avg.calories} kcal</b>{oneTarget ? ` (target ${oneTarget})` : ''} · {avg.carbs_g}g C · {avg.fat_g}g F</p>
            <div className="metrics-2" style={{ marginTop: 10 }}>
              <Metric k="Protein / day" v={`${avg.protein_g}g`} d={targets?.protein_g ? `target ${targets.protein_g}g` : ''} emphasize />
              <Metric k="Fibre / day" v={`${avg.fibre_g}g`} d={targets?.fibre_g ? `target ${targets.fibre_g}g` : ''} />
            </div>
          </>
        ) : <p className="muted-note" style={{ marginTop: 8 }}>{weekOffset === 0 ? 'No food logged this week yet.' : 'Nothing was logged that week.'}</p>}
      </div>

      {adding && (
        <div className="sheet-overlay" onClick={() => setAdding(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><b>Add food{isToday(day) ? '' : ' · ' + day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</b><button className="link-btn" onClick={() => setAdding(false)}>Done</button></div>
            {/* Paul: "if people are adding a mixture of foods that they would
                search out and foods they would scan the barcode they can do it
                all in one place. Similarly they can also scan their plate from
                there too." Every way of logging, behind one button, all writing
                to the day being viewed — so it backdates correctly too. */}
            <div className="seg four" style={{ marginBottom: 12 }}>
              <button type="button" className={addTab === 'search' ? 'on' : ''} onClick={() => setAddTab('search')}>Search</button>
              {THEME.features?.barcode && <button type="button" className={addTab === 'barcode' ? 'on' : ''} onClick={() => setAddTab('barcode')}>Barcode</button>}
              <button type="button" className={addTab === 'plate' ? 'on' : ''} onClick={() => setAddTab('plate')}>Scan plate</button>
              {THEME.features?.recipes && <button type="button" className={addTab === 'recipes' ? 'on' : ''} onClick={() => setAddTab('recipes')}>Recipes</button>}
            </div>
            {/* The commonest copy of all: the same breakfast as yesterday.
                Offered before the search box, because if this is what they
                wanted it saves the whole interaction. */}
            {yesterday && yesterday.items.length > 0 && (
              <button type="button" className="btn ghost" style={{ marginBottom: 10, textAlign: 'left' }} onClick={repeatYesterday}>
                Same {yesterday.meal.toLowerCase()} as yesterday
                <span className="muted-note" style={{ display: 'block', marginTop: 2 }}>
                  {yesterday.items.map((i) => i.name).slice(0, 3).join(', ')}
                  {yesterday.items.length > 3 ? ` +${yesterday.items.length - 3} more` : ''}
                  {' · '}{yesterday.items.reduce((n, i) => n + (i.calories || 0), 0)} kcal
                </span>
              </button>
            )}
            {addTab === 'search' && <FoodSearch onLog={addFood} defaultMeal={mealByHour(day)} coachId={coachId} contributorId={contributorId} />}
            {addTab === 'barcode' && <BarcodeScan onLog={addFood} />}
            {addTab === 'plate' && <MealScan onLog={addFood} />}
            {addTab === 'recipes' && <MyRecipes clientId={clientId} onLog={addFood} defaultMeal={mealByHour(day)} />}
          </div>
        </div>
      )}
    </div>
  )
}
