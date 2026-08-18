import React, { useState } from 'react'
import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'

export default function AuthScreen() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [role, setRole] = useState('client') // client | trainer
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function sendReset(e) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
      if (error) throw error
      setNotice('If that email has an account, a reset link is on its way. Check your inbox (and spam).')
    } catch (err) {
      setError(err.message || 'Could not send the reset email.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        // App picks up the session via onAuthStateChange.
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role,
              trainer_code: role === 'client' ? code.trim() : '',
            },
          },
        })
        if (error) throw error
        if (!data.session) {
          setNotice('Account created. Check your email to confirm, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          {THEME.logo ? <img className="brand-logo" src={THEME.logo} alt={THEME.name} /> : <span className="brand-logo-badge">{THEME.mark}</span>}
          <h1>{THEME.name}</h1>
          <p className="muted">{THEME.tagline}</p>
        </div>

        {mode !== 'forgot' && (
          <div className="seg">
            <button className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')} type="button">Sign in</button>
            <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')} type="button">Create account</button>
          </div>
        )}

        {mode === 'forgot' ? (
          <form className="auth-form" onSubmit={sendReset}>
            <p className="muted" style={{ marginBottom: 4 }}>Enter your email and we’ll send you a link to set a new password.</p>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            {error && <p className="error">{error}</p>}
            {notice && <p className="notice">{notice}</p>}
            <button className="btn primary big" disabled={busy} type="submit">{busy ? 'Sending…' : 'Send reset link'}</button>
            <button type="button" className="link-btn" style={{ marginTop: 8 }} onClick={() => { setMode('signin'); setError(''); setNotice('') }}>Back to sign in</button>
          </form>
        ) : (
        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>
                Full name
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
              </label>
              <div className="seg small">
                <button type="button" className={role === 'client' ? 'on' : ''} onClick={() => setRole('client')}>I’m a client</button>
                <button type="button" className={role === 'trainer' ? 'on' : ''} onClick={() => setRole('trainer')}>I’m the coach</button>
              </div>
              {role === 'client' && (
                <label>
                  Coach code <span className="muted">(from your coach)</span>
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. 4F9A2C" autoCapitalize="characters" />
                </label>
              )}
            </>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </label>

          {error && <p className="error">{error}</p>}
          {notice && <p className="notice">{notice}</p>}

          <button className="btn primary big" disabled={busy} type="submit">
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          {mode === 'signin' && (
            <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={() => { setMode('forgot'); setError(''); setNotice('') }}>Forgot password?</button>
          )}
        </form>
        )}
      </div>
    </div>
  )
}
