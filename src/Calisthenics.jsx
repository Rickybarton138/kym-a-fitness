import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { SKILLS, SESSIONS, stepFor, nextStep, stepIndex, buildSession } from './calisthenics.js'
import { startSessionNow } from './todaySession.js'
import { Loader } from './ui.jsx'

// Callisthenics: where you are on each skill ladder, and sessions built from it.
//
// The tracker is the feature. Bodyweight training goes wrong when it becomes
// "press-ups and pull-ups forever" — the progression IS the programme, so the
// app's job is to say what step you are on, what the next one costs, and then
// hand you a session that uses today's step rather than a fixed prescription
// written months ago.
//
// Ricky, 21 Sept: "can we add calisthenics workouts to my app please."
export function Calisthenics({ clientId, onGo, onBack }) {
  const [progress, setProgress] = useState(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    const { data, error } = await supabase.from('calisthenics_progress')
      .select('skill_key, step_index').eq('client_id', clientId)
    if (error) { setErr('Could not load where you are. Pull down to try again.'); setProgress({}); return }
    setProgress(Object.fromEntries((data || []).map((r) => [r.skill_key, r.step_index])))
  }
  useEffect(() => { load() }, [clientId])

  // Move a ladder. Optimistic, because the whole interaction is one tap and a
  // round trip would make it feel broken — but the write is checked, and a
  // failure puts it back rather than leaving a step you have not earned.
  async function move(skillKey, delta) {
    const from = stepIndex(skillKey, (progress || {})[skillKey] ?? 0)
    const to = stepIndex(skillKey, from + delta)
    if (to === from) return
    setProgress((p) => ({ ...p, [skillKey]: to }))
    setErr('')
    const { error } = await supabase.from('calisthenics_progress')
      .upsert({ client_id: clientId, skill_key: skillKey, step_index: to, updated_at: new Date().toISOString() })
    if (error) {
      setProgress((p) => ({ ...p, [skillKey]: from }))
      setErr('That did not save — check your signal and try again.')
    }
  }

  async function start(sessionKey) {
    setBusy(sessionKey); setErr('')
    const sess = buildSession(sessionKey, progress || {})
    const saved = await startSessionNow(clientId, sess)
    setBusy('')
    if (!saved) { setErr('Could not open that session — try again.'); return }
    onGo('train')
  }

  if (!progress) return <Loader text="Finding your steps…" />

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Calisthenics</p>
      <h1 className="h1">Your own bodyweight.</h1>
      <p className="lead">
        Six skills, each a ladder. Train the step you are on until it is easy, then take the next one.
      </p>

      {err && <p className="muted-note" style={{ color: 'var(--bad, #ff6b6b)' }}>{err}</p>}

      <p className="eyebrow" style={{ marginTop: 6 }}>Sessions</p>
      <div className="tiles">
        {SESSIONS.map((s) => (
          <button key={s.key} className="tile" disabled={busy === s.key} onClick={() => start(s.key)}>
            <div>
              <b>{busy === s.key ? 'Opening…' : s.title}</b>
              <span>{s.blurb}</span>
            </div>
          </button>
        ))}
      </div>
      <p className="muted-note">
        Every session uses the step you are on right now, so it gets harder as you do. Nothing to rewrite.
      </p>

      <p className="eyebrow" style={{ marginTop: 10 }}>Where you are</p>
      {SKILLS.map((skill) => {
        const cur = stepFor(progress, skill.key)
        const next = nextStep(progress, skill.key)
        return (
          <div className="card" key={skill.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <p className="eyebrow accent" style={{ margin: 0 }}>{skill.name} → {skill.goal}</p>
              <span className="muted" style={{ fontSize: 13 }}>Step {cur.index + 1} of {cur.of}</span>
            </div>
            <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{cur.name}</p>
            <p className="muted-note" style={{ marginTop: 2 }}>{cur.sets} × {cur.reps} · {cur.cue}</p>
            {next
              ? <p className="muted-note">Next up is {next.name}, once you can do {cur.unlock}.</p>
              : <p className="muted-note">Top of the ladder. Nothing left to unlock — now just get better at it.</p>}
            <div className="nudge-actions" style={{ marginTop: 10 }}>
              <button className="btn primary sm" disabled={cur.last} onClick={() => move(skill.key, 1)}>
                {cur.last ? 'Ladder complete' : 'I can do this — next step'}
              </button>
              <button type="button" className="link-btn" disabled={cur.index === 0} onClick={() => move(skill.key, -1)}>
                Step back
              </button>
            </div>
          </div>
        )
      })}

      <p className="muted-note">
        Needs: a bar you can hang from, a clear wall, and a step or bench. Rings and parallettes only much later.
      </p>
    </div>
  )
}
