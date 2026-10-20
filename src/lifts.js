// Turn a client's saved sessions into per-exercise weight history, so both the
// client and their coach can see how the weights lifted progress over time.

export function parseWeight(w) {
  if (w == null) return null
  const n = parseFloat(String(w).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

// Heaviest weight in an exercise — top set for per-set exercises, else the
// single weight (old format).
export function topWeight(ex) {
  if (Array.isArray(ex.sets)) {
    const ws = ex.sets.map((s) => parseWeight(s.weight)).filter((w) => w != null)
    return ws.length ? Math.max(...ws) : null
  }
  return parseWeight(ex.weight)
}

// Build a { exercise-name -> latest top weight } map from a client's past plans.
// Used to pre-seed the squad board so the coach edits deltas, not every number.
export function latestByName(plans) {
  const map = {}
  for (const l of aggregateLifts(plans)) map[l.name.toLowerCase()] = l.latest
  return map
}

// Pre-fill each set's weight from the athlete's last logged value for that lift,
// unless the prescription already specifies a weight. Returns new exercises.
export function seedWeights(exercises, latestMap) {
  return (exercises || []).map((ex) => {
    const seed = latestMap[(ex.name || '').trim().toLowerCase()]
    if (seed == null) return ex
    const sets = Array.isArray(ex.sets)
      ? ex.sets.map((s) => ({ ...s, weight: (s.weight ?? '') === '' ? String(seed) : s.weight }))
      : ex.sets
    return { ...ex, sets, weight: (ex.weight ?? '') === '' ? String(seed) : ex.weight }
  })
}

// `manual` = rows from lift_entries: weights typed in after the fact (a client
// backdating their starting numbers when they move across from another coach).
// They feed the chart only — never workout_plans — so nothing that reads plan
// history by created_at is disturbed. Matched to a plan lift by trimmed name.
export function aggregateLifts(plans, manual) {
  const byName = {}
  for (const p of plans || []) {
    const when = (p.created_at || '').slice(0, 10)
    for (const ex of p.exercises || []) {
      const wt = topWeight(ex)
      if (wt == null || !ex.name) continue
      const key = ex.name.trim()
      ;(byName[key] = byName[key] || []).push({ weight: wt, date: when })
    }
  }
  for (const m of manual || []) {
    const wt = parseWeight(m.weight)
    if (wt == null || !m.name) continue
    const key = m.name.trim()
    ;(byName[key] = byName[key] || []).push({ weight: wt, date: (m.performed_on || '').slice(0, 10), manual: true })
  }
  return Object.entries(byName)
    .map(([name, points]) => {
      points.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      const weights = points.map((x) => x.weight)
      return { name, points, start: weights[0], latest: weights[weights.length - 1], best: Math.max(...weights), count: points.length }
    })
    .sort((a, b) => b.count - a.count)
}

// Most recent full set (reps + weight) logged per exercise, so a client about to
// train can see exactly what they did last time, not just a pre-filled number.
// Expects plans newest-first (matches every existing history query in the app)
// and keeps the first — i.e. most recent — match per exercise name.
// The last time they actually DID each exercise. Plans arrive newest-first, so
// the first entry carrying logged sets wins and a skipped week is passed over —
// Paul, 6 Oct: "if they miss a session or skip an exercise one week it shows as
// empty the following week."
//
// Skipping an empty week already worked. What did not: a session the COACH
// wrote with target reps and weights, which the client never performed, looked
// exactly like one they had — so "last time" could hand back the coach's own
// prescription as if it were a lift. `completed_at` is what tells them apart.
//
// Two passes, not one. Completed sessions are the truth; everything else is a
// fallback for history logged before that column existed, so an old account does
// not suddenly lose its numbers.
export function lastSetsByName(plans) {
  const list = plans || []
  const loggedSets = (ex) => (Array.isArray(ex.sets)
    ? ex.sets.filter((s) => String(s.reps ?? '').trim() || String(s.weight ?? '').trim())
    : [])
  const map = {}
  const collect = (only) => {
    for (const p of list) {
      if (only && !p.completed_at) continue
      if (!only && p.completed_at) continue
      for (const ex of p.exercises || []) {
        const key = (ex.name || '').trim().toLowerCase()
        if (!key || map[key]) continue
        const sets = loggedSets(ex)
        if (!sets.length) continue
        map[key] = { sets, date: p.completed_at || p.created_at || null, confirmed: !!p.completed_at }
      }
    }
  }
  collect(true)   // sessions we know were done
  collect(false)  // then older history, which predates the marker

  // Rick, 20 Oct: show the best weight ever lifted alongside last time. Same
  // trust rule as above: completed sessions count; an unmarked session counts
  // only if it is older than the first completed one (i.e. it predates the
  // marker), so a coach's unperformed prescription can't pose as a PB.
  const firstDone = list.filter((p) => p.completed_at).map((p) => p.created_at || '').sort()[0]
  for (const p of list) {
    if (!p.completed_at && firstDone && (p.created_at || '') >= firstDone) continue
    for (const ex of p.exercises || []) {
      const key = (ex.name || '').trim().toLowerCase()
      if (!key || !map[key]) continue
      for (const s of loggedSets(ex)) {
        const w = parseWeight(s.weight)
        if (w == null || w <= 0) continue
        const reps = parseInt(String(s.reps ?? ''), 10) || 0
        const cur = map[key].best
        if (!cur || w > cur.weight || (w === cur.weight && reps > cur.reps)) {
          map[key].best = { weight: w, reps, date: p.completed_at || p.created_at || null }
        }
      }
    }
  }
  return map
}
