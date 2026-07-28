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
