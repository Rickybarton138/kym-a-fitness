import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

// Paul, and his client, on the same morning: "How do I input past steps? Wanted
// to input them for this week" / "Could we add an option to go back and add
// steps for another day? Maybe in the training section ... it asks for a date
// and a total. Then keep the ability to update for the day on the home page as
// it currently does."
//
// So: exactly that. Home keeps the one-tap today entry; this is the catch-up.
// The last seven days are listed with what is already logged, because "which
// days have I missed" is the actual question being asked.
export function StepsCatchUp({ clientId, target }) {
  const [rows, setRows] = useState(null)
  const [day, setDay] = useState('')
  const [total, setTotal] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
  const today = iso(new Date())
  const week = Array.from({ length: 7 }, (_, i) => daysAgo(i))
  // Paul, 9 Sept, with a screenshot of the browser refusing 1 Sep: "Value must
  // be greater than or equal to 2026-09-03". The date input was capped at the
  // seven days the strip above it shows, so anything older was rejected by the
  // browser before it ever reached us. There is no reason for that floor — the
  // upsert is keyed on (client_id, day) — so the picker now goes back as far as
  // they like, and the list reaches back HISTORY days so a backdated save is
  // visible afterwards rather than saving into thin air.
  const HISTORY = 60
  const from = daysAgo(HISTORY)

  async function load() {
    const { data } = await supabase.from('daily_steps')
      .select('day, steps').eq('client_id', clientId).gte('day', from).order('day', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { load() }, [clientId])

  async function save(e) {
    e?.preventDefault()
    const n = Math.max(0, parseInt(String(total).replace(/[^0-9]/g, ''), 10) || 0)
    if (!day) { setErr('Pick the day.'); return }
    if (!n) { setErr('Enter the step count for that day.'); return }
    setSaving(true); setErr(''); setMsg('')
    try {
      const { error } = await supabase.from('daily_steps').upsert(
        { client_id: clientId, day, steps: n, updated_at: new Date().toISOString() },
        { onConflict: 'client_id,day' },
      )
      if (error) throw new Error(error.message)
      setMsg(`Saved ${n.toLocaleString()} steps for ${day === today ? 'today' : day}.`)
      setTotal(''); setDay('')
      load()
    } catch (e) {
      setErr((e && e.message) || 'Could not save that — check your signal and try again.')
    } finally {
      setSaving(false)
    }
    setTimeout(() => setMsg(''), 3000)
  }

  const logged = new Map((rows || []).map((r) => [r.day, r.steps]))
  const earlier = (rows || []).filter((r) => r.day < week[6])
  const label = (d) => {
    if (d === today) return 'Today'
    const dt = new Date(d + 'T00:00:00')
    const opts = { weekday: 'short', day: 'numeric', month: 'short' }
    if (dt.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
    return dt.toLocaleDateString(undefined, opts)
  }
  const dayRow = (d, n) => (
    <button
      type="button" key={d}
      className={'step-day' + (day === d ? ' on' : '')}
      onClick={() => { setDay(d); setTotal(n != null ? String(n) : ''); setErr('') }}
    >
      <span className="step-day-name">{label(d)}</span>
      <span className={'step-day-n' + (n == null ? ' none' : target && n >= target ? ' hit' : '')}>
        {n == null ? 'Not logged' : `${n.toLocaleString()} steps`}
      </span>
    </button>
  )

  return (
    <div className="card">
      <p className="eyebrow">Steps</p>
      <p className="muted-note">Missed a day? Add it here — pick any past date from the calendar. Today’s steps are quicker to log from the home screen.</p>

      {rows !== null && (
        <div className="stack step-week" style={{ marginTop: 10 }}>
          {week.map((d) => dayRow(d, logged.get(d)))}
        </div>
      )}

      {earlier.length > 0 && (
        <div className="stack step-earlier" style={{ marginTop: 10 }}>
          <p className="eyebrow">Earlier</p>
          {earlier.map((r) => dayRow(r.day, r.steps))}
        </div>
      )}

      <form onSubmit={save} style={{ marginTop: 12 }}>
        <div className="grid-2">
          <label className="field">Day
            <input type="date" max={today} value={day} onChange={(e) => { setDay(e.target.value); setErr('') }} />
          </label>
          <label className="field">Steps
            <input type="number" inputMode="numeric" value={total} onChange={(e) => { setTotal(e.target.value); setErr('') }} placeholder="e.g. 8500" />
          </label>
        </div>
        {err && <p className="error">{err}</p>}
        {msg && <p className="logged-ok">{msg}</p>}
        <button className="btn primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save steps'}</button>
      </form>
    </div>
  )
}
