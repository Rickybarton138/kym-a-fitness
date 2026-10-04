// One shape for "what is going on with this client", built from raw rows.
//
// PURE. Every function here takes rows and returns a plain object, so the whole
// thing is testable from fixtures with no database and no API key. The fetching
// lives in netlify/functions/_context.mjs; the rules that read this live in
// src/coachRules.js.
//
// Three distinctions the rest of the engine depends on, and which the raw tables
// do not make for you:
//
//   PLANNED vs COMPLETED. A `workout_plans` row exists the moment somebody taps
//   a session — startSessionNow() inserts it before a single set is done — and
//   the player only writes `exercises` back on Finish. The confirmed signal is
//   `workout_completions`. Same for food: rows in `nutrition_logs` mean somebody
//   logged something, `food_day_complete` means they say the day is done.
//
//   MISSING vs ZERO. No `daily_steps` row is not "0 steps"; it is "we do not
//   know". Telling someone they have walked nothing when they never connected a
//   tracker is how an app loses trust. Anything unknown is null and named in
//   `missing`.
//
//   FRESHNESS. Each slice carries the timestamp of its newest record so the card
//   can say how old its evidence is, and so a stale response can be spotted.

import { weekFor, sessionForDay, sessionsInWeek } from './programSchedule.js'
import { londonDay, addDays, daysBetween, weekStart, isoDow, minutesSince } from './coachTime.js'

export const CONTEXT_VERSION = 3

