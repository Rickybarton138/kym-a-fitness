import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContext, comparableSession } from '../src/coachContext.js'
import { nextAction, candidateActions, feedbackFor, adjustmentFor, avoidTerms, PRIORITIES } from '../src/coachRules.js'
import * as f from './coach-fixtures.mjs'

// 11:00Z on a Wednesday in BST = 12:00 London. Several rules are hour-gated, so
// the hour is always stated explicitly rather than left to the clock.
const at = (iso) => new Date(iso)
const ctxAt = (raw, iso = f.NOON) => buildContext(raw, { today: f.TODAY, now: iso, brand: 'ricky' })

test('a session open on this device outranks everything', () => {
  const ctx = ctxAt(f.raw())
  const a = nextAction(ctx, { resumeSessionId: 'abc', resumeTitle: 'Lower A — Hinge' }, at(f.NOON))
  assert.equal(a.key, 'resume_session')
  assert.equal(a.priority, PRIORITIES.resume_session)
  // Without the device signal the same context suggests the check-in instead.
  assert.equal(nextAction(ctx, {}, at(f.NOON)).key, 'readiness')
})

test('readiness comes before the session, and drops out once given', () => {
  const ctx = ctxAt(f.raw())
  assert.equal(nextAction(ctx, {}, at(f.NOON)).key, 'readiness')

  const checked = ctxAt({
    ...f.raw(),
    readiness: [{ client_id: f.CLIENT, checked_on: f.TODAY, sleep: 4, energy: 4, soreness: 1, minutes_available: 60, created_at: `${f.TODAY}T07:00:00Z` }],
  })
  assert.equal(nextAction(checked, {}, at(f.NOON)).key, 'start_session')
})

test('a completed session stops the app asking for it again', () => {
  const done = ctxAt({
    ...f.raw(),
    completions: [...f.completions, { completed_on: f.TODAY, source: 'guided', created_at: `${f.TODAY}T10:00:00Z` }],
  })
  const keys = candidateActions(done, {}, at(f.NOON)).map((a) => a.key)
  assert.ok(!keys.includes('start_session'), 'no "start your session" after it is logged')
  assert.ok(!keys.includes('readiness'))
  assert.equal(nextAction(done, {}, at(f.NOON)).key, 'rest')
})

test('nothing logged is only raised once the day is under way', () => {
  const nothing = { ...f.raw(), nutrition: [], foodDays: [] }
  const early = candidateActions(ctxAt(nothing, `${f.TODAY}T07:00:00Z`), {}, at(`${f.TODAY}T07:00:00Z`))
  assert.ok(!early.map((a) => a.key).includes('log_food'), 'not at 08:00 London')
  const later = candidateActions(ctxAt(nothing, `${f.TODAY}T13:00:00Z`), {}, at(`${f.TODAY}T13:00:00Z`))
  assert.ok(later.map((a) => a.key).includes('log_food'), 'yes at 14:00 London')
})

test('a missing step reading never produces a steps nudge', () => {
  const noSteps = ctxAt({ ...f.raw(), steps: [] }, `${f.TODAY}T16:00:00Z`)
  const keys = candidateActions(noSteps, {}, at(`${f.TODAY}T16:00:00Z`)).map((a) => a.key)
  assert.ok(!keys.includes('steps'), 'no reading is not zero steps')

  // A real reading well short of target does.
  const short = ctxAt(f.raw(), `${f.TODAY}T16:00:00Z`)
  assert.ok(candidateActions(short, {}, at(`${f.TODAY}T16:00:00Z`)).map((a) => a.key).includes('steps'))
})

test('the protein rule needs a target, a log and the evening still to come', () => {
  const afternoon = `${f.TODAY}T14:00:00Z` // 15:00 London
  const ctx = ctxAt(f.raw(), afternoon)
  const keys = candidateActions(ctx, {}, at(afternoon)).map((a) => a.key)
  assert.ok(keys.includes('protein_gap'), '85g of 180g with the evening left')

  const noTarget = ctxAt({ ...f.raw(), targets: null, targetHistory: [] }, afternoon)
  assert.ok(!candidateActions(noTarget, {}, at(afternoon)).map((a) => a.key).includes('protein_gap'))

  const late = `${f.TODAY}T21:00:00Z` // 22:00 London
  assert.ok(!candidateActions(ctxAt(f.raw(), late), {}, at(late)).map((a) => a.key).includes('protein_gap'))
})

