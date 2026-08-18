// Client meal-plan builder: given their calorie/macro targets and a few
// qualifying answers (meals/day, options per meal, snacks, preferences, dietary
// needs, allergies), returns a one-day plan where picking one option per meal
// lands roughly on their targets. Haiku — structured text, no vision.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

export const handler = async (event) => {
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  try {
    const b = JSON.parse(event.body || '{}')
    const calories = Math.max(0, Math.round(Number(b.calories) || 0))
    const protein_g = Math.max(0, Math.round(Number(b.protein_g) || 0))
    const carbs_g = Math.max(0, Math.round(Number(b.carbs_g) || 0))
    const fat_g = Math.max(0, Math.round(Number(b.fat_g) || 0))
    if (!calories) return { statusCode: 400, headers: cors, body: '{"error":"targets required"}' }
    const meals = Math.min(4, Math.max(2, Number(b.meals) || 3))
    const options = Math.min(3, Math.max(1, Number(b.options) || 2))
    const snacks = !!b.snacks
    const dietary = String(b.dietary || '').slice(0, 200).trim()
    const allergies = String(b.allergies || '').slice(0, 200).trim()
    const preferences = String(b.preferences || '').slice(0, 300).trim()
    const recovery = !!(b.recovery && b.recovery.on)
    const recoveryNote = recovery && b.recovery.note ? String(b.recovery.note).slice(0, 200) : ''

    const prompt =
      `Build a realistic one-day meal plan for a coaching client.\n` +
      `Daily targets: ${calories} kcal, ${protein_g}g protein, ${carbs_g}g carbs, ${fat_g}g fat.\n` +
      `${meals} main meals${snacks ? ' plus a snacks group' : ''}. Give ${options} distinct option(s) per meal — the client picks ONE per meal.\n` +
      `CRITICAL: choosing one option from each main meal (and one snack if present) must sum to roughly the daily targets (within ~5%). Split the calories/macros sensibly across the meals.\n` +
      (recovery
        ? `RECOVERY-AWARE MODE — this client is in recovery from disordered eating${recoveryNote ? ` and finds this hard: ${recoveryNote}` : ''}. Every option must be generous, satisfying and genuinely nourishing — real, adequate meals. NEVER use "light", "skinny", "low-cal", "guilt-free" or any restrictive framing, and never fall short of the targets. Warm, non-judgmental descriptions. The "note" must be gentle and encouraging about nourishing themselves and going at their own pace — not about hitting numbers or eating less.\n`
        : '') +
      (dietary ? `Dietary requirements: ${dietary}. ` : '') +
      (allergies ? `NEVER include these allergens/intolerances: ${allergies}. ` : '') +
      (preferences ? `Preferences: ${preferences}. ` : '') +
      `Keep meals shopping-friendly and quick to make.\n` +
      `Return STRICT JSON only, no markdown:\n` +
      `{"meals":[{"name":"Breakfast","options":[{"title":"","description":"1 short line, key ingredients","calories":<int>,"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>}]}],"note":"1 short line on how to use it"}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    })
    const j = await res.json()
    const text = j?.content?.[0]?.text || '{}'
    const m = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(m ? m[0] : '{}')
    const int = (v) => Math.max(0, Math.round(Number(v) || 0))
    const cleanMeals = (Array.isArray(parsed.meals) ? parsed.meals : []).map((ml) => ({
      name: String(ml.name || 'Meal').slice(0, 40),
      options: (Array.isArray(ml.options) ? ml.options : []).slice(0, options).map((o) => ({
        title: String(o.title || 'Option').slice(0, 100),
        description: String(o.description || '').slice(0, 200),
        calories: int(o.calories), protein_g: int(o.protein_g), carbs_g: int(o.carbs_g), fat_g: int(o.fat_g),
      })),
    })).filter((ml) => ml.options.length)
    if (!cleanMeals.length) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'Could not build a plan — try again.' }) }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ meals: cleanMeals, note: String(parsed.note || '').slice(0, 160) }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ error: String(e.message || e) }) }
  }
}
