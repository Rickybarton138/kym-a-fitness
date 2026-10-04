import React, { useCallback, useEffect, useRef, useState } from 'react'
import { coachCall, createGuard } from './coachClient.js'
import { prettyDay } from './coachTime.js'

// The weekly review: planned against done, food adherence with its coverage,
// trends, and one thing to change.
//
// Two things it refuses to do. It will not draw a conclusion from one data
// point — a single logged session is not a trend and saying otherwise teaches
// people to distrust the whole thing. And it will not generate twice for the
// same week: the endpoint looks for a saved review first and hands that back, so
// reopening the screen is free and the wording does not change under them.

export function WeeklyReview({ onBack, onGo }) {
  const [state, setState] = useState({ status: 'loading' })
  const guard = useRef(createGuard())
  const alive = useRef(true)

  const load = useCallback(async (regenerate = false) => {
    const ticket = guard.current.begin()
    setState((s) => (s.status === 'ready' ? { ...s, refreshing: true } : { status: 'loading' }))
    try {
      const res = await coachCall('review', regenerate ? { regenerate: true } : {})
      if (!alive.current || !guard.current.isCurrent(ticket)) return
      setState({ status: 'ready', ...res })
    } catch (e) {
      if (!alive.current || !guard.current.isCurrent(ticket)) return
      setState((s) => (s.status === 'ready' ? { ...s, refreshing: false, warning: e.message } : { status: 'error', error: e.message }))
    }
  }, [])

  useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, [load])

  if (state.status === 'loading') {
    return (
      <div className="stack">
        <button className="link-btn" onClick={onBack}>‹ Back</button>
        <p className="eyebrow accent">Weekly review</p>
        <div className="card" style={{ minHeight: 220 }} aria-busy="true">
          <div className="coach-skeleton" aria-hidden="true">
            <span className="sk sk-title" /><span className="sk sk-line" /><span className="sk sk-line" /><span className="sk sk-line short" />
          </div>
          <p className="muted-note" role="status">Going through your week…</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="stack">
        <button className="link-btn" onClick={onBack}>‹ Back</button>
        <p className="eyebrow accent">Weekly review</p>
        <div className="card">
          <p style={{ fontWeight: 600, margin: 0 }}>Could not build your review</p>
          <p className="muted-note">{state.error}</p>
          <button className="btn primary sm" style={{ marginTop: 10 }} onClick={() => load()}>Try again</button>
        </div>
      </div>
    )
  }

  const r = state.review || {}
  const n = r.nutrition || {}
  const planned = r.planned
  const done = (r.completed || []).length

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Weekly review</p>
      <h1 className="h1">{r.label || `${prettyDay(r.period?.start)} to ${prettyDay(r.period?.end)}`}</h1>

      {!r.enough && (
        <p className="lead">
          There is not enough in this week to draw much from. Below is what was recorded, without conclusions
          dressed on top of it.
        </p>
      )}
      {r.summary && <p className="lead">{r.summary}</p>}

      {r.nextAction && (
        <div className="card">
          <p className="eyebrow accent">Next week</p>
          <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{r.nextAction}</p>
        </div>
      )}

      <div className="card">
        <p className="eyebrow">Training</p>
        <p style={{ margin: '6px 0 0', fontWeight: 600 }}>
          {planned == null ? `${done} session${done === 1 ? '' : 's'} completed` : `${done} of ${planned} planned sessions done`}
        </p>
        {planned == null && <p className="muted-note">No programme that week, so there was nothing planned to measure against.</p>}
        {(r.completed || []).map((c) => (
          <p className="muted-note" key={c.day} style={{ margin: '4px 0 0' }}>
            {prettyDay(c.day)} — {c.title}{c.volumeKg != null ? ` · ${c.volumeKg}kg volume` : ''}
          </p>
        ))}
      </div>

      <div className="card">
        <p className="eyebrow">Food</p>
        <p style={{ margin: '6px 0 0', fontWeight: 600 }}>
          {n.daysClosed} of {n.daysInWeek} days closed off
        </p>
        <p className="muted-note">
          {n.daysClosed === 0
            ? 'Nothing is measured against target until a day is marked complete.'
            : 'Adherence below counts only the days you finished logging — part-logged days are not scored as misses.'}
        </p>
        {(n.days || []).map((d) => (
          <p className="muted-note" key={d.day} style={{ margin: '4px 0 0' }}>
            {prettyDay(d.day)} — {d.kcal == null ? 'nothing logged' : `${d.kcal} kcal${d.targetKcal ? ` of ${d.targetKcal}` : ''}`}
            {d.complete ? ' · closed' : ''}
          </p>
        ))}
      </div>

      {(r.steps?.weekAverage != null || r.body?.weightChangeKg != null) && (
        <div className="card">
          <p className="eyebrow">Steps and body</p>
          {r.steps?.weekAverage != null && (
            <p className="muted-note" style={{ margin: '6px 0 0' }}>
              Steps averaged {r.steps.weekAverage.toLocaleString('en-GB')} across {r.steps.daysKnown} day
              {r.steps.daysKnown === 1 ? '' : 's'} with a reading.
            </p>
          )}
          {r.body?.weightChangeKg != null && (
            <p className="muted-note" style={{ margin: '4px 0 0' }}>
              Weight {r.body.weightChangeKg > 0 ? 'up' : 'down'} {Math.abs(r.body.weightChangeKg)}kg since {r.body.since}.
            </p>
          )}
        </div>
      )}

      {r.trends?.length > 0 && (
        <div className="card">
          <p className="eyebrow">Lifts that moved</p>
          {r.trends.slice(0, 6).map((t) => (
            <p className="muted-note" key={t.name} style={{ margin: '4px 0 0' }}>
              {t.name}: {t.from}kg to {t.to}kg since {t.since}
            </p>
          ))}
        </div>
      )}

      <div className="card">
        <p className="eyebrow">Everything this used</p>
        <ul className="muted-note" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {(r.facts || []).map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      </div>

      {state.saved === false && (
        <p className="muted-note">
          This review is not being saved yet, so it will be rebuilt each time you open it.
        </p>
      )}

      <div className="nudge-actions">
        <button className="btn primary sm" onClick={() => onGo('home')}>Back to today</button>
        <button type="button" className="link-btn" onClick={() => load(true)}>Build it again</button>
      </div>
    </div>
  )
}
