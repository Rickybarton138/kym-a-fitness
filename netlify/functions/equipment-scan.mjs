// Read photos of a space and list the training kit that is actually in them.
//
// Paul, twice on 4 Sept: "could I upload images of their equipment and the ai
// build the session around what they have?" and, for standard clients, "if it's
// home gym they could upload photos of what they have".
//
// This deliberately does NOT generate a session. It returns a LIST, which the
// person then reviews and corrects before anything is built from it. A misread
// dumbbell rack would otherwise silently shape twelve weeks of someone's
// training, and nobody would ever know why the programme was wrong. Same rule
// as the barcode reader: an uncertain read is handed back, not acted on.
//
// Haiku vision, like the barcode reader — naming gym kit is easy recognition,
// nothing like the macro estimation that justifies Opus.

const VISION_MODEL = 'claude-haiku-4-5-20251001'
const API_URL = 'https://api.anthropic.com/v1/messages'
const MAX_IMAGES = 4

const cors = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) })

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return json(503, { error: 'AI is not configured on the server.' })

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad request.' }) }

  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : []
  if (!images.length) return json(400, { error: 'Add at least one photo.' })

  const content = []
  for (const im of images) {
    const data = typeof im === 'string' ? im : im?.data
    if (!data) continue
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: (im && im.mediaType) || 'image/jpeg', data },
    })
  }
  if (!content.length) return json(400, { error: 'Those photos could not be read.' })

  content.push({
    type: 'text',
    text: `These photos show where someone trains. List the training equipment you can actually SEE.

Rules:
- Only what is visible. Do not infer what a gym "would have", and do not pad the list.
- Name things the way a coach would write them on a plan: "adjustable dumbbells", "flat bench", "squat rack", "resistance bands", "kettlebell", "pull-up bar", "treadmill".
- Merge duplicates across the photos into one entry.
- If you can see a weight range or a number, include it: "dumbbells 5-25kg", "2 kettlebells".
- Bodyweight-only counts: if there is no equipment at all, return an empty list and say so in the note.

Return STRICT JSON only, no markdown:
{"items":["..."],"note":"<one short sentence on what kind of space this looks like, e.g. 'A home garage gym with free weights and a rack.'>"}`,
  })

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 700,
        messages: [{ role: 'user', content }],
      }),
    })
    const data = await res.json()
    if (!res.ok) return json(res.status, { error: data?.error?.message || 'Could not read the photos.' })
    const tb = (data.content || []).find((b) => b.type === 'text')
    let out
    try {
      out = JSON.parse((tb ? tb.text : '{}').replace(/^```(?:json)?|```$/g, '').trim())
    } catch {
      return json(502, { error: 'Could not make sense of those photos — try clearer shots.' })
    }
    const items = Array.isArray(out.items)
      ? [...new Set(out.items.map((s) => String(s).trim()).filter(Boolean))].slice(0, 40)
      : []
    return json(200, { items, note: String(out.note || '').slice(0, 200), images: content.length - 1 })
  } catch {
    return json(502, { error: 'Could not reach the AI service. Please try again.' })
  }
}
