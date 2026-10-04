import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldSend, recipientAllowed, candidatesFor, dedupeKey, withDefaults, DEFAULT_PREFS } from '../src/coachNotify.js'
import { buildContext } from '../src/coachContext.js'
import * as f from './coach-fixtures.mjs'

const NOON = new Date('2026-10-07T11:00:00Z')   // 12:00 London
const NIGHT = new Date('2026-10-07T21:30:00Z')  // 22:30 London, inside quiet hours
const on = (over = {}) => withDefaults({ enabled: true, categories: { session_due: true, review_ready: true, food_gap: true }, ...over })

const candidate = (over = {}) => ({
  clientId: f.CLIENT, brand: 'ricky', coachId: f.COACH,
  category: 'session_due', dedupeKey: dedupeKey('session_due', f.TODAY),
  body: 'Session today.', completed: false, ...over,
})

test('notifications are off until switched on', () => {
  assert.equal(DEFAULT_PREFS.enabled, false)
  assert.equal(shouldSend(candidate(), { prefs: {} }, NOON).reason, 'notifications-off')
})

test('an already-completed action is never reminded about', () => {
  const r = shouldSend(candidate({ completed: true }), { prefs: on() }, NOON)
  assert.equal(r.send, false)
  assert.equal(r.reason, 'already-done')
})

test('dismissed and snoozed both suppress, and a lapsed snooze does not', () => {
  assert.equal(shouldSend(candidate({ dismissed: true }), { prefs: on() }, NOON).reason, 'dismissed')
  assert.equal(shouldSend(candidate({ snoozedUntil: '2026-10-07T18:00:00Z' }), { prefs: on() }, NOON).reason, 'snoozed')
  assert.equal(shouldSend(candidate({ snoozedUntil: '2026-10-07T09:00:00Z' }), { prefs: on() }, NOON).send, true,
    'a snooze that has expired stops suppressing')
})

test('the same notification cannot go twice today but can go tomorrow', () => {
  const c = candidate()
  const sent = new Set([c.dedupeKey])
  assert.equal(shouldSend(c, { prefs: on(), alreadySent: sent }, NOON).reason, 'duplicate')
  // Tomorrow's key is a different key.
  const tomorrow = candidate({ dedupeKey: dedupeKey('session_due', '2026-10-08') })
  assert.equal(shouldSend(tomorrow, { prefs: on(), alreadySent: sent }, NOON).send, true)
})

test('a candidate with no dedupe key is refused rather than risked', () => {
  assert.equal(shouldSend(candidate({ dedupeKey: null }), { prefs: on() }, NOON).reason, 'no-dedupe-key')
})

test('quiet hours and the daily cap hold', () => {
  assert.equal(shouldSend(candidate(), { prefs: on() }, NIGHT).reason, 'quiet-hours')
  assert.equal(shouldSend(candidate(), { prefs: on({ max_per_day: 2 }), sentToday: 2 }, NOON).reason, 'daily-limit')
  assert.equal(shouldSend(candidate(), { prefs: on({ max_per_day: 2 }), sentToday: 1 }, NOON).send, true)
  assert.equal(shouldSend(candidate(), { prefs: on({ max_per_day: 0 }) }, NOON).reason, 'daily-limit')
})

test('a category the person turned off stays off', () => {
  const prefs = on({ categories: { session_due: false, review_ready: true } })
  assert.equal(shouldSend(candidate(), { prefs }, NOON).reason, 'category-off')
  assert.equal(shouldSend(candidate({ category: 'review_ready', dedupeKey: 'review_ready:x' }), { prefs }, NOON).send, true)
})

test('an unknown category is refused', () => {
  assert.equal(shouldSend(candidate({ category: 'marketing' }), { prefs: on() }, NOON).reason, 'unknown-category')
})

