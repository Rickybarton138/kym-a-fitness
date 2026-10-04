// Europe/London civil dates, correct in a UTC process.
//
// This exists because a Netlify function runs in UTC and the app's users are in
// the UK. `new Date().toISOString().slice(0, 10)` inside a function is a day out
// for every London clock hour from 23:00 to midnight through British Summer
// Time, which is exactly when somebody logs their dinner. The same bug in
// reverse makes a "today" query return yesterday's rows.
//
// So: every day boundary in the coaching engine goes through here, and nothing
// in the engine uses the host's local timezone or a fixed offset.
//
// No imports — this is read by Netlify functions as well as the app.

export const ZONE = 'Europe/London'

// en-CA gives YYYY-MM-DD, which is the one locale format that needs no
// rearranging. The timeZone option is what does the real work: the Intl data
// knows when the clocks went forward, so this is DST-correct by construction
// rather than by arithmetic I would have to maintain.
const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
})
const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE, hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** The London civil date of an instant, as 'YYYY-MM-DD'. */
export function londonDay(at = new Date()) {
  return dayFmt.format(at instanceof Date ? at : new Date(at))
}

/** London wall-clock parts of an instant: { y, m, d, hour, minute, second }. */
export function londonParts(at = new Date()) {
  const out = {}
  for (const p of partsFmt.formatToParts(at instanceof Date ? at : new Date(at))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  // `hour: '2-digit'` with hour12 false renders midnight as 24 in some ICU
  // versions. Normalise it, or a quiet-hours check at 00:30 compares 24 > 21.
  const hour = out.hour === 24 ? 0 : out.hour
  return { y: out.year, m: out.month, d: out.day, hour, minute: out.minute, second: out.second }
}

/** The London wall-clock hour of an instant, 0-23. */
export function londonHour(at = new Date()) {
  return londonParts(at).hour
}

// The offset London is at, at a given instant, in minutes (0 in winter, 60 in
// summer). Derived by asking what the London wall clock says and comparing with
// the UTC wall clock, which avoids hard-coding the DST rules.
function offsetMinutes(at) {
  const p = londonParts(at)
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute, p.second)
  return Math.round((asUTC - Math.floor(at.getTime() / 1000) * 1000) / 60000)
}

/**
 * The instant a London civil day starts (00:00 London), as a Date in UTC terms.
 *
 * Two passes: guess with the offset in force at midday of that date, then
 * recompute with the offset actually in force at the guessed instant. That
 * second pass is what gets the two clock-change days right — on 29 March 2026
 * midnight is 00:00 GMT, not 00:00 BST.
 */
export function londonDayStart(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMinutes(noonUTC) * 60000)
  const settled = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMinutes(guess) * 60000)
  return settled
}

/** [startInclusive, endExclusive) as Dates for one London civil day. */
export function londonDayBounds(day) {
  return [londonDayStart(day), londonDayStart(addDays(day, 1))]
}

/** Shift a 'YYYY-MM-DD' by whole days. Calendar arithmetic, not 86400000. */
export function addDays(day, n) {
  const [y, m, d] = String(day).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/** Whole days between two 'YYYY-MM-DD' values (b - a). */
export function daysBetween(a, b) {
  const at = Date.UTC(...String(a).split('-').map(Number).map((v, i) => (i === 1 ? v - 1 : v)))
  const bt = Date.UTC(...String(b).split('-').map(Number).map((v, i) => (i === 1 ? v - 1 : v)))
  return Math.round((bt - at) / 86400000)
}

/** Day of week for a civil date: 1 = Monday … 7 = Sunday (ISO). */
export function isoDow(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return js === 0 ? 7 : js
}

/**
 * The Monday of the week containing `day`.
 * Weeks start Monday because that is what a UK coach means by "last week", and
 * the rest of the app already decided this (`mondayOf` in FoodDiary).
 */
export function weekStart(day) {
  return addDays(day, -(isoDow(day) - 1))
}

/** The last COMPLETE Monday-Sunday week before the week containing `day`. */
export function lastCompleteWeek(day) {
  const thisMonday = weekStart(day)
  const start = addDays(thisMonday, -7)
  return { start, end: addDays(start, 6) }
}

/** An inclusive list of civil dates from `from` to `to`. */
export function dayRange(from, to) {
  const out = []
  for (let d = from; daysBetween(d, to) >= 0; d = addDays(d, 1)) out.push(d)
  return out
}

/** How old something is, in whole minutes, floored at 0. */
export function minutesSince(iso, now = new Date()) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.round((now.getTime() - then) / 60000))
}

/**
 * Is `at` inside a quiet window expressed in London wall-clock time?
 * Handles the overnight case (21:30 to 07:30) as well as a same-day window.
 */
export function inQuietHours(at, from = '21:30', to = '07:30') {
  const p = londonParts(at)
  const mins = p.hour * 60 + p.minute
  const [fh, fm] = String(from).split(':').map(Number)
  const [th, tm] = String(to).split(':').map(Number)
  const f = fh * 60 + (fm || 0)
  const t = th * 60 + (tm || 0)
  return f <= t ? mins >= f && mins < t : mins >= f || mins < t
}

/** 'Mon 4 Oct' for display. */
export function prettyDay(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  })
}
