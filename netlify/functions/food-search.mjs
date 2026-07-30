// Live food search for branded/less-common items, via the free Open Food Facts
// database. Returns normalised per-100g macros. Best-effort — the app falls back
// to its built-in common-foods list if this is unavailable.

export const handler = async (event) => {
  const q = (event.queryStringParameters?.q || '').trim()
  if (q.length < 2) return json(200, { results: [] })
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
      '&search_simple=1&action=process&json=1&page_size=25&sort_by=unique_scans_n' +
      '&fields=product_name,brands,nutriments'
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Coached-by-Kim/1.0 (https://coached-by-kim.netlify.app)',
        'Accept': 'application/json',
      },
    })
    const ct = res.headers.get('content-type') || ''
    if (!res.ok || !ct.includes('json')) return json(200, { results: [] })
    const data = await res.json()
    const results = (data.products || [])
      .map((p) => {
        const n = p.nutriments || {}
        let kcal = n['energy-kcal_100g'] ?? n['energy-kcal']
        if (kcal == null && n['energy_100g'] != null) kcal = Number(n['energy_100g']) / 4.184 // kJ → kcal
        if (kcal == null || !p.product_name) return null
        const name = [p.product_name, p.brands].filter(Boolean).join(' — ').replace(/\s+/g, ' ').trim().slice(0, 72)
        return {
          n: name,
          k: Math.round(Number(kcal)),
          p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g), fb: r1(n.fiber_100g),
          s: 100,
        }
      })
      .filter((r) => r && r.n && r.k > 0 && r.k < 1000)
      .slice(0, 15)
    return json(200, { results })
  } catch {
    return json(200, { results: [] })
  }
}

function r1(v) {
  const n = Number(v)
  return isNaN(n) ? 0 : Math.round(n * 10) / 10
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) }
}
