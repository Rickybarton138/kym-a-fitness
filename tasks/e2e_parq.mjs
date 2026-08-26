// PAR-Q end-to-end against the live DB with real JWTs (not a service-role
// simulation): client writes their own, coach reads it, another client can't.
// Mirrors exactly the queries in src/parq.js.
import { createClient } from '@supabase/supabase-js'
const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

const PARQ_QUESTIONS = [
  { key: 'heart', text: 'Has a doctor ever said you have a heart condition...' },
  { key: 'joint', text: 'Do you have a bone or joint problem...' },
]
const answers = {
  heart: { yes: false },
  joint: { yes: true, detail: 'Left knee, sore on deep squats' },
}

const as = async (email) => {
  const c = createClient(URL, KEY)
  const { error } = await c.auth.signInWithPassword({ email, password: 'TestPass123' })
  if (error) throw new Error(`${email}: ${error.message}`)
  return c
}
const ok = (label, pass, extra = '') => console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)

const jamie = await as('jamie@redefine.app')
const jamieId = (await jamie.auth.getUser()).data.user.id

// 1. client writes their own PAR-Q (the saveParq() path)
const ins = await jamie.from('parq_responses').insert({
  client_id: jamieId,
  questions: PARQ_QUESTIONS.map((q) => ({ key: q.key, text: q.text })),
  answers,
  any_yes: true,
  medications: 'None',
  injuries: 'Left knee ACL repair 2024',
  declared_name: 'Jamie E2E',
})
ok('client writes own PAR-Q', !ins.error, ins.error?.message)

// 2. client reads it back (the latestParq() path)
const mine = await jamie.from('parq_responses').select('*').eq('client_id', jamieId)
  .order('created_at', { ascending: false }).limit(1)
const row = mine.data?.[0]
ok('client reads own PAR-Q', !!row)
ok('question text snapshotted', row?.questions?.length === 2 && !!row.questions[0].text)
ok('flagged answer round-trips', row?.answers?.joint?.yes === true && row.answers.joint.detail.includes('knee'))

// 3. client cannot write for someone else
const ollie = await as('ollie@redefine.app')
const ollieId = (await ollie.auth.getUser()).data.user.id
const bad = await jamie.from('parq_responses').insert({ client_id: ollieId, questions: [], answers: {} })
ok('cross-client write blocked', !!bad.error, bad.error?.message)

// 4. another client of the same coach can't read it
const peek = await ollie.from('parq_responses').select('id').eq('client_id', jamieId)
ok('other client cannot read', (peek.data || []).length === 0)

// 5. the coach can
const paul = await as('paul@redefine.app')
const coachView = await paul.from('parq_responses').select('*').eq('client_id', jamieId)
  .order('created_at', { ascending: false }).limit(1)
ok('coach reads client PAR-Q', (coachView.data || []).length === 1, coachView.error?.message)
ok('coach sees the flag', coachView.data?.[0]?.any_yes === true)

// 6. append-only in practice: a second submission doesn't replace the first
await jamie.from('parq_responses').insert({
  client_id: jamieId, questions: PARQ_QUESTIONS.map((q) => ({ key: q.key, text: q.text })),
  answers: { heart: { yes: false }, joint: { yes: false } }, any_yes: false, declared_name: 'Jamie E2E 2',
})
const hist = await jamie.from('parq_responses').select('id, any_yes, created_at').eq('client_id', jamieId)
  .order('created_at', { ascending: false })
ok('history kept (2 rows)', hist.data?.length === 2)
ok('latest is the newest', hist.data?.[0]?.any_yes === false)

// cleanup
const del = await jamie.from('parq_responses').delete().eq('client_id', jamieId)
ok('cleanup', !del.error, del.error?.message)
const left = await jamie.from('parq_responses').select('id').eq('client_id', jamieId)
ok('no test rows left', (left.data || []).length === 0)
