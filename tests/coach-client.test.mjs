import test from 'node:test'
import assert from 'node:assert/strict'
import { createGuard } from '../src/coachGuard.js'

// The guard is the testable half of coachClient: the rest of that module imports
// supabaseClient, which needs Vite's import.meta.env and cannot load in node, so
// the guard lives in coachGuard.js and coachClient re-exports it.

test('a slower earlier response cannot overwrite newer guidance', async () => {
  const guard = createGuard()

  // Two requests in flight; the first is slower.
  const slow = guard.begin()
  const fast = guard.begin()

  assert.equal(guard.isCurrent(fast), true)
  assert.equal(guard.isCurrent(slow), false, 'the older ticket is already stale')

  // Simulate both landing, fast first then slow.
  const applied = []
  const settle = (ticket, value) => { if (guard.isCurrent(ticket)) applied.push(value) }
  settle(fast, 'new guidance')
  settle(slow, 'old guidance')

  assert.deepEqual(applied, ['new guidance'])
})

test('a third request supersedes both of the first two', () => {
  const guard = createGuard()
  const a = guard.begin(), b = guard.begin(), c = guard.begin()
  assert.deepEqual([guard.isCurrent(a), guard.isCurrent(b), guard.isCurrent(c)], [false, false, true])
})

test('guards are independent per component', () => {
  const one = createGuard(), two = createGuard()
  const t1 = one.begin()
  two.begin()
  assert.equal(one.isCurrent(t1), true, 'another component starting a request does not stale mine')
})
