// The proactive sender. OFF.
//
// This function has NO `export const config = { schedule: ... }`, which is how
// every other scheduled function in this repo opts in (`push-daily-reminder.mjs`
// carries `schedule: '0 * * * *'`). Without it Netlify never calls this, and it
// additionally refuses to send unless COACH_NOTIFY_ENABLED is set to 'true'.
// Both are deliberate: the brief says not to activate production notifications
// during development, and there is a specific hazard here worth being slow about.
//
// THE HAZARD. The existing nudge RPCs (`nudges_due`, `daily_reminders_due`,
// `coach_alerts_due`) take only a shared secret and return every brand's
// clients. Every brand's site runs its own hourly copy against that one global
// queue, which is why Rick.Fit's deploy can push to Kim's and Paul's clients
// today. Reusing that pattern for coaching notifications would put Rick.Fit's
// wording on a paying client's lock screen.
//
// So this function does not use those RPCs at all. It needs a brand-scoped
// SECURITY DEFINER RPC (`coach_push_due`, sketched in SETUP) that takes the
// brand and returns only that brand's subscriptions. Until that exists, a dry
// run reports what it WOULD send and sends nothing.
//
// Run a dry run with:
//   POST /.netlify/functions/coach-notify  { "secret": "...", "dryRun": true }

import webpush from 'web-push'
import { shouldSend, withDefaults, recipientAllowed, candidatesFor } from '../../src/coachNotify.js'
import { londonDay, londonHour } from '../../src/coachTime.js'
import { brandForHost } from '../../src/brandHosts.js'

const SECRET = process.env.NUDGE_CRON_SECRET
const ENABLED = process.env.COACH_NOTIFY_ENABLED === 'true'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@rick.fit',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const handler = async (event) => {
  const body = (() => { try { return JSON.parse(event.body || '{}') } catch { return {} } })()

  if (!SECRET || body.secret !== SECRET) return json(401, { error: 'no' })

  const brand = brandForHost(event.headers?.host || '', null)
  const now = new Date()
  const hour = londonHour(now)
  const day = londonDay(now)

  if (!brand) {
    return json(400, { error: 'Brand could not be resolved from the host, so there is no safe recipient set.' })
  }

  // Everything below runs; only the send is gated. A dry run is how this gets
  // reviewed before it is ever switched on.
  const dryRun = body.dryRun === true || !ENABLED

  // The brand-scoped queue. Deliberately not implemented against the existing
  // global RPCs — see the note at the top. `due` stays empty until the RPC in
  // SETUP exists, so a dry run today reports an empty, honest result rather
  // than a plausible-looking fake one.
  const due = []

  const decisions = []
  for (const row of due) {
    const sender = { brand, coachId: row.coach_id || null }
    const allowed = recipientAllowed(
      { clientId: row.client_id, brand: row.brand, coachId: row.coach_id },
      sender,
    )
    if (!allowed.ok) { decisions.push({ client: row.client_id, send: false, reason: allowed.reason }); continue }

    const prefs = withDefaults(row.prefs)
    const candidates = candidatesFor(row.ctx, {
      brand, coachId: row.coach_id, hour, preferredHour: prefs.preferred_hour,
    })
    for (const candidate of candidates) {
      const decision = shouldSend(candidate, {
        prefs,
        sentToday: row.sent_today || 0,
        alreadySent: new Set(row.sent_keys || []),
      }, now)
      decisions.push({ client: row.client_id, category: candidate.category, ...decision })
      if (!decision.send || dryRun) continue

      // The ledger row is written BEFORE the send, and its unique index on
      // (client_id, brand, dedupe_key) is what actually prevents a double —
      // relying on the loop to remember would not survive two instances
      // running the same minute.
      // (Write goes here, through the brand-scoped RPC, once that exists.)
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({ title: 'Rick.Fit', body: candidate.body, url: candidate.url, tag: candidate.dedupeKey }),
      )
    }
  }

  return json(200, {
    brand, day, hour,
    enabled: ENABLED,
    dryRun,
    due: due.length,
    decisions,
    blocked: due.length === 0
      ? 'No brand-scoped queue yet. coach_push_due must exist before this can send — see tasks/SETUP-coach-engine.md.'
      : null,
  })
}

export default handler
