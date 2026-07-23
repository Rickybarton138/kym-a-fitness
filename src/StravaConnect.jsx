import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient.js'
import { getStravaConfig, stravaAuthUrl, syncStrava } from './strava.js'

// Proof-of-concept wearable link: connect Strava, pull recent activities, and
// optionally log one as a completed workout (feeds the accountability tracker).
export function StravaConnect({ clientId, onBack }) {
  const [config, setConfig] = useState(null)
  const [conn, setConn] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [err, setErr] = useState('')
  const [logged, setLogged] = useState(null)

  async function load() {
    const [cfg, { data }] = await Promise.all([
      getStravaConfig(),
      supabase.from('strava_connections').select('*').eq('client_id', clientId).maybeSingle(),
    ])
    setConfig(cfg); setConn(data || null); setLoading(false)
    if (data?.refresh_token) sync(data.refresh_token)
  }
  useEffect(() => { load() }, [])

  async function sync(rt) {
    const token = rt || conn?.refresh_token
    if (!token) return
    setSyncing(true); setErr('')
    try {
      const j = await syncStrava(token)
      setActivities(j.activities || [])
      if (j.refresh_token && j.refresh_token !== token) {
        await supabase.from('strava_connections').update({ refresh_token: j.refresh_token }).eq('client_id', clientId)
        setConn((c) => ({ ...c, refresh_token: j.refresh_token }))
      }
    } catch (e) { setErr(e.message) }
    setSyncing(false)
  }

  async function disconnect() {
    await supabase.from('strava_connections').delete().eq('client_id', clientId)
    setConn(null); setActivities([])
  }

  async function logAsWorkout(a) {
    await supabase.from('workout_completions').insert({ client_id: clientId, source: 'strava', completed_on: a.date || undefined })
    setLogged(a.id); setTimeout(() => setLogged(null), 2000)
  }

  if (loading) return <div className="stack"><button className="link-btn" onClick={onBack}>‹ Back</button><p className="muted-note">Loading…</p></div>

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Wearables</p>
      <h1 className="h1">Connect Strava.</h1>

      {!config?.configured ? (
        <div className="card"><p className="muted-note">Strava isn’t switched on yet — your coach needs to finish the one-time setup.</p></div>
      ) : !conn ? (
        <>
          <p className="lead">Link your Strava to pull your runs, rides and workouts straight into your app.</p>
          <a className="btn primary big strava-btn" href={stravaAuthUrl(config.clientId, clientId)}>Connect with Strava</a>
          <p className="disclaimer-note">You’ll be sent to Strava to approve, then brought back here.</p>
        </>
      ) : (
        <>
          <div className="card">
            <p className="logged-ok">Connected to Strava ✓{conn.athlete_name ? ` — ${conn.athlete_name}` : ''}</p>
            <div className="nudge-actions">
              <button className="btn primary sm" disabled={syncing} onClick={() => sync()}>{syncing ? 'Syncing…' : 'Sync now'}</button>
              <button className="btn ghost sm" onClick={disconnect}>Disconnect</button>
            </div>
          </div>
          {err && <p className="error">{err}</p>}
          {syncing && activities.length === 0 && <p className="muted-note">Pulling your activities…</p>}
          {!syncing && activities.length === 0 && <p className="muted-note">No recent activities found on Strava.</p>}
          {activities.map((a) => (
            <div className="card" key={a.id}>
              <p className="eyebrow accent">{a.type} · {a.date}</p>
              <div className="session-title">{a.name}</div>
              <p className="muted-note">{(a.distance / 1000).toFixed(1)} km · {Math.round(a.moving_time / 60)} min{a.calories ? ` · ${a.calories} kcal` : ''}</p>
              <button className="btn ghost sm" onClick={() => logAsWorkout(a)}>{logged === a.id ? 'Logged ✓' : 'Log as workout'}</button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
