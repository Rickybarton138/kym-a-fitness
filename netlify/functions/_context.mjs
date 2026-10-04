// Loads only the slices a request actually needs, as the user.
//
// Scopes exist because the Today card does not need six weeks of lift history
// and the weekly review does not need the chat log. Loading everything for every
// request would be slower, dearer and would put personal data in prompts that
// have no use for it.
//
// Every query goes through userQuery(token), so RLS decides what comes back. A
// slice that was not requested is left UNDEFINED, which buildContext turns into
// null — so a rule can tell "no programme" from "we did not look for one".

import { userQuery } from './_auth.mjs'
import { buildContext } from '../../src/coachContext.js'
import { londonDay, londonDayBounds, addDays, weekStart, lastCompleteWeek } from '../../src/coachTime.js'

export const SCOPES = {
  // Enough to choose and explain the next action.
  today: ['profile', 'targets', 'programme', 'plans', 'completions', 'nutrition', 'foodDays', 'steps', 'readiness', 'review'],
  // Post-save feedback: the thing just saved, plus what it is compared against.
  feedback: ['profile', 'targets', 'programme', 'plans', 'completions', 'nutrition', 'foodDays', 'steps', 'readiness', 'recipes', 'memory'],
  // Chat can be asked anything, so it gets the lot except the review lookup.
  chat: ['profile', 'targets', 'programme', 'plans', 'completions', 'loads', 'lifts', 'nutrition', 'foodDays', 'steps', 'measurements', 'readiness', 'weekly', 'soreness', 'strava', 'chats', 'memory', 'recipes'],
  review: ['profile', 'targets', 'programme', 'plans', 'completions', 'loads', 'lifts', 'nutrition', 'foodDays', 'steps', 'measurements', 'readiness', 'weekly'],
  readiness: ['profile', 'programme', 'plans', 'completions', 'readiness', 'soreness', 'loads'],
}

const list = (rows) => (Array.isArray(rows) ? rows : [])

/**
 * Fetch and shape. `windowDays` bounds every history query — the review needs
 * four weeks, the card needs about ten days.
 */
