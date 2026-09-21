// Callisthenics: six skill ladders and the sessions built from them.
//
// ONE source of truth on purpose. The same ladders feed four surfaces — the
// progress tracker, the ready-made sessions, the exercise dropdown (via
// exercises.js) and the AI programme builder's vocabulary (via
// programme-generate.mjs) — so a step added here appears in all four rather than
// being written out four times and drifting.
//
// NO IMPORTS. This module is read by a Netlify function as well as the app, the
// way nutritionExpert.js and accountability.js are. Importing themes.js would
// drag in resolveBrandSlug(), which reads window.location at module scope; it
// would not crash on the server (the try/catch falls back to 'kim') but it
// would quietly couple a server prompt to a hostname lookup. Brand gating
// belongs in exercises.js and the JSX, not here.
//
// A ladder step is a real prescription, not a label: `sets` and `reps` go
// straight into a session, and `reps` carries holds as text ("30s") because
// that is what the guided player already renders for time-based work.

export const SKILLS = [
  {
    key: 'pull',
    name: 'Pull-up',
    goal: 'Muscle-up',
    pattern: 'Vertical pull',
    kit: 'A bar you can hang from',
    steps: [
      { name: 'Dead Hang', sets: 3, reps: '30s', cue: 'Shoulders active, not shrugged up by your ears. The grip is the point.', unlock: '30 seconds unbroken' },
      { name: 'Scapular Pull-up', sets: 3, reps: '8', cue: 'Arms stay straight. Only the shoulder blades move — pull them down and back.', unlock: '8 clean reps with no elbow bend' },
      { name: 'Australian Row', sets: 3, reps: '10-12', cue: 'Bar about hip height, body in one line, chest to the bar.', unlock: '12 reps with the body flat' },
      { name: 'Negative Pull-up', sets: 4, reps: '4 × 5s lower', cue: 'Jump to the top and lower for a slow five. The lowering is the training.', unlock: '4 controlled five-second lowers' },
      { name: 'Band-assisted Pull-up', sets: 4, reps: '6', cue: 'Lightest band that lets you finish. Chin clears the bar every rep.', unlock: '6 reps on a light band' },
      { name: 'Pull-up (full)', sets: 4, reps: '5', cue: 'Dead hang to chin over the bar. No kipping, no half reps.', unlock: '5 strict reps' },
      { name: 'Chest-to-Bar Pull-up', sets: 4, reps: '5', cue: 'Lean back and drive the elbows down until the bar touches your collarbone.', unlock: '5 reps that actually touch' },
      { name: 'Weighted Pull-up', sets: 4, reps: '5', cue: 'Belt, or a dumbbell between the feet. Start at 5kg and add slowly.', unlock: '5 reps with 10% of bodyweight' },
      { name: 'Muscle-up', sets: 4, reps: '3', cue: 'Explosive pull to the sternum, then roll the wrists over fast and press out.', unlock: null },
    ],
  },
  {
    key: 'push',
    name: 'Press-up',
    goal: 'Handstand press-up',
    pattern: 'Horizontal and vertical push',
    kit: 'Floor, and a wall later on',
    steps: [
      { name: 'Incline Press-up', sets: 3, reps: '12', cue: 'Hands on a bench or worktop. Body in one line — the hips do not sag.', unlock: '12 reps with the hips level' },
      { name: 'Press-up (full)', sets: 3, reps: '10', cue: 'Elbows at about 45 degrees, not flared wide. Chest to the floor.', unlock: '10 full-range reps' },
      { name: 'Diamond Press-up', sets: 3, reps: '8', cue: 'Hands together under the sternum, elbows brushing the ribs.', unlock: '8 reps' },
      { name: 'Archer Press-up', sets: 3, reps: '6 each side', cue: 'Weight over one arm, the other stays long. Alternate sides.', unlock: '6 each side' },
      { name: 'Pseudo Planche Press-up', sets: 3, reps: '6', cue: 'Hands down by the hips, fingers turned out, lean forward over them.', unlock: '6 reps leaning past the wrists' },
      { name: 'Pike Press-up', sets: 3, reps: '8', cue: 'Hips high, head down to the floor between the hands.', unlock: '8 reps with the head touching' },
      { name: 'Wall Handstand Press-up', sets: 3, reps: '5', cue: 'Chest to the wall. Lower until the head touches, then press away.', unlock: '5 reps to the head' },
      { name: 'Freestanding Handstand Press-up', sets: 3, reps: '3', cue: 'Only once the freestanding hold is solid. Small dip first, build the range.', unlock: null },
    ],
  },
  {
    key: 'dip',
    name: 'Dip',
    goal: 'Ring dip',
    pattern: 'Vertical push',
    kit: 'Bench, then parallel bars or rings',
    steps: [
      { name: 'Bench Dip', sets: 3, reps: '12', cue: 'Hands behind you on a bench, shoulders down. Stop if the front of the shoulder pinches.', unlock: '12 reps' },
      { name: 'Parallel Bar Dip (assisted)', sets: 3, reps: '8', cue: 'Band or machine. Lean forward slightly, elbows back rather than out.', unlock: '8 reps with light assistance' },
      { name: 'Parallel Bar Dip', sets: 4, reps: '8', cue: 'Down until the upper arm is level with the floor. No lower unless it is comfortable.', unlock: '8 full reps' },
      { name: 'Weighted Dip', sets: 4, reps: '6', cue: 'Add weight in small steps. Depth first, load second.', unlock: '6 reps with 10% of bodyweight' },
      { name: 'Ring Support Hold', sets: 4, reps: '20s', cue: 'Arms locked, rings turned out, shoulders pushed down away from the ears.', unlock: '20 seconds steady, rings turned out' },
      { name: 'Ring Dip', sets: 4, reps: '5', cue: 'The rings will wobble. Let them, and keep the elbows in.', unlock: null },
    ],
  },
  {
    key: 'legs',
    name: 'Squat',
    goal: 'Pistol squat',
    pattern: 'Single-leg strength',
    kit: 'Floor, a box or step',
    steps: [
      { name: 'Bodyweight Squat', sets: 3, reps: '20', cue: 'Full depth, heels down, chest up. Slow on the way down.', unlock: '20 reps at full depth' },
      { name: 'Split Squat', sets: 3, reps: '10 each side', cue: 'Back knee straight down to the floor. Front shin stays near vertical.', unlock: '10 each side' },
      { name: 'Bulgarian Split Squat (bodyweight)', sets: 3, reps: '10 each side', cue: 'Back foot on a bench. Most of the weight stays on the front leg.', unlock: '10 each side, controlled' },
      { name: 'Skater Squat', sets: 3, reps: '8 each side', cue: 'Back knee reaches for the floor behind you. Hands out in front to balance.', unlock: '8 each side, knee touching' },
      { name: 'Box Pistol Squat', sets: 3, reps: '6 each side', cue: 'Sit down to a box on one leg, stand back up on the same leg.', unlock: '6 each side from a low box' },
      { name: 'Assisted Pistol Squat', sets: 3, reps: '5 each side', cue: 'One hand on a frame or a band overhead. Use as little as you can get away with.', unlock: '5 each side with one finger of help' },
      { name: 'Pistol Squat', sets: 4, reps: '5 each side', cue: 'Free leg straight out, heel down, all the way to the bottom and back up.', unlock: null },
    ],
  },
  {
    key: 'core',
    name: 'Plank',
    goal: 'Front lever',
    pattern: 'Straight-body core',
    kit: 'Floor and a bar',
    steps: [
      { name: 'Front Plank', sets: 3, reps: '45s', cue: 'Ribs down, glutes tight. A straight line, not a tent.', unlock: '45 seconds without the hips dropping' },
      { name: 'Hollow Body Hold', sets: 3, reps: '30s', cue: 'Lower back pressed into the floor. Lower the arms and legs only as far as that allows.', unlock: '30 seconds with the back flat' },
      { name: 'Hanging Knee Raise', sets: 3, reps: '12', cue: 'No swinging. Knees to the chest, lower slowly.', unlock: '12 reps without swinging' },
      { name: 'Hanging Straight Leg Raise', sets: 3, reps: '10', cue: 'Legs straight to horizontal, then lower under control.', unlock: '10 reps to horizontal' },
      { name: 'Tuck L-sit', sets: 4, reps: '20s', cue: 'On parallettes or the floor. Shoulders pushed down, knees up.', unlock: '20 seconds' },
      { name: 'L-sit', sets: 4, reps: '15s', cue: 'Legs straight and level. Push the floor away the whole time.', unlock: '15 seconds with the legs level' },
      { name: 'Tuck Front Lever', sets: 4, reps: '15s', cue: 'Hanging, knees tucked, back flat and horizontal. Pull the bar towards your hips.', unlock: '15 seconds with a flat back' },
      { name: 'Advanced Tuck Front Lever', sets: 4, reps: '12s', cue: 'Open the hips to 90 degrees, back still flat.', unlock: '12 seconds' },
      { name: 'Straddle Front Lever', sets: 4, reps: '10s', cue: 'Legs wide and straight. The wider the legs, the easier it stays.', unlock: '10 seconds' },
      { name: 'Front Lever', sets: 4, reps: '8s', cue: 'Body in one horizontal line, arms straight, shoulders pulled down.', unlock: null },
    ],
  },
  {
    key: 'handstand',
    name: 'Handstand',
    goal: 'Freestanding handstand',
    pattern: 'Balance and overhead position',
    kit: 'A clear wall',
    steps: [
      { name: 'Wall Plank (feet up)', sets: 3, reps: '30s', cue: 'Feet on the wall, hands walked in until the body is nearly vertical.', unlock: '30 seconds near vertical' },
      { name: 'Chest-to-Wall Handstand', sets: 4, reps: '30s', cue: 'Belly to the wall, ribs in, toes pointed. Look at your hands, not the floor.', unlock: '30 seconds stacked and still' },
      { name: 'Wall Handstand Shoulder Taps', sets: 3, reps: '8 each side', cue: 'Shift the weight fully onto one hand before the other leaves the floor.', unlock: '8 taps each side without falling out' },
      { name: 'Heel Pulls', sets: 4, reps: '5', cue: 'From the wall, pull one heel away and find the balance point. Come back if you overshoot.', unlock: '5 balanced seconds off the wall' },
      { name: 'Freestanding Handstand', sets: 5, reps: 'max hold', cue: 'Fingertips do the steering. Bail sideways, never straight back.', unlock: null },
    ],
  },
]

