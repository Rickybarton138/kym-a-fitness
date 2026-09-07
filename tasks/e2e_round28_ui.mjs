// Katie, 7 Sept: "when she hits save it just hangs and doesn't save it."
//
// The handler had no error handling: a failed request left the promise
// rejected, the busy flag never cleared, and the button sat on "Saving…" for
// ever saying nothing. She restarted the session, which is why her diary has
// the same session twice on two separate days.
//
// This asserts the FAILURE path, which is the bit that was never tested: the
// request is blocked on purpose, and the app has to say so, keep her sets, and
// let her try again. It also runs the repo-wide guard check, so no new handler
// can quietly acquire the same shape.
// Run: node tasks/e2e_round28_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
import { findUnguarded } from './check_async_guards.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round28_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'
const here = dirname(fileURLToPath(import.meta.url))

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

// ---------------------------------------------------------------------------
// 1. No NEW handler may hang
// ---------------------------------------------------------------------------
const allow = JSON.parse(readFileSync(join(here, 'async_guards_allowlist.json'), 'utf8'))
const found = findUnguarded()
const added = found.filter((x) => !allow.includes(x))
ok('no new save action can hang without saying so', added.length === 0, added.join(', '))
console.log(`      (${found.length} older handlers still to harden — the list may only shrink)`)

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

const today = new Date().toISOString().slice(0, 10)
const cleanup = async () => {
  await jamie.from('workout_plans').delete().eq('client_id', jamieId).like('title', 'E2E Hang%')
  await jamie.from('workout_completions').delete().eq('client_id', jamieId).eq('completed_on', today).eq('source', 'guided')
}
await cleanup()

const { data: plan } = await jamie.from('workout_plans').insert({
  client_id: jamieId, title: 'E2E Hang Session', focus: 'Legs', assigned_by: null,
  exercises: [{ name: 'Leg Press', equipment: 'Coach plan', sets: [{ reps: '10', weight: '' }, { reps: '10', weight: '' }] }],
}).select().single()

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
await page.locator('.tab', { hasText: 'Train' }).click()
const hero = page.locator('.tile-hero').first()
if (await hero.count()) await hero.click()
await page.waitForSelector('text=Your sessions', { timeout: 25000 })
const card = page.locator('.session-card', { hasText: 'E2E Hang Session' }).first()
await card.waitFor({ timeout: 25000 })
await card.locator('.session-head').click()
await card.getByRole('button', { name: /^Start session$/ }).click()
await page.waitForSelector('.gw-set', { timeout: 25000 })

// log some real work, so there is something to lose
const first = page.locator('.gw-set').first()
await first.locator('input.gw-in').nth(1).fill('120')
await first.locator('input[type="checkbox"]').check()
await page.waitForTimeout(1200)

// ---------------------------------------------------------------------------
// 2. Save, with the network against her
// ---------------------------------------------------------------------------
await page.route('**/rest/v1/workout_plans**', (route) => route.abort())
await page.getByRole('button', { name: /Finish session/i }).first().click()
await page.waitForTimeout(4000)

const stillThere = await page.locator('.gw-set').count() > 0
ok('a failed save does not swallow the session', stillThere)
const errText = await page.locator('.error').first().innerText().catch(() => '')
ok('it says something went wrong', !!errText, errText)
// A dropped connection throws "TypeError: Failed to fetch". Showing that to
// someone mid-workout tells them nothing and looks broken.
ok('in words a client can act on, not a stack trace',
  /connection|signal/i.test(errText) && !/TypeError|fetch|undefined/i.test(errText), errText)
const btn = page.getByRole('button', { name: /Finish session|Try again/i }).first()
ok('and the button comes back instead of hanging on Saving',
  !(await btn.isDisabled()) && !/Saving/.test(await btn.innerText()), await btn.innerText())
ok('offering a retry', /Try again/i.test(await btn.innerText()), await btn.innerText())
ok('their logged weight is still on screen', (await first.locator('input.gw-in').nth(1).inputValue()) === '120',
  await first.locator('input.gw-in').nth(1).inputValue())
ok('and it was not marked complete on a failed save',
  ((await jamie.from('workout_completions').select('id').eq('client_id', jamieId).eq('completed_on', today).eq('source', 'guided')).data || []).length === 0)

// ---------------------------------------------------------------------------
// 3. Retry, with the network back
// ---------------------------------------------------------------------------
await page.unroute('**/rest/v1/workout_plans**')
await btn.click()
await page.waitForTimeout(5000)

const { data: saved } = await jamie.from('workout_plans').select('exercises').eq('id', plan.id).single()
ok('retrying actually saves it', saved?.exercises?.[0]?.sets?.[0]?.weight === '120',
  JSON.stringify(saved?.exercises?.[0]?.sets?.[0]))
ok('and marks the session complete', ((await jamie.from('workout_completions').select('id').eq('client_id', jamieId).eq('completed_on', today).eq('source', 'guided')).data || []).length === 1)
ok('with no leftover resume prompt', await page.locator('.resume-card').count() === 0)

ok('no page errors', errors.length === 0, errors.join(' | '))

await cleanup()
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
