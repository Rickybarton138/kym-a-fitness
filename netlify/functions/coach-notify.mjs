// The proactive sender.
//
// THE HAZARD THIS IS BUILT AROUND. The nudge RPCs this app already has
// (`nudges_due`, `daily_reminders_due`, `coach_alerts_due`) take only a shared
// secret and return EVERY brand's clients, and every brand's site runs its own
// hourly copy against that one global queue. That is why Rick.Fit's deploy can
// push to Kim's and Paul's clients today. This function does not touch them. It
// calls `coach_push_state(secret, brand, ...)`, which is scoped three ways: the
// secret, the brand, and an opt-in row that defaults to off.
//
// Scheduling is decided HERE rather than in SQL, with src/programSchedule.js —
// the same code the app uses, already tested. Whether a session falls today
// involves week maths, day_map remapping and repeat handling, and a second copy
// of that in PL/pgSQL would drift.
//
// A notification is CLAIMED before it is sent: the row goes in first, and the
// unique index on (client_id, brand, dedupe_key) decides who wins. Two instances
// firing in the same minute both call claim; only one gets true. Remembering in
// a loop variable would not survive that.

import webpush from 'web-push'
import { shouldSend, withDefaults, recipientAllowed, candidatesFor } from '../../src/coachNotify.js'
import { londonDay, londonHour, lastCompleteWeek, weekStart } from '../../src/coachTime.js'
import { sessionForDay } from '../../src/programSchedule.js'
import { brandForHost } from '../../src/brandHosts.js'

const SUPABASE_URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const SUPABASE_KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
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

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`${fn} ${res.status}`)
  return res.json()
}

// Midday UTC of a London civil day — programSchedule reads dates with host-local
// getters and this runs in UTC, so noon lands on the right date either way.
function probeDate(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

export const handler = async (event) => {
  const body = (() => { try { return JSON.parse(event.body || '{}') } catch { return {} } })()
  // Netlify invokes a scheduled function itself, with an `x-nf-event` header and
  // no body of its own. Anything that arrives with a body is somebody calling it
  // by hand, and that needs the secret. The empty-body case is checked too
  // rather than trusting one header to always be there.
  const scheduled = !!(event.headers?.['x-nf-event'] || event.headers?.['X-Nf-Event']) || !event.body

  if (!scheduled && (!SECRET || body.secret !== SECRET)) return json(401, { error: 'no' })
  if (!SECRET) return json(503, { error: 'NUDGE_CRON_SECRET is not set.' })

  const brand = brandForHost(event.headers?.host || '', null)
  if (!brand) {
    // Without a brand there is no safe recipient set, so this refuses rather
    // than falling back to "everyone".
    return json(400, { error: 'Brand could not be resolved from the host.' })
  }

  const now = new Date()
  const day = londonDay(now)
  const hour = londonHour(now)
  const period = lastCompleteWeek(day)
  const reviewAvailable = weekStart(day) > period.end

  // A dry run reports every decision and sends nothing. This is the mode to
  // read before switching anything on.
  const dryRun = body.dryRun === true || !ENABLED

  let rows = []
  try {
    rows = await rpc('coach_push_state', {
      p_secret: SECRET, p_brand: brand, p_day: day, p_period_start: period.start,
    })
  } catch (e) {
    return json(502, { error: 'Could not read the queue.', detail: String(e.message).slice(0, 80) })
  }

  const decisions = []
  let sent = 0, pruned = 0

  for (const row of rows) {
    const sender = { brand, coachId: null }
    const allowed = recipientAllowed(
      { clientId: row.client_id, brand, coachId: row.coach_id },
      sender,
    )
    if (!allowed.ok) {
      decisions.push({ client: row.client_id, send: false, reason: allowed.reason })
      continue
    }

    const prefs = withDefaults(row.prefs)

    // The minimal context the candidate rules need, built from the queue row.
    // Scheduling runs through the app's own code.
    const prog = row.programme || null
    const wrap = prog ? sessionForDay(prog, probeDate(day)) : null
    const ctx = {
      today: day,
      clientId: row.client_id,
      training: {
        plannedToday: wrap ? { title: wrap.sess.title, focus: wrap.sess.focus } : null,
        completedToday: !!row.trained_today,
      },
      nutrition: { today: { logged: !!row.logged_today } },
      review: {
        periodStart: period.start, periodEnd: period.end,
        available: reviewAvailable, exists: !!row.review_exists,
      },
    }

    const candidates = candidatesFor(ctx, {
      brand, coachId: row.coach_id, hour, preferredHour: prefs.preferred_hour,
    })

    for (const candidate of candidates) {
      const decision = shouldSend(candidate, {
        prefs,
        sentToday: row.sent_today || 0,
        alreadySent: new Set(row.sent_keys || []),
      }, now)

      decisions.push({ client: row.client_id, category: candidate.category, key: candidate.dedupeKey, ...decision })
      if (!decision.send || dryRun) continue

      // Claim first. If somebody else already has it, move on.
      const claimed = await rpc('coach_push_claim', {
        p_secret: SECRET, p_client: row.client_id, p_brand: brand,
        p_category: candidate.category, p_key: candidate.dedupeKey,
        p_body: candidate.body, p_url: candidate.url,
      })
      if (!claimed) { decisions.push({ client: row.client_id, send: false, reason: 'claimed-elsewhere' }); continue }

      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify({ title: 'Rick.Fit', body: candidate.body, url: candidate.url, tag: candidate.dedupeKey }),
        )
        await rpc('coach_push_settle', {
          p_secret: SECRET, p_client: row.client_id, p_brand: brand,
          p_key: candidate.dedupeKey, p_sent: true, p_suppressed: null,
        })
        sent++
      } catch (e) {
        // A dead subscription is pruned, as the existing senders do. The claim
        // row stays with a reason on it, so the ledger shows what happened.
        const gone = e.statusCode === 404 || e.statusCode === 410
        await rpc('coach_push_settle', {
          p_secret: SECRET, p_client: row.client_id, p_brand: brand,
          p_key: candidate.dedupeKey, p_sent: false,
          p_suppressed: gone ? 'subscription-gone' : `send-failed-${e.statusCode || 'unknown'}`,
        }).catch(() => {})
        if (gone) {
          await rpc('nudge_drop', { p_secret: SECRET, p_endpoint: row.endpoint }).catch(() => {})
          pruned++
        }
      }
    }
  }

  return json(200, {
    brand, day, hour, enabled: ENABLED, dryRun,
    inQueue: rows.length,
    sent, pruned,
    decisions,
  })
}

// Hourly, so a client's preferred hour can be any hour in their own day. The
// rules only produce a candidate at that hour, and quiet hours apply on top.
export const config = { schedule: '7 * * * *' }

export default handler
