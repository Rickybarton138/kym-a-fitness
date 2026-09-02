// Before/after for the exercise-demo matcher, over every name the app can ask
// for: the stock catalogue plus every exercise Paul has created.
// Run: node tasks/match_report.mjs [--all]
import { createClient } from '@supabase/supabase-js'
import { buildLibrary, matchOne, nameKey, LIB_JSON } from '../netlify/functions/_exercise-match.mjs'
import { EXERCISE_GROUPS } from '../src/exercises.js'

const arr = await (await fetch(LIB_JSON)).json()
const lib = buildLibrary(arr)

// ---- the matcher as it shipped, to compare against ----
const GOOD = ['barbell', 'dumbbell', 'bodyweight', 'cable', 'kettlebell']
const BAD = ['machine', 'smith', 'lever', 'sled', 'car', 'band', 'assisted', 'roller']
const oldLib = arr.map((e) => ({ name: e.name, key: nameKey(e.name), tokens: nameKey(e.name).split(' ') }))
function old(name) {
  const key = nameKey(name)
  const exact = oldLib.find((e) => e.key === key)
  if (exact) return exact.name
  const q = key.split(' ').filter(Boolean)
  if (!q.length) return null
  const move = q[q.length - 1]
  let best = null, bs = -1
  for (const e of oldLib) {
    const shared = q.filter((t) => e.tokens.includes(t)).length
    if (shared === 0 || !e.tokens.includes(move)) continue
    let s = shared * 10 - Math.abs(e.tokens.length - q.length)
    if (e.tokens.some((t) => t === 'barbell' || t === 'dumbbell')) s += 5
    else if (e.tokens.some((t) => GOOD.includes(t))) s += 2
    if (e.tokens.some((t) => BAD.includes(t))) s -= 5
    if (s > bs) { bs = s; best = e }
  }
  return best ? best.name : null
}

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const api = createClient(SUPA, KEY)
await api.auth.signInWithPassword({ email: 'paul@redefine.app', password: 'TestPass123' })
const { data: custom } = await api.from('coach_exercises').select('name')

const names = [
  ...EXERCISE_GROUPS.flatMap((g) => g.options).map((n) => ({ n, src: 'catalogue' })),
  ...(custom || []).map((c) => ({ n: c.name, src: 'Paul' })),
]

const showAll = process.argv.includes('--all')
let changed = 0, nowNone = 0, stillMatched = 0, exact = 0
const rows = []
for (const { n, src } of names) {
  const o = old(n)
  const r = matchOne(n, lib)
  const nw = r.name
  if (r.score === Infinity) exact++
  if (nw) stillMatched++; else nowNone++
  const diff = (o || '(none)') !== (nw || '(none)')
  if (diff) changed++
  if (diff || showAll) rows.push({ src, n, o: o || '(none)', nw: nw || '(none)', rej: r.rejected || '' })
}

const w = (s, k) => String(s).slice(0, k).padEnd(k)
console.log(w('SOURCE', 10) + w('EXERCISE', 34) + w('WAS SHOWING', 32) + 'NOW')
console.log('-'.repeat(110))
for (const r of rows) {
  console.log(w(r.src, 10) + w(r.n, 34) + w(r.o, 32) + (r.nw === '(none)' ? `(no image — closest was ${r.rej})` : r.nw))
}
console.log('-'.repeat(110))
console.log(`${names.length} names · ${exact} exact · ${stillMatched} with a demo · ${nowNone} now show no demo · ${changed} changed`)
