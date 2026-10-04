// What to suggest next, decided in code.
//
// PURE, and deliberately so. The model is good at writing a sentence about facts
// it has been handed; it is the wrong tool for "is a session due today", which is
// a lookup with one right answer. So the rules below choose the action and the
// evidence, and the model is only ever asked to phrase the result. That also
// means the whole priority order is unit-testable and cannot drift with a prompt
// change, and the card still works when the AI call fails.
//
// Runs on the CLIENT as well as the server, because one signal the server cannot
// see is whether a session is open on THIS device: startSessionNow() writes
// sessionStorage.cbk_gw_active and WorkoutRows keeps the draft in localStorage.
// `local` carries that in.

import { londonHour, isoDow } from './coachTime.js'

// Lower number wins. Gaps left so a rule can be slotted in without renumbering.
export const PRIORITIES = {
  resume_session: 10,
  readiness: 20,
  start_session: 30,
  log_food: 40,
  protein_gap: 50,
  weekly_review: 60,
  close_food_day: 70,
  steps: 80,
  water: 85,
  measure: 90,
  rest: 100,
}

const action = (key, title, reason, actions, extra = {}) => ({
  key, priority: PRIORITIES[key], title, reason, actions, ...extra,
})

/**
 * The prioritised next action.
 *
 * ctx   — from buildContext()
 * local — device-only signals: { resumeSessionId, resumeTitle, dismissedKeys, snoozedUntil }
 * now   — injected for tests
 */
export function nextAction(ctx, local = {}, now = new Date()) {
  const candidates = candidateActions(ctx, local, now)
  const dismissed = new Set(local.dismissedKeys || [])
  const live = candidates.filter((c) => !dismissed.has(c.key))
  live.sort((a, b) => a.priority - b.priority)
  return live[0] || fallbackAction(ctx)
}

