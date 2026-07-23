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
