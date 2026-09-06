// Paul's first real check-in, 6 Sept, and a report from one of his clients:
//  1. "I could see the TRX training session but not the legs one"
//  2. "The measurements input section goes out of the screen" / "a couple of
//     bits where the text box goes off screen"
//  3. "How do I input past steps? Wanted to input them for this week"
//
// The overflow check is the one worth keeping: it sweeps every client screen at
// phone widths and fails if the PAGE can be scrolled sideways at all, which is
// what pushed the measurement labels off the left edge in his client's photo.
// Run: node tasks/e2e_round23_ui.mjs <deploy-url>
import { createClient } from '@supabase/supabase-js'
import { sessionForDay } from '../src/programSchedule.js'
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright')

const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round23_ui.mjs <url>'); process.exit(1) }
const base = SITE + '/?brand=paul'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const jamie = createClient(SUPA, KEY)
await jamie.auth.signInWithPassword({ email: 'jamie@redefine.app', password: 'TestPass123' })
const jamieId = (await jamie.auth.getUser()).data.user.id

// ---------------------------------------------------------------------------
// 1. A short day_map must not strand a session
// ---------------------------------------------------------------------------
// Exactly K-Jo's shape: two sessions a week (Tue + Thu), but the assignment
// mapped Tuesday only. The Thursday session existed and no date could reach it.
const prog = {
  asg: { start_date: '2026-09-01', repeat: true },
  cycleWeeks: 4,
  title: 'K-Jo style TRX',
  dayMap: [2],
  sessions: [
    { id: 'a', week: 1, dow: 2, position: 0, title: 'Full Body Foundation' },
    { id: 'b', week: 1, dow: 4, position: 1, title: 'Lower Body Focus' },
  ],
}
const on = (iso) => sessionForDay(prog, new Date(iso + 'T09:00:00'))
ok('the mapped day still resolves', on('2026-09-01')?.sess?.title === 'Full Body Foundation', String(on('2026-09-01')?.sess?.title))
ok('the session the map missed is reachable again', on('2026-09-03')?.sess?.title === 'Lower Body Focus', String(on('2026-09-03')?.sess?.title))
ok('a genuine rest day is still a rest day', on('2026-09-02') === null, JSON.stringify(on('2026-09-02')?.sess?.title))

// A full map still overrides the authored days, as it always did. Week 1 runs
// Tue 1 Sept to Mon 7 Sept, so Fri 4th and Mon 7th are both inside it — the
// fixture only has week 1, and reaching into week 2 would prove nothing.
const moved = { ...prog, dayMap: [1, 5] }
const onMoved = (iso) => sessionForDay(moved, new Date(iso + 'T09:00:00'))
ok('a full day map still moves both sessions',
  onMoved('2026-09-07')?.sess?.title === 'Full Body Foundation' && onMoved('2026-09-04')?.sess?.title === 'Lower Body Focus',
  `Mon: ${onMoved('2026-09-07')?.sess?.title} / Fri: ${onMoved('2026-09-04')?.sess?.title}`)
ok('and the days it moved off are now clear', onMoved('2026-09-01') === null && onMoved('2026-09-03') === null,
  `Tue: ${onMoved('2026-09-01')?.sess?.title} / Thu: ${onMoved('2026-09-03')?.sess?.title}`)

// ---------------------------------------------------------------------------
// 2. Nothing may scroll sideways on a phone
// ---------------------------------------------------------------------------
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {})
const errors = []

// 320 is an iPhone SE; 360 is the commonest Android width and close to the
// device in the photo.
for (const width of [320, 360]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  page.setDefaultTimeout(25000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base)
  await page.locator('input[type="email"]').fill('jamie@redefine.app')
  await page.locator('input[type="password"]').fill('TestPass123')
  await page.getByRole('button', { name: /^Sign in$/ }).last().click()
  await page.waitForSelector('.tabbar', { timeout: 30000 })

  const overflow = async () => page.evaluate(() => {
    const d = document.documentElement
    const over = d.scrollWidth - d.clientWidth
    if (over <= 1) return null
    // Name the widest offender so a failure says what to fix.
    let worst = null
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width > d.clientWidth + 1 && (!worst || r.width > worst.w)) {
        worst = { w: Math.round(r.width), tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 40) }
      }
    }
    return { over, worst }
  })

  for (const tab of ['Home', 'Train', 'Nutrition', 'Check-ins & Progress', 'Coach']) {
    await page.locator('.tab', { hasText: tab }).click()
    await page.waitForTimeout(1200)
    const o = await overflow()
    ok(`${tab} fits a ${width}px screen`, o === null, o ? `${o.over}px over — widest: ${JSON.stringify(o.worst)}` : '')
  }

  // and the screen the photo was taken on
  await page.locator('.tab', { hasText: 'Check-ins & Progress' }).click()
  await page.getByRole('button', { name: /^Measurements$/ }).first().click().catch(() => {})
  await page.waitForSelector('text=Log this week', { timeout: 20000 })
  const o = await overflow()
  ok(`the measurements form fits a ${width}px screen`, o === null, o ? `${o.over}px over — widest: ${JSON.stringify(o.worst)}` : '')
  await page.close()
}

// ---------------------------------------------------------------------------
// 3. Steps for a day gone by
// ---------------------------------------------------------------------------
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const back = new Date(); back.setDate(back.getDate() - 3)
const backDay = iso(back)
await jamie.from('daily_steps').delete().eq('client_id', jamieId).eq('day', backDay)

const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
page.setDefaultTimeout(25000)
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(base)
await page.locator('input[type="email"]').fill('jamie@redefine.app')
await page.locator('input[type="password"]').fill('TestPass123')
await page.getByRole('button', { name: /^Sign in$/ }).last().click()
await page.waitForSelector('.tabbar', { timeout: 30000 })
await page.locator('.tab', { hasText: 'Train' }).click()

const steps = page.locator('.card', { hasText: 'Missed a day?' }).first()
ok('there is a way to add steps for another day', await steps.waitFor({ timeout: 20000 }).then(() => true, () => false))
// The day list arrives from a query, so wait for it rather than counting an
// empty DOM — the same race that has bitten this suite before.
await steps.locator('.step-day').first().waitFor({ timeout: 20000 })
ok('showing which of the last few days are missing', await steps.locator('.step-day').count() === 7,
  `${await steps.locator('.step-day').count()} days listed`)

await steps.locator('input[type="date"]').fill(backDay)
await steps.locator('input[type="number"]').fill('9412')
await steps.getByRole('button', { name: /Save steps/ }).click()
await page.waitForTimeout(2500)

const { data: row } = await jamie.from('daily_steps').select('steps, day').eq('client_id', jamieId).eq('day', backDay).maybeSingle()
ok('a past day is stored against that date', row?.steps === 9412 && row?.day === backDay, JSON.stringify(row))
ok('and it shows on the list afterwards', /9,412|9412/.test(await steps.innerText()),
  (await steps.innerText()).replace(/\n/g, ' | ').slice(0, 120))

// today's own logging is untouched — Paul asked for that to stay as it is
await page.locator('.tab', { hasText: 'Home' }).click()
await page.waitForSelector('.agenda-card', { timeout: 20000 })
ok('today’s steps are still logged from home', await page.locator('.agenda-item', { hasText: /Steps/i }).count() > 0)

ok('no page errors', errors.length === 0, errors.join(' | '))

await jamie.from('daily_steps').delete().eq('client_id', jamieId).eq('day', backDay)
await browser.close()
console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
