// calisthenics_progress is a new table with new policies, and nothing else
// tests it. The isolation suite covers profiles and coach content; this covers
// the one table this feature added.
//
// Run: node tasks/e2e_calisthenics_rls.mjs
import { createClient } from '@supabase/supabase-js'
const SUPA = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
let fails = 0
const ok = (l, pass, extra = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const sign = async (email) => {
  const c = createClient(SUPA, KEY)
  await c.auth.signInWithPassword({ email, password: 'TestPass123' })
  return [c, (await c.auth.getUser()).data.user.id]
}
const [jamie, jamieId] = await sign('jamie@redefine.app')
const [hannah, hannahId] = await sign('hannah@redefine.app')

const own = await jamie.from('calisthenics_progress').upsert({ client_id: jamieId, skill_key: 'pull', step_index: 3 })
ok('a client can record their own step', !own.error, own.error?.message)

const other = await jamie.from('calisthenics_progress').insert({ client_id: hannahId, skill_key: 'pull', step_index: 8 })
ok('a client cannot write a step onto someone else', !!other.error, other.error?.message || 'IT WENT IN')

const { data: seen } = await hannah.from('calisthenics_progress').select('client_id, skill_key')
ok('another client cannot read it', !(seen || []).some((r) => r.client_id === jamieId), JSON.stringify(seen))

const { data: mine } = await jamie.from('calisthenics_progress').select('step_index').eq('client_id', jamieId)
ok('control: the owner can read it back', (mine || []).length === 1 && mine[0].step_index === 3)

// Same again for the adaptations table: which joints someone trains around is
// theirs, and a coach reads it rather than another client.
const mineAdapt = await jamie.from('calisthenics_adaptations').upsert({ client_id: jamieId, adaptation: 'knees' })
ok('a client can record their own adaptation', !mineAdapt.error, mineAdapt.error?.message)

const otherAdapt = await jamie.from('calisthenics_adaptations').insert({ client_id: hannahId, adaptation: 'wrists' })
ok('a client cannot set an adaptation on someone else', !!otherAdapt.error, otherAdapt.error?.message || 'IT WENT IN')

const { data: seenAdapt } = await hannah.from('calisthenics_adaptations').select('client_id, adaptation')
ok('another client cannot read their adaptations', !(seenAdapt || []).some((r) => r.client_id === jamieId), JSON.stringify(seenAdapt))

await jamie.from('calisthenics_adaptations').delete().eq('client_id', jamieId)
await jamie.from('calisthenics_progress').delete().eq('client_id', jamieId)
console.log(fails ? `\n${fails} FAILED` : '\nAll passed')
process.exit(fails ? 1 : 0)
