import React, { useEffect, useState } from 'react'
import { coachCall } from './coachClient.js'

// What the coach has been told to remember, and the button that empties it.
//
// Anything that keeps notes about a person has to let them see the notes. This
// is also where dietary constraints live: there is no structured allergy field
// on `profiles`, and adding one would mean widening the column grants that were
// locked down in September, so a saved memory is the right home for it.
//
// Memory is per account AND per brand. The same person on two brands keeps two
// sets, which is the same rule the rest of the coaching state follows.

const SUGGESTIONS = [
  { key: 'Allergies', placeholder: 'e.g. shellfish, walnuts' },
  { key: 'Foods I will not eat', placeholder: 'e.g. no liver, no olives' },
  { key: 'Training I want to avoid', placeholder: 'e.g. nothing overhead' },
  { key: 'What I am working towards', placeholder: 'e.g. 10k in under 50 minutes' },
]

export function CoachMemory() {
  const [rows, setRows] = useState(null)
  const [available, setAvailable] = useState(true)
  const [key, setKey] = useState(SUGGESTIONS[0].key)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirming, setConfirming] = useState(false)

  async function load() {
    try {
      const res = await coachCall('memory', { op: 'list' })
      setRows(res.memory || [])
      setAvailable(res.available !== false)
    } catch (e) { setErr(e.message); setRows([]) }
  }
  useEffect(() => { load() }, [])

  async function save() {
    const v = value.trim()
    if (!v) return
    setBusy(true); setErr('')
    try {
      await coachCall('memory', { op: 'save', key, value: v })
      setValue('')
      await load()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  async function forget(k) {
    setBusy(true); setErr('')
    try { await coachCall('memory', { op: 'forget', key: k }); await load() } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  async function clearAll() {
    setBusy(true); setErr('')
    try { await coachCall('memory', { op: 'clear' }); setConfirming(false); await load() } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  if (rows === null) return <div className="card" style={{ minHeight: 96 }} aria-busy="true"><p className="eyebrow">Coaching memory</p><p className="muted-note" role="status">Loading…</p></div>

  return (
    <div className="card">
      <p className="eyebrow accent">What I remember about you</p>
      <p className="muted-note" style={{ marginTop: 4 }}>
        Used in every answer. Yours to change or wipe.
      </p>

      {!available && (
        <p className="muted-note" role="alert" style={{ marginTop: 6 }}>
          Memory is not set up on the server yet, so nothing is being saved.
        </p>
      )}

      {rows.length === 0 && available && (
        <p className="muted-note" style={{ marginTop: 6 }}>Nothing saved yet.</p>
      )}

      {rows.map((m) => (
        <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 14 }}>
            <b>{m.key}:</b> {m.value}
            {m.source === 'ai' ? <span className="muted"> (picked up from a conversation)</span> : null}
          </span>
          <button type="button" className="link-btn" disabled={busy} onClick={() => forget(m.key)}>Forget</button>
        </div>
      ))}

      <div className="grid-2" style={{ marginTop: 12 }}>
        <label className="field">Kind
          <select className="ex-select" value={key} onChange={(e) => setKey(e.target.value)}>
            {SUGGESTIONS.map((s) => <option key={s.key}>{s.key}</option>)}
          </select>
        </label>
        <label className="field">Detail
          <input className="food-input" maxLength={300} value={value} onChange={(e) => setValue(e.target.value)}
            placeholder={SUGGESTIONS.find((s) => s.key === key)?.placeholder || ''} />
        </label>
      </div>

      {err && <p className="muted-note" role="alert">{err}</p>}

      <div className="nudge-actions" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn primary sm" disabled={busy || !value.trim() || !available} onClick={save}>Remember this</button>
        {rows.length > 0 && !confirming && (
          <button type="button" className="link-btn" disabled={busy} onClick={() => setConfirming(true)}>Forget everything</button>
        )}
        {confirming && (
          <>
            <button className="btn ghost sm" disabled={busy} onClick={clearAll}>Yes, wipe it</button>
            <button type="button" className="link-btn" onClick={() => setConfirming(false)}>Keep it</button>
          </>
        )}
      </div>
    </div>
  )
}
