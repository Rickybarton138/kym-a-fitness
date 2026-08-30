import { supabase } from './supabaseClient.js'

// One answer to "what is this client doing today?".
//
// This logic used to live inside AgendaCard alone, so Home knew today's session
// but the Train tab did not — tapping "Today's session" there dropped you on a
// chooser instead of the session you were actually meant to do. Home, the Train
// hub, the programme view and the ad-hoc picker now all read from here.

// The client's active programme plus every session in it.
export async function loadClientProgram(clientId) {
  const { data: cps } = await supabase.from('client_programs')
    .select('program_id, start_date, repeat, day_map, coach_id, workout_programs(title, weeks)')
    .eq('client_id', clientId).eq('active', true)
    .order('created_at', { ascending: false }).limit(1)
  const asg = cps && cps[0]
  if (!asg) return null

  const { data: psess } = await supabase.from('program_sessions')
    .select('id, week, dow, position, title, focus, exercises, finisher, label')
    .eq('program_id', asg.program_id)
  const sessions = psess || []
  // The cycle length is what was actually built, not what the programme claims —
  // a 4-week programme with only 2 weeks of sessions repeats on 2.
  const cycleWeeks = sessions.reduce((mx, s) => Math.max(mx, s.week || 1), 1)

  return {
    asg,
    sessions,
    cycleWeeks,
    title: asg.workout_programs?.title || 'Your program',
    programWeeks: asg.workout_programs?.weeks || cycleWeeks,
    dayMap: asg.day_map || [],
    byCoach: !!asg.coach_id,
  }
}

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
    .sort((a, b) => (a.dow ?? 99) - (b.dow ?? 99) || (a.position ?? 0) - (b.position ?? 0))
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
    const slot = prog.dayMap.indexOf(dow)
    if (slot !== -1) sess = sessionsInWeek(prog, week)[slot] || null
  } else {
    sess = prog.sessions.find((s) => (s.week || 1) === week && s.dow === dow) || null
  }
  return sess ? { sess, weekNum: week, title: prog.title } : null
}

// Start a session for real: create the client's copy and mark it active so its
// card opens straight into the guided player rather than sitting collapsed in
// the list (see UpdatePrompt/SessionCard — cbk_gw_active is the same flag that
// reopens a workout after the app is backgrounded).
export async function startSessionNow(clientId, src) {
  const { data } = await supabase.from('workout_plans').insert({
    client_id: clientId, title: src.title, focus: src.focus || 'Session',
    exercises: src.exercises || [], finisher: src.finisher || null, assigned_by: null,
  }).select().single()
  if (data) { try { sessionStorage.setItem('cbk_gw_active', data.id) } catch { /* private mode */ } }
  return data
}
