// Curated exercise catalogue reflecting the kit at South Coast Power House.
// Grouped for a native <optgroup> dropdown so clients pick instead of typing.
import { THEME } from './themes.js'
import { STEP_NAMES } from './calisthenics.js'

const BASE_GROUPS = [
  {
    label: 'Legs & Glutes',
    options: [
      'Back Squat (barbell)', 'Front Squat (barbell)', 'Leg Press', 'Hack Squat',
      'Romanian Deadlift', 'Deadlift', 'Barbell Hip Thrust', 'Bulgarian Split Squat',
      'Walking Lunge (dumbbell)', 'Leg Extension', 'Lying Leg Curl', 'Seated Leg Curl',
      'Calf Raise', 'Cable Glute Kickback',
    ],
  },
  {
    label: 'Chest & Shoulders',
    options: [
      'Barbell Bench Press', 'Incline Barbell Press', 'Dumbbell Bench Press',
      'Incline Dumbbell Press', 'Chest Press (Hammer Strength)', 'Pec Deck / Chest Fly',
      'Cable Chest Fly', 'Overhead Press (barbell)', 'Dumbbell Shoulder Press',
      'Landmine Press', 'Arnold Press',
      'Shoulder Press (machine)', 'Dumbbell Lateral Raise', 'Cable Lateral Raise',
      'Triceps Pushdown (cable)', 'Overhead Triceps Extension', 'Dip',
    ],
  },
  {
    label: 'Back & Biceps',
    options: [
      'Lat Pulldown (cable)', 'Seated Cable Row', 'Bent-over Barbell Row',
      'T-Bar Row', 'Landmine Row', 'Single-arm Dumbbell Row', 'Meadows Row',
      'Chest-Supported Row (machine)', 'Pull-up / Assisted Pull-up', 'Chin-up',
      'Face Pull (cable)', 'Barbell Curl', 'Dumbbell Curl', 'Hammer Curl',
      'Cable Curl', 'Preacher Curl',
    ],
  },
  {
    label: 'Core',
    options: ['Plank', 'Cable Crunch', 'Hanging Leg Raise', 'Ab Rollout', 'Russian Twist', 'Back Extension'],
  },
  {
    label: 'Conditioning',
    options: [
      'Treadmill (incline walk)', 'Assault / Air Bike', 'Stepper', 'Cross-trainer', 'Rower',
      'Battle Ropes', 'Tyre Flips', 'Sled Push', 'Farmer’s Carry', 'Kettlebell Swing',
    ],
  },
]

// Calisthenics (Rick.Fit + Lennon GK). The movements come from the skill ladders
// in calisthenics.js rather than a second hand-kept list, so the dropdown, the
// tracker and the ready-made sessions can never disagree about what a step is
// called.
//
// Anything already in the catalogue is dropped: the base list has 'Plank',
// 'Chin-up' and 'Dip' of its own, and a name in two optgroups is a dropdown that
// looks broken. KNOWN_NAMES in WorkoutRows dedupes silently, so this would not
// have shown up anywhere except on the screen.
const BASE_NAMES = new Set(BASE_GROUPS.flatMap((g) => g.options))
const CALISTHENICS_GROUP = {
  label: 'Calisthenics',
  options: STEP_NAMES.filter((n) => !BASE_NAMES.has(n)),
}

export const EXERCISE_GROUPS = THEME.features?.calisthenics
  ? [...BASE_GROUPS, CALISTHENICS_GROUP]
  : BASE_GROUPS
