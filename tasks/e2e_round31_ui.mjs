// The week plan, driven through the actual screen.
//
// e2e_round31.mjs proves the function works. This proves the thing a client
// touches works, which is a different claim: the week is assembled by the
// BROWSER across N separate requests, and every interesting property — days
// appearing one at a time, each one saved as it lands, the shopping list
// surviving a reload with its ticks — lives in MealPlan.jsx, not in the
// function. None of it is reachable from a fetch.
//
// Three days rather than seven, deliberately: it exercises the same loop for a
// third of the wall clock.
//
// Run: node tasks/e2e_round31_ui.mjs <deploy-url>
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round31_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
page.setDefaultTimeout(30000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 40000 })

// Start from a clean slate — a saved week from an earlier run would make the
// "it came back after a reload" assertion pass without anything being built.
await page.evaluate(() => { try { localStorage.removeItem('mp_week_v1') } catch { /* private mode */ } })

await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.getByText('Meal plan', { exact: true }).first().click()
await page.getByRole('button', { name: /Build my plan/ }).waitFor({ timeout: 30000 })

// ---------------------------------------------------------------------------
// 1. The week option is there, and asking for one changes what the button says
// ---------------------------------------------------------------------------
const weekTab = page.getByRole('button', { name: /A whole week/i })
ok('a week is offered alongside a day', await weekTab.count() > 0)
await weekTab.click()
await page.getByRole('button', { name: /^3$/ }).first().click()
const go = page.getByRole('button', { name: /Plan my 3 days/ })
ok('and the button asks for the length chosen', await go.count() > 0)

// ---------------------------------------------------------------------------
// 2. Days arrive one at a time, not all at the end
// ---------------------------------------------------------------------------
// `.eyebrow` is uppercased in CSS and innerText returns what is rendered, so
// every text assertion here has to be case-insensitive. Matching "Shopping
// list" exactly finds nothing and makes a working screen look broken.
const DAY = /^(Today|Tomorrow|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i
const dayLabelsOnScreen = async () =>
  (await page.locator('.card .eyebrow.accent').allInnerTexts()).map((t) => t.trim()).filter((t) => DAY.test(t))
// NOT /shopping list/ on the body: the intro paragraph says "a week gives you
// the plan and the shopping list", so that matches before anything is built and
// the wait falls straight through. "Tick as you go" only exists on the real card.
const shoppingOnScreen = async () => /tick as you go/i.test(await page.locator('body').innerText())

await go.click()
let sawPartial = false
for (let i = 0; i < 240; i++) {
  const n = (await dayLabelsOnScreen()).length
  if (n > 0 && n < 3) sawPartial = true
  if (await shoppingOnScreen()) break
  if (i % 20 === 19) console.log(`      …${((i + 1) / 2).toFixed(0)}s, ${n} day(s) on screen`)
  await page.waitForTimeout(500)
}
ok('days appear as they are built, not all at the end', sawPartial,
  sawPartial ? '' : 'every day landed in the same render — the loop may be awaiting them all first')

const labels = await dayLabelsOnScreen()
ok('all three days are on screen', labels.length === 3, labels.join(', '))
ok('labelled by real days, starting today', /^today$/i.test(labels[0] || '') && /^tomorrow$/i.test(labels[1] || ''), labels.join(', '))

const body = await page.locator('body').innerText()
ok('a shopping list came with it', /tick as you go/i.test(body))
const boxes = page.locator('input[type="checkbox"]')
const boxCount = await boxes.count()
ok('with tickable items', boxCount >= 8, `${boxCount} tick boxes`)

// Every meal must be different — the complaint that started this.
const titles = await page.locator('.card .card .session-title').allInnerTexts()
const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').trim()
const dupes = titles.map(norm).filter((t, i, a) => a.indexOf(t) !== i)
ok('no meal repeats across the days', dupes.length === 0, [...new Set(dupes)].join(' | '))

// ---------------------------------------------------------------------------
// 3. The list has to survive leaving the screen — the point is to shop off it
// ---------------------------------------------------------------------------
const firstBox = boxes.nth(2)
const itemText = await firstBox.locator('xpath=..').innerText()
await firstBox.check()
await page.waitForTimeout(400)

await page.reload()
await page.waitForSelector('.tabbar', { timeout: 40000 })
await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.getByText('Meal plan', { exact: true }).first().click()
await page.waitForTimeout(2500)

const after = await page.locator('body').innerText()
ok('the week is still there after a reload', /tick as you go/i.test(after))
const afterLabels = await dayLabelsOnScreen()
ok('with the same days', afterLabels.length === 3, afterLabels.join(', '))
const checked = await page.locator('input[type="checkbox"]:checked').count()
ok('and the item ticked before the reload is still ticked', checked >= 1,
  `${checked} ticked — was "${itemText.replace(/\n/g, ' ').slice(0, 40)}"`)

// ---------------------------------------------------------------------------
// 4. Clearing it clears it
// ---------------------------------------------------------------------------
await page.getByRole('button', { name: /Clear this week/i }).click()
await page.waitForTimeout(600)
ok('clearing the week removes it', !(await shoppingOnScreen()) && (await dayLabelsOnScreen()).length === 0)
const stored = await page.evaluate(() => { try { return localStorage.getItem('mp_week_v1') } catch { return 'unreadable' } })
ok('and does not leave it in storage to come back', !stored, String(stored).slice(0, 40))

ok('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
