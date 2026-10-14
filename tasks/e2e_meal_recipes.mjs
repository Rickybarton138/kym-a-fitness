// End-to-end for the meal planner's recipe + cost additions.
//
//   node tasks/e2e_meal_recipes.mjs                      (local netlify dev)
//   node tasks/e2e_meal_recipes.mjs https://rick-fit.netlify.app
//
// What this is actually checking, which the unit tests cannot:
//
//   Ingredients come back WITH the day. If they don't, the shopping list falls
//   back to guessing from a one-line description and the recipe card has
//   nothing to show.
//
//   The shopping list is built from those ingredient lines. The failure this
//   guards is subtle: the list still looks fine when it is inferred instead of
//   summed, so only a coverage check catches it.
//
//   The cost either comes back whole or not at all. A total that does not match
//   its list is the one outcome worse than no total.
//
//   The recipe action refuses an unauthenticated caller BEFORE it does anything
//   else — including before it complains about a bad body.
//
// No production account is touched and nothing is logged to a food diary: this
// only calls the planner, which writes nothing.
import { PRICE_KEYS } from '../src/mealPrices.js'

const SITE = process.argv[2] || 'http://localhost:8899'
const FN = SITE.replace(/\/$/, '') + '/.netlify/functions/meal-plan'

const TARGETS = { calories: 2400, protein_g: 180, carbs_g: 240, fat_g: 80 }
const BASE = { ...TARGETS, meals: 3, options: 1, snacks: false, dietary: '', allergies: '', preferences: '', wantIngredients: true }

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  (' + detail + ')' : ''}`) }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}

async function post(body, extraHeaders = {}) {
  const t0 = Date.now()
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  })
  let j = {}
  try { j = await res.json() } catch { /* leave empty */ }
  return { status: res.status, secs: ((Date.now() - t0) / 1000).toFixed(1), ...j }
}

// Words worth looking for in a shopping list. Strips the quantity and the
// adjectives so "180g skinless chicken thigh fillets" reduces to something a
// list line can plausibly contain.
const foodWords = (line) =>
  String(line)
    .toLowerCase()
    .replace(/[\d.]+\s*(kg|g|ml|l)\b/g, ' ')
    .replace(/^\s*[\d.]+\s*/, ' ')
    .replace(/\b(fresh|dried|frozen|tinned|canned|skinless|boneless|chopped|diced|sliced|minced|large|medium|small|ripe|raw|cooked|lean|low-fat|reduced-fat|wholemeal|wholewheat|of|a|the|and)\b/g, ' ')
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3)

console.log(`meal planner recipes + cost — ${SITE}\n`)

// --- 1. The recipe action is shut to anyone without a session ---------------
// First, because it is the only new thing here that spends model budget per tap
// on what was an entirely open endpoint.
console.log('authentication')
const noAuth = await post({ method: true, title: 'Chicken and rice', ingredients: ['180g chicken thigh fillets', '75g basmati rice'] })
ok('the recipe action refuses a caller with no session', noAuth.status === 401, `status ${noAuth.status}`)
ok('the refusal says what to do about it', /sign in|session/i.test(noAuth.error || ''), noAuth.error)
const badAuth = await post({ method: true, title: 'x', ingredients: ['1 egg'] }, { authorization: 'Bearer not-a-real-token' })
ok('a junk token is refused too', badAuth.status === 401, `status ${badAuth.status}`)
// Auth before validation. If the order were the other way round, an anonymous
// caller could map out the endpoint's body rules by reading its 400s.
const noBody = await post({ method: true })
ok('auth is checked before the body is', noBody.status === 401, `status ${noBody.status}`)

// --- 2. A day, with its ingredients ----------------------------------------
console.log('\na day of the week plan')
const skel = await post({ ...BASE, skeleton: true, days: 3 })
ok('a skeleton comes back', Array.isArray(skel.themes) && skel.themes.length === 3, skel.error || `${skel.secs}s`)

const day = await post({ ...BASE, weekDay: true, dayLabel: 'Today', theme: skel.themes?.[0] || null, proteins: skel.proteins || [], avoid: [] })
const meals = day.day?.meals || []
ok('the day comes back', meals.length >= 3, day.error || `${meals.length} meals in ${day.secs}s`)
// The 10s synchronous cap is why the week is built a day at a time. Adding
// ingredients to this call makes its output bigger, so the margin matters.
ok('the day is well inside the edge timeout', Number(day.secs) < 15, `${day.secs}s`)
ok('every meal has ingredients', meals.length > 0 && meals.every((m) => m.ingredients?.length >= 2),
  meals.map((m) => `${m.name}:${m.ingredients?.length || 0}`).join(' '))
