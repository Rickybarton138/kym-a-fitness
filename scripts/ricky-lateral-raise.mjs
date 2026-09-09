// Dumbbells in his hands, mid lateral raise.
//
// Runs on goal-v2.png — the leaner version he approved — not the original photo
// or the first dumbbell attempt. Each round edits the last approved output so
// the face, physique, gym and lighting he has already signed off survive and
// only the thing he asked about changes.
//
// This one deliberately does NOT say "same pose": the pose is the change.
//
// Run: node scripts/ricky-lateral-raise.mjs   (needs OPENAI_API_KEY)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KEY = process.env.OPENAI_API_KEY
if (!KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1) }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '.private', 'ricky')
const SRC = join(ROOT, 'out', 'goal-v2.png')
const DEST = join(ROOT, 'out', 'goal-v3-lateral-raise.png')

const PROMPT = [
  'Put a heavy dumbbell in each hand and change his pose to a dumbbell lateral',
  'raise, caught at the top of the rep: standing tall, chest up, core braced,',
  'both arms raised out to the sides to shoulder height, elbows very slightly',
  'bent, wrists level with the elbows, palms facing the floor. Solid black',
  'hex or round-plate dumbbells with believable weight — hands closed hard around',
  'the handles, forearms, shoulders and traps visibly loaded and tensed, a hint of',
  'strain in the posture.',
  'Change nothing else. Same man, same face, same hair, same physique and body',
  'composition, same shorts and trainers, same gym, same equipment, same lighting,',
  'same haze, same camera angle and the same framing.',
  'Photorealistic, matching the existing light and shadow exactly.',
  'No text, no watermark, no graphics.',
].join(' ')

const form = new FormData()
form.append('model', 'gpt-image-2')
form.append('prompt', PROMPT)
form.append('size', '1024x1536')
form.append('image', new Blob([readFileSync(SRC)], { type: 'image/png' }), 'in.png')

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
