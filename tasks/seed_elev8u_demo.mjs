// Seed two Elev8u coach demo logins (Paul + Selina), each with one linked athlete
// carrying ~2 weeks of realistic history — so the coach dashboard, adherence card,
// Hyrox testing, nutrition and program library all look alive. Uses the app's own
// anon key + signUp/sign-in (email confirmation is off), seeding each row as the
// user who owns it so RLS is satisfied. Safe to read; creates demo data only.
import { createClient } from '@supabase/supabase-js'

const URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

const daysAgoISO = (n, hour = 12) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(hour, 0, 0, 0); return d.toISOString() }
const daysAgoDate = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

const HYROX_TPLS = [
  { title: 'Hyrox Engine', focus: 'Conditioning', exercises: [
    { name: 'SkiErg 1000m', sets: [{ reps: '1', weight: null }], cue: 'Steady pace, full hip drive' },
    { name: 'Sled Push 50m', sets: [{ reps: '2', weight: '75' }], cue: 'Low body, small steps' },
    { name: 'Row 1000m', sets: [{ reps: '1', weight: null }], cue: 'Legs-back-arms' },
    { name: 'Wall Balls (100)', sets: [{ reps: '100', weight: '9' }], cue: 'Full squat, hit the target' },
  ] },
  { title: 'Strength Base', focus: 'Strength', exercises: [
    { name: 'Back Squat (barbell)', sets: [{ reps: '5', weight: '80' }, { reps: '5', weight: '85' }, { reps: '5', weight: '90' }], cue: 'Brace, drive through mid-foot' },
    { name: 'Romanian Deadlift', sets: [{ reps: '8', weight: '70' }, { reps: '8', weight: '70' }], cue: 'Hinge, long hamstrings' },
    { name: "Farmer's Carry", sets: [{ reps: '40', weight: '24' }, { reps: '40', weight: '24' }], cue: 'Tall, brace, quick feet' },
  ] },
]

const RECIPES = [
  { title: 'Chicken & Rice Power Bowl', description: 'Grill chicken, serve over rice with veg and a drizzle of olive oil.', ingredients: ['200g chicken breast', '75g rice (dry)', 'Mixed veg', '1 tsp olive oil'], servings: 1, calories: 560, protein_g: 48, carbs_g: 62, fat_g: 12, fibre_g: 6, serving_label: 'per serving', tags: ['lunch', 'high-protein', 'meal-prep'] },
  { title: 'Overnight Protein Oats', description: 'Mix oats, milk, whey and berries. Chill overnight.', ingredients: ['60g oats', '250ml milk', '1 scoop whey', 'Handful berries'], servings: 1, calories: 420, protein_g: 34, carbs_g: 52, fat_g: 8, fibre_g: 7, serving_label: 'per serving', tags: ['breakfast', 'high-protein', 'quick'] },
  { title: 'Turkey Chilli', description: 'Brown turkey mince, add beans, tomatoes and spices. Simmer.', ingredients: ['500g turkey mince', '1 tin kidney beans', '1 tin chopped tomatoes', 'Chilli spices'], servings: 4, calories: 380, protein_g: 40, carbs_g: 28, fat_g: 10, fibre_g: 9, serving_label: 'per serving', tags: ['dinner', 'high-protein', 'high-fibre', 'budget'] },
]

