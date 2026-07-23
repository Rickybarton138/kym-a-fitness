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

export function aggregateLifts(plans) {
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
  return Object.entries(byName)
    .map(([name, points]) => {
      points.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      const weights = points.map((x) => x.weight)
      return { name, points, latest: weights[weights.length - 1], best: Math.max(...weights), count: points.length }
    })
    .sort((a, b) => b.count - a.count)
}
