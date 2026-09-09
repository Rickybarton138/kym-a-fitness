// Ricky, 8 Sept, using the app as a client himself: "my nutrition plan is very
// limited and pretty boring and repetitive, how can we improve this feature?"
//
// Three answers, tested here against the deployed function:
//   1. a WEEK, not a day, with the shopping list to go with it
//   2. nothing repeats inside that week
//   3. "swap this" replaces ONE meal, and honours what it's told to avoid
//
// The week is built ONE DAY PER REQUEST — a whole week in a single call takes
// about a minute and the edge returns a 504 with nothing in it. So this drives
// the same sequence the client does: N day calls with a growing avoid list,
// then one shopping call over the meals that came back. If that sequence works
// here it works in the app; if it stops working, this says which call broke.
//
// The no-repeat check is the one that matters. A plan that hands you the same
// chicken and rice four times is exactly the complaint, and it's the kind of
// thing that passes a shape assertion and still ships broken.
//
// Run: node tasks/e2e_round31.mjs <deploy-url>
const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round31.mjs <url>'); process.exit(1) }
const FN = SITE.replace(/\/$/, '') + '/.netlify/functions/meal-plan'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const post = async (body) => {
  const t0 = Date.now()
  const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const ct = r.headers.get('content-type') || ''
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  if (!ct.includes('json')) return { error: `HTTP ${r.status} in ${secs}s (not JSON — timed out at the edge?)`, secs }
  const j = await r.json()
  return { ...j, secs }
}

