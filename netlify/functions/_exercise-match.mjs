// Matching an exercise name to a correct-form demo in the free-exercise-db.
//
// Paul, 2 Sept: "one of them is like a seated cable row, and it's showing a
// standing cable upright row". Reproduced exactly. Two defects, both here:
//
//   1. The library entry is "Seated Cable Rows" — PLURAL. The old matcher
//      required the movement word to match exactly, so `row != rows` threw the
//      right answer out and left a wrong one to win on equipment bonuses.
//   2. It took the LAST token as the movement word. "Lat Pulldown (cable)"
//      therefore hunted for "cable" and returned "Cable Chest Press" — so the
//      stock catalogue was affected too, not just Paul's own exercises.
//
// The governing rule is the one used for the barcode reader: returning nothing
// beats returning something wrong. A missing demo is a gap; a confident demo of
// a different movement teaches bad form.

export const LIB_JSON = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json'
export const LIB_IMG = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'

// Bump when the matching changes, so cached results re-match instead of being
// trusted forever. exercise_guides.images_v records what produced a row.
export const MATCHER_V = 2

export const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Light stemmer — enough for gym English: rows/row, presses/press, flies/fly,
// raises/raise, curls/curl. Deliberately not a real stemmer.
export function stem(t) {
  if (t.length <= 3) return t
  if (t.endsWith('ies')) return t.slice(0, -3) + 'y'
  if (/(?:s|x|z|ch|sh)es$/.test(t)) return t.slice(0, -2)
  if (t.endsWith('ss')) return t
  if (t.endsWith('s')) return t.slice(0, -1)
  return t
}

const stems = (key) => key.split(' ').filter(Boolean).map(stem).map((t) => SYNONYMS[t] || t)

// The movement is the head noun, and it is NOT reliably the last word. Match on
// a known vocabulary instead, so "Lat Pulldown (cable)" resolves to "pulldown".
// Body parts are deliberately NOT in here. Listing "chest" as a movement made
// "Cable Chest Fly" match "Cable Chest Press" — a fly is not a press.
const MOVEMENTS = new Set([
  'row', 'press', 'curl', 'raise', 'squat', 'deadlift', 'fly', 'extension',
  'pulldown', 'pushdown', 'thrust', 'lunge', 'crunch', 'plank', 'dip', 'pullup',
  'chinup', 'pullover', 'pull', 'push', 'kickback', 'shrug', 'rotation', 'twist',
  'situp', 'bridge', 'stepup', 'swing', 'clean', 'snatch', 'jerk', 'carry',
  'hold', 'march', 'abduction', 'adduction', 'abductor', 'adductor', 'rollout',
  'hyperextension', 'crossover', 'kickback', 'thruster', 'burpee', 'jump',
])

// Spellings the stemmer cannot reconcile on its own.
const SYNONYMS = { flye: 'fly', flies: 'fly', pulldowns: 'pulldown', tricep: 'triceps', bicep: 'biceps' }

const GOOD_EQUIP = ['barbell', 'dumbbell', 'bodyweight', 'cable', 'kettlebell']
const BAD_EQUIP = ['machine', 'smith', 'lever', 'sled', 'car', 'band', 'assisted', 'roller']

// Words that carry no meaning for matching and would otherwise inflate overlap.
const STOP = new Set(['the', 'a', 'with', 'and', 'to', 'on', 'in', 'of', 'from'])

// Words that say what the kit is, not which movement it is. A short name may be
// matched while one of these goes unmatched; a distinctive word may not. That is
// the difference between "Abductor Machine" -> "Thigh Abductor" (fine) and
// "Landmine Row" -> "Inverted Row" (a different exercise entirely).
const GENERIC = new Set([
  'machine', 'lever', 'leverage', 'plate', 'loaded', 'bar', 'attachment', 'weight',
  'gym', 'station', 'unit', 'equipment',
])

const movementsIn = (ss) => ss.filter((t) => MOVEMENTS.has(t))

export function buildLibrary(arr) {
  return (arr || []).map((e) => {
    const key = nameKey(e.name)
    const ss = stems(key)
    return { name: e.name, key, stems: ss, moves: movementsIn(ss), images: e.images || [] }
  })
}

/**
 * Best demo for `name`, or [] when nothing is a confident match.
 * Returns image PATHS from the library; callers prefix LIB_IMG.
 */
export function matchOne(name, lib) {
  const key = nameKey(name)
  const exact = lib.find((e) => e.key === key)
  if (exact) return { images: exact.images, name: exact.name, score: Infinity }

  const q = stems(key).filter((t) => !STOP.has(t))
  if (!q.length) return { images: [], name: null, score: 0 }
  const qMoves = movementsIn(q)

  let best = null
  let bs = -1
  for (const e of lib) {
    // The movement must agree. Without a recognised movement in the query we
    // cannot tell a row from a press, so we require a very high word overlap
    // instead of guessing (handled by the floor below).
    if (qMoves.length && !qMoves.some((m) => e.moves.includes(m))) continue

    const shared = q.filter((t) => e.stems.includes(t)).length
    if (!shared) continue

    // Overlap as a fraction of BOTH names, so "Leverage High Row" cannot win
    // against "Leverage Seated Row" purely by being short.
    const cover = shared / q.length
    const precision = shared / e.stems.length
    let s = (cover * 60) + (precision * 40) - Math.abs(e.stems.length - q.length)
    if (e.stems.some((t) => t === 'barbell' || t === 'dumbbell')) s += 3
    else if (e.stems.some((t) => GOOD_EQUIP.includes(t))) s += 2
    if (e.stems.some((t) => BAD_EQUIP.includes(t))) s -= 4
    if (s > bs) { bs = s; best = e }
  }

  if (!best) return { images: [], name: null, score: 0 }

  // The floor. A demo is shown only when the names genuinely correspond: the
  // movement agreed, and enough of the descriptive words did too. Below this we
  // show the written how-to with no picture, which is honest.
  const shared = q.filter((t) => best.stems.includes(t)).length
  const cover = shared / q.length
  const sharedMove = qMoves.some((m) => best.moves.includes(m))
  const enough = qMoves.length
    // Movement agreed. Short names ("Abductor Machine", "Dip") carry few words,
    // so judge them on the movement plus half the name rather than a word count
    // they can never reach.
    ? (cover >= 0.6 && shared >= 2)
      || (q.length <= 2 && sharedMove
          && q.every((t) => best.stems.includes(t) || GENERIC.has(t)))
    // No recognised movement: we cannot tell a row from a press, so the names
    // have to correspond almost entirely.
    : cover >= 0.85 && shared >= 2
  if (!enough) return { images: [], name: null, score: bs, rejected: best.name }

  return { images: best.images, name: best.name, score: bs }
}

let LIB = null // cached across warm invocations
export async function library(fetchImpl = fetch) {
  if (LIB) return LIB
  try {
    const res = await fetchImpl(LIB_JSON)
    LIB = buildLibrary(await res.json())
  } catch { LIB = [] }
  return LIB
}

export async function matchImages(name) {
  const lib = await library()
  return matchOne(name, lib).images.map((i) => LIB_IMG + i)
}