test('a dismissed suggestion steps aside for the next one down', () => {
  const ctx = ctxAt(f.raw())
  const first = nextAction(ctx, {}, at(f.NOON))
  const second = nextAction(ctx, { dismissedKeys: [first.key] }, at(f.NOON))
  assert.notEqual(second.key, first.key)
  assert.ok(second.priority > first.priority)
})

test('an empty account still gets something honest to do', () => {
  const bare = buildContext({ profile: f.profile, nutrition: [], foodDays: [], completions: [], plans: [], programme: null, steps: [], readiness: [] },
    { today: f.TODAY, now: f.NOON })
  const a = nextAction(bare, {}, at(f.NOON))
  assert.ok(['log_food', 'start_session', 'rest'].includes(a.key))
  assert.ok(a.title && a.reason && a.actions.length > 0)
  assert.ok(Array.isArray(a.evidence))
})

test('the weekly review is offered once and not while the week is still running', () => {
  const ctx = ctxAt(f.raw())
  ctx.review = { periodStart: '2026-09-28', periodEnd: '2026-10-04', available: true, exists: false }
  assert.ok(candidateActions(ctx, {}, at(f.NOON)).map((a) => a.key).includes('weekly_review'))

  ctx.review = { ...ctx.review, exists: true }
  assert.ok(!candidateActions(ctx, {}, at(f.NOON)).map((a) => a.key).includes('weekly_review'))

  ctx.review = { ...ctx.review, exists: false, available: false }
  assert.ok(!candidateActions(ctx, {}, at(f.NOON)).map((a) => a.key).includes('weekly_review'))
})

test('workout feedback compares only with a comparable COMPLETED session', () => {
  const ctx = ctxAt(f.raw())
  const session = { id: 'now', title: 'Lower A — Hinge', focus: 'Hamstrings, glutes', day: f.TODAY,
    exercises: [{ name: 'Romanian Deadlift', sets: 4, reps: '10', weight: 80 }],
    volume: { kg: 3200, sets: 4, partial: false },
    split: { lifting: [{ name: 'Romanian Deadlift' }], cardio: [] } }
  const prev = { id: 'then', title: 'Lower A — Hinge', focus: 'Hamstrings, glutes', day: '2026-09-30',
    volume: { kg: 2800, sets: 4, partial: false }, matchedOn: 'title' }

  const fb = feedbackFor('workout', ctx, { session, comparable: prev })
  assert.equal(fb.comparison.deltaKg, 400)
  assert.equal(fb.comparison.deltaPct, 14)
  assert.ok(fb.nextFocus, 'a real comparison earns a next-session suggestion')

  // With nothing to compare against it says so instead of inventing a trend.
  const alone = feedbackFor('workout', ctx, { session, comparable: null })
  assert.equal(alone.comparison, null)
  assert.equal(alone.nextFocus, null)
  assert.match(alone.facts.join(' '), /nothing to compare/i)
})

test('partial weight logging blocks a volume comparison rather than faking one', () => {
  const ctx = ctxAt(f.raw())
  const session = { id: 'now', title: 'Upper A — Push', day: f.TODAY, exercises: [],
    volume: { kg: 1000, sets: 6, partial: true }, split: { lifting: [{ name: 'Press-up' }], cardio: [] } }
  const prev = { id: 'then', title: 'Upper A — Push', day: '2026-09-29', volume: { kg: 2000, sets: 6, partial: false }, matchedOn: 'title' }
  const fb = feedbackFor('workout', ctx, { session, comparable: prev })
  assert.equal(fb.comparison.deltaPct, null)
  assert.match(fb.comparison.text, /do not line up/)
})

test('lifting and cardio are reported separately, not averaged', () => {
  const ctx = ctxAt(f.raw())
  const session = { id: 'mixed', title: 'Mixed', day: f.TODAY, exercises: [],
    volume: { kg: 2000, sets: 4, partial: false },
    split: { lifting: [{ name: 'Squat' }], cardio: [{ name: 'Rower', reps: '10 min' }] } }
  const fb = feedbackFor('workout', ctx, { session, comparable: null })
  const text = fb.facts.join(' | ')
  assert.match(text, /Lifting: 1 exercises/)
  assert.match(text, /Cardio: Rower 10 min/)
})

