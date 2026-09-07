// Paul: "Longer term on Standard, I wonder if it is possible to configure the
// app to run through a series of 'popups' that take them through the next steps
// — you know how some apps do a 'walk through'."
//
// Built as a checklist that ticks itself off from the client's real activity
// rather than a tooltip tour, so it cannot be clicked past without the work
// being done, and it survives closing the app. Asserted accordingly: doing the
// thing must tick the step, and Inner Circle must never see it.
// Run: node tasks/e2e_round26_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round26_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const coach = createClient(SUPA, KEY)
await coach.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })

const cl = createClient(SUPA, KEY)
await cl.auth.signInWithPassword({ email: 'e2e-welcome@redefine.app', password: 'TestPass123' })
const id = (await cl.auth.getUser()).data.user.id

// A client who has just joined and done nothing yet.
await cl.from('body_measurements').delete().eq('client_id', id)
await cl.from('nutrition_logs').delete().eq('client_id', id)
await cl.from('workout_completions').delete().eq('client_id', id)
await cl.from('messages').delete().eq('client_id', id)
await cl.from('client_programs').update({ active: false }).eq('client_id', id)
await cl.from('profiles').update({ targets_reviewed_at: null, welcome_seen_at: new Date().toISOString() }).eq('id', id)
await coach.rpc('set_member_tier', { p_client: id, p_tier: 'standard' })

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const signIn = async (p) => {
  await p.goto(base)
  await p.locator('input[type="email"]').fill('e2e-welcome@redefine.app')
  await p.locator('input[type="password"]').fill('TestPass123')
  await p.getByRole('button', { name: /^Sign in$/ }).last().click()
  await p.waitForSelector('.tabbar', { timeout: 30000 })
}
await signIn(page)

const gs = page.locator('.gs-card')
ok('a new standard client is walked through the first steps',
  await gs.waitFor({ timeout: 25000 }).then(() => true, () => false))
ok('with nothing ticked yet', /0 of 6 done/.test(await gs.innerText()), (await gs.innerText()).split('\n').slice(0, 3).join(' | '))
ok('every step is listed', await gs.locator('.gs-step').count() === 6, `${await gs.locator('.gs-step').count()} steps`)
ok('and only the next one is actionable', await gs.locator('.gs-step.next').count() === 1)
ok('which takes them somewhere', await gs.getByRole('button', { name: /Take me there/i }).count() === 1)

// Doing the thing must tick the step — that is the whole point of deriving it
// from real activity rather than from a "next" button.
await cl.from('body_measurements').insert({ client_id: id, weight_kg: 82, measured_at: new Date().toISOString().slice(0, 10) })
await page.reload()
await page.waitForSelector('.gs-card', { timeout: 25000 })
await page.waitForTimeout(1500)
ok('logging a real measurement ticks that step off', /1 of 6 done/.test(await gs.innerText()),
  (await gs.innerText()).split('\n').slice(0, 3).join(' | '))
ok('and it shows as done in the list', await gs.locator('.gs-step.done').count() === 1)

// Inner Circle must not be nagged to set themselves up.
await coach.rpc('set_member_tier', { p_client: id, p_tier: 'inner_circle' })
await page.reload()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.waitForTimeout(2500)
ok('an Inner Circle client is never shown it', await page.locator('.gs-card').count() === 0)
await coach.rpc('set_member_tier', { p_client: id, p_tier: 'standard' })

// It can be dismissed, and stays dismissed.
await page.reload()
await page.waitForSelector('.gs-card', { timeout: 25000 })
await gs.getByRole('button', { name: /^Hide$/ }).click()
await page.waitForTimeout(600)
ok('it can be hidden', await page.locator('.gs-card').count() === 0)
await page.reload()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.waitForTimeout(2000)
ok('and stays hidden', await page.locator('.gs-card').count() === 0)

ok('no page errors', errors.length === 0, errors.join(' | '))

await cl.from('body_measurements').delete().eq('client_id', id)
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
