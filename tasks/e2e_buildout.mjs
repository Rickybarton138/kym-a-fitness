import { createClient } from '@supabase/supabase-js'
const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
// mirror of the app helpers
const DOW_SPREAD = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] }
const daySpread = (n) => DOW_SPREAD[Math.min(Math.max(n, 1), 6)] || DOW_SPREAD[3]
function progressExercises(list, week, deload) {
  const b = (week - 1) % 4
  return (list || []).map((e) => { const sets = e.sets || 3; const out = { name: e.name, sets, reps: e.reps }; if (deload) { out.sets = Math.max(2, sets - 1); if (e.rpe) out.rpe = Math.max(6, e.rpe - 2) } else if (e.rpe) out.rpe = Math.min(10, e.rpe + b); return out })
}

const c = createClient(URL, KEY)
await c.auth.signInWithPassword({ email: 'kymtest@kymafit.app', password: 'TestPass123' })
const coachId = (await c.auth.getUser()).data.user.id
const prog = (await c.from('workout_programs').insert({ coach_id: coachId, title: 'BUILDOUT TEST', weeks: 4 }).select().single()).data
await c.from('program_sessions').insert([
  { program_id: prog.id, position: 0, week: 1, dow: 1, title: 'Upper', focus: 'Push', exercises: [{ name: 'Bench', sets: 4, reps: '8', rpe: 7 }] },
  { program_id: prog.id, position: 1, week: 1, dow: 3, title: 'Lower', focus: 'Legs', exercises: [{ name: 'Squat', sets: 4, reps: '8', rpe: 7 }] },
])

// replicate buildOutWeeks
const base = (await c.from('program_sessions').select('*').eq('program_id', prog.id).order('position')).data.filter((s) => (s.week || 1) === 1)
const weeksN = prog.weeks, fallback = daySpread(base.length), rows = []
let pos = 0
for (let wk = 1; wk <= weeksN; wk++) {
  const deload = weeksN >= 4 && wk % 4 === 0
  base.forEach((s, i) => rows.push({ program_id: prog.id, position: pos++, week: wk, dow: s.dow ?? fallback[i] ?? null, label: `Week ${wk}`, title: s.title, focus: deload ? `Deload — ${s.focus}` : s.focus, exercises: progressExercises(s.exercises, wk, deload), finisher: null }))
}
await c.from('program_sessions').delete().eq('program_id', prog.id)
await c.from('program_sessions').insert(rows)

const after = (await c.from('program_sessions').select('week, dow, title, focus, exercises').eq('program_id', prog.id).order('week').order('position')).data
const weeks = [...new Set(after.map((s) => s.week))].sort((a, b) => a - b)
const w1bench = after.find((s) => s.week === 1 && s.title === 'Upper').exercises[0]
const w3bench = after.find((s) => s.week === 3 && s.title === 'Upper').exercises[0]
const w4 = after.find((s) => s.week === 4)
console.log('total rows:', after.length, '(expect 8)')
console.log('weeks:', weeks.join(','))
console.log('days wk1:', after.filter((s) => s.week === 1).map((s) => s.dow).join('/'))
console.log('Bench RPE wk1/wk3:', w1bench.rpe, '/', w3bench.rpe)
console.log('wk4 deload focus:', w4.focus, '| sets:', w4.exercises[0].sets)
const pass = after.length === 8 && weeks.join(',') === '1,2,3,4' && w1bench.rpe === 7 && w3bench.rpe === 9 && w4.focus.startsWith('Deload') && w4.exercises[0].sets === 3
console.log(pass ? 'E2E PASS' : 'E2E FAIL')
await c.from('workout_programs').delete().eq('id', prog.id)
console.log('cleaned up')