/** Every rule that fires, in priority order. Exposed so tests can assert the set. */
export function candidateActions(ctx, local = {}, now = new Date()) {
  const out = []
  const hour = londonHour(now)
  const t = ctx.training
  const n = ctx.nutrition
  const d = ctx.daily

  // 1. A session is open on this device. Nothing else matters while a set is
  // half-logged, and this is the one rule the server cannot decide alone.
  if (local.resumeSessionId) {
    out.push(action('resume_session',
      'Finish your session',
      local.resumeTitle ? `${local.resumeTitle} is still open on this phone.` : 'A session is still open on this phone.',
      [{ label: 'Resume session', screen: 'train' }],
      { evidence: ['Session open on this device'] }))
  }

  // 2. Readiness before a planned session, so the adjustment can be offered
  // before they start rather than after.
  if (t && t.plannedToday && !t.completedToday && ctx.checkins && !ctx.checkins.readinessToday && hour >= 5) {
    out.push(action('readiness',
      'Quick check before you train',
      `${t.plannedToday.title} is on today. Four taps and I will tell you whether to keep it as it is.`,
      [{ label: 'Check in', screen: 'readiness' }, { label: 'Skip to session', screen: 'train' }],
      { evidence: [`Planned today: ${t.plannedToday.title}`, 'No readiness check-in today'] }))
  }

  // 3. Planned and not done.
  if (t && t.plannedToday && !t.completedToday) {
    out.push(action('start_session',
      t.plannedToday.title,
      `Today's session from ${t.programme ? t.programme.title : 'your plan'}${t.programme?.week ? `, week ${t.programme.week}` : ''}.`,
      [{ label: 'Start session', screen: 'train' }, { label: 'Adjust today', screen: 'readiness' }],
      { evidence: [`Planned today: ${t.plannedToday.title}`, 'Not yet logged as complete'] }))
  }

  // 4. Nothing logged and the day is well under way. Not before 11:00 — plenty
  // of people do not eat before then, and nagging about it at 08:00 is noise.
  if (n && !n.today.logged && hour >= 11) {
    out.push(action('log_food',
      'Nothing logged yet today',
      n.target
        ? `Your target is ${n.target.calories} kcal and ${n.target.protein_g}g protein. Easier to hit if the day is written down.`
        : 'Log what you have had and I can tell you what is left.',
      [{ label: 'Log food', screen: 'food' }, { label: 'Choose a meal', screen: 'mealplan' }],
      { evidence: ['Food today: nothing logged yet'] }))
  }

  // 5. Protein short with the evening still to come. Protein specifically,
  // because it is the macro a day can still be rescued on.
  if (n && n.today.logged && n.target && n.target.protein_g && hour >= 14 && hour < 21) {
    const got = n.today.totals.protein_g
    const left = n.target.protein_g - got
    if (left >= Math.max(25, n.target.protein_g * 0.25)) {
      out.push(action('protein_gap',
        `${left}g of protein to go`,
        `You are on ${got}g of ${n.target.protein_g}g with the evening left.`,
        [{ label: 'Choose a meal', screen: 'mealplan' }, { label: 'Log food', screen: 'food' }],
        { evidence: [`Protein today: ${got}g of ${n.target.protein_g}g`, `Logged ${n.today.items} items`] }))
    }
  }

  // 6. A finished week with no review yet. Monday or later, so the week being
  // reviewed is actually over.
  if (ctx.review && ctx.review.available && !ctx.review.exists) {
    out.push(action('weekly_review',
      'Your week is ready to look at',
      `${ctx.review.periodStart} to ${ctx.review.periodEnd}: planned against done, food, steps and what to change.`,
      [{ label: 'See the review', screen: 'review' }],
      { evidence: [`Week ${ctx.review.periodStart} to ${ctx.review.periodEnd} complete`, 'No review saved yet'] }))
  }

  // 7. Logged all day and never closed it off, late on. The flag is what makes
  // adherence measurable, so it is worth one ask.
  if (n && n.today.logged && !n.today.complete && hour >= 20 && n.today.items >= 2) {
    out.push(action('close_food_day',
      'Finish off today',
      `${n.today.items} things logged. Mark the day done and it counts towards your week.`,
      [{ label: 'Food diary', screen: 'food' }],
      { evidence: [`Food today: ${n.today.items} items, day not marked complete`] }))
  }

  // 8. Steps — only where there is a target AND a reading. No reading is not
  // zero steps, and saying so would be a lie about a tracker they never set up.
  if (d && d.steps.target && d.steps.today !== null && hour >= 15) {
    const short = d.steps.target - d.steps.today
    if (short > d.steps.target * 0.35) {
      out.push(action('steps',
        'Worth a walk',
        `${d.steps.today.toLocaleString('en-GB')} of ${d.steps.target.toLocaleString('en-GB')} steps so far.`,
        [{ label: 'Log steps', screen: 'home' }],
        { evidence: [`Steps today: ${d.steps.today} of ${d.steps.target}`] }))
    }
  }

  // 9. Water, same rule about a missing reading.
  if (d && d.water.targetMl && d.water.todayMl !== null && hour >= 16) {
    if (d.water.todayMl < d.water.targetMl * 0.5) {
      out.push(action('water',
        'Drink something',
        `${(d.water.todayMl / 1000).toFixed(1)}L of ${(d.water.targetMl / 1000).toFixed(1)}L today.`,
        [{ label: 'Log water', screen: 'home' }],
        { evidence: [`Water today: ${d.water.todayMl}ml of ${d.water.targetMl}ml`] }))
    }
  }

  // 10. A fortnight with no measurement, on a Sunday, so progress stays visible.
  if (ctx.body && isoDow(ctx.today) === 7) {
    const stale = !ctx.body.latest || ctx.body.latest.day < addDaysSafe(ctx.today, -14)
    if (stale) {
      out.push(action('measure',
        'Time for a weigh-in',
        ctx.body.latest ? `Last one was ${ctx.body.latest.day}.` : 'Nothing recorded yet, so there is no trend to show you.',
        [{ label: 'Record it', screen: 'body' }],
        { evidence: [ctx.body.latest ? `Last measurement ${ctx.body.latest.day}` : 'No measurements recorded'] }))
    }
  }

  // 11. Trained today, or a genuine rest day.
  if (t && t.completedToday) {
    out.push(action('rest',
      'That is today done',
      t.lastCompleted ? `${t.lastCompleted.title} logged. Eat enough and sleep.` : 'Training logged. Eat enough and sleep.',
      [{ label: 'Log food', screen: 'food' }],
      { evidence: ['Training logged today'] }))
  } else if (t && t.programme && !t.plannedToday) {
    out.push(action('rest',
      'Rest day',
      t.nextPlanned
        ? `Nothing scheduled. Next up is ${t.nextPlanned.title}${t.nextPlanned.inDays === 1 ? ' tomorrow' : ` in ${t.nextPlanned.inDays} days`}.`
        : 'Nothing scheduled today.',
      [{ label: 'Train anyway', screen: 'train' }, { label: 'Log food', screen: 'food' }],
      { evidence: ['No session scheduled today'] }))
  }

  return out.sort((a, b) => a.priority - b.priority)
}

