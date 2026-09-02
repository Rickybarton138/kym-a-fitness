// On-demand exercise how-to: returns an AI-written description + coaching cues and
// a correct-form demo (start/end images from the free, MIT-licensed free-exercise-db).
// Generated once per exercise name, cached in exercise_guides, then reused by everyone.
//
// The images are cached with the version of the matcher that chose them, so a
// matcher fix re-matches old rows instead of serving the old answer forever.

import { matchImages, nameKey, MATCHER_V } from './_exercise-match.mjs'

const SUPABASE_URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const SUPABASE_KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const SECRET = process.env.NUDGE_CRON_SECRET
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
async function rpc(fn, args) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(args),
  })
}

async function getCached(key) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/exercise_guides?name_key=eq.${encodeURIComponent(key)}&select=*`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

async function generate(name) {
  const prompt = `You are a strength & conditioning coach. For the exercise "${name}", return STRICT JSON only:
{"how_to":"2-3 sentence plain-English description of how to perform it correctly","cues":["4 short coaching cues, a few words each"]}
No markdown, no extra text. If the name isn't a real exercise, still give sensible general guidance.`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
  })
  const j = await res.json()
  const text = j?.content?.[0]?.text || '{}'
  const m = text.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(m ? m[0] : '{}')
  return { how_to: String(parsed.how_to || ''), cues: Array.isArray(parsed.cues) ? parsed.cues.slice(0, 6).map(String) : [] }
}

export const handler = async (event) => {
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  try {
    const name = (JSON.parse(event.body || '{}').name || '').trim()
    if (!name) return { statusCode: 400, headers: cors, body: '{"error":"name required"}' }
    const key = nameKey(name)

    const cached = await getCached(key)
    // Only a full hit short-circuits: the text AND images from the current
    // matcher. An older row keeps its text (no need to pay for it again) but
    // has its demo re-matched. An empty image list at the current version is a
    // real answer -- "nothing in the library is this exercise" -- and is kept.
    if (cached && cached.how_to && (cached.images_v || 0) >= MATCHER_V) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ how_to: cached.how_to, cues: cached.cues || [], image_urls: cached.image_urls || [], cached: true }) }
    }

    const [guide, images] = await Promise.all([
      cached && cached.how_to
        ? Promise.resolve({ how_to: cached.how_to, cues: cached.cues || [] })
        : generate(name),
      matchImages(name),
    ])
    await rpc('exercise_guide_put', { p_secret: SECRET, p_name_key: key, p_name: name, p_how_to: guide.how_to, p_cues: guide.cues, p_images: images, p_images_v: MATCHER_V }).catch(() => {})
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ...guide, image_urls: images, cached: false }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ how_to: '', cues: [], image_urls: [], error: String(e.message || e) }) }
  }
}
