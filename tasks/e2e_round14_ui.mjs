// The 30 Aug batch: work in progress must survive a reload (the client session
// that "disappeared" and the coach builder that "randomly refreshed"), plus
// reusing a programme's own sessions across weeks, a guarded delete, and not
// being forced to pick training days a programme already specifies.
// Run: node tasks/e2e_round14_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round14_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const coach = createClient(SUPA, KEY)
await coach.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await coach.auth.getUser()).data.user.id

const PROG = 'E2E Reuse Program'
const DOOMED = 'E2E Doomed Program'
const DAYS_PROG = 'E2E Authored Days Program'
for (const t of [PROG, DOOMED, DAYS_PROG]) {
  const { data: old } = await coach.from('workout_programs').select('id').eq('coach_id', paulId).eq('title', t)
  for (const p of old || []) await coach.from('workout_programs').delete().eq('id', p.id)
}

// a programme with one session already in it, built the "old" way (no template row)
const { data: prog } = await coach.from('workout_programs')
  .insert({ coach_id: paulId, title: PROG, weeks: 4, level: 'Beginner' }).select().single()
await coach.from('program_sessions').insert({
  program_id: prog.id, position: 0, week: 1, dow: null, title: 'E2E Legacy Session', focus: 'Legs',
  exercises: [{ name: 'Leg Press', equipment: 'Coach plan', cue: '', sets: [{ reps: '10', weight: '80' }] }],
})
// one to delete
const { data: doomed } = await coach.from('workout_programs')
  .insert({ coach_id: paulId, title: DOOMED, weeks: 1, level: 'Beginner' }).select().single()
// one whose sessions carry real weekdays
const { data: daysProg } = await coach.from('workout_programs')
  .insert({ coach_id: paulId, title: DAYS_PROG, weeks: 1, level: 'Beginner' }).select().single()
await coach.from('program_sessions').insert({
  program_id: daysProg.id, position: 0, week: 1, dow: 2, title: 'E2E Tuesday Session', focus: 'Upper',
  exercises: [{ name: 'Barbell Bench Press', equipment: 'Coach plan', cue: '', sets: [{ reps: '8', weight: '60' }] }],
})

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})

// ---------------------------------------------------------------------------
// 1. Client: a half-built session survives a reload
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
  page.setDefaultTimeout(25000)
  await page.goto(base)
  await page.locator('input[type="email"]').fill('jamie@redefine.app')
  await page.locator('input[type="password"]').fill('TestPass123')
  await page.getByRole('button', { name: /^Sign in$/ }).last().click()
  await page.waitForSelector('.tabbar', { timeout: 30000 })
  await page.evaluate(() => { try { localStorage.removeItem('cbk_wbdraft:own:' + '') } catch { /* ignore */ } })

  await page.locator('.tab', { hasText: 'Home' }).click()
  await page.waitForSelector('.agenda-card', { timeout: 20000 })
  await page.getByRole('button', { name: 'Start a workout' }).first().click()
  await page.waitForSelector('text=Train your way', { timeout: 20000 })
  await page.getByRole('button', { name: 'Build your own' }).click()
  await page.waitForSelector('input[placeholder="e.g. Leg day"]', { timeout: 20000 })

  await page.locator('input[placeholder="e.g. Leg day"]').fill('E2E Half Built')
  const row = page.locator('.ex-input').first()
  await row.locator('select.ex-select').first().selectOption('__other__')
  await row.locator('input[placeholder="Exercise name"]').fill('E2E Sled Push')
  await row.locator('.set-row').first().locator('input').nth(0).fill('5')
  await row.locator('.set-row').first().locator('input').nth(1).fill('100')
  await page.waitForTimeout(800) // let the draft write

  // the reload that used to wipe it
  await page.reload()
  await page.waitForSelector('.tabbar', { timeout: 30000 })
  await page.getByRole('button', { name: 'Build your own' }).click().catch(() => {})
  await page.waitForSelector('input[placeholder="e.g. Leg day"]', { timeout: 20000 })
  ok('client’s half-built session survives a reload',
    (await page.locator('input[placeholder="e.g. Leg day"]').inputValue()) === 'E2E Half Built',
    await page.locator('input[placeholder="e.g. Leg day"]').inputValue())
  ok('and says so rather than looking empty', (await page.locator('body').innerText()).includes('Picked up where you left off'))

  // saving it for real clears the draft
  await page.getByRole('button', { name: 'Save session' }).click()
  await page.waitForTimeout(2500)
  ok('saving clears the draft', (await page.locator('input[placeholder="e.g. Leg day"]').inputValue()) === '')
  const jamie = createClient(SUPA, KEY)
  await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
  const jamieId = (await jamie.auth.getUser()).data.user.id
  const { data: saved } = await jamie.from('workout_plans').select('id, title').eq('client_id', jamieId).eq('title', 'E2E Half Built')
  ok('and the session really is in the database', (saved || []).length === 1, JSON.stringify(saved))
  await jamie.from('workout_plans').delete().eq('client_id', jamieId).eq('title', 'E2E Half Built')
  await page.close()
}

