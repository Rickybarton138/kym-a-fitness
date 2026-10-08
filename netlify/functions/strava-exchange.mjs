// Exchange the OAuth code from Strava for tokens. Keeps the client secret server-side.
import { CORS } from './_auth.mjs'

export const handler = async (event) => {
  // The native shell runs on https://localhost, so every call to these
  // functions is cross-origin and the browser preflights it. Without this
  // the request never leaves the device. See tasks/native-app-plan.md.
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only.' })
  const id = process.env.STRAVA_CLIENT_ID, secret = process.env.STRAVA_CLIENT_SECRET
  if (!id || !secret) return json(500, { error: 'Strava is not configured on the server.' })
  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON.' }) }
  if (!body.code) return json(400, { error: 'Missing code.' })
  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: id, client_secret: secret, code: body.code, grant_type: 'authorization_code' }),
    })
    const data = await res.json()
    if (!res.ok || !data.refresh_token) return json(502, { error: data.message || 'Strava connection failed.' })
    return json(200, {
      athlete_id: String(data.athlete?.id || ''),
      athlete_name: [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' '),
      refresh_token: data.refresh_token,
    })
  } catch {
    return json(502, { error: 'Could not reach Strava. Please try again.' })
  }
}

function json(statusCode, obj) {
  return { statusCode, headers: CORS, body: JSON.stringify(obj) }
}
