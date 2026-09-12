// Paul, 12 Sept: "when people stop working and they have a payment, they still
// have access... I just need to be able to stop people from being able to get
// access if I need to, whether that's through disabling... or having the ability
// to pause and then resume as well as fully disable, so if somebody pauses for a
// couple of months... keep everything there so that when they come back they can
// get access to everything that they've put in."
// Plus: "tag test accounts as test accounts, and then be able to filter between
// standard, inner circle and test."
//
// The assertion that matters is not that a paused client sees a nice screen. It
// is that (a) they are actually locked out, (b) their data is still there when
// they come back, and (c) they cannot let themselves back in. All three are
// checked against the real deployed build.
//
// Run: node tasks/e2e_round33_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round33_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const OLLIE = 'bde1695f-eaea-477e-adfd-54c555644ef5'

const paul = createClient(SUPA, KEY)
await paul.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })

const restore = async () => {
  await paul.rpc('set_client_status', { p_client: OLLIE, p_status: 'active', p_note: null })
  await paul.rpc('set_client_test', { p_client: OLLIE, p_is_test: false })
}
await restore()

// What Ollie has logged, so we can prove a pause did not touch any of it.
const countRows = async () => {
  const t = ['nutrition_logs', 'workout_plans', 'body_measurements', 'daily_steps']
  const out = {}
  for (const tab of t) {
    const { count } = await paul.from(tab).select('id', { count: 'exact', head: true }).eq('client_id', OLLIE)
    out[tab] = count ?? 0
  }
  return out
}
const dataBefore = await countRows()

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const errors = []
const signIn = async (email) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  page.setDefaultTimeout(25000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('TestPass123')
  await page.getByRole('button', { name: /^Sign in$/ }).last().click()
  return page
}

// --- active: the baseline ----------------------------------------------------
let page = await signIn('ollie@redefine.app')
ok('an active client gets the app', await page.waitForSelector('.tabbar', { timeout: 30000 }).then(() => true, () => false))
await page.close()

// --- paused ------------------------------------------------------------------
const NOTE = 'Paused until November — see you then'
const { error: pErr } = await paul.rpc('set_client_status', { p_client: OLLIE, p_status: 'paused', p_note: NOTE })
ok('the coach can pause a client', !pErr, pErr ? pErr.message : '')

page = await signIn('ollie@redefine.app')
const held = await page.getByText(/membership is paused/i).waitFor({ timeout: 30000 }).then(() => true, () => false)
ok('a paused client is locked out', held)
ok('and told their data is safe', await page.getByText(/saved and will be exactly as you left it/i).count() > 0)
ok('and shown the coach’s note', await page.getByText(NOTE).count() > 0)
ok('with no app behind it', await page.locator('.tabbar').count() === 0)
await page.close()

// The point of pause, per Paul: nothing is lost.
const dataDuring = await countRows()
ok('pausing deleted nothing', JSON.stringify(dataDuring) === JSON.stringify(dataBefore),
  `${JSON.stringify(dataBefore)} -> ${JSON.stringify(dataDuring)}`)

// And they cannot simply let themselves back in.
const ollie = createClient(SUPA, KEY)
await ollie.auth.signInWithPassword({ email: 'ollie@redefine.app', password: 'TestPass123' })
const { error: selfErr } = await ollie.from('profiles').update({ status: 'active' }).eq('id', OLLIE)
const { data: stillPaused } = await paul.from('profiles').select('status').eq('id', OLLIE).single()
ok('a paused client cannot un-pause themselves', stillPaused.status === 'paused',
  selfErr ? selfErr.message.slice(0, 50) : 'no error — status now ' + stillPaused.status)

const { error: rpcErr } = await ollie.rpc('set_client_status', { p_client: OLLIE, p_status: 'active' })
ok('nor by calling the coach’s RPC', !!rpcErr, rpcErr ? rpcErr.message.slice(0, 40) : 'RPC ALLOWED IT')

// --- ended -------------------------------------------------------------------
await paul.rpc('set_client_status', { p_client: OLLIE, p_status: 'ended', p_note: null })
page = await signIn('ollie@redefine.app')
ok('an ended client is locked out too', await page.getByText(/membership has ended/i).waitFor({ timeout: 30000 }).then(() => true, () => false))
await page.close()

// --- resume ------------------------------------------------------------------
await paul.rpc('set_client_status', { p_client: OLLIE, p_status: 'active', p_note: null })
page = await signIn('ollie@redefine.app')
ok('resuming lets them straight back in', await page.waitForSelector('.tabbar', { timeout: 30000 }).then(() => true, () => false))
await page.close()

const dataAfter = await countRows()
ok('and everything they put in is still there', JSON.stringify(dataAfter) === JSON.stringify(dataBefore),
  JSON.stringify(dataAfter))

// --- the week planner must stay off Paul's brand -----------------------------
// `weekMealPlans` is a RUNTIME flag and every brand ships in one bundle, so
// grepping the bundle for the feature proves nothing — it is always in there.
// The only honest check is what a client on this brand can actually reach.
page = await signIn('ollie@redefine.app')
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.waitForTimeout(800)
ok('the meal-plan tile does not promise a week', await page.getByText(/a week with the shopping list/i).count() === 0)
const mealTile = page.getByText('Meal plan').first()
if (await mealTile.count()) {
  await mealTile.click()
  await page.waitForTimeout(1200)
  ok('and there is no whole-week option on this brand', await page.getByRole('button', { name: /A whole week/i }).count() === 0)
} else {
  ok('and there is no whole-week option on this brand', true, 'no meal-plan tile on this brand')
}
await page.close()

// --- the coach's list: filters and an honest count ---------------------------
await paul.rpc('set_client_test', { p_client: OLLIE, p_is_test: true })
const coach = await signIn('paul@redefine.app')
await coach.getByText(/Your clients/).first().waitFor({ timeout: 30000 })

const heading = await coach.getByText(/Your clients \(/).first().innerText()
// .eyebrow uppercases in CSS and innerText returns what is RENDERED, so this
// has to be case-insensitive — the first run failed on "20 ACTIVE".
ok('the count separates active from the rest', /active/i.test(heading), heading)
ok('a test account is not counted as active', !/^Your clients \(\d+\)$/.test(heading.trim()), heading)

ok('there is a Test filter', await coach.getByRole('button', { name: /^Test \(\d+\)$/ }).count() > 0)
ok('and Standard / Inner Circle filters', await coach.getByRole('button', { name: /^Standard \(\d+\)$/ }).count() > 0)

await coach.getByRole('button', { name: /^Test \(\d+\)$/ }).click()
await coach.waitForTimeout(600)
ok('filtering to Test shows the tagged client', await coach.getByText('Ollie Grant').count() > 0)

await coach.getByRole('button', { name: /^Standard \(\d+\)$/ }).click()
await coach.waitForTimeout(600)
ok('and Standard excludes them', await coach.getByText('Ollie Grant').count() === 0)
await coach.close()

ok('no page errors throughout', errors.length === 0, errors.join(' | '))

await browser.close()
await restore()
const { data: final } = await paul.from('profiles').select('status, is_test, status_note').eq('id', OLLIE).single()
ok('demo account left exactly as found', final.status === 'active' && !final.is_test && !final.status_note, JSON.stringify(final))

console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
