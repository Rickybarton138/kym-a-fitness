// Hero imagery for Rick.Fit's home carousel.
//
// Ricky asked for the app to be more visually engaging. The carousel has always
// existed and has always been empty. Canva could not do this — it fills
// templates, so it returned a gym photo with "Focused Strength" stamped across
// it and the subject's head cropped off.
//
// Shipped as static brand assets rather than uploaded to storage: THEME.heroImages
// is concatenated ahead of the coach's own uploads, so this needs no bucket, no
// service-role key and no rows in the database.
//
// Run: node scripts/make-ricky-heroes.mjs   (needs OPENAI_API_KEY)
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KEY = process.env.OPENAI_API_KEY
if (!KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1) }

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'brands', 'ricky')
mkdirSync(OUT, { recursive: true })

// A house style, so four images look like one set rather than four stock photos.
const STYLE = [
  'Photorealistic, cinematic, shot on a fast prime lens, shallow depth of field.',
  'A near-black gym at night. The only colour is a single vivid neon green light source (#2ee85c) rim-lighting the subject from behind and running as a thin line along the floor.',
  'Deep shadows, high contrast, faint haze in the air catching the green. Everything else desaturated, almost monochrome.',
  'Quiet and serious. An ordinary strong person training alone, not a fitness model posing.',
  'Absolutely no text, no lettering, no numbers, no logos, no watermarks, no graphic overlays of any kind.',
].join(' ')

const SHOTS = [
  ['hero-1', 'A man in his mid-forties in a plain black t-shirt, seated at a chest-press machine mid-set, seen from a low three-quarter angle. Face partly in shadow, jaw set, eyes down on the work.'],
  ['hero-2', 'Close on a pair of hands chalked and gripping a dumbbell handle on a rack, forearm and bicep in sharp focus, the gym falling away into darkness behind.'],
  ['hero-3', 'Wide shot of an empty free-weights floor before anyone arrives: racks, a bench, dumbbells in a row, the green floor light stretching away into the dark. No people at all.'],
  ['hero-4', 'A man in his mid-forties sat on a bench between sets, elbows on knees, head down, towel round his neck, breathing. Seen from the side, mostly silhouette against the green.'],
]

for (const [name, scene] of SHOTS) {
  process.stdout.write(`${name} ... `)
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt: `${scene} ${STYLE}`,
      size: '1536x1024',
      n: 1,
    }),
  })
  const j = await res.json()
  if (!res.ok || !j.data?.[0]) {
    console.log('FAILED —', (j.error?.message || res.status).toString().slice(0, 120))
    continue
  }
  const b64 = j.data[0].b64_json
  if (b64) {
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(b64, 'base64'))
  } else {
    const img = await fetch(j.data[0].url).then((r) => r.arrayBuffer())
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(img))
  }
  console.log('saved')
}
