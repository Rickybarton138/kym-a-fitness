// Serverless proxy to Claude vision. Keeps ANTHROPIC_API_KEY server-side.
// POST { mode: 'fridge' | 'meal', image: <base64 no prefix>, mediaType, remaining? }

import { kbForPrompt } from '../../src/nutritionExpert.js'

// Model routing by job (cost lever). Vision stays on Opus for macro/photo
// accuracy; client-facing coaching text runs on Sonnet; mechanical/internal
// text runs on Haiku. Change a line here to re-tune the cost/quality trade.
const MODEL = 'claude-opus-4-8'        // vision: meal / fridge / body scan
const MODEL_MID = 'claude-sonnet-5'    // client-facing text: Ask coach, Nutrition Expert
const MODEL_LITE = 'claude-haiku-4-5'  // mechanical/internal text: workout, parse, briefing
// Form check = quick best-effort pointers from a few stills; use the fast vision
// tier so clients aren't left waiting (Kim still gives the final word).
const FORM_MODEL = 'claude-haiku-4-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

// Prompt caching (cost lever): wrap a stable system prompt so the coach's
// persona/knowledge prefix is billed at ~10% on repeat calls within the cache
// window. Silently no-ops below the model's minimum cacheable prefix.
function cacheable(text) {
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }]
}

const FRIDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ingredients: {
      type: 'array',
      items: { type: 'string' },
      description: 'Food items visibly identifiable in the photo',
    },
    meal: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Short name of the suggested meal' },
        description: { type: 'string', description: 'One sentence on how to make it from the visible ingredients' },
        protein_g: { type: 'integer' },
        carbs_g: { type: 'integer' },
        fat_g: { type: 'integer' },
        fibre_g: { type: 'integer', description: 'Estimated dietary fibre in grams' },
        calories: { type: 'integer' },
        fit_note: { type: 'string', description: 'One short line on how well it fits the remaining macro targets' },
      },
      required: ['name', 'description', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'calories', 'fit_note'],
    },
  },
  required: ['ingredients', 'meal'],
}

const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    food_name: { type: 'string', description: 'Short name for the whole plate' },
    items: { type: 'array', items: { type: 'string' }, description: 'Individual foods detected' },
    protein_g: { type: 'integer' },
    carbs_g: { type: 'integer' },
    fat_g: { type: 'integer' },
    fibre_g: { type: 'integer', description: 'Estimated dietary fibre in grams' },
    calories: { type: 'integer' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['food_name', 'items', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'calories', 'confidence'],
}

const WORKOUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'Short session name, e.g. "Push A — Chest & Shoulders"' },
    focus: { type: 'string', description: 'The training focus for the session' },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          sets: { type: 'integer' },
          reps: { type: 'string', description: 'Rep target or range, e.g. "8-10"' },
          equipment: { type: 'string', description: 'Which piece of the gym’s kit this uses' },
          cue: { type: 'string', description: 'One short coaching cue' },
        },
        required: ['name', 'sets', 'reps', 'equipment', 'cue'],
      },
    },
    finisher: { type: 'string', description: 'A short optional finisher' },
  },
  required: ['title', 'focus', 'exercises', 'finisher'],
}

// Persona preamble shared by every AI mode, so answers speak in the coach's voice.
function personaIntro(persona, role) {
  const name = (persona && persona.name) || 'their coach'
  const audience = persona && persona.audience ? ` for ${persona.audience}` : ''
  let s = `You are ${name}, a ${role || 'strength and nutrition coach'}${audience}.`
  if (persona && persona.philosophy) s += ` Your coaching philosophy: ${persona.philosophy}.`
  if (persona && persona.tone) s += ` Speak in your own voice — ${persona.tone}.`
  return s
}

// Owner briefing — the AI acts as the gym's operations manager, briefing the owner.
function buildBriefingSystem(persona) {
  const owner = (persona && persona.name) || 'the owner'
  return (
    `You are the operations manager for a gym, briefing ${owner} at the start of the day. ` +
    `Write a short, sharp morning briefing using ONLY the numbers provided — never invent figures or names. ` +
    `Address ${owner} directly and warmly, like a trusted right-hand who has already done the legwork. ` +
    `Structure it as: a one-line headline on how the gym is doing; MONEY (what's coming in, anything overdue); ` +
    `MEMBERS WHO NEED YOU (name the at-risk members and say why — e.g. not seen in X days); ` +
    `CLASSES (anything filling up or worth pushing); and ONE THING TO DO TODAY (a single concrete action). ` +
    `Use plain text only — no emojis, no markdown symbols, no hash headers. Label each section in CAPITALS on its own line. ` +
    `Keep the whole thing under 180 words. Be practical and confident, not fluffy.`
  )
}

