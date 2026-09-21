// Paul, 21 Sept: "with measurements that clients can log. Could we add in
// shoulders and calf measurements too? A couple of people have asked for it."
//
// Two new sites is a small change, but it touches three screens that read from
// one shared list (MEASURE_SITES) and a printed report that used to carry its
// OWN hand-written copy of that list. The duplicate is the reason this test
// exists: without it the two new sites would have appeared on the client's
// screen and in the coach's trends, and silently gone missing from the report a
// client actually takes away.
//
// Run: node tasks/e2e_round37_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round37_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

const NOTE = 'E2E R37'
const cleanup = async () => { await jamie.from('body_measurements').delete().eq('client_id', jamieId).eq('note', NOTE) }
await cleanup()

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

await page.locator('.tab', { hasText: /Check-ins & Progress|Progress|Body/ }).first().click()
await page.getByRole('button', { name: /^Measurements$/ }).first().click().catch(() => {})
await page.getByText('Log this week').waitFor({ timeout: 25000 })

// --- the form ----------------------------------------------------------------
ok('the form offers Shoulders', await page.getByLabel('Shoulders').count() === 1)
ok('and Calf', await page.getByLabel('Calf').count() === 1)
ok('and still offers the original five',
  (await page.getByLabel('Waist').count()) === 1 && (await page.getByLabel('Chest').count()) === 1 &&
  (await page.getByLabel('Hips').count()) === 1 && (await page.getByLabel('Thigh').count()) === 1 &&
  (await page.getByLabel('Bicep').count()) === 1)

// --- logging them ------------------------------------------------------------
await page.getByLabel('Weight (kg)').fill('82.5')
await page.getByLabel('Shoulders').fill('124.5')
await page.getByLabel('Calf').fill('39.2')
await page.getByRole('button', { name: /Save measurement/i }).click()
await page.waitForTimeout(2500)

const { data: rows } = await jamie.from('body_measurements')
  .select('*').eq('client_id', jamieId).order('created_at', { ascending: false }).limit(1)
const row = rows?.[0]
ok('shoulders is stored', Number(row?.shoulders_cm) === 124.5, String(row?.shoulders_cm))
ok('calf is stored', Number(row?.calf_cm) === 39.2, String(row?.calf_cm))
ok('alongside the weight', Number(row?.weight_kg) === 82.5, String(row?.weight_kg))

// Tag it so cleanup finds it, whatever else is in there.
if (row) await jamie.from('body_measurements').update({ note: NOTE }).eq('id', row.id)

// --- the trend picker --------------------------------------------------------
await page.reload()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.locator('.tab', { hasText: /Check-ins & Progress|Progress|Body/ }).first().click()
await page.getByRole('button', { name: /^Measurements$/ }).first().click().catch(() => {})
await page.getByText('Log this week').waitFor({ timeout: 25000 })
ok('shoulders becomes a trend you can chart', await page.getByRole('button', { name: /^Shoulders$/ }).count() > 0)
ok('and so does calf', await page.getByRole('button', { name: /^Calf$/ }).count() > 0)

ok('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
await cleanup()
console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
