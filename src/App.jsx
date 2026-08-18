import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'
import AuthScreen from './auth.jsx'
import ClientApp from './ClientApp.jsx'
import TrainerApp from './TrainerApp.jsx'
import Onboarding from './Onboarding.jsx'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [gymActive, setGymActive] = useState(true) // admin kill switch
  const [recovery, setRecovery] = useState(false)  // arrived via a password-reset link

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    setLoadingProfile(true)
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data)
      // Kill switch: a coach reads their own flag; a client reads their coach's.
      if (data?.role === 'trainer') {
        setGymActive(data.active !== false)
      } else if (data?.trainer_id) {
        const { data: tr } = await supabase.from('profiles').select('active').eq('id', data.trainer_id).maybeSingle()
        setGymActive(tr ? tr.active !== false : true)
      } else {
        setGymActive(true)
      }
    } finally {
      setLoadingProfile(false)
    }
  }

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    loadProfile(session.user.id)
  }, [session])

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  if (session === undefined) return <FullScreen>Loading…</FullScreen>
  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />
  if (!session) return <AuthScreen />
  if (loadingProfile || !profile) return <FullScreen>Setting up your account…</FullScreen>

  if (!gymActive) return <Suspended onSignOut={signOut} />

  if (profile.role === 'trainer') return <TrainerApp profile={profile} onSignOut={signOut} />

  if (!profile.onboarded_at) {
    return <Onboarding profile={profile} onDone={() => loadProfile(profile.id)} />
  }

  return <ClientApp profile={profile} onSignOut={signOut} />
}

// Shown after a user clicks their password-reset email link. Supabase has already
// put them in a temporary recovery session; they just set a new password here.
function ResetPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  async function save(e) {
    e.preventDefault()
    if (pw.length < 6) { setError('Use at least 6 characters.'); return }
    if (pw !== pw2) { setError('The two passwords don’t match.'); return }
    setBusy(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { setError(error.message || 'Could not update your password.'); return }
    setOk(true)
    // Clean the recovery token out of the URL, then continue into the app.
    try { window.history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ }
    setTimeout(onDone, 1200)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          {THEME.logo ? <img className="brand-logo" src={THEME.logo} alt={THEME.name} /> : <span className="brand-logo-badge">{THEME.mark}</span>}
          <h1>{THEME.name}</h1>
          <p className="muted">Set a new password</p>
        </div>
        <form className="auth-form" onSubmit={save}>
          <label>New password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
          <label>Confirm password<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
          {error && <p className="error">{error}</p>}
          {ok && <p className="notice">Password updated — signing you in…</p>}
          <button className="btn primary big" disabled={busy || ok} type="submit">{busy ? 'Saving…' : 'Save new password'}</button>
        </form>
      </div>
    </div>
  )
}

function Suspended({ onSignOut }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand">
          {THEME.logo ? <img className="brand-logo" src={THEME.logo} alt={THEME.name} /> : <span className="brand-logo-badge">{THEME.mark}</span>}
          <h1>{THEME.name}</h1>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>Access to {THEME.name} is paused at the moment. Please check back soon, or get in touch with your coach.</p>
        <button className="btn ghost" style={{ marginTop: 18 }} onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  )
}

function FullScreen({ children }) {
  return (
    <div className="full-center">
      <div className="spinner" />
      <p className="muted">{children}</p>
    </div>
  )
}