// Accessories that are not on a ladder — they round a session out without
// pretending to be a skill you progress.
const ACCESSORIES = {
  nordic: { name: 'Nordic Curl (assisted)', sets: 3, reps: '6', cue: 'Lower as slowly as you can, push back up with the hands.', equipment: 'Bodyweight' },
  bridge: { name: 'Single-leg Glute Bridge', sets: 3, reps: '12 each side', cue: 'Drive through the heel, ribs down, do not arch the back.', equipment: 'Bodyweight' },
  calf: { name: 'Single-leg Calf Raise', sets: 3, reps: '15 each side', cue: 'Full stretch at the bottom, pause at the top.', equipment: 'Step' },
  facepull: { name: 'Band Face Pull', sets: 3, reps: '15', cue: 'Band on a bar. Lead with the elbows, finish with the hands by the ears.', equipment: 'Band' },
  wristprep: { name: 'Wrist Prep', sets: 2, reps: '60s', cue: 'Palms down, palms up, fingers back. Rock gently — this is what keeps handstands painless.', equipment: 'Bodyweight' },
  // The adapted pair. A bad wrist still wants prep, but prep that never reaches
  // the end of its range; a bad knee wants the hamstring work without the deep
  // loaded flexion a Nordic asks for on the way down.
  wristprep_gentle: { name: 'Wrist Prep (pain-free range)', sets: 2, reps: '60s', cue: 'Small circles and gentle rocking, well inside where it complains. Stop at the first pinch.', equipment: 'Bodyweight' },
  hamwalk: { name: 'Hamstring Bridge Walkout', sets: 3, reps: '8', cue: 'From a bridge, walk the heels out and back with the hips up. Hamstrings, no knee load.', equipment: 'Bodyweight' },
}