function buildWorkoutPrompt({ goal, equipment, gymName, persona, fromPhoto }) {
  const equipLine = fromPhoto
    ? 'Look at the photo — it shows the equipment actually available to the client right now. Build the session using ONLY equipment you can see in the photo, and name the specific piece for each exercise. If the photo is unclear, fall back to sensible commonly-available kit.'
    : `Use ONLY equipment from this list, and name the specific piece for each exercise: ${(equipment || []).join('; ')}.`
  return (
    personaIntro(persona, 'strength coach') + ` Your clients train at ${gymName || 'the gym'}. ` +
    `Build ONE ${goal || 'full body'} session for today. ` +
    equipLine + ' ' +
    'Give 5-6 exercises, compound strength movements first, with sets (a number), a rep target or range, ' +
    'the exact equipment used, and one short coaching cue each (form and mindset, not just mechanics). ' +
    'Add a brief finisher. Sensible, joint-friendly volume the client can actually recover from.'
  )
}

// Client-chosen nutrition detail level (Paul's round-2 ask). Appended at the END
// of the nutrition system prompts so the stable persona/knowledge prefix still
// matches the prompt cache.
function styleLine(nutritionStyle) {
  if (nutritionStyle === 'lifestyle') return ' The client prefers a lifestyle approach: focus on a healthy relationship with food, sensible calorie intake, food quality and including foods they enjoy. Keep it simple and non-obsessive; go light on macro-timing detail unless they ask.'
  if (nutritionStyle === 'performance') return ' The client wants performance and recovery optimisation: you can go deeper on macro splits, protein distribution, nutrient timing and recovery nutrition to maximise their results.'
  return ''
}

// SAFETY-CRITICAL: recovery-aware nutrition mode. When on, this instruction is
// appended AFTER everything else (so it overrides) to every nutrition-facing
// prompt. It must never be softened into diet/restriction guidance.
function recoveryLine(recovery) {
  if (!recovery || !recovery.on) return ''
  const struggle = recovery.note ? ` They have shared that they particularly struggle with: ${String(recovery.note).slice(0, 300)}.` : ''
  return ' CRITICAL — this client is in recovery from disordered eating.' + struggle +
    ' Use a warm, recovery-aware, trauma-informed tone at ALL times. NEVER suggest cutting calories, losing weight, restricting, skipping food, or creating a deficit — even if their numbers might otherwise suggest it. NEVER call foods good or bad, clean or cheat, or moralise about eating. Frame eating enough and eating flexibly as positive progress; gently encourage adequacy, regularity and variety. Do not fixate on or lead with calorie numbers — keep the focus on nourishment, consistency and a calm relationship with food. Be reassuring and non-judgmental. If they seem to be struggling or distressed, gently and briefly encourage them to lean on their coach and their professional support (their GP, or the Beat eating-disorder helpline) — you are a supportive companion, not a substitute for treatment.'
}

function buildPrompt(mode, remaining, persona, nutritionStyle, extras, recovery) {
  const intro = personaIntro(persona, 'nutrition coach')
  const style = styleLine(nutritionStyle) + recoveryLine(recovery)
  if (mode === 'fridge') {
    const target = remaining
      ? `The client has these macros LEFT for today: ${remaining.protein_g}g protein, ${remaining.carbs_g}g carbs, ${remaining.fat_g}g fat (about ${remaining.calories} kcal). `
      : ''
    return (
      intro + ' ' +
      'Look at this photo of the inside of a fridge or cupboard and identify the food you can see. ' +
      target +
      'Suggest ONE realistic, balanced meal they could make right now using mainly the visible ingredients, getting as close as possible to their remaining targets for the day. ' +
      'Give the meal’s estimated protein, carbs, fat and calories, and an encouraging fit_note on how well it fits. ' +
      'Estimate sensibly for a normal portion; do not invent ingredients that are not plausibly visible.' +
      style
    )
  }
  return (
    intro + ' ' +
    'Look at this photo of a meal on a plate. Identify the individual foods and estimate the total calories and macros (protein, carbs, fat) for the portion shown. ' +
    (extras ? `The person also notes it was cooked/served with: ${extras}. Add these cooking fats, oils, dressings and sauces to your calorie and fat estimate — they are easy to miss from a photo. ` : '') +
    'Give a short food_name for the whole plate and a confidence level. Estimate sensibly for a normal portion.' +
    style
  )
}

const PARSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: 'Short title for the knowledge entry' },
          content: { type: 'string', description: 'The knowledge, written in Kim’s voice (first person)' },
        },
        required: ['title', 'content'],
      },
    },
  },
  required: ['entries'],
}

function buildParsePrompt(text, persona) {
  const name = (persona && persona.name) || 'the coach'
  return (
    `You are organising coach ${name}’s material into a knowledge base. ` +
    'From the text below (a coaching script, call transcript, or a batch of their typical messages), extract concise, ' +
    'self-contained knowledge entries that capture their methods, advice and the way they respond. ' +
    `Each entry has a short title and content written in their voice (first person, as ${name}). ` +
    'Merge duplicates, drop small talk, keep 3–12 genuinely useful entries.\n\nTEXT:\n' + String(text).slice(0, 24000)
  )
}

function buildExpertSystem() {
  return (
    'You are the Sports Nutrition Expert inside this coaching app — a knowledgeable, evidence-based sports nutritionist for athletes, coaches and active people. ' +
    'Ground every answer in the consensus literature summarised below (ISSN position stands, the IOC 2018 supplements consensus, and the Academy of Nutrition & Dietetics / Dietitians of Canada / ACSM joint position). ' +
    'Give practical, specific guidance: use the guideline numbers (e.g. g/kg bodyweight) and, when the person gives their bodyweight, sport and training load, do the sums for them and suggest concrete amounts and food examples. ' +
    'Be clear about certainty — say when evidence is strong versus individual/variable. ' +
    'Safety rules: this is general nutrition education, not medical or individual dietetic prescription; flag when someone should see a registered dietitian, doctor or their coach. ' +
    'Actively watch for low energy availability / RED-S, disordered-eating red flags, the female athlete triad, and youth athletes — for these, prioritise health and advise professional support rather than performance tweaks. ' +
    'For supplements, stress food-first, individual trialling in training, and anti-doping contamination risk (use batch-tested products only). ' +
    'Write in plain text — short sentences and short paragraphs, no markdown, no bold, no asterisks, no headings, no emojis. Keep answers focused and usable.' +
    '\n\nEVIDENCE BASE:\n' + kbForPrompt()
  )
}

function buildAskSystem(knowledge, comms, persona, nutritionStyle, recovery) {
  const name = (persona && persona.name) || 'the coach'
  const kb = (knowledge || [])
    .map((k, i) => `[${i + 1}] ${k.title ? k.title + ': ' : ''}${k.content}`)
    .join('\n\n')
    .slice(0, 24000)
  const convo = (comms || [])
    .slice(-12)
    .map((m) => `${m.sender === 'coach' ? name : 'Client'}: ${m.body}`)
    .join('\n')
    .slice(0, 6000)
  return (
    personaIntro(persona, 'strength & nutrition coach') + ' ' +
    `You are the AI assistant that answers this coach’s clients in their voice and method. ` +
    `Answer the client’s question as ${name}, using ${name}’s knowledge below and anything already told to this client. ` +
    `If the question is not covered, give sensible general guidance in the same style and suggest they message ${name} directly for specifics. ` +
    'Keep answers concise and genuinely helpful. ' +
    'Write in plain text — short sentences and short paragraphs, no markdown, no bold, no asterisks, no headings, no emojis. ' +
    'This is general fitness and nutrition guidance, not medical advice; for pain, injury, pregnancy or medical concerns, advise seeing a professional.' +
    (kb ? `\n\n${name.toUpperCase()}’S KNOWLEDGE:\n` + kb : `\n\n(No specific knowledge added yet — answer generally in the coach’s style.)`) +
    (convo ? `\n\nRECENT MESSAGES BETWEEN ${name.toUpperCase()} AND THIS CLIENT (for context):\n` + convo : '') +
    styleLine(nutritionStyle) + recoveryLine(recovery)
  )
}

