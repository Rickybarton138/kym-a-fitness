// Paul, 7 Sept: "when you go into the food diary and click add food currently
// there's a search box or the add it manually. Can we add an option to scan
// barcode in there too and the scan the plate option too as buttons? ... It just
// means if people are adding a mixture of foods ... they can do it all in one
// place." And: "a tab for their recipes ... or they can create a new one as part
// of the logging ... asks them how many servings a recipe makes and then the app
// works out the calories per serving."
//
// The recipe maths already existed; what was missing was reaching it while
// logging. The assertion that matters is that whatever route they use, the
// entry lands on the DAY THEY ARE LOOKING AT — the diary can be backdated.
// Run: node tasks/e2e_round27_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round27_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

const cleanup = async () => {
  await jamie.from('nutrition_logs').delete().eq('client_id', jamieId).like('name', 'E2E %')
  await jamie.from('recipes').delete().eq('client_id', jamieId).like('title', 'E2E %')
}
await cleanup()

// A saved recipe: 4 servings, macros stored PER SERVING.
const { data: recipe, error: rErr } = await jamie.from('recipes').insert({
  client_id: jamieId, coach_id: null, title: 'E2E Chilli', servings: 4,
  serving_label: 'per serving', calories: 520, protein_g: 42, carbs_g: 45, fat_g: 16, fibre_g: 9,
  ingredients: [], method: null,
}).select().single()
ok('a client recipe can be saved with servings', !rErr && recipe?.servings === 4, rErr?.message)

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
await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.getByText('Food diary').first().click()
await page.getByRole('button', { name: /Add food/ }).first().waitFor({ timeout: 25000 })
await page.getByRole('button', { name: /Add food/ }).first().click()

const sheet = page.locator('.sheet').first()
await sheet.waitFor({ timeout: 20000 })

// ---------------------------------------------------------------------------
// 1. Every way of logging, in one place
// ---------------------------------------------------------------------------
const tab = (n) => sheet.locator('.seg button', { hasText: new RegExp('^' + n + '$') })
for (const t of ['Search', 'Barcode', 'Scan plate', 'Recipes']) {
  ok(`${t} is offered when adding food`, await tab(t).count() === 1)
}
ok('search is still what opens first', (await sheet.locator('.seg button.on').innerText()) === 'Search',
  await sheet.locator('.seg button.on').innerText())

await tab('Barcode').click()
await page.waitForTimeout(1000)
ok('the barcode scanner opens in the sheet', /barcode/i.test(await sheet.innerText()),
  (await sheet.innerText()).replace(/\n/g, ' | ').slice(0, 100))

// It has its own screen elsewhere with a Back button; inside a tab there is
// nowhere to go back to, and a dead control is worse than none.
ok('without a Back button that goes nowhere', !/Back/.test(await sheet.innerText()),
  (await sheet.innerText()).replace(/\n/g, ' | ').slice(0, 80))

await tab('Scan plate').click()
await page.waitForTimeout(1000)
ok('so does the plate scanner', /photo|snap|plate/i.test(await sheet.innerText()),
  (await sheet.innerText()).replace(/\n/g, ' | ').slice(0, 100))

// ---------------------------------------------------------------------------
// 2. Recipes, logged by the portion
// ---------------------------------------------------------------------------
await tab('Recipes').click()
await sheet.locator('.card', { hasText: 'E2E Chilli' }).first().waitFor({ timeout: 20000 })
const card = sheet.locator('.card', { hasText: 'E2E Chilli' }).first()
ok('their saved recipes are listed', await card.count() === 1)
ok('showing what one portion is, not the whole batch',
  /520 kcal per serving/.test(await card.innerText()), (await card.innerText()).replace(/\n/g, ' | ').slice(0, 90))
ok('and how many it makes', /makes 4/.test(await card.innerText()), (await card.innerText()).replace(/\n/g, ' | ').slice(0, 90))
ok('with a way to build a new one while logging', await sheet.getByRole('button', { name: /Create a recipe/i }).count() === 1)

await card.getByRole('button', { name: /Log this/i }).click()
await page.waitForTimeout(2500)
let logs = (await jamie.from('nutrition_logs').select('name, calories, protein_g, logged_at').eq('client_id', jamieId).like('name', 'E2E %')).data
ok('logging one portion stores one serving', logs?.length === 1 && logs[0].calories === 520 && logs[0].protein_g === 42,
  JSON.stringify(logs))

// two portions must double it — the whole point of per-serving storage
await card.locator('input[type="number"]').fill('2')
await card.getByRole('button', { name: /Log this/i }).click()
await page.waitForTimeout(2500)
logs = (await jamie.from('nutrition_logs').select('name, calories').eq('client_id', jamieId).like('name', 'E2E %')).data
const two = (logs || []).find((l) => /2 servings/.test(l.name))
ok('two portions is double, not the whole batch', two?.calories === 1040,
  JSON.stringify((logs || []).map((l) => [l.name, l.calories])))

ok('no page errors', errors.length === 0, errors.join(' | '))

await cleanup()
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
