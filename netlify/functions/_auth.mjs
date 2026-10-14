// Authentication, authorisation and request hygiene for the coaching endpoints.
//
// Why this exists: every other AI function in this repo takes what it needs from
// the request body — `analyze.mjs` is handed the client's knowledge base, their
// comms and their health context by the browser, and verifies nothing. That was
// survivable while the body only carried what the caller already had on screen.
// The coaching engine reads a client's whole record, so it cannot work that way.
//
// Two rules follow from that, and they are the whole design:
//
//   1. IDENTITY COMES FROM THE SESSION. The caller sends their Supabase access
//      token; we ask Supabase who it belongs to. A client_id in the body is
//      ignored — if one is present and disagrees, the request is refused rather
//      than silently answered for the wrong person.
//
//   2. QUERIES RUN AS THE USER. Every read uses the publishable key plus the
//      caller's own token, so PostgREST applies the same RLS policies the
//      browser gets. There is no service-role key in this project and this code
//      does not want one: account isolation is then enforced by the database,
//      not by my remembering to add `.eq('client_id', id)` to every query.
//
// `analyze.mjs` used to be exempt from all of that, and the note here said so:
// it served four other brands' paying clients with no Authorization header, so
// authenticating it would have broken all of them. That was a statement about
// the CLIENT, not about the rule, and it stopped being true on 14 Oct 2026 when
// every call site started sending the token (`src/apiAuth.js`). `analyze` and
// the other eight AI endpoints now go through `requireAiUser` below. The old
// note is kept in this shape on purpose: left as it was, a future session would
// read it as a decision and undo the fix.

import { brandForHost } from '../../src/brandHosts.js'

export const SUPABASE_URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
export const SUPABASE_KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

// 64 KB. The largest legitimate body here is a chat question plus a short
// client-side signal; anything near this is a mistake or an attempt.
export const MAX_BODY = 64 * 1024

// The vision endpoints are a different kind of request: `equipment-scan` takes
// up to four base64 photos and `analyze`'s form mode sends video stills, so
// 64 KB would 413 every real call. Netlify's own synchronous body limit is 6 MB
// and a request that hits it dies with no usable body, so this refuses first,
// with a sentence the UI can show.
export const MAX_UPLOAD_BODY = 5 * 1024 * 1024

export const CORS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

export function json(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) }
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

/** Parse and bound the body. Throws HttpError rather than returning junk. */
export function readBody(event, { max = MAX_BODY } = {}) {
  const raw = event.body || ''
  if (raw.length > max) throw new HttpError(413, 'Request too large.')
  if (!raw) return {}
  let parsed
  try { parsed = JSON.parse(raw) } catch { throw new HttpError(400, 'Body must be JSON.') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'Body must be a JSON object.')
  }
  return parsed
}

/**
 * Who is calling. Resolved from the Authorization header via Supabase, so a
 * forged or expired token fails here and never reaches a query.
 */
export async function requireUser(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'Sign in again — this request had no session.')

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new HttpError(401, 'Your session has expired — sign in again.')
  const user = await res.json()
  if (!user?.id) throw new HttpError(401, 'Could not establish who you are.')
  return { id: user.id, email: user.email || null, token }
}

/**
 * Refuse a body that names a different person. Belt and braces: nothing reads
 * the body's id, but a request that sends one is either a bug or a probe, and
 * both are worth failing loudly.
 */
export function rejectImpersonation(body, user) {
  const claimed = body.clientId || body.client_id
  if (claimed && claimed !== user.id) throw new HttpError(403, 'That is not your account.')
}

/**
 * The gate for the AI endpoints that were open to the whole internet until
 * 14 Oct 2026.
 *
 * Nine functions called Anthropic on Ricky's key with no caller identity: a
 * browser console anywhere could spend his credit in a loop, and when the
 * account did run dry on 12 Oct there was no record of who had spent it.
 *
 * The reason this is a switch rather than a plain `requireUser` is the ROLLOUT,
 * not the rule. An installed PWA that is resumed keeps running the bundle
 * already in memory for days — `src/UpdatePrompt.jsx` exists because of exactly
 * that — so a server that starts demanding a token in the same deploy that
 * teaches the client to send one hands a 401 to every client who has not
 * reloaded. `AI_AUTH=observe` accepts a token when one arrives and tolerates
 * its absence, which lets the client half land first and be given time to
 * spread.
 *
 * Enforcing is the DEFAULT, including when the variable is unset. A site nobody
 * thought about is protected, and the tolerance has to be deliberately asked
 * for — the opposite way round from `coach-notify`'s empty-body hole, which
 * failed open and so stayed quiet for ten days.
 *
 * Returns the user, or null when the site is still tolerating anonymous callers.
 */
export async function requireAiUser(event) {
  const mode = String(process.env.AI_AUTH || 'enforce').trim().toLowerCase()
  if (mode !== 'observe') return requireUser(event)
  try {
    return await requireUser(event)
  } catch {
    return null
  }
}

/**
 * Coach-only tools. The brief says authorise, not merely authenticate: a
 * client's own session is a valid session, and it must not be able to rewrite a
 * programme library or mint a batch of recipes into one.
 *
 * The role is read as the caller through RLS, so this cannot be answered for
 * somebody else. `userQuery.select` returns null when a table is missing, which
 * for `profiles` would mean the database is not what we think it is — that is
 * refused rather than waved through, because failing open on an authorisation
 * check is how you end up with a client editing a coach's library.
 *
 * `user` may be null while a site is in `observe` mode; the caller skips the
 * check in that case, which is the whole point of the window.
 */
