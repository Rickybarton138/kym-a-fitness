// Paul, 7 Sept: "Can I have the option to send a different Welcome message based
// on tag or either standard or Inner Circle? Standard is well configured but
// they have to set themselves up essentially so the welcome message talks them
// through it ... For Inner Circle ... it basically will tell them that I will be
// in touch via whatsapp." Plus: "It would also be good if the welcome message
// perhaps pops up on the screen for them upon joining."
//
// The assertion that matters is that the RIGHT client gets the RIGHT message —
// an Inner Circle client told to go and set themselves up is worse than no
// message at all — and that it is shown exactly once.
// Run: node tasks/e2e_round25_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round25_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const coach = createClient(SUPA, KEY)
await coach.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await coach.auth.getUser()).data.user.id

const STD = 'E2E standard welcome: start by setting your targets, then pick a plan.'
const IC = 'E2E inner circle welcome: sit tight, I will message you on WhatsApp.'

// Keep whatever Paul really has, and put it back at the end.
const { data: before } = await coach.from('coach_welcomes').select('audience, body').eq('coach_id', paulId)
const restore = async () => {
  await coach.from('coach_welcomes').delete().eq('coach_id', paulId)
  for (const r of before || []) {
    await coach.from('coach_welcomes').insert({ coach_id: paulId, audience: r.audience, body: r.body })
  }
}

await coach.from('coach_welcomes').delete().eq('coach_id', paulId)
const { error: wErr } = await coach.from('coach_welcomes').insert([
  { coach_id: paulId, audience: 'standard', body: STD },
  { coach_id: paulId, audience: 'inner_circle', body: IC },
])
ok('a coach can set a welcome per tier', !wErr, wErr?.message)

// ---------------------------------------------------------------------------
// The right message reaches the right client
// ---------------------------------------------------------------------------
const asClient = async (email) => {
  const c = createClient(SUPA, KEY)
  await c.auth.signInWithPassword({ email, password: 'TestPass123' })
  return c
}
const jamie = await asClient('jamie@redefine.app')
const jamieId = (await jamie.auth.getUser()).data.user.id
const ollie = await asClient('ollie@redefine.app')
const ollieId = (await ollie.auth.getUser()).data.user.id

const tierOf = async (id) => (await coach.from('profiles').select('membership_tier').eq('id', id).single()).data?.membership_tier
const wasJamie = await tierOf(jamieId)
const wasOllie = await tierOf(ollieId)

// set_member_tier is the coach's real route — a direct profiles update is
// correctly refused by RLS, which is worth relying on rather than working round.
await coach.rpc('set_member_tier', { p_client: jamieId, p_tier: 'standard' })
await coach.rpc('set_member_tier', { p_client: ollieId, p_tier: 'inner_circle' })

ok('a standard client gets the standard message', (await jamie.rpc('welcome_for_me')).data === STD, String((await jamie.rpc('welcome_for_me')).data).slice(0, 60))
ok('an Inner Circle client gets the Inner Circle one', (await ollie.rpc('welcome_for_me')).data === IC, String((await ollie.rpc('welcome_for_me')).data).slice(0, 60))
// The failure that would actually embarrass him.
ok('and is never told to go and set themselves up', !String((await ollie.rpc('welcome_for_me')).data).includes('set'), String((await ollie.rpc('welcome_for_me')).data).slice(0, 60))

// swapping the tier swaps the message, with no other change
await coach.rpc('set_member_tier', { p_client: jamieId, p_tier: 'inner_circle' })
ok('moving a client between tiers moves their message', (await jamie.rpc('welcome_for_me')).data === IC)
await coach.rpc('set_member_tier', { p_client: jamieId, p_tier: 'standard' })

// falls back to the coach's general message when a tier has none
await coach.from('coach_welcomes').delete().eq('coach_id', paulId).eq('audience', 'standard')
const { data: persona } = await coach.from('coach_personas').select('welcome').eq('coach_id', paulId).maybeSingle()
const fell = (await jamie.rpc('welcome_for_me')).data
ok('a tier with nothing set falls back to the general message',
  (persona?.welcome || '').trim() ? fell === (persona.welcome || '').trim() : fell === null,
  String(fell).slice(0, 60))
await coach.from('coach_welcomes').insert({ coach_id: paulId, audience: 'standard', body: STD })

// a client cannot read the coach's other audiences
const { data: peek } = await jamie.from('coach_welcomes').select('audience, body')
ok('a client cannot read the whole welcome table', (peek || []).length === 0, `${(peek || []).length} rows`)

// ---------------------------------------------------------------------------
// It pops up on joining, once
// ---------------------------------------------------------------------------
// A fixture client reset to "just finished joining".
const email = 'e2e-welcome@redefine.app'
const cl = createClient(SUPA, KEY)
let signIn = await cl.auth.signInWithPassword({ email, password: 'TestPass123' })
if (signIn.error) {
  await cl.auth.signUp({ email, password: 'TestPass123', options: { data: { full_name: 'E2E Welcome', role: 'client', trainer_code: 'FA128C' } } })
  signIn = await cl.auth.signInWithPassword({ email, password: 'TestPass123' })
}
const newId = signIn.data.user.id
await coach.rpc('set_member_tier', { p_client: newId, p_tier: 'standard' })
// onboarded, but has never seen the welcome — exactly the state joining leaves them in
await cl.from('profiles').update({
  welcome_seen_at: null, onboarded_at: new Date().toISOString(),
  sex: 'male', age: 30, height_cm: 180, activity_level: 'moderate', goal: 'lose',
}).eq('id', newId)

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill(email)
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()

const sheet = page.locator('.welcome-sheet')
ok('a new client is shown the welcome on screen', await sheet.waitFor({ timeout: 30000 }).then(() => true, () => false))
const sText = await sheet.innerText()
ok('and it is the one for their tier', sText.includes('start by setting your targets'), sText.replace(/\n/g, ' | ').slice(0, 100))
ok('attributed to their coach', /message from Paul/i.test(sText), sText.split('\n')[0])

await sheet.getByRole('button', { name: /Let.s go/i }).click()
await page.waitForTimeout(2000)
ok('it closes when acknowledged', await page.locator('.welcome-sheet').count() === 0)

const { data: seen } = await cl.from('profiles').select('welcome_seen_at').eq('id', newId).single()
ok('and is recorded as read', !!seen?.welcome_seen_at, String(seen?.welcome_seen_at))

// reload: it must not come back
await page.reload()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.waitForTimeout(2500)
ok('it does not come back on the next open', await page.locator('.welcome-sheet').count() === 0)

// and it is in their chat to re-read
await cl.rpc('seed_welcome_message')
const { data: msgs } = await cl.from('messages').select('body, sender').eq('client_id', newId)
ok('the same message is in their chat to re-read', (msgs || []).some((m) => m.sender === 'coach' && m.body === STD),
  JSON.stringify((msgs || []).map((m) => m.body?.slice(0, 30))))

ok('no page errors', errors.length === 0, errors.join(' | '))

// put everything back
await coach.rpc('set_member_tier', { p_client: jamieId, p_tier: wasJamie || 'standard' })
await coach.rpc('set_member_tier', { p_client: ollieId, p_tier: wasOllie || 'standard' })
await cl.from('messages').delete().eq('client_id', newId)
await restore()
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