// A session is a list of slots. A `skill` slot resolves to wherever the client
// actually is on that ladder, which is the whole point: the same session gets
// harder as they do, and nobody has to rewrite it.
export const SESSIONS = [
  {
    key: 'upper',
    title: 'Calisthenics — Push & Pull',
    focus: 'Upper body, bodyweight',
    blurb: 'The two big patterns, at your current step, plus shoulder care.',
    slots: [{ skill: 'pull' }, { skill: 'push' }, { skill: 'dip' }, { skill: 'core' }, { fixed: 'facepull' }],
    finisher: 'Dead hang, as long as you can hold it. Twice.',
  },
  {
    key: 'lower',
    title: 'Calisthenics — Legs & Core',
    focus: 'Single-leg strength and midline',
    blurb: 'Single-leg work towards the pistol, then the hard core holds.',
    slots: [{ skill: 'legs' }, { fixed: 'nordic' }, { fixed: 'bridge' }, { skill: 'core' }, { fixed: 'calf' }],
    finisher: '',
  },
  {
    key: 'skills',
    title: 'Skill practice',
    focus: 'Handstand, lever, quality over volume',
    blurb: 'Short and fresh. Skills go first in the week, never after a hard session.',
    slots: [{ fixed: 'wristprep' }, { skill: 'handstand' }, { skill: 'core' }, { skill: 'pull', sets: 3 }],
    finisher: '',
  },
  {
    key: 'full',
    title: 'Calisthenics — Full body',
    focus: 'Everything, one bar and a floor',
    blurb: 'The travel session. A bar, a wall and twenty minutes.',
    slots: [{ skill: 'pull' }, { skill: 'push' }, { skill: 'legs' }, { skill: 'core' }],
    finisher: 'Hollow hold, 3 × 30 seconds.',
  },
]

