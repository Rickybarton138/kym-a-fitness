import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContext, targetForDay, classifyExercises, liftingVolume, comparableSession, fingerprint, evidenceLines, sumLogs } from '../src/coachContext.js'
import { targetOn } from '../src/lib.js'
import * as f from './coach-fixtures.mjs'

const ctx = () => buildContext(f.raw(), { today: f.TODAY, now: f.NOON, brand: 'ricky' })

test('planned is not completed: today has a session and a plan row, and is still not done', () => {
  const c = ctx()
  assert.equal(c.training.plannedToday.title, 'Lower A — Hinge')
  // There is a workout_plans row for today (p-today) but no completion for it.
  assert.equal(c.training.completedToday, false)
  // The last COMPLETED session is the one with a completion row, not the newest plan.
  assert.equal(c.training.lastCompleted.day, '2026-09-30')
})

test('missing is not zero', () => {
  const c = ctx()
  // Steps today has a real reading of 2000.
  assert.equal(c.daily.steps.today, 2000)
  // 5 Oct is a real zero and counts in the average; the days with no row do not.
  assert.equal(c.daily.steps.daysKnown, 2)
  assert.equal(c.daily.steps.weekAverage, 1000)

  // Drop the slice entirely and it is null, not an empty object.
  const without = buildContext(f.raw(['steps']), { today: f.TODAY, now: f.NOON })
  assert.equal(without.daily, null)

  // A client with no readings at all gets null and an entry in `missing`.
  const empty = buildContext({ ...f.raw(), steps: [] }, { today: f.TODAY, now: f.NOON })
  assert.equal(empty.daily.steps.today, null)
  assert.ok(empty.missing.includes('steps'))
})

test('a past day is scored against the target that was in force then', () => {
  const c = ctx()
  const oct5 = c.nutrition.week.days.find((d) => d.day === '2026-10-05')
  assert.equal(oct5.targetKcal, 2100, 'after the 1 Oct change')
  const sept = targetForDay(f.targetHistory, '2026-09-15', f.targets)
  assert.equal(sept.calories, 2400, 'before it')
  assert.equal(sept.source, 'history')
})

test('targetForDay agrees with the targetOn already used by the app', () => {
  for (const day of ['2026-07-01', '2026-08-15', '2026-10-05', f.TODAY]) {
    const mine = targetForDay(f.targetHistory, day, f.targets)
    const theirs = targetOn(f.targetHistory, day, f.targets)
    assert.equal(mine.calories, Number(theirs.calories), `calories disagree on ${day}`)
    assert.equal(mine.protein_g, Number(theirs.protein_g), `protein disagrees on ${day}`)
  }
})

test('adherence counts closed days only, and reports its coverage', () => {
  const c = ctx()
  // Week began Mon 5 Oct; today is Wed 7 Oct, so three days have happened.
  assert.equal(c.nutrition.week.daysElapsed, 3)
  assert.equal(c.nutrition.week.daysLogged, 2)
  assert.equal(c.nutrition.week.daysComplete, 1)
  // One closed day, 2000 kcal against a 2100 target: inside 10%, so 100%.
  assert.equal(c.nutrition.week.adherence, 100)

  // No closed days at all means adherence is unknown, not zero.
  const open = buildContext({ ...f.raw(), foodDays: [] }, { today: f.TODAY, now: f.NOON })
  assert.equal(open.nutrition.week.daysComplete, 0)
  assert.equal(open.nutrition.week.adherence, null)
})

test('lifting and cardio are kept apart', () => {
  const { lifting, cardio } = classifyExercises([
    { name: 'Romanian Deadlift', sets: 4, reps: '8', weight: 80 },
    { name: 'Easy run', sets: 1, reps: '5 km @ easy' },
    { name: 'Rower', sets: 1, reps: '10 min' },
    { name: 'Plank', sets: 3, reps: '45s' },
  ])
  assert.deepEqual(lifting.map((e) => e.name), ['Romanian Deadlift', 'Plank'])
  assert.deepEqual(cardio.map((e) => e.name), ['Easy run', 'Rower'])
})

test('volume is null rather than wrong when weights are missing', () => {
  const full = liftingVolume([{ name: 'Squat', sets: 3, reps: '10', weight: 100 }])
  assert.equal(full.kg, 3000)
  assert.equal(full.partial, false)

  const partial = liftingVolume([
    { name: 'Squat', sets: 3, reps: '10', weight: 100 },
    { name: 'Press-up', sets: 3, reps: '12' },
  ])
  assert.equal(partial.kg, 3000)
  assert.equal(partial.partial, true, 'flagged, so nothing claims it is the whole session')

  const none = liftingVolume([{ name: 'Press-up', sets: 3, reps: '12' }])
  assert.equal(none.kg, null)
})

test('a session is only compared with a completed one of the same kind', () => {
  const c = ctx()
  const session = c.training.lastCompleted
  const prev = comparableSession(session, c.training.recent)
  // p-today is the same title and NEWER, but it was never completed, so it is
  // not in `recent` at all and cannot be the comparison.
  assert.equal(prev, null, 'nothing earlier of the same kind is completed')

  // Give it an earlier completed session of the same title and it matches.
  const withHistory = [...c.training.recent, { id: 'older', title: 'Lower A — Hinge', focus: 'Hamstrings, glutes', day: '2026-09-23', volume: { kg: 2000, sets: 7, partial: false }, exercises: [] }]
  const found = comparableSession(session, withHistory)
  assert.equal(found.day, '2026-09-23')
  assert.equal(found.matchedOn, 'title')
})

test('freshness and age are reported per slice', () => {
  const c = ctx()
  assert.equal(c.nutrition.freshAt, `${f.TODAY}T11:30:00Z`)
  assert.equal(c.ageMinutes.nutrition, 0, 'logged 30 minutes before noon, read at noon… 11:30Z is 11:00Z + 30')
  assert.ok(c.ageMinutes.training > 0)
  assert.equal(c.timezone, 'Europe/London')
})

test('the fingerprint moves when the facts move and not otherwise', () => {
  const a = fingerprint(ctx())
  const again = fingerprint(buildContext(f.raw(), { today: f.TODAY, now: '2026-10-07T13:00:00Z', brand: 'ricky' }))
  assert.equal(a, again, 'a later read of the same facts is the same fingerprint')

  const trained = buildContext(
    { ...f.raw(), completions: [...f.completions, { completed_on: f.TODAY, source: 'guided', created_at: `${f.TODAY}T12:00:00Z` }] },
    { today: f.TODAY, now: f.NOON, brand: 'ricky' },
  )
  assert.notEqual(a, fingerprint(trained))

  const otherBrand = fingerprint(buildContext(f.raw(), { today: f.TODAY, now: f.NOON, brand: 'kim' }))
  assert.notEqual(a, otherBrand, 'brand is part of the key, so caches cannot cross')
})

test('evidence lines never claim something the rows do not say', () => {
  const lines = evidenceLines(ctx()).join(' | ')
  assert.match(lines, /Training logged today: no/)
  assert.match(lines, /Food today: 2 items/)
  assert.match(lines, /still logging/)
  assert.ok(!/Training logged today: yes/.test(lines))
})

test('sumLogs treats absent macros as zero contributions, not NaN', () => {
  const out = sumLogs([{ calories: 100 }, { protein_g: 10 }])
  assert.deepEqual(out, { calories: 100, protein_g: 10, carbs_g: 0, fat_g: 0, fibre_g: 0 })
})
