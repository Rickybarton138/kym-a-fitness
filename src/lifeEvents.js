// Wave 3 client-life logic: event countdowns + holiday mode, birthday &
// anniversary milestones, and menstrual-cycle prediction. Pure functions so
// they're unit-testable and shared by the coach and client views.

const DAY = 86400000
const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const parseDate = (s) => midnight(new Date(s + 'T00:00:00'))

// --- Countdowns + holidays --------------------------------------------------

// Whole weeks + days from today until a date. Past dates return null.
export function countdown(dateStr, today = new Date()) {
  if (!dateStr) return null
  const t0 = midnight(today)
  const target = parseDate(dateStr)
  const days = Math.round((target - t0) / DAY)
  if (days < 0) return null
  const weeks = Math.floor(days / 7)
  let text
  if (days === 0) text = 'Today'
  else if (days === 1) text = 'Tomorrow'
  else if (days < 14) text = `${days} days to go`
  else text = `${weeks} weeks to go`
  return { days, weeks, text }
}

// The active holiday (start..end inclusive) covering today, if any.
export function activeHoliday(events, today = new Date()) {
  const t0 = midnight(today)
  return (events || []).find((e) => {
    if (e.kind !== 'holiday' || !e.end_date) return false
    return parseDate(e.start_date) <= t0 && t0 <= parseDate(e.end_date)
  }) || null
}

// --- Birthday + anniversary -------------------------------------------------

export function birthdayToday(dobStr, today = new Date()) {
  if (!dobStr) return false
  const d = parseDate(dobStr); const t = midnight(today)
  return d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

// Milestone anniversaries from a join date: 6 months, then whole years.
export function anniversaryToday(sinceStr, today = new Date()) {
  if (!sinceStr) return null
  const since = parseDate(sinceStr); const t = midnight(today)
  if (t <= since) return null
  // 6-month mark
  const sixMo = new Date(since); sixMo.setMonth(sixMo.getMonth() + 6)
  if (sixMo.getTime() === t.getTime()) return '6 months'
  // whole-year marks on the join day/month
  if (since.getDate() === t.getDate() && since.getMonth() === t.getMonth()) {
    const years = t.getFullYear() - since.getFullYear()
    if (years >= 1) return years === 1 ? '1 year' : `${years} years`
  }
  return null
}

// --- Menstrual cycle --------------------------------------------------------

// Given the logged period-start dates, predict the next period and today's
// phase. Cycle length = mean of recent sane gaps (21-40d), else 28.
export function cycleInsight(starts, today = new Date()) {
  const ds = [...new Set((starts || []).filter(Boolean))].map(parseDate).sort((a, b) => a - b)
  if (ds.length === 0) return null
  const last = ds[ds.length - 1]
  let avg = 28
  if (ds.length >= 2) {
    const gaps = []
    for (let i = 1; i < ds.length; i++) gaps.push(Math.round((ds[i] - ds[i - 1]) / DAY))
    const sane = gaps.filter((g) => g >= 21 && g <= 40)
    if (sane.length) avg = Math.round(sane.reduce((a, b) => a + b, 0) / sane.length)
  }
  const t0 = midnight(today)
  const sinceLast = Math.floor((t0 - last) / DAY)
  const overdue = sinceLast > avg + 3
  const dayOfCycle = (((sinceLast % avg) + avg) % avg) + 1 // 1-based, safe for any sign
  let next = new Date(last)
  while (next < t0) next.setDate(next.getDate() + avg)
  const daysToNext = Math.round((next - t0) / DAY)
  const ovulation = avg - 14 // ~14 days before the next period
  let phase
  if (dayOfCycle <= 5) phase = 'Menstrual'
  else if (dayOfCycle < ovulation - 1) phase = 'Follicular'
  else if (dayOfCycle <= ovulation + 1) phase = 'Ovulation'
  else phase = 'Luteal'
  // Luteal window (post-ovulation to next period) as day numbers.
  const lutealFrom = ovulation + 2
  return { avg, lastStart: last, next, daysToNext, dayOfCycle, phase, overdue, lutealFrom }
}

export const PHASE_NOTE = {
  Menstrual: 'Energy can dip — keep sessions steady, no need to push PBs.',
  Follicular: 'Energy climbing — a great window to progress load and intensity.',
  Ovulation: 'Peak energy — go for strength and harder sessions.',
  Luteal: 'Energy tapers, appetite may rise — steady training, extra protein & rest.',
}
