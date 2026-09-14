// Paul, 14 Sept: "when in a live workout can the client have the option to add
// extra exercises and swap an exercise in case they can't get on a machine etc
// and they swap for something else?"
// Ricky the same evening, using it himself: "wanted to add some flys on but
// couldn't."
//
// The assertion that matters is NOT that the buttons render. It is that what
// they do survives Finish. This codebase has lost data at exactly that seam
// twice — set_type/rpe once, drop counts once — because the player rebuilds the
// stored exercise from its own shape on the way out. So this drives a real
// session on the deployed build and reads workout_plans back afterwards.
//
// Run: node tasks/e2e_round35_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round35_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

const TITLE = 'E2E R35 Live session'
const cleanup = async () => { await jamie.from('workout_plans').delete().eq('client_id', jamieId).eq('title', TITLE) }
await cleanup()

// A session with a DROP SET on it, so the regression that has bitten twice is
// re-checked while the new controls are used alongside it.
const { data: plan, error: seedErr } = await jamie.from('workout_plans').insert({
  client_id: jamieId, title: TITLE, focus: 'Push',
  exercises: [
    { name: 'Machine Chest Press', set_type: 'drop', rpe: 8, cue: 'Slow on the way down', video: 'https://www.youtube.com/watch?v=CHESTPRESSDEMO', sets: [{ reps: '10', weight: '40', drops: 2 }, { reps: '10', weight: '40', drops: 2 }] },
    { name: 'Lateral Raise', sets: [{ reps: '15', weight: '8' }] },
  ],
}).select().single()
if (seedErr) { console.error('seed failed:', seedErr.message); process.exit(1) }

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// Stub the swap so the test does not depend on a model call; what is being
// tested is that the CHOICE lands and survives, not the suggestion quality.
await page.route('**/.netlify/functions/exercise-swap', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'Dumbbell Floor Press', cue: 'Elbows at 45 degrees' }) })
})

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })

// Paul's brand has the grouped nav, so the Train TAB is a hub — the sessions
// list is one tap further in, behind the today's-session tile.
await page.locator('.tab', { hasText: 'Train' }).click()
await page.getByText(/Today’s session|No session scheduled today/).first().click()
await page.getByText(TITLE).first().waitFor({ timeout: 25000 })
await page.getByText(TITLE).first().click()
await page.getByRole('button', { name: /^Start session$/ }).first().click()
await page.waitForSelector('.gw', { timeout: 25000 })
ok('the live player opens', await page.locator('.gw').count() > 0)

// --- swap, mid-session -------------------------------------------------------
ok('every exercise offers a swap', await page.getByRole('button', { name: /Swap it/i }).count() >= 2)
await page.getByRole('button', { name: /Swap it/i }).first().click()
await page.getByPlaceholder(/machine is in use/i).fill('someone is on the chest press')
await page.getByRole('button', { name: /Find alternative/i }).click()
await page.getByText('Dumbbell Floor Press').first().waitFor({ timeout: 20000 })
await page.getByRole('button', { name: /Use this swap/i }).click()
await page.waitForTimeout(600)
ok('the swapped exercise replaces it on screen', await page.getByText('Dumbbell Floor Press').count() > 0)

// --- add, mid-session --------------------------------------------------------
await page.getByPlaceholder(/Cable flye/i).fill('Cable Fly')
await page.getByRole('button', { name: /^Add$/ }).click()
await page.waitForTimeout(600)
ok('the added exercise appears in the session', await page.getByText('Cable Fly').count() > 0)
ok('and is marked as added during the session', await page.getByText(/Added during the session/i).count() > 0)

// Log something on it, so we know its sets are real and writable.
const rows = page.locator('.gw-ex').filter({ hasText: 'Cable Fly' })
await rows.locator('input[placeholder="kg"]').first().fill('15')
await rows.locator('input[type="checkbox"]').first().check()

await page.getByRole('button', { name: /Finish session/i }).click()
await page.getByText(/Session complete/i).waitFor({ timeout: 25000 })
await page.waitForTimeout(1500)

// --- what actually got stored ------------------------------------------------
const { data: after } = await jamie.from('workout_plans').select('exercises').eq('id', plan.id).single()
const names = (after.exercises || []).map((e) => e.name)
ok('the swap is saved', names.includes('Dumbbell Floor Press'), names.join(', '))
ok('the old name is gone', !names.includes('Machine Chest Press'), names.join(', '))
ok('the added exercise is saved', names.includes('Cable Fly'), names.join(', '))

const fly = (after.exercises || []).find((e) => e.name === 'Cable Fly')
ok('with its three sets and the weight logged on it', fly && fly.sets?.length === 3 && fly.sets[0].weight === '15', JSON.stringify(fly?.sets))
ok('and the coach can see it was added mid-session', /added during the session/i.test(fly?.cue || ''), fly?.cue)

const swapped = (after.exercises || []).find((e) => e.name === 'Dumbbell Floor Press')
ok('the swapped exercise keeps its prescribed sets', swapped && swapped.sets?.length === 2, JSON.stringify(swapped?.sets))
// THE regression: drops have been silently erased by this seam before.
ok('and the coach’s drop sets survive the swap', swapped && swapped.sets?.every((s) => s.drops === 2), JSON.stringify(swapped?.sets))
ok('the untouched exercise is untouched', names.includes('Lateral Raise'), names.join(', '))
// The coach filmed that demo for the movement they prescribed. Keeping it on a
// swapped exercise means "How to" plays the thing the client could not get on.
ok('the swapped exercise drops the old demo video', swapped && !swapped.video, String(swapped?.video))

ok('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
await cleanup()
console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
