import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { upcomingSessions, bookingKey, dayLabel, fmtTime, ymd } from './booking.js'

// Member-facing class booking. Shows the next 7 days of the gym's timetable with
// live spots left, and lets the member book, join a waitlist, or cancel.
export function Classes({ profile, onBack }) {
  const ownerId = profile.trainer_id
  const [classes, setClasses] = useState([])
  const [mine, setMine] = useState({})       // bookingKey -> { id, status }
  const [counts, setCounts] = useState({})    // bookingKey -> booked count
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')

  async function load() {
    if (!ownerId) { setLoading(false); return }
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const to = new Date(today); to.setDate(today.getDate() + 7)
    const [{ data: cls }, { data: bk }, { data: cnt }] = await Promise.all([
      supabase.from('gym_classes').select('*').eq('owner_id', ownerId).eq('active', true),
      supabase.from('class_bookings').select('id, class_id, session_date, status')
        .eq('client_id', profile.id).gte('session_date', ymd(today)).neq('status', 'cancelled'),
      supabase.rpc('class_session_counts', { p_owner: ownerId, p_from: ymd(today), p_to: ymd(to) }),
    ])
    setClasses(cls || [])
    const mm = {}
    ;(bk || []).forEach((b) => { mm[bookingKey(b.class_id, b.session_date)] = { id: b.id, status: b.status } })
    setMine(mm)
    const cc = {}
    ;(cnt || []).forEach((r) => { cc[bookingKey(r.class_id, r.session_date)] = r.booked })
    setCounts(cc)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function book(cls, dateStr) {
    const key = bookingKey(cls.id, dateStr)
    setBusy(key); setNote('')
    const { data, error } = await supabase.rpc('book_class', { p_class: cls.id, p_date: dateStr })
    setBusy('')
    if (error) { setNote(error.message); return }
    setNote(data === 'waitlist' ? `Added to the waitlist for ${cls.title} — we'll bump you up if a spot frees.` : '')
    await load()
  }
  async function cancel(key) {
    const b = mine[key]; if (!b) return
    setBusy(key); setNote('')
    const { error } = await supabase.rpc('cancel_booking', { p_id: b.id })
    setBusy('')
    if (error) { setNote(error.message); return }
    await load()
  }

  const sessions = upcomingSessions(classes, 7)

  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Classes</p>
      <h1 className="h1">Book a class.</h1>
      <p className="muted-note">The next 7 days at your gym. Tap to book — if it's full you'll join the waitlist and we'll bump you up automatically.</p>

      {note && <p className="logged-ok" style={{ marginTop: 10 }}>{note}</p>}
      {loading && <p className="muted-note">Loading…</p>}
      {!loading && !ownerId && <p className="muted-note">You're not linked to a gym yet.</p>}
      {!loading && ownerId && sessions.length === 0 && <p className="muted-note">No classes scheduled in the next week. Check back soon.</p>}

      <div className="stack" style={{ marginTop: 12 }}>
        {sessions.map(({ cls, dateStr }) => {
          const key = bookingKey(cls.id, dateStr)
          const booked = counts[key] || 0
          const left = Math.max(0, cls.capacity - booked)
          const m = mine[key]
          return (
            <div className="card" key={key} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>{cls.title}</div>
                  <div className="muted-note" style={{ margin: '2px 0 0' }}>
                    {dayLabel(dateStr)} · {fmtTime(cls.start_time)} · {cls.duration_min}min
                    {cls.instructor ? ` · ${cls.instructor}` : ''}{cls.location ? ` · ${cls.location}` : ''}
                  </div>
                  <div className="muted-note" style={{ marginTop: 4 }}>
                    {m?.status === 'booked' && <span className="delta good">Booked ✓</span>}
                    {m?.status === 'waitlist' && <span className="delta">On waitlist</span>}
                    {!m && (left > 0 ? `${left} of ${cls.capacity} spots left` : 'Class full — waitlist open')}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {m ? (
                    <button className="btn ghost small" disabled={busy === key} onClick={() => cancel(key)}>
                      {busy === key ? '…' : 'Cancel'}
                    </button>
                  ) : (
                    <button className={'btn ' + (left > 0 ? 'primary' : 'ghost') + ' small'} disabled={busy === key} onClick={() => book(cls, dateStr)}>
                      {busy === key ? '…' : left > 0 ? 'Book' : 'Join waitlist'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
