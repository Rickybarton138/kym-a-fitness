// Coach tool: draft a multi-session training programme from a prompt (goal, days,
// equipment, level). Returns a header + one session per training day, each with
// real exercises. The coach reviews and publishes to the programme library.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

export const handler = async (event) => {
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  try {
    const { goal, days, equipment, level, weeks } = JSON.parse(event.body || '{}')
    const d = Math.min(Math.max(Number(days) || 3, 1), 6)
    const w = Math.min(Math.max(Number(weeks) || 4, 1), 16)
    const prompt =
      `Design a ${w}-week ${level || 'intermediate'} training programme. Goal: "${goal || 'general strength & fitness'}". ` +
      `${d} training sessions per week. Available equipment: ${equipment || 'full gym'}. ` +
      'Return STRICT JSON only, no markdown:\n' +
      '{"title":"","description":"one or two sentences","weeks":<int>,"sessions":[' +
      '{"label":"Day 1","title":"","focus":"","exercises":[{"name":"","sets":<int>,"reps":"e.g. 8-12","rpe":<int 6-10>}],"finisher":""}]}\n' +
      `Provide exactly ${d} sessions (one per weekly training day). Use real exercises that match the equipment. ` +
      'Sensible set/rep/RPE choices for the goal and level. 4-6 exercises per session. Keep finisher short or empty.'
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    })
    const j = await res.json()
    const text = j?.content?.[0]?.text || '{}'
    const m = text.match(/\{[\s\S]*\}/)
    const p = JSON.parse(m ? m[0] : '{}')
    const int = (v, f) => { const n = Math.round(Number(v)); return n > 0 ? n : f }
    const sessions = (Array.isArray(p.sessions) ? p.sessions : []).slice(0, d).map((s, i) => ({
      label: String(s.label || `Day ${i + 1}`).slice(0, 40),
      title: String(s.title || 'Session').slice(0, 80),
      focus: String(s.focus || '').slice(0, 80),
      finisher: String(s.finisher || '') || null,
      exercises: (Array.isArray(s.exercises) ? s.exercises : []).slice(0, 10).map((e) => ({
        name: String(e.name || '').slice(0, 80),
        sets: int(e.sets, 3),
        reps: String(e.reps || '').slice(0, 20),
        ...(int(e.rpe, 0) ? { rpe: int(e.rpe, 0) } : {}),
      })).filter((e) => e.name),
    })).filter((s) => s.exercises.length)
    return { statusCode: 200, headers: cors, body: JSON.stringify({ title: String(p.title || 'Programme').slice(0, 120), description: String(p.description || ''), weeks: int(p.weeks, w), sessions }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ sessions: [], error: String(e.message || e) }) }
  }
}
