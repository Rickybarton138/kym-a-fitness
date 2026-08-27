// Click-through of the 26 Aug batch on a deployed build:
// food-diary delete, "complete logging" ticking the agenda, screen persistence
// across an app relaunch, and backdating a lift.
// Run: node tasks/e2e_round9_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round9_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul' // deploy permalinks aren't in HOST_BRAND

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const api = createClient('https://ezwmfbuuopsnpanebtal.supabase.co', 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv')
await api.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const id = (await api.auth.getUser()).data.user.id
const today = new Date().toISOString().slice(0, 10)
// clean slate
await api.from('food_day_complete').delete().eq('client_id', id)
await api.from('lift_entries').delete().eq('client_id', id)
await api.from('nutrition_logs').delete().eq('client_id', id).gte('logged_at', today + 'T00:00:00Z')
// one logged item so the diary has a row to delete
await api.from('nutrition_logs').insert({
  client_id: id, source: 'manual', name: 'E2E Test Porridge',
  calories: 300, protein_g: 10, carbs_g: 50, fat_g: 5, fibre_g: 4,
  meal_type: 'Breakfast', logged_at: new Date().toISOString(),
})

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const page = await browser.newPage({ viewport: { width: 430, height: 900 } })
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.agenda-card', { timeout: 30000 })

// 1. food logged but not finished -> task NOT ticked, Finish offered
const foodItem = page.locator('.agenda-item', { hasText: 'Log your food' })
await foodItem.getByRole('button', { name: 'Finish' }).waitFor()
ok('logging one item no longer ticks the task', !(await foodItem.getAttribute('class') || '').includes('done'))
ok('agenda offers Finish once something is logged', true)

// 2. the diary delete is where it should be, and works
await foodItem.getByRole('button', { name: 'Finish' }).click()
await page.waitForSelector('text=E2E Test Porridge')
const row = page.locator('.diary-item', { hasText: 'E2E Test Porridge' })
const del = row.getByRole('button', { name: /Delete/ })
const box = await del.boundingBox()
const rowBox = await row.boundingBox()
ok('delete button sits inside its own row',
  !!box && !!rowBox && box.y >= rowBox.y - 2 && box.y + box.height <= rowBox.y + rowBox.height + 2,
  `btn y=${box?.y?.toFixed(0)} row y=${rowBox?.y?.toFixed(0)}-${((rowBox?.y || 0) + (rowBox?.height || 0)).toFixed(0)}`)
ok('delete is a real touch target', !!box && box.width >= 40 && box.height >= 40, `${box?.width}x${box?.height}`)
await del.click()
await page.waitForSelector('text=E2E Test Porridge', { state: 'detached' })
const { data: after } = await api.from('nutrition_logs').select('id').eq('client_id', id).gte('logged_at', today + 'T00:00:00Z')
ok('deleting removes it from the diary and the DB', (after || []).length === 0)

// 3. complete logging ticks the home task
await page.getByRole('button', { name: /Complete logging for the day/ }).click()
await page.getByRole('button', { name: /Logging complete/ }).waitFor()
const { data: fdc } = await api.from('food_day_complete').select('day').eq('client_id', id)
ok('complete logging is recorded', (fdc || []).length === 1)
await page.locator('text=‹ Back').click()
await page.waitForSelector('.agenda-card')
const foodItem2 = page.locator('.agenda-item', { hasText: 'Log your food' })
await page.waitForFunction(() => {
  const el = [...document.querySelectorAll('.agenda-item')].find((n) => n.textContent.includes('Log your food'))
  return el && el.className.includes('done')
}, null, { timeout: 15000 }).then(() => {}, () => {})
ok('home task now ticked', (await foodItem2.getAttribute('class') || '').includes('done'),
  await foodItem2.getAttribute('class'))

// 4. screen persistence: leave the app mid-screen, relaunch, land back there
await page.locator('.tab', { hasText: 'Nutrition' }).click()
await page.waitForSelector('text=/Nutrition|Log food/')
const before = await page.evaluate(() => localStorage.getItem('cbk_screen'))
await page.goto(base) // relaunch, as an iOS PWA cold start does
await page.waitForSelector('.tab')
const restored = await page.evaluate(() => localStorage.getItem('cbk_screen'))
ok('screen is remembered across a relaunch', before === restored && restored !== 'home', `${before} -> ${restored}`)
ok('lands back on that tab, not Home',
  (await page.locator('.tab.on').innerText()).toLowerCase().includes('nutrition'),
  await page.locator('.tab.on').innerText())

// 5. backdate a lift from the progress hub
await page.locator('.tab', { hasText: 'Check-ins' }).click()
await page.getByRole('button', { name: /^Training$/ }).click()
await page.getByRole('button', { name: '+ Add a past lift' }).click()
await page.locator('input[placeholder="e.g. Back Squat"]').fill('E2E Squat')
await page.locator('input[placeholder="e.g. 60"]').fill('60')
await page.locator('input[type="date"]').fill('2024-03-01')
await page.getByRole('button', { name: /^Add$/ }).click()
await page.getByText('E2E Squat').waitFor()
const { data: le } = await api.from('lift_entries').select('*').eq('client_id', id)
ok('backdated lift saved with its real date', le?.[0]?.performed_on === '2024-03-01', le?.[0]?.performed_on)
ok('it shows on the training progress', await page.getByText('E2E Squat').count() > 0)

ok('no page errors throughout', errors.length === 0, errors.join(' | '))

// cleanup
await api.from('lift_entries').delete().eq('client_id', id)
await api.from('food_day_complete').delete().eq('client_id', id)
await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
