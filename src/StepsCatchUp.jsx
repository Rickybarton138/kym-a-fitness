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
  const today = iso(new Date())
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i); return iso(d)
  })

  async function load() {
    const { data } = await supabase.from('daily_steps')
      .select('day, steps').eq('client_id', clientId).gte('day', week[6]).order('day', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { load() }, [clientId])

  async function save(e) {
    e?.preventDefault()
    const n = Math.max(0, parseInt(String(total).replace(/[^0-9]/g, ''), 10) || 0)
    if (!day) { setErr('Pick the day.'); return }
    if (!n) { setErr('Enter the step count for that day.'); return }
    setSaving(true); setErr(''); setMsg('')
    const { error } = await supabase.from('daily_steps').upsert(
      { client_id: clientId, day, steps: n, updated_at: new Date().toISOString() },
      { onConflict: 'client_id,day' },
    )
    setSaving(false)
    if (error) { setErr(error.message); return }
    setMsg(`Saved ${n.toLocaleString()} steps for ${day === today ? 'today' : day}.`)
    setTotal(''); setDay('')
    load()
    setTimeout(() => setMsg(''), 3000)
  }

  const logged = new Map((rows || []).map((r) => [r.day, r.steps]))
  const label = (d) => {
    if (d === today) return 'Today'
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="card">
      <p className="eyebrow">Steps</p>
      <p className="muted-note">Missed a day? Add it here. Today’s steps are quicker to log from the home screen.</p>

      {rows !== null && (
        <div className="stack" style={{ marginTop: 10 }}>
          {week.map((d) => {
            const n = logged.get(d)
            const hit = target && n >= target
            return (
              <button
                type="button" key={d}
                className={'step-day' + (day === d ? ' on' : '')}
                onClick={() => { setDay(d); setTotal(n != null ? String(n) : ''); setErr('') }}
              >
                <span className="step-day-name">{label(d)}</span>
                <span className={'step-day-n' + (n == null ? ' none' : hit ? ' hit' : '')}>
                  {n == null ? 'Not logged' : `${n.toLocaleString()} steps`}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <form onSubmit={save} style={{ marginTop: 12 }}>
        <div className="grid-2">
          <label className="field">Day
            <input type="date" max={today} min={week[6]} value={day} onChange={(e) => { setDay(e.target.value); setErr('') }} />
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
