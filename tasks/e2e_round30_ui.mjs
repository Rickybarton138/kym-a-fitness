// Paul, 8 Sept:
//  1. "in the food diary, is it possible to copy meals from previous days?
//     MyFitnessPal allows it ... if you're adding breakfast it'll ask if you
//     want to copy the same as the day before ... You can also go to a previous
//     day and select copy on a meal and then put in what day and meal you want
//     to copy it to."
//  2. "With the search bar it seems to come up with no results found for a few
//     seconds and then it pulls data in. One of my clients thought nothing was
//     in there as she saw it every time."
//
// The search one was a real bug, not slowness: setSearching(true) sat INSIDE
// the 450ms debounce, so for the first half-second the state was "not
// searching, nothing found" and the screen said so before the request had even
// been sent. Asserted here by typing and looking immediately.
// Run: node tasks/e2e_round30_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round30_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = new Date()
const yest = new Date(); yest.setDate(yest.getDate() - 1)

const cleanup = async () => { await jamie.from('nutrition_logs').delete().eq('client_id', jamieId).like('name', 'E2E Copy%') }
await cleanup()

// The sheet offers yesterday's version of the meal it is DEFAULTING to, which
// is chosen by the time of day (mealByHour). Seed that meal, or this passes or
// fails depending on what time the suite happens to run.
const h = new Date().getHours()
const MEAL = h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snacks'
const at = (d, hh) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, 0, 0).toISOString()
const items = (day) => ([
  { client_id: jamieId, source: 'manual', name: 'E2E Copy Porridge', calories: 320, protein_g: 12, carbs_g: 54, fat_g: 6, fibre_g: 5, meal_type: MEAL, logged_at: at(day, 12) },
  { client_id: jamieId, source: 'manual', name: 'E2E Copy Banana', calories: 105, protein_g: 1, carbs_g: 27, fat_g: 0, fibre_g: 3, meal_type: MEAL, logged_at: at(day, 12) },
])
// Yesterday, for the repeat. Today, so the copy-a-meal control has something to
// copy on the day the diary opens on.
await jamie.from('nutrition_logs').insert(items(yest))
await jamie.from('nutrition_logs').insert(items(today))
console.log(`      (seeded ${MEAL}, the meal the sheet defaults to at this hour)`)

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

// ---------------------------------------------------------------------------
// 1. The search must never claim there is nothing there while it is looking
// ---------------------------------------------------------------------------
await page.getByRole('button', { name: /Add food/ }).first().click()
const sheet = page.locator('.sheet').first()
await sheet.waitFor({ timeout: 20000 })
const box = sheet.locator('input[type="search"], input[placeholder*="earch"]').first()
await box.fill('chicken')

// Look IMMEDIATELY — this is the window her client was seeing.
let sawNoMatches = false
for (let i = 0; i < 12; i++) {
  const t = await sheet.innerText()
  if (/No matches/i.test(t)) { sawNoMatches = true; break }
  if (/kcal/.test(t) && !/Searching/i.test(t)) break
  await page.waitForTimeout(60)
}
ok('it never says "no matches" while it is still looking', !sawNoMatches,
  sawNoMatches ? 'the empty state flashed before results arrived' : '')

await page.waitForTimeout(3000)
ok('and it does find things', /kcal/.test(await sheet.innerText()),
  (await sheet.innerText()).replace(/\n/g, ' | ').slice(0, 90))

// ---------------------------------------------------------------------------
// 2. Same breakfast as yesterday, one tap
// ---------------------------------------------------------------------------
await sheet.locator('.link-btn', { hasText: 'Done' }).first().click().catch(() => {})
await page.waitForTimeout(800)
await page.getByRole('button', { name: /Add food/ }).first().click()
await sheet.waitFor({ timeout: 15000 })
const repeat = sheet.getByRole('button', { name: /Same .* as yesterday/i })
const hasRepeat = await repeat.count() > 0
ok('it offers yesterday’s version of the meal', hasRepeat,
  hasRepeat ? (await repeat.innerText()).replace(/\n/g, ' | ').slice(0, 90) : 'not offered')

if (hasRepeat) {
  ok('naming what was actually eaten', /Porridge|Banana/.test(await repeat.innerText()),
    (await repeat.innerText()).replace(/\n/g, ' | ').slice(0, 90))
  await repeat.click()
  await page.waitForTimeout(3000)
  const { data: copied } = await jamie.from('nutrition_logs').select('name, logged_at, meal_type')
    .eq('client_id', jamieId).like('name', 'E2E Copy%')
  const onToday = (copied || []).filter((l) => String(l.logged_at).startsWith(ymd(today)))
  // Two were already seeded on today, so a successful repeat makes four.
  ok('one tap adds yesterday’s items to today', onToday.length === 4, `${onToday.length} items on today`)
  ok('into the same meal', onToday.every((l) => l.meal_type === MEAL), JSON.stringify([...new Set(onToday.map((l) => l.meal_type))]))
  ok('and yesterday is left alone', (copied || []).filter((l) => String(l.logged_at).startsWith(ymd(yest))).length === 2)
}

// ---------------------------------------------------------------------------
// 3. Copy a meal to another day and another meal
// ---------------------------------------------------------------------------
await page.reload()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.getByText('Food diary').first().click()
await page.waitForTimeout(2500)

const mealCard = page.locator('.card', { hasText: 'E2E Copy Porridge' }).first()
await mealCard.waitFor({ timeout: 20000 })
const copyBtn = mealCard.getByRole('button', { name: /^Copy$/ })
ok('each meal has a copy control', await copyBtn.count() > 0)
await copyBtn.click()
await page.waitForTimeout(600)

// Deliberately a DIFFERENT meal from the one being copied, or "it went into the
// meal I chose" would pass even if the target were ignored.
const TARGET = MEAL === 'Breakfast' ? 'Dinner' : 'Breakfast'
const expected = await mealCard.locator('.diary-item').count()
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
await mealCard.locator('input[type="date"]').fill(ymd(tomorrow))
await mealCard.locator('select.ex-select').selectOption(TARGET)
await mealCard.getByRole('button', { name: /Copy it/i }).click()
await page.waitForTimeout(3000)

const { data: all } = await jamie.from('nutrition_logs').select('name, meal_type, logged_at')
  .eq('client_id', jamieId).like('name', 'E2E Copy%')
const moved = (all || []).filter((l) => String(l.logged_at).startsWith(ymd(tomorrow)))
ok('a whole meal copies to another day', moved.length === expected,
  `${moved.length} copied, ${expected} were in the meal`)
ok('into the meal that was chosen, not the one it came from',
  moved.length > 0 && moved.every((l) => l.meal_type === TARGET),
  `chose ${TARGET}, got ${JSON.stringify([...new Set(moved.map((l) => l.meal_type))])}`)
ok('and the day it was copied from is unchanged',
  (all || []).filter((l) => String(l.logged_at).startsWith(ymd(today))).length === expected)

ok('no page errors', errors.length === 0, errors.join(' | '))

await cleanup()
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
