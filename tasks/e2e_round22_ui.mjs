// Paul, 4 Sept, twice:
//  1. "in the AI program builder for 1-1 clients, could I upload images of their
//     equipment and the ai build the session around what they have?"
//  2. "let people use the ai to create a program where they can state if it's
//     home, home gym or gym, if it's home gym they could upload photos of what
//     they have. State what days they can train and it builds a program."
//
// The load-bearing assertion is the review step: what the photos suggest is a
// DRAFT the person corrects, and only the corrected list may shape a programme.
// Run: node tasks/e2e_round22_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildProgramRows } from '../src/programBuild.js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round22_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'
const here = dirname(fileURLToPath(import.meta.url))

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
  const { data: progs } = await coach.from('workout_programs').select('id').eq('coach_id', paulId).like('title', '%E2E%')
  for (const p of progs || []) {
    await coach.from('client_programs').delete().eq('program_id', p.id)
    await coach.from('workout_programs').delete().eq('id', p.id)
  }
  for (const c of [jamieId, ollieId]) {
    const { data: mk } = await coach.from('workout_programs').select('id').eq('client_id', c).eq('source', 'client_ai')
    for (const p of mk || []) {
      await coach.from('client_programs').delete().eq('program_id', p.id)
      await coach.from('workout_programs').delete().eq('id', p.id)
    }
  }
}
await cleanup()

// ---------------------------------------------------------------------------
// 1. Reading kit off a photo
// ---------------------------------------------------------------------------
const FN = SITE + '/.netlify/functions/equipment-scan'
const empty = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
ok('no photos is a 400', empty.status === 400, String(empty.status))

// The only real photo fixture in the repo is a barcode, which is precisely the
// useful test here: a photo with NO training equipment in it must come back
// empty and say so, not hallucinate a home gym. Inventing kit is the failure
// that would quietly shape twelve weeks of someone's training.
const fixture = readFileSync(join(here, 'fixtures', 'barcode-5000159407236.jpg')).toString('base64')
const scan = await fetch(FN, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ images: [{ data: fixture, mediaType: 'image/jpeg' }] }),
}).then((r) => r.json())
ok('a photo comes back as a list, never a finished session', Array.isArray(scan.items) && !scan.sessions,
  JSON.stringify(scan).slice(0, 110))
ok('a photo with no kit in it invents none', (scan.items || []).length === 0, JSON.stringify(scan.items))
ok('and says so plainly', /no .*(equipment|kit)|not .*visible/i.test(scan.note || ''), scan.note)

// ---------------------------------------------------------------------------
// 2. The client's own builder — the important one
// ---------------------------------------------------------------------------
const gen = await fetch(SITE + '/.netlify/functions/program-generate', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    goal: 'Build muscle', days: 3, weeks: 4, level: 'Beginner',
    location: 'home_gym', equipment: 'adjustable dumbbells, flat bench, resistance bands',
  }),
}).then((r) => r.json())
ok('a home-gym plan generates', (gen.sessions || []).length === 3, `${(gen.sessions || []).length} sessions`)

const named = JSON.stringify(gen.sessions || []).toLowerCase()
ok('and is built from the kit that was listed', /dumbbell|bench|band/.test(named), named.slice(0, 110))
// The review step has to MEAN something: kit the person removed must not come back.
ok('it does not reach for kit that was not there',
  !/(barbell|squat rack|leg press|lat pulldown|smith machine|cable)/.test(named),
  (named.match(/barbell|squat rack|leg press|lat pulldown|smith machine|cable/g) || []).join(', '))

// saving it, through the only door a client has
const weeksN = 4
const days = [1, 4, 0] // Mon, Thu, Sun — deliberately includes Sunday
const rows = buildProgramRows(gen.sessions, weeksN, days)
ok('the base week is cloned across every week', rows.length === weeksN * 3, `${rows.length} rows`)
ok('and week 1 reads Monday-first, not Sunday-first',
  rows.filter((r) => r.week === 1).map((r) => r.dow).join(',') === '1,4,0',
  rows.filter((r) => r.week === 1).map((r) => r.dow).join(','))

const { data: progId, error: rpcErr } = await jamie.rpc('create_client_program', {
  p_title: 'E2E My Home Plan', p_description: 'built by the client', p_weeks: weeksN,
  p_level: 'Beginner', p_location: 'home_gym', p_equipment: 'adjustable dumbbells, flat bench',
  p_rows: rows, p_days: days,
})
ok('a client can create their own plan', !rpcErr && !!progId, rpcErr?.message)

