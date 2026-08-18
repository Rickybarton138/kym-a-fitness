import { createClient } from '@supabase/supabase-js'
const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const today = new Date().toISOString().slice(0, 10)
const dow = new Date().getDay()

// COACH: build + assign
const c = createClient(URL, KEY)
await c.auth.signInWithPassword({ email: 'paul@elev8u.app', password: 'Elev8uDemo123' })
const coach = (await c.auth.getUser()).data.user.id
const client = (await c.from('profiles').select('id').eq('trainer_id', coach).limit(1)).data?.[0]?.id
const prog = (await c.from('workout_programs').insert({ coach_id: coach, title: 'E2E Multiweek', weeks: 2 }).select().single()).data
await c.from('program_sessions').insert([
  { program_id: prog.id, position: 0, week: 1, dow, title: 'W1 Strength', focus: 'Strength', exercises: [{ name: 'Squat', sets: [{ reps: '5', weight: '100' }] }] },
  { program_id: prog.id, position: 1, week: 2, dow, title: 'W2 Deload', focus: 'Deload', exercises: [{ name: 'Squat', sets: [{ reps: '5', weight: '70' }] }] },
])
await c.from('client_programs').update({ active: false }).eq('client_id', client).eq('active', true)
const asg = (await c.from('client_programs').insert({ client_id: client, coach_id: coach, program_id: prog.id, start_date: today, repeat: true, active: true }).select().single()).data
console.log('coach: program + 2 sessions + assignment created')

// CLIENT: replicate the agenda computation
const a = createClient(URL, KEY)
await a.auth.signInWithPassword({ email: 'chloe@elev8u.app', password: 'Elev8uDemo123' })
const cp = (await a.from('client_programs').select('program_id, start_date, repeat, workout_programs(title)').eq('client_id', client).eq('active', true).order('created_at', { ascending: false }).limit(1)).data?.[0]
const list = (await a.from('program_sessions').select('week, dow, title, focus, exercises, finisher').eq('program_id', cp.program_id)).data || []
const cycleWeeks = list.reduce((mx, s) => Math.max(mx, s.week || 1), 1)
const diffDays = Math.floor((new Date(cp.start_date + 'T00:00:00') - (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()) / 86400000) * -1
let weekNum = Math.floor(Math.max(0, diffDays) / 7) + 1
if (weekNum > cycleWeeks) weekNum = cp.repeat ? ((weekNum - 1) % cycleWeeks) + 1 : null
const sess = weekNum ? list.find((s) => (s.week || 1) === weekNum && s.dow === dow) : null
console.log(`client: cycleWeeks=${cycleWeeks} weekNum=${weekNum} -> todaySession = ${sess ? sess.title : 'NONE'}`)
console.log(sess && sess.title === 'W1 Strength' ? 'E2E PASS ✓' : 'E2E FAIL ✗')

// cleanup
await c.from('client_programs').delete().eq('id', asg.id)
await c.from('workout_programs').delete().eq('id', prog.id) // cascades sessions
console.log('cleaned up')