// ---------------------------------------------------------------------------
// 2. Coach
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
await page.getByRole('button', { name: /Content library/ }).click()
await page.getByRole('button', { name: /^Programs$/ }).first().click().catch(() => {})
await page.waitForSelector('text=' + PROG, { timeout: 25000 })
await page.getByText(PROG).first().click()

// --- a session already in the programme is selectable ---
// the programme's sessions load after it expands, and they feed the dropdown
await page.waitForSelector('text=E2E Legacy Session', { timeout: 20000 })
const addSelect = page.locator('select').filter({ hasText: 'Build a custom session' }).first()
const optText = await addSelect.innerText()
ok('existing programme sessions are offered', optText.includes('E2E Legacy Session'), optText.replace(/\n/g, ' | ').slice(0, 140))

// --- and can be placed on several more weeks at once ---
const legacyValue = await page.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((s) => s.innerText.includes('Build a custom session'))
  const opt = [...sel.options].find((o) => o.text.includes('E2E Legacy Session'))
  return opt ? opt.value : null
})
ok('it carries a programme-session value', !!legacyValue && legacyValue.startsWith('ps:'), String(legacyValue))
await addSelect.selectOption(legacyValue)
const slotRows = page.locator('.slot-row')
await slotRows.nth(1).getByRole('button', { name: 'Any' }).click()
await slotRows.nth(2).getByRole('button', { name: 'Any' }).click()
await page.getByRole('button', { name: 'Add to program' }).click()
await page.waitForTimeout(3000)

const { data: placed } = await coach.from('program_sessions').select('week').eq('program_id', prog.id).order('week')
ok('placed on the extra weeks without rebuilding it',
  JSON.stringify((placed || []).map((x) => x.week)) === JSON.stringify([1, 2, 3]),
  JSON.stringify((placed || []).map((x) => x.week)))

// --- a half-built custom session survives a reload ---
await addSelect.selectOption('__custom__')
await page.locator('input[placeholder="e.g. Upper Push A"]').fill('E2E Coach Half Built')
const cRow = page.locator('.ex-input').first()
await cRow.locator('select.ex-select').first().selectOption('Leg Press')
await cRow.locator('.set-row').first().locator('input').nth(0).fill('12')
await cRow.locator('.set-row').first().locator('input').nth(1).fill('90')
await page.waitForTimeout(800)
await page.reload()
await page.waitForSelector('text=' + PROG, { timeout: 25000 })
await page.getByText(PROG).first().click()
await page.locator('select').filter({ hasText: 'Build a custom session' }).first().selectOption('__custom__')
await page.waitForSelector('input[placeholder="e.g. Upper Push A"]', { timeout: 20000 })
ok('coach’s half-built session survives a reload',
  (await page.locator('input[placeholder="e.g. Upper Push A"]').inputValue()) === 'E2E Coach Half Built',
  await page.locator('input[placeholder="e.g. Upper Push A"]').inputValue())
ok('including the exercises typed into it',
  (await page.locator('.ex-input').first().locator('.set-row').first().locator('input').nth(1).inputValue()) === '90',
  await page.locator('.ex-input').first().locator('.set-row').first().locator('input').nth(1).inputValue())

// --- deleting a programme asks first ---
await page.getByText(DOOMED).first().click()
await page.getByRole('button', { name: 'Delete program' }).first().click()
ok('delete asks before destroying it', (await page.locator('body').innerText()).includes('can’t be undone'))
await page.getByRole('button', { name: 'Keep it' }).click()
const { data: stillThere } = await coach.from('workout_programs').select('id').eq('id', doomed.id)
ok('backing out keeps the programme', (stillThere || []).length === 1)
await page.getByRole('button', { name: 'Delete program' }).first().click()
await page.getByRole('button', { name: 'Yes, delete it' }).click()
await page.waitForTimeout(2500)
const { data: gone } = await coach.from('workout_programs').select('id').eq('id', doomed.id)
ok('confirming deletes it', (gone || []).length === 0)

ok('no page errors', errors.length === 0, errors.join(' | '))

// cleanup
for (const id of [prog.id, doomed.id, daysProg.id]) await coach.from('workout_programs').delete().eq('id', id)
await coach.from('workout_templates').delete().eq('coach_id', paulId).like('title', 'E2E %')
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
