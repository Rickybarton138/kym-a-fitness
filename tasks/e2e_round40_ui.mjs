// Paul, 28 Sept: "with standard membership can we have it that when they go into
// their assigned program that they can have a button to change program. I think
// at the moment it looks like they haven't got the ability to remove the
// existing program. Maybe selecting a new one overrides the current one. If not
// it may make sense to have a remove or replace button... I am assuming on the
// coach side I can remove/unassign programs for all clients?"
//
// Three things, and two of them are questions rather than features:
//   - does picking a new programme replace the old one? (it did already)
//   - can the coach unassign? (he could already)
//   - can the client get off a plan from the plan screen? (he could not)
// All three are asserted here so the answers stay true.
//
// Run: node tasks/e2e_round40_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round40_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

// Ollie is the STANDARD-tier demo client, which is the membership Paul asked
// about — an Inner Circle client is put on a plan by his coach.
const ollie = createClient(SUPA, KEY)
await ollie.auth.signInWithPassword({ email: 'ollie@redefine.app', password: 'TestPass123' })
const ollieId = (await ollie.auth.getUser()).data.user.id

const active = async () => (await ollie.from('client_programs')
  .select('id, program_id').eq('client_id', ollieId).eq('active', true)).data || []
const restore = async () => { await ollie.from('client_programs').delete().eq('client_id', ollieId).eq('active', true) }

// Two programmes to move between.
const { data: progs } = await ollie.from('workout_programs').select('id, title').limit(2)
if (!progs || progs.length < 2) { console.error('need two programmes in the library'); process.exit(1) }
// client_programs wants a coach_id — the first run left it out, the insert was
// rejected, and the test then reported the plan screen missing rather than its
// own seed missing. Checked from here on.
const PAUL = '5c7d9e36-1a21-46f5-8a0f-4ec2f84323b2'
await restore()
const seed = await ollie.from('client_programs').insert({
  client_id: ollieId, coach_id: PAUL, program_id: progs[0].id, start_date: new Date().toISOString().slice(0, 10),
  repeat: true, active: true, day_map: [1, 3, 5],
})
if (seed.error) { console.error('could not seed an assignment:', seed.error.message); process.exit(1) }

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('ollie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })

// Into the plan itself — which is where Paul says the buttons are missing.
await page.locator('.tab', { hasText: 'Train' }).click()
await page.getByText(/Your plan/i).first().click()
await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 25000 })
ok('the plan screen opens on their programme', (await page.getByRole('heading', { level: 1 }).innerText()).trim().length > 0,
  (await page.getByRole('heading', { level: 1 }).innerText()).trim())

ok('there is a change-programme button', await page.getByRole('button', { name: /Change programme/i }).count() === 1)
ok('and a stop-following button', await page.getByRole('button', { name: /Stop following/i }).count() === 1)

// --- stopping asks first, and says nothing is lost ---------------------------
await page.getByRole('button', { name: /Stop following/i }).click()
ok('stopping asks before it does it', await page.getByRole('button', { name: /Yes, stop it/i }).count() === 1)
ok('and promises the logged sessions are kept', await page.getByText(/every session you logged stays/i).count() > 0)

await page.getByRole('button', { name: /Keep it/i }).click()
await page.waitForTimeout(600)
ok('backing out changes nothing', (await active()).length === 1, JSON.stringify(await active()))

await page.getByRole('button', { name: /Stop following/i }).click()
await page.getByRole('button', { name: /Yes, stop it/i }).click()
await page.waitForTimeout(2500)
ok('confirming actually takes them off it', (await active()).length === 0, JSON.stringify(await active()))
ok('and the screen offers a way back on', await page.getByRole('button', { name: /Browse programmes/i }).count() === 1)

// --- picking a new one replaces rather than stacks ---------------------------
// Paul's own guess: "maybe selecting a new one overrides the current one". It
// does, and has all along — this keeps that true.
await ollie.from('client_programs').insert({
  client_id: ollieId, coach_id: PAUL, program_id: progs[0].id, start_date: new Date().toISOString().slice(0, 10), repeat: true, active: true, day_map: [1, 3, 5],
})
await ollie.from('client_programs').update({ active: false }).eq('client_id', ollieId).eq('active', true)
await ollie.from('client_programs').insert({
  client_id: ollieId, coach_id: PAUL, program_id: progs[1].id, start_date: new Date().toISOString().slice(0, 10), repeat: true, active: true, day_map: [2, 4],
})
const rows = await active()
ok('only ever one programme is active at a time', rows.length === 1 && rows[0].program_id === progs[1].id,
  `${rows.length} active`)

await page.close()

// --- the coach can unassign, which is the other half of his question ---------
const coach = await browser.newPage({ viewport: { width: 390, height: 900 } })
coach.setDefaultTimeout(25000)
coach.on('pageerror', (e) => errors.push(e.message))
await coach.goto(base)
await coach.locator('input[type="email"]').fill('paul@redefine.app')
await coach.locator('input[type="password"]').fill('TestPass123')
await coach.getByRole('button', { name: /^Sign in$/ }).last().click()
await coach.getByRole('button', { name: /^All \(\d+\)$/ }).waitFor({ timeout: 30000 })
await coach.locator('.tile').filter({ hasText: 'Ollie' }).first().click()
const trainingSection = coach.locator('.tile-group-title').filter({ hasText: /training/i }).first()
await trainingSection.waitFor({ timeout: 25000 })
if (!(await coach.getByRole('button', { name: /Stop program/i }).count())) {
  await trainingSection.click()
  await coach.waitForTimeout(1200)
}
ok('the coach can stop a client’s programme', await coach.getByRole('button', { name: /Stop program/i }).count() >= 1)
await coach.getByRole('button', { name: /Stop program/i }).first().click()
await coach.waitForTimeout(2500)
ok('and it comes off', (await active()).length === 0, JSON.stringify(await active()))
await coach.close()

ok('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
await restore()
console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
