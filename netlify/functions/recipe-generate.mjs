// Coach tool: generate a batch of original recipes for a category, with per-serving
// macros — the coach reviews and saves them to their library. Lets a coach stand up
// an owned recipe library fast instead of inheriting a provider's.
import { firstText } from './_claude-text.mjs'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

export const handler = async (event) => {
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  try {
    const { category, count } = JSON.parse(event.body || '{}')
    const n = Math.min(Math.max(Number(count) || 6, 1), 8)
    const cat = String(category || 'healthy meals').slice(0, 80)
    const prompt =
      `Generate ${n} distinct, practical "${cat}" recipes a coaching client could actually make. ` +
      'Return STRICT JSON array only, no markdown:\n' +
      '[{"title":"","servings":<int>,"ingredients":["qty + item", ...],"method":"a few short steps",' +
      '"calories":<int>,"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>,"fibre_g":<int>,"tags":["...", ...]}]\n' +
      'Macros are PER SERVING and should be realistic. Vary the recipes (different mains, cuisines). Keep ingredients shopping-friendly.\n' +
      'tags: 2-4 lowercase filter tags a client would search by. Include a meal type when clear ' +
      '(breakfast, lunch, dinner, snack) and any that genuinely apply from: high-protein, low-calorie, ' +
      'low-carb, high-fibre, vegetarian, vegan, quick, meal-prep, budget. Only tags that truly fit the recipe.'
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
    })
    const j = await res.json()
    const text = firstText(j, '[]')
    const m = text.match(/\[[\s\S]*\]/)
    const arr = JSON.parse(m ? m[0] : '[]')
    const int = (v) => Math.max(0, Math.round(Number(v) || 0))
    const recipes = (Array.isArray(arr) ? arr : []).slice(0, n).map((r) => ({
      title: String(r.title || 'Recipe').slice(0, 120),
      servings: int(r.servings) || 1,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(String).slice(0, 40) : [],
      method: String(r.method || ''),
      calories: int(r.calories), protein_g: int(r.protein_g), carbs_g: int(r.carbs_g), fat_g: int(r.fat_g), fibre_g: int(r.fibre_g),
      tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 5) : [],
    })).filter((r) => r.calories > 0)
    return { statusCode: 200, headers: cors, body: JSON.stringify({ recipes }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ recipes: [], error: String(e.message || e) }) }
  }
}
