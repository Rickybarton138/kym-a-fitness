import React from 'react'
import { nextAction, feedbackFor, adjustmentFor } from './coachRules.js'
import { buildContext, evidenceLines } from './coachContext.js'

// A development-only harness for looking at the coaching UI at phone width.
//
// It exists because the real screens sit behind authentication, and the brief
// forbids using a production account or writing test activity to production. So
// this renders the same markup from a fixture context with no network, no token
// and no database — which is enough to check the layout, the touch targets and
// the reserved heights honestly at 375px.
//
// Reached at /?coachpreview=1 and ONLY when import.meta.env.DEV is true, so it
// cannot exist in a production build. The App gate checks the same flag.

const TODAY = '2026-10-07'
const NOW = '2026-10-07T11:00:00Z'

const RAW = {
  profile: { full_name: 'Preview', goal: 'lose', step_target: 10000, water_target_ml: 2500, health_conditions: 'allergic to shellfish' },
  targets: { calories: 2100, protein_g: 180, carbs_g: 187, fat_g: 70, fibre_g: 30, updated_at: '2026-09-01T00:00:00Z' },
  targetHistory: [{ effective_from: '2026-10-01', calories: 2100, protein_g: 180, carbs_g: 187, fat_g: 70, fibre_g: 30 }],
  programme: {
    asg: { start_date: '2026-09-28', repeat: true, day_map: [], coach_id: 'c' },
    sessions: [{ id: 's2', week: 1, dow: 3, position: 0, title: 'Lower A — Hinge', focus: 'Hamstrings, glutes', exercises: [] }],
    cycleWeeks: 1, title: 'Lean & Strong', programWeeks: 8, dayMap: [], byCoach: true,
  },
  plans: [{
    id: 'p', title: 'Lower A — Hinge', focus: 'Hamstrings, glutes', scheduled_for: '2026-09-30',
    created_at: '2026-09-30T09:00:00Z', assigned_by: 'c',
    exercises: [{ name: 'Romanian Deadlift', sets: 4, reps: '8-10', weight: 80 }, { name: 'Rower', sets: 1, reps: '10 min' }],
  }],
  completions: [{ completed_on: '2026-09-30', source: 'guided', created_at: '2026-09-30T10:00:00Z' }],
  nutrition: [
    { calories: 500, protein_g: 40, carbs_g: 45, fat_g: 18, fibre_g: 4, logged_at: `${TODAY}T07:30:00Z`, meal_type: 'Breakfast', name: 'Omelette' },
    { calories: 650, protein_g: 45, carbs_g: 70, fat_g: 18, fibre_g: 6, logged_at: `${TODAY}T11:30:00Z`, meal_type: 'Lunch', name: 'Chicken rice' },
  ],
  foodDays: [],
  steps: [{ day: TODAY, steps: 2000, water_ml: 500, updated_at: `${TODAY}T11:00:00Z` }],
  measurements: [{ measured_at: '2026-10-01', weight_kg: 92.4, waist_cm: 102 }, { measured_at: '2026-09-01', weight_kg: 94.1 }],
  readiness: [],
  weekly: [],
  soreness: [],
  recipes: [
    { id: 'r1', title: 'Prawn stir fry', calories: 520, protein_g: 42, tags: ['shellfish'], client_id: 'me' },
    { id: 'r2', title: 'Chicken and rice', calories: 600, protein_g: 48, tags: [], client_id: 'me' },
  ],
  memory: [{ key: 'Allergies', value: 'shellfish and prawns', source: 'user' }],
  chats: [],
  lifts: [],
}

const ctx = buildContext(RAW, { today: TODAY, now: NOW, brand: 'ricky' })
const action = nextAction(ctx, {}, new Date(NOW))
const resumeAction = nextAction(ctx, { resumeSessionId: 'x', resumeTitle: 'Lower A — Hinge' }, new Date(NOW))
const evidence = evidenceLines(ctx)

const session = {
  id: 'now', title: 'Lower A — Hinge', focus: 'Hamstrings, glutes', day: TODAY,
  exercises: RAW.plans[0].exercises,
  volume: { kg: 3200, sets: 5, partial: true },
  split: { lifting: [RAW.plans[0].exercises[0]], cardio: [RAW.plans[0].exercises[1]] },
}
const workoutFb = feedbackFor('workout', ctx, {
  session,
  comparable: { id: 'then', title: 'Lower A — Hinge', day: '2026-09-23', volume: { kg: 2800, sets: 5, partial: false }, matchedOn: 'title' },
})
const mealFb = feedbackFor('meal', ctx)
const adj = adjustmentFor(ctx, { sleep: 2, energy: 2, soreness: 4, minutes: 30 })

function Block({ title, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <p className="eyebrow" style={{ opacity: 0.6 }}>{title}</p>
      {children}
    </section>
  )
}

