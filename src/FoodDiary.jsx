import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient.js'
import { sumMacros, mealByHour } from './lib.js'
import { FoodSearch } from './FoodSearch.jsx'
import { Metric } from './ui.jsx'
import { THEME } from './themes.js'

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

export function FoodDiary({ clientId, coachId, contributorId, title = 'Food diary', onBack, onChanged }) {
  const [day, setDay] = useState(() => new Date())
  const [logs, setLogs] = useState(null)
  const [editing, setEditing] = useState(null) // nutrition_logs row being corrected
  const [mult, setMult] = useState('1')
  const [eMeal, setEMeal] = useState('')
  const [eDate, setEDate] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editErr, setEditErr] = useState('')
  const [targets, setTargets] = useState(null)
  const [week, setWeek] = useState(null)
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
  async function loadWeek() {
    const from = new Date(); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('nutrition_logs').select('calories, protein_g, carbs_g, fat_g, fibre_g, logged_at')
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

  // Correcting an entry after the fact: the portion it was logged at, which meal
  // it belongs to, and which day. Macros are stored as absolutes, so a portion
  // change is a multiplier applied to what's there now.
  function openEdit(l) {
    setEditing(l)
    setMult('1')
    setEMeal(l.meal_type || mealOf(l.logged_at))
    setEDate(dayKey(new Date(l.logged_at)))
  }
  async function saveEdit() {
    const f = Math.max(0.05, Number(mult) || 1)
    const scale = (n) => Math.round((n || 0) * f)
    const when = new Date(editing.logged_at)
    const [y, m, d] = eDate.split('-').map(Number)
    when.setFullYear(y, m - 1, d) // keep the time of day, move the date
    setSavingEdit(true)
    const { error } = await supabase.from('nutrition_logs').update({
      calories: scale(editing.calories), protein_g: scale(editing.protein_g),
      carbs_g: scale(editing.carbs_g), fat_g: scale(editing.fat_g), fibre_g: scale(editing.fibre_g),
      meal_type: eMeal, logged_at: when.toISOString(),
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
  // Net weekly calories — real total intake (blank days count as zero, same
  // as the bar chart) vs the full weekly target. Paul's check-in question:
  // "are they over or under for the week", not just an average day.
  const weekTotalCal = (week || []).reduce((s, d) => s + d.calories, 0)
  const netCal = targets?.calories ? weekTotalCal - targets.calories * 7 : null

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
          <p className="eyebrow">{g.meal}</p>
          {g.items.map((l) => (
            <div className="diary-item" key={l.id}>
              <button type="button" className="diary-name diary-edit" onClick={() => openEdit(l)} aria-label={`Edit ${l.name || 'entry'}`}>
                {l.name || 'Food'}<span className="diary-macros">{l.calories} kcal · {l.protein_g}P {l.carbs_g}C {l.fat_g}F</span>
              </button>
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

            <label className="field" style={{ marginTop: 10 }}>Portion
              <input type="number" step="0.25" min="0.05" inputMode="decimal" value={mult} onChange={(e) => setMult(e.target.value)} />
            </label>
            <div className="seg" style={{ marginTop: 6, flexWrap: 'wrap' }}>
              {['0.5', '1', '1.5', '2'].map((v) => (
                <button type="button" key={v} className={mult === v ? 'on' : ''} onClick={() => setMult(v)}>{v}×</button>
              ))}
            </div>
            <p className="muted-note" style={{ marginTop: 6 }}>
              {Number(mult) === 1 ? 'Leave at 1× to keep the amounts as they are.' : `Saves as ${Math.round((editing.calories || 0) * (Number(mult) || 1))} kcal.`}
            </p>

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
              <button type="button" className="btn primary sm" disabled={savingEdit || !eDate} onClick={saveEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</button>
              <button type="button" className="btn ghost sm" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card week-snapshot">
        <p className="eyebrow">This week</p>
        <div className="diary-week">
          {(week || []).map((d, i) => (
            <div className="dw-col" key={i}>
              <div className="dw-bar-wrap"><div className="dw-bar" style={{ height: `${Math.round((d.calories / maxCal) * 100)}%`, background: targets?.calories && d.calories > targets.calories * 1.05 ? '#e5533c' : 'var(--accent)' }} /></div>
              <span className="dw-day">{d.date.toLocaleDateString('en-GB', { weekday: 'narrow' })}</span>
            </div>
          ))}
        </div>
        {netCal != null && avg && (
          <p className="muted-note" style={{ marginTop: 8 }}>
            Net <b className={netCal > 0 ? 'over' : 'under'}>{netCal > 0 ? '+' : ''}{netCal} kcal</b> vs weekly target ({targets.calories} × 7)
          </p>
        )}
        {avg ? (
          <>
            <p className="muted-note" style={{ marginTop: netCal != null ? 4 : 8 }}>Average over {loggedDays.length} logged day{loggedDays.length === 1 ? '' : 's'}: <b>{avg.calories} kcal</b>{targets?.calories ? ` (target ${targets.calories})` : ''} · {avg.carbs_g}g C · {avg.fat_g}g F</p>
            <div className="metrics-2" style={{ marginTop: 10 }}>
              <Metric k="Protein / day" v={`${avg.protein_g}g`} d={targets?.protein_g ? `target ${targets.protein_g}g` : ''} emphasize />
              <Metric k="Fibre / day" v={`${avg.fibre_g}g`} d={targets?.fibre_g ? `target ${targets.fibre_g}g` : ''} />
            </div>
          </>
        ) : <p className="muted-note" style={{ marginTop: 8 }}>No food logged this week yet.</p>}
      </div>

      {adding && (
        <div className="sheet-overlay" onClick={() => setAdding(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><b>Add food{isToday(day) ? '' : ' · ' + day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</b><button className="link-btn" onClick={() => setAdding(false)}>Done</button></div>
            <FoodSearch onLog={addFood} defaultMeal={mealByHour(day)} coachId={coachId} contributorId={contributorId} />
          </div>
        </div>
      )}
    </div>
  )
}
