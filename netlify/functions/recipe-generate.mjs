// Coach tool: generate a batch of original recipes for a category, with per-serving
// macros — the coach reviews and saves them to their library. Lets a coach stand up
// an owned recipe library fast instead of inheriting a provider's.
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
      '"calories":<int>,"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>}]\n' +
      'Macros are PER SERVING and should be realistic. Vary the recipes (different mains, cuisines). Keep ingredients shopping-friendly.'
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
    })
    const j = await res.json()
    const text = j?.content?.[0]?.text || '[]'
    const m = text.match(/\[[\s\S]*\]/)
    const arr = JSON.parse(m ? m[0] : '[]')
    const int = (v) => Math.max(0, Math.round(Number(v) || 0))
    const recipes = (Array.isArray(arr) ? arr : []).slice(0, n).map((r) => ({
      title: String(r.title || 'Recipe').slice(0, 120),
      servings: int(r.servings) || 1,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(String).slice(0, 40) : [],
      method: String(r.method || ''),
      calories: int(r.calories), protein_g: int(r.protein_g), carbs_g: int(r.carbs_g), fat_g: int(r.fat_g),
    })).filter((r) => r.calories > 0)
    return { statusCode: 200, headers: cors, body: JSON.stringify({ recipes }) }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ recipes: [], error: String(e.message || e) }) }
  }
}
