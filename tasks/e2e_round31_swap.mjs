// The "Can't do this? Swap it" function, which had no test at all.
//
// Written expecting to find the photo path broken — it sends the picture to a
// model that reasons before answering, with max_tokens: 200, which is exactly
// the assumption that made meal-plan.mjs return an empty shopping list. It is
// NOT broken: production passes every assertion here. A short prompt and a
// simple image leave room for both the reasoning and the answer.
//
// The test stays because the margin is invisible from outside. The identical
// assumption held for three meals and failed silently at twelve, and nothing
// about a 200-token cap tells you which side of that line you are on. This
// asserts the photo path returns something, so a busier photo or a chattier
// model shows up here instead of as "No suggestion — try again" for a client.
//
// Run: node tasks/e2e_round31_swap.mjs <deploy-url>
const SITE = process.argv[2]
if (!SITE) { console.error('usage: node tasks/e2e_round31_swap.mjs <url>'); process.exit(1) }
const FN = SITE.replace(/\/$/, '') + '/.netlify/functions/exercise-swap'

let failures = 0
const ok = (l, pass, extra = '') => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${l}${extra ? ' — ' + extra : ''}`) }

const post = async (body) => {
  const t0 = Date.now()
  const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!(r.headers.get('content-type') || '').includes('json')) return { error: `HTTP ${r.status} — not JSON` }
  return { ...(await r.json()), secs: ((Date.now() - t0) / 1000).toFixed(1) }
}

// A rack with a weight stack, drawn straight into a PNG — no image library, so
// this runs anywhere. It doesn't have to fool anyone: the bug was the number of
// tokens the model spent looking at a picture before answering, not what it
// decided the picture was. Any real image down the real vision path finds it.
import { deflateSync } from 'node:zlib'

function png(w, h, draw) {
  const px = Buffer.alloc(w * h * 3, 0xe8)
  const set = (x0, y0, x1, y1, [r, g, b]) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
        const i = (y * w + x) * 3
        px[i] = r; px[i + 1] = g; px[i + 2] = b
      }
    }
  }
  draw(set)
  // One filter byte (0 = none) in front of every row, then deflate.
  const raw = Buffer.alloc(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    px.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3)
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

const DARK = [34, 34, 34], MID = [85, 85, 85]
const image = png(480, 480, (set) => {
  set(90, 300, 390, 330, DARK)                              // base
  set(120, 120, 150, 310, DARK)                             // left upright
  set(330, 120, 360, 310, DARK)                             // right upright
  set(120, 120, 360, 145, DARK)                             // top crossbar
  for (let i = 0; i < 6; i++) set(200, 150 + i * 22, 280, 167 + i * 22, MID)  // weight stack
}).toString('base64')

// ---------------------------------------------------------------------------
// 1. The typed path — the half that always worked, so a regression here is mine
// ---------------------------------------------------------------------------
const typed = await post({ name: 'Barbell back squat', reason: 'my knees hurt' })
ok('a typed swap comes back', !!typed.name, typed.error || `in ${typed.secs}s`)
ok('and it is not the exercise being swapped',
  !!typed.name && typed.name.toLowerCase() !== 'barbell back squat', typed.name)
ok('with a reason attached', !!typed.cue, typed.cue)

// ---------------------------------------------------------------------------
// 2. The photo path — the half that was returning nothing at all
// ---------------------------------------------------------------------------
const shot = await post({ name: 'Leg press', reason: 'this machine is taken', image, mediaType: 'image/png' })
ok('a photo swap comes back at all', !!shot.name,
  shot.name ? `in ${shot.secs}s` : (shot.error || `returned nothing in ${shot.secs}s — the whole token budget went on thinking`))
ok('and it is a real suggestion, not an empty string', (shot.name || '').length > 3, shot.name)
ok('with a reason attached', !!shot.cue, shot.cue)

// ---------------------------------------------------------------------------
// 3. Bad input is still refused
// ---------------------------------------------------------------------------
const empty = await post({})
ok('an empty request is refused rather than guessed at', !empty.name, JSON.stringify(empty).slice(0, 80))

console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed')
process.exit(failures ? 1 : 0)
