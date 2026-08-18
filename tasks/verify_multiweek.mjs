import { createClient } from '@supabase/supabase-js'
const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const s = createClient(URL, KEY)
await s.auth.signInWithPassword({ email: 'paul@elev8u.app', password: 'Elev8uDemo123' })
const me = (await s.auth.getUser()).data.user.id

// new columns on program_sessions
const ps = await s.from('program_sessions').select('id, week, dow').limit(1)
console.log('program_sessions.week/dow:', ps.error ? 'FAIL ' + ps.error.message : 'OK')

// client_programs table + coach insert/select under RLS
const client = (await s.from('profiles').select('id').eq('trainer_id', me).limit(1)).data?.[0]?.id
const prog = (await s.from('workout_programs').select('id').eq('coach_id', me).limit(1)).data?.[0]?.id
if (client && prog) {
  const ins = await s.from('client_programs').insert({ client_id: client, coach_id: me, program_id: prog, start_date: new Date().toISOString().slice(0, 10), repeat: true }).select().single()
  console.log('client_programs insert:', ins.error ? 'FAIL ' + ins.error.message : 'OK (' + ins.data.id.slice(0, 8) + ')')
  if (ins.data) { await s.from('client_programs').delete().eq('id', ins.data.id); console.log('cleaned up') }
} else console.log('no client/prog to test insert (client=' + client + ' prog=' + prog + ')')
