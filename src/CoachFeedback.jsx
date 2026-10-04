import React, { useEffect, useRef, useState } from 'react'
import { coachCall, createGuard } from './coachClient.js'

// The line you get back straight after logging something.
//
// Mounted only AFTER a confirmed save — the caller renders it in response to a
// write that came back, never optimistically, because "nice work on that
// session" under a session that failed to save is the worst thing this could do.
//
// It is quiet when there is nothing worth saying. `feedback: null` from the
// endpoint means the records do not support a comment yet (first session of its
// kind, no targets set), and in that case this renders nothing at all rather
// than inventing encouragement.

const PRAISE_KEY = 'cbk_coach_praised'

/**
 * Has this exact celebration already been shown today? Repetition is what makes
 * a coaching app feel like a machine, so the same milestone is only ever called
 * out once a day per device.
 */
function alreadySaid(tag) {
  if (!tag) return false
  try {
    const raw = JSON.parse(sessionStorage.getItem(PRAISE_KEY) || '{}')
    const today = new Date().toISOString().slice(0, 10)
    return raw[today]?.includes(tag) || false
  } catch { return false }
}

function remember(tag) {
  if (!tag) return
  try {
    const raw = JSON.parse(sessionStorage.getItem(PRAISE_KEY) || '{}')
    const today = new Date().toISOString().slice(0, 10)
    const next = { [today]: [...new Set([...(raw[today] || []), tag])] }
    sessionStorage.setItem(PRAISE_KEY, JSON.stringify(next))
  } catch { /* ignore */ }
}

export function CoachFeedback({ kind, onGo, onDone }) {
  const [state, setState] = useState({ status: 'loading' })
  const [showWhy, setShowWhy] = useState(false)
  const guard = useRef(createGuard())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const ticket = guard.current.begin()
    coachCall('feedback', { kind })
      .then((res) => {
        if (!alive.current || !guard.current.isCurrent(ticket)) return
        if (!res.feedback) { setState({ status: 'quiet', reason: res.reason }); return }
        const tag = `${kind}:${res.feedback.title}`
        setState({ status: 'ready', fb: res.feedback, repeat: alreadySaid(tag) })
        remember(tag)
      })
      .catch((e) => {
        if (!alive.current || !guard.current.isCurrent(ticket)) return
        setState({ status: 'error', error: e.message })
      })
    return () => { alive.current = false }
  }, [kind])

  if (state.status === 'quiet') return null

  if (state.status === 'loading') {
    return (
      <div className="card" style={{ minHeight: 86 }} aria-busy="true">
        <p className="eyebrow accent">Coach</p>
        <div className="coach-skeleton" aria-hidden="true"><span className="sk sk-line" /><span className="sk sk-line short" /></div>
      </div>
    )
  }

  if (state.status === 'error') {
    // Saved is saved. The feedback failing is not worth alarming anyone about.
    return (
      <div className="card" style={{ minHeight: 86 }}>
        <p className="eyebrow accent">Coach</p>
        <p className="muted-note" style={{ margin: '6px 0 0' }}>
          Saved. I could not look at it just now — {state.error}
        </p>
      </div>
    )
  }

  const fb = state.fb
  return (
    <div className="card" style={{ minHeight: 86 }}>
      <p className="eyebrow accent">Coach</p>
      <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{fb.title}</p>
      {fb.note && <p className="muted-note" style={{ marginTop: 4 }}>{fb.note}</p>}

      {fb.incomplete && (
        <p className="muted-note" style={{ marginTop: 4 }}>
          Today is still open, so this is a partial picture of the day.
        </p>
      )}

      {fb.comparison && (
        <p className="muted-note" style={{ marginTop: 4 }}>
          Compared with {fb.comparison.against}
          {fb.comparison.matchedOn === 'focus' ? ' (same focus, different session)' : ''}.
        </p>
      )}

      {fb.suggestions?.length > 0 && (
        <>
          <p className="eyebrow" style={{ marginTop: 10 }}>Could fit the rest of today</p>
          {fb.suggestions.map((s) => (
            <p className="muted-note" key={s.id} style={{ margin: '4px 0 0' }}>
              {s.title} — {s.calories} kcal, {s.protein_g}g protein
            </p>
          ))}
          {fb.avoided?.length > 0 && (
            <p className="muted-note" style={{ marginTop: 4 }}>
              Kept clear of: {fb.avoided.join(', ')}.
            </p>
          )}
        </>
      )}

      {fb.nextFocus && <p className="muted-note" style={{ marginTop: 6 }}>{fb.nextFocus}</p>}

      <div className="nudge-actions coach-actions" style={{ marginTop: 10 }}>
        {fb.suggestions?.length > 0 && <button className="btn ghost sm" onClick={() => onGo?.('mealplan')}>Choose a meal</button>}
        <button type="button" className="link-btn" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}>
          {showWhy ? 'Hide the numbers' : 'See the numbers'}
        </button>
        {onDone && <button type="button" className="link-btn" onClick={onDone}>Close</button>}
      </div>

      {showWhy && (
        <ul className="muted-note" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {(fb.facts || []).map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
    </div>
  )
}
