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
import { brandForHost, HOST_BRAND } from '../../src/brandHosts.js'

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

// THE BRAND OF A REQUEST WITH NO REQUESTER.
//
// 15 Oct 2026. The queue read `coach_push_state` has not been called ONCE in
// the last 23 hours of Supabase edge logs, against 23 scheduled runs — so this
// function is not "running and deciding not to send", which is what an empty
// `coach_notifications` on its own was consistent with. It is failing before it
// ever reads the queue, or not running at all.
//
// This is the most likely reason, and it predates the 14 Oct header fix. The
// brand came from the Host header and nothing else, and a SCHEDULED invocation
// has no requester — Netlify synthesises the event. No host, no brand, and the
// handler then refuses with a 400 before touching the database, every hour,
// silently. A manual call with a real host resolved the brand fine, which is
// exactly why the fault never showed up when it was probed by hand.
//
// So on a scheduled run the brand comes from the SITE, which is the only thing
// that can know it: each brand has its own Netlify site and its own cron, and
// the site's own identity is not caller-supplied — making this strictly more
// trustworthy than the header, not less. The Host header is still what decides
// a hand-made call.
const KNOWN_BRANDS = new Set(Object.values(HOST_BRAND))

export function brandFromSite() {
  // BRAND is set per site, but it is scoped to `builds` on some of them and so
  // may be absent here. Validated against the known slugs rather than trusted.
  const direct = String(process.env.BRAND || '').trim().toLowerCase()
  if (KNOWN_BRANDS.has(direct)) return { brand: direct, from: 'BRAND' }

  // URL is the site's primary address, injected by Netlify.
  let host = ''
  try { host = process.env.URL ? new URL(process.env.URL).host : '' } catch { /* not a URL */ }
  const fromUrl = brandForHost(host, null)
  if (fromUrl) return { brand: fromUrl, from: 'URL' }

  const fromName = brandForHost(`${String(process.env.SITE_NAME || '').trim()}.netlify.app`, null)
  if (fromName) return { brand: fromName, from: 'SITE_NAME' }

  return { brand: null, from: 'none' }
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
  //
  // `|| !event.body` used to be part of this, and it was a hole: a POST with an
  // empty body is indistinguishable from Netlify's own invocation, so ANYONE
  // could trigger a real send run against every client in the queue, with no
  // secret, just by curling the URL. Confirmed live on 14 Oct — it returned
  // `enabled: true, dryRun: false` and ran the loop.
  //
  // Now the header is the only thing that marks an invocation as the cron's. If
  // Netlify ever stops sending it the schedule starts failing with a 401, which
  // is noisy and safe; the old version failed open, which was quiet and not.
  const scheduled = !!(event.headers?.['x-nf-event'] || event.headers?.['X-Nf-Event'])

  if (!scheduled && (!SECRET || body.secret !== SECRET)) return json(401, { error: 'no' })
  if (!SECRET) return json(503, { error: 'NUDGE_CRON_SECRET is not set.' })

  let brand = brandForHost(event.headers?.host || '', null)
  let brandFrom = brand ? 'host' : null
  if (!brand && scheduled) {
    const site = brandFromSite()
    brand = site.brand
    brandFrom = site.from
  }
  if (!brand) {
    // Without a brand there is no safe recipient set, so this refuses rather
    // than falling back to "everyone".
    return json(400, { error: 'Brand could not be resolved.', scheduled, brandFrom: 'none' })
  }
  // A line per scheduled run, so "is the cron even firing?" is answerable from
  // the function log without a database write. It was not answerable before:
  // the only evidence a run left behind was a notification, and a run that
  // refused itself at the brand check left nothing at all.
  if (scheduled) console.log('coach-notify scheduled run', JSON.stringify({ brand, brandFrom, siteUrl: process.env.URL || null }))

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
    brand, brandFrom, day, hour, enabled: ENABLED, dryRun,
    inQueue: rows.length,
    sent, pruned,
    decisions,
  })
}

// Hourly, so a client's preferred hour can be any hour in their own day. The
// rules only produce a candidate at that hour, and quiet hours apply on top.
export const config = { schedule: '7 * * * *' }

export default handler
