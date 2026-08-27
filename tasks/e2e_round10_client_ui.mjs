// Client half of the 27 Aug batch: the "Your plan" card, programme sessions
// offered off-schedule, and — the dangerous one — that finishing a guided
// session does NOT wipe the coach's drop sets on the way back to the DB.
// Run: node tasks/e2e_round10_client_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round10_client_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const api = createClient('https://ezwmfbuuopsnpanebtal.supabase.co', 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv')
await api.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await api.auth.getUser()).data.user.id
const { data: jamieRow } = await api.from('profiles').select('id').eq('trainer_id', paulId).limit(5)

const jamieApi = createClient('https://ezwmfbuuopsnpanebtal.supabase.co', 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv')
await jamieApi.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamieApi.auth.getUser()).data.user.id

const PROG = 'E2E Client Plan'
// clean slate
const { data: oldP } = await api.from('workout_programs').select('id').eq('coach_id', paulId).eq('title', PROG)
for (const p of oldP || []) await api.from('workout_programs').delete().eq('id', p.id)
await api.from('client_programs').delete().eq('client_id', jamieId).eq('start_date', '2026-08-24')
await jamieApi.from('workout_plans').delete().eq('client_id', jamieId).eq('title', 'E2E Drop Session')

// a programme with one session, assigned by the coach with real training days
const { data: prog } = await api.from('workout_programs')
  .insert({ coach_id: paulId, title: PROG, weeks: 4, level: 'Beginner' }).select().single()
await api.from('program_sessions').insert({
  program_id: prog.id, position: 0, week: 1, dow: null, title: 'E2E Plan Session', focus: 'Full body',
  exercises: [{ name: 'Leg Press', equipment: 'Coach plan', cue: '', sets: [{ reps: '10', weight: '80' }] }],
})
await api.from('client_programs').update({ active: false }).eq('client_id', jamieId).eq('active', true)
await api.from('client_programs').insert({
  client_id: jamieId, coach_id: paulId, program_id: prog.id,
  start_date: '2026-08-24', repeat: true, active: true, day_map: [1, 3, 5],
})

// a plan carrying drop sets, to be completed in the guided player
const { data: plan } = await jamieApi.from('workout_plans').insert({
  client_id: jamieId, title: 'E2E Drop Session', focus: 'Legs', assigned_by: paulId,
  exercises: [{
    name: 'Leg Press', equipment: 'Coach plan', cue: '', set_type: 'dropset',
    sets: [{ reps: '10', weight: '80', drops: 2 }, { reps: '10', weight: '80', drops: 2 }],
  }],
}).select().single()

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.agenda-card', { timeout: 30000 })

await page.locator('.tab', { hasText: 'Train' }).click()
await page.waitForSelector('text=Your training', { timeout: 20000 })

// --- item 7: Your plan ---
const planCard = page.locator('.card', { hasText: 'Your plan' })
ok('Your plan card shows', await planCard.waitFor({ timeout: 15000 }).then(() => true, () => false))
const planText = await planCard.innerText().catch(() => '')
ok('names the programme', planText.includes(PROG), planText.replace(/\n/g, ' | '))
ok('shows the week', /Week \d/.test(planText), planText.replace(/\n/g, ' | '))
ok('shows their training days', planText.includes('Mon') && planText.includes('Wed') && planText.includes('Fri'), planText.replace(/\n/g, ' | '))
ok('says who set it', planText.includes('coach'), planText.replace(/\n/g, ' | '))

// --- item 8: programme sessions offered alongside standalone templates ---
await page.getByText('Today’s session').first().click()
await page.waitForSelector('text=Train your way', { timeout: 20000 })
await page.getByRole('button', { name: 'Start a workout' }).click()
const fromPlan = page.getByText(`From ${PROG}`)
ok('programme sessions offered off-schedule', await fromPlan.waitFor({ timeout: 15000 }).then(() => true, () => false))
ok('the session itself is listed', await page.getByText('E2E Plan Session').count() > 0)

// --- the dangerous one: finishing must not wipe drops ---
await page.getByText('E2E Drop Session').first().click()
const startBtn = page.getByRole('button', { name: /Start session|Start this session|Resume/ }).first()
if (await startBtn.count()) await startBtn.click()
await page.waitForSelector('.gw-set', { timeout: 20000 })
ok('drops shown to the client in the player', await page.getByText(/\+2 drops/).count() > 0)
await page.locator('.gw-set input[type="checkbox"]').first().check()
await page.getByRole('button', { name: /Finish session/ }).click()
await page.waitForSelector('text=Session complete', { timeout: 25000 })

const { data: after } = await jamieApi.from('workout_plans').select('exercises').eq('id', plan.id).single()
const sets = after?.exercises?.[0]?.sets || []
ok('drops survive finishing the session', sets.every((s) => s.drops === 2), JSON.stringify(sets))
ok('set_type survives too', after?.exercises?.[0]?.set_type === 'dropset', after?.exercises?.[0]?.set_type)

ok('no page errors', errors.length === 0, errors.join(' | '))

// cleanup
await api.from('client_programs').delete().eq('client_id', jamieId).eq('start_date', '2026-08-24')
await api.from('workout_programs').delete().eq('id', prog.id)
await jamieApi.from('workout_plans').delete().eq('id', plan.id)
await jamieApi.from('workout_completions').delete().eq('client_id', jamieId).eq('completed_on', new Date().toISOString().slice(0, 10))
await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
