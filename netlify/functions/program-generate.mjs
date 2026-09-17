// Coach tool: draft a multi-session training programme from a prompt (goal, days,
// equipment, level). Returns a header + one session per training day, each with
// real exercises. The coach reviews and publishes to the programme library.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

export const handler = async (event) => {
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  try {
    const { goal, days, equipment, level, weeks, location, notes, rampFrom, rampTo } = JSON.parse(event.body || '{}')
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
    // Paul, 13 Sept: "on the ai program builder for clients can we add a text
    // box where they can give a prompt for the type of program they want. For
    // example being able to specify they want a program for the gym with
    // weights that also includes scheduled running to increase distance and
    // pace with running."
    //
    // Appended LAST so it outranks the generic goal wording above, and explicit
    // that a session need not be a lifting session. His own example asks for
    // running inside a weights programme, which "4-6 exercises per session"
    // would otherwise quietly refuse — the request has to be able to change the
    // shape of the answer, not just its contents.
    const asked = String(notes || '').trim().slice(0, 400)
    const request = asked
      ? `\n\nWHAT THEY ASKED FOR, IN THEIR OWN WORDS: "${asked}"\n` +
        'This takes priority over the generic goal above — build the programme around it. ' +
        'If they ask for running, rowing, cycling or any conditioning alongside the lifting, give it real ' +
        'sessions or slots of its own and put the distance, time or pace in the reps field ' +
        '(for example name "Easy run", sets 1, reps "5 km @ conversational pace"). ' +
        'If they ask for something to build week on week, say in the DESCRIPTION how it progresses — ' +
        'keep the reps field to what is prescribed for THIS session (e.g. "5 km @ conversational pace"), ' +
        'never a week-by-week plan crammed into one line. ' +
        'Never drop part of the request because it does not fit the usual shape of a lifting session.'
      : ''
    // Paul, 17 Sept: "start with 1 per week and build gradually to 3 per week
    // over 12 weeks." The RAMP itself is built in code (buildProgramRows) — the
    // model only writes one base week. What the model has to get right is the
    // ORDER, because a lighter week takes the first N sessions: if it hands back
    // Push / Pull / Legs then week one is an upper-body-only week and the client
    // never trains their legs for a month.
    const from = Math.max(1, Number(rampFrom) || 0)
    const to = Math.max(from, Number(rampTo) || 0)
    const ramping = rampFrom && rampTo && to > from
    const rampLine = ramping
      ? `\n\nIMPORTANT — this programme BUILDS UP: the client starts at ${from} session${from === 1 ? '' : 's'} a week and works up to ${to} by week ${w}. ` +
        'The early weeks use only the FIRST sessions in your list, so order them so that works: ' +
        `the first ${from === 1 ? 'session on its own must be a sensible whole week of training' : `${from} sessions on their own must be a sensible whole week of training`}, ` +
        'covering the whole body rather than one half of a split. Add the more specialised sessions later in the list. ' +
        'Say in the description that the volume builds up over the programme.'
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
      fence + rampLine + request
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

    // The request line is a prompt instruction too, and it slips more often than
    // the equipment fence does: asked for "weights plus scheduled running", one
    // generation in two came back as four lifting sessions with running
    // mentioned only in the description. A description that promises running and
    // a plan that contains none is worse than not supporting it at all — the
    // client reads the blurb and never notices the programme disagrees.
    //
    // So it is checked the same way the equipment is. Only for activities that
    // are namable: if they asked for running and nothing in the plan mentions
    // running, say so and ask again. One retry, then accept what comes back.
    const ACTIVITY = [
      ['run', /\brun|jog|5k|10k|park ?run/i],
      ['swimming', /\bswim/i],
      ['rowing', /\brow(ing|er)?\b/i],
      ['cycling', /\bcycl|\bbike|spin class/i],
      ['sprint work', /\bsprint|hill repeat/i],
      ['conditioning work', /\bcondition|\bcardio|\bhyrox|\bmetcon/i],
    ]
    const requestedActivities = asked ? ACTIVITY.filter(([, re]) => re.test(asked)) : []
    const missingActivities = (obj) => requestedActivities
      .filter(([, re]) => !(Array.isArray(obj.sessions) ? obj.sessions : []).some((s) =>
        re.test(`${s.title || ''} ${s.focus || ''}`) ||
        (Array.isArray(s.exercises) ? s.exercises : []).some((e) => re.test(`${e.name || ''} ${e.reps || ''}`))))
      .map(([label]) => label)

    let p = await ask()
    const missing = missingActivities(p)
    if (missing.length) {
      p = await ask(`\n\nYour previous attempt left out ${missing.join(' and ')}, which they specifically asked for. ` +
        'Mentioning it in the description is not enough — it must appear as real sessions, or as exercises inside a ' +
        'session, with the distance, time or pace in the reps field. Rebuild the programme including it.')
    }
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
        // 120, not 20. A rep target is "8-12"; a running slot is "5 km @
        // conversational pace" and a badly-behaved one is the whole six-week
        // progression. At 20 it truncated to "5 km @ conversational"; at 60 it
        // still cut "…1 km cool-d" off mid-word on a real generation. The prompt
        // asks for progression to go in the description instead, and this is the
        // backstop for when it does not.
        reps: String(e.reps || '').slice(0, 120),
        ...(int(e.rpe, 0) ? { rpe: int(e.rpe, 0) } : {}),
        ...(e.equipment ? { equipment: String(e.equipment).slice(0, 60) } : {}),
      })).filter((e) => e.name && !offends(e)),
    })).filter((s) => s.exercises.length)
    return { statusCode: 200, headers: cors, body: JSON.stringify({ title: String(p.title || 'Programme').slice(0, 120), description: String(p.description || ''), weeks: int(p.weeks, w), sessions }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ sessions: [], error: String(e.message || e) }) }
  }
}
