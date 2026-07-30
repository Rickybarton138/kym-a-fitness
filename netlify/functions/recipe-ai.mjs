// Turn a recipe URL, pasted text, or a screenshot into a structured recipe:
// title, ingredients, servings, method and PER-SERVING macros (estimated from the
// ingredients when the source doesn't state them). Also pulls a meal image from
// the page. Powers URL-import, paste, and screenshot migration.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

const INSTRUCTION =
  'Extract a single recipe and return STRICT JSON only, no markdown:\n' +
  '{"title":"","servings":<int>,"ingredients":["qty + item", ...],"method":"a few short numbered steps",' +
  '"calories":<int>,"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>,"fibre_g":<int>}\n' +
  'The macros are PER SERVING. If the source states nutrition, use it; otherwise estimate sensibly from the ingredients and servings. ' +
  'If servings are unknown, assume the recipe makes what it looks like and pick a sensible number. Keep ingredients as a clean shopping-friendly list.'

function extractImage(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (og) return og[1]
  const ld = html.match(/"image"\s*:\s*"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
  return ld ? ld[1] : null
}
function jsonLdRecipe(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const m of blocks) {
    try {
      let data = JSON.parse(m[1].trim())
      const arr = Array.isArray(data) ? data : (data['@graph'] || [data])
      const r = arr.find((x) => { const t = x && x['@type']; return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe')) })
      if (r) return r
    } catch { /* skip bad block */ }
  }
  return null
}
const stripHtml = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function claude(content) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 900, messages: [{ role: 'user', content }] }),
  })
  const j = await res.json()
  const text = j?.content?.[0]?.text || '{}'
  const m = text.match(/\{[\s\S]*\}/)
  return JSON.parse(m ? m[0] : '{}')
}

export const handler = async (event) => {
  const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  try {
    const { url, text, image, mediaType } = JSON.parse(event.body || '{}')
    let image_url = null, source_url = url || null, content

    if (image) {
      content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
        { type: 'text', text: 'Read this recipe from the image. ' + INSTRUCTION },
      ]
    } else if (url) {
      const res = await fetch(url, { headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-GB,en;q=0.9',
      } })
      const html = await res.text()
      image_url = extractImage(html)
      const ld = jsonLdRecipe(html)
      const src = ld ? JSON.stringify({ name: ld.name, recipeIngredient: ld.recipeIngredient, recipeInstructions: ld.recipeInstructions, recipeYield: ld.recipeYield, nutrition: ld.nutrition }).slice(0, 6000)
        : stripHtml(html).slice(0, 7000)
      if (ld && ld.image) image_url = image_url || (typeof ld.image === 'string' ? ld.image : (ld.image.url || (Array.isArray(ld.image) ? ld.image[0] : null)))
      content = [{ type: 'text', text: `${INSTRUCTION}\n\nSOURCE:\n${src}` }]
    } else if (text) {
      content = [{ type: 'text', text: `${INSTRUCTION}\n\nSOURCE:\n${String(text).slice(0, 7000)}` }]
    } else {
      return { statusCode: 400, headers: cors, body: '{"error":"Provide a url, text or image."}' }
    }

    const r = await claude(content)
    const int = (v) => Math.max(0, Math.round(Number(v) || 0))
    // Couldn't read it (blocked page / not a recipe) — steer to paste/photo.
    if ((!Array.isArray(r.ingredients) || r.ingredients.length === 0) && int(r.calories) === 0) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ error: url ? "Couldn't read that page automatically — some sites block it. Try the Paste or Photo option instead." : "Couldn't read that recipe — try again or add it manually." }) }
    }
    return {
      statusCode: 200, headers: cors,
      body: JSON.stringify({
        title: String(r.title || 'Recipe').slice(0, 120),
        servings: int(r.servings) || 1,
        ingredients: Array.isArray(r.ingredients) ? r.ingredients.map(String).slice(0, 40) : [],
        method: String(r.method || ''),
        calories: int(r.calories), protein_g: int(r.protein_g), carbs_g: int(r.carbs_g), fat_g: int(r.fat_g), fibre_g: int(r.fibre_g),
        image_url, source_url,
      }),
    }
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ error: String(e.message || e) }) }
  }
}
