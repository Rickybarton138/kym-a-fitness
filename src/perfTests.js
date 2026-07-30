// Athletic performance tests PPH run — grouped by quality. lowerBetter flags
// timed tests (faster = better) so PBs and deltas read correctly.
export const PERF_TESTS = [
  { key: 'sprint_10', name: '10m Sprint', unit: 's', lowerBetter: true, group: 'Speed' },
  { key: 'sprint_20', name: '20m Sprint', unit: 's', lowerBetter: true, group: 'Speed' },
  { key: 'sprint_40', name: '40m Sprint', unit: 's', lowerBetter: true, group: 'Speed' },
  { key: 'cmj', name: 'Countermovement Jump', unit: 'cm', lowerBetter: false, group: 'Power' },
  { key: 'broad_jump', name: 'Broad Jump', unit: 'cm', lowerBetter: false, group: 'Power' },
  { key: 'agility_505', name: '505 Agility', unit: 's', lowerBetter: true, group: 'Agility' },
  { key: 'ttest', name: 'T-Test Agility', unit: 's', lowerBetter: true, group: 'Agility' },
  { key: 'squat_1rm', name: 'Back Squat 1RM', unit: 'kg', lowerBetter: false, group: 'Strength' },
  { key: 'bench_1rm', name: 'Bench Press 1RM', unit: 'kg', lowerBetter: false, group: 'Strength' },
  { key: 'deadlift_1rm', name: 'Deadlift 1RM', unit: 'kg', lowerBetter: false, group: 'Strength' },
  { key: 'grip', name: 'Grip Strength', unit: 'kg', lowerBetter: false, group: 'Strength' },
  { key: 'yoyo', name: 'Yo-Yo / Bleep Level', unit: 'level', lowerBetter: false, group: 'Endurance' },
  { key: 'vo2', name: 'VO2 Max', unit: 'ml/kg/min', lowerBetter: false, group: 'Endurance' },
  // Hyrox — the eight stations (time to complete), the 1km run, and full-sim time.
  { key: 'hyrox_sim', name: 'Hyrox Simulation (full)', unit: 'min', lowerBetter: true, group: 'Hyrox' },
  { key: 'run_1k', name: '1km Run', unit: 's', lowerBetter: true, group: 'Hyrox' },
  { key: 'ski_1000', name: 'SkiErg 1000m', unit: 's', lowerBetter: true, group: 'Hyrox' },
  { key: 'sled_push_50', name: 'Sled Push 50m', unit: 's', lowerBetter: true, group: 'Hyrox' },
  { key: 'sled_pull_50', name: 'Sled Pull 50m', unit: 's', lowerBetter: true, group: 'Hyrox' },
  { key: 'burpee_bj_80', name: 'Burpee Broad Jump 80m', unit: 's', lowerBetter: true, group: 'Hyrox' },
  { key: 'row_1000', name: 'Row 1000m', unit: 's', lowerBetter: true, group: 'Hyrox' },
  { key: 'farmers_200', name: 'Farmers Carry 200m', unit: 's', lowerBetter: true, group: 'Hyrox' },
  { key: 'sandbag_lunge_100', name: 'Sandbag Lunge 100m', unit: 's', lowerBetter: true, group: 'Hyrox' },
  { key: 'wall_balls_100', name: 'Wall Balls (100)', unit: 's', lowerBetter: true, group: 'Hyrox' },
]

export const TEST_BY_KEY = Object.fromEntries(PERF_TESTS.map((t) => [t.key, t]))

export const TEST_GROUPS = PERF_TESTS.reduce((acc, t) => {
  (acc[t.group] = acc[t.group] || []).push(t)
  return acc
}, {})

// Best result so far for a set of same-test rows (min for timed, max otherwise).
export function bestValue(rows, lowerBetter) {
  const vals = rows.map((r) => Number(r.value))
  return lowerBetter ? Math.min(...vals) : Math.max(...vals)
}
