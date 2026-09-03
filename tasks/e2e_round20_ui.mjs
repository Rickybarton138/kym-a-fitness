// The 3 Sept batch.
//
// 1. "When I assign her program it doesn't actually assign to her ... when I
//    refresh it disappears. If I do it from today and click the second confirm
//    button it then drops in. If I back date the start, do I have to change the
//    date and click the second confirm?"
//    Yes he did, and that was the bug: TWO start-date fields. The one on the
//    assign card looked like the real one and was silently discarded — the
//    picker's own date always initialised to today and won. Katie ended up with
//    exactly one row, dated today, after several backdated attempts.
// 2. "Her week 1 is Monday, Thursday, Saturday and Sunday. But in the app it
//    lists it as Sunday, Monday, Thursday, Saturday." getDay() puts Sunday at 0,
//    so a numeric sort of weekdays leads with Sunday.
// 3. Waist / Chest / Hips / Thigh / Bicep measurements.
// Run: node tasks/e2e_round20_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
import { sortDays, dowRank, byDow } from '../src/lib.js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round20_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const coach = createClient(SUPA, KEY)
await coach.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await coach.auth.getUser()).data.user.id
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

// ---------------------------------------------------------------------------
// 1. Week order, at the unit level — Katie's actual days
// ---------------------------------------------------------------------------
ok('Katie’s days read Monday first', sortDays([0, 1, 4, 6]).join(',') === '1,4,6,0', sortDays([0, 1, 4, 6]).join(','))
ok('Sunday sorts last, not first', dowRank(0) > dowRank(6), `Sun=${dowRank(0)} Sat=${dowRank(6)}`)
ok('a whole week comes out Mon..Sun', sortDays([0, 1, 2, 3, 4, 5, 6]).join(',') === '1,2,3,4,5,6,0', sortDays([0, 1, 2, 3, 4, 5, 6]).join(','))
ok('an unset day still sorts to the end', byDow(null, 0) > 0, String(byDow(null, 0)))

// ---------------------------------------------------------------------------
// 2. Assigning with a BACKDATED start, through the UI
// ---------------------------------------------------------------------------
const { data: prog } = await coach.from('workout_programs')
  .insert({ coach_id: paulId, title: 'E2E Assign Program', weeks: 2, level: 'Beginner' }).select().single()
// week 1 on Mon/Thu/Sat/Sun, exactly Katie's shape
for (const [i, dow] of [1, 4, 6, 0].entries()) {
  await coach.from('program_sessions').insert({
    program_id: prog.id, position: i, week: 1, dow,
    title: `E2E Session ${i + 1}`, exercises: [{ name: 'Leg Press', sets: [{ reps: 10, weight: 50 }] }],
  })
}
await coach.from('client_programs').delete().eq('client_id', jamieId).eq('program_id', prog.id)

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('paul@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('text=Client activity', { timeout: 30000 })
await page.getByText('Jamie Bennett').first().click()

// The client page groups into collapsible sections whose state is remembered,
// so open Training rather than assuming it is.
const openTraining = async () => {
  const sec = page.locator('.tile-group-title', { hasText: 'Training' }).first()
  await sec.waitFor({ timeout: 20000 })
  if (!(await sec.locator('.tile-group-chev.open').count())) await sec.click()
}
await openTraining()

const card = page.locator('.card', { hasText: 'Assign a program' }).first()
await card.waitFor({ timeout: 20000 })

// The decoy is gone: exactly one start date in the whole flow, and it is not
// on this card.
ok('no start date on the assign card', await card.locator('input[type="date"]').count() === 0,
  `${await card.locator('input[type="date"]').count()} date inputs`)
const firstBtn = card.getByRole('button', { name: /Next: days & start date/ })
ok('the first button says it is a next step, not the assignment', await firstBtn.count() > 0)

await card.locator('select.ex-select').selectOption(prog.id)
await firstBtn.click()
const dateIn = card.locator('input[type="date"]')
ok('the start date appears on the step that commits', await dateIn.waitFor({ timeout: 15000 }).then(() => true, () => false))
ok('and there is only one of them', await dateIn.count() === 1, String(await dateIn.count()))

const BACK = '2026-08-10' // a Monday, three weeks back
await dateIn.fill(BACK)
for (const d of ['Mon', 'Thu', 'Sat', 'Sun']) await card.locator('.seg button', { hasText: new RegExp('^' + d + '$') }).click()
const confirm = card.getByRole('button', { name: /^(Assign|Replace) program$/ })
ok('the committing button names the action', await confirm.count() > 0)
await confirm.click()
await page.waitForTimeout(3000)

const { data: row } = await coach.from('client_programs')
  .select('start_date, day_map, active').eq('client_id', jamieId).eq('program_id', prog.id).maybeSingle()
ok('the assignment is actually written', !!row, JSON.stringify(row))
ok('the BACKDATED start is what got stored', row?.start_date === BACK, String(row?.start_date))
ok('and it is active', row?.active === true, String(row?.active))
ok('the days are stored Monday-first', (row?.day_map || []).join(',') === '1,4,6,0', JSON.stringify(row?.day_map))

// survives a reload — Paul's "when I refresh it disappears"
await page.reload()
await page.waitForSelector('text=Client activity', { timeout: 30000 })
await page.getByText('Jamie Bennett').first().click()
await openTraining()
const onCard = page.locator('.card', { hasText: 'Assign a program' }).first()
await onCard.waitFor({ timeout: 20000 })
const onText = await onCard.innerText()
ok('it is still there after a refresh', /E2E Assign Program/.test(onText), onText.replace(/\n/g, ' | ').slice(0, 160))
ok('showing the backdated start', onText.includes(BACK), onText.replace(/\n/g, ' | ').slice(0, 160))
ok('and the days in Paul’s order, not Sunday first',
  /Mon, Thu, Sat, Sun/.test(onText), (onText.match(/Training [^\n]*/) || [''])[0])

// ---------------------------------------------------------------------------
// 3. Measurements
// ---------------------------------------------------------------------------
await coach.from('body_measurements').delete().eq('client_id', jamieId).eq('note', 'E2E sites')
const { error: mErr } = await jamie.from('body_measurements').insert({
  client_id: jamieId, measured_at: '2026-09-01', note: 'E2E sites',
  weight_kg: 80, waist_cm: 86, chest_cm: 104, hips_cm: 98, thigh_cm: 58, bicep_cm: 35,
})
ok('all five sites store', !mErr, mErr?.message)

await page.evaluate(() => { try { localStorage.clear() } catch { /* ignore */ } })
await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.locator('.tab', { hasText: 'Check-ins & Progress' }).click()
await page.getByRole('button', { name: /^Measurements$|Body log|Log this week/i }).first().click().catch(() => {})
await page.waitForSelector('text=Log this week', { timeout: 25000 })
const form = page.locator('form.card', { hasText: 'Log this week' }).first()
const formText = await form.innerText()
for (const site of ['Waist', 'Chest', 'Hips', 'Thigh', 'Bicep']) {
  ok(`the client can log ${site.toLowerCase()}`, formText.includes(site), '')
}
// and the trend switcher shows what has been logged
const body = await page.locator('body').innerText()
ok('the logged sites appear as trends to view', /Chest/.test(body) && /Bicep/.test(body))

ok('no page errors', errors.length === 0, errors.join(' | '))

// cleanup
await coach.from('body_measurements').delete().eq('client_id', jamieId).eq('note', 'E2E sites')
await coach.from('client_programs').delete().eq('client_id', jamieId).eq('program_id', prog.id)
await coach.from('workout_programs').delete().eq('id', prog.id)
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
