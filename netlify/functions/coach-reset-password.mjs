// A coach sets a temporary password for one of their own clients.
//
// Why this exists: Supabase auth email has never reached a real client on this
// project — 43 users and the only recovery email ever stamped went to a test
// address — because there is no custom SMTP configured. So "forgot password" is
// a dead end and clients get locked out of an app they just signed up for. This
// gives the coach a way to let them back in without depending on email at all.
//
// SECURITY: this is the only function holding the service-role key, so these
// checks are the entire safety story. All three must pass:
//   1. the caller presents an access token Supabase agrees is valid
//   2. the caller's own profile is role='trainer'
//   3. the target's profile has trainer_id = the caller's id, and is not a coach
// A coach can therefore only ever reset a client who belongs to them.

const SUPABASE_URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const ANON = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const cors = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const out = (body, statusCode = 200) => ({ statusCode, headers: cors, body: JSON.stringify(body) })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return out({ error: 'POST only' }, 405)

  // Auth before configuration, so an anonymous caller learns nothing about how
  // the server is set up.
  const auth = event.headers.authorization || event.headers.Authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return out({ error: 'Sign in again and retry.' }, 401)
  if (!SERVICE) return out({ error: 'Password resets aren’t set up on the server yet.' }, 503)

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { return out({ error: 'Bad request.' }, 400) }
  const clientId = String(body.clientId || '')
  const password = String(body.password || '')
  // Validated before it reaches a URL — this id is interpolated into a query.
  if (!UUID.test(clientId)) return out({ error: 'Bad request.' }, 400)
  if (password.length < 8 || password.length > 72) return out({ error: 'Password must be 8–72 characters.' }, 400)

  // 1. Who is calling? Supabase verifies the token for us.
  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON, authorization: `Bearer ${token}` },
  })
  if (!meRes.ok) return out({ error: 'Sign in again and retry.' }, 401)
  const me = await meRes.json()
  if (!UUID.test(me?.id || '')) return out({ error: 'Sign in again and retry.' }, 401)

  // 2 & 3. Is the caller a coach, and is the target genuinely their client?
  const q = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,role,trainer_id,full_name&id=in.(${me.id},${clientId})`,
    { headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` } },
  )
  if (!q.ok) return out({ error: 'Could not check that client.' }, 500)
  const rows = await q.json()
  const caller = rows.find((r) => r.id === me.id)
  const target = rows.find((r) => r.id === clientId)
  if (!caller || caller.role !== 'trainer') return out({ error: 'Only a coach can reset a client’s password.' }, 403)
  if (!target || target.role === 'trainer' || target.trainer_id !== me.id) {
    return out({ error: 'That isn’t one of your clients.' }, 403)
  }

  // 4. Set it.
  const up = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${clientId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
    body: JSON.stringify({ password }),
  })
  if (!up.ok) {
    const detail = await up.text().catch(() => '')
    return out({ error: 'Could not set that password.', detail: detail.slice(0, 200) }, 500)
  }
  return out({ ok: true, name: target.full_name || 'Your client' })
}
