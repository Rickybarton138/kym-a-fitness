import { createClient } from '@supabase/supabase-js'
const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const CODE = '94BA86' // Kim's test coach trainer_code
const stamp = process.argv[2] || 'x'
const email = `mp_${stamp}@e2e.kymafit.app`

// COACH: author a template
const coach = createClient(URL, KEY)
await coach.auth.signInWithPassword({ email: 'kymtest@kymafit.app', password: 'TestPass123' })
const coachId = (await coach.auth.getUser()).data.user.id
const plan = [
  { label: 'Day 1', meals: [{ name: 'Breakfast', detail: 'Oats & berries', kcal: 400 }, { name: 'Lunch', detail: 'Chicken salad', kcal: 500 }] },
  { label: 'Day 2', meals: [{ name: 'Breakfast', detail: 'Eggs on toast', kcal: 450 }] },
]
const tpl = (await coach.from('meal_plans').insert({ coach_id: coachId, title: '5-Day Starter TEST', notes: 'ideas only', plan }).select().single())
console.log('coach create template:', tpl.error ? 'FAIL ' + tpl.error.message : 'OK ' + tpl.data.id.slice(0, 8))

// CLIENT: temp signup under Kim
const cli = createClient(URL, KEY)
const su = await cli.auth.signUp({ email, password: 'TestPass123', options: { data: { role: 'client', full_name: 'MP Test', trainer_code: CODE } } })
if (su.error) { console.log('client signup FAIL', su.error.message); process.exit(1) }
const clientId = su.data.user.id
await new Promise((r) => setTimeout(r, 1200)) // let handle_new_user trigger run

// COACH: assign (copy) to the client
await coach.from('client_meal_plans').update({ active: false }).eq('client_id', clientId).eq('active', true)
const asg = await coach.from('client_meal_plans').insert({ client_id: clientId, coach_id: coachId, source_plan_id: tpl.data.id, title: tpl.data.title, notes: tpl.data.notes, plan: tpl.data.plan, active: true }).select().single()
console.log('coach assign->client:', asg.error ? 'FAIL ' + asg.error.message : 'OK ' + asg.data.id.slice(0, 8))

// CLIENT: read own active plan (RLS client_id = auth.uid())
const read = await cli.from('client_meal_plans').select('title, plan, active').eq('active', true)
const got = read.data?.[0]
console.log('client reads own plan:', read.error ? 'FAIL ' + read.error.message : (got?.title === '5-Day Starter TEST' ? 'OK "' + got.title + '" (' + got.plan.length + ' days)' : 'FAIL wrong/none'))

// RLS NEGATIVE: client must NOT see the coach's template library
const leak = await cli.from('meal_plans').select('id')
console.log('client blocked from templates:', (leak.data || []).length === 0 ? 'OK (none visible)' : 'FAIL leaked ' + leak.data.length)

const pass = !tpl.error && !asg.error && got?.title === '5-Day Starter TEST' && (leak.data || []).length === 0
console.log(pass ? 'E2E PASS ✓' : 'E2E FAIL ✗')
console.log('CLEANUP_IDS', JSON.stringify({ tpl: tpl.data?.id, clientId, email }))