export async function loadContext({ user, brand, scope = 'today', windowDays = 10, now = new Date() }) {
  const q = userQuery(user.token)
  const today = londonDay(now)
  const from = addDays(today, -windowDays)
  const want = new Set(SCOPES[scope] || SCOPES.today)
  const id = user.id
  const raw = {}

  // Instant bounds for the days we care about, so a timestamp column can be
  // filtered on London days rather than UTC ones.
  const [fromInstant] = londonDayBounds(from)
  const [, todayEnd] = londonDayBounds(today)
  const fromIso = fromInstant.toISOString()
  const toIso = todayEnd.toISOString()

  const jobs = []
  const run = (key, fn) => { if (want.has(key)) jobs.push(fn().then((v) => { raw[key] = v })) }

  run('profile', async () => {
    const rows = await q.select('profiles',
      `id=eq.${id}&select=full_name,goal,activity_level,nutrition_style,health_conditions,nutrition_sensitive_note,life_context_note,step_target,water_target_ml,trainer_id`)
    return list(rows)[0] || null
  })

  // `targets` is loaded in its own block further down, together with the dated
  // history it is meaningless without.

  run('programme', async () => {
    const cps = await q.select('client_programs',
      `client_id=eq.${id}&active=is.true&select=program_id,start_date,repeat,day_map,coach_id,workout_programs(title,weeks)&order=created_at.desc&limit=1`)
    const asg = list(cps)[0]
    if (!asg) return null
    const sessions = list(await q.select('program_sessions',
      `program_id=eq.${asg.program_id}&select=id,week,dow,position,title,focus,exercises,finisher,label`))
    const cycleWeeks = sessions.reduce((mx, s) => Math.max(mx, s.week || 1), 1)
    return {
      asg, sessions, cycleWeeks,
      title: asg.workout_programs?.title || 'Your program',
      programWeeks: asg.workout_programs?.weeks || cycleWeeks,
      dayMap: asg.day_map || [],
      byCoach: !!asg.coach_id,
    }
  })

  run('plans', async () => list(await q.select('workout_plans',
    `client_id=eq.${id}&select=id,title,focus,exercises,finisher,created_at,scheduled_for,assigned_by&created_at=gte.${fromIso}&order=created_at.desc&limit=40`)))

  run('completions', async () => list(await q.select('workout_completions',
    `client_id=eq.${id}&completed_on=gte.${from}&select=completed_on,source,created_at&order=completed_on.desc`)))

  run('loads', async () => list(await q.select('session_loads',
    `client_id=eq.${id}&session_on=gte.${from}&select=session_on,rpe,duration_min,load&order=session_on.desc`)))

  run('lifts', async () => list(await q.select('lift_entries',
    `client_id=eq.${id}&performed_on=gte.${addDays(today, -56)}&select=name,weight,performed_on&order=performed_on.desc&limit=60`)))

  run('nutrition', async () => list(await q.select('nutrition_logs',
    `client_id=eq.${id}&logged_at=gte.${fromIso}&logged_at=lt.${toIso}&select=calories,protein_g,carbs_g,fat_g,fibre_g,logged_at,meal_type,name,source&order=logged_at.desc`)))

  run('foodDays', async () => list(await q.select('food_day_complete',
    `client_id=eq.${id}&day=gte.${from}&select=day,completed_at`)))

  run('steps', async () => list(await q.select('daily_steps',
    `client_id=eq.${id}&day=gte.${from}&select=day,steps,water_ml,updated_at&order=day.desc`)))

  run('measurements', async () => list(await q.select('body_measurements',
    `client_id=eq.${id}&select=measured_at,weight_kg,waist_cm&order=measured_at.desc&limit=12`)))

  run('readiness', async () => list(await q.select('readiness_checkins',
    `client_id=eq.${id}&checked_on=gte.${from}&select=*&order=checked_on.desc`)))

  run('weekly', async () => list(await q.select('weekly_checkins',
    `client_id=eq.${id}&select=created_at,energy,sleep,nutrition,training,wins&order=created_at.desc&limit=4`)))

  run('soreness', async () => list(await q.select('soreness_logs',
    `client_id=eq.${id}&logged_on=gte.${from}&select=logged_on,body_region,pain&order=logged_on.desc&limit=10`)))

  run('strava', async () => list(await q.select('strava_connections',
    `client_id=eq.${id}&select=athlete_name,connected_at`))[0] || null)

  run('chats', async () => list(await q.select('brain_chats',
    `client_id=eq.${id}&select=question,answer,created_at,used&order=created_at.desc&limit=6`)))

  run('memory', async () => list(await q.select('coach_memory',
    `client_id=eq.${id}&brand=eq.${brand || 'none'}&select=key,value,source&order=updated_at.desc&limit=40`)))

  run('recipes', async () => list(await q.select('recipes',
    `client_id=eq.${id}&select=id,title,calories,protein_g,carbs_g,fat_g,fibre_g,tags,client_id&order=created_at.desc&limit=30`)))

  // The dated target trail always rides along with targets, because scoring a
  // past day against today's target is the bug macro_target_history exists to
  // stop.
  if (want.has('targets')) {
    jobs.push((async () => {
      raw.targets = list(await q.select('macro_targets', `client_id=eq.${id}&select=*`))[0] || null
      raw.targetHistory = list(await q.select('macro_target_history',
        `client_id=eq.${id}&select=effective_from,calories,protein_g,carbs_g,fat_g,fibre_g&order=effective_from.desc&limit=24`))
    })())
  }

  // Is last week reviewable, and has it been reviewed already? Deterministic, so
  // the rule does not need the model to tell it.
  if (want.has('review')) {
    jobs.push((async () => {
      const period = lastCompleteWeek(today)
      const existing = await q.select('coach_reviews',
        `client_id=eq.${id}&brand=eq.${brand || 'none'}&period_start=eq.${period.start}&select=id,created_at`)
      raw.review = {
        periodStart: period.start,
        periodEnd: period.end,
        // Available from the Monday after the week ends. weekStart(today) moving
        // past period.end is exactly that condition.
        available: weekStart(today) > period.end,
        exists: existing === null ? false : list(existing).length > 0,
        tableMissing: existing === null,
      }
    })())
  }

  await Promise.all(jobs)

  const ctx = buildContext(raw, { now, today, brand })
  if (raw.review) ctx.review = raw.review
  ctx.scope = scope
  return ctx
}
