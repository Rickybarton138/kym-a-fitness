// Refresh the athlete's token and fetch their recent activities.
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  const id = process.env.STRAVA_CLIENT_ID, secret = process.env.STRAVA_CLIENT_SECRET
  if (!id || !secret) return json(500, { error: 'Strava is not configured on the server.' })
  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON.' }) }
  if (!body.refresh_token) return json(400, { error: 'Missing token.' })
  try {
    const tRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: id, client_secret: secret, grant_type: 'refresh_token', refresh_token: body.refresh_token }),
    })
    const t = await tRes.json()
    if (!tRes.ok || !t.access_token) return json(502, { error: 'Could not refresh Strava access.' })
    const aRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=15', {
      headers: { authorization: 'Bearer ' + t.access_token },
    })
    const acts = await aRes.json()
    if (!aRes.ok) return json(502, { error: 'Could not load activities.' })
    const activities = (Array.isArray(acts) ? acts : []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.sport_type || a.type,
      distance: a.distance || 0,
      moving_time: a.moving_time || 0,
      date: (a.start_date_local || '').slice(0, 10),
      calories: a.calories || null,
    }))
    return json(200, { activities, refresh_token: t.refresh_token || body.refresh_token })
  } catch {
    return json(502, { error: 'Could not reach Strava. Please try again.' })
  }
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) }
}