// ---------------------------------------------------------------------------
// Adaptations.
//
// Ricky, 21 Sept: "can we modify mine to account for bad knees and wrist."
// His coach programme has said so all along — "no knee strain at all here",
// "neutral grip keeps the wrist straight, machine not barbell, for exactly that
// reason" — and the ladders above ignored it completely. A pistol squat is the
// deepest loaded knee bend there is, and a handstand puts bodyweight through a
// wrist bent to ninety degrees.
//
// These are not easier ladders, they are different ones, and they end somewhere
// real: a single-leg box squat instead of a pistol, a freestanding FOREARM
// stand instead of a handstand. Load management, not treatment.
export const ADAPTATIONS = [
  {
    key: 'knees',
    label: 'Bad knees',
    sub: 'No deep knee bend and no jumping. Hinge and glute work leads instead, and every squat stops at a height that does not hurt.',
  },
  {
    key: 'wrists',
    label: 'Bad wrists',
    sub: 'Nothing on flat palms under load: handles, fists and rings instead, and the handstand ladder runs on the forearms.',
  },
]

// Ladders that replace the default when an adaptation is on. A skill with no
// entry here is left alone: hanging is wrist-neutral and nothing in the pull
// ladder bends a knee, so `pull` needs no version of its own.
const VARIANTS = {
  knees: {
    legs: {
      name: 'Hinge & glutes',
      goal: 'Single-leg box squat',
      kit: 'Floor, a bench, a box you can set high',
      steps: [
        { name: 'Glute Bridge', sets: 3, reps: '15', cue: 'Drive through the heels, ribs down. The knee barely moves — this is all hip.', unlock: '15 reps with the hips locking out' },
        { name: 'Single-leg Glute Bridge', sets: 3, reps: '12 each side', cue: 'One foot down, the other knee held up. Keep the hips level the whole way.', unlock: '12 each side without the hips tipping' },
        { name: 'Shoulder-elevated Hip Thrust', sets: 3, reps: '12', cue: 'Shoulders on a bench, chin tucked. Squeeze at the top, do not arch the back.', unlock: '12 reps with a full lockout' },
        { name: 'Box Squat (comfortable height)', sets: 3, reps: '12', cue: 'Sit back to a box set where the knee is happy. That height is the prescription — do not chase depth.', unlock: '12 reps, and no complaint from the knee the next day' },
        { name: 'Single-leg Romanian Deadlift', sets: 3, reps: '10 each side', cue: 'Hinge at the hip with a soft knee. You should feel the hamstring, never the kneecap.', unlock: '10 each side, balanced' },
        { name: 'Hamstring Bridge Walkout', sets: 3, reps: '8', cue: 'From a bridge, walk the heels out and back while the hips stay up.', unlock: '8 slow walkouts' },
        { name: 'Step-up (low box)', sets: 3, reps: '10 each side', cue: 'Low box. Push through the top foot and lower slowly — no pushing off the back leg.', unlock: '10 each side, controlled on the way down' },
        { name: 'Single-leg Box Squat (high box)', sets: 4, reps: '8 each side', cue: 'A pistol that never goes deep. Lower the box only after a week of the knee staying quiet.', unlock: null },
      ],
    },
  },
  wrists: {
    push: {
      name: 'Press-up (neutral wrist)',
      goal: 'Elevated pike press-up',
      kit: 'Push-up handles, parallettes or a pair of dumbbells',
      steps: [
        { name: 'Incline Press-up on Handles', sets: 3, reps: '12', cue: 'Handles on a bench. The wrist stays straight — that is the whole point of them.', unlock: '12 reps with a straight wrist' },
        { name: 'Press-up on Handles', sets: 3, reps: '10', cue: 'Elbows at 45 degrees. Chest down between the handles, not above them.', unlock: '10 full-range reps' },
        { name: 'Fist Press-up', sets: 3, reps: '8', cue: 'On the knuckles, wrist in line with the forearm. On a mat, not a hard floor.', unlock: '8 reps with the wrists neutral' },
        { name: 'Ring Press-up', sets: 3, reps: '8', cue: 'Rings just off the floor, turned out at the top. They let the wrist find its own angle.', unlock: '8 reps with the rings turned out' },
        { name: 'Archer Press-up on Handles', sets: 3, reps: '6 each side', cue: 'Weight over one arm, the other long. The handle keeps the loaded wrist straight.', unlock: '6 each side' },
        { name: 'Pike Press-up on Handles', sets: 3, reps: '8', cue: 'Hips high, head down between the handles.', unlock: '8 reps with the head passing the hands' },
        { name: 'Elevated Pike Press-up on Handles', sets: 3, reps: '6', cue: 'Feet up on a box. As close to overhead pressing as a bad wrist should get.', unlock: null },
      ],
    },
    dip: {
      name: 'Dip (neutral wrist)',
      goal: 'Ring dip',
      kit: 'Parallel bars or rings',
      steps: [
        { name: 'Ring Support Hold', sets: 3, reps: '20s', cue: 'Arms locked, rings turned out, shoulders down. It starts here because the bench dip is the one a bad wrist cannot do.', unlock: '20 seconds steady' },
        { name: 'Parallel Bar Dip (assisted)', sets: 3, reps: '8', cue: 'Band or machine. Neutral grip throughout, elbows back rather than out.', unlock: '8 reps with light assistance' },
        { name: 'Parallel Bar Dip', sets: 4, reps: '8', cue: 'Down until the upper arm is level with the floor. No lower unless it is comfortable.', unlock: '8 full reps' },
        { name: 'Weighted Dip', sets: 4, reps: '6', cue: 'Add weight in small steps. Depth first, load second.', unlock: '6 reps with 10% of bodyweight' },
        { name: 'Ring Dip', sets: 4, reps: '5', cue: 'The rings will wobble. Let them, and keep the elbows in.', unlock: null },
      ],
    },
    core: {
      name: 'Plank (neutral wrist)',
      goal: 'Front lever',
      kit: 'Forearms, handles and a bar',
      steps: [
        { name: 'Front Plank on Forearms', sets: 3, reps: '45s', cue: 'Forearms down, ribs down, glutes tight. No weight through the wrist at all.', unlock: '45 seconds without the hips dropping' },
        { name: 'Hollow Body Hold', sets: 3, reps: '30s', cue: 'Lower back pressed into the floor. Nothing touches the ground but your back.', unlock: '30 seconds with the back flat' },
        { name: 'Hanging Knee Raise', sets: 3, reps: '12', cue: 'Hanging is wrist-neutral, so this one is unchanged. No swinging.', unlock: '12 reps without swinging' },
        { name: 'Hanging Straight Leg Raise', sets: 3, reps: '10', cue: 'Legs straight to horizontal, then lower under control.', unlock: '10 reps to horizontal' },
        { name: 'Tuck L-sit on Handles', sets: 4, reps: '20s', cue: 'On parallettes, never the floor. Shoulders pushed down, knees up.', unlock: '20 seconds' },
        { name: 'L-sit on Handles', sets: 4, reps: '15s', cue: 'Legs straight and level. The handles keep the wrist out of it.', unlock: '15 seconds with the legs level' },
        { name: 'Tuck Front Lever', sets: 4, reps: '15s', cue: 'Hanging, knees tucked, back flat and horizontal.', unlock: '15 seconds with a flat back' },
        { name: 'Advanced Tuck Front Lever', sets: 4, reps: '12s', cue: 'Open the hips to 90 degrees, back still flat.', unlock: '12 seconds' },
        { name: 'Straddle Front Lever', sets: 4, reps: '10s', cue: 'Legs wide and straight. The wider the legs, the easier it stays.', unlock: '10 seconds' },
        { name: 'Front Lever', sets: 4, reps: '8s', cue: 'Body in one horizontal line, arms straight, shoulders pulled down.', unlock: null },
      ],
    },
    handstand: {
      name: 'Forearm stand',
      goal: 'Freestanding forearm stand',
      kit: 'A clear wall and a mat',
      steps: [
        { name: 'Forearm Plank to Wall', sets: 3, reps: '40s', cue: 'Forearms down, feet walked a little way up the wall. Shoulders stacked over the elbows.', unlock: '40 seconds stacked' },
        { name: 'Wall Forearm Pike Hold', sets: 3, reps: '30s', cue: 'Feet up the wall to hip height, hips over the shoulders.', unlock: '30 seconds with the hips stacked' },
        { name: 'Chest-to-Wall Forearm Stand', sets: 4, reps: '30s', cue: 'Belly to the wall, ribs in, toes pointed. Press the forearms down hard.', unlock: '30 seconds still' },
        { name: 'Forearm Stand Heel Pulls', sets: 4, reps: '5', cue: 'Pull one heel off the wall and find the balance point. Come back if you overshoot.', unlock: '5 balanced seconds off the wall' },
        { name: 'Freestanding Forearm Stand', sets: 5, reps: 'max hold', cue: 'Steer with the forearms and the head. Bail by turning out, never straight back.', unlock: null },
      ],
    },
  },
}

