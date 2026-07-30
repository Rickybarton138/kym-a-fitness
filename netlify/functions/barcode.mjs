// Barcode -> nutrition lookup via Open Food Facts (free, no key).
// POST { barcode } -> { status:'found', product:{ name, unit, per100:{...} } }
//                   -> { status:'not_found' }
// Everything is per 100g; the client scales by the portion the user enters.

const OFF = 'https://world.openfoodfacts.org/api/v2/product/'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const round = (v) => (v == null ? null : Math.round(v))

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only.' })

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON.' }) }

  const barcode = String(body.barcode || '').replace(/\D/g, '')
  if (!barcode) return json(400, { error: 'No barcode provided.' })

  try {
    const res = await fetch(
      OFF + encodeURIComponent(barcode) + '.json?fields=product_name,brands,nutriments',
      { headers: { 'User-Agent': 'CoachedApp/1.0 (coached-by-kim.netlify.app)' } },
    )
    // v2 returns non-200 (or status:0) when the product isn't in the database.
    if (!res.ok) return json(200, { status: 'not_found' })
    const data = await res.json()
    if (!data || data.status === 0 || !data.product) return json(200, { status: 'not_found' })

    const p = data.product
    const n = p.nutriments || {}

    // kcal is frequently absent with only kJ present — derive it.
    let kcal = num(n['energy-kcal_100g'])
    if (kcal == null) {
      const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g'])
      if (kj != null) kcal = kj / 4.184
    }

    // product_name can be empty — fall back to brand, then the barcode itself.
    const name =
      (p.product_name && p.product_name.trim()) ||
      (p.brands && p.brands.split(',')[0].trim()) ||
      ('Item ' + barcode)

    const per100 = {
      calories: round(kcal),
      protein_g: round(num(n['proteins_100g'])),
      carbs_g: round(num(n['carbohydrates_100g'])),
      fat_g: round(num(n['fat_100g'])),
    }

    const serving = num(p.serving_quantity) || null // grams per serving, if the product declares one
    return json(200, { status: 'found', product: { name, unit: 'g', per100, serving } })
  } catch {
    return json(502, { error: 'Could not reach the food database. Try again.' })
  }
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) }
}
