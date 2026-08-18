import React, { useState } from 'react'
import { getRecovery } from './lib.js'

// Client meal-plan builder. Uses their saved macro targets as the budget, asks a
// few qualifying questions, then the AI returns a day where picking one option
// per meal lands on target. Optional — a self-serve tool, especially for standard
// members. Each option can be logged straight to the diary.
const DIETARY = ['Vegetarian', 'Vegan', 'Pescatarian', 'Dairy-free', 'Gluten-free', 'Halal']

export function MealPlanBuilder({ targets, onLog, coachName, onBack }) {
  const [meals, setMeals] = useState(3)
  const [options, setOptions] = useState(2)
  const [snacks, setSnacks] = useState(false)
  const [diet, setDiet] = useState([])
  const [allergies, setAllergies] = useState('')
  const [prefs, setPrefs] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState(null)
  const [err, setErr] = useState('')
  const [logged, setLogged] = useState('')

  const toggleDiet = (d) => setDiet((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))
  const hasTargets = !!targets?.calories
  const recovery = getRecovery()

  async function generate() {
    if (!hasTargets) { setErr('Your calorie targets aren’t set yet — do the quick setup first.'); return }
    setBusy(true); setErr(''); setPlan(null)
    try {
      const res = await fetch('/.netlify/functions/meal-plan', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          calories: targets.calories, protein_g: targets.protein_g, carbs_g: targets.carbs_g, fat_g: targets.fat_g,
          meals, options, snacks, dietary: diet.join(', '), allergies, preferences: prefs,
          recovery: getRecovery(),
        }),
      })
      const j = await res.json()
      if (j.meals) setPlan(j); else setErr(j.error || 'Nothing came back — try again.')
    } catch { setErr('Something went wrong — try again.') }
    setBusy(false)
  }

  function logOption(mealName, o) {
    onLog({ name: o.title, calories: o.calories, protein_g: o.protein_g, carbs_g: o.carbs_g, fat_g: o.fat_g, meal_type: mealName })
    setLogged(o.title); setTimeout(() => setLogged(''), 2200)
  }

  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Meal plan</p>
      <h1 className="h1">Build your meal plan.</h1>
      <p className="muted-note">Tell us how you like to eat and we’ll build a day around your targets{hasTargets ? ` — ${targets.calories} kcal, ${targets.protein_g}g protein` : ''}. Pick one option per meal.</p>
      {recovery && (
        <div className="card" style={{ marginTop: 10, borderColor: 'var(--accent)' }}>
          <p className="muted-note">This is about nourishing yourself, not restriction — real, satisfying meals, at your own pace. There’s no such thing as a “bad” choice here. If food feels hard right now, please lean on {coachName?.split(' ')[0] || 'your coach'}, and support is always there: the Beat helpline (0808 801 0677) and your GP.</p>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <p className="eyebrow">Meals a day</p>
        <div className="seg small" style={{ marginTop: 6 }}>
          {[2, 3, 4].map((n) => <button key={n} type="button" className={meals === n ? 'on' : ''} onClick={() => setMeals(n)}>{n}</button>)}
        </div>
        <p className="eyebrow" style={{ marginTop: 12 }}>Options per meal</p>
        <div className="seg small" style={{ marginTop: 6 }}>
          {[1, 2, 3].map((n) => <button key={n} type="button" className={options === n ? 'on' : ''} onClick={() => setOptions(n)}>{n}</button>)}
        </div>
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
        <button className="btn primary big" style={{ marginTop: 14 }} disabled={busy} onClick={generate}>{busy ? 'Building your plan…' : 'Build my plan'}</button>
        {err && <p className="error" style={{ marginTop: 8 }}>{err}</p>}
      </div>

      {logged && <p className="logged-ok">Logged {logged} ✓</p>}

      {plan && (
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
                    <div className="session-sub">{[o.calories ? o.calories + ' kcal' : null, o.protein_g ? o.protein_g + 'g P' : null, o.carbs_g ? o.carbs_g + 'g C' : null, o.fat_g ? o.fat_g + 'g F' : null].filter(Boolean).join(' · ')}</div>
                    <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => logOption(ml.name, o)}>Log this</button>
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