async function seedCoach({ label, email, pw, fullName, athlete }) {
  const s = createClient(URL, KEY)
  let { data: su, error } = await s.auth.signUp({ email, password: pw, options: { data: { full_name: fullName, role: 'trainer', trainer_code: '' } } })
  if (error && /registered/i.test(error.message)) {
    ({ data: su, error } = await s.auth.signInWithPassword({ email, password: pw }))
  }
  if (error) { console.log(label, 'COACH AUTH FAIL:', error.message); return null }
  if (!su.session) { console.log(label, 'no session (email confirmation ON?) — aborting'); return null }
  const coachId = su.user.id
  // profile + trainer_code (created by trigger)
  let code = null
  for (let i = 0; i < 5 && !code; i++) {
    const { data: p } = await s.from('profiles').select('trainer_code').eq('id', coachId).maybeSingle()
    code = p?.trainer_code || null
    if (!code) await new Promise((r) => setTimeout(r, 400))
  }

  // Coach-owned content
  const { data: tpls } = await s.from('workout_templates').insert(HYROX_TPLS.map((t) => ({ coach_id: coachId, ...t }))).select()
  const { data: prog } = await s.from('workout_programs').insert({
    coach_id: coachId, title: '6-Week Hyrox Build', description: 'Strength base + engine work to get race-ready.',
    weeks: 6, level: 'Intermediate', location: 'gym', equipment: 'full', audience: 'all', goal: 'performance',
    schedule_tasks: [{ kind: 'checkin', dow: 1, cadence: 'weekly' }, { kind: 'measurements', dow: 1, cadence: 'monthly' }],
  }).select().single()
  if (prog && tpls) {
    await s.from('program_sessions').insert(tpls.map((t, i) => ({ program_id: prog.id, position: i, label: `Day ${i + 1}`, title: t.title, focus: t.focus, exercises: t.exercises, finisher: null })))
  }
  await s.from('recipes').insert(RECIPES.map((r) => ({ coach_id: coachId, ...r })))
  const { data: squad } = await s.from('squads').insert({ coach_id: coachId, name: 'Hyrox Squad', sport: 'Hyrox' }).select().single()

  // Athlete
  const a = createClient(URL, KEY)
  let { data: asu, error: aerr } = await a.auth.signUp({ email: athlete.email, password: athlete.pw, options: { data: { full_name: athlete.name, role: 'client', trainer_code: code || '' } } })
  if (aerr && /registered/i.test(aerr.message)) { ({ data: asu, error: aerr } = await a.auth.signInWithPassword({ email: athlete.email, password: athlete.pw })) }
  if (aerr || !asu?.session) { console.log(label, 'ATHLETE AUTH FAIL:', aerr?.message || 'no session'); return { code } }
  const aid = asu.user.id
  await new Promise((r) => setTimeout(r, 600)) // let trigger seed profile + macro targets

  // Nutrition: 2 meals/day for 5 of last 7 days
  const meals = [
    { name: 'Overnight Protein Oats', meal_type: 'Breakfast', calories: 420, protein_g: 34, carbs_g: 52, fat_g: 8, fibre_g: 7 },
    { name: 'Chicken & Rice Power Bowl', meal_type: 'Lunch', calories: 560, protein_g: 48, carbs_g: 62, fat_g: 12, fibre_g: 6 },
  ]
  const foodRows = []
  for (const d of [0, 1, 2, 4, 6]) for (const m of meals) foodRows.push({ client_id: aid, source: 'manual', ...m, logged_at: daysAgoISO(d, m.meal_type === 'Breakfast' ? 8 : 13) })
  await a.from('nutrition_logs').insert(foodRows)

  // Body measurements: 14 days ago and today
  await a.from('body_measurements').insert([
    { client_id: aid, weight_kg: 82.5, body_fat: 18, measured_at: daysAgoISO(14) },
    { client_id: aid, weight_kg: 81.2, body_fat: 17, measured_at: daysAgoISO(0) },
  ])

  // Workout plans (one assigned by coach) + completions in last 7 days
  await a.from('workout_plans').insert([
    { client_id: aid, title: 'Hyrox Engine', focus: 'Conditioning', exercises: HYROX_TPLS[0].exercises, assigned_by: coachId, scheduled_for: daysAgoDate(0) },
    { client_id: aid, title: 'Strength Base', focus: 'Strength', exercises: HYROX_TPLS[1].exercises, assigned_by: coachId, scheduled_for: daysAgoDate(2) },
    { client_id: aid, title: 'Own session', focus: 'Accessories', exercises: HYROX_TPLS[1].exercises, assigned_by: null, scheduled_for: daysAgoDate(5) },
  ])
  await a.from('workout_completions').insert([
    { client_id: aid, source: 'guided', completed_on: daysAgoDate(2) },
    { client_id: aid, source: 'guided', completed_on: daysAgoDate(5) },
  ])

  // Hyrox test results
  await a.from('performance_tests').insert([
    { client_id: aid, test_key: 'hyrox_sim', value: 72, tested_on: daysAgoDate(12) },
    { client_id: aid, test_key: 'hyrox_sim', value: 69, tested_on: daysAgoDate(1) },
    { client_id: aid, test_key: 'run_1k', value: 245, tested_on: daysAgoDate(1) },
  ])

  // A recent check-in
  await a.from('weekly_checkins').insert({ client_id: aid, energy: 4, sleep: 3, nutrition: 4, training: 4, weight_kg: 81.2, wins: 'Hit all my sessions', struggles: 'Sleep a bit low midweek', question: 'Happy with sled technique?' })

  // Add athlete to the squad (coach-owned row)
  if (squad) await s.from('squad_members').insert({ squad_id: squad.id, client_id: aid })

  console.log(`${label}: coach ${email} (code ${code}) + athlete ${athlete.email} seeded OK`)
  return { code }
}

const runs = [
  { label: 'PAUL', email: 'paul@elev8u.app', pw: 'Elev8uDemo123', fullName: 'Paul (Elev8u)', athlete: { email: 'chloe@elev8u.app', pw: 'Elev8uDemo123', name: 'Chloe Adams' } },
  { label: 'SELINA', email: 'selina@elev8u.app', pw: 'Elev8uDemo123', fullName: 'Selina (Elev8u)', athlete: { email: 'marcus@elev8u.app', pw: 'Elev8uDemo123', name: 'Marcus Reid' } },
]
for (const r of runs) { await seedCoach(r) }
console.log('DONE')
