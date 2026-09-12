// Elev8u demo smoke test. (2026-09-12)
//
// Ricky: "add all of the functionality of redefine to the elev8 app and resend
// demo to paul and selina. need to generate 1-2 more paying customers."
//
// So this checks the thing that would actually lose the sale: an owner opening
// their demo login and hitting a blank screen or a console error, on a feature
// set that was switched on twenty-five flags at a time and never opened.
//
// Both owner tenants, coach and athlete, every tab.
// NOTE a draft permalink host is not in HOST_BRAND and renders as KIM, so the
// ?brand=elev8 below is load-bearing on a draft.
// Run: node tasks/e2e_elev8_demo.mjs <deploy-url>
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_elev8_demo.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=elev8'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const ACCOUNTS = [
  ['Paul (Elev8u) — coach', 'paul@elev8u.app', 'Elev8uDemo123', 'coach'],
  ['Chloe — his athlete', 'chloe@elev8u.app', 'Elev8uDemo123', 'athlete'],
  ['Selina (Elev8u) — coach', 'selina@elev8u.app', 'Elev8uDemo123', 'coach'],
  ['Marcus — her athlete', 'marcus@elev8u.app', 'Elev8uDemo123', 'athlete'],
]

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})

for (const [label, email, password, kind] of ACCOUNTS) {
  const errors = []
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  page.setDefaultTimeout(30000)
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(base)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /^Sign in$/ }).last().click()

  const landed = await page.waitForSelector('.tabbar, .coach-wrap, .h1', { timeout: 35000 }).then(() => true, () => false)
  ok(`${label} can sign in`, landed)
  if (!landed) { await page.close(); continue }

  // The brand must actually be Elev8u and not fall through to Kim — the
  // HOST_BRAND trap that made this app render CBK the first time it shipped.
  const body = await page.locator('body').innerText()
  ok(`${label} sees Elev8u branding`, !/Coached by Kim/i.test(body), /Coached by Kim/i.test(body) ? 'rendered as KIM' : '')

  // Walk every tab and fail on anything that throws or renders empty.
  const tabs = await page.locator('.tab').allInnerTexts().catch(() => [])
  for (const t of tabs) {
    const name = t.trim().split('\n')[0]
    if (!name) continue
    await page.locator('.tab', { hasText: name }).first().click().catch(() => {})
    await page.waitForTimeout(900)
    const txt = (await page.locator('body').innerText()).trim()
    ok(`${label} · ${name} renders`, txt.length > 40, `${txt.length} chars`)
  }

  // A horizontal scrollbar is the classic white-label regression when a brand
  // suddenly gets twenty-five more screens.
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok(`${label} does not scroll sideways`, over <= 1, `${over}px over`)

  ok(`${label} has no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '))
  await page.close()
}

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
