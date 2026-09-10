// Coach tool: revise a WHOLE programme with one instruction. Takes the current
// sessions + a plain-English change ("more hypertrophy", "swap dumbbell work to
// barbell", "make weeks 5-8 harder") and returns the full revised session set in
// the same shape, preserving each session's week/day so the schedule is intact.
import { firstText } from './_claude-text.mjs'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

export const handler = async (event) => {
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  try {
    const { instruction, title, level, weeks, sessions } = JSON.parse(event.body || '{}')
    const list = (Array.isArray(sessions) ? sessions : []).slice(0, 90)
    if (!instruction || !list.length) return { statusCode: 200, headers: cors, body: JSON.stringify({ sessions: [], error: 'Nothing to edit.' }) }

    // Send a compact view; the model returns the same array, revised.
    const compact = list.map((s, i) => ({
      i, week: s.week ?? 1, dow: s.dow ?? null, label: s.label || null, title: s.title || 'Session', focus: s.focus || '',
      exercises: (s.exercises || []).map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, ...(e.rpe ? { rpe: e.rpe } : {}) })),
      finisher: s.finisher || null,
    }))
    const prompt =
      `You are editing an existing ${weeks || ''}-week ${level || ''} training programme titled "${title || 'Programme'}".\n` +
      `Apply THIS change across the whole programme: "${instruction}".\n\n` +
      `Here are the current sessions as JSON:\n${JSON.stringify(compact)}\n\n` +
      'Return STRICT JSON only, no markdown, of the form {"sessions":[...]} with EXACTLY the same number of sessions in the SAME order. ' +
      'Keep each session\'s "i", "week", "dow" and "label" UNCHANGED. Only change title/focus/exercises/finisher as the instruction requires. ' +
      'Each exercise is {"name","sets":<int>,"reps":"e.g. 8-12","rpe":<int 6-10 optional>}. Use real exercises. Keep it coherent as a progressive programme.'

    // The model call occasionally returns no content (transient overload); retry
    // a couple of times before giving up so the coach rarely sees a failure.
    let text = ''
    for (let attempt = 0; attempt < 3 && !text; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, attempt * 700)) // back off before a retry
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
      })
      const j = await res.json()
      const tb = firstText(j, '')
      if (tb) text = tb
    }
    if (!text) return { statusCode: 200, headers: cors, body: JSON.stringify({ sessions: [], error: 'The AI is busy right now — give it another go in a moment.' }) }
    // Robust parse: the model may return {"sessions":[...]}, a bare [...] array,
    // or wrap either in ```json fences. Handle all of them.
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    let parsed = null
    try { parsed = JSON.parse(text) } catch {
      const obj = text.match(/\{[\s\S]*\}/); const arrM = text.match(/\[[\s\S]*\]/)
      const cand = obj && (!arrM || obj.index <= arrM.index) ? obj[0] : (arrM ? arrM[0] : null)
      try { parsed = cand ? JSON.parse(cand) : null } catch { parsed = null }
    }
    const outSessions = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.sessions) ? parsed.sessions : [])
    if (!outSessions.length) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ sessions: [], error: 'AI returned nothing usable — try rephrasing.' }) }
    }
    const p = { sessions: outSessions }
    const int = (v, f) => { const n = Math.round(Number(v)); return n > 0 ? n : f }
    // Merge by ARRAY POSITION (the prompt guarantees same order + count) rather
    // than the model's echoed "i", which it doesn't reliably return. week/dow/
    // label/position always come from the original so the schedule is never lost.
    const out = Array.isArray(p.sessions) ? p.sessions : []
    const revised = list.map((orig, idx) => {
      const r = out[idx] || {}
      const exercises = (Array.isArray(r.exercises) ? r.exercises : orig.exercises || []).slice(0, 12).map((e) => ({
        name: String(e.name || '').slice(0, 80),
        sets: int(e.sets, 3),
        reps: String(e.reps || '').slice(0, 20),
        ...(int(e.rpe, 0) ? { rpe: int(e.rpe, 0) } : {}),
      })).filter((e) => e.name)
      return {
        week: orig.week ?? 1, dow: orig.dow ?? null, label: orig.label || null, position: orig.position ?? idx,
        title: String(r.title || orig.title || 'Session').slice(0, 80),
        focus: String(r.focus || orig.focus || '').slice(0, 80),
        finisher: (r.finisher != null ? String(r.finisher) : orig.finisher) || null,
        exercises: exercises.length ? exercises : (orig.exercises || []),
      }
    })
    return { statusCode: 200, headers: cors, body: JSON.stringify({ sessions: revised }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ sessions: [], error: String(e.message || e) }) }
  }
}