test('meal feedback respects a saved allergy and flags an open day', () => {
  const ctx = ctxAt(f.raw())
  const fb = feedbackFor('meal', ctx)
  assert.equal(fb.incomplete, true, 'today is not marked complete')
  assert.match(fb.facts.join(' '), /not marked complete/)
  const titles = fb.suggestions.map((s) => s.title)
  assert.ok(!titles.includes('Prawn stir fry'), 'shellfish is in saved memory')
  assert.ok(!titles.includes('Beef chilli'), '1800 kcal does not fit what is left')
  assert.ok(titles.includes('Chicken and rice'))
})

test('allergy terms are read from memory and from the free-text health field', () => {
  const ctx = ctxAt(f.raw())
  const terms = avoidTerms(ctx).join(' ').toLowerCase()
  assert.match(terms, /shellfish/)

  const noMemory = ctxAt({ ...f.raw(), memory: [] })
  // "allergic to shellfish" in profile.health_conditions still catches it.
  assert.match(avoidTerms(noMemory).join(' ').toLowerCase(), /shellfish/)
})

test('meal feedback with no targets says so instead of comparing with nothing', () => {
  const ctx = ctxAt({ ...f.raw(), targets: null, targetHistory: [] })
  const fb = feedbackFor('meal', ctx)
  assert.match(fb.facts.join(' '), /No targets saved/)
  assert.deepEqual(fb.suggestions, [])
})

test('readiness adjusts the session rather than rewriting it', () => {
  const ctx = ctxAt(f.raw())

  const fine = adjustmentFor(ctx, { sleep: 4, energy: 4, soreness: 1, minutes: 60 })
  assert.equal(fine.verdict, 'keep')
  assert.deepEqual(fine.changes, [])

  const wrecked = adjustmentFor(ctx, { sleep: 1, energy: 2, soreness: 4, minutes: 60 })
  assert.equal(wrecked.verdict, 'move')
  assert.ok(wrecked.changes.length > 0)

  const rushed = adjustmentFor(ctx, { sleep: 4, energy: 4, soreness: 1, minutes: 20 })
  assert.equal(rushed.verdict, 'shorten')

  const sore = adjustmentFor(ctx, { sleep: 4, energy: 4, soreness: 5, minutes: 60 })
  assert.equal(sore.verdict, 'adjust')

  // Nothing planned, nothing to adjust — and no invented session.
  const rest = adjustmentFor(buildContext({ ...f.raw(), programme: null }, { today: f.TODAY, now: f.NOON }), { sleep: 2, energy: 2 })
  assert.equal(rest.verdict, 'none')
})

test('readiness never invents a reading it was not given', () => {
  const ctx = ctxAt(f.raw())
  const partial = adjustmentFor(ctx, { sleep: 3, energy: 3 })
  const facts = partial.facts.join(' ')
  assert.match(facts, /Sleep 3\/5/)
  assert.ok(!/Soreness/.test(facts), 'soreness was not given, so it is not reported')
  assert.ok(!/minutes/.test(facts))
})

test('feedback for an unknown kind is null, not a guess', () => {
  assert.equal(feedbackFor('vibes', ctxAt(f.raw())), null)
})

test('a shellfish allergy does not quietly exclude fish', () => {
  // Found in the preview harness: "Kept clear of: shellfish, fish". The
  // free-text scan matched the word `fish` INSIDE `shellfish`, so somebody who
  // can eat salmon stopped being offered any.
  const ctx = ctxAt({ ...f.raw(), memory: [] })
  const terms = avoidTerms(ctx).map((t) => t.toLowerCase())
  assert.ok(terms.includes('shellfish'))
  assert.ok(!terms.includes('fish'), terms.join(', '))

  // A real fish allergy is still caught.
  const fishy = ctxAt({ ...f.raw(), memory: [], profile: { ...f.profile, health_conditions: 'allergic to fish' } })
  assert.ok(avoidTerms(fishy).map((t) => t.toLowerCase()).includes('fish'))
})

test('overlapping avoid terms are not listed twice', () => {
  const ctx = ctxAt(f.raw()) // memory says "shellfish and prawns", free text says "shellfish"
  const terms = avoidTerms(ctx)
  assert.equal(terms.length, new Set(terms).size)
  assert.ok(!terms.some((t) => terms.some((o) => o !== t && o.toLowerCase().includes(t.toLowerCase()))),
    'a term covered by a longer one is dropped: ' + terms.join(' / '))
})
