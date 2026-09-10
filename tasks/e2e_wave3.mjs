import { createClient } from '@supabase/supabase-js'
const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const CODE = '94BA86'
const stamp = process.argv[2] || 'x'
const email = `w3_${stamp}@e2e.kymafit.app`

const coach = createClient(URL, KEY)
await coach.auth.signInWithPassword({ email: 'kymtest@kymafit.app', password: 'TestPass123' })
const coachId = (await coach.auth.getUser()).data.user.id

const cli = createClient(URL, KEY)
const su = await cli.auth.signUp({ email, password: 'TestPass123', options: { data: { role: 'client', full_name: 'W3 Test', trainer_code: CODE } } })
if (su.error) { console.log('signup FAIL', su.error.message); process.exit(1) }
const clientId = su.data.user.id
await new Promise((r) => setTimeout(r, 1200))

// #26 coach adds a holiday event for the client (RLS is_my_client)
const ev = await coach.from('client_events').insert({ client_id: clientId, coach_id: coachId, kind: 'holiday', label: 'Spain TEST', start_date: '2026-08-01', end_date: '2026-08-31' }).select().single()
console.log('coach add event:', ev.error ? 'FAIL ' + ev.error.message : 'OK')
// client reads own events
const cev = await cli.from('client_events').select('label').eq('client_id', clientId)
console.log('client reads own event:', cev.error ? 'FAIL ' + cev.error.message : (cev.data?.[0]?.label === 'Spain TEST' ? 'OK' : 'FAIL none'))

// #28 client logs a period start; coach reads it (is_my_client)
const cl = await cli.from('cycle_logs').insert({ client_id: clientId, period_start: '2026-07-20' }).select().single()
console.log('client log cycle:', cl.error ? 'FAIL ' + cl.error.message : 'OK')
const ccl = await coach.from('cycle_logs').select('period_start').eq('client_id', clientId)
console.log('coach reads client cycle:', ccl.error ? 'FAIL ' + ccl.error.message : (ccl.data?.[0]?.period_start === '2026-07-20' ? 'OK' : 'FAIL none'))

// #27 coach sets DOB via RPC; then reads it back off the client profile
const rpc = await coach.rpc('set_client_dob', { p_client: clientId, p_dob: '1988-08-06' })
console.log('coach set dob rpc:', rpc.error ? 'FAIL ' + rpc.error.message : 'OK ' + rpc.data)
const prof = await coach.from('profiles').select('dob').eq('id', clientId).maybeSingle()
console.log('dob persisted:', prof.data?.dob === '1988-08-06' ? 'OK' : 'FAIL ' + JSON.stringify(prof.data))

// NEGATIVE: a second temp client must NOT read the first client's cycle logs
const cli2 = createClient(URL, KEY)
const su2 = await cli2.auth.signUp({ email: `w3b_${stamp}@e2e.kymafit.app`, password: 'TestPass123', options: { data: { role: 'client', full_name: 'W3 Other', trainer_code: CODE } } })
await new Promise((r) => setTimeout(r, 800))
const leak = await cli2.from('cycle_logs').select('period_start').eq('client_id', clientId)
console.log('other client blocked from cycle:', (leak.data || []).length === 0 ? 'OK' : 'FAIL leaked')

const pass = !ev.error && cev.data?.[0]?.label === 'Spain TEST' && !cl.error && ccl.data?.[0]?.period_start === '2026-07-20' && !rpc.error && prof.data?.dob === '1988-08-06' && (leak.data || []).length === 0
console.log(pass ? 'E2E PASS' : 'E2E FAIL')
console.log('CLEANUP', JSON.stringify({ clientId, other: su2.data?.user?.id, email }))
