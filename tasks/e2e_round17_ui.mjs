// The 1 Sept batch: reading a barcode from a photo (BarcodeDetector is
// Chromium-only, so iPhone clients had a "scan" screen with no way to scan),
// daily fluid intake with a coach-set target, and correcting a logged food
// entry's portion, meal and day.
// Run: node tasks/e2e_round17_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round17_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const api = createClient(SUPA, KEY)
await api.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await api.auth.getUser()).data.user.id
const coach = createClient(SUPA, KEY)
await coach.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })

const todayKey = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()

// ---------------------------------------------------------------------------
// 1. Barcode by photo — the endpoint, without needing a camera
// ---------------------------------------------------------------------------
const FN = SITE + '/.netlify/functions/barcode'
const byNumber = await fetch(FN, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ barcode: '5000159407236' }), // Mars bar, in Open Food Facts
}).then((r) => r.json())
ok('typed barcode still looks up', ['found', 'not_found'].includes(byNumber.status), JSON.stringify(byNumber).slice(0, 90))

// a 1x1 jpeg: nothing readable, so it must come back as unreadable rather than 500
const TINY = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
const byPhoto = await fetch(FN, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ image: TINY, mediaType: 'image/jpeg' }),
}).then((r) => r.json())
ok('photo path answers cleanly when nothing is readable', byPhoto.status === 'unreadable', JSON.stringify(byPhoto).slice(0, 90))

// the real thing: a barcode image, read and resolved to a product
const { readFileSync } = await import('node:fs')
const { fileURLToPath } = await import('node:url')
const { dirname, join } = await import('node:path')
const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(join(here, 'fixtures', 'barcode-5000159407236.jpg')).toString('base64')
// Reading digits off an image is not deterministic, so two things are asserted
// separately: it manages the read within a couple of attempts (the UI tells the
// user to retry), and — the one that actually matters — it NEVER returns a
// barcode that isn't the right one. The check digit is what guarantees the
// second, so a misread comes back as "unreadable" rather than as somebody
// else's product.
const attempts = []
for (let i = 0; i < 3; i++) {
  const r = await fetch(FN, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: fixture, mediaType: 'image/jpeg' }),
  }).then((x) => x.json())
  attempts.push(r)
  if (r.barcode === '5000159407236') break
}
const good = attempts.find((r) => r.barcode === '5000159407236')
ok('reads the number off a barcode photo', !!good, `${attempts.length} attempt(s): ` + attempts.map((r) => r.barcode || r.status).join(', '))
ok('and resolves it to the product', good?.status === 'found' && /mars/i.test(good?.product?.name || ''), good?.product?.name)
ok('never returns a barcode that is not the right one',
  attempts.every((r) => !r.barcode || r.barcode === '5000159407236'),
  attempts.map((r) => r.barcode || r.status).join(', '))

const noBody = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
ok('an empty request is still a 400', noBody.status === 400, String(noBody.status))

// ---------------------------------------------------------------------------
// 2. Coach sets a fluid target
// ---------------------------------------------------------------------------
const { error: rpcErr } = await coach.rpc('set_water_target', { p_client: jamieId, p_ml: 3000 })
ok('coach can set a fluid target', !rpcErr, rpcErr?.message)
const { data: prof } = await coach.from('profiles').select('water_target_ml').eq('id', jamieId).single()
ok('target is stored', prof?.water_target_ml === 3000, String(prof?.water_target_ml))

// and cannot set one for somebody else's client
const { error: steal } = await api.rpc('set_water_target', { p_client: jamieId, p_ml: 9000 })
ok('a client cannot set their own target', !!steal, steal?.message)

// ---------------------------------------------------------------------------
// 3. The client app
// ---------------------------------------------------------------------------
await api.from('daily_steps').delete().eq('client_id', jamieId).eq('day', todayKey)
await api.from('nutrition_logs').delete().eq('client_id', jamieId).eq('name', 'E2E Test Porridge')

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.agenda-card', { timeout: 30000 })

// --- fluid on the agenda ---
const waterRow = page.locator('.agenda-item', { hasText: 'Water' })
ok('water shows on the daily plan', await waterRow.waitFor({ timeout: 20000 }).then(() => true, () => false))
ok('using the coach target', (await waterRow.innerText()).includes('3.0L'), (await waterRow.innerText()).replace(/\n/g, ' | '))
await waterRow.getByRole('button', { name: '+500' }).click()
await page.waitForTimeout(1800)
await waterRow.getByRole('button', { name: '+250' }).click()
await page.waitForTimeout(1800)
const { data: ds } = await api.from('daily_steps').select('water_ml, steps').eq('client_id', jamieId).eq('day', todayKey).maybeSingle()
ok('taps add up and are stored', ds?.water_ml === 750, JSON.stringify(ds))
ok('logging water leaves steps alone', (ds?.steps ?? 0) === 0, String(ds?.steps))
ok('the total shows back on the row', (await waterRow.innerText()).includes('0.8L') || (await waterRow.innerText()).includes('0.7L'),
  (await waterRow.innerText()).replace(/\n/g, ' | '))

// --- editing a logged food entry ---
const when = new Date(); when.setHours(12, 0, 0, 0)
const { data: log } = await api.from('nutrition_logs').insert({
  client_id: jamieId, source: 'manual', name: 'E2E Test Porridge',
  calories: 200, protein_g: 10, carbs_g: 30, fat_g: 4, fibre_g: 3,
  meal_type: 'Breakfast', logged_at: when.toISOString(),
}).select().single()

await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.getByText('Food diary').first().click()
await page.waitForSelector('text=E2E Test Porridge', { timeout: 25000 })
await page.getByRole('button', { name: /Edit E2E Test Porridge/i }).click()
await page.waitForSelector('text=Edit entry', { timeout: 15000 })
ok('the entry opens for editing', true)

await page.getByRole('button', { name: '1.5×' }).click()
await page.locator('select.ex-select').first().selectOption('Lunch')
const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
await page.locator('input[type="date"]').first().fill(yKey)
await page.getByRole('button', { name: 'Save changes' }).click()
await page.waitForTimeout(3000)

const { data: edited } = await api.from('nutrition_logs').select('*').eq('id', log.id).single()
ok('portion scales the macros', edited?.calories === 300 && edited?.protein_g === 15, `${edited?.calories} kcal, ${edited?.protein_g}P`)
ok('meal moved', edited?.meal_type === 'Lunch', edited?.meal_type)
ok('day moved', String(edited?.logged_at).startsWith(yKey), String(edited?.logged_at).slice(0, 10))

ok('no page errors', errors.length === 0, errors.join(' | '))

// cleanup
await api.from('nutrition_logs').delete().eq('id', log.id)
await api.from('daily_steps').delete().eq('client_id', jamieId).eq('day', todayKey)
await coach.rpc('set_water_target', { p_client: jamieId, p_ml: 0 })
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
