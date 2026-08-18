import { createClient } from '@supabase/supabase-js'
const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

const s = createClient(URL, KEY)
await s.auth.signInWithPassword({ email: 'paul@elev8u.app', password: 'Elev8uDemo123' })
const me = (await s.auth.getUser()).data.user.id
const { data: clients } = await s.from('profiles').select('id, full_name').eq('trainer_id', me)
const cid = clients?.[0]?.id
const [tpl, prog, rec, comp, food, meas, tests, ci] = await Promise.all([
  s.from('workout_templates').select('id').eq('coach_id', me),
  s.from('workout_programs').select('id, schedule_tasks').eq('coach_id', me),
  s.from('recipes').select('id, tags').eq('coach_id', me),
  s.from('workout_completions').select('id').eq('client_id', cid),
  s.from('nutrition_logs').select('logged_at').eq('client_id', cid),
  s.from('body_measurements').select('id').eq('client_id', cid),
  s.from('performance_tests').select('id').eq('client_id', cid),
  s.from('weekly_checkins').select('id').eq('client_id', cid),
])
const foodDays = new Set((food.data || []).map((r) => r.logged_at.slice(0, 10))).size
console.log(`COACH paul sees: client=${clients?.[0]?.full_name} | templates=${tpl.data.length} programs=${prog.data.length} (sched=${prog.data[0]?.schedule_tasks?.length}) recipes=${rec.data.length}`)
console.log(`  athlete adherence: completions=${comp.data.length} foodDays=${foodDays} measurements=${meas.data.length} hyroxTests=${tests.data.length} checkins=${ci.data.length}`)

const a = createClient(URL, KEY)
const { error: ae } = await a.auth.signInWithPassword({ email: 'chloe@elev8u.app', password: 'Elev8uDemo123' })
const aid = (await a.auth.getUser()).data.user.id
const { data: plans } = await a.from('workout_plans').select('id').eq('client_id', aid)
console.log(`ATHLETE chloe login: ${ae ? 'FAIL ' + ae.message : 'OK'} | own plans=${plans?.length}`)