function addDaysSafe(day, n) {
  const [y, m, d] = String(day).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/**
 * What to say when no rule fires — which is a real state, not an error: a new
 * account with nothing in it, or a rest day on no programme.
 */
export function fallbackAction(ctx) {
  const missing = ctx.missing || []
  if (missing.includes('targets')) {
    return action('log_food', 'Set your targets',
      'Once there are numbers to aim at I can tell you where you are against them.',
      [{ label: 'Set targets', screen: 'calc' }], { evidence: ['No macro targets saved'] })
  }
  if (missing.includes('programme')) {
    return action('start_session', 'Pick something to train',
      'No programme on the go, so nothing is scheduled. Build one or train ad hoc.',
      [{ label: 'Train', screen: 'train' }], { evidence: ['No active programme'] })
  }
  return action('rest', 'Nothing urgent',
    'Nothing needs doing this minute. Log your food as you go and I will keep an eye on the week.',
    [{ label: 'Log food', screen: 'food' }], { evidence: ['No rule triggered'] })
}

/**
 * Feedback after a CONFIRMED save. Deterministic: the comparison, the numbers
 * and whether there is enough evidence to say anything are all decided here.
 * `kind` is 'workout' | 'meal' | 'steps' | 'checkin'.
 */
export function feedbackFor(kind, ctx, payload = {}) {
  if (kind === 'workout') return workoutFeedback(ctx, payload)
  if (kind === 'meal') return mealFeedback(ctx, payload)
  if (kind === 'steps') return stepsFeedback(ctx, payload)
  if (kind === 'checkin') return checkinFeedback(ctx, payload)
  return null
}

function workoutFeedback(ctx, payload) {
  const session = payload.session || ctx.training?.lastCompleted || null
  if (!session) return null
  const { lifting, cardio } = session.split || { lifting: [], cardio: [] }
  const vol = session.volume || { kg: null, sets: 0, partial: true }
  const prev = payload.comparable || null

  const facts = []
  if (lifting.length) {
    facts.push(`Lifting: ${lifting.length} exercises, ${vol.sets} sets${vol.kg != null ? `, ${vol.kg}kg of total volume` : ''}`)
    if (vol.partial) facts.push('Some sets had no weight recorded, so the volume figure is partial')
  }
  if (cardio.length) facts.push(`Cardio: ${cardio.map((c) => `${c.name} ${c.reps || ''}`.trim()).join(', ')}`)

  let comparison = null
  if (prev && prev.volume && vol.kg != null && prev.volume.kg != null && !vol.partial && !prev.volume.partial) {
    const diff = vol.kg - prev.volume.kg
    const pct = Math.round((diff / prev.volume.kg) * 100)
    comparison = {
      against: prev.day,
      matchedOn: prev.matchedOn,
      deltaKg: diff,
      deltaPct: pct,
      text: `${diff >= 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% on ${prev.day} (${vol.kg}kg against ${prev.volume.kg}kg)`,
    }
    facts.push(comparison.text)
  } else if (prev) {
    // Say why there is no number rather than inventing one.
    comparison = { against: prev.day, matchedOn: prev.matchedOn, deltaKg: null, deltaPct: null,
      text: `Last ${prev.title} was ${prev.day}, but the weights logged do not line up well enough to compare` }
    facts.push(comparison.text)
  } else {
    facts.push('First session of this kind that is logged, so nothing to compare with yet')
  }

  return {
    kind: 'workout',
    title: session.title || 'Session logged',
    facts,
    comparison,
    // Only suggest a focus when there is a real comparison behind it.
    nextFocus: comparison && comparison.deltaPct != null
      ? (comparison.deltaPct >= 5
          ? 'Hold the weights where they are next time and add a rep before you add a plate.'
          : comparison.deltaPct <= -10
            ? 'That was lighter than last time. Worth checking sleep and food before pushing again.'
            : 'Near enough the same as last time. One more rep on the first two exercises next session.')
      : null,
  }
}

function mealFeedback(ctx, payload) {
  const n = ctx.nutrition
  if (!n || !n.today.logged) return null
  const got = n.today.totals
  const target = n.target
  const facts = [`Today so far: ${got.calories} kcal, ${got.protein_g}g protein, across ${n.today.items} items`]
  if (!target) {
    facts.push('No targets saved, so there is nothing to compare against')
    return { kind: 'meal', title: 'Logged', facts, incomplete: !n.today.complete, suggestions: [] }
  }
  const leftKcal = target.calories - got.calories
  const leftP = target.protein_g - got.protein_g
  facts.push(`Left: ${leftKcal} kcal and ${leftP > 0 ? `${leftP}g protein` : 'protein already met'}`)
  if (!n.today.complete) facts.push('The day is not marked complete, so this is a partial picture')

  // Recipe suggestions are filtered deterministically: fits the remaining
  // calories, helps the protein gap, and does not clash with a saved constraint.
  const avoid = avoidTerms(ctx)
  const suggestions = (ctx.recipes || [])
    .filter((r) => r.calories != null && r.calories <= Math.max(200, leftKcal))
    .filter((r) => !avoid.some((a) => matchesTerm(r, a)))
    .sort((a, b) => (b.protein_g || 0) - (a.protein_g || 0))
    .slice(0, 3)
    .map((r) => ({ id: r.id, title: r.title, calories: r.calories, protein_g: r.protein_g }))

  return {
    kind: 'meal',
    title: leftP > 0 ? `${leftP}g protein left` : 'Protein done for today',
    facts,
    incomplete: !n.today.complete,
    suggestions,
    avoided: avoid,
  }
}

/** Words to keep out of a suggestion, from saved memory and the free-text health fields. */
export function avoidTerms(ctx) {
  const out = []
  for (const m of ctx.memory || []) {
    if (/allerg|intoleran|avoid|cannot eat|can't eat|dislike|vegan|vegetarian|halal|kosher|coeliac|celiac|gluten|dairy|lactose/i.test(`${m.key} ${m.value}`)) {
      out.push(m.value)
    }
  }
  const free = [ctx.profile?.healthConditions, ctx.profile?.sensitiveNote].filter(Boolean).join(' ')
  for (const word of ['peanut', 'shellfish', 'gluten', 'dairy', 'lactose', 'egg', 'soy', 'fish', 'nut']) {
    // Word boundaries on BOTH sides. Without the leading one, "allergic to
    // shellfish" also matched the bare word `fish`, and the suggestions then
    // quietly excluded every fish dish from somebody who can eat fish. Caught
    // in the preview harness, which rendered "Kept clear of: shellfish, fish".
    if (new RegExp(`(allerg\\w*|intoleran\\w*|avoid\\w*)[^.]{0,30}\\b${word}\\b`, 'i').test(free)) out.push(word)
  }
  // Drop any term another, longer term already covers, so a saved "shellfish
  // and prawns" does not get "shellfish" listed beside it.
  const uniq = [...new Set(out)]
  return uniq.filter((t) => !uniq.some((o) => o !== t && o.toLowerCase().includes(t.toLowerCase())))
}

function matchesTerm(recipe, term) {
  const hay = `${recipe.title} ${(recipe.tags || []).join(' ')}`.toLowerCase()
  return term.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 3).some((w) => hay.includes(w))
}

