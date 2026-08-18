import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { countdown, activeHoliday, birthdayToday, anniversaryToday, cycleInsight, PHASE_NOTE } from './lifeEvents.js'

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const pretty = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''

// ============ COACH: events editor on a client's page ======================
export function ClientEventsCoach({ clientId, coachId }) {
  const [events, setEvents] = useState([])
  const [kind, setKind] = useState('countdown')
  const [label, setLabel] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  async function load() {
    const { data } = await supabase.from('client_events').select('*').eq('client_id', clientId).order('start_date', { ascending: true })
    setEvents(data || [])
  }
  useEffect(() => { load() }, [clientId])

  async function add() {
    if (!label.trim() || !start) return
    const row = { client_id: clientId, coach_id: coachId, kind, label: label.trim(), start_date: start, end_date: kind === 'holiday' ? (end || null) : null }
    const { data } = await supabase.from('client_events').insert(row).select().single()
    if (data) setEvents((e) => [...e, data].sort((a, b) => a.start_date.localeCompare(b.start_date)))
    setLabel(''); setStart(''); setEnd('')
  }
  async function remove(id) {
    await supabase.from('client_events').delete().eq('id', id)
    setEvents((e) => e.filter((x) => x.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Countdowns &amp; holidays</p>
      <p className="muted-note">Add a wedding or holiday to count down to. A holiday also pauses their check-in, weight, photo and measurement reminders while they're away.</p>
      <div className="stack" style={{ marginTop: 8 }}>
        {events.map((e) => {
          const c = countdown(e.start_date)
          return (
            <div key={e.id} className="task-row" style={{ alignItems: 'center' }}>
              <span className="task-label"><b>{e.label}</b> <span className="muted-note">· {e.kind === 'holiday' ? 'Holiday' : 'Countdown'} · {pretty(e.start_date)}{e.end_date ? ' – ' + pretty(e.end_date) : ''}{c ? ' · ' + c.text : ' · passed'}</span></span>
              <button type="button" className="link-btn inline" onClick={() => remove(e.id)}>Remove</button>
            </div>
          )
        })}
        {events.length === 0 && <p className="muted-note">None yet.</p>}
      </div>
      <div className="stack" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        <div className="seg small">
          <button type="button" className={kind === 'countdown' ? 'on' : ''} onClick={() => setKind('countdown')}>Countdown</button>
          <button type="button" className={kind === 'holiday' ? 'on' : ''} onClick={() => setKind('holiday')}>Holiday</button>
        </div>
        <label className="field">What is it?<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'holiday' ? 'e.g. Spain' : 'e.g. Wedding'} /></label>
        <div className="grid-2">
          <label className="field">{kind === 'holiday' ? 'From' : 'Date'}<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          {kind === 'holiday' && <label className="field">To<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>}
        </div>
        <button type="button" className="btn primary sm" disabled={!label.trim() || !start} onClick={add}>Add</button>
      </div>
    </div>
  )
}

// ============ COACH: DOB + birthday/anniversary status ======================
export function ClientDob({ client }) {
  const [dob, setDob] = useState(client.dob || '')
  const [saved, setSaved] = useState(false)
  const bday = birthdayToday(client.dob)
  const anniv = anniversaryToday(client.created_at)
  async function save() {
    const { error } = await supabase.rpc('set_client_dob', { p_client: client.id, p_dob: dob || null })
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }
  return (
    <div className="card">
      <p className="eyebrow">Birthday &amp; milestones</p>
      {(bday || anniv) && (
        <p className="logged-ok" style={{ marginBottom: 8 }}>
          {bday ? `It's ${(client.full_name || 'their').split(' ')[0]}'s birthday today` : ''}{bday && anniv ? ' · ' : ''}{anniv ? `${anniv} with you today` : ''}
        </p>
      )}
      <label className="field">Date of birth<input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></label>
      <p className="muted-note" style={{ margin: '4px 0 8px' }}>Client since {pretty((client.created_at || '').slice(0, 10))} — anniversaries (6 months, 1 year…) show automatically.</p>
      <button className="btn primary" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
    </div>
  )
}

// ============ COACH: read a client's cycle (gated) =========================
export function CoachCycle({ clientId }) {
  const [ci, setCi] = useState(undefined)
  useEffect(() => {
    supabase.from('cycle_logs').select('period_start').eq('client_id', clientId).order('period_start', { ascending: false }).limit(12)
      .then(({ data }) => setCi(cycleInsight((data || []).map((r) => r.period_start))))
  }, [clientId])
  if (ci === undefined || ci === null) return null
  return (
    <div className="card">
      <p className="eyebrow">Cycle</p>
      <p className="muted-note">Current phase <b style={{ color: 'var(--accent)' }}>{ci.phase}</b> (day {ci.dayOfCycle}) · next period ~{pretty(ci.next.toISOString().slice(0, 10))} ({ci.daysToNext}d). {PHASE_NOTE[ci.phase]}</p>
    </div>
  )
}

// ============ COACH DASHBOARD: today's celebrations ========================
export function TodayCelebrations({ clients = [] }) {
  const hits = clients.map((c) => {
    const b = birthdayToday(c.dob); const a = anniversaryToday(c.created_at)
    return (b || a) ? { name: c.full_name || 'Client', b, a } : null
  }).filter(Boolean)
  if (hits.length === 0) return null
  return (
    <div className="card">
      <p className="eyebrow accent">Today</p>
      {hits.map((h, i) => (
        <p key={i} className="checkin-line"><b>{h.name}</b> — {h.b ? 'Birthday' : ''}{h.b && h.a ? ' · ' : ''}{h.a ? `${h.a} with you` : ''}</p>
      ))}
    </div>
  )
}

// ============ CLIENT: countdowns + greetings on Home =======================
export function ClientLifeCard({ profile, events, coachName }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const bday = birthdayToday(profile.dob)
  const anniv = anniversaryToday(profile.created_at)
  const holiday = activeHoliday(events)
  const upcoming = (events || [])
    .map((e) => ({ e, c: countdown(e.start_date) }))
    .filter((x) => x.c && !(holiday && x.e.id === holiday.id))
    .sort((a, b) => a.c.days - b.c.days)
    .slice(0, 3)
  if (!bday && !anniv && !holiday && upcoming.length === 0) return null
  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      {bday && <p className="session-title">Happy birthday! {coachFirst} is cheering you on today.</p>}
      {anniv && <p className="muted-note" style={{ marginTop: bday ? 6 : 0 }}>You've been with {coachFirst} {anniv} today — look how far you've come.</p>}
      {holiday && <p className="muted-note" style={{ marginTop: 6 }}>Enjoy {holiday.label} — you're on holiday, so check-ins are paused until you're back.</p>}
      {upcoming.map(({ e, c }) => (
        <p key={e.id} className="muted-note" style={{ marginTop: 6 }}><b style={{ color: 'var(--accent)' }}>{e.label}</b> — {c.text}</p>
      ))}
    </div>
  )
}

