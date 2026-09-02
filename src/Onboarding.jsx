import React, { useState } from 'react'
import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'
import { ParqQuestions, ParqAdvice, ParqDeclaration } from './Parq.jsx'
import { saveParq, parqComplete, anyYes } from './parq.js'

// First-run onboarding for a client: quick stats -> goal -> calorie calculator
// writes their starting nutrition targets, then drops them into the app.
// Shown by App.jsx whenever a client has no onboarded_at.

export const ACTIVITY = [
  { key: 'sedentary', factor: 1.2,   label: 'Mostly sitting', sub: 'Little or no exercise' },
  { key: 'light',     factor: 1.375, label: 'Lightly active', sub: 'Exercise 1–3 days a week' },
  { key: 'moderate',  factor: 1.55,  label: 'Moderately active', sub: 'Exercise 3–5 days a week' },
  { key: 'active',    factor: 1.725, label: 'Very active', sub: 'Hard training 6–7 days a week' },
]

export const GOALS = [
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

// PAR-Q screening is part of the join flow only where the coach has asked for
// it (Paul). Brands without the flag keep the exact original step sequence —
// this must never put a health questionnaire in front of another coach's signups.
const PARQ_ON = !!THEME.features?.parq

export default function Onboarding({ profile, onDone }) {
  const [step, setStep] = useState('stats') // stats | goal | context | [parq] | result
  const [sex, setSex] = useState('male')
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState('moderate')
  const [goal, setGoal] = useState('lose')
  const [nutritionSensitive, setNutritionSensitive] = useState(false)
  const [nutritionSensitiveNote, setNutritionSensitiveNote] = useState('')
  const [healthConditions, setHealthConditions] = useState('')
  const [hasKids, setHasKids] = useState(false)
  const [singleParent, setSingleParent] = useState(false)
  const [shiftWorker, setShiftWorker] = useState(false)
  const [lifeContextNote, setLifeContextNote] = useState('')
  const [parqAnswers, setParqAnswers] = useState({})
  const [parqMeds, setParqMeds] = useState('')
  const [parqInjuries, setParqInjuries] = useState('')
  const [parqName, setParqName] = useState(profile.full_name || '')
  const [parqAgreed, setParqAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parqReady = parqComplete(parqAnswers) && parqAgreed && parqName.trim().length > 1

  const [statsErr, setStatsErr] = useState('')

  const first = (profile.full_name || '').split(' ')[0]
  const statsValid =
    Number(age) >= 13 && Number(age) <= 100 &&
    Number(height) >= 120 && Number(height) <= 230 &&
    Number(weight) >= 30 && Number(weight) <= 300

  // Paul, 2 Sept: "One of my clients is stuck on this page and they can't click
  // continue". She had typed her height in inches (67). Continue was correctly
  // disabled, but a disabled button is only dimmed slightly — on the dark theme
  // it still looks tappable, and nothing said which field was wrong. Two clients
  // had been sitting on this screen, one of them for five days.
  //
  // So the button always works now, and says what is wrong. Imperial input is
  // recognised rather than rejected, because that is what people actually type.
  const CM_PER_IN = 2.54
  const KG_PER_ST = 6.35029
  function statsProblem() {
    const a = Number(age); const h = Number(height); const w = Number(weight)
    if (!age.trim() || !(a >= 13 && a <= 100)) return 'Enter your age in years (13–100).'
    if (!height.trim()) return 'Enter your height in centimetres — for example 170.'
    if (h >= 48 && h <= 96) {
      return `Height is in centimetres, not inches. ${h}in is about ${Math.round(h * CM_PER_IN)}cm — try that.`
    }
    if (h >= 4 && h <= 8) return 'Height is in centimetres — 5ft 7 is about 170cm.'
    if (!(h >= 120 && h <= 230)) return 'That height looks off. Enter it in centimetres, between 120 and 230.'
    if (!weight.trim()) return 'Enter your current weight in kilograms — for example 75.'
    if (w >= 5 && w < 30) return `Weight is in kilograms, not stone. ${w}st is about ${Math.round(w * KG_PER_ST)}kg — try that.`
    if (!(w >= 30 && w <= 300)) return 'That weight looks off. Enter it in kilograms, between 30 and 300.'
    return ''
  }
  const targets = statsValid
    ? computeTargets({ sex, age: Number(age), height_cm: Number(height), weight_kg: Number(weight), activity, goal })
    : null

  async function finish() {
    if (!targets) return
    setSaving(true); setError('')
    try {
      const now = new Date().toISOString()
      // PAR-Q first: if this write fails the client retries with onboarded_at
      // still unset, rather than landing in the app with no screening on record.
      if (PARQ_ON) {
        await saveParq({
          clientId: profile.id, answers: parqAnswers, medications: parqMeds,
          injuries: parqInjuries, declaredName: parqName,
        })
      }
      const upT = await supabase.from('macro_targets').upsert({
        client_id: profile.id, calories: targets.calories, protein_g: targets.protein_g,
        carbs_g: targets.carbs_g, fat_g: targets.fat_g, updated_at: now,
      })
      if (upT.error) throw new Error(upT.error.message)
      const upP = await supabase.from('profiles').update({
        sex, age: Number(age), height_cm: Number(height), activity_level: activity,
        goal, onboarded_at: now,
        nutrition_sensitive: nutritionSensitive, nutrition_sensitive_note: nutritionSensitive ? (nutritionSensitiveNote.trim() || null) : null,
        health_conditions: healthConditions.trim() || null,
        has_kids: hasKids, single_parent: singleParent, shift_worker: shiftWorker,
        life_context_note: lifeContextNote.trim() || null,
      }).eq('id', profile.id)
      if (upP.error) throw new Error(upP.error.message)
      const { data: bm } = await supabase.from('body_measurements').select('id').eq('client_id', profile.id).limit(1)
      if (!bm || bm.length === 0) {
        await supabase.from('body_measurements').insert({
          client_id: profile.id, weight_kg: Number(weight), measured_at: now.slice(0, 10), note: 'Starting weight',
        })
      }
      // Welcome message: onboarding runs exactly once. A client can't write a
      // sender='coach' row (RLS), so a SECURITY DEFINER RPC seeds the coach's
      // welcome into the chat; it's idempotent (no-op if any message exists).
      if (profile.trainer_id) {
        try { await supabase.rpc('seed_welcome_message') } catch { /* welcome is best-effort */ }
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
            {step === 'context' && 'Optional — anything that helps us support you better.'}
            {step === 'parq' && 'A quick health check before you start — please answer every question.'}
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
              <input type="number" inputMode="numeric" value={age} onChange={(e) => { setAge(e.target.value); setStatsErr('') }} placeholder="years" />
            </label>
            <label>Height (cm)
              <input type="number" inputMode="numeric" value={height} onChange={(e) => { setHeight(e.target.value); setStatsErr('') }} placeholder="e.g. 170" />
            </label>
            <label>Current weight (kg)
              <input type="number" inputMode="decimal" value={weight} onChange={(e) => { setWeight(e.target.value); setStatsErr('') }} placeholder="e.g. 75" />
            </label>
            <p className="muted-note" style={{ marginTop: 4 }}>How active are you day to day?</p>
            {ACTIVITY.map((a) => (
              <button key={a.key} type="button" style={optionStyle(activity === a.key)} onClick={() => setActivity(a.key)}>
                <span style={{ fontWeight: 600 }}>{a.label}</span>
                <span className="muted" style={{ display: 'block', fontSize: 13 }}>{a.sub}</span>
              </button>
            ))}
            {statsErr && <p className="error" style={{ marginTop: 12 }}>{statsErr}</p>}
            <button
              className="btn primary big"
              style={{ marginTop: statsErr ? 8 : 16 }}
              onClick={() => {
                const problem = statsProblem()
                if (problem) { setStatsErr(problem); return }
                setStatsErr(''); setStep('goal')
              }}
            >
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
              <button type="button" className="on" onClick={() => setStep('context')}>Continue</button>
            </div>
          </div>
        )}

        {step === 'context' && (
          <div className="auth-form">
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={nutritionSensitive} onChange={(e) => setNutritionSensitive(e.target.checked)} style={{ width: 'auto' }} />
              I’ve struggled with disordered eating
            </label>
            {nutritionSensitive && (
              <label className="field" style={{ marginTop: 4 }}>What do you find hardest? (optional — guides the AI)
                <input value={nutritionSensitiveNote} onChange={(e) => setNutritionSensitiveNote(e.target.value)} placeholder="e.g. increasing calories, fear foods, eating regularly" />
              </label>
            )}
            <label className="field" style={{ marginTop: 12 }}>Any health conditions we should know about? (optional)
              <input value={healthConditions} onChange={(e) => setHealthConditions(e.target.value)} placeholder="e.g. PCOS, menopause, thyroid, PoTS" />
            </label>
            <p className="muted-note" style={{ marginTop: 12 }}>Life circumstances (optional — helps keep suggestions realistic)</p>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input type="checkbox" checked={hasKids} onChange={(e) => setHasKids(e.target.checked)} style={{ width: 'auto' }} />
              I have kids
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input type="checkbox" checked={singleParent} onChange={(e) => setSingleParent(e.target.checked)} style={{ width: 'auto' }} />
              I’m a single parent
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input type="checkbox" checked={shiftWorker} onChange={(e) => setShiftWorker(e.target.checked)} style={{ width: 'auto' }} />
              I work shifts
            </label>
            <label className="field" style={{ marginTop: 8 }}>Anything else? (optional)
              <input value={lifeContextNote} onChange={(e) => setLifeContextNote(e.target.value)} placeholder="e.g. travel a lot for work, caring responsibilities" />
            </label>
            <p className="muted-note" style={{ marginTop: 10 }}>All optional and private to you and your coach — you can change this any time from Home.</p>
            <div className="seg" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => setStep('goal')}>Back</button>
              <button type="button" className="on" onClick={() => setStep(PARQ_ON ? 'parq' : 'result')}>Continue</button>
            </div>
          </div>
        )}

        {step === 'parq' && (
          <div className="auth-form">
            <p className="muted-note" style={{ marginTop: 0 }}>
              This is your PAR-Q — the standard readiness check every coach asks for. It stays private
              between you and your coach.
            </p>
            <ParqQuestions
              answers={parqAnswers} setAnswers={setParqAnswers}
              medications={parqMeds} setMedications={setParqMeds}
              injuries={parqInjuries} setInjuries={setParqInjuries}
            />
            {anyYes(parqAnswers) && <ParqAdvice coachName={null} />}
            <ParqDeclaration value={parqName} onChange={setParqName} agreed={parqAgreed} setAgreed={setParqAgreed} />
            <div className="seg" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => setStep('context')}>Back</button>
              <button type="button" className="on" disabled={!parqReady} onClick={() => setStep('result')}>Continue</button>
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
              <button type="button" onClick={() => setStep(PARQ_ON ? 'parq' : 'context')}>Back</button>
              <button type="button" className="on" onClick={finish} disabled={saving}>{saving ? 'Saving…' : 'Start'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
