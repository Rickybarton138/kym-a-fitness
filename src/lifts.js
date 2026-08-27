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
export function lastSetsByName(plans) {
  const map = {}
  for (const p of plans || []) {
    for (const ex of p.exercises || []) {
      const key = (ex.name || '').trim().toLowerCase()
      if (!key || map[key]) continue
      const sets = Array.isArray(ex.sets)
        ? ex.sets.filter((s) => String(s.reps ?? '').trim() || String(s.weight ?? '').trim())
        : []
      if (!sets.length) continue
      map[key] = { sets, date: p.created_at || null }
    }
  }
  return map
}
