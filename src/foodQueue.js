// A food log that fails to save must not vanish.
//
// 15 Sept 2026: a full day of food went in and none of it was there afterwards.
// Nothing had been deleted - the inserts never reached Supabase at all, and two
// things together hid that. `logFood` destructured only `data` and threw the
// error away, and FoodSearch showed its "logged" confirmation without waiting
// for the insert. A dropped connection therefore looked identical to a saved
// meal.
//
// So anything that does not reach the server is parked here, in localStorage,
// and retried on the next app load and whenever the device comes back online.
// Every entry carries its own client_id, so a queue written by one account can
// never be flushed into another's diary - these apps are shared devices as often
// as not (a coach signing in to check something on a client's phone).
//
// Retrying can in principle duplicate a row: if the insert succeeded but the
// response was lost, we queue something the server already has. That trade is
// deliberate - a duplicate is visible and one tap to delete, a silently missing
// meal is neither.

const KEY = 'cbk_food_queue'

function readAll() {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

function writeAll(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private mode, full disc: the caller still has its error */ }
}

/** Entries waiting to sync for one client, oldest first. */
export function readFoodQueue(clientId) {
  return readAll().filter((e) => e && e.row && e.row.client_id === clientId)
}

/** Park a row that did not save. Returns how many are now waiting for that client. */
export function queueFood(row) {
  if (!row || !row.client_id) return 0
  const list = readAll()
  list.push({ row, at: Date.now(), tries: 0 })
  writeAll(list)
  // Anywhere can park a row (Home logs one, the diary logs another), but only
  // ClientApp shows the banner - this is how it hears about it.
  try { window.dispatchEvent(new CustomEvent('cbk-food-queued')) } catch { /* no window: nothing to tell */ }
  return list.filter((e) => e.row.client_id === row.client_id).length
}

/** Drop everything waiting for one client (the "discard" the banner offers). */
export function clearFoodQueue(clientId) {
  writeAll(readAll().filter((e) => !(e && e.row && e.row.client_id === clientId)))
}

/**
 * Try the waiting rows for one client, oldest first.
 * Returns { sent, left, rows } - `rows` being the inserted rows, so the caller
 * can fold today's back into the screen without a refetch.
 */
export async function flushFoodQueue(supabase, clientId) {
  const all = readAll()
  const mine = all.filter((e) => e && e.row && e.row.client_id === clientId)
  if (mine.length === 0) return { sent: 0, left: 0, rows: [] }

  const done = new Set()
  const rows = []
  for (const entry of mine) {
    const { data, error } = await supabase.from('nutrition_logs').insert(entry.row).select().single()
    if (error) {
      entry.tries = (entry.tries || 0) + 1
      // Stop at the first failure: if the connection is down, the rest will fail
      // the same way, and hammering it only burns battery.
      break
    }
    done.add(entry)
    if (data) rows.push(data)
  }

  const left = all.filter((e) => !done.has(e))
  writeAll(left)
  return { sent: done.size, left: left.filter((e) => e.row.client_id === clientId).length, rows }
}
