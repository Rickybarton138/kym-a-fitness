// Coach tool: draft a multi-session training programme from a prompt (goal, days,
// equipment, level). Returns a header + one session per training day, each with
// real exercises. The coach reviews and publishes to the programme library.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

export const handler = async (event) => {
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  try {
    const { goal, days, equipment, level, weeks, location } = JSON.parse(event.body || '{}')
    const d = Math.min(Math.max(Number(days) || 3, 1), 6)
    const w = Math.min(Math.max(Number(weeks) || 4, 1), 16)
    // Where they train changes the answer as much as the kit does: "home, no
    // equipment" should not come back full of barbell work, and a gym plan
    // should not be built out of press-ups.
    const WHERE = {
      home: 'They train AT HOME with little or no equipment. Use bodyweight and whatever is listed — never assume gym machines. Give progressions and regressions so it stays hard as they get fitter.',
      home_gym: 'They train in a HOME GYM. Use ONLY the equipment listed below — nothing else exists. If the list is short, work around it with tempo, unilateral work and rep schemes rather than inventing kit.',
      gym: 'They train in a FULLY EQUIPPED GYM.',
    }
    const where = WHERE[location] || ''
    // At home the kit list is a HARD boundary, not a hint. Asked merely to
    // "match the equipment", it put a lat pulldown in a plan whose entire
    // inventory was dumbbells, a bench and bands. Naming the item used for each
    // exercise makes it check its own work.
    const limited = location === 'home' || location === 'home_gym'
    const fence = limited
      ? `\n\nHARD CONSTRAINT. The ONLY equipment that exists is: ${equipment || 'nothing but bodyweight'}. ` +
        'Every exercise must be performable with that alone, or with bodyweight. ' +
        'There is NO barbell, NO squat rack, NO cable machine, NO lat pulldown, NO leg press and NO gym machine of any kind unless it appears in that list. ' +
        'Set "equipment" on each exercise to the item from the list it uses, or "bodyweight". ' +
        'If a movement pattern cannot be covered with what is available, choose a different exercise — never invent kit.'
      : ''
    const prompt =
      `Design a ${w}-week ${level || 'intermediate'} training programme. Goal: "${goal || 'general strength & fitness'}". ` +
      `${d} training sessions per week. ${where} Available equipment: ${equipment || 'full gym'}. ` +
      'Return STRICT JSON only, no markdown:\n' +
      '{"title":"","description":"one or two sentences","weeks":<int>,"sessions":[' +
      '{"label":"Day 1","title":"","focus":"","exercises":[{"name":"","sets":<int>,"reps":"e.g. 8-12","rpe":<int 6-10>,"equipment":""}],"finisher":""}]}\n' +
      `Provide exactly ${d} sessions (one per weekly training day). Use real exercises that match the equipment — ` +
      'if a movement needs kit that is not on the list, choose a different movement. ' +
      'Sensible set/rep/RPE choices for the goal and level. 4-6 exercises per session. Keep finisher short or empty.' +
      fence
    const ask = async (extra) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt + (extra || '') }] }),
      })
      const j = await res.json()
      const text = j?.content?.[0]?.text || '{}'
      const m = text.match(/\{[\s\S]*\}/)
      return JSON.parse(m ? m[0] : '{}')
    }

    // The fence above is a prompt instruction, and roughly one run in five it
    // slipped a lat pulldown into a plan whose whole inventory was dumbbells, a
    // bench and bands. So it is checked rather than trusted: anything naming kit
    // the person does not own gets one retry, then is dropped. A home plan
    // quietly built around a machine they have never owned is the exact failure
    // Paul asked this feature to avoid.
    const GYM_ONLY = ['barbell', 'squat rack', 'power rack', 'lat pulldown', 'pulldown', 'leg press', 'smith machine', 'cable', 'hack squat', 'leg extension', 'leg curl', 'pec deck', 'chest press machine', 'treadmill', 'rower', 'elliptical']
    const owned = String(equipment || '').toLowerCase()
    const offends = (ex) => {
      if (!limited) return false
      const hay = `${ex.name || ''} ${ex.equipment || ''}`.toLowerCase()
      return GYM_ONLY.some((k) => hay.includes(k) && !owned.includes(k))
    }
    const anyOffends = (obj) => (Array.isArray(obj.sessions) ? obj.sessions : [])
      .some((s) => (Array.isArray(s.exercises) ? s.exercises : []).some(offends))

    let p = await ask()
    if (limited && anyOffends(p)) {
      const bad = [...new Set((p.sessions || []).flatMap((s) => (s.exercises || []).filter(offends).map((e) => e.name)))]
      p = await ask(`\n\nYour previous attempt used equipment they do not have: ${bad.join(', ')}. They own ONLY: ${equipment || 'nothing but bodyweight'}. Rebuild it without those, using only what is listed or bodyweight.`)
    }
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
        ...(e.equipment ? { equipment: String(e.equipment).slice(0, 60) } : {}),
      })).filter((e) => e.name && !offends(e)),
    })).filter((s) => s.exercises.length)
    return { statusCode: 200, headers: cors, body: JSON.stringify({ title: String(p.title || 'Programme').slice(0, 120), description: String(p.description || ''), weeks: int(p.weeks, w), sessions }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ sessions: [], error: String(e.message || e) }) }
  }
}
