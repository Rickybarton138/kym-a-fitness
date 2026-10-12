// Paul, 12 Oct, four things:
//
//   1. "Could we also add in a delete recipe button too?"
//   2. "Can we have an 'edit' button in the food diary for editing recipes" —
//      for a recipe pre-tracked for Thursday and then changed before Thursday.
//   3. "if I write a reply to the check in form, can we have it that it
//      displays the reply in the same way as it does if the AI replies to a
//      client ... Currently the messages stays in the text box".
//   4. "Alanna McAnn says when she submits her check in form it doesn't
//      actually submit, and I can't ever see her submissions."
//
// (4) is the one worth a test rather than a tick.
//
// The Supabase edge logs settled it: she opened the check-in at 10:55:12 on
// 12 Oct and there is no POST to checkin_responses at all, from her or anyone,
// that day beyond three that succeeded for other clients. Nothing left her
// device. Running the insert server-side as her, RLS and the grants allowed it.
//
// So the form itself refused to submit. Paul's template has two `number`
// fields ("Average daily steps", "How many training sessions did you
// complete?"), they were rendered as <input type="number"> with no `step`, and
// the browser will not submit a form containing an :invalid field. With step
// defaulting to 1, "8.5" is a step mismatch; "10,000 steps" and "12-15" are
// badInput. Each one silently blocks the submit behind a validation bubble that
// is easy to miss on a phone — and the submit handler then swallowed the
// Supabase error too, so a save that never happened still printed "Sent ✓".
//
// This drives a real browser over the old markup and the new markup. Real key
// presses, not input.value = '...': assigning a bad value to a number input is
// sanitised to '' and the field stays VALID, so a programmatic test reports no
// bug. That false negative is the reason this file uses Playwright at all.
//
// Run: node tasks/e2e_round43.mjs [deployUrl]
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] || 'https://app.redefineacademy.com'
const PW = 'C:/Users/info/AppData/Roaming/npm/node_modules/playwright/index.mjs'

let failures = 0
const ok = (label, pass, extra = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
}
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')

// --- 4. the check-in that would not send -------------------------------------

// Things a real person types into "Average daily steps" or "How many training
// sessions did you complete?". Every one of them blocks a type="number" submit.
// ("3 or 4" is NOT here: Chromium silently keeps it as 34, which submits a
// wrong answer rather than none. A different defect of the same field, and the
// free-text version fixes that one too.)
const BLOCKING = ['8.5', '10,000 steps', '12-15', '-']

const PAGE = `<!doctype html><meta charset="utf-8">
<form id="oldForm"><input type="number" inputmode="numeric" id="oldInput"><button type="submit" id="oldBtn">Send</button></form>
<form id="newForm" novalidate><input type="text" inputmode="decimal" id="newInput"><button type="submit" id="newBtn">Send</button></form>
<script>
window.oldFired = 0; window.newFired = 0
document.getElementById('oldForm').addEventListener('submit', e => { e.preventDefault(); window.oldFired++ })
document.getElementById('newForm').addEventListener('submit', e => { e.preventDefault(); window.newFired++ })
</script>`

async function browserCheck() {
  let pw
  try { pw = await import(pathToFileURL(PW).href) } catch {
    ok('playwright is available for the browser repro', false, 'install it or run this on the machine that has it')
    return
  }
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'r43-')), 'repro.html')
  fs.writeFileSync(file, PAGE)

  const browser = await pw.chromium.launch()
  try {
    for (const typed of BLOCKING) {
      const page = await browser.newPage()
      await page.goto(pathToFileURL(file).href)
      for (const which of ['old', 'new']) {
        await page.locator(`#${which}Input`).click()
        await page.locator(`#${which}Input`).pressSequentially(typed, { delay: 5 })
      }
      await page.locator('#oldBtn').click()
      await page.locator('#newBtn').click()
      await page.waitForTimeout(120)
      const r = await page.evaluate(() => ({
        old: window.oldFired, new: window.newFired,
        newValue: document.getElementById('newInput').value,
      }))
      // POSITIVE CONTROL. If this ever stops failing, the test has stopped
      // testing anything and the "fixed" half below proves nothing.
      ok(`control: typing ${JSON.stringify(typed)} blocks the OLD form`, r.old === 0, `submit fired ${r.old}x`)
      ok(`...and the NEW form still sends it`, r.new === 1 && r.newValue === typed, `fired ${r.new}x, kept ${JSON.stringify(r.newValue)}`)
      await page.close()
    }
  } finally { await browser.close() }
}

await browserCheck()

// Pin the fix in the real source, so the markup cannot drift back.
const client = src('src/ClientApp.jsx')
ok('no type="number" left in the check-in field renderer',
  !/field\.type === 'number'[\s\S]{0,200}type="number"/.test(client))
ok('both check-in forms opt out of browser validation',
  (client.match(/onSubmit=\{submit\} noValidate/g) || []).length === 2,
  (client.match(/onSubmit=\{submit\} noValidate/g) || []).length + ' of 2')
