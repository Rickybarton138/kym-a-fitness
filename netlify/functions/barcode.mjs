// Barcode -> nutrition lookup via Open Food Facts (free, no key).
// POST { barcode }            -> { status:'found', product:{ name, unit, per100:{...} } }
// POST { image, mediaType }   -> reads the number off a photo first, then looks it up
//                            -> { status:'not_found' }
// Everything is per 100g; the client scales by the portion the user enters.
//
// The photo path exists because BarcodeDetector is Chromium-only: on iPhone the
// screen said "scan the barcode" with no way to scan one. Every EAN/UPC has its
// digits printed underneath, so reading those off a photo works on any device.

import { firstText } from './_claude-text.mjs'

const OFF = 'https://world.openfoodfacts.org/api/v2/product/'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const VISION_MODEL = 'claude-haiku-4-5-20251001'

// EAN-8, EAN-13 and UPC-A all carry the same mod-10 check digit. Validating it
// is what makes reading digits off a photo safe: a misread almost always fails
// the checksum, so we say "couldn't read that" instead of confidently looking up
// somebody else's product.
function checksumOk(d) {
  const digits = d.split('').map(Number)
  const check = digits.pop()
  const sum = digits.reverse().reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

async function readBarcodeFromImage(image, mediaType) {
  if (!ANTHROPIC_KEY) return null
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
          { type: 'text', text: 'Read the barcode number printed on this product — the digits below the bars. Reply with ONLY the digits, no spaces or other text. If you cannot read a full barcode number, reply NONE.' },
        ],
      }],
    }),
  })
  if (!res.ok) return null
  const j = await res.json()
  const text = String(firstText(j, ''))
  const digits = text.replace(/\D/g, '')
  const plausible = [8, 12, 13].includes(digits.length) && checksumOk(digits)
  return { digits: plausible ? digits : null, raw: text.trim().slice(0, 40) }
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const round = (v) => (v == null ? null : Math.round(v))

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only.' })

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON.' }) }

  let barcode = String(body.barcode || '').replace(/\D/g, '')
  if (!barcode && body.image) {
    try {
      const r = await readBarcodeFromImage(body.image, body.mediaType)
      barcode = r?.digits || ''
      if (!barcode) return json(200, { status: 'unreadable', read: r?.raw || null })
    } catch (e) { return json(200, { status: 'unreadable', read: 'error: ' + String(e.message || e).slice(0, 60) }) }
  }
  if (!barcode) return json(400, { error: 'No barcode provided.' })

  try {
    const res = await fetch(
      OFF + encodeURIComponent(barcode) + '.json?fields=product_name,brands,nutriments',
      { headers: { 'User-Agent': 'CoachedApp/1.0 (coached-by-kim.netlify.app)' } },
    )
    // v2 returns non-200 (or status:0) when the product isn't in the database.
    if (!res.ok) return json(200, { status: 'not_found', barcode })
    const data = await res.json()
    if (!data || data.status === 0 || !data.product) return json(200, { status: 'not_found', barcode })

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
      fibre_g: round(num(n['fiber_100g'])),
    }

    const serving = num(p.serving_quantity) || null // grams per serving, if the product declares one
    return json(200, { status: 'found', barcode, product: { name, unit: 'g', per100, serving } })
  } catch {
    return json(502, { error: 'Could not reach the food database. Try again.' })
  }
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) }
}
