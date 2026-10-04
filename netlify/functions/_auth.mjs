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
// `analyze.mjs` is deliberately untouched. It serves four other brands' paying
// clients with no Authorization header; adding auth there would break all of
// them, and the coaching chat lives here instead.

import { brandForHost } from '../../src/brandHosts.js'

export const SUPABASE_URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
export const SUPABASE_KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

// 64 KB. The largest legitimate body here is a chat question plus a short
// client-side signal; anything near this is a mistake or an attempt.
export const MAX_BODY = 64 * 1024

export const CORS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

export function json(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) }
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

/** Parse and bound the body. Throws HttpError rather than returning junk. */
export function readBody(event) {
  const raw = event.body || ''
  if (raw.length > MAX_BODY) throw new HttpError(413, 'Request too large.')
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
