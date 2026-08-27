// Data layer for the 27 Aug programme-builder batch: coach_exercises RLS, and
// day_map written by the coach path reading back the same as the client path.
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

const paul = await as('paul@redefine.app')
const paulId = (await paul.auth.getUser()).data.user.id
const jamie = await as('jamie@redefine.app')
const jamieId = (await jamie.auth.getUser()).data.user.id
const kim = await as('kymtest@kymafit.app')
const kimId = (await kim.auth.getUser()).data.user.id

// --- coach_exercises --------------------------------------------------------
await paul.from('coach_exercises').delete().eq('coach_id', paulId).like('name', 'E2E %')

const add = await paul.from('coach_exercises').insert({ coach_id: paulId, created_by: paulId, name: 'E2E Reverse Nordic' })
ok('coach saves a new exercise', !add.error, add.error?.message)

const dupe = await paul.from('coach_exercises').insert({ coach_id: paulId, created_by: paulId, name: 'e2e reverse nordic' })
ok('same name is rejected case-insensitively', !!dupe.error, dupe.error?.code)

const mine = await paul.from('coach_exercises').select('name').eq('coach_id', paulId).like('name', 'E2E %')
ok('coach reads their own list', mine.data?.length === 1)

const clientSees = await jamie.from('coach_exercises').select('name').eq('coach_id', paulId).like('name', 'E2E %')
ok('their client sees it too', clientSees.data?.length === 1, clientSees.error?.message)

const clientAdd = await jamie.from('coach_exercises').insert({ coach_id: paulId, created_by: jamieId, name: 'E2E Client Added' })
ok('client can contribute one', !clientAdd.error, clientAdd.error?.message)

const forged = await jamie.from('coach_exercises').insert({ coach_id: paulId, created_by: paulId, name: 'E2E Forged' })
ok('client cannot forge created_by', !!forged.error, forged.error?.message)

const otherCoach = await kim.from('coach_exercises').select('name').eq('coach_id', paulId).like('name', 'E2E %')
ok('another coach sees nothing of it', (otherCoach.data || []).length === 0, `${otherCoach.data?.length}`)

const steal = await kim.from('coach_exercises').insert({ coach_id: paulId, created_by: kimId, name: 'E2E Steal' })
ok('another coach cannot write to it', !!steal.error, steal.error?.message)

// --- day_map parity ---------------------------------------------------------
// The coach's assign path and the client's self-assign path must produce the
// same shape, or the agenda's day mapping reads one of them wrong.
const { data: prog } = await paul.from('workout_programs').select('id').eq('coach_id', paulId).limit(1)
if (prog?.[0]) {
  await paul.from('client_programs').update({ active: false }).eq('client_id', jamieId).eq('active', true)
  const coachAsg = await paul.from('client_programs')
    .insert({ client_id: jamieId, coach_id: paulId, program_id: prog[0].id, start_date: '2026-08-31', repeat: true, active: true, day_map: [1, 3, 5] })
    .select('day_map, coach_id').single()
  ok('coach assigns with training days', coachAsg.data?.day_map?.join() === '1,3,5', coachAsg.error?.message)

  const clientReads = await jamie.from('client_programs').select('day_map, coach_id').eq('client_id', jamieId).eq('active', true)
  ok('client reads the same days back', clientReads.data?.[0]?.day_map?.join() === '1,3,5')
  ok('coach_id marks it as coach-assigned', clientReads.data?.[0]?.coach_id === paulId)

  await paul.from('client_programs').delete().eq('client_id', jamieId).eq('start_date', '2026-08-31')
}

// cleanup
await paul.from('coach_exercises').delete().eq('coach_id', paulId).like('name', 'E2E %')
const left = await paul.from('coach_exercises').select('id').eq('coach_id', paulId).like('name', 'E2E %')
ok('cleanup', (left.data || []).length === 0)

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
