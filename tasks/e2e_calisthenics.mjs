// Ricky, 21 Sept: "can we add calisthenics workouts to my app please."
//
// What matters here is not that the screen renders. It is that the ladder
// POSITION survives a reload and that a session is built from it — the whole
// feature is "the session gets harder as you do", and that is a round trip
// through a new table with new RLS. A build passing says nothing about either.
//
// Drives the Rick.Fit theme (?brand=ricky, so the flag is on) as Paul's test
// client, and cleans up after itself.
//
// Run: node tasks/e2e_calisthenics.mjs [url]   (default: local dev server)
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const base = (process.argv[2] || 'http://localhost:5220') + '/?brand=ricky'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const EMAIL = 'jamie@redefine.app'
const PASS = 'TestPass123'

const api = createClient(SUPA, KEY)
await api.auth.signInWithPassword({ email: EMAIL, password: PASS })
const uid = (await api.auth.getUser()).data.user.id

// Start from nothing, so "step 1 of N" below is a real assertion.
await api.from('calisthenics_progress').delete().eq('client_id', uid)
await api.from('calisthenics_adaptations').delete().eq('client_id', uid)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

try {
  await page.goto(base)
  await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
  await page.getByRole('textbox', { name: 'Password' }).fill(PASS)
  await page.locator('button.btn', { hasText: 'Sign in' }).last().click()
  await page.waitForTimeout(3500)

  // Rick.Fit has groupedHome, so Home is section headers and the Training
  // tiles sit behind the first one, collapsed. That is where every other
  // training feature lives too.
  const body = () => page.textContent('body')

  // There is no browser history to go back through — screens are state, not
  // routes, and ClientApp persists the current one in localStorage. So every
  // return trip reloads, and goes via Home only when the reload did not already
  // land on the screen.
  const openCalisthenics = async () => {
    await page.goto(base)
    await page.waitForTimeout(3000)
    if ((await body()).includes('Where you are')) return
    const todayTab = page.locator('nav button, .tabbar button', { hasText: 'Today' }).first()
    if (await todayTab.count()) { await todayTab.click(); await page.waitForTimeout(800) }
    await page.locator('.tile-group-title', { hasText: 'Train' }).first().click()
    await page.waitForTimeout(400)
    await page.locator('.tiles button', { hasText: 'Calisthenics' }).first().click()
    await page.waitForTimeout(1500)
  }

  await page.locator('.tile-group-title', { hasText: 'Train' }).first().click()
  await page.waitForTimeout(400)
  const tile = page.locator('.tiles button', { hasText: 'Calisthenics' }).first()
  ok('the Calisthenics tile is in the Training group on Home', await tile.count() > 0)
  await tile.click()
  await page.waitForTimeout(1200)
  const first = await body()
  ok('all six ladders render', ['Pull-up →', 'Press-up →', 'Dip →', 'Squat →', 'Plank →', 'Handstand →']
    .every((t) => first.includes(t)), first.match(/Step 1 of \d+/g)?.length + ' at step 1')
  ok('a new client starts at the bottom of the pull ladder', first.includes('Dead Hang'))
  ok('the next step names what earns it', first.includes('Next up is Scapular Pull-up, once you can do 30 seconds unbroken'))

  // Advance the pull ladder.
  const pullCard = page.locator('.card', { hasText: 'Pull-up → Muscle-up' })
  await pullCard.getByRole('button', { name: /next step/ }).click()
  await page.waitForTimeout(1200)
  ok('the ladder moves on tap', (await body()).includes('Scapular Pull-up'))

  const { data: row } = await api.from('calisthenics_progress')
    .select('step_index').eq('client_id', uid).eq('skill_key', 'pull').maybeSingle()
  ok('the step is written to the database', row?.step_index === 1, 'step_index=' + row?.step_index)

  // The point of the table: it is still there after a reload.
  // ClientApp persists the current screen (cbk_screen), so a reload lands back
  // on this screen rather than Home — go through Home only if it did not.
  await openCalisthenics()
  const after = await body()
  ok('the step survives a reload', after.includes('Scapular Pull-up') && !after.includes('Dead Hang'))

  // And the session is built from where the ladder now is, not from a fixture.
  await page.getByRole('button', { name: /Full body/ }).click()
  await page.waitForTimeout(3000)
  const session = await body()
  ok('starting a session opens the guided player', session.includes('Calisthenics — Full body'))
  ok('the session uses the step just unlocked', session.includes('Scapular Pull-up'), 'not Dead Hang')

  const { data: plans } = await api.from('workout_plans')
    .select('id, title, exercises').eq('client_id', uid).order('created_at', { ascending: false }).limit(1)
  const plan = plans?.[0]
  ok('the session was saved as a real plan', plan?.title === 'Calisthenics — Full body')
  ok('every exercise carries its coaching cue', (plan?.exercises || []).every((e) => e.name && e.cue && e.sets && e.reps),
    JSON.stringify((plan?.exercises || []).map((e) => `${e.name} ${e.sets}x${e.reps}`)))

  // --- Adaptations: "can we modify mine to account for bad knees and wrist" ---
  await openCalisthenics()
  const before = await body()
  ok('without adapting, the legs ladder is the pistol track', before.includes('Squat → Pistol squat'))

  await page.getByRole('checkbox', { name: 'Bad knees' }).check()
  await page.waitForTimeout(1200)
  await page.getByRole('checkbox', { name: 'Bad wrists' }).check()
  await page.waitForTimeout(1200)
  const adapted = await body()
  ok('bad knees swaps the whole legs ladder', adapted.includes('Hinge & glutes → Single-leg box squat'))
  ok('bad wrists turns the handstand into a forearm stand', adapted.includes('Forearm stand → Freestanding forearm stand'))
  ok('the swap is labelled, not silent', adapted.includes('Swapped for your knees') && adapted.includes('Swapped for your wrists'))
  ok('the pull ladder is untouched — nothing about it threatens either joint', adapted.includes('Pull-up → Muscle-up'))

  const { data: flags } = await api.from('calisthenics_adaptations').select('adaptation').eq('client_id', uid)
  ok('both adaptations are stored', (flags || []).map((f) => f.adaptation).sort().join(',') === 'knees,wrists')

  // The step number is kept: pull is still on the step unlocked earlier.
  ok('adapting does not reset your progress', adapted.includes('Scapular Pull-up'))

  await page.getByRole('button', { name: /Legs & Core/ }).click()
  await page.waitForTimeout(3000)
  const adaptedSession = await body()
  ok('an adapted session contains no deep knee bend', !/Pistol|Skater|Bulgarian/.test(adaptedSession), adaptedSession.match(/Glute Bridge|Box Squat/g)?.join(','))
  ok('and no Nordic curl for a bad knee', adaptedSession.includes('Hamstring Bridge Walkout'))

  const { data: adaptedPlans } = await api.from('workout_plans')
    .select('id, exercises').eq('client_id', uid).order('created_at', { ascending: false }).limit(1)
  const adaptedPlan = adaptedPlans?.[0]
  const names = (adaptedPlan?.exercises || []).map((e) => e.name)
  ok('the saved plan is the adapted one', names.includes('Hamstring Bridge Walkout') && !names.some((n) => /Pistol|Nordic/.test(n)), names.join(' | '))
  if (adaptedPlan) await api.from('workout_plans').delete().eq('id', adaptedPlan.id)

  ok('no uncaught errors on any of it', errors.length === 0, errors.join(' | '))

  // Clean up: this is a shared database with real clients in it.
  if (plan) await api.from('workout_plans').delete().eq('id', plan.id)
  await api.from('calisthenics_progress').delete().eq('client_id', uid)
  await api.from('calisthenics_adaptations').delete().eq('client_id', uid)
} finally {
  await browser.close()
}

console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
