// Paul, 8 Oct, two bugs:
//
//   1. "After the update when people are manually searching out their food to
//      log, it only gives the option to add to a recipe and not to add to the
//      day/meal that they had before"
//   2. "one of my clients is editing one of her recipes she's added but it's
//      not updated the macros etc when she's saves with the new quantities"
//
// (1) was a shadowed prop. FoodSearch takes a `pick` prop that turns it from
// "log a food" into "choose an ingredient", and its body also declared
// `function pick(f)`. A function declaration is bound when the scope is
// instantiated and overwrites the parameter of the same name, so inside the
// body `pick` was ALWAYS the function — always truthy. Every client logging
// food got the ingredient-picker variant: no Meal, no Day, and a button saying
// "Add to recipe". The prop was unreachable; passing it or not made no
// difference.
//
// So the test worth having is not "does FoodSearch work" but "does any
// component shadow its own props", because that bug is invisible on review and
// the build is perfectly happy with it.
//
// (2) was not a save failure. Ingredients are free text and macros are separate
// numbers, so changing a quantity changed nothing; and recipes built from the
// ingredient picker discard the per-item macros at save, so there was nothing
// stored to recompute from. Fixed with a macros-only mode on recipe-ai that
// recosts an edited list. That one needs the network.
//
// Run: node tasks/e2e_round42.mjs [deployUrl]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'https://app.redefineacademy.com'

let failures = 0
const ok = (label, pass, extra = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
}

// --- the guard ---------------------------------------------------------------

// Walk from the opening brace of a function body to its matching close. Good
// enough for this: it is counting braces in our own source, not parsing JS.
function bodyOf(src, openBraceIndex) {
  let depth = 0
  for (let i = openBraceIndex; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(openBraceIndex, i + 1)
    }
  }
  return src.slice(openBraceIndex)
}

// Every `function Name({ a, b, c })` and the function declarations inside it
// that collide with one of those destructured names.
function shadowedProps(src) {
  const hits = []
  const sig = /function\s+([A-Za-z0-9_$]+)\s*\(\s*\{([^}]*)\}/g
  let m
  while ((m = sig.exec(src))) {
    const [, fnName, propsRaw] = m
    const props = propsRaw
      .split(',')
      .map((p) => p.split(/[:=]/)[0].trim())
      .filter((p) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p))
    if (!props.length) continue
    const brace = src.indexOf('{', sig.lastIndex)
    if (brace === -1) continue
    const body = bodyOf(src, brace)
    for (const p of props) {
      if (new RegExp(`function\\s+${p}\\s*\\(`).test(body)) hits.push(`${fnName}() shadows its own prop "${p}"`)
    }
  }
  return hits
}

// POSITIVE CONTROL. A guard that cannot fail is not a guard, and this file has
// form: earlier rounds in this project passed for the wrong reason more than
// once. Prove the checker catches the exact bug before trusting it to say the
// codebase is clean.
const BUGGY = `
export function FoodSearch({ onLog, defaultMeal, pick }) {
  const [q, setQ] = useState('')
  function pick(f) { setSelected(f) }
  return <div>{pick ? 'Add to recipe' : 'Add food'}</div>
}
`
const control = shadowedProps(BUGGY)
ok('control: the checker catches the original bug', control.length === 1 && control[0].includes('"pick"'), JSON.stringify(control))

const CLEAN = `
export function FoodSearch({ onLog, pick }) {
  function choose(f) { setSelected(f) }
  return <div>{pick ? 'Add to recipe' : 'Add food'}</div>
}
`
ok('control: the checker passes the fixed shape', shadowedProps(CLEAN).length === 0, JSON.stringify(shadowedProps(CLEAN)))

// --- the codebase ------------------------------------------------------------

