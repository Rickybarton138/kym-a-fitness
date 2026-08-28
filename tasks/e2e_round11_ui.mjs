// The 28 Aug batch: the build-update prompt (why Paul's shipped features looked
// "not landed"), plus the programme builder's collapsed sessions, editable
// week/day, and placing one session across many weeks at once.
// Run: node tasks/e2e_round11_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round11_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const api = createClient(SUPA, KEY)
await api.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await api.auth.getUser()).data.user.id

const PROG = 'E2E Round11 Program'
const { data: old } = await api.from('workout_programs').select('id').eq('coach_id', paulId).eq('title', PROG)
for (const p of old || []) await api.from('workout_programs').delete().eq('id', p.id)
await api.from('workout_templates').delete().eq('coach_id', paulId).like('title', 'E2E %')

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})

// ---------------------------------------------------------------------------
// 1. The update prompt. Serve a version.json that disagrees with the compiled
//    build id — exactly what a client running a stale bundle sees.
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
  const real = await fetch(SITE + '/version.json').then((r) => r.json()).catch(() => null)
  ok('version.json is served', !!real?.build, JSON.stringify(real))

  await page.route('**/version.json*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ build: 'a-newer-build' }),
  }))
  await page.goto(base)
  const bar = page.locator('.update-bar')
  ok('stale build shows the reload prompt', await bar.waitFor({ timeout: 15000 }).then(() => true, () => false))
  ok('prompt offers a Reload button', await bar.getByRole('button', { name: 'Reload' }).count() > 0)
  await page.close()
}
{
  // ...and stays out of the way when the build matches.
  const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
  await page.goto(base)
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.waitForTimeout(2500)
  ok('current build shows no prompt', await page.locator('.update-bar').count() === 0)
  await page.close()
}

// ---------------------------------------------------------------------------
// 2. Programme builder
// ---------------------------------------------------------------------------
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('paul@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('text=Client activity', { timeout: 30000 })

const { data: prog } = await api.from('workout_programs')
  .insert({ coach_id: paulId, title: PROG, weeks: 4, level: 'Beginner' }).select().single()

await page.getByRole('button', { name: /Content library/ }).click()
await page.getByRole('button', { name: /^Programs$/ }).first().click().catch(() => {})
await page.waitForSelector('text=' + PROG, { timeout: 25000 })
await page.getByText(PROG).first().click()

// --- the slot grid replaces the single week/day pickers ---
ok('week x day grid shown', await page.locator('.slot-grid').count() > 0)
ok('one row per programme week', await page.locator('.slot-row').count() === 4, (await page.locator('.slot-row').count()) + ' rows')

// build one session and place it on three weeks at once
await page.locator('select').filter({ hasText: 'Build a custom session' }).first().selectOption('__custom__')
await page.locator('input[placeholder="e.g. Upper Push A"]').fill('E2E Placed Session')
const exRow = page.locator('.ex-input').first()
await exRow.locator('select.ex-select').first().selectOption('Barbell Bench Press')
const setRows = exRow.locator('.set-row')
for (let k = 0; k < await setRows.count(); k++) {
  await setRows.nth(k).locator('input').nth(0).fill('8')
  await setRows.nth(k).locator('input').nth(1).fill('60')
}
// week 1 Mon, week 2 Wed, week 3 Fri — Paul's rota case
const slotRows = page.locator('.slot-row')
await slotRows.nth(0).getByRole('button', { name: 'Mon' }).click()
await slotRows.nth(1).getByRole('button', { name: 'Wed' }).click()
await slotRows.nth(2).getByRole('button', { name: 'Fri' }).click()
ok('ticked slots highlight', await page.locator('.slot-days button.on').count() === 3, (await page.locator('.slot-days button.on').count()) + ' on')

await page.getByRole('button', { name: 'Add to program' }).click()
await page.waitForSelector('text=E2E Placed Session', { timeout: 20000 })

const { data: made } = await api.from('program_sessions').select('*').eq('program_id', prog.id).order('week')
ok('one row per ticked slot', (made || []).length === 3, (made || []).length + ' rows')
ok('placed on the right week/day pairs',
  JSON.stringify((made || []).map((m) => [m.week, m.dow])) === JSON.stringify([[1, 1], [2, 3], [3, 5]]),
  JSON.stringify((made || []).map((m) => [m.week, m.dow])))
ok('all three share the session', (made || []).every((m) => m.title === 'E2E Placed Session'))

// --- sessions are collapsed until opened ---
ok('session headers are buttons', await page.locator('.sess-head').count() === 3, (await page.locator('.sess-head').count()) + ' headers')
ok('exercises hidden until opened', await page.locator('.ex-list').count() === 0, (await page.locator('.ex-list').count()) + ' lists')
await page.locator('.sess-head').first().click()
ok('opening one shows its exercises, others stay closed', await page.locator('.ex-list').count() === 1, (await page.locator('.ex-list').count()) + ' lists')

// --- move a session to a different week and day ---
await page.getByRole('button', { name: /^Edit$/ }).first().click()
await page.waitForSelector('.ex-input')
const weekInput = page.locator('label.field', { hasText: 'Week' }).locator('input[type="number"]').first()
ok('edit form exposes the week', await weekInput.count() > 0)
await weekInput.fill('4')
await page.locator('label.field', { hasText: 'Day' }).locator('select').first().selectOption('6')
await page.getByRole('button', { name: 'Save session' }).click()
await page.waitForTimeout(3000)

const { data: moved } = await api.from('program_sessions').select('week, dow').eq('program_id', prog.id).order('week')
ok('session moved to the new week & day', (moved || []).some((m) => m.week === 4 && m.dow === 6), JSON.stringify(moved))
ok('the other two are untouched', (moved || []).filter((m) => m.week !== 4).length === 2, JSON.stringify(moved))

ok('no page errors', errors.length === 0, errors.join(' | '))

// cleanup
await api.from('workout_programs').delete().eq('id', prog.id)
await api.from('workout_templates').delete().eq('coach_id', paulId).like('title', 'E2E %')
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
