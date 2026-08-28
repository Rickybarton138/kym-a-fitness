// Click-through of the 27 Aug programme-builder batch on a deployed build.
// The critical assertion is the ROUND TRIP: drop sets and superset grouping must
// survive rowsToExercises -> save -> planToRows -> reopen. That shape has been
// silently lost before, so it's tested through the real UI, not in isolation.
// Run: node tasks/e2e_round10_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round10_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul' // deploy permalinks aren't in HOST_BRAND

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const api = createClient(SUPA, KEY)
await api.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await api.auth.getUser()).data.user.id

const PROG = 'E2E Round10 Program'
const EX_NAME = 'E2E Zercher Carry'
// clean slate
const { data: old } = await api.from('workout_programs').select('id').eq('coach_id', paulId).eq('title', PROG)
for (const p of old || []) await api.from('workout_programs').delete().eq('id', p.id)
await api.from('workout_templates').delete().eq('coach_id', paulId).like('title', 'E2E %')
await api.from('coach_exercises').delete().eq('coach_id', paulId).like('name', 'E2E %')

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('paul@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('text=Client activity', { timeout: 30000 })

// --- activity filter (carried over from the 26 Aug batch, cheap to confirm) ---
ok('activity has an Unread filter', await page.getByRole('button', { name: /^Unread/ }).count() > 0)

// --- open the programme builder ---
await page.getByRole('button', { name: /Content library/ }).click()
await page.getByRole('button', { name: /^Programs$/ }).first().click().catch(() => {})
await page.waitForSelector('text=/Program|program/', { timeout: 20000 })

// create a programme via the API (the create form is well covered already; this
// test is about what happens INSIDE the builder)
const { data: prog } = await api.from('workout_programs')
  .insert({ coach_id: paulId, title: PROG, weeks: 4, level: 'Beginner' }).select().single()
await page.reload()
await page.waitForSelector(`text=${PROG}`, { timeout: 25000 })
await page.getByText(PROG).first().click()

// --- build a custom session with a superset + drop sets ---
await page.locator('select').filter({ hasText: 'Build a custom session' }).first().selectOption('__custom__')
await page.locator('input[placeholder="e.g. Upper Push A"]').fill('E2E Superset Session')

// exercise 1: superset, add its pair with the button
const firstSelect = page.locator('.ex-input select.ex-select').first()
await firstSelect.selectOption('Barbell Bench Press')
await page.locator('.ex-input').first().locator('select.ex-select').nth(1).selectOption('superset')
ok('superset button appears', await page.getByRole('button', { name: /Add exercise to this superset/ }).count() > 0)
await page.getByRole('button', { name: /Add exercise to this superset/ }).first().click()
const rows = page.locator('.ex-input')
ok('superset button inserts a paired row', await rows.count() >= 2, `${await rows.count()} rows`)
const groupInputs = page.locator('input[placeholder="Group (e.g. A)"]')
const g0 = await groupInputs.nth(0).inputValue()
const g1 = await groupInputs.nth(1).inputValue()
ok('the pair share an auto-assigned letter', !!g0 && g0 === g1, `${g0} / ${g1}`)

// second row: a typed-in exercise name, so we can prove it persists
await rows.nth(1).locator('select.ex-select').first().selectOption('__other__')
await rows.nth(1).locator('input[placeholder="Exercise name"]').fill(EX_NAME)

// fill sets on both rows
for (const i of [0, 1]) {
  const setRows = rows.nth(i).locator('.set-row')
  const n = await setRows.count()
  for (let k = 0; k < n; k++) {
    await setRows.nth(k).locator('input').nth(0).fill('8')
    await setRows.nth(k).locator('input').nth(1).fill('40')
  }
}

// third row: drop sets with a per-set count
await page.getByRole('button', { name: '+ Add exercise', exact: true }).click()
const drop = page.locator('.ex-input').nth(2)
await drop.locator('select.ex-select').first().selectOption('Leg Press')
await drop.locator('select.ex-select').nth(1).selectOption('dropset')
ok('drop-set column appears', await drop.locator('.set-grid.with-drops').count() > 0)
const dRows = drop.locator('.set-row')
for (let k = 0; k < await dRows.count(); k++) {
  await dRows.nth(k).locator('input').nth(0).fill('10')
  await dRows.nth(k).locator('input').nth(1).fill('80')
}
// "apply to all sets" shortcut
await drop.locator('input[placeholder="Drops"]').fill('2')
const perSet = await dRows.nth(0).locator('input').nth(2).inputValue()
ok('apply-to-all fills every set', perSet === '2', `set 1 drops = ${perSet}`)

// placement is now a week x day grid rather than two dropdowns
await page.locator('.slot-row').first().getByRole('button', { name: 'Any' }).click()
await page.getByRole('button', { name: 'Add to program' }).click()
await page.waitForSelector('text=E2E Superset Session', { timeout: 20000 })

// --- what actually got stored ---
const { data: sess } = await api.from('program_sessions').select('*').eq('program_id', prog.id)
const stored = sess?.[0]
const ex = stored?.exercises || []
ok('session saved', !!stored, `${sess?.length} sessions`)
const supers = ex.filter((e) => e.set_type === 'superset')
ok('superset pair stored with a shared group', supers.length === 2 && supers[0].group && supers[0].group === supers[1].group, JSON.stringify(supers.map((s) => s.group)))
const dropEx = ex.find((e) => e.set_type === 'dropset')
ok('drops stored per set', !!dropEx && dropEx.sets.every((s) => s.drops === 2), JSON.stringify(dropEx?.sets))

// --- item 3: the custom session became a reusable template ---
// The template insert follows the session insert, so poll rather than sample.
let tplCount = 0
for (let i = 0; i < 20 && tplCount === 0; i++) {
  const { data } = await api.from('workout_templates').select('title').eq('coach_id', paulId).eq('title', 'E2E Superset Session')
  tplCount = (data || []).length
  if (!tplCount) await new Promise((r) => setTimeout(r, 500))
}
ok('custom session saved as a reusable template', tplCount === 1)
await page.reload()
await page.waitForSelector(`text=${PROG}`)
await page.getByText(PROG).first().click()
const tplOptions = await page.locator('select').filter({ hasText: 'Build a custom session' }).first().innerText()
ok('and appears in the template dropdown for other weeks', tplOptions.includes('E2E Superset Session'), tplOptions.replace(/\n/g, ' | ').slice(0, 120))

// --- item 4: the typed exercise persisted ---
const { data: ce } = await api.from('coach_exercises').select('name').eq('coach_id', paulId).eq('name', EX_NAME)
ok('typed exercise name remembered', (ce || []).length === 1)

// --- THE ROUND TRIP: reopen the saved session and check nothing was lost ---
await page.locator('.sess-head').first().click()
await page.getByRole('button', { name: /^Edit$/ }).first().click()
await page.waitForSelector('.ex-input')
const reGroups = page.locator('input[placeholder="Group (e.g. A)"]')
ok('superset group survives a reopen', await reGroups.count() === 2 && (await reGroups.nth(0).inputValue()) === g0,
  `${await reGroups.count()} groups, first=${await reGroups.nth(0).inputValue().catch(() => '?')}`)
const reDropRow = page.locator('.ex-input').filter({ has: page.locator('.set-grid.with-drops') }).first()
const reDrop = await reDropRow.locator('.set-row').first().locator('input').nth(2).inputValue()
ok('drop counts survive a reopen', reDrop === '2', `got "${reDrop}"`)

ok('no page errors', errors.length === 0, errors.join(' | '))

// cleanup
await api.from('workout_programs').delete().eq('id', prog.id)
await api.from('workout_templates').delete().eq('coach_id', paulId).like('title', 'E2E %')
await api.from('coach_exercises').delete().eq('coach_id', paulId).like('name', 'E2E %')
await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
