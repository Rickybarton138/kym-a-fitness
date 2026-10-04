// Talking to the coaching endpoint from the app.
//
// Four jobs, all of which went wrong in obvious ways when they were not here:
//
//   TOKEN. Every call carries the Supabase access token, because the endpoint
//   resolves identity from it and refuses anything else.
//
//   SEQUENCE. The card refreshes on save and on foreground, so two requests can
//   be in flight with the slower one started first. Each caller takes a ticket
//   and only the newest ticket is allowed to write to state, so an older answer
//   can never overwrite newer guidance.
//
//   REFRESH. One bus. A confirmed save anywhere in the app calls
//   coachChanged('meal'), and whatever is on screen re-asks. "Confirmed" is the
//   whole point: it fires after the write comes back, never before.
//
//   CACHE. The last answer for today is kept per account and brand in
//   sessionStorage, so returning to Home does not pay for another model call.
//   Cross-device is handled by re-asking on foreground and comparing the
//   server's generatedAt — not by a realtime subscription, which would be a lot
//   of machinery for a card that is only interesting when you open the app.

import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'
import { londonDay } from './coachTime.js'

const BUS = 'cbk-coach-changed'

/** Tell the coaching UI that something confirmed has changed. */
export function coachChanged(reason = 'unknown') {
  try { window.dispatchEvent(new CustomEvent(BUS, { detail: { reason, at: Date.now() } })) } catch { /* no window */ }
}

/** Subscribe to confirmed changes and to the app coming back to the foreground. */
export function onCoachRefresh(fn) {
  const onBus = (e) => fn(e.detail?.reason || 'change')
  const onVis = () => { if (document.visibilityState === 'visible') fn('foreground') }
  window.addEventListener(BUS, onBus)
  document.addEventListener('visibilitychange', onVis)
  return () => {
    window.removeEventListener(BUS, onBus)
    document.removeEventListener('visibilitychange', onVis)
  }
}

// Monotonic tickets. `begin()` before a request, `isCurrent(t)` before using the
// result. Lives in its own module so it can be tested without Vite; re-exported
// here because this is where callers expect to find it.
export { createGuard } from './coachGuard.js'

async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || null
}

/**
 * Call the endpoint. Throws an Error with a readable message; the caller decides
 * whether that is a retry button or a quiet fallback.
 */
export async function coachCall(action, payload = {}, { timeoutMs = 25000 } = {}) {
  const token = await accessToken()
  if (!token) throw new Error('Sign in again — your session has expired.')
  const control = new AbortController()
  const timer = setTimeout(() => control.abort(), timeoutMs)
  try {
    const res = await fetch('/.netlify/functions/coach', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      signal: control.signal,
      // devBrand is only honoured by the function on localhost; in production the
      // brand comes from the Host header and this is ignored.
      body: JSON.stringify({ action, devBrand: THEME.slug, ...payload }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'The coach could not answer just then.')
    return json
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('That took too long — try again.')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Device-only signals the server cannot see. A session in progress lives in
 * sessionStorage (set by startSessionNow) with its draft in localStorage, so
 * "finish what you started" can only be decided here.
 */
export function localSignals() {
  const out = { resumeSessionId: null, resumeTitle: null, dismissedKeys: [] }
  try {
    out.resumeSessionId = sessionStorage.getItem('cbk_gw_active') || null
  } catch { /* private mode */ }
  try {
    // 'cbk_gw_resume' is the durable half of the same signal (ClientApp's
    // readResume): sessionStorage is thrown away when the browser closes, the
    // resume record is not. Either one means there is a session to go back to.
    const resume = JSON.parse(localStorage.getItem('cbk_gw_resume') || 'null')
    const fresh = resume && (!resume.at || Date.now() - resume.at < 7 * 864e5)
    if (fresh && resume.title) out.resumeTitle = resume.title
    if (fresh && !out.resumeSessionId && resume.id) out.resumeSessionId = resume.id
  } catch { /* ignore */ }
  try {
    const raw = JSON.parse(sessionStorage.getItem(dismissKey()) || '[]')
    if (Array.isArray(raw)) out.dismissedKeys = raw.filter((k) => typeof k === 'string')
  } catch { /* ignore */ }
  return out
}

const dismissKey = () => `cbk_coach_dismissed_${THEME.slug}_${londonDay()}`
const cacheKey = (uid) => `cbk_coach_today_${THEME.slug}_${uid}_${londonDay()}`

/** Remember a dismissal for the rest of the day on this device. */
export function dismissLocally(key) {
  try {
    const now = JSON.parse(sessionStorage.getItem(dismissKey()) || '[]')
    const next = [...new Set([...(Array.isArray(now) ? now : []), key])].slice(-12)
    sessionStorage.setItem(dismissKey(), JSON.stringify(next))
  } catch { /* ignore */ }
}

/**
 * Persist a dismissal or snooze on the account, so it follows them to another
 * device. Written straight to the table rather than through the function: it is
 * the user's own row, RLS already allows exactly this, and a round trip through
 * a serverless function to set one timestamp is waste.
 *
 * Returns false when the table is not there yet (pre-migration), in which case
 * the local dismissal above is still in force for the day.
 */
export async function persistSuggestionState(clientId, actionKey, { dismiss = false, snoozeMinutes = 0 } = {}) {
  const row = {
    client_id: clientId,
    brand: THEME.slug || 'none',
    for_day: londonDay(),
    action_key: actionKey,
    dismissed_at: dismiss ? new Date().toISOString() : null,
    snoozed_until: snoozeMinutes ? new Date(Date.now() + snoozeMinutes * 60000).toISOString() : null,
  }
  const { error } = await supabase.from('coach_suggestions')
    .upsert(row, { onConflict: 'client_id,brand,for_day' })
  return !error
}

/** The last answer for today, if this device already has one. */
export function readCache(uid) {
  try {
    const raw = sessionStorage.getItem(cacheKey(uid))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function writeCache(uid, value) {
  try { sessionStorage.setItem(cacheKey(uid), JSON.stringify(value)) } catch { /* ignore */ }
}

/** Is this answer old enough to be worth flagging on screen? */
export function isStale(generatedAt, maxMinutes = 45) {
  if (!generatedAt) return false
  const mins = (Date.now() - new Date(generatedAt).getTime()) / 60000
  return mins > maxMinutes
}
