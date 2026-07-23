// Youth growth & maturation. Estimates maturity offset (years from Peak Height
// Velocity) using the Mirwald et al. (2002) sex-specific equations — the standard
// non-invasive method in youth S&C — from age, standing height, sitting height and
// mass. It is an ESTIMATE (most valid roughly ages 8-16, near average maturity)
// and never replaces qualified assessment.

export function ageYears(fromDate, toDate) {
  if (!fromDate || !toDate) return null
  const a = new Date(fromDate + 'T00:00:00'), b = new Date(toDate + 'T00:00:00')
  return (b - a) / (365.25 * 86400000)
}

// Mirwald 2002 maturity offset (years from PHV). Negative = before PHV.
export function maturityOffset({ sex, age, height, sittingHeight, weight }) {
  if (![age, height, sittingHeight, weight].every((v) => Number(v) > 0)) return null
  const legLength = Number(height) - Number(sittingHeight)
  const whRatio = (Number(weight) / Number(height)) * 100
  const a = Number(age), sh = Number(sittingHeight)
  if (sex === 'F') {
    return -9.376
      + 0.0001882 * (legLength * sh)
      + 0.0022 * (a * legLength)
      + 0.005841 * (a * sh)
      - 0.002658 * (a * Number(weight))
      + 0.07693 * whRatio
  }
  return -9.236
    + 0.0002708 * (legLength * sh)
    - 0.001663 * (a * legLength)
    + 0.007216 * (a * sh)
    + 0.02292 * whRatio
}

export function maturityPhase(offset) {
  if (offset == null) return { key: 'none', label: '—', color: 'grey' }
  if (offset < -1) return { key: 'pre', label: 'Pre-PHV', color: 'green' }
  if (offset <= 1) return { key: 'circa', label: 'Circa-PHV (peak growth)', color: 'amber' }
  return { key: 'post', label: 'Post-PHV', color: 'green' }
}

// Latest growth velocity in cm/year from the last two height measurements.
export function growthVelocity(measurements) {
  const withH = (measurements || []).filter((m) => Number(m.height_cm) > 0)
  if (withH.length < 2) return null
  const a = withH[withH.length - 2], b = withH[withH.length - 1]
  const dt = ageYears(a.measured_on, b.measured_on)
  if (!dt || dt <= 0) return null
  return (Number(b.height_cm) - Number(a.height_cm)) / dt
}

export function growthGuidance(phaseKey) {
  switch (phaseKey) {
    case 'pre':
      return 'Pre-PHV is a great window for skill, coordination, speed and agility. Build fundamental movement skills and technique-led strength (bodyweight and light loads). Keep training varied and enjoyable, and avoid early specialisation.'
    case 'circa':
      return 'Circa-PHV (the peak of the growth spurt): coordination can dip temporarily and injury risk rises, including growth-plate issues such as Osgood-Schlatter and Sever’s. Prioritise mobility and clean technique, manage training volume and impact, keep monitoring soreness and readiness, and fuel the growth spurt well. Progress strength carefully rather than chasing loads.'
    case 'post':
      return 'Post-PHV the body tolerates more structured strength and power work. Progress loading individually, hold high technique standards, and keep monitoring load and recovery.'
    default:
      return 'Add date of birth, sex and a few measurements to estimate maturation and get phase-appropriate guidance.'
  }
}
