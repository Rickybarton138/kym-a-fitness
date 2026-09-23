// Paul, 23 Sept, three things about manually adjusting calories and macros:
//  1. "if they update all the calories and macros in one go and then save it
//     doesn't save it."
//  2. "when they do change their calorie target it then shows that as their
//     target historically, so when looking backwards at previous days or weeks
//     it shows the new targets, not the targets held at that time."
//  3. "when you manually change the calorie target it doesn't then adjust the
//     macros accordingly... keep the protein target the same but just adjust the
//     carbs and fats to meet the new target."
//
// The history one is the assertion that matters and the only one that cannot be
// checked by looking at a form: it needs a target change to happen and then a
// PAST day to still be judged by the old number.
//
// Run: node tasks/e2e_round39_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round39_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

const readTargets = async () => (await jamie.from('macro_targets')
  .select('calories, protein_g, carbs_g, fat_g').eq('client_id', jamieId).maybeSingle()).data
const before = await readTargets()

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const OLD_DAY = new Date(); OLD_DAY.setDate(OLD_DAY.getDate() - 10)
// The history row starts BEFORE that week, so all seven days resolve to the one
// old target and the net line can name a single number. Dated inside the week
// instead, the first run put six days on the backfilled target and one on this
// one — correct behaviour, and an unreadable assertion.
const HIST_FROM = new Date(); HIST_FROM.setDate(HIST_FROM.getDate() - 20)

// A target that was in force ten days ago, and a day of eating under it.
const NAME = 'E2E R39 marker'
const cleanup = async () => {
  await jamie.from('nutrition_logs').delete().eq('client_id', jamieId).eq('name', NAME)
  await jamie.from('macro_target_history').delete().eq('client_id', jamieId).eq('effective_from', ymd(HIST_FROM))
}
await cleanup()
await jamie.from('macro_target_history').insert({
  client_id: jamieId, effective_from: ymd(HIST_FROM), calories: 1900, protein_g: 170, carbs_g: 180, fat_g: 55,
})
const at = new Date(OLD_DAY); at.setHours(12, 0, 0, 0)
await jamie.from('nutrition_logs').insert({
  client_id: jamieId, source: 'manual', name: NAME, calories: 1850, protein_g: 160, carbs_g: 170, fat_g: 52, fibre_g: 20,
  meal_type: 'Lunch', logged_at: at.toISOString(),
})

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
page.setDefaultTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })

// --- 3. changing calories moves carbs and fat, and leaves protein alone -------
await page.getByRole('button', { name: /adjust targets/i }).click()
const read = async (l) => Number(await page.getByLabel(l).inputValue())
const protBefore = await read('Protein (g)')
const carbBefore = await read('Carbs (g)')
await page.getByLabel('Calories').fill('2600')
await page.waitForTimeout(500)
ok('protein is left alone when calories change', await read('Protein (g)') === protBefore,
  `${protBefore} -> ${await read('Protein (g)')}`)
ok('carbs move to meet the new target', await read('Carbs (g)') !== carbBefore,
  `${carbBefore} -> ${await read('Carbs (g)')}`)
const sum = (await read('Protein (g)')) * 4 + (await read('Carbs (g)')) * 4 + (await read('Fat (g)')) * 9
ok('and the macros now add up to the calories', Math.abs(sum - 2600) <= 25, `${sum} vs 2600`)
ok('it says what it did', await page.getByText(/Carbs and fat adjusted to match/i).count() > 0)

// --- 1. all four at once, saved in one go ------------------------------------
await page.getByLabel('Protein (g)').fill('195')
await page.getByLabel('Carbs (g)').fill('255')
await page.getByLabel('Fat (g)').fill('75')
await page.getByRole('button', { name: /Save targets/i }).click()
await page.waitForTimeout(3000)
const saved = await readTargets()
ok('all four save together', saved.calories === 2600 && saved.protein_g === 195 && saved.carbs_g === 255 && saved.fat_g === 75,
  JSON.stringify(saved))
ok('and the editor closes on success', await page.getByRole('button', { name: /Save targets/i }).count() === 0)

// --- 2. the past keeps the target it had -------------------------------------
await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.getByText('Food diary').first().click()
await page.locator('.wk-nav').first().waitFor({ timeout: 25000 })

// Walk the diary back to the seeded day.
await page.getByLabel(/Jump to a week/i).fill(ymd(OLD_DAY))
await page.waitForTimeout(1800)
const chart = page.locator('.week-snapshot').filter({ has: page.locator('.wk-nav') }).first()
const snapshot = await chart.innerText()
ok('that week shows what was eaten then', /1,850/.test(snapshot), snapshot.replace(/\n/g, ' ').slice(0, 90))
// The point of the whole exercise: the target was changed to 2600 a moment ago,
// and this week must still be scored against the 1900 that was in force then.
const netLine = await page.getByText(/vs target/).first().innerText()
ok('and is judged against the OLD target, not the new one',
  /1900/.test(netLine) && !/2600/.test(netLine), netLine)

ok('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
await cleanup()
if (before) await jamie.from('macro_targets').upsert({ client_id: jamieId, ...before, updated_at: new Date().toISOString() })
const after = await readTargets()
ok('targets restored', JSON.stringify(after) === JSON.stringify(before), JSON.stringify(after))

console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
