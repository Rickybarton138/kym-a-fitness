// Fixtures for the coaching tests.
//
// Hand-built rows in the shape the real tables return, verified against the live
// schema's column names and types. Nothing here touches a database: the brief
// forbids writing test activity to production, and a fixture is a better test
// anyway because the awkward states — a day with no step reading, a session
// started but never finished — can be written down exactly.

export const CLIENT = '11111111-1111-1111-1111-111111111111'
export const OTHER = '22222222-2222-2222-2222-222222222222'
export const COACH = '33333333-3333-3333-3333-333333333333'

export const TODAY = '2026-10-07'       // a Wednesday
export const NOON = '2026-10-07T11:00:00Z' // 12:00 London (BST)

export const profile = {
  id: CLIENT,
  full_name: 'Test Person',
  goal: 'lose',
  activity_level: 'moderate',
  nutrition_style: 'detail',
  health_conditions: 'allergic to shellfish; dodgy left knee',
  nutrition_sensitive_note: null,
  life_context_note: null,
  step_target: 10000,
  water_target_ml: 2500,
  trainer_id: COACH,
}

export const targets = {
  client_id: CLIENT, calories: 2100, protein_g: 180, carbs_g: 187, fat_g: 70, fibre_g: 30,
  updated_at: '2026-09-01T10:00:00Z',
}

// Two eras: the target changed on 1 October, so days before that must be scored
// against the older number.
export const targetHistory = [
  { effective_from: '2026-10-01', calories: 2100, protein_g: 180, carbs_g: 187, fat_g: 70, fibre_g: 30 },
  { effective_from: '2026-08-01', calories: 2400, protein_g: 160, carbs_g: 240, fat_g: 80, fibre_g: 30 },
]

export const programme = {
  asg: { start_date: '2026-09-28', repeat: true, day_map: [], coach_id: COACH },
  sessions: [
    { id: 's1', week: 1, dow: 1, position: 0, title: 'Upper A — Push', focus: 'Chest, shoulders, triceps', exercises: [] },
    { id: 's2', week: 1, dow: 3, position: 1, title: 'Lower A — Hinge', focus: 'Hamstrings, glutes', exercises: [] },
    { id: 's3', week: 1, dow: 5, position: 2, title: 'Upper B — Pull', focus: 'Back, biceps', exercises: [] },
  ],
  cycleWeeks: 1,
  title: 'Lean & Strong',
  programWeeks: 8,
  dayMap: [],
  byCoach: true,
}

const lift = (name, sets, reps, weight) => ({ name, sets, reps, weight })

// A plan row exists the moment someone taps a session. These two are the pair
// the planned/completed distinction turns on: one has a completion, one does not.
export const plans = [
  {
    id: 'p-today', client_id: CLIENT, title: 'Lower A — Hinge', focus: 'Hamstrings, glutes',
    scheduled_for: TODAY, created_at: `${TODAY}T09:00:00Z`, assigned_by: COACH,
    exercises: [lift('Romanian Deadlift', 4, '8-10', 80), lift('Leg Press', 3, '10-12', 140)],
  },
  {
    id: 'p-last', client_id: CLIENT, title: 'Lower A — Hinge', focus: 'Hamstrings, glutes',
    scheduled_for: '2026-09-30', created_at: '2026-09-30T09:00:00Z', assigned_by: COACH,
    exercises: [lift('Romanian Deadlift', 4, '8-10', 70), lift('Leg Press', 3, '10-12', 130)],
  },
  {
    id: 'p-cardio', client_id: CLIENT, title: 'Easy run', focus: 'Conditioning',
    scheduled_for: '2026-09-29', created_at: '2026-09-29T18:00:00Z', assigned_by: null,
    exercises: [{ name: 'Easy run', sets: 1, reps: '5 km @ conversational pace' }],
  },
]

export const completions = [
  { completed_on: '2026-09-30', source: 'guided', created_at: '2026-09-30T10:30:00Z' },
  { completed_on: '2026-09-29', source: 'strava', created_at: '2026-09-29T19:00:00Z' },
]

export const nutrition = [
  { calories: 500, protein_g: 40, carbs_g: 45, fat_g: 18, fibre_g: 4, logged_at: `${TODAY}T07:30:00Z`, meal_type: 'Breakfast', name: 'Omelette', source: 'manual' },
  { calories: 650, protein_g: 45, carbs_g: 70, fat_g: 18, fibre_g: 6, logged_at: `${TODAY}T11:30:00Z`, meal_type: 'Lunch', name: 'Chicken rice', source: 'manual' },
  { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60, fibre_g: 25, logged_at: '2026-10-05T12:00:00Z', meal_type: 'Lunch', name: 'Sunday', source: 'manual' },
]

export const foodDays = [{ day: '2026-10-05', completed_at: '2026-10-05T21:00:00Z' }]

// Monday has a reading of 0 — a real zero. Tuesday has no row at all, which is
// a different thing and must never be reported as zero.
export const steps = [
  { day: TODAY, steps: 2000, water_ml: 500, updated_at: `${TODAY}T11:00:00Z` },
  { day: '2026-10-05', steps: 0, water_ml: 2000, updated_at: '2026-10-05T22:00:00Z' },
]

export const measurements = [
  { measured_at: '2026-10-01', weight_kg: 92.4, waist_cm: 102 },
  { measured_at: '2026-09-01', weight_kg: 94.1, waist_cm: 105 },
]

export const readiness = [
  { client_id: CLIENT, checked_on: '2026-10-06', sleep: 4, energy: 4, soreness: 2, minutes_available: 60, note: null, created_at: '2026-10-06T07:00:00Z' },
]

export const weekly = [
  { created_at: '2026-10-05T19:00:00Z', energy: 3, sleep: 3, nutrition: 4, training: 4, wins: 'Hit every session' },
]

export const soreness = [{ logged_on: '2026-10-06', body_region: 'knee', pain: 3 }]

export const lifts = [
  { name: 'Romanian Deadlift', weight: 80, performed_on: TODAY },
  { name: 'Romanian Deadlift', weight: 70, performed_on: '2026-09-30' },
  { name: 'Leg Press', weight: 140, performed_on: TODAY },
]

export const recipes = [
  { id: 'r1', title: 'Prawn stir fry', calories: 520, protein_g: 42, carbs_g: 40, fat_g: 18, tags: ['shellfish'], client_id: CLIENT },
  { id: 'r2', title: 'Chicken and rice', calories: 600, protein_g: 48, carbs_g: 65, fat_g: 12, tags: ['high protein'], client_id: CLIENT },
  { id: 'r3', title: 'Beef chilli', calories: 1800, protein_g: 60, carbs_g: 90, fat_g: 70, tags: [], client_id: CLIENT },
]

export const memory = [
  { key: 'Allergies', value: 'shellfish and prawns', source: 'user' },
]

export const chats = [
  { question: 'How much protein?', answer: 'Aim for 180g.', created_at: '2026-10-06T08:00:00Z', used: null },
]

/** The full raw bundle. `omit` drops slices to test the missing-vs-empty split. */
export function raw(omit = []) {
  const all = {
    profile, targets, targetHistory, programme, plans, completions,
    nutrition, foodDays, steps, measurements, readiness, weekly, soreness,
    lifts, recipes, memory, chats,
    strava: null,
  }
  for (const k of omit) delete all[k]
  return all
}
