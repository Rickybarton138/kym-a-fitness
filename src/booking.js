// Class booking helpers. A "class" is a recurring weekly template (gym_classes);
// a bookable "session" is a class on a specific date. We expand the timetable into
// the next N days on the client so members book against a concrete date.

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Local yyyy-mm-dd (avoids UTC off-by-one from toISOString).
export function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// "HH:MM:SS" or "HH:MM" -> "7:30am"
export function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')}${ap}`
}

// Nice date label for a session, e.g. "Today", "Tomorrow", "Mon 22 Jul".
export function dayLabel(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((d - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`
}

// Expand active classes into dated sessions across the next `days` days (incl. today).
// Skips sessions whose start time has already passed today. Sorted by date then time.
export function upcomingSessions(classes, days = 7) {
  const out = []
  const now = new Date()
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  for (let i = 0; i < days; i++) {
    const d = new Date(startOfDay); d.setDate(startOfDay.getDate() + i)
    const wd = d.getDay()
    const dateStr = ymd(d)
    for (const c of classes) {
      if (!c.active || c.weekday !== wd) continue
      if (i === 0) {
        const [h, m] = (c.start_time || '00:00').split(':').map(Number)
        const start = new Date(d); start.setHours(h, m, 0, 0)
        if (start < now) continue // today's class already started
      }
      out.push({ cls: c, dateStr })
    }
  }
  out.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || (a.cls.start_time || '').localeCompare(b.cls.start_time || ''))
  return out
}

export function bookingKey(classId, dateStr) { return classId + '|' + dateStr }