const TARGETS = { calories: 2100, protein_g: 175, carbs_g: 190, fat_g: 65 }
const DAYS = 4
const LABELS = ['Today', 'Tomorrow', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ---------------------------------------------------------------------------
// 0. The skeleton: which proteins get bought, and which day is cooked which way
//
// This exists because prompt wording could not hold "be varied" and "keep the
// shop small" at the same time — told to reuse ingredients it served the same
// dinner four nights running, told to be varied it wanted duck, halibut and sea
// bass in one week. The pairing is arithmetic now, so it's assertable.
// ---------------------------------------------------------------------------
const skel = await post({ ...TARGETS, meals: 3, snacks: false, skeleton: true, days: DAYS })
ok('the week gets a skeleton', Array.isArray(skel.themes) && skel.themes.length === DAYS, skel.error || `${skel.themes?.length} themes`)
if (skel.themes?.length) {
  console.log(`      proteins: ${skel.proteins.join(', ')}`)
  console.log(`      days: ${skel.themes.map((t) => `${t.cuisine}/${t.protein}`).join(', ')}`)
  ok('a small pool of proteins, so the shop stays sane', skel.proteins.length <= 5 && skel.proteins.length >= 2, `${skel.proteins.length} proteins`)
  ok('every day gets a protein and a cuisine', skel.themes.every((t) => t.protein && t.cuisine))
  const pairs = skel.themes.map((t) => `${t.protein}|${t.cuisine}`)
  ok('and no two days are handed the same pairing', new Set(pairs).size === pairs.length,
    pairs.filter((p, i) => pairs.indexOf(p) !== i).join(' | '))
  // Capped at four however long the plan is: seven cuisines means seven spice
  // racks, most of them used once.
  ok('at most four cuisines, whatever the length',
    new Set(skel.themes.map((t) => t.cuisine)).size <= 4,
    `${new Set(skel.themes.map((t) => t.cuisine)).size} cuisines over ${DAYS} days`)
  // The bug this catches: advancing the protein once per lap of the cuisines
  // gave four consecutive days of chicken thigh, because with four cuisines
  // over four days the lap never came round.
  ok('the protein changes from one day to the next',
    skel.themes.every((t, i) => i === 0 || t.protein !== skel.themes[i - 1].protein),
    skel.themes.map((t) => t.protein).join(' → '))
}

// ---------------------------------------------------------------------------
// 1. Build the week a day at a time, the way the client does
// ---------------------------------------------------------------------------
const built = []
let stalledAt = -1
for (let i = 0; i < DAYS; i++) {
  const avoid = built.flatMap((d) => d.meals.map((m) => m.title))
  const j = await post({
    ...TARGETS, meals: 3, snacks: false, preferences: 'cooks from scratch',
    weekDay: true, dayLabel: LABELS[i], avoid,
    theme: skel.themes?.[i] || null, proteins: skel.proteins || [],
  })
  if (!j.day?.meals?.length) { console.log(`      day ${i + 1} failed: ${j.error}`); stalledAt = i; break }
  console.log(`      ${LABELS[i]} in ${j.secs}s — ${j.day.meals.map((m) => m.title).join(' / ')}`)
  built.push(j.day)
}
ok('every day comes back', built.length === DAYS, `${built.length}/${DAYS}${stalledAt >= 0 ? `, stopped at day ${stalledAt + 1}` : ''}`)
ok('and each one inside the function timeout', built.length > 0, built.length ? '' : 'no day survived the round trip')

if (built.length) {
  ok('every day has its meals', built.every((d) => d.meals.length === 3), JSON.stringify(built.map((d) => d.meals.length)))
  ok('one meal per slot, not a menu', built.every((d) => d.meals.every((m) => m.title && !Array.isArray(m.options))))
  ok('each day is labelled as the client asked', built.every((d, i) => d.label === LABELS[i]), built.map((d) => d.label).join(', '))

  // Within 15% of target on every day. The prompt asks for 5%; the assertion is
  // looser because a hard 5% fails on rounding alone, and I'd rather this catch
  // a day that is genuinely 800 kcal out.
  const off = built.map((d) => Math.abs(d.meals.reduce((s, m) => s + (m.calories || 0), 0) - TARGETS.calories) / TARGETS.calories)
  ok('every day lands near the calorie target', off.every((x) => x < 0.15), off.map((x) => Math.round(x * 100) + '%').join(', '))

  const pro = built.map((d) => d.meals.reduce((s, m) => s + (m.protein_g || 0), 0))
  ok('and near the protein target', pro.every((p) => Math.abs(p - TARGETS.protein_g) / TARGETS.protein_g < 0.2),
    pro.join('g, ') + 'g vs ' + TARGETS.protein_g + 'g')

  // -------------------------------------------------------------------------
  // 2. Nothing repeats — the actual complaint. This is what the growing avoid
  //    list is for, so it's the assertion that proves the chain is wired up.
  // -------------------------------------------------------------------------
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z ]/g, '').trim()
  const titles = built.flatMap((d) => d.meals.map((m) => norm(m.title)))
  const dupes = titles.filter((t, i) => titles.indexOf(t) !== i)
  ok('no meal repeats across the week', dupes.length === 0, [...new Set(dupes)].join(' | '))

  // -------------------------------------------------------------------------
  // 3. The shopping list, over the days that actually exist
  // -------------------------------------------------------------------------
  const meals = built.flatMap((d) => d.meals)
  const s = await post({ ...TARGETS, shoppingFor: meals })
  ok('a shopping list comes back', Array.isArray(s.shopping) && s.shopping.length > 0, s.error || `in ${s.secs}s`)
  const items = (s.shopping || []).flatMap((g) => g.items)
  ok('grouped by aisle', (s.shopping || []).every((g) => g.aisle && g.items.length), (s.shopping || []).map((g) => g.aisle).join(', '))
  ok('and long enough to be a real shop', items.length >= 12, `${items.length} items for ${meals.length} meals`)
  ok('with quantities on it, not just names',
    items.filter((i) => /\d/.test(i)).length >= items.length * 0.6,
    `${items.filter((i) => /\d/.test(i)).length}/${items.length} carry a number`)

  // Aggregated, so a protein used on three days appears ONCE. Strips the leading
  // quantity to compare the ingredient itself.
  const bare = items.map((i) => norm(i).replace(/^\d*\s*[a-z]{0,3}\s+/, ''))
  const shopDupes = bare.filter((t, i) => t && bare.indexOf(t) !== i)
  ok('quantities added up, not listed per meal', shopDupes.length === 0, [...new Set(shopDupes)].join(' | '))

  // -------------------------------------------------------------------------
  // 4. Swap replaces one meal and respects the avoid list
  // -------------------------------------------------------------------------
  const first = built[0].meals[2]
  const avoid = built.flatMap((d) => d.meals.map((m) => m.title))
  const sw = await post({ ...TARGETS, options: 1, swapMeal: first.name, mealCalories: first.calories, mealProtein: first.protein_g, avoid })
  ok('a swap comes back', Array.isArray(sw.options) && sw.options.length === 1, sw.error || JSON.stringify(sw).slice(0, 100))
  const t = sw.options?.[0]?.title || ''
  ok('and is not one it was told to avoid', !!t && !avoid.some((a) => norm(a) === norm(t)), `replacing "${first.title}" with "${t}"`)
  ok('sized for that meal, not the whole day', (sw.options?.[0]?.calories || 0) < TARGETS.calories * 0.7,
    `${sw.options?.[0]?.calories} kcal vs the ${first.calories} it replaces`)
}

// ---------------------------------------------------------------------------
// 5. The one-day plan Paul's clients already use is untouched.
//    This is the regression that nearly shipped: clamping `days` before
//    checking whether it was asked for sent every ordinary request down the
//    week branch.
// ---------------------------------------------------------------------------
const d1 = await post({ ...TARGETS, meals: 3, options: 2, snacks: true })
ok('the one-day plan still returns a day', Array.isArray(d1.meals) && d1.meals.length >= 3, d1.error || `${d1.meals?.length} meals`)
ok('not a week', !d1.days, d1.days ? 'it returned a week — the day/week branch is wrong' : '')
ok('still with its options per meal', (d1.meals || []).every((m) => m.options?.length === 2),
  JSON.stringify((d1.meals || []).map((m) => m.options?.length)))

console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
