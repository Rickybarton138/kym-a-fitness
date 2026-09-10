// Put Ricky's real face on every Rick.Fit hero.
//
// Two families of image need it, for different reasons:
//
//   The stock gym shots (.private/ricky/stock/stock-N.jpg) are photographs of
//   somebody else. He liked the pictures — the neon-on-black look is the brand —
//   he just wanted to be the man in them. Only stock-1 and stock-4 contain a
//   visible face; stock-2 is a close crop of an arm and stock-3 is an empty gym,
//   and asked to swap a face in those the model invents a whole new man and
//   scene. Those two ship untouched and are not listed here.
//
//   The goal renders (.private/ricky/out/goal-*-aged.png) are already him, but
//   they were generated from a 150x220-pixel crop off a mirror selfie. At that
//   resolution the model invents the face, and what it invents is a gaunter,
//   older, more angular man than he actually is. Same fix: give it the real
//   face and tell it to use that.
//
// Sibling to ricky-transform.mjs, which does the opposite job: that one keeps
// HIM and changes the body. Same model, same endpoint, same "his app, his face,
// his call" reasoning.
//
// The reference is doing nearly all the work now. It was a soft upscale until
// 9 Sept, which is why the first two rounds came back looking mid-fifties and
// needed the age argued into the prompt. It is now a 670x1080 crop from a real
// front-on photo — about twenty times the actual facial detail — so the prompt
// can mostly stop describing him and let the picture speak.
//
// Inputs:
//   .private/ricky/face-ref.jpg   head crop from .private/ricky/in/hero/face-source.jpg
//
// Run: OPENAI_API_KEY=... node scripts/ricky-face-swap.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OPENAI = process.env.OPENAI_API_KEY
if (!OPENAI) { console.error('OPENAI_API_KEY not set'); process.exit(1) }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '.private', 'ricky')
const OUT = join(ROOT, 'out')
const FACE = join(ROOT, 'face-ref.jpg')
mkdirSync(OUT, { recursive: true })

if (!existsSync(FACE)) { console.error(`no face reference at ${FACE}`); process.exit(1) }

// Goal renders start from the FIRST-generation `-aged` files rather than from the
// already-de-aged ones, so each output is one edit on top of an original instead
// of two edits stacked. Generations degrade; do not pile them up.
const TARGETS = [
  { src: join(ROOT, 'stock/stock-1.jpg'), out: join(OUT, 'face-1.png'), size: '1536x1024' },
  { src: join(ROOT, 'stock/stock-4.jpg'), out: join(OUT, 'face-4.png'), size: '1536x1024' },
  { src: join(OUT, 'goal-v3-lateral-raise-aged.png'), out: join(OUT, 'goal-v3-lateral-raise.png'), size: '1024x1536' },
  { src: join(OUT, 'goal-july-16-aged.png'), out: join(OUT, 'goal-july-16.png'), size: '1024x1536' },
  { src: join(OUT, 'goal-july-16-dumbbells-aged.png'), out: join(OUT, 'goal-july-16-dumbbells.png'), size: '1024x1536' },
  { src: join(OUT, 'goal-v2-aged.png'), out: join(OUT, 'goal-v2.png'), size: '1024x1536' },
]

// Short on description, heavy on "use the reference and change nothing else".
// With a sharp reference the model does not need to be told his hair colour, and
// telling it anyway gives it something to argue with the photograph about.
const PROMPT = [
  'The first image is a photograph. The second image is a clear reference photograph of a man.',
  'Edit the first image so that the man in it has the face of the man in the reference.',
  'Copy the reference face closely and carefully: the same face shape, the same proportions,',
  'the same eyes and eye colour, the same nose and mouth, the same hair colour, hairline and',
  'hair style, the same skin tone and complexion, the same light stubble, the same apparent age.',
  'He is 45 and should look about 40 — fit, healthy and in his prime. Do not add wrinkles,',
  'hollow cheeks, jowls, grey hair or tired eyes that are not in the reference.',
  'Change NOTHING else. Keep the exact same body, build, muscle definition, pose, hands,',
  'clothing, equipment, background, framing, camera angle, lighting and colour grade.',
  'Adapt only the head angle and the light falling on the face so it sits naturally in the scene.',
  'The result must read as an ordinary photograph of that man.',
  'Entirely photorealistic. No text, no watermark, no graphics.',
].join(' ')

const face = readFileSync(FACE)

for (const { src, out, size } of TARGETS) {
  const name = src.split(/[\\/]/).pop()
  if (!existsSync(src)) { console.log(`${name} missing, skipped`); continue }

  // Never overwrite the only copy of something that cost a generation to make.
  const backup = out.replace(/\.png$/, '-prev.png')
  if (existsSync(out) && !existsSync(backup)) copyFileSync(out, backup)

  process.stdout.write(`${name} ... `)
  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('prompt', PROMPT)
  form.append('size', size)
  form.append('image[]', new Blob([readFileSync(src)], { type: /\.png$/.test(src) ? 'image/png' : 'image/jpeg' }), name)
  form.append('image[]', new Blob([face], { type: 'image/jpeg' }), 'face-ref.jpg')

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { authorization: `Bearer ${OPENAI}` }, body: form,
  })
  const j = await res.json()
  if (!res.ok || !j.data?.[0]) {
    console.log('FAILED —', (j.error?.message || res.status).toString().slice(0, 160))
    continue
  }
  const b64 = j.data[0].b64_json
  const buf = b64 ? Buffer.from(b64, 'base64') : Buffer.from(await (await fetch(j.data[0].url)).arrayBuffer())
  writeFileSync(out, buf)
  console.log('->', out.split(/[\\/]/).pop())
}

console.log(`\nSources untouched. Results in ${OUT} (git-ignored).`)
