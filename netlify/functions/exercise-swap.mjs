// Suggest a like-for-like alternative exercise when a client can't do the one in
// their plan (injury or no equipment). Returns a single replacement + why, keeping
// the same movement pattern / training effect where possible.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'
const VISION_MODEL = 'claude-sonnet-5' // when a photo of available equipment is sent

export const handler = async (event) => {
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  try {
    const { name, reason, image, mediaType } = JSON.parse(event.body || '{}')
    const ex = String(name || '').slice(0, 120).trim()
    const why = String(reason || '').slice(0, 300).trim()
    if (!ex) return { statusCode: 400, headers: cors, body: '{"error":"name required"}' }
    const prompt =
      `A coaching client can't do "${ex}"${why ? ` because: ${why}` : ''}. ` +
      'Suggest ONE alternative exercise that trains the same movement pattern / muscles and works around the problem. ' +
      'If it is an injury, pick something that avoids aggravating it; if it is missing equipment, pick something with common/minimal kit. ' +
      (image ? 'A photo of the equipment actually available is attached — choose an alternative they can do with what you can see in it. ' : '') +
      'Return STRICT JSON only, no markdown: {"name":"the alternative exercise","cue":"one short reason it works as a swap (a few words)"}'
    const userContent = image
      ? [{ type: 'text', text: prompt }, { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } }]
      : prompt
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      // 200 is enough when the answer is the whole response, and on a short
      // prompt it still is — the photo path does work today, measured. But the
      // vision model reasons before it answers, and that reasoning grows with
      // the job: the same assumption in meal-plan.mjs held for three meals and
      // silently returned nothing for twelve. Give the photo room rather than
      // wait for a busier gym photo to find the edge.
      body: JSON.stringify({ model: image ? VISION_MODEL : MODEL, max_tokens: image ? 2000 : 200, messages: [{ role: 'user', content: userContent }] }),
    })
    const j = await res.json()
    // The answer is the first TEXT block, not the first block. See analyze.mjs,
    // which has always done this properly.
    const text = (j?.content || []).find((c) => c?.type === 'text')?.text || '{}'
    const m = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(m ? m[0] : '{}')
    const alt = String(parsed.name || '').trim()
    if (!alt) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'No suggestion — try again.' }) }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ name: alt.slice(0, 120), cue: String(parsed.cue || '').slice(0, 120) }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ error: String(e.message || e) }) }
  }
}
