import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  coachCall, createGuard, localSignals, onCoachRefresh,
  readCache, writeCache, isStale, dismissLocally, persistSuggestionState,
} from './coachClient.js'
import { nextAction } from './coachRules.js'

// "Coach's next suggestion" — the one card on Home that says what to do next.
//
// The reserved height matters more than it looks: this card sits above the fold
// and resolves after a network round trip, so without a fixed minimum the whole
// of Home jumps down when it arrives. The skeleton is the same height as the
// real thing.
//
// Every state here is a real state that happens, not defensive padding:
//   loading   first paint, or a refresh with nothing cached
//   ready     a suggestion, with the records it came from
//   stale     a cached suggestion older than the staleness window
//   empty     authenticated, nothing to suggest (new account, quiet day)
//   error     the call failed; the records are still shown if we have them
//   snoozed   asked to come back later
const MIN_HEIGHT = 168

export function CoachCard({ profile, onGo }) {
  const [state, setState] = useState(() => {
    const cached = readCache(profile.id)
    return cached ? { status: 'ready', ...cached, fromCache: true } : { status: 'loading' }
  })
  const [showWhy, setShowWhy] = useState(false)
  const [busy, setBusy] = useState(false)
  const guard = useRef(createGuard())
  const alive = useRef(true)

  const load = useCallback(async (reason = 'mount') => {
    const ticket = guard.current.begin()
    // A refresh with something already on screen keeps it there and swaps when
    // the answer lands; a cold load shows the skeleton.
    setState((s) => (s.status === 'ready' ? { ...s, refreshing: true } : { status: 'loading' }))
    try {
      const res = await coachCall('today', { local: localSignals() })
      if (!alive.current || !guard.current.isCurrent(ticket)) return
      const next = {
        status: res.action ? 'ready' : 'empty',
        action: res.action,
        explanation: res.explanation,
        evidence: res.evidence || [],
        generatedAt: res.generatedAt,
        snoozedUntil: res.snoozedUntil,
        dismissed: res.dismissed,
        missing: res.missing || [],
        persisted: res.persisted,
      }
      setState(next)
      writeCache(profile.id, next)
    } catch (e) {
      if (!alive.current || !guard.current.isCurrent(ticket)) return
      // Fall back to the rules alone where we can: there is no context without
      // the server, so this is the honest "cannot reach the coach" state, but a
      // cached answer is better than nothing on screen.
      setState((s) => (s.status === 'ready'
        ? { ...s, refreshing: false, warning: e.message }
        : { status: 'error', error: e.message }))
    }
  }, [profile.id])

  useEffect(() => {
    alive.current = true
    load('mount')
    const off = onCoachRefresh((reason) => load(reason))
    return () => { alive.current = false; off() }
  }, [load])

  const act = (screen) => { onGo(screen) }

  async function dismiss() {
    const key = state.action?.key
    if (!key) return
    setBusy(true)
    dismissLocally(key)
    await persistSuggestionState(profile.id, key, { dismiss: true })
    setBusy(false)
    load('dismiss')
  }

  async function snooze() {
    const key = state.action?.key
    if (!key) return
    setBusy(true)
    const ok = await persistSuggestionState(profile.id, key, { snoozeMinutes: 120 })
    setBusy(false)
    if (!ok) dismissLocally(key)
    setState((s) => ({ ...s, status: 'snoozed', snoozedUntil: new Date(Date.now() + 2 * 3600000).toISOString() }))
  }

  const frame = (children, extra = {}) => (
    <section className="card coach-card" style={{ minHeight: MIN_HEIGHT, ...extra }} aria-busy={state.status === 'loading'}>
      {children}
    </section>
  )

  if (state.status === 'loading') {
    return frame(
      <>
        <p className="eyebrow accent">Coach</p>
        <div className="coach-skeleton" aria-hidden="true">
          <span className="sk sk-title" /><span className="sk sk-line" /><span className="sk sk-line short" />
        </div>
        <p className="muted-note" role="status">Looking at your week…</p>
      </>,
    )
  }

  if (state.status === 'error') {
    return frame(
      <>
        <p className="eyebrow accent">Coach</p>
        <p style={{ fontWeight: 600, margin: '4px 0 0' }}>Could not reach your coach</p>
        <p className="muted-note">{state.error}</p>
        <div className="nudge-actions" style={{ marginTop: 10 }}>
          <button className="btn primary sm" onClick={() => load('retry')}>Try again</button>
        </div>
      </>,
    )
  }

  if (state.status === 'snoozed') {
    return frame(
      <>
        <p className="eyebrow accent">Coach</p>
        <p style={{ fontWeight: 600, margin: '4px 0 0' }}>Back in a couple of hours</p>
        <p className="muted-note">Nothing more from me until then.</p>
        <div className="nudge-actions" style={{ marginTop: 10 }}>
          <button className="btn ghost sm" onClick={() => load('unsnooze')}>Show it anyway</button>
        </div>
      </>,
    )
  }

  if (state.status === 'empty' || !state.action) {
    return frame(
      <>
        <p className="eyebrow accent">Coach</p>
        <p style={{ fontWeight: 600, margin: '4px 0 0' }}>Nothing to flag</p>
        <p className="muted-note">
          Log a session or a meal and I will have something useful to say about it.
        </p>
        <div className="nudge-actions" style={{ marginTop: 10 }}>
          <button className="btn ghost sm" onClick={() => act('food')}>Log food</button>
          <button className="btn ghost sm" onClick={() => act('train')}>Train</button>
        </div>
      </>,
    )
  }

  const stale = isStale(state.generatedAt)
  const a = state.action

  return frame(
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <p className="eyebrow accent" style={{ margin: 0 }}>Coach’s next suggestion</p>
        {state.refreshing && <span className="muted" style={{ fontSize: 12 }} role="status">Updating…</span>}
      </div>

      <h2 style={{ margin: '6px 0 0', fontSize: 18, lineHeight: 1.25 }}>{a.title}</h2>
      <p className="muted-note" style={{ marginTop: 4 }}>{state.explanation || a.reason}</p>

      {(stale || state.warning) && (
        <p className="muted-note" style={{ marginTop: 4 }}>
          {state.warning
            ? `${state.warning} Showing the last answer.`
            : 'This is a little out of date.'}{' '}
          <button type="button" className="link-btn" onClick={() => load('stale')}>Refresh</button>
        </p>
      )}

      <div className="nudge-actions coach-actions" style={{ marginTop: 10 }}>
        {(a.actions || []).slice(0, 3).map((btn, i) => (
          <button key={btn.screen + i} className={i === 0 ? 'btn primary sm' : 'btn ghost sm'} onClick={() => act(btn.screen)}>
            {btn.label}
          </button>
        ))}
      </div>

      <div className="nudge-actions coach-actions" style={{ marginTop: 8 }}>
        <button type="button" className="link-btn" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}>
          {showWhy ? 'Hide what this is based on' : 'What is this based on?'}
        </button>
        <button type="button" className="link-btn" disabled={busy} onClick={snooze}>Remind me later</button>
        <button type="button" className="link-btn" disabled={busy} onClick={dismiss}>Not today</button>
      </div>

      {showWhy && (
        <div className="coach-why" style={{ marginTop: 8 }}>
          <ul className="muted-note" style={{ margin: 0, paddingLeft: 18 }}>
            {(state.evidence || []).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
          {state.missing?.length > 0 && (
            <p className="muted-note" style={{ marginTop: 6 }}>
              Not known: {state.missing.join(', ')}. Nothing above assumes a zero where there is no reading.
            </p>
          )}
          {state.persisted === false && (
            <p className="muted-note" style={{ marginTop: 6 }}>
              Suggestions are not being saved yet, so dismissals only last for this device today.
            </p>
          )}
        </div>
      )}
    </>,
  )
}

/**
 * The same decision, taken entirely on the device.
 *
 * Used when there is no network: the rules are pure, so given a cached context
 * they still produce a real suggestion rather than a spinner. Exported for the
 * dev harness and the tests as much as for the app.
 */
export function offlineSuggestion(ctx) {
  return nextAction(ctx, localSignals(), new Date())
}
