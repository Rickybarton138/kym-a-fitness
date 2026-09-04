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

/**
 * The base week cloned across `weeks`, on `days` if given (else spread).
 * Returns rows ready for program_sessions, minus program_id.
 *
 * Days are sorted Monday-first: a client picking Sunday and Monday should see
 * Mon then Sun, and a raw numeric sort puts Sunday first because getDay() calls
 * it 0. Same comparator the rest of the app uses.
 */
export function buildProgramRows(base, weeks, days) {
  const sessions = base || []
  const chosen = (days && days.length) ? sortDays(days) : daySpread(sessions.length)
  const rows = []
  let pos = 0
  for (let wk = 1; wk <= weeks; wk++) {
    const deload = weeks >= 4 && wk % 4 === 0
    sessions.forEach((s, i) => {
      rows.push({
        position: pos++,
        week: wk,
        dow: chosen[i % chosen.length] ?? null,
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
