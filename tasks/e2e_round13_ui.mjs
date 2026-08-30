// The 30 Aug client-navigation batch: one tap from "today's session" into the
// session itself, a tappable plan card opening the whole programme, and picking
// an ad-hoc session from any week of that plan.
// Run: node tasks/e2e_round13_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round13_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

const api = createClient(SUPA, KEY)
await api.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await api.auth.getUser()).data.user.id
const coach = createClient(SUPA, KEY)
await coach.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await coach.auth.getUser()).data.user.id

// A two-week programme starting today, with today as a training day, so week 1
// slot 0 resolves to a known session.
const today = new Date()
const todayDow = today.getDay()
const startDate = today.toISOString().slice(0, 10)
const PROG = 'E2E Nav Program'
const TODAY_SESSION = 'E2E Today Session'
const WEEK2_SESSION = 'E2E Week Two Session'

const { data: oldP } = await coach.from('workout_programs').select('id').eq('coach_id', paulId).eq('title', PROG)
for (const p of oldP || []) await coach.from('workout_programs').delete().eq('id', p.id)
await api.from('workout_plans').delete().eq('client_id', jamieId).in('title', [TODAY_SESSION, WEEK2_SESSION])
await api.from('workout_completions').delete().eq('client_id', jamieId).eq('completed_on', startDate)

const { data: prog } = await coach.from('workout_programs')
  .insert({ coach_id: paulId, title: PROG, weeks: 2, level: 'Beginner' }).select().single()
await coach.from('program_sessions').insert([
  { program_id: prog.id, position: 0, week: 1, dow: null, title: TODAY_SESSION, focus: 'Full body',
    exercises: [{ name: 'Leg Press', equipment: 'Coach plan', cue: '', sets: [{ reps: '10', weight: '80' }] }] },
  { program_id: prog.id, position: 0, week: 2, dow: null, title: WEEK2_SESSION, focus: 'Upper',
    exercises: [{ name: 'Barbell Bench Press', equipment: 'Coach plan', cue: '', sets: [{ reps: '8', weight: '60' }] }] },
])
await coach.from('client_programs').update({ active: false }).eq('client_id', jamieId).eq('active', true)
await coach.from('client_programs').insert({
  client_id: jamieId, coach_id: paulId, program_id: prog.id,
  start_date: startDate, repeat: true, active: true, day_map: [todayDow],
})

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const clearActive = () => page.evaluate(() => { try { sessionStorage.removeItem('cbk_gw_active') } catch { /* ignore */ } })

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.agenda-card', { timeout: 30000 })

// --- Home: the agenda row names today's session and tapping it opens it ---
// the agenda card paints before the programme lookup returns, so wait for the row
const todayRow = page.locator('.agenda-item', { hasText: TODAY_SESSION })
ok('agenda names today’s session', await todayRow.waitFor({ timeout: 25000 }).then(() => true, () => false),
  (await page.locator('.agenda-card').innerText()).replace(/\n/g, ' | ').slice(0, 160))
ok('the row itself is tappable', await todayRow.locator('.agenda-body-tap').count() > 0)
await todayRow.locator('.agenda-body-tap').click()
ok('tapping the row opens the player', await page.locator('.gw-set').first().waitFor({ timeout: 25000 }).then(() => true, () => false))

await clearActive()
await page.reload()
await page.waitForSelector('.tabbar', { timeout: 30000 })

// --- Train tab: hero tile is today's session, one tap in ---
await page.locator('.tab', { hasText: 'Train' }).click()
await page.waitForSelector('text=Your training', { timeout: 20000 })
// the hub resolves the programme after paint, so wait for the named tile
const hero = page.locator('.tile-hero', { hasText: TODAY_SESSION })
ok('Train tab leads with today’s session by name', await hero.waitFor({ timeout: 20000 }).then(() => true, () => false),
  (await page.locator('.tile-hero').first().innerText()).replace(/\n/g, ' | '))
await hero.click()
ok('the tile starts it, not a chooser', await page.locator('.gw-set').first().waitFor({ timeout: 25000 }).then(() => true, () => false))

await clearActive()
await page.reload()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.locator('.tab', { hasText: 'Train' }).click()
await page.waitForSelector('text=Your training', { timeout: 20000 })

// --- the plan card opens the whole programme ---
const planCard = page.locator('.plan-card-btn')
ok('plan card is tappable', await planCard.first().waitFor({ timeout: 20000 }).then(() => true, () => false))
await planCard.first().click()
await page.waitForSelector('text=' + PROG, { timeout: 20000 })
const progText = await page.locator('.screen').innerText()
// .eyebrow is uppercased in CSS and innerText reports the transformed text
ok('programme view shows both weeks', /week 1/i.test(progText) && /week 2/i.test(progText), progText.split('\n').filter((l) => /^week/i.test(l)).join(' | '))
ok('marks the week they are on', /this week/i.test(progText))
ok('lists week 2’s session too', progText.includes(WEEK2_SESSION))

// start a session straight from the programme view
await page.getByText(WEEK2_SESSION).first().click()
await page.getByRole('button', { name: 'Start this session' }).first().click()
ok('can start any session from the programme view', await page.locator('.gw-set').first().waitFor({ timeout: 25000 }).then(() => true, () => false))

await clearActive()
await page.reload()
await page.waitForSelector('.tabbar', { timeout: 30000 })

// --- ad-hoc chooser: pick from any week of the plan ---
// An extra session on a day they're already training: the Home button, which is
// where Paul wants ad-hoc sessions to live.
await page.locator('.tab', { hasText: 'Home' }).click()
await page.waitForSelector('.agenda-card', { timeout: 20000 })
await page.getByRole('button', { name: 'Start a workout' }).first().click()
await page.waitForSelector('text=Train your way', { timeout: 20000 })
await page.getByRole('button', { name: /^Wk 1$/ }).first().waitFor({ timeout: 20000 }).catch(() => {})
ok('chooser offers a week picker', await page.getByRole('button', { name: /^Wk 2$/ }).count() > 0)
ok('defaults to the week they are on', (await page.locator('.screen').innerText()).includes('The week you’re on'))
ok('current week shows its session', await page.getByText(TODAY_SESSION).count() > 0)
await page.getByRole('button', { name: /^Wk 2$/ }).click()
await page.waitForTimeout(600)
// The plan's sessions render first; "Your sessions" history sits below and will
// legitimately still contain week 1's session because this test just did it.
const firstCard = page.locator('.session-card').first()
const firstText = await firstCard.innerText()
ok('switching week swaps the sessions', firstText.includes(WEEK2_SESSION) && !firstText.includes(TODAY_SESSION), firstText.replace(/\n/g, ' | '))

ok('no page errors', errors.length === 0, errors.join(' | '))

// cleanup
await coach.from('client_programs').delete().eq('client_id', jamieId).eq('program_id', prog.id)
await coach.from('workout_programs').delete().eq('id', prog.id)
await api.from('workout_plans').delete().eq('client_id', jamieId).in('title', [TODAY_SESSION, WEEK2_SESSION])
await api.from('workout_completions').delete().eq('client_id', jamieId).eq('completed_on', startDate)
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