ok('every ingredient line states a quantity', meals.every((m) => (m.ingredients || []).every((i) => /\d/.test(i))),
  meals.flatMap((m) => m.ingredients || []).filter((i) => !/\d/.test(i)).join(' | ') || 'all quantified')
ok('ingredients are not a whole-batch recipe', meals.every((m) => (m.ingredients || []).length <= 24))

// --- 3. The shopping list, summed from those lines -------------------------
console.log('\nthe shopping list')
const shop = await post({ ...BASE, shoppingFor: meals })
const groups = shop.shopping || []
const items = groups.flatMap((g) => g.items)
ok('a shopping list comes back', groups.length > 0 && items.length > 0, shop.error || `${items.length} lines in ${shop.secs}s`)
ok('grouped by aisle', groups.every((g) => g.aisle && g.items.length), groups.map((g) => g.aisle).join(', '))
// The rule that proves it was summed rather than re-imagined: a line must name
// an ingredient, never a meal.
const namesAMeal = items.filter((it) => meals.some((m) => m.title && it.toLowerCase().includes(m.title.toLowerCase().slice(0, 14))))
ok('no line names a meal instead of an ingredient', namesAMeal.length === 0, namesAMeal.join(' | '))
ok('every line states a quantity', items.every((it) => /\d/.test(it)), items.filter((it) => !/\d/.test(it)).join(' | ') || 'all quantified')

// Coverage: the main ingredients of every meal should be findable in the list.
// This is the check that fails when the list is inferred from descriptions
// instead of summed from ingredients — the list still READS fine, it just
// quietly misses things the recipe tells him to cook with.
const allIngredients = meals.flatMap((m) => m.ingredients || [])
const listText = items.join(' ').toLowerCase()
const missed = allIngredients.filter((i) => {
  const words = foodWords(i)
  return words.length > 0 && !words.some((w) => listText.includes(w.slice(0, Math.max(4, w.length - 1))))
})
const covered = allIngredients.length - missed.length
ok('the list covers the ingredients it was built from',
  allIngredients.length > 0 && covered / allIngredients.length >= 0.8,
  `${covered}/${allIngredients.length} covered; missed: ${missed.slice(0, 6).join(' | ') || 'none'}`)

// --- 4. The cost ------------------------------------------------------------
console.log('\nthe cost')
const cost = shop.cost
ok('a cost comes back with the list', !!cost, cost ? `£${cost.gbp?.toFixed(2)}` : 'none — the list is still usable without one')
if (cost) {
  ok('one entry per line, so nothing is mispriced by a shifted match', cost.total === items.length, `${cost.total} vs ${items.length} lines`)
  ok('the total is a real figure', typeof cost.gbp === 'number' && cost.gbp > 0, `£${cost.gbp}`)
  ok('most lines matched a price', cost.priced / cost.total >= 0.6, `${cost.priced}/${cost.total} priced`)
  ok('unpriced lines are named, not counted as free', Array.isArray(cost.unpriced) && cost.priced + cost.unpriced.length === cost.total,
    `${cost.unpriced?.length} unpriced: ${(cost.unpriced || []).slice(0, 5).join(' | ')}`)
  ok('the figure carries the date its prices came from', !!cost.asOf, cost.asOf)
  // A week's shop for one person at these targets. Wide bounds on purpose —
  // this is here to catch a unit slip of 10x or 100x, not to police groceries.
  ok('the total is in a sane range for ONE day of food', cost.gbp > 3 && cost.gbp < 40, `£${cost.gbp.toFixed(2)} — this shops a single day's meals, not the 3-day skeleton`)
}

// --- 5. A swapped meal arrives in the same shape ----------------------------
console.log('\na swapped meal')
const sw = await post({ ...BASE, swapMeal: 'Dinner', mealCalories: 800, mealProtein: 60, avoid: meals.map((m) => m.title) })
const opt = sw.options?.[0]
ok('a replacement comes back', !!opt, sw.error || `${sw.secs}s`)
ok('the replacement brings its own ingredients', (opt?.ingredients?.length || 0) >= 2,
  `${opt?.ingredients?.length || 0} lines`)
ok('a swap is not a card with no recipe behind it', !!opt && /\d/.test((opt.ingredients || []).join(' ')))

console.log(`\nprice table: ${PRICE_KEYS.length} keys`)
console.log(`${pass} pass / ${fail} fail`)
process.exit(fail ? 1 : 0)
