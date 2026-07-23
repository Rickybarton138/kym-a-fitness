// Athlete monitoring: daily readiness (wellness) + training-load (session-RPE).
// Load = RPE (0-10) x duration (min) in arbitrary units (AU). Acute:chronic
// workload ratio (ACWR) = last-7-day load / 28-day weekly average — a common
// injury-risk signal (roughly 0.8-1.3 is the "sweet spot").

export const WELLNESS = [
  { key: 'sleep', label: 'Sleep quality' },
  { key: 'energy', label: 'Energy' },
  { key: 'freshness', label: 'Freshness (low soreness)' },
  { key: 'mood', label: 'Mood' },
  { key: 'motivation', label: 'Motivation' },
]

export function readinessScore(c) {
  const vals = WELLNESS.map((w) => Number(c?.[w.key])).filter((v) => v > 0)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function readinessLight(score) {
  if (score == null) return { key: 'none', label: 'No check-in', color: 'grey' }
  if (score >= 3.8) return { key: 'green', label: 'Ready', color: 'green' }
  if (score >= 2.6) return { key: 'amber', label: 'Caution', color: 'amber' }
  return { key: 'red', label: 'Compromised', color: 'red' }
}

function daysAgo(dateStr, today) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((t - d) / 86400000)
}

export function loadMetrics(loads, today = new Date()) {
  const inWindow = (l, days) => { const a = daysAgo(l.session_on, today); return a >= 0 && a < days }
  const acute = loads.filter((l) => inWindow(l, 7)).reduce((a, l) => a + Number(l.load), 0)
  const chronic = loads.filter((l) => inWindow(l, 28)).reduce((a, l) => a + Number(l.load), 0) / 4
  const acwr = chronic > 0 ? acute / chronic : null
  return { acute: Math.round(acute), chronic: Math.round(chronic), acwr }
}

export function acwrFlag(acwr) {
  if (acwr == null) return { label: 'Building baseline', color: 'grey' }
  if (acwr > 1.5) return { label: 'High — spike risk', color: 'red' }
  if (acwr > 1.3) return { label: 'Elevated', color: 'amber' }
  if (acwr < 0.8) return { label: 'Detraining', color: 'amber' }
  return { label: 'Sweet spot', color: 'green' }
}
