// The 28-30 Aug batch: starting a session actually opens it, brand-correct link
// previews / install metadata, the ReDefine community name, and fixing a
// progress photo that went in with the wrong date.
// Run: node tasks/e2e_round12_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round12_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

// ---------------------------------------------------------------------------
// 1. Static metadata — what a link-preview crawler and "add to home screen" see.
//    These never run our JS, so they read whatever the build stamped.
// ---------------------------------------------------------------------------
const html = await fetch(SITE + '/').then((r) => r.text())
ok('title is the brand, not Kim', /<title>ReDefine Academy<\/title>/.test(html), (html.match(/<title>[^<]*<\/title>/) || [])[0])
ok('no Coached by Kim left in the head', !/Coached by Kim/.test(html.split('</head>')[0]))
ok('og:title set', /og:title" content="ReDefine Academy"/.test(html))
ok('og:image is absolute', /og:image" content="https:\/\/[^"]+\/brands\/paul\/og\.png"/.test(html), (html.match(/og:image" content="[^"]*"/) || [])[0])
ok('apple touch icon is the brand icon', /apple-touch-icon" href="\/brands\/paul\/icon-192\.png"/.test(html))

const mani = await fetch(SITE + '/manifest.webmanifest').then((r) => r.json())
ok('installed app name is the brand', mani.name === 'ReDefine Academy', mani.name)
ok('install icon is the brand icon', (mani.icons || [])[0]?.src === '/brands/paul/icon-192.png', JSON.stringify((mani.icons || [])[0]))

// ---------------------------------------------------------------------------
// 2. Client app
// ---------------------------------------------------------------------------
const api = createClient(SUPA, KEY)
await api.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await api.auth.getUser()).data.user.id

// a session to start, and a photo carrying a wrong date
await api.from('workout_plans').delete().eq('client_id', jamieId).eq('title', 'E2E Start Me')
await api.from('body_scans').delete().eq('client_id', jamieId).like('photo_path', 'e2e/%')

// Jamie needs an active programme, otherwise the start list is legitimately
// empty ("No sessions from your coach yet") and there is nothing to start.
const coach = createClient(SUPA, KEY)
await coach.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const paulId = (await coach.auth.getUser()).data.user.id
const { data: oldProg } = await coach.from('workout_programs').select('id').eq('coach_id', paulId).eq('title', 'E2E Start Program')
for (const pgm of oldProg || []) await coach.from('workout_programs').delete().eq('id', pgm.id)
const { data: prog } = await coach.from('workout_programs')
  .insert({ coach_id: paulId, title: 'E2E Start Program', weeks: 4, level: 'Beginner' }).select().single()
await coach.from('program_sessions').insert({
  program_id: prog.id, position: 0, week: 1, dow: null, title: 'E2E Start Me', focus: 'Full body',
  exercises: [{ name: 'Leg Press', equipment: 'Coach plan', cue: '', sets: [{ reps: '10', weight: '80' }] }],
})
await coach.from('client_programs').update({ active: false }).eq('client_id', jamieId).eq('active', true)
await coach.from('client_programs').insert({
  client_id: jamieId, coach_id: paulId, program_id: prog.id,
  start_date: '2026-08-24', repeat: true, active: true, day_map: [1, 3, 5],
})
const { data: scan } = await api.from('body_scans').insert({
  client_id: jamieId, photo_path: 'e2e/nonexistent.jpg', pose: 'front',
  created_at: '2020-01-02T12:00:00Z', summary: null,
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

// --- starting a session must open the player, not just say "added" ---
await page.locator('.tab', { hasText: 'Train' }).click()
await page.waitForSelector('text=Your training', { timeout: 20000 })
await page.getByText('Today’s session').first().click()
await page.waitForSelector('text=Train your way', { timeout: 20000 })

await page.getByText('E2E Start Me').first().click()
const startBtn = page.getByRole('button', { name: 'Start this session' }).first()
ok('a session is offered to start', await startBtn.waitFor({ timeout: 15000 }).then(() => true, () => false))
await startBtn.click()
// the guided player is what proves it opened — not a toast
ok('starting drops straight into the player', await page.locator('.gw-set').first().waitFor({ timeout: 20000 }).then(() => true, () => false))
ok('no "added to your sessions" dead end', !(await page.locator('body').innerText()).includes('Added to your sessions'))

// Leave the player. The active-session flag survives a reload on purpose (that
// is what reopens a backgrounded workout), so clear it rather than fighting it —
// and the app reopens on the remembered screen, not Home.
await page.evaluate(() => { try { sessionStorage.removeItem('cbk_gw_active') } catch { /* ignore */ } })
await page.reload()
await page.waitForSelector('.tabbar', { timeout: 30000 })

// --- community name ---
await page.locator('.tab', { hasText: 'Coach' }).click()
await page.getByText('Community', { exact: true }).first().click()
await page.waitForSelector('h1.h1', { timeout: 20000 })
const commHeading = await page.locator('h1.h1').first().innerText()
ok('community is named for the brand', /ReDefine/i.test(commHeading), commHeading)
ok('not "The Paul community"', !/the paul community/i.test(commHeading), commHeading)

// --- progress photo: fix the date, then delete it ---
await page.locator('.tab', { hasText: 'Check-ins & Progress' }).click()
await page.waitForTimeout(1200)
const photosTab = page.getByRole('button', { name: /^Photos$/ }).first()
if (await photosTab.count()) await photosTab.click()
await page.waitForSelector('.photo-wrap', { timeout: 20000 })
ok('client gets a per-photo fix control', await page.locator('.photo-edit').count() > 0)

await page.locator('.photo-edit').first().click()
await page.waitForSelector('text=Fix this photo', { timeout: 15000 })
const dateInput = page.locator('input[type="date"]').first()
ok('the wrong date is editable', await dateInput.count() > 0, await dateInput.inputValue().catch(() => '?'))
await dateInput.fill('2021-06-15')
await page.getByRole('button', { name: 'Save date' }).click()
await page.waitForTimeout(2500)

const { data: fixed } = await api.from('body_scans').select('created_at').eq('id', scan.id).single()
ok('corrected date is stored', (fixed?.created_at || '').startsWith('2021-06-15'), fixed?.created_at)

await page.locator('.photo-edit').first().click()
await page.waitForSelector('text=Fix this photo', { timeout: 15000 })
await page.getByRole('button', { name: 'Delete this photo' }).click()
ok('delete asks before destroying it', (await page.locator('body').innerText()).includes('can’t be undone'))
await page.getByRole('button', { name: 'Yes, delete it' }).click()
await page.waitForTimeout(2500)

const { data: gone } = await api.from('body_scans').select('id').eq('id', scan.id)
ok('photo is deleted', (gone || []).length === 0, JSON.stringify(gone))

ok('no page errors', errors.length === 0, errors.join(' | '))

// cleanup
await api.from('workout_plans').delete().eq('client_id', jamieId).eq('title', 'E2E Start Me')
await api.from('body_scans').delete().eq('client_id', jamieId).like('photo_path', 'e2e/%')
await coach.from('client_programs').delete().eq('client_id', jamieId).eq('program_id', prog.id)
await coach.from('workout_programs').delete().eq('id', prog.id)
await api.from('workout_completions').delete().eq('client_id', jamieId).eq('completed_on', new Date().toISOString().slice(0, 10))
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