const { data: saved } = await coach.from('workout_programs').select('*').eq('id', progId).single()
ok('it belongs to their coach, not to them', saved?.coach_id === paulId, String(saved?.coach_id))
ok('and is stamped as client-built so the coach can tell', saved?.source === 'client_ai', String(saved?.source))
ok('scoped to that one client', saved?.client_id === jamieId, String(saved?.client_id))

const { data: assigned } = await jamie.from('client_programs')
  .select('day_map, active, start_date').eq('program_id', progId).maybeSingle()
ok('they are put on it straight away', assigned?.active === true, JSON.stringify(assigned))
ok('on the days they picked, Monday-first', (assigned?.day_map || []).join(',') === '1,4,0', JSON.stringify(assigned?.day_map))

const { data: sess } = await coach.from('program_sessions').select('week, dow').eq('program_id', progId)
ok('every week was built, not just the first', new Set((sess || []).map((s) => s.week)).size === weeksN,
  `${new Set((sess || []).map((s) => s.week)).size} weeks`)

// the coach sees it
const { data: coachSees } = await coach.from('workout_programs').select('id, title, source').eq('id', progId).maybeSingle()
ok('the coach can see what their client built', !!coachSees, JSON.stringify(coachSees))

// and nobody else's client can
const { data: nosy } = await ollie.from('workout_programs').select('id').eq('id', progId)
ok('another client cannot see it', (nosy || []).length === 0, `${(nosy || []).length} rows`)

// the RPC must not be forgeable
const { error: bigErr } = await jamie.rpc('create_client_program', {
  p_title: 'E2E Too Big', p_description: '', p_weeks: 99, p_level: 'x', p_location: 'gym',
  p_equipment: '', p_rows: Array.from({ length: 300 }, () => ({ week: 1, dow: 1, title: 'x', exercises: [] })), p_days: [1],
})
ok('an absurd payload is refused', !!bigErr, bigErr?.message)

const { data: emptyId, error: emptyErr } = await jamie.rpc('create_client_program', {
  p_title: 'E2E Empty', p_description: '', p_weeks: 4, p_level: 'x', p_location: 'gym',
  p_equipment: '', p_rows: [], p_days: [1],
})
ok('an empty programme is refused', !!emptyErr && !emptyId, emptyErr?.message)

// ---------------------------------------------------------------------------
// 3. On screen
// ---------------------------------------------------------------------------
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('ollie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.locator('.tab', { hasText: 'Train' }).click()
await page.getByText('Program library').first().click()
await page.waitForSelector('text=Follow a plan', { timeout: 25000 })

const openBuild = page.getByRole('button', { name: /build me one with AI/i })
ok('the client is offered a plan of their own', await openBuild.waitFor({ timeout: 20000 }).then(() => true, () => false))
await openBuild.click()
await page.waitForSelector('text=Where do you train', { timeout: 20000 })
ok('it asks where they train', true)
ok('with home, home gym and gym', (await page.locator('.opt-row').count()) === 3, String(await page.locator('.opt-row').count()))

// home gym must ask for the kit, and must not build without it
await page.locator('.opt-row', { hasText: 'My home gym' }).click()
ok('choosing home gym asks what they have',
  await page.getByText('What have you got?').first().waitFor({ timeout: 15000 }).then(() => true, () => false))
await page.getByRole('button', { name: 'Build my plan' }).click()
await page.waitForTimeout(800)
ok('and refuses to guess when the kit is unknown',
  /add the kit you have/i.test(await page.locator('.error').first().innerText().catch(() => '')),
  await page.locator('.error').first().innerText().catch(() => ''))

// typed kit is accepted without any photo at all
await page.locator('input[placeholder="Add a piece of kit"]').fill('adjustable dumbbells')
await page.getByRole('button', { name: /^Add$/ }).click()
ok('kit can be added by hand', await page.locator('button.chip', { hasText: 'adjustable dumbbells' }).count() > 0)
await page.locator('button.chip', { hasText: 'adjustable dumbbells' }).click()
ok('and removed again', await page.locator('button.chip', { hasText: 'adjustable dumbbells' }).count() === 0)

ok('no page errors', errors.length === 0, errors.join(' | '))

await cleanup()
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