function buildBodyScanPrompt(hasPrev, persona, recovery) {
  const base =
    personaIntro(persona, 'body-composition coach') + ' ' +
    'Progress is about how the body is changing and feeling, never shame about a number. ' +
    'IMPORTANT HONESTY RULE: you CANNOT measure exact inches or body-fat percent from a photo. ' +
    'Never state a precise body-fat %. Only describe what you can SEE, and give gentle, clearly-flagged ESTIMATES of change. ' +
    'Write in warm plain sentences only — NO emojis, NO markdown, NO headings, NO bold or asterisks.' + recoveryLine(recovery)
  if (hasPrev) {
    return (
      base +
      ' You are shown TWO progress photos of the same person: the FIRST image is their PREVIOUS scan, the SECOND is their LATEST scan. ' +
      'Compare them and describe the visible changes — waist/midsection, shoulders/back, arms/legs, posture and overall shape. ' +
      'Where you see a clear change, give a gentle directional estimate in inches (e.g. "looks like roughly an inch off your waist"), always flagged as an estimate. ' +
      'If the two photos look essentially the same, say so kindly and encourage consistency. ' +
      'Keep it to about 4–7 short sentences, end on genuine encouragement, and remind her these are visual estimates, not exact measurements.'
    )
  }
  return (
    base +
    ' This is her FIRST scan, so there is nothing to compare to yet — treat it as a baseline. ' +
    'Give a warm, positive read of what you can see (posture, overall shape, areas of strength), avoid any hard numbers, ' +
    'and tell her this is her starting point so the next scan can show her changes. Keep it to about 4–6 short sentences.'
  )
}

