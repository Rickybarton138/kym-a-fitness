// Symptoms of a broken app, read straight out of the live data.
//
// Ricky, 7 Sept: "HOW DO WE FIND AND FIX THEM BEFORE THEY ARE FOUND BY USERS?"
//
// Almost every fault this week was already visible here before anyone reported
// it. Ryan had been stuck on the signup screen for five days. Katie's duplicate
// sessions were the fingerprint of a save that hung. A day_map shorter than the
// week's sessions is what hid K-Jo's legs day. None of it needed a bug report —
// only somebody looking.
//
// Run: node tasks/health_check.mjs [--coach "Paul Andrews"]
import { createClient } from '@supabase/supabase-js'

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const COACH_EMAIL = process.env.HEALTH_COACH_EMAIL || 'paul@redefine.app'
const COACH_PW = process.env.HEALTH_COACH_PW || 'TestPass123'

const db = createClient(SUPA, KEY)
const { error: authErr } = await db.auth.signInWithPassword({ email: COACH_EMAIL, password: COACH_PW })
if (authErr) { console.error('Could not sign in as the coach:', authErr.message); process.exit(2) }
const coachId = (await db.auth.getUser()).data.user.id

const findings = []
const flag = (level, what, detail) => findings.push({ level, what, detail })

const { data: allClients } = await db.from('profiles')
  .select('id, full_name, created_at, onboarded_at, membership_tier')
  .eq('trainer_id', coachId)
// Test fixtures are not people. Left in, they generate exactly the alerts this
// is meant to surface and the real ones get lost among them.
const clients = (allClients || []).filter((c) => !/^E2E |^Paul \(Test\)$/i.test(c.full_name || ''))
const byId = new Map((clients || []).map((c) => [c.id, c]))
const name = (id) => byId.get(id)?.full_name || id.slice(0, 8)

// 1. Stuck on the way in. Nobody reports this: they just never arrive.
const dayAgo = Date.now() - 864e5
for (const c of clients) {
  if (!c.onboarded_at && new Date(c.created_at).getTime() < dayAgo) {
    const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 864e5)
    flag('high', 'Never finished signing up', `${c.full_name} — ${days} day${days === 1 ? '' : 's'} stuck`)
  }
}

// 2. The same session logged twice in a day: the fingerprint of a save that
//    failed silently and was started again.
const { data: plans } = await db.from('workout_plans')
  .select('client_id, title, created_at')
  .in("client_id", clients.map((c) => c.id))
  .gte('created_at', new Date(Date.now() - 14 * 864e5).toISOString())
const seen = new Map()
for (const p of plans || []) {
  const k = `${p.client_id}|${p.title}|${String(p.created_at).slice(0, 10)}`
  seen.set(k, (seen.get(k) || 0) + 1)
}
for (const [k, n] of seen) {
  if (n > 1) {
    const [cid, title, day] = k.split('|')
    flag('high', 'Same session started twice in a day', `${name(cid)} — "${title}" x${n} on ${day} (a save may have failed)`)
  }
}

// 3. A day_map shorter than the week's sessions strands the rest — this is
//    exactly what hid K-Jo's legs day.
const { data: asgs } = await db.from('client_programs')
  .select('client_id, day_map, program_id, workout_programs(title)')
  .in("client_id", clients.map((c) => c.id)).eq('active', true)
for (const a of asgs || []) {
  if (!a.day_map || !a.day_map.length) continue
  const { count } = await db.from('program_sessions')
    .select('id', { count: 'exact', head: true }).eq('program_id', a.program_id).eq('week', 1)
  if (count && a.day_map.length < count) {
    flag('medium', 'Fewer training days than sessions',
      `${name(a.client_id)} — "${a.workout_programs?.title}" has ${count} sessions in week 1 but ${a.day_map.length} day(s) picked`)
  }
}

// 4. Signed up, onboarded, and then nothing at all.
for (const c of clients) {
  if (!c.onboarded_at) continue
  const since = new Date(Date.now() - 10 * 864e5).toISOString()
  const [w, f] = await Promise.all([
    db.from('workout_completions').select('id', { count: 'exact', head: true }).eq('client_id', c.id).gte('created_at', since),
    db.from('nutrition_logs').select('id', { count: 'exact', head: true }).eq('client_id', c.id).gte('logged_at', since),
  ])
  if ((w.count || 0) === 0 && (f.count || 0) === 0 && new Date(c.onboarded_at).getTime() < Date.now() - 3 * 864e5) {
    flag('low', 'No activity in 10 days', c.full_name)
  }
}

// 5. On a plan whose sessions have run out, so their agenda is quietly empty.
for (const a of asgs || []) {
  const { count } = await db.from('program_sessions')
    .select('id', { count: 'exact', head: true }).eq('program_id', a.program_id)
  if (!count) flag('high', 'On a program with no sessions in it', `${name(a.client_id)} — "${a.workout_programs?.title}"`)
}

// 6. Anything shared with every client by accident (the 30 Aug leak's shape).
const { data: shared } = await db.from('workout_templates')
  .select('title, visible_to_clients, audience_tag').eq('coach_id', coachId)
const open = (shared || []).filter((t) => t.visible_to_clients !== false && !t.audience_tag)
if (open.length > 6) {
  flag('medium', 'Many sessions shared with every client',
    `${open.length} templates visible to everyone — check that is deliberate`)
}

const order = { high: 0, medium: 1, low: 2 }
findings.sort((a, b) => order[a.level] - order[b.level])

const label = { high: 'NEEDS A LOOK', medium: 'WORTH CHECKING', low: 'FYI' }
console.log(`\nHealth check — ${COACH_EMAIL} — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`)
console.log(`${clients.length} clients\n`)
if (!findings.length) {
  console.log('Nothing showing.')
} else {
  let last = ''
  for (const f of findings) {
    if (f.level !== last) { console.log(`\n${label[f.level]}`); last = f.level }
    console.log(`  ${f.what}: ${f.detail}`)
  }
}
console.log('')
process.exit(findings.some((f) => f.level === 'high') ? 1 : 0)
