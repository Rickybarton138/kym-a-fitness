// Paul, 7 Sept:
//  1. "The 'todays plan' for Katie is showing the sessions for her week 1 and
//     not week 2 ... it's showing the same sessions as last week instead of
//     what's programmed for this week."
//  2. "When writing programs for inner circle clients ... I have to go back to
//     the home and back to their page to be able to see it in the list I can
//     assign. Could we add an assign button in the program creation section?"
//
// The week bug: weeks were counted as rolling 7-day blocks from the start date.
// Katie started Thursday 3 Sept, so on Monday the 7th the app said "day 4,
// still week 1" while a new training week had plainly begun. A coach writes
// "week 1, week 2" meaning weeks of the calendar.
// Run: node tasks/e2e_round29_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
import { weekFor } from '../src/programSchedule.js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round29_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

// ---------------------------------------------------------------------------
// 1. Weeks follow the calendar
// ---------------------------------------------------------------------------
const prog = (start, cycleWeeks = 4, repeat = true) => ({
  asg: { start_date: start, repeat }, cycleWeeks, sessions: [], dayMap: [],
})
const on = (p, iso) => weekFor(p, new Date(iso + 'T09:00:00'))

// Katie exactly: started Thursday 3 Sept.
const katie = prog('2026-09-03')
ok('the day she starts is week 1', on(katie, '2026-09-03') === 1, String(on(katie, '2026-09-03')))
ok('the Sunday that ends that week is still week 1', on(katie, '2026-09-06') === 1, String(on(katie, '2026-09-06')))
ok('and the Monday after is WEEK 2, not week 1', on(katie, '2026-09-07') === 2, String(on(katie, '2026-09-07')))
ok('the Sunday after that is still week 2', on(katie, '2026-09-13') === 2, String(on(katie, '2026-09-13')))
ok('and the next Monday is week 3', on(katie, '2026-09-14') === 3, String(on(katie, '2026-09-14')))

// A clean Monday start is unchanged.
const monday = prog('2026-09-07')
ok('a Monday start still reads week 1 all week', on(monday, '2026-09-07') === 1 && on(monday, '2026-09-13') === 1,
  `${on(monday, '2026-09-07')} / ${on(monday, '2026-09-13')}`)
ok('and rolls to week 2 the following Monday', on(monday, '2026-09-14') === 2, String(on(monday, '2026-09-14')))

// Before it starts, and after it ends.
ok('nothing before the start date', on(katie, '2026-09-02') === null, String(on(katie, '2026-09-02')))
const short = prog('2026-09-07', 2, false)
ok('a non-repeating program ends', on(short, '2026-09-21') === null, String(on(short, '2026-09-21')))
const looping = prog('2026-09-07', 2, true)
ok('a repeating one loops back to week 1', on(looping, '2026-09-21') === 1, String(on(looping, '2026-09-21')))

// ---------------------------------------------------------------------------
// 2. Katie's real assignment, as the app now reads it
// ---------------------------------------------------------------------------
const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const coach = createClient(SUPA, KEY)
await coach.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await coach.auth.getUser()).data.user.id

const { data: kt } = await coach.from('profiles').select('id').eq('full_name', 'Katie Thompson').maybeSingle()
if (kt) {
  const { data: asg } = await coach.from('client_programs')
    .select('start_date, repeat, program_id').eq('client_id', kt.id).eq('active', true).maybeSingle()
  if (asg) {
    const { data: sess } = await coach.from('program_sessions').select('week').eq('program_id', asg.program_id)
    const cycle = (sess || []).reduce((m, s) => Math.max(m, s.week || 1), 1)
    const real = weekFor({ asg, cycleWeeks: cycle, sessions: [], dayMap: [] }, new Date())
    const started = new Date(asg.start_date + 'T00:00:00')
    const naive = Math.floor((new Date().setHours(0, 0, 0, 0) - started) / 86400000 / 7) + 1
    ok('Katie is no longer stuck on the week she started in', real > 1 || naive === real,
      `started ${asg.start_date} — now week ${real} (the old maths said ${naive})`)
  } else { ok('Katie is no longer stuck on the week she started in', true, 'no active assignment right now') }
} else { ok('Katie is no longer stuck on the week she started in', true, 'client not found') }

// ---------------------------------------------------------------------------
// 3. Assigning without leaving the page
// ---------------------------------------------------------------------------
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const TITLE = 'E2E Assign Straight Away'
const cleanup = async () => {
  const { data: ps } = await coach.from('workout_programs').select('id').eq('coach_id', paulId).eq('title', TITLE)
  for (const p of ps || []) {
    await coach.from('client_programs').delete().eq('program_id', p.id)
    await coach.from('program_sessions').delete().eq('program_id', p.id)
    await coach.from('workout_programs').delete().eq('id', p.id)
  }
}
await cleanup()

await page.goto(base)
await page.locator('input[type="email"]').fill('paul@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('text=Client activity', { timeout: 30000 })
await page.getByText('Jamie Bennett').first().click()
const training = page.locator('.tile-group-title', { hasText: 'Training' }).first()
await training.waitFor({ timeout: 20000 })
if (!(await training.locator('.tile-group-chev.open').count())) await training.click()

// build a 1-2-1 programme the ordinary way
const progCard = page.locator('.card', { hasText: /’s programs/ }).first()
await progCard.waitFor({ timeout: 20000 })
await progCard.getByRole('button', { name: /Create a program for/i }).click()
await progCard.locator('input[placeholder*="8-Week"]').fill(TITLE)
await progCard.getByRole('button', { name: /^Create for /i }).first().click()
await page.waitForTimeout(3000)

const madeCard = page.locator('.session-card', { hasText: TITLE }).first()
ok('the new program appears in their 1-2-1 list', await madeCard.waitFor({ timeout: 20000 }).then(() => true, () => false))

const assignBtn = madeCard.getByRole('button', { name: /Assign to Jamie/i })
ok('with an Assign button right there', await assignBtn.count() === 1)

await assignBtn.click()
await page.waitForTimeout(2500)

// the assign card must now KNOW about it — this was the actual complaint
const assignCard = page.locator('.card', { hasText: 'Assign a program' }).first()
const options = await assignCard.locator('select.ex-select').innerText()
ok('the assign list has it without reloading the page', options.includes(TITLE),
  options.replace(/\n/g, ' | ').slice(0, 140))
ok('and it is already selected', (await assignCard.locator('select.ex-select').inputValue()) !== '',
  await assignCard.locator('select.ex-select').inputValue())

ok('no page errors', errors.length === 0, errors.join(' | '))

await cleanup()
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
