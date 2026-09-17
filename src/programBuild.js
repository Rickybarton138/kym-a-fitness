import { byDow, sortDays } from './lib.js'

// Turning an AI's single base week into a real multi-week programme.
//
// Lived in TrainerApp until a standard client could generate their own
// programme too (Paul, 4 Sept: "let people use the ai to create a program ...
// state what days they can train and it builds a programme for them"). Both paths
// must progress load identically, so the logic is here rather than copied.

// Default weekdays when nobody has said which days they train. Mon-first, and
// spread so back-to-back sessions get a rest day between them where possible.
export const DOW_SPREAD = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] }
export const daySpread = (n) => DOW_SPREAD[Math.min(Math.max(n, 1), 6)] || DOW_SPREAD[3]

// Progressive overload applied when a base week is cloned across a programme:
// RPE ramps up through each 4-week block, then every 4th week is a deload
// (a set dropped, RPE eased back). Reps/exercise selection are left untouched.
export function progressExercises(list, week, deload) {
  const blockWk = (week - 1) % 4 // 0..3 within the current 4-week block
  return (list || []).map((e) => {
    const sets = e.sets || 3
    const out = { name: e.name, sets, reps: e.reps }
    if (deload) {
      out.sets = Math.max(2, sets - 1)
      if (e.rpe) out.rpe = Math.max(6, e.rpe - 2)
    } else if (e.rpe) {
      out.rpe = Math.min(10, e.rpe + blockWk)
    }
    return out
  })
}

// Paul, 17 Sept: "can I have it so that I can request to gradually increase
// sessions over the duration of the programme? So start with 1 per week and build
// gradually to 3 per week over 12 weeks?"
//
// This could not come from the free-text box, whatever it said: the model writes
// ONE base week and the week-by-week structure is built here, in code. So the
// ramp belongs here too.
//
// How many sessions week `wk` gets, interpolated from `from` to `to` across the
// programme. 1 -> 3 over 12 weeks gives 1,1,1,1, 2,2,2,2, 2,3,3,3 — it holds at
// each step for a few weeks rather than climbing every week, which is what
// "gradually" means to anyone who has actually coached someone back into it.
export function rampCount(wk, weeks, from, to) {
  if (weeks <= 1) return to
  const t = (Math.min(wk, weeks) - 1) / (weeks - 1)
  return Math.max(1, Math.round(from + t * (to - from)))
}

// Which of their available days a lighter week uses. Evenly spaced, so two
// sessions out of Mon/Wed/Fri land on Mon and Fri rather than Mon and Wed —
// a ramp is about recovery, and bunching the sessions defeats it.
export function pickDays(chosen, n) {
  if (n >= chosen.length) return chosen
  if (n <= 1) return [chosen[0]]
  const out = []
  for (let i = 0; i < n; i++) out.push(chosen[Math.round((i * (chosen.length - 1)) / (n - 1))])
  return out
}

/**
 * The base week cloned across `weeks`, on `days` if given (else spread).
 * Returns rows ready for program_sessions, minus program_id.
 *
 * Days are sorted Monday-first: a client picking Sunday and Monday should see
 * Mon then Sun, and a raw numeric sort puts Sunday first because getDay() calls
 * it 0. Same comparator the rest of the app uses.
 *
 * `ramp` is optional — {from, to} sessions per week. Without it every week gets
 * the whole base week, exactly as before, so the coach's path is untouched.
 */
export function buildProgramRows(base, weeks, days, ramp) {
  const all = base || []
  const chosen = (days && days.length) ? sortDays(days) : daySpread(all.length)
  const ramping = ramp && ramp.from > 0 && ramp.to > 0 && ramp.from !== ramp.to
  const rows = []
  let pos = 0
  for (let wk = 1; wk <= weeks; wk++) {
    const deload = weeks >= 4 && wk % 4 === 0
    // A ramping week takes the FIRST n sessions, which is why the generator is
    // told to order them so session one stands on its own.
    const n = ramping ? Math.min(rampCount(wk, weeks, ramp.from, ramp.to), all.length) : all.length
    const sessions = ramping ? all.slice(0, n) : all
    const weekDays = ramping ? pickDays(chosen, n) : chosen
    sessions.forEach((s, i) => {
      rows.push({
        position: pos++,
        week: wk,
        dow: weekDays[i % weekDays.length] ?? null,
        label: `Week ${wk}`,
        title: s.title,
        focus: deload ? `Deload — ${s.focus || 'recovery'}` : s.focus,
        exercises: progressExercises(s.exercises, wk, deload),
        finisher: s.finisher || null,
      })
    })
  }
  rows.sort((a, b) => (a.week - b.week) || byDow(a.dow, b.dow) || (a.position - b.position))
  return rows
}
