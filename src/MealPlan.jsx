import React, { useState, useEffect } from 'react'
import { getRecovery, getHealthContext } from './lib.js'
import { THEME } from './themes.js'

// Client meal-plan builder. Uses their saved macro targets as the budget, asks a
// few qualifying questions, then the AI returns either:
//   - a DAY, where picking one option per meal lands on target, or
//   - a WEEK, one meal per slot, with the shopping list to go with it.
//
// A week is deliberately one meal per slot rather than a menu: a shopping list
// only means anything if it matches exactly what the plan says to eat.
//
// Two things fix "boring and repetitive". A week can't repeat a meal within
// itself, and every regenerate — whole plan or single meal — sends back what it
// has just offered as an `avoid` list, so "build another" is genuinely another.
const DIETARY = ['Vegetarian', 'Vegan', 'Pescatarian', 'Dairy-free', 'Gluten-free', 'Halal']

// The week is planned from today forward, so a day card can say what it actually
// is and "Log this" can put the meal on the right date.
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function dayDate(i) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); return d }
function dayLabel(i) { return i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WD[dayDate(i).getDay()] }

// Week plans are Rick.Fit only. Paul has `mealPlans` too, and the week path has
// never run on his clients' eating — it went live on Ricky's own site first,
// deliberately. Gating it on a flag rather than on remembering not to deploy is
// what actually keeps that true: the code is shared, so any Paul deploy would
// otherwise ship it.
//
// Gated in three places, because the toggle alone is not enough: a week saved in
// localStorage would put a brand without the flag straight back into week mode
// on mount, and the submit handler would still take the week branch.
const WEEK_ON = THEME.features?.weekMealPlans === true

const WEEK_KEY = 'mp_week_v1'
const loadWeek = () => { try { return JSON.parse(localStorage.getItem(WEEK_KEY) || 'null') } catch { return null } }
const saveWeek = (v) => { try { v ? localStorage.setItem(WEEK_KEY, JSON.stringify(v)) : localStorage.removeItem(WEEK_KEY) } catch { /* private mode */ } }

const macroLine = (o) => [o.calories ? o.calories + ' kcal' : null, o.protein_g ? o.protein_g + 'g P' : null, o.carbs_g ? o.carbs_g + 'g C' : null, o.fat_g ? o.fat_g + 'g F' : null].filter(Boolean).join(' · ')

