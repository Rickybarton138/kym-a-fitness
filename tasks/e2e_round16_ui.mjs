// Backdating a progress photo. The date used to be typed BEFORE opening the
// gallery/camera, and picking an old photo backgrounds the tab — a phone under
// memory pressure reloads the PWA and the date is gone, so the photo saves as
// today. Which is exactly the case backdating exists for: not one photo in the
// live database had ever been backdated.
// Run: node tasks/e2e_round16_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round16_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const api = createClient(SUPA, KEY)
await api.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await api.auth.getUser()).data.user.id

const BACKDATE = '2024-03-01'
// clear anything a previous run left behind
const { data: old } = await api.from('body_scans').select('id, photo_path').eq('client_id', jamieId).gte('created_at', BACKDATE + 'T00:00:00Z').lte('created_at', BACKDATE + 'T23:59:59Z')
for (const r of old || []) {
  await api.from('body_scans').delete().eq('id', r.id)
  if (r.photo_path) await api.storage.from('body-photos').remove([r.photo_path]).catch(() => {})
}
const before = (await api.from('body_scans').select('id').eq('client_id', jamieId)).data?.length || 0

// a fake webcam, so the in-page capture path runs for real
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const ctx = await browser.newContext({ viewport: { width: 430, height: 1000 }, permissions: ['camera'] })
const page = await ctx.newPage()
page.setDefaultTimeout(30000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })

await page.locator('.tab', { hasText: 'Check-ins & Progress' }).click()
await page.getByRole('button', { name: /^Body scan$/ }).first().click()
await page.waitForSelector('text=Angle', { timeout: 20000 })

// the date must NOT be askable before a photo exists — that was the bug
ok('no date field before a photo is taken', await page.locator('input[type="date"]').count() === 0,
  `${await page.locator('input[type="date"]').count()} date inputs`)

await page.getByRole('button', { name: /Add front photo/i }).click()
await page.waitForSelector('video', { timeout: 25000 })
await page.waitForTimeout(1500) // let the fake stream produce frames
await page.getByRole('button', { name: /^Capture$|Take photo|Use photo/i }).first().click()
const usePhoto = page.getByRole('button', { name: /Use photo|Use this/i }).first()
if (await usePhoto.count()) await usePhoto.click()

// now, and only now, it asks when the photo was taken
await page.waitForSelector('text=When was this taken', { timeout: 25000 })
ok('asks for the date after the photo is in hand', true)
const dateInput = page.locator('input[type="date"]').first()
ok('with a date field', await dateInput.count() === 1)

await dateInput.fill(BACKDATE)
await page.getByRole('button', { name: 'Save photo' }).click()
// the AI scan runs on save, so give it room
await page.waitForSelector('text=Add front photo', { timeout: 90000 }).catch(() => {})
await page.waitForTimeout(3000)

const { data: after } = await api.from('body_scans').select('id, created_at, pose, photo_path')
  .eq('client_id', jamieId).order('created_at', { ascending: false })
const added = (after || []).length - before
ok('the photo was saved', added === 1, `${added} new row(s)`)
const backdated = (after || []).find((r) => String(r.created_at).startsWith(BACKDATE))
ok('stored on the backdated date, not today', !!backdated, JSON.stringify((after || []).slice(0, 3).map((r) => r.created_at)))

ok('no page errors', errors.length === 0, errors.join(' | '))

// cleanup
if (backdated) {
  await api.from('body_scans').delete().eq('id', backdated.id)
  if (backdated.photo_path) await api.storage.from('body-photos').remove([backdated.photo_path]).catch(() => {})
}
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
