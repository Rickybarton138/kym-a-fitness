// RLS + data paths for the 26 Aug batch: food_day_complete and lift_entries.
// Real JWTs, not service-role.
import { createClient } from '@supabase/supabase-js'
const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }
const as = async (email) => {
  const c = createClient(URL, KEY)
  const { error } = await c.auth.signInWithPassword({ email, password: 'TestPass123' })
  if (error) throw new Error(`${email}: ${error.message}`)
  return c
}

const jamie = await as('jamie@redefine.app')
const jamieId = (await jamie.auth.getUser()).data.user.id
const ollie = await as('ollie@redefine.app')
const ollieId = (await ollie.auth.getUser()).data.user.id
const paul = await as('paul@redefine.app')
const today = new Date().toISOString().slice(0, 10)

// --- food_day_complete ------------------------------------------------------
await jamie.from('food_day_complete').delete().eq('client_id', jamieId)

const mark = await jamie.from('food_day_complete').upsert({ client_id: jamieId, day: today })
ok('client marks the day complete', !mark.error, mark.error?.message)

const again = await jamie.from('food_day_complete').upsert({ client_id: jamieId, day: today })
ok('marking twice is idempotent', !again.error, again.error?.message)
const rows = await jamie.from('food_day_complete').select('*').eq('client_id', jamieId)
ok('one row per day', rows.data?.length === 1, `${rows.data?.length} rows`)

const coachSees = await paul.from('food_day_complete').select('day').eq('client_id', jamieId)
ok('coach can read it', coachSees.data?.length === 1, coachSees.error?.message)

const coachWrite = await paul.from('food_day_complete').upsert({ client_id: jamieId, day: '2020-01-01' })
ok('coach cannot mark it for them', !!coachWrite.error, coachWrite.error?.message)

const nosy = await ollie.from('food_day_complete').select('day').eq('client_id', jamieId)
ok('another client cannot read it', (nosy.data || []).length === 0)

const undo = await jamie.from('food_day_complete').delete().eq('client_id', jamieId).eq('day', today)
ok('client can undo', !undo.error, undo.error?.message)

// --- lift_entries -----------------------------------------------------------
await jamie.from('lift_entries').delete().eq('client_id', jamieId)

const back = await jamie.from('lift_entries').insert({ client_id: jamieId, name: 'Back Squat', weight: 60, performed_on: '2024-03-01' })
ok('client backdates a lift', !back.error, back.error?.message)

const coachAdd = await paul.from('lift_entries').insert({ client_id: jamieId, name: 'Bench Press', weight: 40, performed_on: '2024-03-02' })
ok('coach can add for their client', !coachAdd.error, coachAdd.error?.message)

const mine = await jamie.from('lift_entries').select('*').eq('client_id', jamieId).order('performed_on')
ok('client sees both', mine.data?.length === 2, `${mine.data?.length}`)
ok('date is kept as entered', mine.data?.[0]?.performed_on === '2024-03-01', mine.data?.[0]?.performed_on)

const foreign = await jamie.from('lift_entries').insert({ client_id: ollieId, name: 'Hack', weight: 1, performed_on: today })
ok('cannot write for another client', !!foreign.error, foreign.error?.message)

const peek = await ollie.from('lift_entries').select('id').eq('client_id', jamieId)
ok('another client cannot read', (peek.data || []).length === 0)

// merge behaviour: a backdated point must sort BEFORE recent plan history
const { aggregateLifts } = await import('../src/lifts.js')
const plans = [{ created_at: '2026-08-01T10:00:00Z', exercises: [{ name: 'Back Squat', sets: [{ weight: '100' }] }] }]
const agg = aggregateLifts(plans, [{ name: 'Back Squat', weight: 60, performed_on: '2024-03-01' }])
const squat = agg.find((l) => l.name === 'Back Squat')
ok('backdated weight becomes the start', squat?.start === 60, `start=${squat?.start}`)
ok('recent weight stays the latest', squat?.latest === 100, `latest=${squat?.latest}`)

// lastSetsByName must be untouched by manual entries (it reads plans only)
const { lastSetsByName } = await import('../src/lifts.js')
const last = lastSetsByName(plans)
ok('"last time" still reads plans only', last['back squat']?.sets?.[0]?.weight === '100')

await jamie.from('lift_entries').delete().eq('client_id', jamieId)
await paul.from('lift_entries').delete().eq('client_id', jamieId)
const left = await jamie.from('lift_entries').select('id').eq('client_id', jamieId)
ok('cleanup', (left.data || []).length === 0)

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
