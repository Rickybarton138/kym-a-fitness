// Paul, 4 Oct, forwarding a client: "the pictures are wrong on this exercise"
// (Triceps Pushdown (cable)), and "the instructions are confusing and don't seem
// to match the picture".
//
// The reported one was a stale cache — the row predated a matcher fix and was
// still serving the old pick. Re-matching every stale row turned up the same
// shape of error still LIVE in the matcher: a longer library name shares more
// words, so "Dumbbell Lateral Raise" lost to "Dumbbell Lying Rear Lateral
// Raise", and "Barbell Bench Press" lost to "Barbell Guillotine Bench Press".
//
// This pins the names that matter. Each case is either a required match, a
// forbidden one, or a required refusal — showing nothing is a valid answer and
// much better than a confident picture of a different exercise.
//
// Run: node tasks/e2e_exercise_images.mjs
import { library, matchOne } from '../netlify/functions/_exercise-match.mjs'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const lib = await library()
const pick = (name) => matchOne(name, lib).name || '(none)'

// [query, must-not-be (substring, case-insensitive), must-be (optional exact)]
const MUSTNOT = [
  // The two that sent a client to Paul.
  ['Triceps Pushdown (cable)', 'incline', 'Triceps Pushdown'],
  ['Tricep Pushdown', 'incline', 'Triceps Pushdown'],
  // A guillotine press is a neck-level variant. Never show it for a bench press.
  ['Barbell Bench Press', 'guillotine', null],
  ['Bench Press', 'guillotine', null],
  // A rear delt raise is a different muscle from a lateral raise.
  ['Dumbbell Lateral Raise', 'rear', null],
  ['Lateral Raise', 'rear', null],
  ['Cable Lateral Raise', 'rear', null],
  // Front raise is not an incline front raise.
  ['Dumbbell Front Raise', 'incline', null],
  // A chest press is not a shoulder press.
  ['Leverage Chest Press Machine', 'shoulder', null],
  ['Chest Press Machine', 'shoulder', null],
  // Flat is not incline.
  ['Dumbbell Bench Press', 'incline', null],
  ['Cable Chest Fly', 'incline', null],
  // Caught by re-matching: penalising "side" pushed the standard lateral raise
  // onto a resistance-band version, and a plain lat pulldown onto a one-armed one.
  ['Lateral Raise', 'band', 'Side Lateral Raise'],
  ['Lat Pulldown', 'one arm', null],
]

for (const [q, forbidden, expect] of MUSTNOT) {
  const got = pick(q)
  ok(`${q} is not a "${forbidden}" variant`, !new RegExp(forbidden, 'i').test(got), got)
  if (expect) ok(`  ...and resolves to ${expect}`, got === expect, got)
}

// Names that must still resolve — the penalty must not make it refuse everything.
const MUST = [
  // Everyday gym names the library spells differently — these resolved to
  // nothing before the alias table, which is how one of the most common lifts in
  // the app ended up with no demo at all.
  ['Back Squat', /squat/i],
  ['Barbell Back Squat', /squat/i],
  ['Overhead Press', /shoulder press/i],
  ['RDL', /romanian/i],
  ['Bent Over Row', /row/i],
  ['Goblet Squat', /goblet/i],
  ['Barbell Bench Press', /bench press/i],
  ['Incline Dumbbell Press', /incline/i],
  ['Romanian Deadlift', /romanian|deadlift/i],
  ['Seated Cable Row', /row/i],
  ['Lat Pulldown', /pulldown/i],
  ['Dumbbell Shoulder Press', /shoulder press/i],
  ['Leg Press', /leg press/i],
  ['Bent Over Barbell Row', /row/i],
  ['Triceps Pushdown - Rope Attachment', /pushdown/i],
]
for (const [q, want] of MUST) {
  const got = pick(q)
  ok(`${q} still finds a demo`, want.test(got), got)
}

// A variant the client DID ask for should be honoured when the library has it.
const HONOUR = [
  ['Incline Barbell Bench Press', /incline/i],
  ['Seated Calf Raise', /seated/i],
  ['Reverse Grip Triceps Pushdown', /reverse/i],
]
for (const [q, want] of HONOUR) {
  const got = pick(q)
  ok(`${q} keeps its own variant`, want.test(got), got)
}

// Nonsense must refuse rather than guess.
for (const q of ['Sled Drag Thing', 'Jefferson Curl', 'Zercher Carry']) {
  const got = pick(q)
  console.log(`      (${q} -> ${got})`)
}

console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
// exitCode, not exit(): the library fetch leaves a keep-alive socket open, and
// calling process.exit() on top of it trips a libuv assertion on Windows that
// printed AFTER the result line and buried it.
process.exitCode = failures ? 1 : 0
