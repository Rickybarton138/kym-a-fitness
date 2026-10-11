import collection from './rickFitVideos.json' with { type: 'json' }

const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
// Exact aliases only: never turn a different exercise variation into this demo.
const aliases = [
  ['Barbell back squat', 'Back squat (barbell)'],
  ['Barbell Romanian deadlift', 'Romanian deadlift'],
  ['Dumbbell reverse lunge', 'Reverse lunge (dumbbell)'],
  ['Leg press', '45° leg press'], ['Seated leg extension', 'Leg extension'], ['Seated leg curl'],
  ['Standing dumbbell calf raise'], ['Barbell bench press'], ['Incline dumbbell press'],
  // 'Press-up (full)' is what the calisthenics ladder calls this, so without it
  // the one demo that fits a bodyweight session never reaches the screen. Only
  // the full flat-palm version: the incline, fist, handle and ring steps are
  // different movements, and the wrist-adapted ladder must not be handed a
  // flat-palm demo.
  ['Push-up', 'Push up', 'Pushup', 'Press-up', 'Press-up (full)'],
  ['Lat pulldown', 'Lat pulldown (cable)'],
  ['Seated cable row'], ['Single-arm dumbbell row'],
  ['Seated dumbbell shoulder press', 'Dumbbell shoulder press'], ['Dumbbell lateral raise'],
  ['Standing dumbbell biceps curl', 'Dumbbell curl', 'Dumbbell biceps curl'],
  ['Rope triceps pushdown', 'Triceps pushdown (rope)'],
  ['Standing cable chest fly', 'Cable chest fly'], ['Barbell hip thrust'], ['Forearm plank', 'Plank'],
]
const names = new Map(aliases.flatMap((names, i) => names.map(n => [key(n), `rick_fit_${String(i + 1).padStart(2, '0')}`])))
const base = '/brands/ricky/exercises/'

export function getRickFitVideos(ex, brand) {
  if (brand !== 'ricky' || !collection.personalUseAccepted) return []
  const id = names.get(key(ex.name))
  if (!id) return []
  return collection.clips.filter(c => c.exercise_id === id).map(c => ({ ...c, src: base + c.video, poster: base + c.poster }))
}
