// The meal planner at the size Ricky actually uses it: a full 7 days, 4 meals
// a day plus a snack, with ingredients and the shopping cost.
//
//   node tasks/e2e_meal_week_stress.mjs https://rick-fit.netlify.app
//
// Why this exists separately from e2e_meal_recipes.mjs, which tests 3 meals of
// one day: adding ingredients to each meal made the shopping call's INPUT
// several times bigger, and that call now makes two model requests in a row —
// the list, then the price tagging. A week is around 35 meals and 200
// ingredient lines. If that pair runs past the edge's synchronous cap the whole
// response dies and the client loses the shopping list, not just the total,
// which is a feature that worked before this change.
//
// So the assertion that matters most here is not "the cost is right". It is
// "the LIST still comes back", and the timings that say how close to the cap
// the request is running.
//
// Calls only the unauthenticated planner actions. Writes nothing, touches no
// account, logs no food.

import { E2E_TOKEN, authed, noTokenNotice } from './_e2eToken.mjs'

const SITE = process.argv[2] || 'https://rick-fit.netlify.app'
const FN = SITE.replace(/\/$/, '') + '/.netlify/functions/meal-plan'
const DAYS = Number(process.argv[3]) || 7

// The heaviest realistic shape: most meals, most slots, snack included.
const BASE = {
  calories: 2400, protein_g: 180, carbs_g: 240, fat_g: 80,
  meals: 4, options: 1, snacks: true,
  dietary: '', allergies: '', preferences: '', wantIngredients: true,
}

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  (' + detail + ')' : ''}`) }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}

async function post(body) {
  const t0 = Date.now()
  const res = await fetch(FN, {
    method: 'POST', headers: authed(), body: JSON.stringify(body),
  })
  let j = {}
  try { j = await res.json() } catch { /* leave empty */ }
  return { status: res.status, ms: Date.now() - t0, ...j }
}

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const label = (i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WD[(new Date().getDay() + i) % 7])

console.log(`full week stress — ${SITE}\n${DAYS} days, ${BASE.meals} meals + snack, ingredients on\n`)

if (!E2E_TOKEN) {
  // This script is the only guard on the full-week shopping list, so a vacuous
  // green run would be worse than no run at all.
  console.log(noTokenNotice('a full week of the meal planner'))
  process.exit(0)
}

const skel = await post({ ...BASE, skeleton: true, days: DAYS })
ok('skeleton', Array.isArray(skel.themes) && skel.themes.length === DAYS, `${skel.ms}ms`)

const meals = []
const dayTimes = []
for (let i = 0; i < DAYS; i++) {
  const d = await post({
    ...BASE, weekDay: true, dayLabel: label(i),
    theme: skel.themes?.[i] || null, proteins: skel.proteins || [],
    avoid: meals.map((m) => m.title),
  })
  dayTimes.push(d.ms)
  const got = d.day?.meals || []
  const ing = got.reduce((s, m) => s + (m.ingredients?.length || 0), 0)
  ok(`day ${i + 1} (${label(i)}): ${got.length} meals, ${ing} ingredient lines`,
    got.length >= BASE.meals && ing >= got.length * 2, d.error || `${(d.ms / 1000).toFixed(1)}s`)
  meals.push(...got)
}
// Thresholds set from measurement, not from the "10s synchronous cap" that
// older comments in this repo cite. A 21.4s shopping request was observed to
// complete on this site, so the real limit is well above 10s — but a day
// drifting past 15s would still mean the per-day design is no longer buying
// the headroom it exists for.
const slowestDay = Math.max(...dayTimes)
ok('no single day is drifting towards a timeout', slowestDay < 15000, `slowest ${(slowestDay / 1000).toFixed(1)}s`)

const lines = meals.reduce((s, m) => s + (m.ingredients?.length || 0), 0)
console.log(`\n${meals.length} meals, ${lines} ingredient lines going into the shop\n`)

const shop = await post({ ...BASE, shoppingFor: meals })
const groups = shop.shopping || []
const items = groups.flatMap((g) => g.items)
// The one that must not regress.
ok('THE SHOPPING LIST SURVIVES A FULL WEEK', items.length > 0, shop.error || `${items.length} lines in ${(shop.ms / 1000).toFixed(1)}s`)
ok('the whole shopping request stays well inside the limit', shop.ms < 15000, `${(shop.ms / 1000).toFixed(1)}s`)
ok('the list is not absurdly long for one person', items.length > 0 && items.length < 120, `${items.length} lines`)

if (shop.cost) {
  ok('a cost came back too', true, `£${shop.cost.gbp.toFixed(2)} for ${DAYS} days`)
  ok('one cost entry per line', shop.cost.total === items.length, `${shop.cost.total} vs ${items.length}`)
  ok('most lines priced', shop.cost.priced / shop.cost.total >= 0.6, `${shop.cost.priced}/${shop.cost.total}`)
  const perDay = shop.cost.gbp / DAYS
  ok('per-day cost is plausible for one person', perDay > 1 && perDay < 40, `£${perDay.toFixed(2)}/day`)
} else {
  // Not a failure. The cost is time-boxed precisely so that it is the thing
  // dropped when the request is tight, rather than the list.
  console.log('  --   no cost: dropped to protect the list, which is the designed behaviour')
}

// A single day with recipes on is a different shape again: up to 3 options per
// meal, each needing ingredients, against the same token budget.
console.log('\nsingle-day plan with options and ingredients')
const day1 = await post({ ...BASE, meals: 4, options: 3, snacks: true })
const opts = (day1.meals || []).flatMap((m) => m.options || [])
ok('a day of options comes back', opts.length >= 8, day1.error || `${opts.length} options in ${(day1.ms / 1000).toFixed(1)}s`)
ok('it did not truncate', opts.length > 0 && opts.every((o) => o.title && o.calories > 0))
ok('the options carry ingredients', opts.length > 0 && opts.every((o) => (o.ingredients?.length || 0) >= 2),
  `${opts.filter((o) => !(o.ingredients?.length >= 2)).length} without`)
ok('a day of options stays inside the limit', day1.ms < 22000, `${(day1.ms / 1000).toFixed(1)}s`)

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail ? 1 : 0)