// Accessories that change with the joint rather than needing a whole ladder.
const ACCESSORY_SWAPS = {
  knees: { nordic: 'hamwalk' },
  wrists: { wristprep: 'wristprep_gentle' },
}

export const SKILL_BY_KEY = Object.fromEntries(SKILLS.map((s) => [s.key, s]))

/** Every movement in the system, deduped — what the exercise dropdown offers. */
export const STEP_NAMES = [...new Set([
  ...SKILLS.flatMap((s) => s.steps.map((st) => st.name)),
  ...Object.values(VARIANTS).flatMap((bySkill) => Object.values(bySkill).flatMap((v) => v.steps.map((st) => st.name))),
  ...Object.values(ACCESSORIES).map((a) => a.name),
])]

/**
 * The ladder in force for one skill: the default, or the adapted one when an
 * adaptation covers it. `adapt` is { knees: bool, wrists: bool }.
 *
 * Adaptations are checked in ADAPTATIONS order, so if two ever covered the same
 * skill the answer would be stable rather than depending on object key order.
 * Today none do.
 */
export function ladderFor(skillKey, adapt) {
  const base = SKILL_BY_KEY[skillKey]
  if (!base) return null
  for (const a of ADAPTATIONS) {
    if (!(adapt || {})[a.key]) continue
    const v = VARIANTS[a.key]?.[skillKey]
    if (v) return { ...base, ...v, key: skillKey, adaptedFor: a.key }
  }
  return base
}

