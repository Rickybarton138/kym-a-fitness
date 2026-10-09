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
// so roughly 660 a serving over two. The import path answered 445 — a third
// light, which on a cut is the whole deficit — because it runs on Haiku and was
// eyeballing a total rather than adding one up.
const LIST = ['200g porridge oats', '400ml semi-skimmed milk', '2 tbsp honey', '60g whey protein powder']

async function macros(servings) {
  const res = await fetch(`${BASE}/.netlify/functions/recipe-ai`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ingredients: LIST, servings }),
  })
  return res.json()
}

const two = await macros(2)
ok('macros mode answers at all', !two.error && two.calories > 0, JSON.stringify(two))
ok('and lands near the hand-worked total (550-780 per serving)', two.calories >= 550 && two.calories <= 780, `${two.calories} kcal`)
ok('protein is in range (35-55g)', two.protein_g >= 35 && two.protein_g <= 55, `${two.protein_g}g`)

const four = await macros(4)
// Same food, twice the servings: per-serving must roughly halve. This is the
// one that catches a model quietly picking its own servings.
const ratio = two.calories / Math.max(1, four.calories)
ok('doubling the servings halves the per-serving figure', ratio > 1.7 && ratio < 2.3, `ratio ${ratio.toFixed(2)} (${two.calories} vs ${four.calories})`)

// It must NOT hand back a title/method/ingredients — the editor would otherwise
// be able to rewrite a client's own recipe behind a "update macros" button.
ok('macros mode returns no title, method or ingredient list',
  two.title === undefined && two.method === undefined && two.ingredients === undefined,
  Object.keys(two).join(','))

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
