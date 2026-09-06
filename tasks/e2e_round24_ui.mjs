// Paul, 6 Sept, relaying two client problems:
//  1. "So I can select there are drop sets and how many drop sets to add ... But
//     the client has no where to log their drop sets. Can it pull that through
//     and allow them to log each drop set?"
//  2. Benn "is having an issue that it's not saving his progress as he goes so
//     when he comes out of the browser and back in it's reloading back to the
//     home page and he's having to start again." Plus: "if someone exits mid
//     workout when they go back it prompts and says you have an active session
//     would you like to resume?"
//
// His sets were never actually lost — the player writes every change to
// localStorage. What was lost was the way BACK to them: the flag that reopens a
// session lived in sessionStorage, which a browser discards on close. Both
// halves are asserted here, including the one that survives a real close.
// Run: node tasks/e2e_round24_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round24_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

// Finishing a session marks the client as having trained TODAY, which quietly
// changes what the Home agenda offers and broke round 10 the first time this
// suite ran. Undo the completion as well as the plan.
const today = new Date().toISOString().slice(0, 10)
const cleanup = async () => {
  await jamie.from('workout_plans').delete().eq('client_id', jamieId).like('title', 'E2E Drop%')
  await jamie.from('workout_completions').delete().eq('client_id', jamieId).eq('completed_on', today).eq('source', 'guided')
}
await cleanup()

// A session shaped exactly like the one in Paul's screenshot: a dumbbell curl
// with two working sets, each carrying four drops.
const { data: plan } = await jamie.from('workout_plans').insert({
  client_id: jamieId, title: 'E2E Drop Session', focus: 'Arms', assigned_by: null,
  exercises: [{
    name: 'Dumbbell Curl', equipment: 'Coach plan', set_type: 'dropset', rpe: 8,
    cue: '2 working sets, then a quad drop set at the end of the second set',
    sets: [{ reps: '8-10', weight: '', drops: 4 }, { reps: '8-10', weight: '', drops: 4 }],
  }],
}).select().single()

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } })
const page = await ctx.newPage()
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const signIn = async (p) => {
  await p.goto(base)
  await p.locator('input[type="email"]').fill('jamie@redefine.app')
  await p.locator('input[type="password"]').fill('TestPass123')
  await p.getByRole('button', { name: /^Sign in$/ }).last().click()
  await p.waitForSelector('.tabbar', { timeout: 30000 })
}

await signIn(page)
// Paul's brand puts a hub behind the Train tab; the session list is one tap in.
const openSessions = async (p) => {
  await p.locator('.tab', { hasText: 'Train' }).click()
  const hero = p.locator('.tile-hero').first()
  if (await hero.count()) await hero.click()
  await p.waitForSelector('text=Your sessions', { timeout: 25000 })
}
await openSessions(page)
const card = page.locator('.session-card', { hasText: 'E2E Drop Session' }).first()
await card.waitFor({ timeout: 25000 })
await card.locator('.session-head').click()
await card.getByRole('button', { name: /^Start session$/ }).click()
await page.waitForSelector('.gw-set', { timeout: 25000 })

// ---------------------------------------------------------------------------
// 1. Somewhere to log each drop
// ---------------------------------------------------------------------------
const drops = page.locator('.gw-drop')
ok('every prescribed drop gets its own row', await drops.count() === 8, `${await drops.count()} drop rows for 2 sets x 4 drops`)
ok('and they are labelled', /Drop 1/.test(await page.locator('.gw-drops').first().innerText()),
  (await page.locator('.gw-drops').first().innerText()).replace(/\n/g, ' | ').slice(0, 80))

// log the working set and its four drops, weight coming down each time
const firstSet = page.locator('.gw-set').first()
await firstSet.locator('input.gw-in').nth(0).fill('10')
await firstSet.locator('input.gw-in').nth(1).fill('16')
const weights = ['12', '10', '8', '6']
for (let i = 0; i < 4; i++) {
  await drops.nth(i).locator('input.gw-in').nth(0).fill('8')
  await drops.nth(i).locator('input.gw-in').nth(1).fill(weights[i])
}
await firstSet.locator('input[type="checkbox"]').check()

// ---------------------------------------------------------------------------
// 2. Close the BROWSER and come back — the case Benn hit
// ---------------------------------------------------------------------------
await page.waitForTimeout(1200)
const state = await ctx.storageState()
await ctx.close()

// A brand new context carrying only what a browser actually keeps: localStorage
// survives, sessionStorage does not. That is precisely why he lost his way back.
const ctx2 = await browser.newContext({
  viewport: { width: 390, height: 900 },
  storageState: { ...state, origins: (state.origins || []).map((o) => ({ ...o, sessionStorage: [] })) },
})
const page2 = await ctx2.newPage()
page2.setDefaultTimeout(25000)
page2.on('pageerror', (e) => errors.push(e.message))
await page2.goto(base)
await page2.waitForSelector('.tabbar', { timeout: 30000 })

const banner = page2.locator('.resume-card')
ok('coming back offers to resume, rather than dumping them on Home',
  await banner.waitFor({ timeout: 20000 }).then(() => true, () => false))
const bText = await banner.innerText()
ok('naming the session', /E2E Drop Session/.test(bText), bText.replace(/\n/g, ' | ').slice(0, 100))
ok('and saying how far in they were', /1 of 2 sets/.test(bText), bText.replace(/\n/g, ' | ').slice(0, 100))

await banner.getByRole('button', { name: /Resume session/i }).click()
await page2.waitForSelector('.gw-set', { timeout: 25000 })
ok('resuming reopens the player', true)

// the work is still there, drops included
const set1 = page2.locator('.gw-set').first()
ok('the working set is still logged', await set1.locator('input.gw-in').nth(1).inputValue() === '16',
  await set1.locator('input.gw-in').nth(1).inputValue())
ok('and it is still ticked', await set1.locator('input[type="checkbox"]').isChecked())
const d2 = page2.locator('.gw-drop')
const back = []
for (let i = 0; i < 4; i++) back.push(await d2.nth(i).locator('input.gw-in').nth(1).inputValue())
ok('every drop survived the browser closing', back.join(',') === '12,10,8,6', back.join(','))

// ---------------------------------------------------------------------------
// 3. Finishing stores the drops, and the prompt goes away
// ---------------------------------------------------------------------------
await page2.getByRole('button', { name: /Finish session/i }).first().click()
await page2.waitForTimeout(4000)

const { data: saved } = await jamie.from('workout_plans').select('exercises').eq('id', plan.id).single()
const st = saved?.exercises?.[0]?.sets?.[0]
ok('the drops are stored against the set', Array.isArray(st?.drop_log) && st.drop_log.length === 4, JSON.stringify(st))
ok('with the weights they actually used', (st?.drop_log || []).map((d) => d.weight).join(',') === '12,10,8,6',
  JSON.stringify((st?.drop_log || []).map((d) => d.weight)))
ok('and the coach’s prescription is still there', st?.drops === 4, String(st?.drops))
// an untouched drop set must NOT gain an empty log
const st2 = saved?.exercises?.[0]?.sets?.[1]
ok('an unlogged drop set stays as prescribed', !st2?.drop_log && st2?.drops === 4, JSON.stringify(st2))

await page2.goto(base)
await page2.waitForSelector('.tabbar', { timeout: 30000 })
await page2.waitForTimeout(2000)
ok('once finished, it stops offering to resume', await page2.locator('.resume-card').count() === 0)

ok('no page errors', errors.length === 0, errors.join(' | '))

await cleanup()
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