function stepsFeedback(ctx, payload) {
  const d = ctx.daily
  if (!d || d.steps.today === null) return null
  const facts = [`${d.steps.today.toLocaleString('en-GB')} steps today`]
  if (d.steps.target) {
    const diff = d.steps.today - d.steps.target
    facts.push(diff >= 0 ? `${diff.toLocaleString('en-GB')} over your target` : `${Math.abs(diff).toLocaleString('en-GB')} short of ${d.steps.target.toLocaleString('en-GB')}`)
  }
  if (d.steps.weekAverage != null && d.steps.daysKnown >= 3) {
    facts.push(`Week average ${d.steps.weekAverage.toLocaleString('en-GB')} across ${d.steps.daysKnown} days recorded`)
  }
  return { kind: 'steps', title: 'Steps in', facts }
}

function checkinFeedback(ctx, payload) {
  const r = payload.readiness || ctx.checkins?.readinessToday
  if (!r) return null
  const adj = adjustmentFor(ctx, r)
  return {
    kind: 'checkin',
    title: adj.headline,
    facts: adj.facts,
    adjustment: adj,
  }
}

/**
 * What to do with today's session given a readiness check-in.
 *
 * Returns a PROPOSAL. Nothing here writes: a coach-assigned programme and
 * coach-set targets are not the app's to quietly rewrite, so the user accepts or
 * declines and the session is only ever changed with that tap.
 *
 * Scores are 1-5. Soreness is reversed: 5 means very sore.
 */
