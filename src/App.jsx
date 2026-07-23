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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
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
  if (!session) return <AuthScreen />
  if (loadingProfile || !profile) return <FullScreen>Setting up your account…</FullScreen>

  if (!gymActive) return <Suspended onSignOut={signOut} />

  if (profile.role === 'trainer') return <TrainerApp profile={profile} onSignOut={signOut} />

  if (!profile.onboarded_at) {
    return <Onboarding profile={profile} onDone={() => loadProfile(profile.id)} />
  }

  return <ClientApp profile={profile} onSignOut={signOut} />
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
