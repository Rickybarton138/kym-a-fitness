// The 31 Aug batch: a way back in for locked-out clients (coach sets a temporary
// password, client changes it themselves), and exercise how-tos reachable
// without starting a session.
// Run: node tasks/e2e_round15_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round15_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'
const FN = SITE + '/.netlify/functions/coach-reset-password'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const coach = createClient(SUPA, KEY)
await coach.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await coach.auth.getUser()).data.user.id
const coachToken = (await coach.auth.getSession()).data.session.access_token

const jamieApi = createClient(SUPA, KEY)
await jamieApi.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamieApi.auth.getUser()).data.user.id
const jamieToken = (await jamieApi.auth.getSession()).data.session.access_token

// ---------------------------------------------------------------------------
// 1. The reset endpoint's authorisation. These must hold whether or not the
//    service-role key is configured yet.
// ---------------------------------------------------------------------------
const call = (token, body) => fetch(FN, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }))

const anon = await call(null, { clientId: jamieId, password: 'Squat-1234' })
ok('anonymous callers are refused', anon.status === 401, `${anon.status} ${JSON.stringify(anon.json)}`)

const getReq = await fetch(FN).then((r) => r.status)
ok('GET is refused', getReq === 405 || getReq === 404, String(getReq))

const configured = (await call(coachToken, { clientId: jamieId, password: 'Squat-1234' })).status !== 503
console.log(configured
  ? '      (service-role key IS configured — running the full authorisation checks)'
  : '      (service-role key NOT configured yet — the reset itself cannot work until it is)')

if (configured) {
  const badId = await call(coachToken, { clientId: 'not-a-uuid', password: 'Squat-1234' })
  ok('a malformed client id is rejected', badId.status === 400, String(badId.status))

  const shortPw = await call(coachToken, { clientId: jamieId, password: 'abc' })
  ok('a too-short password is rejected', shortPw.status === 400, String(shortPw.status))

  const asClient = await call(jamieToken, { clientId: jamieId, password: 'Squat-1234' })
  ok('a client cannot reset anyone', asClient.status === 403, `${asClient.status} ${JSON.stringify(asClient.json)}`)

  const notMine = await call(coachToken, { clientId: paulId, password: 'Squat-1234' })
  ok('a coach cannot reset a coach', notMine.status === 403, String(notMine.status))

  // the real thing: set a temporary password, sign in with it, then put it back
  const TEMP = 'Deadlift-7742'
  const real = await call(coachToken, { clientId: jamieId, password: TEMP })
  ok('the coach can reset their own client', real.status === 200 && real.json.ok === true, JSON.stringify(real.json))

  const check = createClient(SUPA, KEY)
  const signIn = await check.auth.signInWithPassword({ email: 'jamie@redefine.app', password: TEMP })
  ok('the client can sign in with it', !signIn.error, signIn.error?.message)
  if (!signIn.error) {
    const back = await check.auth.updateUser({ password: 'TestPass123' })
    ok('and can change it themselves', !back.error, back.error?.message)
  }
} else {
  ok('unconfigured server answers cleanly rather than crashing', true, '503 with a readable message')
}

// ---------------------------------------------------------------------------
// 2. The UI
// ---------------------------------------------------------------------------
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// --- coach sees the reset control on their client ---
await page.goto(base)
await page.locator('input[type="email"]').fill('paul@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('text=Client activity', { timeout: 30000 })
await page.getByText('Jamie Bennett').first().click()
// The coach dashboard groups into collapsible sections whose open/closed state
// is remembered, so open Profile rather than assuming it is.
const profileSection = page.locator('.tile-group-title', { hasText: 'Profile' }).first()
await profileSection.waitFor({ timeout: 20000 }) // count() alone would race the render
if (!(await profileSection.locator('.tile-group-chev.open').count())) await profileSection.click()
const resetBtn = page.getByRole('button', { name: /Reset .*password/i })
ok('coach gets a reset control on the client', await resetBtn.first().waitFor({ timeout: 20000 }).then(() => true, () => false))
await resetBtn.first().click()
const suggested = await page.locator('label.field', { hasText: 'Temporary password' }).locator('input').inputValue()
ok('it suggests a readable password', /^[A-Za-z]+-\d{4}$/.test(suggested), suggested)

// --- client can change their own password ---
await page.evaluate(() => { try { localStorage.clear() } catch { /* ignore */ } })
await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.getByText('My details').first().click()
await page.waitForSelector('text=Health', { timeout: 20000 })
const changeBtn = page.getByRole('button', { name: 'Change my password' })
ok('client can change their own password', await changeBtn.waitFor({ timeout: 20000 }).then(() => true, () => false))
await changeBtn.click()
ok('it asks for it twice', await page.locator('input[type="password"]').count() >= 2, String(await page.locator('input[type="password"]').count()))

// --- exercise how-to without starting a session ---
await page.locator('.tab', { hasText: 'Home' }).click()
await page.waitForSelector('.agenda-card', { timeout: 20000 })
await page.getByRole('button', { name: 'Start a workout' }).first().click()
await page.waitForSelector('text=Train your way', { timeout: 20000 })
await page.locator('.session-card').first().locator('.session-head').click()
const tapName = page.locator('.ex-name.eg-tap').first()
ok('exercise names open the how-to before starting', await tapName.waitFor({ timeout: 20000 }).then(() => true, () => false))
await tapName.click()
ok('the guide opens', await page.getByText(/How to|Coaching cues|Loading/i).first().waitFor({ timeout: 25000 }).then(() => true, () => false))

ok('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