export function adjustmentFor(ctx, readiness) {
  const sleep = readiness.sleep ?? null
  const energy = readiness.energy ?? null
  const sore = readiness.soreness ?? null
  const minutes = readiness.minutes ?? readiness.minutes_available ?? null
  const planned = ctx.training?.plannedToday || null
  const facts = []
  if (sleep != null) facts.push(`Sleep ${sleep}/5`)
  if (energy != null) facts.push(`Energy ${energy}/5`)
  if (sore != null) facts.push(`Soreness ${sore}/5`)
  if (minutes != null) facts.push(`${minutes} minutes available`)

  if (!planned) {
    return { verdict: 'none', headline: 'Nothing scheduled today', facts,
      detail: 'No session planned, so there is nothing to adjust. A walk would do no harm.', changes: [] }
  }

  const low = [sleep, energy].filter((v) => v != null && v <= 2).length
  const verySore = sore != null && sore >= 4
  const short = minutes != null && minutes < 30

  if (low >= 2 || (verySore && low >= 1)) {
    return {
      verdict: 'move', headline: `Move ${planned.title}`, facts,
      detail: 'Two of your three readings are low. Training hard on top of that buys very little and costs the rest of the week.',
      changes: [{ what: 'Swap today for a walk and some mobility', to: 'rest' },
                { what: `Keep ${planned.title} for tomorrow`, to: 'tomorrow' }],
    }
  }
  if (short) {
    return {
      verdict: 'shorten', headline: `Shorten ${planned.title}`, facts,
      detail: `${minutes} minutes is enough for the first two exercises at full effort. Drop the accessories, not the main lifts.`,
      changes: [{ what: 'Keep the first two exercises, drop the rest', to: 'short' }],
    }
  }
  if (verySore) {
    return {
      verdict: 'adjust', headline: `Work around the soreness`, facts,
      detail: 'Sore but otherwise fine. Keep the session, take the loads down a notch and stop a rep or two short.',
      changes: [{ what: 'Same session, lighter, leave two reps in the tank', to: 'lighter' }],
    }
  }
  return {
    verdict: 'keep', headline: `Keep ${planned.title} as it is`, facts,
    detail: 'Readings are fine. Train as written.',
    changes: [],
  }
}