ok('a failed check-in save is reported, not swallowed',
  /const \{ data, error \} = await supabase\.from\('checkin_responses'\)/.test(client) &&
  /if \(error \|\| !data\) \{[\s\S]{0,200}setErr\(/.test(client))
ok('...and the answers survive a failed save',
  client.indexOf("setAnswers({})") > client.indexOf('Your answers are still here'))
ok('the legacy weekly check-in got the same treatment',
  /const \{ data, error \} = await supabase\.from\('weekly_checkins'\)/.test(client))

// --- 3. the coach's reply reads back as a reply ------------------------------

const trainer = src('src/TrainerApp.jsx')
ok('one ReplyBox serves both check-in shapes',
  /function ReplyBox\(/.test(trainer) &&
  /<ReplyBox table="weekly_checkins"/.test(trainer) &&
  /<ReplyBox table="checkin_responses"/.test(trainer))
ok('a sent reply renders in the same block the client reads',
  /className="fc-block coach"/.test(trainer))
ok('and turns the button into Edit reply', /Edit reply</.test(trainer))
ok('neither row keeps its own stale copy of the reply',
  !/const \[reply, setReply\] = useState\(c\.coach_reply/.test(trainer))
// useState only seeds once: without this the box shows the old text for ever.
ok('ReplyBox re-reads the saved reply when it changes',
  /useEffect\(\(\) => \{ setReply\(saved \|\| ''\); setEditing\(!saved\) \}, \[saved\]\)/.test(trainer))

// --- 1. delete a recipe ------------------------------------------------------

const creator = src('src/RecipeCreator.jsx')
ok('RecipeEditor can delete', /from\('recipes'\)\.delete\(\)\.eq\('id', recipe\.id\)/.test(creator))
ok('...behind a second tap, because there is no undo',
  /setConfirming\(true\)/.test(creator) && /Yes, delete it/.test(creator))
ok('...and only where the caller handles it (own recipes)', /\{onDeleted && \(confirming/.test(creator))
const diary = src('src/FoodDiary.jsx')
ok('delete is reachable from both places a client sees their recipes',
  /onDeleted=\{\(id\)/.test(diary) && /onDeleted=\{\(id\)/.test(client))

// --- 2. editing a recipe from the diary --------------------------------------

ok('a diary row has a visible Edit control', /className="diary-act"/.test(diary))
ok('the link back to the recipe is written when logging from MyRecipes',
  /recipe_id: r\.id,\s*portions: n,/.test(diary))
ok('...and from the recipe library', /recipe_id: r\.id, portions: 1/.test(client))
ok('...and carried by logFood', /recipe_id \? \{ recipe_id, portions: portions \|\| 1 \}/.test(client))
ok('...and by the diary\u2019s own insert, so the offline queue keeps it too',
  /m\.recipe_id \? \{ recipe_id: m\.recipe_id, portions: m\.portions \|\| 1 \}/.test(diary))
ok('editing a recipe-linked entry re-costs it from the recipe as it stands now',
  /if \(eRecipe\) \{[\s\S]{0,400}eRecipe\.calories/.test(diary))
// The same recipe may sit in a dozen other days that were eaten as written.
ok('...and only that one entry', /\.eq\('id', editing\.id\)/.test(diary) && !/\.eq\('recipe_id'/.test(diary))
ok('a deleted recipe leaves the diary entry alone', /only be scaled/.test(diary))

// --- the AI outage that none of the above would have survived ----------------

async function post(fn, body) {
  const res = await fetch(`${BASE}/.netlify/functions/${fn}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

// 12 Oct: the Anthropic account ran out of credit and six call sites piped
// `data.error.message` straight to the browser, so Paul's paying clients were
// shown OUR billing notice inside their coaching app. Whatever is wrong
// upstream, that text must never reach a client.
const LEAKS = /credit balance|Plans & Billing|x-api-key|api[_ -]?key|anthropic/i
for (const [fn, body] of [
  ['analyze', { mode: 'checkin', answers: ['Energy: 7'], level: 2 }],
  ['recipe-ai', { ingredients: ['200g oats'], servings: 1 }],
  ['recipe-ai', { text: '2 eggs on toast. Serves 1.' }],
]) {
  const r = await post(fn, body)
  const blob = JSON.stringify(r.json)
  ok(`${fn} never shows a client our billing or key trouble`, !LEAKS.test(blob), blob.slice(0, 120))
}

// And when it IS working, the macro sums must still be right. Skipped rather
// than failed while the account is empty, so this file stays runnable.
const m = await post('recipe-ai', { ingredients: ['200g porridge oats', '400ml semi-skimmed milk', '2 tbsp honey', '60g whey protein powder'], servings: 2 })
if (m.json?.calories) {
  ok('macros still land near the hand-worked total', m.json.calories >= 550 && m.json.calories <= 780, `${m.json.calories} kcal`)
  ok('...costing every ingredient', m.json.lines === 4, `${m.json.lines} of 4`)
} else {
  console.log(`SKIP  macro accuracy — the AI is not answering (${m.json?.upstream || 'no reason given'})`)
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
