import test from 'node:test'
import assert from 'node:assert/strict'

// foodQueue reaches for localStorage and window at module scope-free call sites,
// so stand both up before importing it.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
let queuedEvents = 0
globalThis.window = { dispatchEvent: () => { queuedEvents += 1; return true } }
globalThis.CustomEvent = class { constructor(type) { this.type = type } }

const { queueFood, readFoodQueue, clearFoodQueue, flushFoodQueue } = await import('../src/foodQueue.js')

const RICKY = 'd5790573'
const KIM_CLIENT = 'other-client'
const row = (client_id, name) => ({ client_id, source: 'manual', name, calories: 100 })

// A supabase double: `fail` many inserts, then succeed, recording what it took.
function fakeSupabase({ fail = 0 } = {}) {
  const inserted = []
  let left = fail
  return {
    inserted,
    from() {
      return {
        insert(r) {
          const result = left > 0
            ? (left -= 1, { data: null, error: { message: 'Failed to fetch' } })
            : (inserted.push(r), { data: { ...r, id: 'id' + inserted.length, logged_at: '2026-09-15T12:00:00Z' }, error: null })
          return { select: () => ({ single: async () => result }) }
        },
      }
    },
  }
}

test('a row that fails to insert is kept, not lost', () => {
  store.clear()
  assert.equal(queueFood(row(RICKY, 'Omelette')), 1)
  assert.equal(queueFood(row(RICKY, 'Jaffa cakes')), 2)
  assert.deepEqual(readFoodQueue(RICKY).map((e) => e.row.name), ['Omelette', 'Jaffa cakes'])
})

test('queuing tells the app so the banner can appear without a reload', () => {
  store.clear(); queuedEvents = 0
  queueFood(row(RICKY, 'Toast'))
  assert.equal(queuedEvents, 1)
})

test('one account never flushes into another diary', async () => {
  store.clear()
  queueFood(row(RICKY, 'Omelette'))
  queueFood(row(KIM_CLIENT, 'Porridge'))
  const supabase = fakeSupabase()
  const { sent, left, rows } = await flushFoodQueue(supabase, RICKY)
  assert.equal(sent, 1)
  assert.equal(left, 0)
  assert.deepEqual(rows.map((r) => r.name), ['Omelette'])
  assert.deepEqual(supabase.inserted.map((r) => r.name), ['Omelette'])
  // The other client's row is untouched and still waiting.
  assert.deepEqual(readFoodQueue(KIM_CLIENT).map((e) => e.row.name), ['Porridge'])
})

test('still offline: the rows survive the failed flush in order', async () => {
  store.clear()
  queueFood(row(RICKY, 'Omelette'))
  queueFood(row(RICKY, 'Noodles'))
  const { sent, left } = await flushFoodQueue(fakeSupabase({ fail: 99 }), RICKY)
  assert.equal(sent, 0)
  assert.equal(left, 2)
  assert.deepEqual(readFoodQueue(RICKY).map((e) => e.row.name), ['Omelette', 'Noodles'])
})

test('a mid-flush failure keeps the rest and does not re-send what went in', async () => {
  store.clear()
  queueFood(row(RICKY, 'Omelette'))
  queueFood(row(RICKY, 'Noodles'))
  queueFood(row(RICKY, 'Shake'))
  const supabase = fakeSupabase()
  // First goes in, then the connection drops for the rest.
  let calls = 0
  const flaky = {
    from() {
      return {
        insert(r) {
          calls += 1
          const result = calls === 1
            ? (supabase.inserted.push(r), { data: { ...r, id: 'id1' }, error: null })
            : { data: null, error: { message: 'Failed to fetch' } }
          return { select: () => ({ single: async () => result }) }
        },
      }
    },
  }
  const first = await flushFoodQueue(flaky, RICKY)
  assert.equal(first.sent, 1)
  assert.equal(first.left, 2)
  assert.deepEqual(readFoodQueue(RICKY).map((e) => e.row.name), ['Noodles', 'Shake'])
  // Back online: the two that are left go in, and the one already saved is not sent twice.
  const second = await flushFoodQueue(supabase, RICKY)
  assert.equal(second.sent, 2)
  assert.equal(second.left, 0)
  assert.deepEqual(supabase.inserted.map((r) => r.name), ['Omelette', 'Noodles', 'Shake'])
})

test('discard clears only that client', () => {
  store.clear()
  queueFood(row(RICKY, 'Omelette'))
  queueFood(row(KIM_CLIENT, 'Porridge'))
  clearFoodQueue(RICKY)
  assert.equal(readFoodQueue(RICKY).length, 0)
  assert.equal(readFoodQueue(KIM_CLIENT).length, 1)
})

test('a corrupt queue reads as empty rather than throwing', () => {
  store.clear()
  store.set('cbk_food_queue', '{not json')
  assert.deepEqual(readFoodQueue(RICKY), [])
})
