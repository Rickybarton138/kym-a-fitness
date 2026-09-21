// Printable client progress report. Fetches the client's data and opens a clean,
// print-optimised page — the coach uses the browser's "Save as PDF" to export or
// share it. No PDF dependency; the print stylesheet does the work.
import { supabase } from './supabaseClient.js'
import { aggregateLifts } from './lifts.js'
import { THEME } from './themes.js'
import { TEST_BY_KEY } from './perfTests.js'
import { MEASURE_SITES } from './ui.jsx'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const num = (v) => (v == null || v === '' ? '—' : v)

export async function printClientReport(client) {
  const accent = THEME.vars?.['--accent'] || '#111'
  const brand = THEME.name || 'Coaching'
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const [{ data: mt }, { data: bm }, { data: plans }, { data: tests }] = await Promise.all([
    supabase.from('macro_targets').select('*').eq('client_id', client.id).maybeSingle(),
    supabase.from('body_measurements').select('*').eq('client_id', client.id).order('measured_at', { ascending: true }),
    supabase.from('workout_plans').select('exercises, created_at').eq('client_id', client.id),
    supabase.from('performance_tests').select('test_key, value, tested_on').eq('client_id', client.id),
  ])

  // Body: latest weight + change since first.
  let bodyRows = ''
  if (bm && bm.length) {
    const first = bm[0], last = bm[bm.length - 1]
    const delta = (first.weight_kg != null && last.weight_kg != null) ? (last.weight_kg - first.weight_kg) : null
    const dtxt = delta == null ? '' : ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg since ${new Date(first.measured_at).toLocaleDateString('en-GB')})`
    bodyRows = `<tr><td>Weight</td><td>${num(last.weight_kg)} kg${esc(dtxt)}</td></tr>`
    if (last.body_fat != null) bodyRows += `<tr><td>Body fat</td><td>${num(last.body_fat)}%</td></tr>`
    // From the shared list, not a second copy of it. This WAS a hand-written
    // duplicate, so adding shoulders and calf would have put them on the client's
    // screen and the coach's view and silently left them off the printed report —
    // which is the one a client actually takes away.
    for (const s of MEASURE_SITES) {
      if (last[s.key] != null) bodyRows += `<tr><td>${esc(s.label)}</td><td>${num(last[s.key])} cm</td></tr>`
    }
  }

  // Strength: best lift per exercise, top 8 by frequency.
  const lifts = aggregateLifts(plans || []).filter((l) => l.best != null).slice(0, 8)
  const liftRows = lifts.map((l) => `<tr><td>${esc(l.name)}</td><td>${l.best} kg</td><td>${l.count} session${l.count === 1 ? '' : 's'}</td></tr>`).join('')

  // Tests: best value per test_key.
  const byTest = {}
  ;(tests || []).forEach((t) => {
    const info = TEST_BY_KEY[t.test_key]
    if (!info) return
    const v = Number(t.value)
    const cur = byTest[t.test_key]
    const better = cur == null || (info.lowerBetter ? v < cur.v : v > cur.v)
    if (better) byTest[t.test_key] = { v, name: info.name, unit: info.unit }
  })
  const testRows = Object.values(byTest).map((t) => `<tr><td>${esc(t.name)}</td><td>${t.v}${esc(t.unit || '')}</td></tr>`).join('')

  const section = (title, head, rows) => rows
    ? `<h2>${esc(title)}</h2><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`
    : ''

  const macros = mt
    ? section('Nutrition targets', ['Metric', 'Target'],
        `<tr><td>Calories</td><td>${num(mt.calories)} kcal</td></tr>` +
        `<tr><td>Protein</td><td>${num(mt.protein_g)} g</td></tr>` +
        `<tr><td>Carbs</td><td>${num(mt.carbs_g)} g</td></tr>` +
        `<tr><td>Fat</td><td>${num(mt.fat_g)} g</td></tr>`)
    : ''

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(client.full_name || 'Client')} — progress report</title>
<style>
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; }
  .head { border-bottom: 3px solid ${accent}; padding-bottom: 14px; margin-bottom: 24px; }
  .brand { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: ${accent}; font-weight: 800; }
  h1 { font-size: 26px; margin: 6px 0 2px; }
  .sub { color: #666; font-size: 13px; }
  h2 { font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: ${accent}; margin: 26px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #888; border-bottom: 1px solid #ddd; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; }
  td:first-child { color: #444; }
  .empty { color: #999; font-style: italic; }
  /* opacity, not a colour property: the britfix hook rewrites that word on
     every save and CSS has no such property, so the rule was dead. */
  .foot { margin-top: 34px; padding-top: 12px; border-top: 1px solid #eee; opacity: .55; font-size: 11px; }
  @media print { body { padding: 0; } @page { margin: 18mm; } }
</style></head><body>
  <div class="head">
    <div class="brand">${esc(brand)}</div>
    <h1>${esc(client.full_name || 'Client')}</h1>
    <div class="sub">Progress report · ${esc(today)}</div>
  </div>
  ${macros}
  ${section('Body measurements', ['Metric', 'Latest'], bodyRows)}
  ${section('Strength highlights', ['Exercise', 'Best', 'Logged'], liftRows)}
  ${section('Testing', ['Test', 'Best'], testRows)}
  ${(!macros && !bodyRows && !liftRows && !testRows) ? '<p class="empty">No data logged yet.</p>' : ''}
  <div class="foot">Generated by ${esc(brand)} · ${esc(today)}</div>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 350)
}
