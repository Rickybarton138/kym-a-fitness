// On-demand: send a single test push to the caller's own subscription.
import webpush from 'web-push'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@coached-by-kim.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }
  if (!process.env.VAPID_PRIVATE_KEY) return json(500, { error: 'Push not configured on the server.' })
  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON.' }) }
  const sub = body.subscription
  if (!sub?.endpoint) return json(400, { error: 'No subscription provided.' })
  try {
    await webpush.sendNotification(sub, JSON.stringify({
      title: 'Coached by Kim',
      body: 'Reminders are on — this is what a nudge feels like. You can change the tone any time.',
      url: '/',
      tag: 'cbk-test',
    }))
    return json(200, { ok: true })
  } catch (e) {
    return json(502, { error: `Push failed (${e.statusCode || ''}). Try turning reminders off and on again.` })
  }
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) }
}
