import test from 'node:test'
import assert from 'node:assert/strict'
import { newTimers, changeTimer, remainingMs, restoreTimers, timerStorageKey, formatTimer } from '../src/workoutTimers.js'

test('countdown uses actual elapsed time after phone suspension and reload', () => {
  const state = newTimers()
  state.rest = changeTimer(state.rest, 'start', 1000)
  const restored = restoreTimers(JSON.stringify(state))
  assert.equal(remainingMs(restored.rest, 61000), 30000)
  assert.equal(changeTimer(restored.rest, 'tick', 100000).status, 'done')
  assert.equal(remainingMs(restored.rest, 100000), 0)
})

test('pausing and resuming retain the exact remaining duration', () => {
  let t = changeTimer(newTimers().exercise, 'start', 1000)
  t = changeTimer(t, 'pause', 11250)
  assert.equal(t.remainingMs, 19750)
  assert.equal(remainingMs(t, 1000000), 19750)
  t = changeTimer(t, 'start', 1000000)
  assert.equal(t.endAt, 1019750)
  assert.equal(changeTimer(t, 'pause', 1020000).status, 'done')
})

test('rest and exercise run independently and auto-rest can restart a full rest', () => {
  const state = newTimers()
  state.rest = changeTimer(state.rest, 'start', 1000)
  state.exercise = changeTimer(state.exercise, 'start', 2000)
  const oldExercise = state.exercise
  state.rest = changeTimer(state.rest, 'restart', 11000)
  assert.equal(state.rest.endAt, 101000)
  assert.equal(state.exercise, oldExercise)
  assert.equal(remainingMs(state.exercise, 11000), 21000)
  assert.equal(changeTimer(state.rest, 'start', 12000), state.rest)
})

test('completion happens once, and reset or a fresh start gives the full duration', () => {
  let t = changeTimer(newTimers().exercise, 'start', 1000)
  t = changeTimer(t, 'tick', 32000)
  assert.equal(t.status, 'done')
  assert.equal(changeTimer(t, 'tick', 33000), t)
  assert.equal(changeTimer(t, 'start', 40000).endAt, 70000)
  assert.deepEqual(changeTimer(t, 'reset'), newTimers().exercise)
})

test('custom durations are bounded and corrupt stored timers do not break the player', () => {
  const t = newTimers().exercise
  for (const n of [0, -1, Infinity, NaN, 1.5, 3601]) assert.equal(changeTimer(t, 'duration', 0, n), t)
  assert.equal(changeTimer(t, 'duration', 0, 45).remainingMs, 45000)
  assert.deepEqual(restoreTimers('{broken'), newTimers())
  assert.deepEqual(restoreTimers(JSON.stringify({ ...newTimers(), rest: { ...t, status: 'running', endAt: null } })), newTimers())
  assert.notEqual(timerStorageKey('rick', 'ricky', 'one'), timerStorageKey('other', 'ricky', 'one'))
  assert.notEqual(timerStorageKey('rick', 'ricky', 'one'), timerStorageKey('rick', 'ricky', 'two'))
  assert.notEqual(timerStorageKey('rick', 'ricky', 'one'), timerStorageKey('rick', 'paul', 'one'))
  assert.equal(formatTimer(1), '0:01'); assert.equal(formatTimer(90000), '1:30'); assert.equal(formatTimer(-1), '0:00')
})
