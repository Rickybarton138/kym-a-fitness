import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'
import { CATEGORIES, DEFAULT_PREFS, withDefaults } from './coachNotify.js'

// Which coaching notifications you want, and when.
//
// Sits under the existing "Phone reminders" card, which is the browser-level
// permission and the push subscription. This is the layer above it: the
// subscription is how a message can reach the phone, these preferences are
// whether anything should be sent at all.
//
// Everything defaults to OFF. The sender's queue is built from rows in this
// table with `enabled` true and a matching brand, so nobody is in it until they
// turn it on here, on this brand — which is also how one brand's sender is kept
// away from another brand's clients.

const HOURS = [6, 7, 8, 9, 12, 17, 18, 19]

export function CoachNotifications({ clientId }) {
  const [prefs, setPrefs] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const brand = THEME.slug || 'none'

  useEffect(() => {
    supabase.from('coach_notification_prefs')
      .select('*').eq('client_id', clientId).eq('brand', brand).maybeSingle()
      .then(({ data, error }) => {
        if (error && error.code !== 'PGRST116') { setErr('Could not load your settings.'); setPrefs(withDefaults(null)); return }
        setPrefs(withDefaults(data || null))
      })
  }, [clientId, brand])

  async function save(patch) {
    const next = withDefaults({ ...prefs, ...patch })
    setPrefs(next)            // optimistic: one tap should feel instant
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.from('coach_notification_prefs').upsert({
      client_id: clientId,
      brand,
      enabled: next.enabled,
      categories: next.categories,
      timezone: next.timezone,
      quiet_from: next.quiet_from,
      quiet_to: next.quiet_to,
      preferred_hour: next.preferred_hour,
      max_per_day: next.max_per_day,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,brand' })
    setBusy(false)
    if (error) {
      setPrefs(prefs)         // put it back rather than show a lie
      setErr('That did not save — check your signal and try again.')
    } else {
      setMsg('Saved.')
      setTimeout(() => setMsg(''), 1600)
    }
  }

  if (!prefs) return <div className="card" style={{ minHeight: 110 }} aria-busy="true"><p className="eyebrow">Coach notifications</p><p className="muted-note" role="status">Loading…</p></div>

  return (
    <div className="card">
      <p className="eyebrow accent">Coach notifications</p>
      <p className="muted-note" style={{ marginTop: 4 }}>
        Separate from the reminders above. These only go out when there is something real to say,
        and never for something you have already done.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontWeight: 600, minHeight: 44 }}>
        <input type="checkbox" checked={prefs.enabled} disabled={busy}
          onChange={(e) => save({ enabled: e.target.checked })} style={{ width: 'auto' }} />
        Send me coaching notifications
      </label>

      {prefs.enabled && (
        <>
          <p className="eyebrow" style={{ marginTop: 14 }}>What for</p>
          {Object.entries(CATEGORIES).map(([key, meta]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
              <input type="checkbox" checked={!!prefs.categories[key]} disabled={busy}
                onChange={(e) => save({ categories: { ...prefs.categories, [key]: e.target.checked } })}
                style={{ width: 'auto' }} />
              <span style={{ fontSize: 14 }}>{meta.label}</span>
            </label>
          ))}

          <div className="grid-2" style={{ marginTop: 14 }}>
            <label className="field">Usual time
              <select className="ex-select" value={prefs.preferred_hour} disabled={busy}
                onChange={(e) => save({ preferred_hour: Number(e.target.value) })}>
                {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
            </label>
            <label className="field">Most per day
              <select className="ex-select" value={prefs.max_per_day} disabled={busy}
                onChange={(e) => save({ max_per_day: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          <div className="grid-2">
            <label className="field">Quiet from
              <input type="time" className="food-input" value={String(prefs.quiet_from).slice(0, 5)} disabled={busy}
                onChange={(e) => save({ quiet_from: e.target.value })} />
            </label>
            <label className="field">Quiet until
              <input type="time" className="food-input" value={String(prefs.quiet_to).slice(0, 5)} disabled={busy}
                onChange={(e) => save({ quiet_to: e.target.value })} />
            </label>
          </div>

          <p className="muted-note">
            Times are {prefs.timezone.replace('_', ' ')}. Nothing is sent inside your quiet hours, and nothing is
            sent twice.
          </p>
        </>
      )}

      {msg && <p className="logged-ok" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      {!prefs.enabled && (
        <p className="muted-note" style={{ marginTop: 8 }}>
          Turn the phone reminders above on as well — that is the permission that lets anything reach your lock screen.
        </p>
      )}
    </div>
  )
}
