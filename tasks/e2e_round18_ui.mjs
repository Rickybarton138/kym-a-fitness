// Paul, 1 Sept, relaying a client: "every session I have built for any client
// is showing in his list of sessions ... I lost my shit and just went home."
// He was right. The program builder auto-published every custom-built session
// into the coach-wide template library, and an untagged template is readable by
// EVERY client of that coach — so all of Paul's clients saw all 13.
//
// What is asserted here is the property, not the symptom: a session built
// inside one client's program must not be readable by another client, and the
// only way a template reaches a client is the coach deciding it should.
// Run: node tasks/e2e_round18_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round18_ui.mjs <url>'); process.exit(1) }
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

const ollie = createClient(SUPA, KEY)
await ollie.auth.signInWithPassword({ email: 'ollie@redefine.app', password: 'TestPass123' })
const ollieId = (await ollie.auth.getUser()).data.user.id

const cleanup = async () => {
  await coach.from('client_schedule').delete().eq('client_id', jamieId).eq('dow', 4)
  await coach.from('workout_templates').delete().eq('coach_id', paulId).like('title', 'E2E %')
}
await cleanup()

const sees = async (api, id) => !!(await api.from('workout_templates').select('id').eq('id', id).maybeSingle()).data

// ---------------------------------------------------------------------------
// 1. The leak itself, at the database. A private template reaches nobody.
// ---------------------------------------------------------------------------
const { data: priv, error: privErr } = await coach.from('workout_templates').insert({
  coach_id: paulId, title: 'E2E Private Session', focus: 'Push',
  exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 60 }] }],
  visible_to_clients: false,
}).select().single()
ok('coach can save a private session', !privErr && !!priv, privErr?.message)

ok('a private session is hidden from a client', !(await sees(jamie, priv.id)))
ok('and from every other client too', !(await sees(ollie, priv.id)))

// ---------------------------------------------------------------------------
// 2. Sharing is what makes it visible — and it is reversible
// ---------------------------------------------------------------------------
await coach.from('workout_templates').update({ visible_to_clients: true }).eq('id', priv.id)
ok('sharing it makes it visible', await sees(jamie, priv.id))
await coach.from('workout_templates').update({ visible_to_clients: false }).eq('id', priv.id)
ok('un-sharing hides it again', !(await sees(jamie, priv.id)))

// a client must not be able to publish one to themselves
const { data: selfShare } = await jamie.from('workout_templates').update({ visible_to_clients: true }).eq('id', priv.id).select()
ok('a client cannot share a template to themselves', (selfShare || []).length === 0 && !(await sees(jamie, priv.id)))

// ---------------------------------------------------------------------------
// 3. Assigned work stays readable even while unshared.
//    Without this, hiding a template blanks the day it was scheduled on —
//    the disappearing-session bug again. Jamie already had one such row live.
// ---------------------------------------------------------------------------
await coach.from('client_schedule').upsert(
  { coach_id: paulId, client_id: jamieId, dow: 4, template_id: priv.id, updated_at: new Date().toISOString() },
  { onConflict: 'client_id,dow' },
)
ok('a session put on a client’s day stays readable to them', await sees(jamie, priv.id))
ok('but still not to anyone else', !(await sees(ollie, priv.id)))
await coach.from('client_schedule').delete().eq('client_id', jamieId).eq('dow', 4)

// ---------------------------------------------------------------------------
// 4. No client of Paul's can see a session built inside another's program.
//    The real-world assertion: the 13 that started this.
// ---------------------------------------------------------------------------
const { data: coachAll } = await coach.from('workout_templates').select('id, title, visible_to_clients').eq('coach_id', paulId)
const { data: jamieAll } = await jamie.from('workout_templates').select('id, title')
const { data: ollieAll } = await ollie.from('workout_templates').select('id, title')
const leaked = (jamieAll || []).filter((t) => (coachAll || []).find((c) => c.id === t.id && c.visible_to_clients === false))
ok('no unshared template reaches a client', leaked.length === 0, leaked.map((t) => t.title).join(', '))
ok('the 30 Aug auto-published sessions are no longer public',
  !(jamieAll || []).some((t) => /Volume Push Session|Heavy Leg Day|Heavy Pull Session/.test(t.title)) &&
  !(ollieAll || []).some((t) => /Volume Push Session|Heavy Leg Day|Heavy Pull Session/.test(t.title)),
  `jamie: ${(jamieAll || []).length}, ollie: ${(ollieAll || []).length}`)
ok('the coach still has all of them to build weeks 2-4 with', (coachAll || []).length >= 14, String((coachAll || []).length))

// ---------------------------------------------------------------------------
// 5. The builder no longer publishes behind the coach's back
// ---------------------------------------------------------------------------
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

// The coach-side library must show which are shared and which are not.
// The dashboard groups into collapsible sections whose state is remembered,
// so open Content library rather than assuming it is.
const tplGroup = page.locator('.tile-group-title', { hasText: 'Content library' }).first()
await tplGroup.waitFor({ timeout: 20000 })
if (!(await tplGroup.locator('.tile-group-chev.open').count())) await tplGroup.click()
const privCard = page.locator('.session-card', { hasText: 'E2E Private Session' }).first()
const foundCard = await privCard.waitFor({ timeout: 20000 }).then(() => true, () => false)
ok('the coach sees the private session in their library', foundCard)
if (foundCard) {
  ok('and it is labelled private, not shared', (await privCard.innerText()).includes('private to you'),
    (await privCard.innerText()).replace(/\n/g, ' | ').slice(0, 120))
  await privCard.locator('.session-head').click()
  const shareBtn = privCard.getByRole('button', { name: /Share with my clients/i })
  ok('with a one-tap way to share it', await shareBtn.waitFor({ timeout: 15000 }).then(() => true, () => false))
  await shareBtn.click()
  await page.waitForTimeout(2500)
  ok('tapping it actually shares it', await sees(jamie, priv.id))
  const hideBtn = privCard.getByRole('button', { name: /Hide from my clients/i })
  ok('and the same control hides it again', await hideBtn.waitFor({ timeout: 15000 }).then(() => true, () => false))
  await hideBtn.click()
  await page.waitForTimeout(2500)
  ok('hidden again', !(await sees(jamie, priv.id)))
}

// ---------------------------------------------------------------------------
// 6. The client's own screen: their plan, and nothing built for anyone else
// ---------------------------------------------------------------------------
await page.evaluate(() => { try { localStorage.clear() } catch { /* ignore */ } })
await page.goto(base)
await page.locator('input[type="email"]').fill('ollie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.locator('.tab', { hasText: 'Train' }).click()
await page.getByRole('button', { name: 'Start a workout' }).first().click()
await page.waitForSelector('text=Train your way', { timeout: 20000 })
await page.waitForTimeout(2500)
const bodyText = await page.locator('body').innerText()
ok('no other client’s sessions on the client’s screen',
  !/Volume Push Session|Heavy Leg Day 1|Heavy Pull Session|Volume Leg Session/.test(bodyText),
  bodyText.replace(/\n/g, ' | ').slice(0, 200))

ok('no page errors', errors.length === 0, errors.join(' | '))

await cleanup()
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
