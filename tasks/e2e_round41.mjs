// Paul, 6 Oct: "with sessions, when people go in, it shows what they did the
// week before, can we change that so it pulls the last recorded entry? Only
// because if they miss a session or skip an exercise one week it shows as empty
// the following week."
//
// Checking it rather than assuming: skipping a week and missing one ALREADY
// worked — the function walks back until it finds logged sets. What did not work
// is a session the coach wrote with target reps and weights that the client
// never did; that was indistinguishable from a performed one, so "last time"
// could hand the coach's prescription back as if it were a lift.
//
// Pure arithmetic over lifts.js, so no browser.
// Run: node tasks/e2e_round41.mjs
import { lastSetsByName } from '../src/lifts.js'
import { sessionDateLabel } from '../src/lib.js'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const done = (iso) => ({ completed_at: iso })
const sets = (...pairs) => pairs.map(([reps, weight]) => ({ reps, weight }))

// --- what already worked, pinned so it keeps working -------------------------
const skipped = [
  { id: 'c', created_at: '2026-09-28T09:00Z', ...done('2026-09-28T10:00Z'), exercises: [{ name: 'Bench Press', sets: sets(['', '']) }] },
  { id: 'b', created_at: '2026-09-21T09:00Z', ...done('2026-09-21T10:00Z'), exercises: [{ name: 'Bench Press', sets: sets(['8', '60'], ['8', '60']) }] },
]
ok('a week where they logged nothing is skipped over',
  lastSetsByName(skipped)['bench press']?.sets?.length === 2,
  JSON.stringify(lastSetsByName(skipped)['bench press']?.sets))

const missed = [
  { id: 'c', created_at: '2026-09-28T09:00Z', ...done('2026-09-28T10:00Z'), exercises: [{ name: 'Squat', sets: sets(['5', '100']) }] },
  { id: 'b', created_at: '2026-09-21T09:00Z', ...done('2026-09-21T10:00Z'), exercises: [{ name: 'Bench Press', sets: sets(['8', '60']) }] },
]
ok('a session they missed entirely is skipped over',
  lastSetsByName(missed)['bench press']?.sets?.[0]?.weight === '60',
  JSON.stringify(lastSetsByName(missed)['bench press']))

// --- the one that was actually wrong -----------------------------------------
const prescribed = [
  // Written by the coach for next week, never performed: no completed_at.
  { id: 'next', created_at: '2026-10-05T09:00Z', exercises: [{ name: 'Bench Press', sets: sets(['10', '50']) }] },
  // What they really lifted a fortnight ago.
  { id: 'real', created_at: '2026-09-21T09:00Z', ...done('2026-09-21T10:00Z'), exercises: [{ name: 'Bench Press', sets: sets(['8', '70']) }] },
]
const got = lastSetsByName(prescribed)['bench press']
ok('a coach-written session they never did is not reported as a lift',
  got?.sets?.[0]?.weight === '70', JSON.stringify(got?.sets))
ok('and what it reports is marked as confirmed', got?.confirmed === true, String(got?.confirmed))

// --- history from before the marker existed still works -----------------------
const legacy = [
  { id: 'old2', created_at: '2026-08-10T09:00Z', exercises: [{ name: 'Squat', sets: sets(['5', '90']) }] },
  { id: 'old1', created_at: '2026-08-03T09:00Z', exercises: [{ name: 'Squat', sets: sets(['5', '85']) }] },
]
const old = lastSetsByName(legacy)['squat']
ok('older history with no completion marker is still used', old?.sets?.[0]?.weight === '90', JSON.stringify(old?.sets))
ok('but is not claimed as confirmed', old?.confirmed === false, String(old?.confirmed))

// A confirmed session beats a more recent unconfirmed one.
const mixed = [
  { id: 'plan', created_at: '2026-10-05T09:00Z', exercises: [{ name: 'Row', sets: sets(['12', '30']) }] },
  { id: 'did', created_at: '2026-10-01T09:00Z', ...done('2026-10-01T10:00Z'), exercises: [{ name: 'Row', sets: sets(['10', '45']) }] },
]
ok('a performed session outranks a newer one that was only planned',
  lastSetsByName(mixed)['row']?.sets?.[0]?.weight === '45',
  JSON.stringify(lastSetsByName(mixed)['row']?.sets))

// --- the date label -----------------------------------------------------------
const now = new Date('2026-10-06T12:00:00')
ok('a completed session is dated as done',
  /^Done /.test(sessionDateLabel({ completed_at: '2026-10-01T10:00Z', created_at: '2026-09-28T09:00Z' }, now)),
  sessionDateLabel({ completed_at: '2026-10-01T10:00Z', created_at: '2026-09-28T09:00Z' }, now))
ok('one still to come is not',
  sessionDateLabel({ scheduled_for: '2026-10-09', created_at: '2026-10-05T09:00Z' }, now) === 'For Fri 9 Oct',
  sessionDateLabel({ scheduled_for: '2026-10-09', created_at: '2026-10-05T09:00Z' }, now))
ok('today reads as today',
  sessionDateLabel({ completed_at: '2026-10-06T08:00Z' }, now) === 'Done today',
  sessionDateLabel({ completed_at: '2026-10-06T08:00Z' }, now))

console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exitCode = failures ? 1 : 0