const files = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /\.(jsx|js)$/.test(f))
const all = []
for (const f of files) {
  for (const hit of shadowedProps(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'))) all.push(`${f}: ${hit}`)
}
ok(`no component shadows its own props (${files.length} files)`, all.length === 0, all.join('; '))

// Pin the specific fix, so a later edit cannot quietly reintroduce the name.
const fsrc = fs.readFileSync(path.join(ROOT, 'src', 'FoodSearch.jsx'), 'utf8')
ok('FoodSearch still takes the pick prop', /function FoodSearch\(\{[^}]*\bpick\b/.test(fsrc))
ok('FoodSearch selects via choose(), not pick()', /function choose\s*\(/.test(fsrc) && !/function pick\s*\(/.test(fsrc))
ok('the diary variant is still reachable', /!pick &&/.test(fsrc) && /pick \? 'Add to recipe'/.test(fsrc))

// --- bug 2, against a deploy -------------------------------------------------

// 200g oats + 400ml semi-skimmed + 2 tbsp honey + 60g whey is about 1320 kcal,
// so roughly 660 a serving over two.
//
// Three models were wrong here before this shape worked, and each failure is
// what one of these assertions is for:
//   Haiku totalling itself  680, 1041, 1067 on identical input  -> STABILITY
//   Sonnet totalling itself accurate but 8.5-11.7s vs a 10s cap -> LATENCY
//   both                    forgot to divide by servings        -> HALVING
// The function now asks only for per-100g figures and does the sums in code,
// so the halving is exact arithmetic rather than something to hope for.
const LIST = ['200g porridge oats', '400ml semi-skimmed milk', '2 tbsp honey', '60g whey protein powder']
const BOLOGNESE = [
  '500g beef mince 5% fat', '1 tin chopped tomatoes 400g', '1 onion', '2 cloves garlic',
  '2 tbsp olive oil', '300g dried spaghetti', '1 carrot', '1 stick celery',
  '2 tbsp tomato puree', '100ml red wine', '50g parmesan', '1 tsp dried oregano',
]

async function macros(ingredients, servings) {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/.netlify/functions/recipe-ai`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ingredients, servings }),
  })
  const j = await res.json()
  j._ms = Date.now() - t0
  return j
}

const two = await macros(LIST, 2)
ok('macros mode answers at all', !two.error && two.calories > 0, JSON.stringify(two))
ok('and lands near the hand-worked total (550-780 per serving)', two.calories >= 550 && two.calories <= 780, `${two.calories} kcal`)
ok('protein is in range (35-60g)', two.protein_g >= 35 && two.protein_g <= 60, `${two.protein_g}g`)
ok('it costed every ingredient, not some of them', two.lines === LIST.length, `${two.lines} of ${LIST.length}`)

// Netlify kills a synchronous function at 10s. Anything close is a coin flip
// in production even when it passes here.
ok('comfortably inside the 10s function cap', two._ms < 6000, `${two._ms}ms`)

const four = await macros(LIST, 4)
// This used to demand the two agree to within 2 kcal, and it cried wolf on 13
// Oct at 660 vs 322x2. The claim was wrong, not the code: the division by
// servings IS exact and IS done in code (`per = round(total / n)` in
// recipe-ai.mjs), but these are two SEPARATE calls, each recalling its own
// per-100g figures, so the TOTALS differ before anything is divided. Exactness
// of the division cannot be tested across two calls. Hold it to the same drift
// the repeat-call check below allows, and the halving is still what is tested.
const halfDrift = Math.abs(two.calories - four.calories * 2) / Math.max(1, two.calories)
ok('doubling the servings halves it, within recall drift', halfDrift <= 0.1,
  `${two.calories} vs ${four.calories} x2 (${Math.round(halfDrift * 100)}%)`)

// Same input twice. A model doing its own totalling swung 680 -> 1067 here.
const again = await macros(LIST, 2)
const drift = Math.abs(again.calories - two.calories) / Math.max(1, two.calories)
ok('repeat calls agree within 10%', drift < 0.10, `${two.calories} then ${again.calories}`)

// A real recipe, which is where the slow version would have timed out.
const bol = await macros(BOLOGNESE, 4)
ok('a 12-ingredient recipe answers', !bol.error && bol.calories > 0, JSON.stringify(bol))
ok('...costing all 12 lines', bol.lines === BOLOGNESE.length, `${bol.lines} lines`)
ok('...and still inside the cap', bol._ms < 6000, `${bol._ms}ms`)
ok('...with a believable per-serving figure (450-950)', bol.calories >= 450 && bol.calories <= 950, `${bol.calories} kcal`)

// It must NOT hand back a title/method/ingredients — the editor would otherwise
// be able to rewrite a client's own recipe behind an "update macros" button.
ok('macros mode returns no title, method or ingredient list',
  two.title === undefined && two.method === undefined && two.ingredients === undefined,
  Object.keys(two).filter((k) => k !== '_ms').join(','))

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
