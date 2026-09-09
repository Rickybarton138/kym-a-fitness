// Paul, 9 Sept:
//  1. A screenshot of the browser refusing a backdated step entry: "Value must
//     be greater than or equal to 2026-09-03". The date input was capped at the
//     seven days the strip above it lists.
//  2. "can we have an edit button on recipes so clients can go into their own
//     created recipes and edit them?"
//  3. "can we prompt it to ask if it is a home, gym or home gym session and
//     maybe add a text box so they can say, for example, create me a full body
//     TRX workout ... or a workout hitting x,y,z using only machines etc?"
//
// The steps one is asserted by actually saving a date OUTSIDE the old window
// and reading the row back — a missing `min` attribute proves nothing on its
// own, since the browser blocks the submit before any of our code runs.
// The AI builder asserts the REQUEST, not the session: what matters is that the
// client's place and words reach the function. The session itself is checked
// against the deployed function separately.
// Run: node tasks/e2e_round32_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round32_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// Twenty days back: comfortably outside the old seven-day cap, comfortably
// inside the sixty-day window the list now loads.
const OLD_DAY = ymd(new Date(Date.now() - 20 * 86400000))
const STEPS = 8137

const cleanup = async () => {
  await jamie.from('daily_steps').delete().eq('client_id', jamieId).eq('day', OLD_DAY)
  await jamie.from('recipes').delete().eq('client_id', jamieId).like('title', 'E2E R32%')
}
await cleanup()

const { data: seeded, error: seedErr } = await jamie.from('recipes').insert({
  client_id: jamieId, coach_id: null, title: 'E2E R32 Chilli', servings: 4,
  ingredients: ['500g beef mince', '1 tin chopped tomatoes'], method: 'Brown the mince.',
  serving_label: 'per serving', calories: 420, protein_g: 38, carbs_g: 30, fat_g: 16, fibre_g: 7,
}).select().single()
if (seedErr) { console.error('could not seed the recipe:', seedErr.message); process.exit(1) }

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })

// ---------------------------------------------------------------------------
// 1. Steps, backdated past the old seven-day cap
// ---------------------------------------------------------------------------
await page.locator('.tab', { hasText: 'Train' }).click()
const dateIn = page.locator('input[type="date"]').first()
await dateIn.waitFor()

ok('the step date picker no longer carries a min', (await dateIn.getAttribute('min')) === null,
  'min=' + (await dateIn.getAttribute('min')))
ok('it is still capped at today', (await dateIn.getAttribute('max')) === ymd(new Date()))

await dateIn.fill(OLD_DAY)
await page.locator('input[type="number"]').first().fill(String(STEPS))
await page.getByRole('button', { name: /Save steps/ }).click()

// The row, not the toast: a browser-blocked submit shows no error of ours at all.
await page.waitForTimeout(2500)
const { data: row } = await jamie.from('daily_steps').select('steps').eq('client_id', jamieId).eq('day', OLD_DAY).maybeSingle()
ok('a day 20 days back actually saves', !!row && row.steps === STEPS, row ? `${row.steps} steps` : 'no row')

const earlier = page.locator('.eyebrow', { hasText: /^Earlier$/ })
ok('an "Earlier" section appears for it', await earlier.count() > 0)
ok('and the backdated day is listed under it', await page.getByText(STEPS.toLocaleString() + ' steps').count() > 0)

// ---------------------------------------------------------------------------
// 2. Edit your own recipe — and only your own
// ---------------------------------------------------------------------------
await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.getByText('Recipes', { exact: true }).first().click()
await page.getByText('E2E R32 Chilli').first().waitFor({ timeout: 25000 })

const mine = page.locator('.card', { hasText: 'E2E R32 Chilli' }).first()
ok('the client\'s own recipe offers Edit', await mine.getByRole('button', { name: /^Edit$/ }).count() === 1)

const coachCard = page.locator('.card', { hasText: /· yours/ })
const allCards = page.locator('.card').filter({ has: page.getByRole('button', { name: /Log this meal/ }) })
const editable = await allCards.filter({ has: page.getByRole('button', { name: /^Edit$/ }) }).count()
const owned = await coachCard.count()
ok('no Edit button on a recipe the client does not own', editable === owned, `${editable} editable vs ${owned} owned`)

await mine.getByRole('button', { name: /^Edit$/ }).click()
await page.getByText('Edit recipe').waitFor()

const sheet = page.locator('.sheet')
ok('the editor opens on the saved values', (await sheet.locator('input').first().inputValue()) === 'E2E R32 Chilli')

const ingBox = sheet.locator('textarea').first()
ok('ingredients are editable, not just displayed', (await ingBox.inputValue()).includes('500g beef mince'))
await ingBox.fill('600g turkey mince\n1 tin chopped tomatoes\n1 tbsp smoked paprika')
await sheet.locator('textarea').nth(1).fill('Brown the turkey, then simmer for 40 minutes.')
await sheet.locator('input').first().fill('E2E R32 Turkey Chilli')
await sheet.getByLabel('Calories').fill('380')
await sheet.getByRole('button', { name: /Save changes/ }).click()
await page.waitForTimeout(2500)

const { data: after } = await jamie.from('recipes').select('*').eq('id', seeded.id).single()
ok('the edit is saved', after.title === 'E2E R32 Turkey Chilli' && after.calories === 380, `${after.title} / ${after.calories} kcal`)
ok('the new ingredient list is stored as a clean array', Array.isArray(after.ingredients) && after.ingredients.length === 3 && after.ingredients[0] === '600g turkey mince', JSON.stringify(after.ingredients))
ok('the method is saved too', (after.method || '').startsWith('Brown the turkey'))
ok('the card on screen shows the new name', await page.getByText('E2E R32 Turkey Chilli').count() > 0)

// ---------------------------------------------------------------------------
// 3. The session builder asks where you are, and takes your words
// ---------------------------------------------------------------------------
let sent = null
await page.route('**/.netlify/functions/analyze', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}')
  if (body.mode !== 'workout') return route.continue()
  sent = body
  await route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ title: 'Stubbed', focus: 'Stubbed', exercises: [], finisher: null }),
  })
})

await page.locator('.tab', { hasText: 'Train' }).click()
await page.getByText(/Today’s session|No session scheduled today/).first().click()
await page.getByRole('button', { name: /Generate with AI/ }).click()

ok('it asks where you are training', await page.getByText('Where are you training?').count() > 0)
for (const label of ['A gym', 'My home gym', 'At home']) {
  ok(`the "${label}" option is offered`, await page.getByText(label, { exact: true }).count() > 0)
}
const notes = page.getByPlaceholder(/full body TRX/)
ok('there is a free-text box', await notes.count() === 1)

await page.getByText('At home', { exact: true }).click()
await notes.fill('full body TRX workout, nothing on the floor')
await page.getByRole('button', { name: /Generate a session/ }).click()
await page.waitForTimeout(2000)

ok('the chosen place reaches the function', sent && sent.location === 'home', sent ? sent.location : 'nothing sent')
ok('so do the client\'s own words', sent && sent.notes === 'full body TRX workout, nothing on the floor', sent ? sent.notes : '')
ok('the focus chip still goes with it', sent && !!sent.goal, sent ? sent.goal : '')

ok('no page errors throughout', errors.length === 0, errors.join(' | '))

await browser.close()
await cleanup()
await jamie.from('workout_plans').delete().eq('client_id', jamieId).eq('title', 'Stubbed')
console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