function buildFormPrompt(exercise, persona) {
  const name = (persona && persona.name) || 'Your coach'
  return (
    personaIntro(persona, 'form coach') + ` These are still frames from a client performing ${exercise || 'an exercise'}. ` +
    'Give a short, supportive form assessment: name 1–2 things that look good, then 1–2 specific cues to improve ' +
    '(depth, knee/joint tracking, spine/back position, tempo, range of motion). Be encouraging and practical, never shaming. ' +
    'The frames are limited, so keep it high-level and note that. ' +
    'Write in plain sentences only — NO emojis, NO markdown, NO headings, NO bold or asterisks. Keep it to about 4–6 short sentences. ' +
    `End with exactly: "${name} will take a proper look and give you the final word." This is general guidance, not medical advice.`
  )
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return json(500, { error: 'Server not configured: ANTHROPIC_API_KEY is missing.' })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body.' })
  }

  const { mode, image, mediaType, remaining, goal, equipment, gymName, question, knowledge, comms, text, persona, nutritionStyle, extras, recovery } = body

  // ---- Nutrition Expert: evidence-based sports-nutrition answers ----
  if (mode === 'expert') {
    if (!question) return json(400, { error: 'Ask a question.' })
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL_MID,
          max_tokens: 900,
          system: cacheable(buildExpertSystem(comms)),
          messages: [{ role: 'user', content: String(question).slice(0, 2000) }],
        }),
      })
      const data = await res.json()
      if (!res.ok) return json(res.status, { error: data?.error?.message || 'Claude API error.' })
      const tb = (data.content || []).find((b) => b.type === 'text')
      return json(200, { answer: tb ? tb.text : 'Sorry, I couldn’t answer that one.' })
    } catch {
      return json(502, { error: 'Could not reach the AI service. Please try again.' })
    }
  }

  // ---- Ask Kim: free-text answer in Kim's voice (no schema) ----
  if (mode === 'ask') {
    if (!question) return json(400, { error: 'Ask a question.' })
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL_MID,
          max_tokens: 800,
          system: cacheable(buildAskSystem(knowledge, comms, persona, nutritionStyle, recovery)),
          messages: [{ role: 'user', content: String(question).slice(0, 2000) }],
        }),
      })
      const data = await res.json()
      if (!res.ok) return json(res.status, { error: data?.error?.message || 'Claude API error.' })
      const tb = (data.content || []).find((b) => b.type === 'text')
      return json(200, { answer: tb ? tb.text : 'Sorry, I couldn’t answer that — try messaging Kim.' })
    } catch {
      return json(502, { error: 'Could not reach the AI service. Please try again.' })
    }
  }

  // ---- Owner briefing: turn gym stats into a plain-English morning brief ----
  if (mode === 'briefing') {
    const stats = body.stats
    if (!stats) return json(400, { error: 'No stats to brief on.' })
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL_LITE,
          max_tokens: 600,
          system: cacheable(buildBriefingSystem(persona)),
          messages: [{ role: 'user', content: 'Here are this gym’s numbers for today. Write the briefing.\n\n' + JSON.stringify(stats).slice(0, 4000) }],
        }),
      })
      const data = await res.json()
      if (!res.ok) return json(res.status, { error: data?.error?.message || 'Claude API error.' })
      const tb = (data.content || []).find((b) => b.type === 'text')
      return json(200, { briefing: tb ? tb.text : 'No briefing available right now.' })
    } catch {
      return json(502, { error: 'Could not reach the AI service. Please try again.' })
    }
  }

  // ---- Form check: assess exercise form from extracted video frames ----
  if (mode === 'form') {
    const frames = (body.frames || []).slice(0, 4)
    if (!frames.length) return json(400, { error: 'No frames to analyse.' })
    const formContent = frames.map((f) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f } }))
    formContent.push({ type: 'text', text: buildFormPrompt(body.exercise, persona) })
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: FORM_MODEL, max_tokens: 500, messages: [{ role: 'user', content: formContent }] }),
      })
      const data = await res.json()
      if (!res.ok) return json(res.status, { error: data?.error?.message || 'Claude API error.' })
      const tb = (data.content || []).find((b) => b.type === 'text')
      return json(200, { feedback: tb ? tb.text : 'Couldn’t read the clip — Kim will take a look.' })
    } catch {
      return json(502, { error: 'Could not reach the AI service. Please try again.' })
    }
  }

  // ---- Body scan: compare progress photos, report visible change ----
  if (mode === 'bodyscan') {
    const frames = (body.frames || []).slice(0, 2)
    if (!frames.length) return json(400, { error: 'No photo to scan.' })
    const hasPrev = frames.length > 1
    const scanContent = frames.map((f) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f } }))
    scanContent.push({ type: 'text', text: buildBodyScanPrompt(hasPrev, persona, recovery) })
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: 'user', content: scanContent }] }),
      })
      const data = await res.json()
      if (!res.ok) return json(res.status, { error: data?.error?.message || 'Claude API error.' })
      const tb = (data.content || []).find((b) => b.type === 'text')
      return json(200, { summary: tb ? tb.text : 'Couldn’t read that photo — try a clearer, well-lit full-body shot.' })
    } catch {
      return json(502, { error: 'Could not reach the AI service. Please try again.' })
    }
  }

  let schema
  let content
  let model = MODEL

  if (mode === 'workout') {
    schema = WORKOUT_SCHEMA
    const fromPhoto = !!image
    // With an equipment photo, use a vision-capable mid model; text-only stays cheap.
    model = fromPhoto ? MODEL_MID : MODEL_LITE
    content = [{ type: 'text', text: buildWorkoutPrompt({ goal, equipment, gymName, persona, fromPhoto }) }]
    if (fromPhoto) content.push({ type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } })
  } else if (mode === 'parse') {
    if (!text) return json(400, { error: 'Paste some text to parse.' })
    schema = PARSE_SCHEMA
    model = MODEL_LITE // structuring pasted text — cheap tier is fine
    content = [{ type: 'text', text: buildParsePrompt(text, persona) }]
  } else if (mode === 'fridge' || mode === 'meal') {
    if (!image) return json(400, { error: 'Please provide a photo.' })
    schema = mode === 'fridge' ? FRIDGE_SCHEMA : MEAL_SCHEMA
    // model stays MODEL (Opus) — macro/photo accuracy matters here
    content = [
      { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
      { type: 'text', text: buildPrompt(mode, remaining, persona, nutritionStyle, extras, recovery) },
    ]
  } else {
    return json(400, { error: 'Unknown mode.' })
  }

  const payload = {
    model,
    max_tokens: 1400,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) {
      return json(res.status, { error: data?.error?.message || 'Claude API error.' })
    }

    const textBlock = (data.content || []).find((b) => b.type === 'text')
    if (!textBlock) {
      return json(502, { error: 'No result returned. Try a clearer, well-lit photo.' })
    }

    let parsed
    try {
      parsed = JSON.parse(textBlock.text)
    } catch {
      return json(502, { error: 'Could not read the result. Try another photo.' })
    }

    return json(200, parsed)
  } catch (err) {
    return json(502, { error: 'Could not reach the AI service. Please try again.' })
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(obj),
  }
}
