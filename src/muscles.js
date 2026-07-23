// Muscle groups and the exercises that target them, for the tappable muscle map.
export const MUSCLES = {
  shoulders: { label: 'Shoulders', exercises: ['Overhead press', 'Dumbbell lateral raise', 'Front raise', 'Arnold press', 'Upright row', 'Face pull'] },
  chest: { label: 'Chest', exercises: ['Barbell bench press', 'Dumbbell chest press', 'Incline dumbbell press', 'Chest fly', 'Cable crossover', 'Press-ups'] },
  biceps: { label: 'Biceps', exercises: ['Barbell curl', 'Dumbbell curl', 'Hammer curl', 'Cable curl', 'Preacher curl', 'Chin-ups'] },
  forearms: { label: 'Forearms', exercises: ['Wrist curl', 'Reverse curl', 'Farmer’s carry', 'Dead hang'] },
  abs: { label: 'Abs & core', exercises: ['Plank', 'Hanging leg raise', 'Cable crunch', 'Russian twist', 'Ab wheel rollout', 'Mountain climbers'] },
  quads: { label: 'Quads', exercises: ['Back squat', 'Front squat', 'Leg press', 'Walking lunges', 'Leg extension', 'Bulgarian split squat'] },
  calves: { label: 'Calves', exercises: ['Standing calf raise', 'Seated calf raise', 'Calf press'] },
  traps: { label: 'Traps & upper back', exercises: ['Barbell shrug', 'Dumbbell shrug', 'Face pull', 'Rear delt fly', 'Upright row'] },
  lats: { label: 'Lats & back', exercises: ['Pull-ups', 'Lat pulldown', 'Bent-over row', 'Seated cable row', 'Single-arm dumbbell row', 'T-bar row'] },
  lowerback: { label: 'Lower back', exercises: ['Deadlift', 'Back extension', 'Good morning', 'Superman hold'] },
  triceps: { label: 'Triceps', exercises: ['Tricep dip', 'Close-grip bench press', 'Rope pushdown', 'Overhead extension', 'Skull crushers', 'Tricep kickback'] },
  glutes: { label: 'Glutes', exercises: ['Hip thrust', 'Glute bridge', 'Bulgarian split squat', 'Cable kickback', 'Romanian deadlift'] },
  hamstrings: { label: 'Hamstrings', exercises: ['Romanian deadlift', 'Lying leg curl', 'Seated leg curl', 'Good morning', 'Nordic curl'] },
}

// Tappable zones over the stylised body (viewBox 0 0 220 400), mirrored L/R.
export const FRONT_SHAPES = [
  { m: 'shoulders', el: 'ellipse', cx: 76, cy: 90, rx: 18, ry: 13 },
  { m: 'shoulders', el: 'ellipse', cx: 144, cy: 90, rx: 18, ry: 13 },
  { m: 'chest', el: 'ellipse', cx: 92, cy: 112, rx: 19, ry: 15 },
  { m: 'chest', el: 'ellipse', cx: 128, cy: 112, rx: 19, ry: 15 },
  { m: 'biceps', el: 'ellipse', cx: 58, cy: 128, rx: 12, ry: 22 },
  { m: 'biceps', el: 'ellipse', cx: 162, cy: 128, rx: 12, ry: 22 },
  { m: 'forearms', el: 'ellipse', cx: 52, cy: 172, rx: 10, ry: 24 },
  { m: 'forearms', el: 'ellipse', cx: 168, cy: 172, rx: 10, ry: 24 },
  { m: 'abs', el: 'rect', x: 93, y: 132, w: 34, h: 60, rx: 12 },
  { m: 'quads', el: 'ellipse', cx: 96, cy: 258, rx: 15, ry: 40 },
  { m: 'quads', el: 'ellipse', cx: 124, cy: 258, rx: 15, ry: 40 },
  { m: 'calves', el: 'ellipse', cx: 96, cy: 338, rx: 12, ry: 28 },
  { m: 'calves', el: 'ellipse', cx: 124, cy: 338, rx: 12, ry: 28 },
]

export const BACK_SHAPES = [
  { m: 'traps', el: 'ellipse', cx: 110, cy: 88, rx: 30, ry: 15 },
  { m: 'triceps', el: 'ellipse', cx: 58, cy: 128, rx: 12, ry: 22 },
  { m: 'triceps', el: 'ellipse', cx: 162, cy: 128, rx: 12, ry: 22 },
  { m: 'lats', el: 'ellipse', cx: 90, cy: 122, rx: 17, ry: 22 },
  { m: 'lats', el: 'ellipse', cx: 130, cy: 122, rx: 17, ry: 22 },
  { m: 'lowerback', el: 'rect', x: 96, y: 148, w: 28, h: 40, rx: 10 },
  { m: 'forearms', el: 'ellipse', cx: 52, cy: 172, rx: 10, ry: 24 },
  { m: 'forearms', el: 'ellipse', cx: 168, cy: 172, rx: 10, ry: 24 },
  { m: 'glutes', el: 'ellipse', cx: 97, cy: 210, rx: 16, ry: 20 },
  { m: 'glutes', el: 'ellipse', cx: 123, cy: 210, rx: 16, ry: 20 },
  { m: 'hamstrings', el: 'ellipse', cx: 96, cy: 275, rx: 15, ry: 34 },
  { m: 'hamstrings', el: 'ellipse', cx: 124, cy: 275, rx: 15, ry: 34 },
  { m: 'calves', el: 'ellipse', cx: 96, cy: 345, rx: 12, ry: 26 },
  { m: 'calves', el: 'ellipse', cx: 124, cy: 345, rx: 12, ry: 26 },
]