export default function CoachPreview() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="mark-badge">R</span><span className="brand-name">Coach preview</span></div>
      </header>
      <main className="screen">
        <p className="muted-note">
          Development harness. Fixture data, no network, no account. Everything below is the same
          markup the real screens render.
        </p>

        <Block title="Today card — ready">
          <div className="card coach-card">
            <p className="eyebrow accent">Coach’s next suggestion</p>
            <h2 style={{ margin: '6px 0 0', fontSize: 18, lineHeight: 1.25 }}>{action.title}</h2>
            <p className="muted-note" style={{ marginTop: 4 }}>{action.reason}</p>
            <div className="nudge-actions coach-actions" style={{ marginTop: 10 }}>
              {action.actions.map((b, i) => (
                <button key={i} className={i === 0 ? 'btn primary sm' : 'btn ghost sm'}>{b.label}</button>
              ))}
            </div>
            <div className="nudge-actions coach-actions" style={{ marginTop: 8 }}>
              <button type="button" className="link-btn">What is this based on?</button>
              <button type="button" className="link-btn">Remind me later</button>
              <button type="button" className="link-btn">Not today</button>
            </div>
            <div className="coach-why" style={{ marginTop: 8 }}>
              <ul className="muted-note" style={{ margin: 0, paddingLeft: 18 }}>
                {evidence.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              <p className="muted-note" style={{ marginTop: 6 }}>Not known: {ctx.missing.join(', ')}.</p>
            </div>
          </div>
        </Block>

        <Block title="Today card — loading (reserved height)">
          <div className="card coach-card" aria-busy="true">
            <p className="eyebrow accent">Coach</p>
            <div className="coach-skeleton" aria-hidden="true">
              <span className="sk sk-title" /><span className="sk sk-line" /><span className="sk sk-line short" />
            </div>
            <p className="muted-note">Looking at your week…</p>
          </div>
        </Block>

        <Block title="Today card — error, with retry">
          <div className="card coach-card">
            <p className="eyebrow accent">Coach</p>
            <p style={{ fontWeight: 600, margin: '4px 0 0' }}>Could not reach your coach</p>
            <p className="muted-note">That took too long — try again.</p>
            <div className="nudge-actions coach-actions" style={{ marginTop: 10 }}>
              <button className="btn primary sm">Try again</button>
            </div>
          </div>
        </Block>

        <Block title="Today card — a session open on this device outranks the rest">
          <div className="card coach-card">
            <p className="eyebrow accent">Coach’s next suggestion</p>
            <h2 style={{ margin: '6px 0 0', fontSize: 18 }}>{resumeAction.title}</h2>
            <p className="muted-note" style={{ marginTop: 4 }}>{resumeAction.reason}</p>
          </div>
        </Block>

        <Block title="Workout feedback — lifting and cardio apart, partial volume flagged">
          <div className="card">
            <p className="eyebrow accent">Coach</p>
            <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{workoutFb.title}</p>
            <ul className="muted-note" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {workoutFb.facts.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
            {workoutFb.nextFocus && <p className="muted-note" style={{ marginTop: 6 }}>{workoutFb.nextFocus}</p>}
          </div>
        </Block>

        <Block title="Meal feedback — open day flagged, shellfish kept out">
          <div className="card">
            <p className="eyebrow accent">Coach</p>
            <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{mealFb.title}</p>
            <ul className="muted-note" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {mealFb.facts.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
            <p className="eyebrow" style={{ marginTop: 10 }}>Could fit the rest of today</p>
            {mealFb.suggestions.map((s) => (
              <p className="muted-note" key={s.id} style={{ margin: '4px 0 0' }}>{s.title} — {s.calories} kcal, {s.protein_g}g protein</p>
            ))}
            <p className="muted-note" style={{ marginTop: 4 }}>Kept clear of: {mealFb.avoided.join(', ')}.</p>
          </div>
        </Block>

        <Block title="Readiness scales — 44px targets, five across at phone width">
          <div className="card">
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, fontSize: 14, padding: 0 }}>Sleep</legend>
              <div className="seg seg-five" role="radiogroup" aria-label="Sleep">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} role="radio" aria-checked={n === 2} className={n === 2 ? 'on' : ''}>{n}</button>
                ))}
              </div>
              <p className="muted-note" style={{ margin: '4px 0 0' }}>Poor</p>
            </fieldset>
          </div>
        </Block>

        <Block title="Readiness result — a proposal, not a rewrite">
          <div className="card">
            <p className="eyebrow accent">Suggested change</p>
            <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{adj.headline}</p>
            <p className="muted-note" style={{ marginTop: 4 }}>{adj.detail}</p>
            {adj.changes.map((c, i) => <p key={i} style={{ margin: '6px 0 0', fontWeight: 600 }}>{c.what}</p>)}
            <p className="muted-note" style={{ marginTop: 6 }}>
              Your plan is not changed unless you say so.
            </p>
            <div className="nudge-actions coach-actions" style={{ marginTop: 10 }}>
              <button className="btn primary sm">Accept for today</button>
              <button type="button" className="link-btn">No thanks</button>
            </div>
          </div>
        </Block>
      </main>
    </div>
  )
}
