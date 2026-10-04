import test from 'node:test'
import assert from 'node:assert/strict'
import {
  londonDay, londonHour, londonDayStart, londonDayBounds, addDays, daysBetween,
  isoDow, weekStart, lastCompleteWeek, inQuietHours, minutesSince, dayRange,
} from '../src/coachTime.js'

// These run in whatever timezone the machine is in, which is the point: the
// coaching functions run in UTC and the users are in London, so every assertion
// below is about London civil time and none of it may depend on the host clock.
// UK clock changes in 2026: forward Sun 29 March, back Sun 25 October.

test('a London day starts at the right instant in winter and summer', () => {
  assert.equal(londonDayStart('2026-01-15').toISOString(), '2026-01-15T00:00:00.000Z')
  assert.equal(londonDayStart('2026-07-15').toISOString(), '2026-07-14T23:00:00.000Z')
})

test('the two clock-change days are not an hour out', () => {
  // Spring forward: midnight is still GMT, the jump happens at 01:00.
  assert.equal(londonDayStart('2026-03-29').toISOString(), '2026-03-29T00:00:00.000Z')
  // Autumn back: midnight is still BST, the jump happens at 02:00.
  assert.equal(londonDayStart('2026-10-25').toISOString(), '2026-10-24T23:00:00.000Z')
  // And the day before each, for the boundary either side.
  assert.equal(londonDayStart('2026-03-28').toISOString(), '2026-03-28T00:00:00.000Z')
  assert.equal(londonDayStart('2026-10-24').toISOString(), '2026-10-23T23:00:00.000Z')
})

test('late evening in summer is still today, not tomorrow', () => {
  // 22:30Z is 23:30 London. The naive toISOString().slice(0,10) says the 15th
  // too, so this one passes either way…
  assert.equal(londonDay(new Date('2026-07-15T22:30:00Z')), '2026-07-15')
  // …and this is the one that catches it: 23:30Z is 00:30 on the 16th in
  // London, and a UTC-based date would still say the 15th.
  assert.equal(londonDay(new Date('2026-07-15T23:30:00Z')), '2026-07-16')
  assert.equal(londonHour(new Date('2026-07-15T23:30:00Z')), 0)
})

test('a day bounds exactly 24 hours, except on the days it does not', () => {
  const [s1, e1] = londonDayBounds('2026-07-15')
  assert.equal((e1 - s1) / 3600000, 24)
  const [s2, e2] = londonDayBounds('2026-03-29')
  assert.equal((e2 - s2) / 3600000, 23, 'the day the clocks go forward is 23 hours long')
  const [s3, e3] = londonDayBounds('2026-10-25')
  assert.equal((e3 - s3) / 3600000, 25, 'the day the clocks go back is 25 hours long')
})

test('day arithmetic crosses a clock change without drifting', () => {
  assert.equal(addDays('2026-03-28', 1), '2026-03-29')
  assert.equal(addDays('2026-03-29', 1), '2026-03-30')
  assert.equal(addDays('2026-10-25', -1), '2026-10-24')
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2)
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2)
  assert.equal(daysBetween('2026-10-04', '2026-10-04'), 0)
})

test('weeks start on Monday and a complete week is the one before this one', () => {
  assert.equal(isoDow('2026-10-05'), 1, 'Monday')
  assert.equal(isoDow('2026-10-04'), 7, 'Sunday')
  assert.equal(weekStart('2026-10-04'), '2026-09-28', 'Sunday belongs to the week that began the Monday before')
  assert.equal(weekStart('2026-10-05'), '2026-10-05')
  assert.deepEqual(lastCompleteWeek('2026-10-04'), { start: '2026-09-21', end: '2026-09-27' })
  // On the Monday, last week is the one that just finished.
  assert.deepEqual(lastCompleteWeek('2026-10-05'), { start: '2026-09-28', end: '2026-10-04' })
})

test('quiet hours wrap around midnight', () => {
  // 00:30 London is inside 21:30-07:30.
  assert.equal(inQuietHours(new Date('2026-07-15T23:30:00Z')), true)
  // 12:00 London is not.
  assert.equal(inQuietHours(new Date('2026-07-15T11:00:00Z')), false)
  // 21:00 London is not; 22:00 is.
  assert.equal(inQuietHours(new Date('2026-07-15T20:00:00Z')), false)
  assert.equal(inQuietHours(new Date('2026-07-15T21:00:00Z')), true)
  // A same-day window still works.
  assert.equal(inQuietHours(new Date('2026-07-15T11:00:00Z'), '10:00', '14:00'), true)
  assert.equal(inQuietHours(new Date('2026-07-15T14:00:00Z'), '10:00', '14:00'), false)
})

test('freshness is in minutes and never negative', () => {
  const now = new Date('2026-10-04T12:00:00Z')
  assert.equal(minutesSince('2026-10-04T11:30:00Z', now), 30)
  assert.equal(minutesSince('2026-10-04T12:30:00Z', now), 0, 'a future stamp is 0, not -30')
  assert.equal(minutesSince(null, now), null)
  assert.equal(minutesSince('not a date', now), null)
})

test('a day range is inclusive and crosses a clock change', () => {
  assert.deepEqual(dayRange('2026-03-28', '2026-03-30'), ['2026-03-28', '2026-03-29', '2026-03-30'])
  assert.deepEqual(dayRange('2026-10-04', '2026-10-04'), ['2026-10-04'])
})
