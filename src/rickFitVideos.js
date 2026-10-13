import collection from './rickFitVideos.json' with { type: 'json' }

const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
// Exact aliases only: never turn a different exercise variation into this demo.
const aliases = [
  ['Barbell back squat', 'Back squat (barbell)'],
  ['Barbell Romanian deadlift', 'Romanian deadlift'],
  ['Dumbbell reverse lunge', 'Reverse lunge (dumbbell)'],
  ['Leg press', '45° leg press'], ['Seated leg extension', 'Leg extension'], ['Seated leg curl'],
  // Deliberately NOT aliased to the catalogue's generic 'Calf Raise': the
  // generic name is just as likely to mean the seated or machine version, and
  // tests/rick-fit-videos.test.mjs asserts it resolves to nothing. Same for
  // 'Triceps Pushdown (cable)' below, which may be a straight bar rather than
  // the rope. Generic-to-specific is only used where there is effectively one
  // common form of the movement, as with 'Plank' and 'Leg extension'.
  ['Standing dumbbell calf raise'], ['Barbell bench press'], ['Incline dumbbell press'],
  // 'Press-up (full)' is what the callisthenics ladder calls this, so without it
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
  ['Standing cable chest fly', 'Cable chest fly'], ['Barbell hip thrust'],
  // 'Front plank on forearms' is the wrist-adapted ladder's name for exactly
  // this hold — "forearms down, no weight through the wrist at all" — so it is
  // the same movement, not a variation of it. 'Front plank' is the core
  // ladder's name for the same hold.
  ['Forearm plank', 'Plank', 'Front plank', 'Front plank on forearms'],
]
// This table is POSITIONAL: entry i is exercise rick_fit_(i+1). So a new name
// goes INSIDE its exercise's existing row — never on a new row, which would
// renumber nothing but would shadow the original (Map keeps the last value for
// a duplicate key) and point a working demo at an id with no clips.
// tests/rick-fit-videos.test.mjs asserts every exercise resolves to its own
// clips, which is what catches that.
const names = new Map(aliases.flatMap((names, i) => names.map(n => [key(n), `rick_fit_${String(i + 1).padStart(2, '0')}`])))
const base = '/brands/ricky/exercises/'

export function getRickFitVideos(ex, brand) {
  if (brand !== 'ricky' || !collection.personalUseAccepted) return []
  const id = names.get(key(ex.name))
  if (!id) return []
  return collection.clips.filter(c => c.exercise_id === id).map(c => ({ ...c, src: base + c.video, poster: base + c.poster }))
}
