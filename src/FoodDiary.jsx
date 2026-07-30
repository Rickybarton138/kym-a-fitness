import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient.js'
import { sumMacros, mealByHour } from './lib.js'
import { FoodSearch } from './FoodSearch.jsx'

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

export function FoodDiary({ clientId, title = 'Food diary', onBack }) {
  const [day, setDay] = useState(() => new Date())
  const [logs, setLogs] = useState(null)
  const [targets, setTargets] = useState(null)
  const [week, setWeek] = useState(null)
  const [adding, setAdding] = useState(false)

  async function loadDay(d) {
    const [start, end] = dayBounds(d)
    const { data } = await supabase.from('nutrition_logs').select('*').eq('client_id', clientId)
      .gte('logged_at', start.toISOString()).lt('logged_at', end.toISOString()).order('logged_at', { ascending: true })
    setLogs(data || [])
  }
  async function loadWeek() {
    const from = new Date(); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('nutrition_logs').select('calories, protein_g, carbs_g, fat_g, logged_at')
      .eq('client_id', clientId).gte('logged_at', from.toISOString())
    const byDay = {}
    ;(data || []).forEach((l) => { const k = new Date(l.logged_at).toDateString(); (byDay[k] = byDay[k] || []).push(l) })
    const days = []
    for (let i = 6; i >= 0; i--) { const dd = new Date(); dd.setDate(dd.getDate() - i); const k = dd.toDateString(); days.push({ date: dd, ...sumMacros(byDay[k] || []), logged: !!byDay[k] }) }
    setWeek(days)
  }
  useEffect(() => { loadDay(day) }, [day])
  useEffect(() => {
    supabase.from('macro_targets').select('*').eq('client_id', clientId).maybeSingle().then(({ data }) => setTargets(data))
    loadWeek()
  }, [])

  async function del(id) {
    await supabase.from('nutrition_logs').delete().eq('id', id)
    setLogs((l) => l.filter((x) => x.id !== id)); loadWeek()
  }
  async function addFood(m) {
    const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0)
    await supabase.from('nutrition_logs').insert({
      client_id: clientId, source: 'manual', name: m.name || 'Food',
      calories: m.calories || 0, protein_g: m.protein_g || 0, carbs_g: m.carbs_g || 0, fat_g: m.fat_g || 0, fibre_g: m.fibre_g || 0,
      meal_type: m.meal_type || mealByHour(day), logged_at: when.toISOString(),
    })
    loadDay(day); loadWeek()
  }
  const maxDay = () => { const m = new Date(); m.setDate(m.getDate() + MAX_AHEAD); return m }
  const shift = (n) => { const d = new Date(day); d.setDate(d.getDate() + n); if (d <= maxDay()) setDay(d) }
  const canForward = (() => { const d = new Date(day); d.setDate(d.getDate() + 1); return d <= maxDay() })()

  const totals = sumMacros(logs || [])
  const grouped = MEALS.map((m) => ({ meal: m, items: (logs || []).filter((l) => (l.meal_type || mealOf(l.logged_at)) === m) })).filter((g) => g.items.length)
  const isFuture = day > new Date() && !isToday(day)
  const loggedDays = (week || []).filter((d) => d.logged)
  const avg = loggedDays.length ? {
    calories: Math.round(loggedDays.reduce((a, d) => a + d.calories, 0) / loggedDays.length),
    protein_g: Math.round(loggedDays.reduce((a, d) => a + d.protein_g, 0) / loggedDays.length),
    carbs_g: Math.round(loggedDays.reduce((a, d) => a + d.carbs_g, 0) / loggedDays.length),
    fat_g: Math.round(loggedDays.reduce((a, d) => a + d.fat_g, 0) / loggedDays.length),
    fibre_g: Math.round(loggedDays.reduce((a, d) => a + d.fibre_g, 0) / loggedDays.length),
  } : null
  const maxCal = Math.max((targets?.calories || 0), ...(week || []).map((d) => d.calories), 1)

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
          <span><b>{totals.calories}</b>{targets?.calories ? ` / ${targets.calories}` : ''} kcal</span>
          <span><b>{totals.protein_g}</b>g P</span>
          <span><b>{totals.carbs_g}</b>g C</span>
          <span><b>{totals.fat_g}</b>g F</span>
          <span><b>{totals.fibre_g}</b>g fibre</span>
        </div>
      </div>

      <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
        + Add food{isFuture ? ' (plan ahead)' : ''}
      </button>

      {logs === null && <p className="muted-note" style={{ marginTop: 12 }}>Loading…</p>}
      {logs !== null && logs.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>{isFuture || !isToday(day) ? 'Nothing here — plan the day by adding food above.' : 'Nothing logged yet — add food above.'}</p>}
      {grouped.map((g) => (
        <div className="card" key={g.meal}>
          <p className="eyebrow">{g.meal}</p>
          {g.items.map((l) => (
            <div className="diary-item" key={l.id}>
              <div className="diary-name">{l.name || 'Food'}<span className="diary-macros">{l.calories} kcal · {l.protein_g}P {l.carbs_g}C {l.fat_g}F</span></div>
              <button type="button" className="thumb-del" onClick={() => del(l.id)} aria-label="Delete">×</button>
            </div>
          ))}
        </div>
      ))}

      <div className="card">
        <p className="eyebrow">This week</p>
        <div className="diary-week">
          {(week || []).map((d, i) => (
            <div className="dw-col" key={i}>
              <div className="dw-bar-wrap"><div className="dw-bar" style={{ height: `${Math.round((d.calories / maxCal) * 100)}%`, background: targets?.calories && d.calories > targets.calories * 1.05 ? '#e5533c' : 'var(--accent)' }} /></div>
              <span className="dw-day">{d.date.toLocaleDateString('en-GB', { weekday: 'narrow' })}</span>
            </div>
          ))}
        </div>
        {avg ? (
          <p className="muted-note" style={{ marginTop: 8 }}>Average over {loggedDays.length} logged day{loggedDays.length === 1 ? '' : 's'}: <b>{avg.calories} kcal</b>{targets?.calories ? ` (target ${targets.calories})` : ''} · {avg.protein_g}g P · {avg.carbs_g}g C · {avg.fat_g}g F · {avg.fibre_g}g fibre</p>
        ) : <p className="muted-note" style={{ marginTop: 8 }}>No food logged this week yet.</p>}
      </div>

      {adding && (
        <div className="sheet-overlay" onClick={() => setAdding(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><b>Add food{isToday(day) ? '' : ' · ' + day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</b><button className="link-btn" onClick={() => setAdding(false)}>Done</button></div>
            <FoodSearch onLog={addFood} defaultMeal={mealByHour(day)} />
          </div>
        </div>
      )}
    </div>
  )
}
