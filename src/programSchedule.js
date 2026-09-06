import { byDow } from './lib.js'

// When a programme's sessions fall — pure date maths, no data access.
//
// Split out of todaySession.js so it can be tested directly: that module pulls
// in the Supabase client, which needs Vite's import.meta.env and cannot be
// loaded from a plain node script. Scheduling is the part most worth asserting.

// Which week of the cycle a date falls in, or null if the programme hasn't
// started or has finished without repeating.
export function weekFor(prog, date = new Date()) {
  if (!prog) return null
  const start = new Date(prog.asg.start_date + 'T00:00:00')
  const day = new Date(date); day.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((day - start) / 86400000)
  if (diffDays < 0) return null
  const week = Math.floor(diffDays / 7) + 1
  if (week <= prog.cycleWeeks) return week
  return prog.asg.repeat ? ((week - 1) % prog.cycleWeeks) + 1 : null
}

// The sessions of one week, in the order they're meant to be done.
export function sessionsInWeek(prog, week) {
  if (!prog) return []
  return prog.sessions
    .filter((s) => (s.week || 1) === week)
    .sort((a, b) => byDow(a.dow, b.dow) || (a.position ?? 0) - (b.position ?? 0))
}

// The session scheduled for a given day, or null on a rest day.
export function sessionForDay(prog, date = new Date()) {
  const week = weekFor(prog, date)
  if (!week) return null
  const dow = new Date(date).getDay()
  let sess = null
  // A client who picked their own training days (day_map) isn't following the
  // dow the coach authored, so map that week's sessions onto their chosen days
  // by position instead.
  if (prog.dayMap.length) {
    const list = sessionsInWeek(prog, week)
    const slot = prog.dayMap.indexOf(dow)
    if (slot !== -1 && list[slot]) {
      sess = list[slot]
    } else {
      // A day_map SHORTER than the week's sessions used to strand the rest:
      // Paul built K-Jo Tue "Full Body" + Thu "Lower Body", the assignment
      // mapped Tuesday only, and the legs session became unreachable — it
      // existed, but no date could ever resolve to it. Paul: "I could see the
      // TRX training session but not the legs one." Sessions the map does not
      // cover keep the day the coach authored, so nothing can silently vanish.
      const unmapped = list.slice(prog.dayMap.length)
      sess = unmapped.find((s) => s.dow === dow) || null
    }
  } else {
    sess = prog.sessions.find((s) => (s.week || 1) === week && s.dow === dow) || null
  }
  return sess ? { sess, weekNum: week, title: prog.title } : null
}
