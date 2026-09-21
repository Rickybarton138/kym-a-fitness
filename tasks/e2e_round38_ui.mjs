// Paul, 21 Sept: "with the calories, the weekly overview with the graph. Can we
// have the option both for me and the client to go back week by week and maybe
// have a calendar drop down too so they and I can see previous weeks to spot
// trends?"
//
// Seeds a known week three weeks back and then navigates to it two ways — the
// arrow and the date picker — checking the chart actually shows THAT week's
// numbers. Navigation that moves a label but not the data is the failure worth
// catching.
//
// Also checks the net line, which the change to real Monday-Sunday weeks
// otherwise breaks: comparing two days of eating against a full week's target
// reports the client thousands of calories under.
//
// FoodDiary is one component for both, so the last block signs in as the coach
// and drives the same controls on a client's diary.
//
// Run: node tasks/e2e_round38_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round38_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

const NAME = 'E2E R38 marker'
const cleanup = async () => { await jamie.from('nutrition_logs').delete().eq('client_id', jamieId).eq('name', NAME) }
await cleanup()

// Monday of three weeks ago, midday so no timezone edge can move the day.
const mondayOf = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const target = mondayOf(new Date()); target.setDate(target.getDate() - 21)
const THAT_WEEK = [1111, 2222, 3333] // distinctive, so they cannot be confused with real data
const rows = THAT_WEEK.map((cal, i) => {
  const d = new Date(target); d.setDate(d.getDate() + i)
  return { client_id: jamieId, source: 'manual', name: NAME, calories: cal, protein_g: 10, carbs_g: 10, fat_g: 5, fibre_g: 2, meal_type: 'Lunch', logged_at: d.toISOString() }
})
// One entry today as well: the net line only renders once something is logged
// this week, and the maths behind it is what moving to real weeks most endangers.
const todayRow = { client_id: jamieId, source: 'manual', name: NAME, calories: 700, protein_g: 40, carbs_g: 50, fat_g: 20, fibre_g: 5, meal_type: 'Lunch', logged_at: new Date().toISOString() }
const { error: seedErr } = await jamie.from('nutrition_logs').insert([...rows, todayRow])
if (seedErr) { console.error('seed failed:', seedErr.message); process.exit(1) }
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const errors = []

// The card is identified by the NAV, not by `.week-snapshot`: TrainerApp has a
// card of its own using that same class on the coach dashboard, and the first
// run of this test latched onto it, decided the diary was already on screen and
// never opened the section holding the real one. It then reported the coach had
// no week navigation — true of the card it was looking at, and nothing to do
// with the feature.
const chart = (page) => page.locator('.week-snapshot').filter({ has: page.locator('.wk-nav') }).first()

async function openDiary(email, isCoach) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  page.setDefaultTimeout(25000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('TestPass123')
  await page.getByRole('button', { name: /^Sign in$/ }).last().click()
  if (isCoach) {
    await page.getByText(/Your clients/).first().waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: /^All \(\d+\)$/ }).waitFor({ timeout: 30000 })
    // The client TILE, not any text saying "Jamie" — the dashboard's activity
    // feed is full of "Jamie logged 2 meals", and the first run clicked one of
    // those and never left the dashboard.
    await page.locator('.tile').filter({ hasText: 'Jamie' }).first().click()
  } else {
    await page.waitForSelector('.tabbar', { timeout: 30000 })
    await page.locator('.tab', { hasText: 'Nutrition' }).click()
  }
  if (isCoach) {
    // The coach does not click through to a diary — it is rendered inline in
    // ClientDetail inside a collapsible CoachSection, so the section has to be
    // opened rather than navigated to.
    // The diary sits in the "Progress & diary" section. Open that one by name
    // rather than clicking every heading in turn — sweeping the list shut
    // whichever section happened to be open already, and the coach's own
    // weekly card (TrainerApp's `.week-snapshot`) is not inside any of them.
    const diarySection = page.locator('.tile-group-title').filter({ hasText: /diary/i }).first()
    // WAIT for it. Checking `count()` the instant after clicking the client tile
    // asked a page that was still the dashboard, got zero, and skipped the click
    // entirely — then blamed the coach for having no week navigation.
    await diarySection.waitFor({ timeout: 25000 })
    if (!(await page.locator('.wk-nav').count())) {
      await diarySection.click()
      await page.waitForTimeout(1200)
    }
  } else {
    await page.getByText('Food diary').first().click()
  }
  await page.locator('.wk-nav').first().waitFor({ timeout: 25000 })
  await chart(page).scrollIntoViewIfNeeded()
  return page
}

// --- the client ---------------------------------------------------------------
let page = await openDiary('jamie@redefine.app', false)
// Every check on innerText below is case-INSENSITIVE: .eyebrow uppercases in
// CSS and innerText returns what is rendered, so /This week/ never matches.
ok('the chart opens on this week', /this week/i.test(await chart(page).innerText()))
ok('there is a way to jump to a week', await page.getByLabel(/Jump to a week/i).count() === 1)
ok('you cannot go forward past this week', await page.getByRole('button', { name: 'Next week' }).isDisabled())

// The net line must be against days lived, not a flat seven.
const net = await page.getByText(/vs target \(/).first().innerText().catch(() => '')
ok('net compares against the days so far, not a full week', /× \d+ day/.test(net), net || 'no net line')

// Back three weeks with the arrow.
for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Previous week' }).click(); await page.waitForTimeout(700) }
await page.waitForTimeout(1200)
let body = await chart(page).innerText()
ok('stepping back three weeks shows that week’s numbers', THAT_WEEK.every((c) => body.includes(c.toLocaleString())),
  body.replace(/\n/g, ' ').slice(0, 110))
// Scoped to the LABEL: the card also holds a "Back to this week" button, so
// scanning the whole card for that phrase can never be false.
const navLabel = await page.locator('.wk-nav-label').first().innerText()
ok('and it is labelled with the dates, not "this week"', !/this week/i.test(navLabel), navLabel.replace(/\n/g, ' '))

// Straight back, then reach the same week with the date picker instead.
await page.getByRole('button', { name: /Back to this week/i }).click()
await page.waitForTimeout(900)
ok('"back to this week" returns', /this week/i.test(await chart(page).innerText()))

await page.getByLabel(/Jump to a week/i).fill(ymd(new Date(target.getTime() + 2 * 86400000)))
await page.waitForTimeout(1400)
body = await chart(page).innerText()
ok('the date picker lands on the week containing that date', THAT_WEEK.every((c) => body.includes(c.toLocaleString())),
  body.replace(/\n/g, ' ').slice(0, 110))
await page.close()

// --- the coach, same controls, same component ---------------------------------
page = await openDiary('paul@redefine.app', true)
const coachNav = await page.getByRole('button', { name: 'Previous week' }).count()
ok('the coach gets the same navigation', coachNav >= 1, coachNav + ' prev-week buttons')
await page.getByLabel(/Jump to a week/i).fill(ymd(new Date(target.getTime() + 2 * 86400000)))
await page.waitForTimeout(1400)
body = await chart(page).innerText()
ok('and sees the same past week for that client', THAT_WEEK.every((c) => body.includes(c.toLocaleString())),
  body.replace(/\n/g, ' ').slice(0, 110))
await page.close()

ok('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
await cleanup()
console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
