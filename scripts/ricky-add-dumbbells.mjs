// Put dumbbells in his hands.
//
// Runs on the ALREADY GENERATED image rather than the original photo, so the
// version he has just approved — the physique, the face, the gym, the lighting
// — is preserved and only the hands change. Going back to the original would
// re-roll all of it and he would be looking at a different picture.
//
// Run: node scripts/ricky-add-dumbbells.mjs   (needs OPENAI_API_KEY)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KEY = process.env.OPENAI_API_KEY
if (!KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1) }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '.private', 'ricky')
const SRC = join(ROOT, 'out', 'goal-july-16.png')
const DEST = join(ROOT, 'out', 'goal-july-16-dumbbells.png')

const PROMPT = [
  'Add a heavy dumbbell held in each hand, gripped firmly, arms still held out',
  'to the sides in the same position as now — as if pausing at the top of a',
  'lateral raise. Solid black hex or round-plate dumbbells, appropriate for the',
  'gym around him, with a believable weight to them: hands closed around the',
  'handles, forearms and shoulders loaded and tensed under the weight.',
  'Change NOTHING else. Same man, same face, same physique, same shorts and',
  'trainers, same gym, same lighting, same haze, same camera angle and framing.',
  'Photorealistic, matching the existing light and shadow exactly.',
  'No text, no watermark, no graphics.',
].join(' ')

const buf = readFileSync(SRC)
const form = new FormData()
form.append('model', 'gpt-image-2')
form.append('prompt', PROMPT)
form.append('size', '1024x1536')
form.append('image', new Blob([buf], { type: 'image/png' }), 'goal.png')

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
writeFileSync(DEST, out)
console.log('->', DEST)
