// Click-through of the PAR-Q on a deployed build: the outstanding prompt on
// Home, the form taking over the health screen, submission, and the prompt
// clearing afterwards. Run: node tasks/e2e_parq_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
// playwright isn't a dependency of this app — set PLAYWRIGHT_PATH to a local
// copy (e.g. an npx cache) if it isn't resolvable by name.
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_parq_ui.mjs <url>'); process.exit(1) }
const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

let failures = 0
const ok = (label, pass, extra = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
}

// start clean: jamie must have no PAR-Q on record for the prompt to show
const api = createClient(SUPA, KEY)
await api.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await api.auth.getUser()).data.user.id
await api.from('parq_responses').delete().eq('client_id', jamieId)

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 430, height: 900 } })
page.setDefaultTimeout(20000)

const signIn = async (url) => {
  await page.goto(url)
  if (await page.locator('input[type="email"]').count()) {
    await page.locator('input[type="email"]').fill('jamie@redefine.app')
    await page.locator('input[type="password"]').fill('TestPass123')
    await page.getByRole('button', { name: /^Sign in$/ }).last().click()
  }
  await page.waitForSelector('.agenda-card', { timeout: 30000 })
}

// --- flag OFF ---------------------------------------------------------------
// A deploy permalink host isn't in HOST_BRAND, so the app falls back to Kim —
// which makes this a live render of the no-parq path, not just a code audit.
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await signIn(SITE)
const offBody = await page.locator('body').innerText()
ok('flag off: no PAR-Q prompt on the agenda', !offBody.includes('Health questionnaire'))
ok('flag off: no PAR-Q anywhere on Home', !offBody.includes('PAR-Q'))
ok('flag off: no page errors', errors.length === 0, errors.join(' | '))

// --- flag ON ----------------------------------------------------------------
await signIn(SITE + '/?brand=paul')

// 1. outstanding PAR-Q shows on today's plan (it renders once its own query
// resolves, a beat after the agenda card itself — so wait, don't sample)
const prompt = page.locator('.agenda-list').getByText('Health questionnaire')
ok('agenda prompts for the PAR-Q', await prompt.waitFor({ timeout: 15000 }).then(() => true, () => false))

// 2. it opens the health screen
await page.locator('.agenda-list >> text=Health questionnaire').locator('xpath=ancestor::*[contains(@class,"agenda-item")][1]').getByRole('button', { name: 'Open' }).click()
await page.waitForSelector('text=Health & circumstances')
ok('prompt opens My details', await page.getByText('Health questionnaire (PAR-Q)')
  .waitFor({ timeout: 15000 }).then(() => true, () => false))

// 3. starting the form takes over the screen (no second Save, no Back)
await page.getByRole('button', { name: 'Complete it now' }).click()
await page.waitForSelector('text=Has a doctor ever said')
ok('form takes over the screen', await page.locator('text=I’ve struggled with disordered eating').count() === 0)
ok('no competing Save button', await page.getByRole('button', { name: /^Save$/ }).count() === 0)
ok('no Back that would bin answers', await page.locator('text=‹ Back').count() === 0)

// 4. Submit stays disabled until every question, the tick and the name are done
const submit = page.getByRole('button', { name: 'Submit' })
ok('submit blocked while incomplete', await submit.isDisabled())

const cards = page.locator('.card', { hasText: '?' })
const noButtons = page.getByRole('button', { name: /^No$/ })
const n = await noButtons.count()
for (let i = 0; i < n; i++) await noButtons.nth(i).click()
ok('eight questions rendered', n === 8, `saw ${n}`)

await page.locator('input[type="checkbox"]').first().check()
await page.locator('input[placeholder="Type your name to sign"]').fill('Jamie Test')
ok('submit enabled once complete', await submit.isEnabled())

// 5. submit and confirm the record
await submit.click()
await page.waitForSelector('text=/Completed \\d/', { timeout: 20000 })
ok('shows as completed', await page.locator('text=nothing flagged').count() > 0)

const { data: rows } = await api.from('parq_responses').select('*').eq('client_id', jamieId)
ok('row written to the DB', rows?.length === 1)
ok('question text snapshotted', rows?.[0]?.questions?.length === 8)
ok('signature stored', rows?.[0]?.declared_name === 'Jamie Test')

// 6. Back returns to Home (came from the agenda), not the Nutrition hub
await page.locator('text=‹ Back').click()
await page.waitForSelector('.agenda-card')
ok('back lands on Home, not Nutrition', await page.locator('.agenda-card').count() > 0)

// 7. the prompt is gone
ok('prompt clears once done', await page.locator('.agenda-list >> text=Health questionnaire').count() === 0)

await api.from('parq_responses').delete().eq('client_id', jamieId)
await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
