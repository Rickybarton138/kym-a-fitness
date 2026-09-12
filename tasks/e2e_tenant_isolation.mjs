// Cross-tenant isolation, asserted rather than assumed. (2026-09-12)
//
// Nothing tested this before, which is why a client could set their own
// trainer_id — and therefore my_trainer_id(), and therefore which coach's
// recipes, videos, programmes, files and community posts they could read —
// from the browser console. In a white-label product where five coaches share
// one database, that boundary is the product.
//
// Runs entirely as a real client, with the publishable key and their own JWT:
// exactly what a determined user has. It restores anything it manages to change
// and fails loudly if a restore does not land.
//
// Run: node tasks/e2e_tenant_isolation.mjs
import { createClient } from '@supabase/supabase-js'

const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const c = createClient(SUPA, KEY)
const { error: authErr } = await c.auth.signInWithPassword({ email: 'ollie@redefine.app', password: 'TestPass123' })
if (authErr) { console.error('sign-in failed:', authErr.message); process.exit(1) }
const me = (await c.auth.getUser()).data.user.id

const COLS = 'membership_tier, role, trainer_id, active, trainer_code, step_target'
const { data: before } = await c.from('profiles').select(COLS).eq('id', me).single()

// A write is "blocked" if it errors OR silently changes nothing. Column-level
// grants produce an error; a future trigger-based fix might not. Either is fine
// — what matters is that the value does not move.
async function blocked(col, value) {
  const { error } = await c.from('profiles').update({ [col]: value }).eq('id', me)
  const { data: now } = await c.from('profiles').select(col).eq('id', me).single()
  const moved = now && JSON.stringify(now[col]) === JSON.stringify(value)
  return { pass: !moved, detail: error ? error.message.slice(0, 60) : moved ? 'WRITE LANDED' : 'no error, no change' }
}

// --- the three escalations, in ascending order of seriousness ---------------
let r = await blocked('membership_tier', 'inner_circle')
ok('a client cannot put themselves on the paid tier', r.pass, r.detail)

r = await blocked('role', 'trainer')
ok('a client cannot promote themselves to coach', r.pass, r.detail)

// A REAL other coach with REAL content. Two ways this assertion can lie:
//   - an all-zeros uuid fails the foreign key, so the write is refused for the
//     wrong reason and the column was writable all along;
//   - the target coach has no recipes, so "nothing leaked" is vacuously true.
// The first run of this test hit both. Selina (Elev8u) is a different gym with
// seeded recipes, and the control below proves the query can see anything at all.
const OTHER_COACH = '94651c2d-6b60-441b-b447-4de581cb73bd' // Selina, Elev8u
const MY_COACH = before.trainer_id

r = await blocked('trainer_id', OTHER_COACH)
ok('a client cannot re-point at another coach', r.pass, r.detail)

// Control: the same query against their OWN coach must return rows. Without
// this, a broken query or an empty library would read as "no leak".
const { data: mine } = await c.from('recipes').select('id').eq('coach_id', MY_COACH).limit(5)
ok('control: they can see their own coach’s recipes', (mine || []).length > 0,
  `${(mine || []).length} visible`)

// The consequence, not just the column: whatever trainer_id says now, the other
// gym's library must stay invisible.
const { data: leaked } = await c.from('recipes').select('id, title').eq('coach_id', OTHER_COACH).limit(5)
ok('and cannot read the other gym’s recipes', (leaked || []).length === 0,
  (leaked || []).length ? `${leaked.length} LEAKED: ${leaked.map((x) => x.title).join(', ').slice(0, 60)}` : '')

r = await blocked('active', false)
ok('a client cannot touch the gym kill switch', r.pass, r.detail)

r = await blocked('trainer_code', 'HACKED')
ok('a client cannot mint a join code', r.pass, r.detail)

r = await blocked('step_target', 99999)
ok('a client cannot override the target their coach set', r.pass, r.detail)

// --- and the writes that must still work ------------------------------------
// If the lock-down is too tight, onboarding breaks for every brand, so the
// exact payloads the app sends are asserted here too.
const { data: keep } = await c.from('profiles')
  .select('sex, age, height_cm, activity_level, goal, nutrition_style, health_conditions, has_kids, single_parent, shift_worker, life_context_note, onboarded_at, targets_reviewed_at, nutrition_sensitive, nutrition_sensitive_note, full_name')
  .eq('id', me).single()

const onboardingPayload = {
  sex: keep.sex || 'male', age: 33, height_cm: 180, activity_level: keep.activity_level || 'moderate',
  goal: keep.goal || 'lose', onboarded_at: keep.onboarded_at || new Date().toISOString(),
  nutrition_sensitive: false, nutrition_sensitive_note: null,
  health_conditions: 'e2e isolation probe', has_kids: false, single_parent: false,
  shift_worker: false, life_context_note: null,
}
const { error: obErr } = await c.from('profiles').update(onboardingPayload).eq('id', me)
ok('onboarding can still write its whole payload', !obErr, obErr ? obErr.message : '')

const { error: nsErr } = await c.from('profiles').update({ nutrition_style: keep.nutrition_style || 'lifestyle' }).eq('id', me)
ok('nutrition style still saves', !nsErr, nsErr ? nsErr.message : '')

const { error: trErr } = await c.from('profiles').update({ targets_reviewed_at: new Date().toISOString() }).eq('id', me)
ok('the targets-reviewed stamp still saves', !trErr, trErr ? trErr.message : '')

const { error: fnErr } = await c.from('profiles').update({ full_name: keep.full_name }).eq('id', me)
ok('a client can still set their own display name', !fnErr, fnErr ? fnErr.message : '')

// --- restore -----------------------------------------------------------------
// BOTH sets. The first run of this test restored `keep` only and left the demo
// account sitting on role='trainer', tier='inner_circle', active=false — which
// is exactly the damage it was written to prove was possible. A test that can
// break something must put it back, and must say so if it cannot.
await c.from('profiles').update(keep).eq('id', me)
await c.from('profiles').update(before).eq('id', me)
const { data: after } = await c.from('profiles').select(COLS).eq('id', me).single()
ok('coach-controlled columns are exactly as found', JSON.stringify(after) === JSON.stringify(before),
  JSON.stringify(after))

const { data: keptAfter } = await c.from('profiles').select('health_conditions, age, height_cm').eq('id', me).single()
ok('client-owned columns restored too', keptAfter.health_conditions === keep.health_conditions,
  JSON.stringify(keptAfter))

console.log(failures ? `\n${failures} FAILED` : '\nAll passed')
process.exit(failures ? 1 : 0)
