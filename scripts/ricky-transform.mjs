// Ricky's progress photos, re-rendered leaner, for him to look at.
//
// He asked, I said a generated version of yourself is a rough thing to measure
// against week to week, and he asked again. His app, his face, his call.
//
// Reads the photos from a LOCAL folder rather than the body-photos bucket. That
// bucket is private and holds every client's progress photos across all five
// brands — Paul's included — and reading it needs the service-role key. Pulling
// that key out to fetch two files is not a trade worth making, and the sandbox
// blocked it, correctly. Handing over two files instead touches nothing but his
// own images.
//
// Put the photos in .private/ricky/in/ (any .jpg or .png), then:
//   node scripts/ricky-transform.mjs            needs OPENAI_API_KEY
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const OPENAI = process.env.OPENAI_API_KEY
if (!OPENAI) { console.error('OPENAI_API_KEY not set'); process.exit(1) }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '.private', 'ricky')
const IN = join(ROOT, 'in')
const OUT = join(ROOT, 'out')
mkdirSync(IN, { recursive: true })
mkdirSync(OUT, { recursive: true })

const files = readdirSync(IN).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
if (!files.length) {
  console.log(`No photos found.\n\nDrop them in:\n  ${IN}\n\nThen run this again.`)
  process.exit(0)
}

// The whole job is that it still has to be HIM. An image model left to itself
// will hand back a generic lean bloke, which is no use as a reference point.
const PROMPT = [
  'Edit this photograph of a man so that he appears noticeably leaner and more muscular,',
  'as he might look after a serious training block: less body fat around the midsection,',
  'visible abdominal definition, fuller chest, shoulders, arms and back.',
  'It must remain unmistakably the SAME PERSON — identical face, head shape, hair, beard,',
  'skin tone and apparent age. Keep the same room, same lighting, same camera angle,',
  'same pose and the same clothing.',
  'Entirely photorealistic, like a later photograph of this man, not a different or younger',
  'person and not a competitive bodybuilder. No text, no watermark, no graphics.',
].join(' ')

for (const f of files) {
  process.stdout.write(`${f} ... `)
  const buf = readFileSync(join(IN, f))
  const type = extname(f).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'

  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('prompt', PROMPT)
  form.append('size', '1024x1536')
  form.append('image', new Blob([buf], { type }), f)

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { authorization: `Bearer ${OPENAI}` }, body: form,
  })
  const j = await res.json()
  if (!res.ok || !j.data?.[0]) {
    console.log('FAILED —', (j.error?.message || res.status).toString().slice(0, 140))
    continue
  }
  const b64 = j.data[0].b64_json
  const out = b64 ? Buffer.from(b64, 'base64') : Buffer.from(await (await fetch(j.data[0].url)).arrayBuffer())
  const dest = join(OUT, `goal-${basename(f, extname(f))}.png`)
  writeFileSync(dest, out)
  console.log('->', dest)
}

console.log(`\nOriginals untouched. Results in ${OUT} (git-ignored).`)
