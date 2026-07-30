// On-demand exercise how-to: returns an AI-written description + coaching cues and
// a correct-form demo (start/end images from the free, MIT-licensed free-exercise-db).
// Generated once per exercise name, cached in exercise_guides, then reused by everyone.

const SUPABASE_URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const SUPABASE_KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const SECRET = process.env.NUDGE_CRON_SECRET
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const LIB_JSON = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json'
const LIB_IMG = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'

const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

let LIB = null // cached across warm invocations
async function library() {
  if (LIB) return LIB
  try {
    const res = await fetch(LIB_JSON)
    const arr = await res.json()
    LIB = arr.map((e) => ({ key: nameKey(e.name), tokens: nameKey(e.name).split(' '), images: e.images || [] }))
  } catch { LIB = [] }
  return LIB
}

// Best demo match: exact normalised name, else score by shared tokens — the movement
// word (last token) must match, prefer real free-weight equipment over machines.
const GOOD_EQUIP = ['barbell', 'dumbbell', 'bodyweight', 'cable', 'kettlebell']
const BAD_EQUIP = ['machine', 'smith', 'lever', 'sled', 'car', 'band', 'assisted', 'roller']
async function matchImages(name) {
  const lib = await library()
  const key = nameKey(name)
  const exact = lib.find((e) => e.key === key)
  if (exact) return exact.images.map((i) => LIB_IMG + i)
  const q = key.split(' ').filter(Boolean)
  if (!q.length) return []
  const move = q[q.length - 1]
  let best = null, bs = -1
  for (const e of lib) {
    const shared = q.filter((t) => e.tokens.includes(t)).length
    if (shared === 0 || !e.tokens.includes(move)) continue
    let s = shared * 10 - Math.abs(e.tokens.length - q.length)
    if (e.tokens.some((t) => t === 'barbell' || t === 'dumbbell')) s += 5
    else if (e.tokens.some((t) => GOOD_EQUIP.includes(t))) s += 2
    if (e.tokens.some((t) => BAD_EQUIP.includes(t))) s -= 5
    if (s > bs) { bs = s; best = e }
  }
  return best ? best.images.map((i) => LIB_IMG + i) : []
}

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
    if (cached && cached.how_to) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ how_to: cached.how_to, cues: cached.cues || [], image_urls: cached.image_urls || [], cached: true }) }
    }

    const [guide, images] = await Promise.all([generate(name), matchImages(name)])
    await rpc('exercise_guide_put', { p_secret: SECRET, p_name_key: key, p_name: name, p_how_to: guide.how_to, p_cues: guide.cues, p_images: images }).catch(() => {})
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ...guide, image_urls: images, cached: false }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ how_to: '', cues: [], image_urls: [], error: String(e.message || e) }) }
  }
}
