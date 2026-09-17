// Paul, 13 Sept: "on the ai program builder for clients can we add a text box
// where they can give a prompt for the type of program they want. For example
// being able to specify they want a program for the gym with weights that also
// includes scheduled running to increase distance and pace with running."
//
// The single-session builder got its box on 9 Sept (round 32); this is the
// multi-week PROGRAMME builder. Asserts the box exists and that what is typed
// into it actually reaches program-generate — the response is stubbed, because
// whether the model honours the request is checked against the deployed
// function separately (it needed a retry guard: one generation in two came back
// with running in the description and none in the plan).
//
// Run: node tasks/e2e_round34_ui.mjs <deploy-url>
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round34_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

let sent = null
await page.route('**/.netlify/functions/program-generate', async (route) => {
  sent = JSON.parse(route.request().postData() || '{}')
  await route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      title: 'Stubbed plan', description: 'Stubbed', weeks: 4,
      sessions: [{ label: 'Day 1', title: 'Stub', focus: 'Stub', exercises: [{ name: 'Easy Run', sets: 1, reps: '5 km @ conversational pace' }], finisher: null }],
    }),
  })
})

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })

await page.locator('.tab', { hasText: 'Train' }).click()
await page.getByText('Program library').first().click()
await page.getByRole('button', { name: /build me one with AI/i }).waitFor({ timeout: 25000 })
await page.getByRole('button', { name: /build me one with AI/i }).click()

const box = page.getByPlaceholder(/running built in/i)
ok('the programme builder has a prompt box', await box.count() === 1)
ok('and it carries his own example as the hint', /distance and pace/i.test(await box.getAttribute('placeholder') || ''))

const ASK = 'weights in the gym plus scheduled running to build distance and pace'
await box.fill(ASK)
await page.getByRole('button', { name: /Build my plan|Build me a plan|Generate/i }).first().click()
await page.waitForTimeout(2500)

ok('what they typed reaches the generator', sent && sent.notes === ASK, sent ? JSON.stringify(sent.notes) : 'nothing sent')
ok('along with where and how many days', sent && !!sent.location && !!sent.days, sent ? `${sent.location} / ${sent.days} days` : '')
ok('a long reps value survives to the draft', await page.getByText(/5 km @ conversational pace/).count() > 0)

// --- the gradual build-up (Paul, 17 Sept) ------------------------------------
// "start with 1 per week and build gradually to 3 per week over 12 weeks."
await page.getByRole('button', { name: /Change something/i }).click().catch(() => {})
await page.waitForTimeout(800)

const rampBox = page.getByLabel(/Build up gradually/i)
ok('there is a build-up option', await rampBox.count() === 1)
await rampBox.check()
await page.waitForTimeout(400)
ok('and it explains what it will do', await page.getByText(/works up to \d+ by the end/i).count() > 0,
  (await page.getByText(/works up to/i).first().innerText().catch(() => '')).slice(0, 90))

sent = null
await page.getByRole('button', { name: /Build my plan|Build me a plan|Generate/i }).first().click()
await page.waitForTimeout(2500)
ok('the ramp reaches the generator', sent && sent.rampFrom === 1 && sent.rampTo >= 2,
  sent ? `${sent.rampFrom} -> ${sent.rampTo}` : 'nothing sent')

ok('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