/** Clamp an index to a ladder, so bad or stale data cannot render nothing. */
export function stepIndex(skillKey, raw, adapt) {
  const ladder = ladderFor(skillKey, adapt)
  if (!ladder) return 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(Math.trunc(n), 0), ladder.steps.length - 1)
}

/**
 * Where they are on one ladder.
 * `progress` is { [skillKey]: stepIndex } — everyone starts at step 0.
 *
 * The position is stored per skill, not per ladder, so turning an adaptation on
 * keeps the step number and lands on the matching rung of the other ladder. The
 * ladders are written to line up roughly; a shorter one clamps. That beats a
 * second set of positions nobody would keep in sync, and beats being sent back
 * to step one for adapting.
 */
export function stepFor(progress, skillKey, adapt) {
  const ladder = ladderFor(skillKey, adapt)
  if (!ladder) return null
  const i = stepIndex(skillKey, (progress || {})[skillKey] ?? 0, adapt)
  return {
    ...ladder.steps[i],
    index: i,
    last: i === ladder.steps.length - 1,
    of: ladder.steps.length,
    skillKey,
    adaptedFor: ladder.adaptedFor || null,
  }
}

/** The step after this one, or null at the top of the ladder. */
export function nextStep(progress, skillKey, adapt) {
  const cur = stepFor(progress, skillKey, adapt)
  const ladder = ladderFor(skillKey, adapt)
  if (!cur || !ladder || cur.last) return null
  return ladder.steps[cur.index + 1]
}

