// Adjust an already-generated image without starting over.
//
// Each round of "a bit less of that" runs on the PREVIOUS output, so the parts
// he has already approved — face, gym, lighting, framing — survive. Going back
// to the source photo each time re-rolls everything and hands him a different
// picture to judge.
//
// Run: node scripts/ricky-tweak.mjs <source.png> <output.png> "what to change"
import { readFileSync, writeFileSync } from 'node:fs'

const [, , src, dest, tweak] = process.argv
const KEY = process.env.OPENAI_API_KEY
if (!KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1) }
if (!src || !dest || !tweak) {
  console.error('usage: node scripts/ricky-tweak.mjs <source.png> <output.png> "what to change"')
  process.exit(1)
}

const PROMPT = [
  tweak,
  'Change NOTHING else at all. Same man, same face, same hair, same pose, same shorts',
  'and trainers, same gym, same equipment, same lighting, same haze, same camera angle',
  'and the same framing. Photorealistic, matching the existing light and shadow.',
  'No text, no watermark, no graphics.',
].join(' ')

const form = new FormData()
form.append('model', 'gpt-image-2')
form.append('prompt', PROMPT)
form.append('size', '1024x1536')
form.append('image', new Blob([readFileSync(src)], { type: 'image/png' }), 'in.png')

const res = await fetch('https://api.openai.com/v1/images/edits', {
  method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form,
})
const j = await res.json()
if (!res.ok || !j.data?.[0]) {
  console.error('FAILED —', (j.error?.message || res.status).toString().slice(0, 200))
  process.exit(1)
}
const b64 = j.data[0].b64_json
const out = b64 ? Buffer.from(b64, 'base64') : Buffer.from(await (await fetch(j.data[0].url)).arrayBuffer())
writeFileSync(dest, out)
console.log('->', dest)