export async function requireCoach(user) {
  const rows = await userQuery(user.token).select('profiles', `id=eq.${user.id}&select=role`)
  if (rows === null) throw new HttpError(502, 'Could not check your account.')
  const role = rows[0]?.role
  if (role !== 'trainer') throw new HttpError(403, 'That tool is for coaches.')
  return role
}

/** The brand, from the Host header only. */
export function brandOf(event) {
  const host = event.headers?.host || event.headers?.Host || ''
  // On localhost there is no brand in the host; the dev client passes ?brand=
  // and the function accepts a dev-only hint so local work is possible.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(String(host))
  if (isLocal) return { brand: null, local: true }
  return { brand: brandForHost(host), local: false }
}

/**
 * A PostgREST client bound to the caller's token. RLS applies as them.
 * Returns rows, or throws HttpError on a failure worth surfacing.
 */
export function userQuery(token) {
  const headers = { apikey: SUPABASE_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  return {
    async select(table, query) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers })
      if (!res.ok) {
        // A missing table is the expected state before the migration is applied,
        // and it must not take the whole request down — the caller treats a null
        // slice as "not loaded" rather than "empty".
        if (res.status === 404 || res.status === 400) return null
        throw new HttpError(502, `Could not read ${table}.`)
      }
      return res.json()
    },
    async insert(table, rows, { upsert = false, onConflict = '' } = {}) {
      const prefer = ['return=representation']
      if (upsert) prefer.push('resolution=merge-duplicates')
      const url = `${SUPABASE_URL}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ''}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...headers, prefer: prefer.join(',') },
        body: JSON.stringify(rows),
      })
      if (!res.ok) {
        const text = await res.text()
        if (res.status === 404) return null
        // 23505 is a unique violation, which for this engine is a SUCCESSFUL
        // de-duplication: the row is already there, so the write is a no-op and
        // the caller should carry on rather than retry.
        if (res.status === 409 || text.includes('23505')) return { duplicate: true }
        throw new HttpError(502, `Could not write ${table}.`)
      }
      return res.json()
    },
    async remove(table, query) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { method: 'DELETE', headers })
      if (!res.ok && res.status !== 404) throw new HttpError(502, `Could not delete from ${table}.`)
      return true
    },
  }
}

/**
 * Per-day call ceiling, counted in the database.
 *
 * A module-scope counter would be worthless here: Netlify runs many short-lived
 * concurrent instances, so each would keep its own count and the ceiling would
 * be the limit times the number of instances. This costs one round trip and
 * actually holds. It fails OPEN — if the table is missing (before the migration)
 * or unreadable, the request proceeds, because a broken counter must not take
 * the feature out.
 */
export async function withinDailyLimit(q, userId, day, limit = 120) {
  try {
    const rows = await q.select('coach_usage', `client_id=eq.${userId}&day=eq.${day}&select=calls`)
    if (rows === null) return { ok: true, counted: false }
    const used = rows[0]?.calls || 0
    if (used >= limit) return { ok: false, counted: true, used }
    await q.insert('coach_usage', [{ client_id: userId, day, calls: used + 1 }],
      { upsert: true, onConflict: 'client_id,day' })
    return { ok: true, counted: true, used: used + 1 }
  } catch {
    return { ok: true, counted: false }
  }
}

/**
 * Call Claude with a hard timeout.
 *
 * The timeout is set below Netlify's own function limit on purpose: an
 * AbortController firing at 20s returns a handled error the UI can retry,
 * whereas letting the platform kill the function at 26s returns a 502 with no
 * body and the client cannot tell a timeout from a crash.
 */
export async function askClaude({ model, system, messages, maxTokens = 500, timeoutMs = 20000 }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new HttpError(503, 'Coaching AI is not configured.')
  const control = new AbortController()
  const timer = setTimeout(() => control.abort(), timeoutMs)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: control.signal,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        // The stable instructions are cached; the per-request facts go in the
        // user turn, after the breakpoint, so the cache is not invalidated by
        // every new day's numbers.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      // Never log the key, and never echo a provider body that might carry one.
      console.error('anthropic error', res.status, detail.slice(0, 200))
      throw new HttpError(res.status === 429 ? 429 : 502, 'The coach could not answer just then.')
    }
    const body = await res.json()
    return (body?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
  } catch (e) {
    if (e instanceof HttpError) throw e
    if (e.name === 'AbortError') throw new HttpError(504, 'That took too long — try again.')
    throw new HttpError(502, 'The coach could not answer just then.')
  } finally {
    clearTimeout(timer)
  }
}

/** Standard wrapper: CORS preflight, method check, error shaping. */
export function handler(fn) {
  return async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
    if (event.httpMethod !== 'POST') return json(405, { error: 'POST only.' })
    try {
      return await fn(event)
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message })
      console.error('coach function error', e?.message)
      return json(500, { error: 'Something went wrong.' })
    }
  }
}

/**
 * What to say when the Anthropic call fails.
 *
 * 12 Oct 2026: the account ran out of credit, and every AI screen on Paul's
 * site showed his paying clients "Your credit balance is too low to access the
 * Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."
 * — our billing problem, word for word, inside their coaching app. Six call
 * sites piped `data.error.message` straight through.
 *
 * The upstream message belongs in the function log, where it is the first thing
 * anyone debugging wants. It does not belong on a client's phone.
 */
export function upstreamMessage(status, data, fallback = 'The AI isn’t answering right now — give it a minute and try again.') {
  console.error('anthropic upstream', status, data?.error?.type, data?.error?.message)
  if (status === 429) return 'The AI is busy right now — give it a minute and try again.'
  if (status >= 500) return 'The AI service is having a moment — try again shortly.'
  return fallback
}