// ============ CLIENT: cycle tracker screen (gated) =========================
export function CycleTracker({ clientId, coachName, onBack }) {
  const [logs, setLogs] = useState(null)
  const [d, setD] = useState(todayStr())
  const coachFirst = coachName?.split(' ')[0] || 'your coach'

  async function load() {
    const { data } = await supabase.from('cycle_logs').select('*').eq('client_id', clientId).order('period_start', { ascending: false }).limit(24)
    setLogs(data || [])
  }
  useEffect(() => { load() }, [clientId])

  async function logStart() {
    if (!d) return
    const { data } = await supabase.from('cycle_logs').upsert({ client_id: clientId, period_start: d }, { onConflict: 'client_id,period_start' }).select().single()
    if (data) load()
  }
  async function remove(id) {
    await supabase.from('cycle_logs').delete().eq('id', id)
    setLogs((l) => l.filter((x) => x.id !== id))
  }

  const ci = logs ? cycleInsight(logs.map((l) => l.period_start)) : null
  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Cycle</p>
      <h1 className="h1">Your cycle.</h1>
      <p className="muted-note">Log the first day of your period each month. {coachFirst} uses this to time your training and nutrition to how you feel.</p>

      {ci && (
        <div className="card" style={{ marginTop: 12, borderColor: 'var(--accent)' }}>
          <p className="session-title">{ci.phase} phase · day {ci.dayOfCycle}</p>
          <p className="muted-note" style={{ marginTop: 4 }}>{PHASE_NOTE[ci.phase]}</p>
          <p className="muted-note" style={{ marginTop: 6 }}>Next period ~<b>{pretty(ci.next.toISOString().slice(0, 10))}</b> ({ci.daysToNext} days) · average cycle {ci.avg} days.{ci.overdue ? ' Your last log looks overdue — add your latest start below.' : ''}</p>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <p className="eyebrow">Log a period start</p>
        <label className="field" style={{ marginTop: 6 }}>First day<input type="date" value={d} max={todayStr()} onChange={(e) => setD(e.target.value)} /></label>
        <button className="btn primary" style={{ marginTop: 8 }} onClick={logStart}>Save</button>
      </div>

      {logs && logs.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="eyebrow">History</p>
          <div className="stack" style={{ marginTop: 6 }}>
            {logs.map((l) => (
              <div key={l.id} className="task-row" style={{ alignItems: 'center' }}>
                <span className="task-label">{pretty(l.period_start)}</span>
                <button type="button" className="link-btn inline" onClick={() => remove(l.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {logs && logs.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>No entries yet — log your most recent period start to get predictions.</p>}
      <p className="disclaimer-note" style={{ marginTop: 12 }}>Predictions are estimates from your logged dates — not medical or contraceptive advice.</p>
    </div>
  )
}
