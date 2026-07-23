import React, { useState } from 'react'
import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'

// First-run onboarding for a client: quick stats -> goal -> calorie calculator
// writes their starting nutrition targets, then drops them into the app.
// Shown by App.jsx whenever a client has no onboarded_at.

const ACTIVITY = [
  { key: 'sedentary', factor: 1.2,   label: 'Mostly sitting', sub: 'Little or no exercise' },
  { key: 'light',     factor: 1.375, label: 'Lightly active', sub: 'Exercise 1–3 days a week' },
  { key: 'moderate',  factor: 1.55,  label: 'Moderately active', sub: 'Exercise 3–5 days a week' },
  { key: 'active',    factor: 1.725, label: 'Very active', sub: 'Hard training 6–7 days a week' },
]

const GOALS = [
  { key: 'lose',     label: 'Lose fat',      sub: 'Lean down, hold onto muscle', adj: -0.20, protein: 2.2 },
  { key: 'maintain', label: 'Maintain',      sub: 'Hold steady, get stronger',   adj: 0.0,   protein: 2.0 },
  { key: 'gain',     label: 'Build muscle',  sub: 'Lean, controlled gaining',     adj: 0.10,  protein: 2.0 },
]

const round = (n, to) => Math.round(n / to) * to

// Mifflin-St Jeor BMR -> activity TDEE -> goal-adjusted calories + macros.
export function computeTargets({ sex, age, height_cm, weight_kg, activity, goal }) {
  const a = ACTIVITY.find((x) => x.key === activity) || ACTIVITY[2]
  const g = GOALS.find((x) => x.key === goal) || GOALS[1]
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (sex === 'male' ? 5 : -161)
  const tdee = bmr * a.factor
  const calories = Math.max(1200, round(tdee * (1 + g.adj), 10))
  const protein_g = round(g.protein * weight_kg, 5)
  const fat_g = round((calories * 0.25) / 9, 5)
  const carbs_g = Math.max(0, round((calories - protein_g * 4 - fat_g * 9) / 4, 5))
  return { calories, protein_g, carbs_g, fat_g, tdee: Math.round(tdee) }
}

const optionStyle = (on) => ({
  display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px',
  borderRadius: 'var(--radius)', border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
  background: on ? 'var(--surface-2)' : 'var(--surface)', color: 'var(--text)',
  cursor: 'pointer', marginTop: 8, transition: 'border-color .15s, background .15s',
})

export default function Onboarding({ profile, onDone }) {
  const [step, setStep] = useState('stats') // stats | goal | result
  const [sex, setSex] = useState('male')
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState('moderate')
  const [goal, setGoal] = useState('lose')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const first = (profile.full_name || '').split(' ')[0]
  const statsValid =
    Number(age) >= 13 && Number(age) <= 100 &&
    Number(height) >= 120 && Number(height) <= 230 &&
    Number(weight) >= 30 && Number(weight) <= 300
  const targets = statsValid
    ? computeTargets({ sex, age: Number(age), height_cm: Number(height), weight_kg: Number(weight), activity, goal })
    : null

  async function finish() {
    if (!targets) return
    setSaving(true); setError('')
    try {
      const now = new Date().toISOString()
      const upT = await supabase.from('macro_targets').upsert({
        client_id: profile.id, calories: targets.calories, protein_g: targets.protein_g,
        carbs_g: targets.carbs_g, fat_g: targets.fat_g, updated_at: now,
      })
      if (upT.error) throw new Error(upT.error.message)
      const upP = await supabase.from('profiles').update({
        sex, age: Number(age), height_cm: Number(height), activity_level: activity,
        goal, onboarded_at: now,
      }).eq('id', profile.id)
      if (upP.error) throw new Error(upP.error.message)
      const { data: bm } = await supabase.from('body_measurements').select('id').eq('client_id', profile.id).limit(1)
      if (!bm || bm.length === 0) {
        await supabase.from('body_measurements').insert({
          client_id: profile.id, weight_kg: Number(weight), measured_at: now.slice(0, 10), note: 'Starting weight',
        })
      }
      onDone()
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          {THEME.logo ? <img className="brand-logo" src={THEME.logo} alt={THEME.name} /> : <span className="brand-logo-badge">{THEME.mark}</span>}
          <h1>{step === 'result' ? 'Your starting plan' : `Welcome, ${first}`}</h1>
          <p className="muted">
            {step === 'stats' && 'A few quick numbers so we can set your targets.'}
            {step === 'goal' && 'What are you working towards right now?'}
            {step === 'result' && 'Built from your numbers — you can fine-tune any time.'}
          </p>
        </div>

        {step === 'stats' && (
          <div className="auth-form">
            <div className="seg small">
              <button type="button" className={sex === 'male' ? 'on' : ''} onClick={() => setSex('male')}>Male</button>
              <button type="button" className={sex === 'female' ? 'on' : ''} onClick={() => setSex('female')}>Female</button>
            </div>
            <label>Age
              <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="years" />
            </label>
            <label>Height
              <input type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="cm" />
            </label>
            <label>Current weight
              <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg" />
            </label>
            <p className="muted-note" style={{ marginTop: 4 }}>How active are you day to day?</p>
            {ACTIVITY.map((a) => (
              <button key={a.key} type="button" style={optionStyle(activity === a.key)} onClick={() => setActivity(a.key)}>
                <span style={{ fontWeight: 600 }}>{a.label}</span>
                <span className="muted" style={{ display: 'block', fontSize: 13 }}>{a.sub}</span>
              </button>
            ))}
            <button className="btn primary big" style={{ marginTop: 16 }} disabled={!statsValid} onClick={() => setStep('goal')}>
              Continue
            </button>
          </div>
        )}

        {step === 'goal' && (
          <div className="auth-form">
            {GOALS.map((g) => (
              <button key={g.key} type="button" style={optionStyle(goal === g.key)} onClick={() => setGoal(g.key)}>
                <span style={{ fontWeight: 600 }}>{g.label}</span>
                <span className="muted" style={{ display: 'block', fontSize: 13 }}>{g.sub}</span>
              </button>
            ))}
            <div className="seg" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => setStep('stats')}>Back</button>
              <button type="button" className="on" onClick={() => setStep('result')}>See my targets</button>
            </div>
          </div>
        )}

        {step === 'result' && targets && (
          <div className="auth-form">
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="eyebrow">Daily target</p>
              <p style={{ fontSize: 34, fontWeight: 700, margin: '4px 0' }}>{targets.calories} <span className="muted" style={{ fontSize: 16 }}>kcal</span></p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 8 }}>
                <span><b>{targets.protein_g}g</b><span className="muted" style={{ display: 'block', fontSize: 12 }}>Protein</span></span>
                <span><b>{targets.carbs_g}g</b><span className="muted" style={{ display: 'block', fontSize: 12 }}>Carbs</span></span>
                <span><b>{targets.fat_g}g</b><span className="muted" style={{ display: 'block', fontSize: 12 }}>Fat</span></span>
              </div>
              <p className="muted-note" style={{ marginTop: 12 }}>
                Maintenance is around {targets.tdee} kcal. This target is set for {GOALS.find((g) => g.key === goal)?.label.toLowerCase()}.
              </p>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="seg" style={{ marginTop: 8 }}>
              <button type="button" onClick={() => setStep('goal')}>Back</button>
              <button type="button" className="on" onClick={finish} disabled={saving}>{saving ? 'Saving…' : 'Start'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