test('a recipient on another brand is refused, with a reason', () => {
  const sender = { brand: 'ricky', coachId: f.COACH }
  assert.deepEqual(recipientAllowed({ clientId: f.CLIENT, brand: 'ricky', coachId: f.COACH }, sender), { ok: true })

  const other = recipientAllowed({ clientId: f.OTHER, brand: 'kim', coachId: 'kim-coach' }, sender)
  assert.equal(other.ok, false)
  assert.equal(other.reason, 'brand-mismatch')

  // This is the existing global-queue bug, asserted so it cannot come back:
  // a subscription with no brand on it must not be treated as "probably ours".
  assert.equal(recipientAllowed({ clientId: f.CLIENT, brand: null }, sender).reason, 'recipient-brand-unknown')
  assert.equal(recipientAllowed({ clientId: f.CLIENT, brand: 'ricky' }, { brand: null }).reason, 'sender-brand-unknown')
  assert.equal(recipientAllowed({ clientId: null, brand: 'ricky' }, sender).reason, 'no-client')
})

test('a different coach on the same brand is refused too', () => {
  const r = recipientAllowed(
    { clientId: f.CLIENT, brand: 'ricky', coachId: 'someone-else' },
    { brand: 'ricky', coachId: f.COACH },
  )
  assert.equal(r.reason, 'coach-mismatch')
})

test('candidates are only generated for occasions that exist', () => {
  const ctx = buildContext(f.raw(), { today: f.TODAY, now: f.NOON })
  ctx.clientId = f.CLIENT

  // At the preferred hour, with a planned session not done: one session nudge.
  const atEight = candidatesFor(ctx, { brand: 'ricky', coachId: f.COACH, hour: 8, preferredHour: 8 })
  assert.deepEqual(atEight.map((c) => c.category), ['session_due'])
  assert.equal(atEight[0].dedupeKey, `session_due:${f.TODAY}`)

  // An hour that is not theirs produces nothing.
  assert.deepEqual(candidatesFor(ctx, { brand: 'ricky', hour: 11, preferredHour: 8 }), [])

  // Trained already: no session nudge at any hour.
  const done = buildContext(
    { ...f.raw(), completions: [...f.completions, { completed_on: f.TODAY, source: 'guided', created_at: `${f.TODAY}T08:00:00Z` }] },
    { today: f.TODAY, now: f.NOON },
  )
  done.clientId = f.CLIENT
  assert.deepEqual(candidatesFor(done, { brand: 'ricky', hour: 8, preferredHour: 8 }), [])
})

test('the food-gap nudge only fires when nothing is logged, in the afternoon', () => {
  const empty = buildContext({ ...f.raw(), nutrition: [], foodDays: [] }, { today: f.TODAY, now: f.NOON })
  empty.clientId = f.CLIENT
  assert.ok(candidatesFor(empty, { brand: 'ricky', hour: 15 }).some((c) => c.category === 'food_gap'))
  assert.ok(!candidatesFor(empty, { brand: 'ricky', hour: 19 }).some((c) => c.category === 'food_gap'))

  const logged = buildContext(f.raw(), { today: f.TODAY, now: f.NOON })
  logged.clientId = f.CLIENT
  assert.ok(!candidatesFor(logged, { brand: 'ricky', hour: 15 }).some((c) => c.category === 'food_gap'))
})

test('the review nudge is keyed on the period, so it cannot repeat each day', () => {
  const ctx = buildContext(f.raw(), { today: f.TODAY, now: f.NOON })
  ctx.clientId = f.CLIENT
  ctx.review = { periodStart: '2026-09-28', periodEnd: '2026-10-04', available: true, exists: false }
  const [c] = candidatesFor(ctx, { brand: 'ricky', hour: 8, preferredHour: 8 }).filter((x) => x.category === 'review_ready')
  assert.equal(c.dedupeKey, 'review_ready:2026-09-28')

  ctx.review.exists = true
  assert.ok(!candidatesFor(ctx, { brand: 'ricky', hour: 8, preferredHour: 8 }).some((x) => x.category === 'review_ready'))
})
