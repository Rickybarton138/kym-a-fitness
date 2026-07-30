// Shared web-push sender for the scheduled nudge functions.
import webpush from 'web-push'
import { FOOD_NUDGES, WORKOUT_NUDGES, pickNudge, daySeed } from '../../src/accountability.js'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@coached-by-kim.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

// URL + publishable key are public (RLS protects data); the secret gates the RPC.
const SUPABASE_URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const SUPABASE_KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const SECRET = process.env.NUDGE_CRON_SECRET

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status} ${await res.text()}`)
  return res.json()
}

// Once-a-day digest to coaches who opted in: one push summarising their clients'
// activity over the last 24h.
export async function runCoachDigest() {
  if (!SECRET) return { error: 'NUDGE_CRON_SECRET not set' }
  const rows = await rpc('coach_digest', { p_secret: SECRET })
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  let sent = 0, pruned = 0
  for (const r of rows) {
    const parts = []
    if (r.checkins) parts.push(plural(r.checkins, 'check-in'))
    if (r.forms) parts.push(plural(r.forms, 'form check'))
    if (r.workouts) parts.push(plural(r.workouts, 'workout'))
    if (r.meals) parts.push(plural(r.meals, 'meal') + ' logged')
    if (r.msgs) parts.push(plural(r.msgs, 'message'))
    if (r.ais) parts.push(plural(r.ais, 'AI question'))
    if (r.scans) parts.push(plural(r.scans, 'body scan'))
    const body = 'Today: ' + (parts.join(', ') || 'client activity')
    const sub = { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title: 'Your clients today', body, url: '/', tag: 'coach-digest' }))
      sent++
      await rpc('coach_digest_mark_sent', { p_secret: SECRET, p_coach: r.coach_id }).catch(() => {})
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await rpc('nudge_drop', { p_secret: SECRET, p_endpoint: r.endpoint }).catch(() => {})
        pruned++
      }
    }
  }
  return { due: rows.length, sent, pruned }
}

// Custom per-client reminders (coach-written, self-timed). Fires each reminder
// once per UK day at/after its set time; content is the coach's own message.
export async function runReminders() {
  if (!SECRET) return { error: 'NUDGE_CRON_SECRET not set' }
  const rows = await rpc('reminders_due', { p_secret: SECRET })
  const titleFor = (kind) => kind === 'reply' ? 'A note for your coach' : kind === 'evidence' ? 'Send your coach evidence' : 'Reminder'
  let sent = 0, pruned = 0
  for (const r of rows) {
    const sub = { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title: titleFor(r.kind), body: r.message, url: '/', tag: `rem-${r.reminder_id}` }))
      sent++
      await rpc('reminder_mark_sent', { p_secret: SECRET, p_id: r.reminder_id }).catch(() => {})
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await rpc('nudge_drop', { p_secret: SECRET, p_endpoint: r.endpoint }).catch(() => {})
        pruned++
      }
    }
  }
  return { due: rows.length, sent, pruned }
}

// Athlete red-flag alerts to coaches: when an athlete self-reports severe soreness
// or a low readiness score, push the coach once. Runs on a short cron so it's near
// real-time; alerted_at on the source row makes each flag fire only once.
export async function runCoachAlerts() {
  if (!SECRET) return { error: 'NUDGE_CRON_SECRET not set' }
  const rows = await rpc('coach_alerts_due', { p_secret: SECRET })
  let sent = 0, pruned = 0
  for (const r of rows) {
    const sub = { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title: 'Athlete needs attention', body: r.message, url: '/', tag: `alert-${r.kind}-${r.flag_id}` }))
      sent++
      await rpc('coach_alert_mark_sent', { p_secret: SECRET, p_kind: r.kind, p_id: r.flag_id }).catch(() => {})
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await rpc('nudge_drop', { p_secret: SECRET, p_endpoint: r.endpoint }).catch(() => {})
        pruned++
      }
    }
  }
  return { due: rows.length, sent, pruned }
}

// Athlete-chosen daily reminder: fires once per UK day at/after the athlete's set
// time. Runs hourly; last_daily_on makes it fire once.
export async function runDailyReminders() {
  if (!SECRET) return { error: 'NUDGE_CRON_SECRET not set' }
  const rows = await rpc('daily_reminders_due', { p_secret: SECRET })
  let sent = 0, pruned = 0
  for (const r of rows) {
    const sub = { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title: 'Daily check-in', body: 'Time to check in — log your day and how you are feeling.', url: '/', tag: 'daily-reminder' }))
      sent++
      await rpc('daily_reminder_mark_sent', { p_secret: SECRET, p_client: r.client_id }).catch(() => {})
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await rpc('nudge_drop', { p_secret: SECRET, p_endpoint: r.endpoint }).catch(() => {})
        pruned++
      }
    }
  }
  return { due: rows.length, sent, pruned }
}

export async function runNudges(kind) {
  if (!SECRET) return { error: 'NUDGE_CRON_SECRET not set' }
  const rows = await rpc('nudges_due', { p_secret: SECRET, p_kind: kind })
  const bank = kind === 'food' ? FOOD_NUDGES : WORKOUT_NUDGES
  const seed = daySeed() + (kind === 'workout' ? 1 : 0)
  const title = kind === 'food' ? 'Time to log your food' : 'Workout time'
  let sent = 0, pruned = 0
  for (const r of rows) {
    const body = pickNudge(bank, r.level || 2, seed)
    const sub = { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title, body, url: '/', tag: `cbk-${kind}` }))
      sent++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await rpc('nudge_drop', { p_secret: SECRET, p_endpoint: r.endpoint }).catch(() => {})
        pruned++
      }
    }
  }
  return { kind, due: rows.length, sent, pruned }
}
