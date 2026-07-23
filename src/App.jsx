import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import AuthScreen from './auth.jsx'
import ClientApp from './ClientApp.jsx'
import TrainerApp from './TrainerApp.jsx'
import Onboarding from './Onboarding.jsx'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

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

  if (profile.role === 'trainer') return <TrainerApp profile={profile} onSignOut={signOut} />

  if (!profile.onboarded_at) {
    return <Onboarding profile={profile} onDone={() => loadProfile(profile.id)} />
  }

  return <ClientApp profile={profile} onSignOut={signOut} />
}

function FullScreen({ children }) {
  return (
    <div className="full-center">
      <div className="spinner" />
      <p className="muted">{children}</p>
    </div>
  )
}
