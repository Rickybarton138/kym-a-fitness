// Should this notification be sent at all?
//
// PURE, and separated from the sender on purpose: every interesting decision
// here — quiet hours, frequency, "they already did it", "we already said that" —
// is a rule that can be got wrong silently, and a test is the only way to know.
// The sender does the network; this decides.
//
// The brand/account boundary is the one that matters most. The existing nudge
// RPCs (`nudges_due`, `daily_reminders_due`, `coach_alerts_due`) take only a
// shared secret and return EVERY brand's clients, which is why Rick.Fit's site
// can already push to Kim's and Paul's clients. Nothing here inherits that: a
// candidate carries its brand and coach, and recipientAllowed() refuses anything
// that does not match the sender's own brand.

import { inQuietHours, londonDay } from './coachTime.js'

export const CATEGORIES = {
  session_due: { label: 'An approaching session', default: true },
  follow_up: { label: 'A follow-up I asked for', default: true },
  review_ready: { label: 'The weekly review is ready', default: true },
  food_gap: { label: 'Nothing logged by the afternoon', default: false },
}

export const DEFAULT_PREFS = {
  enabled: false,
  categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, v.default])),
  timezone: 'Europe/London',
  quiet_from: '21:30',
  quiet_to: '07:30',
  preferred_hour: 8,
  max_per_day: 2,
}

export function withDefaults(prefs) {
  const p = prefs || {}
  return {
    ...DEFAULT_PREFS,
    ...p,
    categories: { ...DEFAULT_PREFS.categories, ...(p.categories || {}) },
  }
}

/**
 * A notification is only allowed to a recipient on the SENDER's own brand, and
 * only to the account it is addressed to.
 *
 * `sender` is the brand the sending site is serving. `candidate` carries the
 * client and the brand its subscription belongs to. A mismatch is not filtered
 * quietly — it is returned as a refusal with a reason, so a wiring mistake shows
 * up in the ledger instead of landing on a stranger's phone.
 */
export function recipientAllowed(candidate, sender) {
  if (!candidate?.clientId) return { ok: false, reason: 'no-client' }
  if (!sender?.brand) return { ok: false, reason: 'sender-brand-unknown' }
  if (!candidate.brand) return { ok: false, reason: 'recipient-brand-unknown' }
  if (candidate.brand !== sender.brand) return { ok: false, reason: 'brand-mismatch' }
  if (sender.coachId && candidate.coachId && candidate.coachId !== sender.coachId) {
    return { ok: false, reason: 'coach-mismatch' }
  }
  return { ok: true }
}

/**
 * The full decision for one candidate.
 *
 * candidate: { clientId, brand, coachId, category, dedupeKey, body, url,
 *              completed, dismissed, snoozedUntil }
 * state:     { prefs, sentToday, alreadySent: Set<dedupeKey> }
 *
 * Returns { send: boolean, reason } — a reason either way, because "why did I
 * not get that" is the question that gets asked.
 */
export function shouldSend(candidate, state, now = new Date()) {
  const prefs = withDefaults(state.prefs)
  const sentToday = state.sentToday || 0
  const already = state.alreadySent || new Set()

  if (!prefs.enabled) return { send: false, reason: 'notifications-off' }
  if (!candidate.category || !(candidate.category in CATEGORIES)) {
    return { send: false, reason: 'unknown-category' }
  }
  if (!prefs.categories[candidate.category]) return { send: false, reason: 'category-off' }

  // Already done is the most important suppression: a reminder to train, sent
  // after they trained, is worse than no reminder at all.
  if (candidate.completed) return { send: false, reason: 'already-done' }
  if (candidate.dismissed) return { send: false, reason: 'dismissed' }
  if (candidate.snoozedUntil && new Date(candidate.snoozedUntil) > now) {
    return { send: false, reason: 'snoozed' }
  }

  // Deduplication. The key carries the day, so the same nudge cannot go twice
  // today but can go again tomorrow.
  if (!candidate.dedupeKey) return { send: false, reason: 'no-dedupe-key' }
  if (already.has(candidate.dedupeKey)) return { send: false, reason: 'duplicate' }

  if (inQuietHours(now, prefs.quiet_from, prefs.quiet_to)) return { send: false, reason: 'quiet-hours' }
  if (sentToday >= prefs.max_per_day) return { send: false, reason: 'daily-limit' }

  return { send: true, reason: 'ok' }
}

/** The dedupe key for a category on a day. Day-scoped so tomorrow is a new ask. */
export function dedupeKey(category, day, suffix = '') {
  return [category, day, suffix].filter(Boolean).join(':')
}

/**
 * Turn a coaching context into the notifications it justifies.
 *
 * Deterministic, and it refuses to invent an occasion: a session reminder needs
 * a planned session that is not done, a review reminder needs a complete week
 * with no review saved. `hour` is the London hour, so a reminder lands at a
 * civil time rather than a UTC one.
 */
export function candidatesFor(ctx, { brand, coachId, hour, preferredHour = 8 }) {
  const day = ctx.today || londonDay()
  const out = []

  const planned = ctx.training?.plannedToday
  if (planned && !ctx.training.completedToday && hour === preferredHour) {
    out.push({
      clientId: ctx.clientId, brand, coachId,
      category: 'session_due',
      dedupeKey: dedupeKey('session_due', day),
      body: `${planned.title} is on today.`,
      url: '/?screen=train',
      completed: false,
    })
  }

  if (ctx.review?.available && !ctx.review.exists && hour === preferredHour) {
    out.push({
      clientId: ctx.clientId, brand, coachId,
      category: 'review_ready',
      dedupeKey: dedupeKey('review_ready', ctx.review.periodStart),
      body: 'Your week is ready to look at.',
      url: '/?screen=review',
      completed: false,
    })
  }

  if (ctx.nutrition && !ctx.nutrition.today.logged && hour >= 14 && hour <= 16) {
    out.push({
      clientId: ctx.clientId, brand, coachId,
      category: 'food_gap',
      dedupeKey: dedupeKey('food_gap', day),
      body: 'Nothing logged yet today.',
      url: '/?screen=food',
      completed: ctx.nutrition.today.logged,
    })
  }

  return out
}