/**
 * Turn a session into something the guided player can run:
 * { title, focus, exercises: [{ name, sets, reps, cue, equipment }], finisher }.
 */
export function buildSession(sessionKey, progress, adapt) {
  const s = SESSIONS.find((x) => x.key === sessionKey)
  if (!s) return null
  const exercises = s.slots.map((slot) => {
    if (slot.fixed) {
      // An accessory can be swapped out by an adaptation without the session
      // knowing: the Nordic in the legs session becomes a bridge walkout for a
      // bad knee, and the session definition stays as it was written.
      let key = slot.fixed
      for (const a of ADAPTATIONS) {
        if ((adapt || {})[a.key] && ACCESSORY_SWAPS[a.key]?.[key]) key = ACCESSORY_SWAPS[a.key][key]
      }
      const acc = ACCESSORIES[key]
      return { name: acc.name, sets: slot.sets || acc.sets, reps: acc.reps, cue: acc.cue, equipment: acc.equipment }
    }
    const step = stepFor(progress, slot.skill, adapt)
    if (!step) return null
    return {
      name: step.name,
      sets: slot.sets || step.sets,
      reps: step.reps,
      cue: step.cue,
      equipment: ladderFor(slot.skill, adapt).kit,
    }
  }).filter(Boolean)
  return { title: s.title, focus: s.focus, exercises, finisher: s.finisher || null }
}

/**
 * The ladders as a block of prompt text, so the AI programme builder writes
 * "Tuck Front Lever, 4 × 15s" instead of "3 sets of 10 press-ups" for twelve
 * weeks. Kept here rather than in the function so it can never drift from the
 * ladders it describes.
 *
 * With an adaptation on it hands over the adapted ladders INSTEAD, plus the
 * rule behind them — otherwise the model writes a perfectly good programme out
 * of the movements it was told to avoid.
 */
export function laddersForPrompt(adapt) {
  const lines = SKILLS.map((s) => {
    const ladder = ladderFor(s.key, adapt)
    return `${ladder.name} → ${ladder.goal}: ${ladder.steps.map((st) => st.name).join(' → ')}`
  })
  const rules = ADAPTATIONS.filter((a) => (adapt || {})[a.key]).map((a) => `- ${a.label}: ${a.sub}`)
  return rules.length
    ? `${lines.join('\n')}\nHARD CONSTRAINTS, these outrank everything else:\n${rules.join('\n')}`
    : lines.join('\n')
}
