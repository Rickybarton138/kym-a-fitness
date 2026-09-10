import { createClient } from '@supabase/supabase-js'
const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const CODE = '94BA86'
const stamp = process.argv[2] || 'x'

const coach = createClient(URL, KEY)
await coach.auth.signInWithPassword({ email: 'kymtest@kymafit.app', password: 'TestPass123' })
const coachId = (await coach.auth.getUser()).data.user.id

async function mkClient(tag) {
  const c = createClient(URL, KEY)
  await c.auth.signUp({ email: `pp_${tag}_${stamp}@e2e.kymafit.app`, password: 'TestPass123', options: { data: { role: 'client', full_name: `PP ${tag}`, trainer_code: CODE } } })
  return c
}
const A = await mkClient('a'); const B = await mkClient('b')
await new Promise((r) => setTimeout(r, 1300))
const aId = (await A.auth.getUser()).data.user.id
const bId = (await B.auth.getUser()).data.user.id

// library program (client_id null) + personal program for A
const lib = (await coach.from('workout_programs').insert({ coach_id: coachId, title: 'LIB TEST', client_id: null, audience_tag: null }).select().single()).data
const per = (await coach.from('workout_programs').insert({ coach_id: coachId, title: 'PERSONAL-A TEST', client_id: aId }).select().single()).data
await coach.from('program_sessions').insert([
  { program_id: lib.id, position: 0, week: 1, title: 'Lib session', exercises: [] },
  { program_id: per.id, position: 0, week: 1, title: 'A-only session', exercises: [] },
])
console.log('coach created lib + personal:', lib && per ? 'OK' : 'FAIL')

// Client A: sees both
const aProgs = (await A.from('workout_programs').select('id, title, client_id')).data || []
const aTitles = aProgs.map((p) => p.title).sort()
console.log('A sees:', JSON.stringify(aTitles))

// Client B: sees ONLY library (not A's personal)
const bProgs = (await B.from('workout_programs').select('id, title')).data || []
const bTitles = bProgs.map((p) => p.title).sort()
console.log('B sees:', JSON.stringify(bTitles))

// Client B: cannot read A's personal program sessions
const bLeakSess = (await B.from('program_sessions').select('id, title').eq('program_id', per.id)).data || []
console.log('B blocked from A-only sessions:', bLeakSess.length === 0 ? 'OK' : 'FAIL leaked ' + bLeakSess.length)

const pass =
  aTitles.includes('LIB TEST') && aTitles.includes('PERSONAL-A TEST') &&
  bTitles.includes('LIB TEST') && !bTitles.includes('PERSONAL-A TEST') &&
  bLeakSess.length === 0
console.log(pass ? 'E2E PASS' : 'E2E FAIL')
console.log('CLEANUP', JSON.stringify({ lib: lib?.id, per: per?.id, aId, bId, emails: [`pp_a_${stamp}@e2e.kymafit.app`, `pp_b_${stamp}@e2e.kymafit.app`] }))