export function MealPlanBuilder({ targets, onLog, coachName, onBack }) {
  const [mode, setMode] = useState('day')
  const [days, setDays] = useState(7)
  const [meals, setMeals] = useState(3)
  const [options, setOptions] = useState(2)
  const [snacks, setSnacks] = useState(false)
  const [diet, setDiet] = useState([])
  const [allergies, setAllergies] = useState('')
  const [prefs, setPrefs] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0) // n = building day n, -1 = shopping
  const [stalled, setStalled] = useState(0)   // days completed when it gave up
  const [swapping, setSwapping] = useState('')
  const [plan, setPlan] = useState(null)
  const [week, setWeek] = useState(null)
  const [ticked, setTicked] = useState([])
  const [err, setErr] = useState('')
  const [logged, setLogged] = useState('')

  // A shopping list is no use if it dies the moment they leave the screen — the
  // whole point is to have it in the shop. Restore the last week they built.
  useEffect(() => {
    const saved = loadWeek()
    if (WEEK_ON && saved?.plan?.days?.length) { setWeek(saved.plan); setTicked(saved.ticked || []); setMode('week') }
  }, [])

  const toggleDiet = (d) => setDiet((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))
  const hasTargets = !!targets?.calories
  const recovery = getRecovery()

  // Everything currently on offer. Sent back on a regenerate so the next one
  // isn't the same four dinners again. Takes the accumulator explicitly while a
  // week is mid-build, because `week` state hasn't caught up between days.
  const titlesOf = (w, p) => {
    const out = []
    if (p?.meals) p.meals.forEach((ml) => ml.options.forEach((o) => out.push(o.title)))
    if (w?.days) w.days.forEach((d) => d.meals.forEach((m) => out.push(m.title)))
    return out
  }
  const currentTitles = () => titlesOf(week, plan)

  const baseBody = () => ({
    calories: targets.calories, protein_g: targets.protein_g, carbs_g: targets.carbs_g, fat_g: targets.fat_g,
    meals, options, snacks, dietary: diet.join(', '), allergies, preferences: prefs,
    recovery: getRecovery(), healthContext: getHealthContext(),
  })

  async function post(body) {
    const res = await fetch('/.netlify/functions/meal-plan', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    return res.json()
  }

  async function generate() {
    if (!hasTargets) { setErr('Your calorie targets aren’t set yet — do the quick setup first.'); return }
    if (WEEK_ON && mode === 'week') { buildWeek(0, { days: [], shopping: [] }); return }
    setBusy(true); setErr('')
    try {
      setPlan(null)
      const j = await post({ ...baseBody(), avoid: currentTitles() })
      if (j.meals) setPlan(j); else setErr(j.error || 'Nothing came back — try again.')
    } catch {
      setErr('Something went wrong — try again.')
    } finally {
      setBusy(false)
    }
  }

  // The week is built a day at a time — a whole week in one request times out at
  // the edge and you get nothing back. So each day lands on screen as it
  // arrives, and each one is saved as it lands: if day 5 of 7 fails, days 1-4
  // are still there and still his, and "carry on" picks up where it stopped
  // rather than starting the week again.
  async function buildWeek(from, seed) {
    setBusy(true); setErr(''); setStalled(0)
    let acc = from === 0 ? { days: [], shopping: [], note: '' } : seed
    if (from === 0) { setTicked([]); setWeek(acc); saveWeek(null) }
    try {
      // Decide the shape of the week before cooking any of it — which proteins
      // get bought, and which day is cooked which way. Carried on the plan so
      // "carry on from Thursday" resumes into the same week rather than a new
      // one. Cheap enough that a resume can just redo it if it's missing.
      let themes = acc.themes
      let proteins = acc.proteins
      if (!themes?.length) {
        setProgress(0)
        const k = await post({ ...baseBody(), skeleton: true, days })
        themes = k.themes || []
        proteins = k.proteins || []
        acc = { ...acc, themes, proteins }
      }

      for (let i = from; i < days; i++) {
        setProgress(i + 1)
        const j = await post({
          ...baseBody(), weekDay: true, dayLabel: dayLabel(i),
          theme: themes[i] || null, proteins,
          avoid: titlesOf(acc, null),
        })
        if (!j.day?.meals?.length) {
          setErr(j.error || `Day ${i + 1} didn’t come back.`)
          setStalled(i)
          return
        }
        acc = { ...acc, days: [...acc.days, j.day] }
        setWeek(acc); saveWeek({ plan: acc, ticked: [] })
      }
      // Shopping last, from the days that actually exist. Absent beats wrong.
      setProgress(-1)
      const meals = acc.days.flatMap((d) => d.meals)
      const s = await post({ ...baseBody(), shoppingFor: meals })
      acc = { ...acc, shopping: s.shopping || [], stale: false }
      setWeek(acc); saveWeek({ plan: acc, ticked: [] })
      if (!s.shopping?.length) setErr('The plan is done, but the shopping list didn’t come back — tap “Shopping list” to try that bit again.')
    } catch {
      setErr('Something went wrong — your days so far are saved.')
      setStalled(acc.days.length)
    } finally {
      setBusy(false); setProgress(0)
    }
  }

  // Just the shopping, for whatever days are on screen. Also the retry when the
  // list is the only thing that failed, or has gone stale after a swap.
  async function buildShopping() {
    if (!week?.days?.length) return
    setBusy(true); setErr(''); setProgress(-1)
    try {
      const s = await post({ ...baseBody(), shoppingFor: week.days.flatMap((d) => d.meals) })
      if (s.shopping?.length) {
        const next = { ...week, shopping: s.shopping, stale: false }
        setWeek(next); saveWeek({ plan: next, ticked })
      } else setErr(s.error || 'The shopping list didn’t come back — try again.')
    } catch {
      setErr('Something went wrong — try again.')
    } finally {
      setBusy(false); setProgress(0)
    }
  }

  // "I don't fancy that" — replace ONE meal and keep everything else. The meal
  // being replaced goes into `avoid` alongside the rest of the plan, so it can't
  // come back as its own replacement.
  async function swap(key, mealName, current, onResult) {
    if (busy || swapping) return
    setSwapping(key); setErr('')
    try {
      const per = Math.max(1, meals + (snacks ? 1 : 0))
      const j = await post({
        ...baseBody(),
        options: 1, // one replacement, straight in — not another menu to read
        swapMeal: mealName,
        mealCalories: current.calories || Math.round(targets.calories / per),
        mealProtein: current.protein_g || Math.round(targets.protein_g / per),
        avoid: [...new Set([...currentTitles(), current.title])],
      })
      if (j.options?.length) onResult(j.options)
      else setErr(j.error || 'Couldn’t find another one — try again.')
    } catch {
      setErr('Something went wrong — try again.')
    } finally {
      setSwapping('')
    }
  }

  function swapDayMeal(mi, oi) {
    const ml = plan.meals[mi]
    swap(`d${mi}-${oi}`, ml.name, ml.options[oi], (opts) => {
      setPlan((p) => {
        const next = { ...p, meals: p.meals.map((m, i) => (i === mi ? { ...m, options: m.options.map((o, k) => (k === oi ? opts[0] : o)) } : m)) }
        return next
      })
    })
  }

  function swapWeekMeal(di, mi) {
    const m = week.days[di].meals[mi]
    swap(`w${di}-${mi}`, m.name, m, (opts) => {
      setWeek((w) => {
        const next = {
          ...w,
          days: w.days.map((d, i) => (i === di ? { ...d, meals: d.meals.map((x, k) => (k === mi ? { ...opts[0], name: x.name } : x)) } : d)),
          // The shopping list was aggregated from the old meal, so it is now
          // one meal out of date. Say so rather than quietly lying about it.
          stale: true,
        }
        saveWeek({ plan: next, ticked })
        return next
      })
    })
  }

  function logOption(mealName, o, when) {
    onLog({
      name: o.title, calories: o.calories, protein_g: o.protein_g, carbs_g: o.carbs_g, fat_g: o.fat_g,
      meal_type: mealName, ...(when ? { logged_at: when.toISOString() } : {}),
    })
    setLogged(o.title); setTimeout(() => setLogged(''), 2200)
  }

  function tick(item) {
    setTicked((t) => {
      const next = t.includes(item) ? t.filter((x) => x !== item) : [...t, item]
      if (week) saveWeek({ plan: week, ticked: next })
      return next
    })
  }

  function clearWeek() { setWeek(null); setTicked([]); saveWeek(null) }

  const swapBtn = (key, run) => (
    <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} disabled={!!swapping || busy} onClick={run}>
      {swapping === key ? 'Finding another…' : 'Swap this'}
    </button>
  )

  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Meal plan</p>
      <h1 className="h1">Build your meal plan.</h1>
      <p className="muted-note">Tell us how you like to eat and we’ll build it around your targets{hasTargets ? ` — ${targets.calories} kcal, ${targets.protein_g}g protein` : ''}. A day gives you options to pick from; a week gives you the plan and the shopping list.</p>
      {recovery && (
        <div className="card" style={{ marginTop: 10, borderColor: 'var(--accent)' }}>
          <p className="muted-note">This is about nourishing yourself, not restriction — real, satisfying meals, at your own pace. There’s no such thing as a “bad” choice here. If food feels hard right now, please lean on {coachName?.split(' ')[0] || 'your coach'}, and support is always there: the Beat helpline (0808 801 0677) and your GP.</p>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        {WEEK_ON && (
          <div className="seg" style={{ marginBottom: 4 }}>
            <button type="button" className={mode === 'day' ? 'on' : ''} onClick={() => setMode('day')}>Just a day</button>
            <button type="button" className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>A whole week</button>
          </div>
        )}

        {mode === 'week' && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>How many days</p>
            <div className="seg small" style={{ marginTop: 6 }}>
              {[3, 5, 7].map((n) => <button key={n} type="button" className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{n}</button>)}
            </div>
          </>
        )}

        <p className="eyebrow" style={{ marginTop: 12 }}>Meals a day</p>
        <div className="seg small" style={{ marginTop: 6 }}>
          {[2, 3, 4].map((n) => <button key={n} type="button" className={meals === n ? 'on' : ''} onClick={() => setMeals(n)}>{n}</button>)}
        </div>
        {mode === 'day' && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>Options per meal</p>
            <div className="seg small" style={{ marginTop: 6 }}>
              {[1, 2, 3].map((n) => <button key={n} type="button" className={options === n ? 'on' : ''} onClick={() => setOptions(n)}>{n}</button>)}
            </div>
          </>
        )}
        <label className="field" style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={snacks} onChange={(e) => setSnacks(e.target.checked)} style={{ width: 'auto' }} />
          Include snacks
        </label>
        <p className="eyebrow" style={{ marginTop: 12 }}>Dietary</p>
        <div className="serving-chips" style={{ flexWrap: 'wrap', marginTop: 6 }}>
          {DIETARY.map((d) => <button key={d} type="button" className={diet.includes(d) ? 'on' : ''} onClick={() => toggleDiet(d)}>{d}</button>)}
        </div>
        <label className="field" style={{ marginTop: 12 }}>Allergies / intolerances<input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. nuts, shellfish — we’ll avoid these" /></label>
        <label className="field" style={{ marginTop: 10 }}>Preferences<input value={prefs} onChange={(e) => setPrefs(e.target.value)} placeholder="e.g. high protein, loves chicken, no spicy food" /></label>
        <button className="btn primary big" style={{ marginTop: 14 }} disabled={busy} onClick={generate}>
          {busy
            ? (progress === -1 ? 'Working out the shopping…' : progress ? `Building ${dayLabel(progress - 1).toLowerCase()}… (${progress} of ${days})` : 'Building your plan…')
            : (mode === 'week' ? `Plan my ${days} days` : 'Build my plan')}
        </button>
        {mode === 'week' && busy && <p className="muted-note" style={{ marginTop: 8 }}>Each day is built on its own so none of them repeat — they’ll appear below as they land.</p>}
        {err && <p className="error" style={{ marginTop: 8 }}>{err}</p>}
        {!busy && stalled > 0 && stalled < days && (
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => buildWeek(stalled, week)}>
            Carry on from {dayLabel(stalled).toLowerCase()}
          </button>
        )}
      </div>

      {logged && <p className="logged-ok">Logged {logged} ✓</p>}

      {mode === 'week' && week && (
        <div className="stack" style={{ marginTop: 14 }}>
          {week.note && <p className="muted-note">{week.note}</p>}

          {!week.shopping?.length && week.days.length > 0 && !busy && (
            <div className="card">
              <p className="eyebrow accent">Shopping list</p>
              <p className="muted-note" style={{ marginTop: 4 }}>Not worked out yet — it needs the days above first.</p>
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={buildShopping}>Work out my shopping</button>
            </div>
          )}

          {week.shopping?.length > 0 && (
            <div className="card">
              <p className="eyebrow accent">Shopping list</p>
              <p className="muted-note" style={{ marginTop: 4 }}>Everything the {week.days.length} days need, added up. Tick as you go — it’ll still be here next time you open it.</p>
              {week.stale && (
                <div style={{ marginTop: 6 }}>
                  <p className="muted-note" style={{ color: 'var(--accent)' }}>You’ve swapped a meal since this was worked out, so one or two lines will be off.</p>
                  <button className="btn ghost sm" style={{ marginTop: 6 }} disabled={busy} onClick={buildShopping}>Redo the list</button>
                </div>
              )}
              <div className="stack" style={{ marginTop: 10 }}>
                {week.shopping.map((g, gi) => (
                  <div key={gi}>
                    <p className="eyebrow">{g.aisle}</p>
                    <div className="stack" style={{ marginTop: 4, gap: 2 }}>
                      {g.items.map((it, ii) => (
                        <label key={ii} className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, margin: 0 }}>
                          <input type="checkbox" checked={ticked.includes(it)} onChange={() => tick(it)} style={{ width: 'auto' }} />
                          <span style={{ textDecoration: ticked.includes(it) ? 'line-through' : 'none', opacity: ticked.includes(it) ? 0.5 : 1 }}>{it}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {week.days.map((d, di) => (
            <div className="card" key={di}>
              <p className="eyebrow accent">{dayLabel(di)}</p>
              <div className="session-sub">{d.meals.reduce((s, m) => s + (m.calories || 0), 0)} kcal · {d.meals.reduce((s, m) => s + (m.protein_g || 0), 0)}g protein</div>
              <div className="stack" style={{ marginTop: 8 }}>
                {d.meals.map((m, mi) => (
                  <div className="card" key={mi} style={{ background: 'var(--surface-2)' }}>
                    <p className="eyebrow">{m.name}</p>
                    <div className="session-title" style={{ marginTop: 2 }}>{m.title}</div>
                    {m.description && <p className="muted-note" style={{ marginTop: 4 }}>{m.description}</p>}
                    <div className="session-sub">{macroLine(m)}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => logOption(m.name, m, dayDate(di))}>Log this</button>
                      {swapBtn(`w${di}-${mi}`, () => swapWeekMeal(di, mi))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button className="btn ghost" onClick={generate} disabled={busy}>{busy ? '…' : 'Build a different week'}</button>
          <button className="link-btn" onClick={clearWeek}>Clear this week</button>
        </div>
      )}

      {mode === 'day' && plan && (
        <div className="stack" style={{ marginTop: 14 }}>
          {plan.note && <p className="muted-note">{plan.note}</p>}
          {plan.meals.map((ml, mi) => (
            <div className="card" key={mi}>
              <p className="eyebrow accent">{ml.name}</p>
              <div className="stack" style={{ marginTop: 6 }}>
                {ml.options.map((o, oi) => (
                  <div className="card" key={oi} style={{ background: 'var(--surface-2)' }}>
                    <div className="session-title">{o.title}</div>
                    {o.description && <p className="muted-note" style={{ marginTop: 4 }}>{o.description}</p>}
                    <div className="session-sub">{macroLine(o)}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => logOption(ml.name, o)}>Log this</button>
                      {swapBtn(`d${mi}-${oi}`, () => swapDayMeal(mi, oi))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn ghost" onClick={generate} disabled={busy}>{busy ? '…' : 'Build another'}</button>
        </div>
      )}
    </div>
  )
}
