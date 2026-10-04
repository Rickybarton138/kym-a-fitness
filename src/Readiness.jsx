import React, { useState } from 'react'
import { coachCall, coachChanged } from './coachClient.js'

// The daily readiness check-in: four questions, then what to do about today.
//
// The adjustment is a PROPOSAL and that is deliberate. A coach-assigned
// programme and coach-set targets are not the app's to quietly rewrite — if the
// app shortened Paul's session for Paul's client on its own, the client would
// train something their coach never wrote and neither of them would know why. So
// the suggestion sits there with Accept and No thanks, and accepting is what
// carries it into the session.
//
// It does not invent readings, and it does not interpret them medically: four
// scores and a time, in, and a training decision out.

const SCALE = [1, 2, 3, 4, 5]
const LABELS = {
  sleep: ['Awful', 'Poor', 'Average', 'Good', 'Great'],
  energy: ['Empty', 'Low', 'Okay', 'Good', 'Flying'],
  soreness: ['None', 'A bit', 'Noticeable', 'Sore', 'Very sore'],
}
const MINUTES = [20, 30, 45, 60, 90]

function Scale({ name, label, hint, value, onChange }) {
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
      <legend style={{ fontWeight: 600, fontSize: 14, padding: 0 }}>{label}</legend>
      {hint && <p className="muted-note" style={{ margin: '2px 0 6px' }}>{hint}</p>}
      <div className="seg seg-five" role="radiogroup" aria-label={label}>
        {SCALE.map((n) => (
          <button
            type="button" key={n}
            role="radio" aria-checked={value === n}
            aria-label={`${label}: ${LABELS[name] ? LABELS[name][n - 1] : n}`}
            className={value === n ? 'on' : ''}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="muted-note" style={{ margin: '4px 0 0', minHeight: 18 }}>
        {value ? (LABELS[name] ? LABELS[name][value - 1] : value) : ' '}
      </p>
    </fieldset>
  )
}

export function Readiness({ onBack, onGo }) {
  const [sleep, setSleep] = useState(0)
  const [energy, setEnergy] = useState(0)
  const [soreness, setSoreness] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)
  const [accepted, setAccepted] = useState(false)

  const ready = sleep > 0 && energy > 0

  async function submit() {
    setBusy(true); setErr('')
    try {
      const res = await coachCall('readiness', {
        readiness: { sleep, energy, soreness: soreness || null, minutes: minutes || null, note: note.trim() || null },
      })
      setResult(res)
      // Only now, with the write confirmed, does anything else get told.
      if (res.saved) coachChanged('checkin')
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  if (result) {
    const adj = result.adjustment || {}
    return (
      <div className="stack">
        <button className="link-btn" onClick={onBack}>‹ Back</button>
        <p className="eyebrow accent">Today</p>
        <h1 className="h1">{adj.headline}</h1>
        <p className="lead">{adj.note || adj.detail}</p>

        {!result.saved && (
          <p className="muted-note" role="alert">
            {result.savedWarning || 'Your answers were not saved.'}
          </p>
        )}

        <div className="card">
          <p className="eyebrow">What this is based on</p>
          <ul className="muted-note" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {(adj.facts || []).map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>

        {adj.changes?.length > 0 && (
          <div className="card">
            <p className="eyebrow accent">Suggested change</p>
            {adj.changes.map((c, i) => (
              <p key={i} style={{ margin: '6px 0 0', fontWeight: 600 }}>{c.what}</p>
            ))}
            <p className="muted-note" style={{ marginTop: 6 }}>
              Your plan is not changed unless you say so. Accepting carries this into today only.
            </p>
            <div className="nudge-actions" style={{ marginTop: 10 }}>
              <button className="btn primary sm" disabled={accepted} onClick={() => { setAccepted(true); coachChanged('readiness-accepted') }}>
                {accepted ? 'Noted for today' : 'Accept for today'}
              </button>
              <button type="button" className="link-btn" onClick={onBack}>No thanks</button>
            </div>
          </div>
        )}

        <div className="nudge-actions">
          {adj.verdict !== 'move' && <button className="btn primary sm" onClick={() => onGo('train')}>Go to the session</button>}
          <button type="button" className="link-btn" onClick={onBack}>Back to today</button>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Check in</p>
      <h1 className="h1">How are you today?</h1>
      <p className="lead">Four taps. I will tell you whether to train as written, trim it, or leave it.</p>

      <div className="card">
        <Scale name="sleep" label="Sleep" hint="Last night, not the week." value={sleep} onChange={setSleep} />
        <Scale name="energy" label="Energy" hint="Right now." value={energy} onChange={setEnergy} />
        <Scale name="soreness" label="Soreness" hint="5 means properly sore." value={soreness} onChange={setSoreness} />

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 14, padding: 0 }}>Time you have got</legend>
          <div className="seg seg-five" role="radiogroup" aria-label="Minutes available">
            {MINUTES.map((m) => (
              <button
                type="button" key={m} role="radio" aria-checked={minutes === m}
                className={minutes === m ? 'on' : ''} onClick={() => setMinutes(m)}
              >
                {m}m
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field" style={{ marginTop: 12 }}>Anything else? (optional)
          <input className="food-input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. back is a bit tight" />
        </label>
      </div>

      {err && <p className="muted-note" role="alert">{err}</p>}

      <button className="btn primary" disabled={!ready || busy} onClick={submit}>
        {busy ? 'Thinking…' : 'See what to do today'}
      </button>
      {!ready && <p className="muted-note">Sleep and energy are the two I need.</p>}
    </div>
  )
}
