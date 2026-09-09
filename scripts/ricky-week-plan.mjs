// Ricky's own 7-day plan and shopping list.
//
// Drives the deployed meal-plan function the same way the app does — seven day
// calls with a growing avoid list, then one shopping call over the lot — so no
// API key has to come out of Netlify to run it, and it exercises the exact path
// his clients will use.
//
// His numbers: 45, 87kg, 4 gym days, cooks from scratch, just lost 2 stone on
// Mounjaro with muscle lost alongside it. That last part sets the targets: a
// modest deficit and high protein, because an aggressive cut on top of GLP-1
// muscle loss takes the muscle he's trying to keep.
//
// Run: node scripts/ricky-week-plan.mjs [deploy-url]
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = process.argv[2] || 'https://rick-fit.netlify.app'
const FN = SITE.replace(/\/$/, '') + '/.netlify/functions/meal-plan'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '.private', 'ricky')
mkdirSync(OUT, { recursive: true })

// 2100 kcal is roughly a 450 kcal deficit on his estimated maintenance. 180g
// protein is a shade over 2g/kg — deliberately at the top of the range, because
// holding muscle through a deficit is the whole job here.
const T = { calories: 2100, protein_g: 180, carbs_g: 187, fat_g: 70 }
// The snack note earns its place: the week's protein pool keeps the shop small,
// but applied to the snack slot it produced "pork loin and grapes" and a beef
// broth at 9pm. A snack is a thing you take out of the fridge, not a fourth cook.
const PREFS = 'British — UK ingredients, UK supermarket names, metric weights, no American products or portions. He cooks from scratch and enjoys it. Appetite is likely still suppressed after Mounjaro, so protein must be dense rather than bulky — he may not manage a big volume in one sitting. Weeknight dinners under 30 minutes; a bigger cook at the weekend is fine. THE SNACK IS NOT A COOKED DISH and is exempt from the week\'s protein pool — it should be something simple and high-protein straight from the fridge or cupboard: Greek yogurt, cottage cheese, a whey shake, skyr, nuts, or a boiled egg.'
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const post = async (body) => {
  const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!(r.headers.get('content-type') || '').includes('json')) throw new Error(`HTTP ${r.status} — timed out at the edge`)
  return r.json()
}

// Shape of the week first: a small pool of proteins so the shop stays sane, and
// a different cuisine each day so the meals don't.
const skel = await post({ ...T, meals: 3, snacks: true, preferences: PREFS, skeleton: true, days: 7 })
if (!skel.themes?.length) { console.error('skeleton failed —', skel.error); process.exit(1) }
console.log('proteins:', skel.proteins.join(', '))
console.log('days:', skel.themes.map((t) => t.cuisine).join(', '), '\n')

const built = []
for (const [i, label] of DAYS.entries()) {
  process.stdout.write(`${label} … `)
  const j = await post({
    ...T, meals: 3, snacks: true, preferences: PREFS,
    weekDay: true, dayLabel: label,
    theme: skel.themes[i], proteins: skel.proteins,
    avoid: built.flatMap((d) => d.meals.map((m) => m.title)),
  })
  if (!j.day?.meals?.length) { console.log('FAILED —', j.error); break }
  built.push(j.day)
  console.log(j.day.meals.map((m) => m.title).join(' / '))
}

process.stdout.write('shopping … ')
const s = await post({ ...T, shoppingFor: built.flatMap((d) => d.meals) })
console.log(s.shopping ? `${s.shopping.reduce((n, g) => n + g.items.length, 0)} items` : `FAILED — ${s.error}`)

const L = []
L.push('# Ricky — 7-day plan\n')
L.push(`**${T.calories} kcal · ${T.protein_g}g protein · ${T.carbs_g}g carbs · ${T.fat_g}g fat a day.**\n`)
L.push('About a 450 kcal deficit — deliberately modest. You have just lost 2 stone and some muscle with it, and a harder cut on top of that takes more of the muscle you are trying to build back. The protein is high for the same reason. Four meals a day rather than three big ones, because appetite is likely still suppressed.\n')

for (const [i, d] of built.entries()) {
  const kcal = d.meals.reduce((n, x) => n + (x.calories || 0), 0)
  const pro = d.meals.reduce((n, x) => n + (x.protein_g || 0), 0)
  L.push(`## ${DAYS[i]}`)
  L.push(`*${kcal} kcal · ${pro}g protein*\n`)
  for (const x of d.meals) {
    L.push(`**${x.name} — ${x.title}**  `)
    L.push(`${x.description}  `)
    L.push(`*${x.calories} kcal · ${x.protein_g}g P · ${x.carbs_g}g C · ${x.fat_g}g F*\n`)
  }
}

L.push('## Shopping list\n')
let count = 0
for (const g of s.shopping || []) {
  L.push(`### ${g.aisle}`)
  for (const it of g.items) { L.push(`- [ ] ${it}`); count++ }
  L.push('')
}

const dest = join(OUT, 'ricky-week-plan.md')
writeFileSync(dest, L.join('\n'))

// The markdown is for reading; this is the same plan in the shape the app
// stores in client_meal_plans.plan — [{ label, meals: [{ name, detail, kcal }] }],
// per PlanView in src/MealPlans.jsx. Emitting it here means publishing never
// has to parse the prose back out again.
const planJson = built.map((d, i) => ({
  label: DAYS[i],
  meals: d.meals.map((x) => ({
    name: `${x.name} — ${x.title}`,
    detail: `${x.description} · ${x.protein_g}g protein`,
    kcal: x.calories,
  })),
}))
const jsonDest = join(OUT, 'ricky-week-plan.json')
writeFileSync(jsonDest, JSON.stringify({ targets: T, plan: planJson, shopping: s.shopping || [] }, null, 2))

// Check it before handing it over rather than trusting it.
const titles = built.flatMap((d) => d.meals.map((x) => x.title.toLowerCase()))
const dupes = [...new Set(titles.filter((t, i) => titles.indexOf(t) !== i))]
const offs = built.map((d) => Math.round((d.meals.reduce((n, x) => n + (x.calories || 0), 0) - T.calories) / T.calories * 100))
console.log(`\ndays ${built.length}/7 · meals ${titles.length} · shopping ${count} items`)
console.log(`calories off target: ${offs.map((x) => (x > 0 ? '+' : '') + x + '%').join(', ')}`)
console.log(dupes.length ? `REPEATED: ${dupes.join(', ')}` : 'no repeated meals')
console.log('->', dest)