// Midday UTC of a London civil day. programSchedule reads dates with host-local
// getters, and the functions run in UTC while the app runs in London; noon is
// far enough from both midnights that either reading lands on the same date.
function probeDate(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
const newest = (rows, field) => {
  const stamps = (rows || []).map((r) => r && r[field]).filter(Boolean).sort()
  return stamps.length ? stamps[stamps.length - 1] : null
}

// --- nutrition ---------------------------------------------------------------

export function sumLogs(logs) {
  return (logs || []).reduce((a, l) => ({
    calories: a.calories + (l.calories || 0),
    protein_g: a.protein_g + (l.protein_g || 0),
    carbs_g: a.carbs_g + (l.carbs_g || 0),
    fat_g: a.fat_g + (l.fat_g || 0),
    fibre_g: a.fibre_g + (l.fibre_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 })
}

/**
 * The target in force on a given day, from the dated trail in
 * macro_target_history, falling back to the current row. Mirrors targetOn() in
 * lib.js; duplicated rather than imported so this module stays dependency-light
 * for the server, and covered by a test that the two agree.
 */
export function targetForDay(history, day, current) {
  const sorted = (history || [])
    .filter((h) => h && h.effective_from)
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))
  // Matches targetOn() in lib.js exactly, including the edge it is explicit
  // about: for a day BEFORE the earliest row we know nothing, so the oldest
  // target we do have is the closest honest answer — better than silently
  // scoring an old day against today's numbers. A test asserts the two agree.
  const row = sorted.find((h) => h.effective_from <= day) || sorted[sorted.length - 1] || null
  const pick = row || current || null
  if (!pick) return null
  return {
    calories: num(pick.calories), protein_g: num(pick.protein_g),
    carbs_g: num(pick.carbs_g), fat_g: num(pick.fat_g), fibre_g: num(pick.fibre_g),
    source: row ? 'history' : 'current',
    asOf: row ? row.effective_from : (current && current.updated_at) || null,
  }
}

function nutritionSlice(raw, today) {
  const logs = raw.nutrition || []
  const byDay = new Map()
  for (const l of logs) {
    const day = l.logged_day || londonDay(l.logged_at)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(l)
  }
  const completeDays = new Set((raw.foodDays || []).map((d) => d.day))
  const todayLogs = byDay.get(today) || []
  const target = targetForDay(raw.targetHistory, today, raw.targets)

  // Coverage is over days that have actually HAPPENED this week, not seven.
  const wkStart = weekStart(today)
  const elapsed = []
  for (let d = wkStart; daysBetween(d, today) >= 0; d = addDays(d, 1)) elapsed.push(d)
  const loggedDays = elapsed.filter((d) => (byDay.get(d) || []).length > 0)
  const closedDays = elapsed.filter((d) => completeDays.has(d))

  const dayTotals = elapsed.map((d) => {
    const t = targetForDay(raw.targetHistory, d, raw.targets)
    const got = sumLogs(byDay.get(d) || [])
    return {
      day: d,
      complete: completeDays.has(d),
      logged: (byDay.get(d) || []).length,
      kcal: (byDay.get(d) || []).length ? got.calories : null,
      targetKcal: t ? t.calories : null,
      protein_g: (byDay.get(d) || []).length ? got.protein_g : null,
      targetProtein: t ? t.protein_g : null,
    }
  })

  return {
    target,
    today: {
      day: today,
      items: todayLogs.length,
      logged: todayLogs.length > 0,
      complete: completeDays.has(today),
      totals: todayLogs.length ? sumLogs(todayLogs) : null,
      lastLoggedAt: newest(todayLogs, 'logged_at'),
      byMeal: [...new Set(todayLogs.map((l) => l.meal_type).filter(Boolean))],
    },
    week: {
      start: wkStart,
      daysElapsed: elapsed.length,
      daysLogged: loggedDays.length,
      daysComplete: closedDays.length,
      // Adherence is over CLOSED days only — a day still being logged is not a
      // day they missed, and scoring it as one is the quickest way to make an
      // honest user feel told off.
      adherence: closedDays.length
        ? Math.round((dayTotals.filter((d) => d.complete && d.targetKcal && d.kcal != null
            && Math.abs(d.kcal - d.targetKcal) <= d.targetKcal * 0.1).length / closedDays.length) * 100)
        : null,
      days: dayTotals,
    },
    freshAt: newest(logs, 'logged_at'),
  }
}

// --- training ----------------------------------------------------------------

const CARDIO = /run|walk|row|bike|cycl|swim|treadmill|assault|air bike|stepper|cross-trainer|sled|ski|erg/i
const DISTANCE = /\d\s*(km|k|mile|mi|m)\b|\bmin|\bsec|\bs\b/i

/** Split performed work into lifting and cardio, because one kg and one km do not average. */
export function classifyExercises(exercises) {
  const lifting = []
  const cardio = []
  for (const ex of exercises || []) {
    const name = ex.name || ''
    const hasWeight = num(ex.weight) != null && num(ex.weight) > 0
    if (hasWeight && !CARDIO.test(name)) lifting.push(ex)
    else if (CARDIO.test(name) || (!hasWeight && DISTANCE.test(String(ex.reps || '')))) cardio.push(ex)
    else lifting.push(ex)
  }
  return { lifting, cardio }
}

/** Tonnage of the lifting part only, and only where sets, reps and weight are all known. */
export function liftingVolume(exercises) {
  let kg = 0, sets = 0, counted = 0, partial = false
  for (const ex of classifyExercises(exercises).lifting) {
    const s = num(ex.sets), w = num(ex.weight)
    const r = num(String(ex.reps || '').match(/\d+/)?.[0])
    sets += s || 0
    if (s && r && w) { kg += s * r * w; counted++ } else partial = true
  }
  return { kg: counted ? Math.round(kg) : null, sets, exercises: counted, partial }
}

function trainingSlice(raw, today) {
  const completions = raw.completions || []
  const completedDays = new Set(completions.map((c) => c.completed_on))
  const plans = raw.plans || []

  // A finished session is a plan whose day is in workout_completions. The plan
  // row alone proves only that somebody opened one.
  const finished = plans
    .filter((p) => completedDays.has(p.scheduled_for || londonDay(p.created_at)))
    .map((p) => ({
      id: p.id,
      title: p.title,
      focus: p.focus,
      day: p.scheduled_for || londonDay(p.created_at),
      exercises: p.exercises || [],
      volume: liftingVolume(p.exercises),
      split: classifyExercises(p.exercises),
      assigned: !!p.assigned_by,
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1))

  const prog = raw.programme || null
  const probe = probeDate(today)
  const week = prog ? weekFor(prog, probe) : null
  // sessionForDay returns a WRAPPER — { sess, weekNum, title: <PROGRAMME title> }
  // — so the session's own title is one level down. Reading `.title` off the
  // wrapper gives the programme name, which is how the card came to announce
  // "Lean & Strong" as today's session.
  const todayWrap = prog ? sessionForDay(prog, probe) : null
  const plannedToday = todayWrap ? todayWrap.sess : null
  const plannedThisWeek = prog && week ? sessionsInWeek(prog, week).length : null

  // The next planned session after today, looked for over the coming week.
  let next = null
  if (prog) {
    for (let i = 1; i <= 7 && !next; i++) {
      const day = addDays(today, i)
      const wrap = sessionForDay(prog, probeDate(day))
      if (wrap) next = { day, title: wrap.sess.title, focus: wrap.sess.focus, inDays: i }
    }
  }

  const wkStart = weekStart(today)
  const doneThisWeek = [...completedDays].filter((d) => d >= wkStart && daysBetween(d, today) >= 0)

  return {
    programme: prog
      ? { title: prog.title, week, cycleWeeks: prog.cycleWeeks, byCoach: prog.byCoach, plannedThisWeek }
      : null,
    plannedToday: plannedToday
      ? { title: plannedToday.title, focus: plannedToday.focus, sessionId: plannedToday.id }
      : null,
    nextPlanned: next,
    completedToday: completedDays.has(today),
    completedThisWeek: doneThisWeek.length,
    lastCompleted: finished[0] || null,
    recent: finished.slice(0, 8),
    lifts: (raw.lifts || []).slice(0, 40),
    loads: (raw.loads || []).slice(0, 14),
    freshAt: newest(completions, 'created_at') || newest(plans, 'created_at'),
  }
}

/**
 * The last comparable completed session to `session`: same title first, then
 * same focus. Never compares a session with itself, and never compares against
 * something that was only started.
 */
export function comparableSession(session, recent) {
  if (!session) return null
  const others = (recent || []).filter((r) => r.id !== session.id && r.day <= session.day)
  const sameTitle = others.filter((r) => r.title && session.title && r.title === session.title)
  const sameFocus = others.filter((r) => r.focus && session.focus && r.focus === session.focus)
  const pick = (sameTitle[0] || sameFocus[0] || null)
  if (!pick) return null
  return { ...pick, matchedOn: sameTitle[0] ? 'title' : 'focus' }
}

// --- the rest ----------------------------------------------------------------

function dailySlice(raw, today) {
  const rows = raw.steps || []
  const todayRow = rows.find((r) => r.day === today) || null
  const target = num(raw.profile?.step_target)
  const waterTarget = num(raw.profile?.water_target_ml)
  const week = rows.filter((r) => r.day >= weekStart(today) && daysBetween(r.day, today) >= 0)
  const known = week.filter((r) => num(r.steps) != null)
  return {
    steps: {
      today: todayRow ? num(todayRow.steps) : null,
      target: target,
      weekAverage: known.length ? Math.round(known.reduce((a, r) => a + num(r.steps), 0) / known.length) : null,
      daysKnown: known.length,
    },
    water: {
      todayMl: todayRow ? num(todayRow.water_ml) : null,
      targetMl: waterTarget,
    },
    freshAt: newest(rows, 'updated_at'),
  }
}

function bodySlice(raw) {
  const rows = [...(raw.measurements || [])].sort((a, b) => (a.measured_at < b.measured_at ? 1 : -1))
  const latest = rows[0] || null
  const prior = rows.find((r) => latest && r.measured_at < latest.measured_at && num(r.weight_kg) != null) || null
  const lw = latest ? num(latest.weight_kg) : null
  const pw = prior ? num(prior.weight_kg) : null
  return {
    latest: latest ? { day: latest.measured_at, weight_kg: lw, waist_cm: num(latest.waist_cm) } : null,
    weightChangeKg: lw != null && pw != null ? Math.round((lw - pw) * 10) / 10 : null,
    since: prior ? prior.measured_at : null,
    count: rows.length,
    freshAt: latest ? latest.measured_at : null,
  }
}

function checkinSlice(raw, today) {
  const readiness = [...(raw.readiness || [])].sort((a, b) => (a.checked_on < b.checked_on ? 1 : -1))
  const todays = readiness.find((r) => r.checked_on === today) || null
  const weekly = [...(raw.weekly || [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] || null
  const sore = [...(raw.soreness || [])].sort((a, b) => (a.logged_on < b.logged_on ? 1 : -1)).slice(0, 5)
  return {
    readinessToday: todays
      ? {
          day: todays.checked_on,
          sleep: num(todays.sleep), energy: num(todays.energy),
          soreness: num(todays.soreness), minutes: num(todays.minutes_available),
          note: todays.note || null,
        }
      : null,
    readinessRecent: readiness.slice(0, 7).map((r) => ({
      day: r.checked_on, sleep: num(r.sleep), energy: num(r.energy), soreness: num(r.soreness),
    })),
    weeklyLatest: weekly
      ? { at: weekly.created_at, energy: num(weekly.energy), sleep: num(weekly.sleep), wins: weekly.wins || null }
      : null,
    soreness: sore.map((s) => ({ day: s.logged_on, region: s.body_region, pain: num(s.pain) })),
    freshAt: readiness[0]?.created_at || weekly?.created_at || null,
  }
}

/**
 * Build the context. `raw` is whatever the loader fetched — slices it did not
 * fetch come back as null rather than empty, so a rule can tell "no session
 * planned" from "we did not look".
 */
export function buildContext(raw, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date()
  const today = opts.today || londonDay(now)
  const has = (k) => raw[k] !== undefined && raw[k] !== null

  const ctx = {
    v: CONTEXT_VERSION,
    generatedAt: now.toISOString(),
    today,
    dow: isoDow(today),
    timezone: 'Europe/London',
    brand: opts.brand || null,
    profile: has('profile')
      ? {
          name: raw.profile.full_name || null,
          goal: raw.profile.goal || null,
          level: raw.profile.activity_level || null,
          nutritionStyle: raw.profile.nutrition_style || null,
          healthConditions: raw.profile.health_conditions || null,
          sensitiveNote: raw.profile.nutrition_sensitive_note || null,
          lifeContext: raw.profile.life_context_note || null,
          stepTarget: num(raw.profile.step_target),
        }
      : null,
    nutrition: has('nutrition') ? nutritionSlice(raw, today) : null,
    training: has('completions') || has('plans') || has('programme') ? trainingSlice(raw, today) : null,
    daily: has('steps') ? dailySlice(raw, today) : null,
    body: has('measurements') ? bodySlice(raw) : null,
    checkins: has('readiness') || has('weekly') ? checkinSlice(raw, today) : null,
    activity: has('strava')
      ? { strava: raw.strava ? { connected: true, athlete: raw.strava.athlete_name || null } : { connected: false } }
      : null,
    chat: has('chats')
      ? (raw.chats || []).slice(0, 6).map((c) => ({ at: c.created_at, q: c.question, a: c.answer }))
      : null,
    memory: has('memory') ? (raw.memory || []).map((m) => ({ key: m.key, value: m.value, source: m.source })) : null,
    recipes: has('recipes')
      ? (raw.recipes || []).slice(0, 25).map((r) => ({
          id: r.id, title: r.title, calories: num(r.calories), protein_g: num(r.protein_g),
          tags: r.tags || [], mine: !!r.client_id,
        }))
      : null,
  }

  ctx.missing = missingFrom(ctx)
  ctx.freshness = {
    nutrition: ctx.nutrition?.freshAt || null,
    training: ctx.training?.freshAt || null,
    daily: ctx.daily?.freshAt || null,
    body: ctx.body?.freshAt || null,
    checkins: ctx.checkins?.freshAt || null,
  }
  ctx.ageMinutes = Object.fromEntries(
    Object.entries(ctx.freshness).map(([k, v]) => [k, minutesSince(v, now)]),
  )
  return ctx
}

/** What we genuinely do not know, as opposed to what is zero. */
export function missingFrom(ctx) {
  const out = []
  if (!ctx.nutrition || !ctx.nutrition.target) out.push('targets')
  if (ctx.daily && ctx.daily.steps.today === null) out.push('steps')
  if (ctx.daily && ctx.daily.water.todayMl === null) out.push('water')
  if (ctx.training && !ctx.training.programme) out.push('programme')
  if (ctx.checkins && !ctx.checkins.readinessToday) out.push('readiness')
  if (ctx.body && !ctx.body.latest) out.push('measurements')
  return out
}

/**
 * A short stable fingerprint of the facts a suggestion was built from. Same
 * fingerprint means the stored explanation can be reused instead of paying for
 * another model call. Deliberately excludes generatedAt.
 */
export function fingerprint(ctx) {
  const parts = [
    ctx.v, ctx.today, ctx.brand || '-',
    ctx.training?.completedToday ? 'wd' : 'w-',
    ctx.training?.plannedToday ? 'wp' : 'w-',
    ctx.nutrition?.today.items ?? '-',
    ctx.nutrition?.today.complete ? 'fc' : 'f-',
    ctx.daily?.steps.today ?? '-',
    ctx.checkins?.readinessToday ? 'r1' : 'r0',
  ]
  // djb2: short, stable across processes, and no dependency.
  let h = 5381
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** The evidence lines shown under the card and handed to the model as facts. */
export function evidenceLines(ctx) {
  const out = []
  const t = ctx.training
  const n = ctx.nutrition
  if (t) {
    if (t.plannedToday) out.push(`Planned today: ${t.plannedToday.title}`)
    else if (t.programme) out.push('No session scheduled today')
    out.push(t.completedToday ? 'Training logged today: yes' : 'Training logged today: no')
    if (t.lastCompleted) out.push(`Last completed: ${t.lastCompleted.title} on ${t.lastCompleted.day}`)
    if (t.programme) out.push(`Week ${t.programme.week} of ${t.programme.title}, ${t.completedThisWeek} of ${t.programme.plannedThisWeek ?? '?'} done this week`)
  }
  if (n) {
    out.push(n.today.logged
      ? `Food today: ${n.today.items} items, ${n.today.totals.calories} kcal${n.today.complete ? ', day marked complete' : ', still logging'}`
      : 'Food today: nothing logged yet')
    if (n.target) out.push(`Target: ${n.target.calories} kcal, ${n.target.protein_g}g protein`)
    out.push(`This week: ${n.week.daysComplete} of ${n.week.daysElapsed} days closed off`)
  }
  if (ctx.daily) {
    out.push(ctx.daily.steps.today === null
      ? 'Steps today: not recorded'
      : `Steps today: ${ctx.daily.steps.today}${ctx.daily.steps.target ? ` of ${ctx.daily.steps.target}` : ''}`)
  }
  if (ctx.checkins) {
    out.push(ctx.checkins.readinessToday
      ? `Readiness today: sleep ${ctx.checkins.readinessToday.sleep ?? '?'}/5, energy ${ctx.checkins.readinessToday.energy ?? '?'}/5`
      : 'No readiness check-in today')
  }
  return out
}
