// Paul, 17 Sept: "when using the AI builder, can I have it so that I can request
// to gradually increase sessions over the duration of the program? So start with
// 1 per week and build gradually to 3 per week over 12 weeks?"
//
// buildProgramRows is pure, so this is arithmetic rather than a browser: every
// week of his exact example is checked, plus the edges that would quietly
// produce a nonsense programme — one week, no ramp, a target above the days they
// actually have, and a ramp that goes down instead of up.
//
// Run: node tasks/e2e_round36.mjs
import { buildProgramRows, rampCount, pickDays } from '../src/programBuild.js'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const base = [
  { title: 'Full Body A', focus: 'Full body', exercises: [{ name: 'Squat', sets: 3, reps: '8', rpe: 7 }] },
  { title: 'Full Body B', focus: 'Full body', exercises: [{ name: 'Bench', sets: 3, reps: '8', rpe: 7 }] },
  { title: 'Full Body C', focus: 'Full body', exercises: [{ name: 'Row', sets: 3, reps: '8', rpe: 7 }] },
]
const DAYS = [1, 3, 5] // Mon, Wed, Fri

// --- his example, week by week ----------------------------------------------
const rows = buildProgramRows(base, 12, DAYS, { from: 1, to: 3 })
const perWeek = Array.from({ length: 12 }, (_, i) => rows.filter((r) => r.week === i + 1).length)
ok('week 1 starts at one session', perWeek[0] === 1, String(perWeek[0]))
ok('week 12 finishes at three', perWeek[11] === 3, String(perWeek[11]))
ok('it never goes backwards', perWeek.every((n, i) => i === 0 || n >= perWeek[i - 1]), perWeek.join(','))
ok('it climbs in steps, not every week', new Set(perWeek).size === 3, perWeek.join(','))
ok('every week has at least one session', perWeek.every((n) => n >= 1), perWeek.join(','))
console.log('      sessions per week: ' + perWeek.join(', '))

// --- the lighter weeks use spaced days ---------------------------------------
const wkOf = (n) => rows.filter((r) => r.week === n).map((r) => r.dow)
ok('a single-session week sits on their first day', JSON.stringify(wkOf(1)) === JSON.stringify([1]), JSON.stringify(wkOf(1)))
const two = perWeek.indexOf(2) + 1
ok('a two-session week spreads Mon/Fri, not Mon/Wed', JSON.stringify(wkOf(two)) === JSON.stringify([1, 5]), JSON.stringify(wkOf(two)))
ok('a full week uses all three days', JSON.stringify(wkOf(12)) === JSON.stringify([1, 3, 5]), JSON.stringify(wkOf(12)))

// --- a lighter week must be a session that stands alone -----------------------
ok('lighter weeks take the first session, not a random one',
  rows.filter((r) => r.week === 1).every((r) => r.title === 'Full Body A'),
  rows.filter((r) => r.week === 1).map((r) => r.title).join(', '))

// --- deloads and progression still work through a ramp ------------------------
const wk4 = rows.filter((r) => r.week === 4)
ok('week 4 is still a deload', wk4.every((r) => /Deload/.test(r.focus)), wk4.map((r) => r.focus).join(', '))
ok('and a deload drops a set', wk4.every((r) => r.exercises.every((e) => e.sets === 2)), JSON.stringify(wk4[0]?.exercises))

// --- no ramp: unchanged, because the coach's path shares this ----------------
const flat = buildProgramRows(base, 4, DAYS)
ok('without a ramp every week is the full base week', [1, 2, 3, 4].every((w) => flat.filter((r) => r.week === w).length === 3),
  [1, 2, 3, 4].map((w) => flat.filter((r) => r.week === w).length).join(','))
ok('and a from === to ramp is treated as no ramp',
  buildProgramRows(base, 4, DAYS, { from: 2, to: 2 }).filter((r) => r.week === 1).length === 3)

// --- edges that would otherwise ship nonsense --------------------------------
ok('a one-week programme just gets the target', buildProgramRows(base, 1, DAYS, { from: 1, to: 3 }).length === 3,
  String(buildProgramRows(base, 1, DAYS, { from: 1, to: 3 }).length))
// Asking to build to 4 when only 3 days were picked must not invent a 4th.
const over = buildProgramRows(base, 8, DAYS, { from: 1, to: 4 })
ok('it cannot schedule more sessions than the base week has',
  Array.from({ length: 8 }, (_, i) => over.filter((r) => r.week === i + 1).length).every((n) => n <= 3),
  Array.from({ length: 8 }, (_, i) => over.filter((r) => r.week === i + 1).length).join(','))
// Deliberately backwards — a deload block, or someone winding down.
const down = buildProgramRows(base, 6, DAYS, { from: 3, to: 1 })
const downPer = Array.from({ length: 6 }, (_, i) => down.filter((r) => r.week === i + 1).length)
ok('a downward ramp works too', downPer[0] === 3 && downPer[5] === 1, downPer.join(','))

// --- the helpers on their own -------------------------------------------------
ok('rampCount holds the floor at one', rampCount(1, 12, 0, 3) >= 1, String(rampCount(1, 12, 0, 3)))
ok('pickDays never returns more than it was given', pickDays([1, 3], 5).length === 2)
ok('pickDays of one is the first day', JSON.stringify(pickDays([2, 4, 6], 1)) === JSON.stringify([2]))

console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
