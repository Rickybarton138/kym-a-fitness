// Strava wearable connection helpers.

export async function getStravaConfig() {
  try {
    const res = await fetch('/.netlify/functions/strava-config')
    return await res.json()
  } catch {
    return { configured: false, clientId: '' }
  }
}

export function stravaAuthUrl(clientId, userId) {
  const redirect = window.location.origin + '/'
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read',
    state: 'strava_' + userId,
  })
  return 'https://www.strava.com/oauth/authorize?' + p.toString()
}

export async function exchangeStrava(code) {
  const res = await fetch('/.netlify/functions/strava-exchange', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error || 'Strava connection failed.')
  return j
}

export async function syncStrava(refreshToken) {
  const res = await fetch('/.netlify/functions/strava-activities', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error || 'Strava sync failed.')
  return j
}
