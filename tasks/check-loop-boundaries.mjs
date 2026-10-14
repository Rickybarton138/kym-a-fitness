// Does each exercise clip actually loop, or does it visibly jump?
//
//   node tasks/check-loop-boundaries.mjs
//   node tasks/check-loop-boundaries.mjs --dir public/brands/ricky/exercises
//
// The video handoff asks for "five consecutive loop boundaries inspected per
// clip" — 200 visual passes across 40 clips, which nobody has made and which is
// a poor use of a person either way. The thing those passes are looking for is
// a jump at the seam, and a jump is measurable.
//
// Method. Decode every clip to a small greyscale frame series, then compare:
//
//   SEAM  — how different the last frame is from the first. A clip that loops
//           cleanly ends roughly where it began.
//   STEP  — the median difference between neighbouring frames inside the clip,
//           which is how much the picture normally changes in 1/24th of a
//           second for THIS clip and THIS movement.
//
// The ratio is what matters, not the raw seam number. A fast lift moves a lot
// between any two frames, so a seam of 8 is nothing there and glaring in a
// still plank. ratio = SEAM / STEP:
//
//   <= 2    the seam looks like any other frame transition — it loops
//   2 - 5   a soft bump, likely noticeable on a loop that repeats
//   > 5     a visible jump, the clip restarts rather than loops
//
// Greyscale and 64x36 on purpose: this is looking for gross position change,
// not compression noise or a lighting flicker.
//
// What this does NOT check: whether the rep is good, whether it is the right
// exercise, or whether the subject looks right. Those still need eyes.

import { spawnSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dirArg = process.argv.indexOf('--dir')
const DIR = dirArg > -1 ? process.argv[dirArg + 1] : 'public/brands/ricky/exercises'
const W = 64
const H = 36
const FRAME = W * H

if (!existsSync(DIR)) {
  console.error(`No such directory: ${DIR}`)
  process.exit(1)
}

function framesOf(file) {
  const r = spawnSync('ffmpeg', [
    '-v', 'error', '-i', file,
    '-vf', `scale=${W}:${H},format=gray`,
    '-f', 'rawvideo', '-',
  ], { maxBuffer: 1 << 28, encoding: 'buffer' })
  if (r.status !== 0) throw new Error(r.stderr?.toString().slice(0, 200) || 'ffmpeg failed')
  const buf = r.stdout
  const n = Math.floor(buf.length / FRAME)
  const out = []
  for (let i = 0; i < n; i++) out.push(buf.subarray(i * FRAME, (i + 1) * FRAME))
  return out
}

const meanAbsDiff = (a, b) => {
  let s = 0
  for (let i = 0; i < FRAME; i++) s += Math.abs(a[i] - b[i])
  return s / FRAME
}

const median = (xs) => {
  const s = [...xs].sort((x, y) => x - y)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.mp4')).sort()
if (!files.length) {
  console.error(`No .mp4 files in ${DIR}`)
  process.exit(1)
}

console.log(`Loop-boundary check — ${files.length} clips in ${DIR}\n`)
console.log('clip                                 frames   seam   step  ratio  verdict')

const rows = []
for (const f of files) {
  let frames
  try {
    frames = framesOf(join(DIR, f))
  } catch (e) {
    console.log(`${f.padEnd(36)}  ffmpeg failed: ${e.message}`)
    rows.push({ f, bad: true })
    continue
  }
  if (frames.length < 4) {
    console.log(`${f.padEnd(36)}  only ${frames.length} frames`)
    rows.push({ f, bad: true })
    continue
  }
  const steps = []
  for (let i = 1; i < frames.length; i++) steps.push(meanAbsDiff(frames[i - 1], frames[i]))
  const step = median(steps)
  const seam = meanAbsDiff(frames[frames.length - 1], frames[0])
  // A perfectly still clip has a step near zero; guard the division so it does
  // not report an infinite ratio for a plank that barely moves.
  const ratio = seam / Math.max(step, 0.35)
  const verdict = ratio <= 2 ? 'loops' : ratio <= 5 ? 'soft bump' : 'VISIBLE JUMP'
  rows.push({ f, frames: frames.length, seam, step, ratio, verdict })
  console.log(
    `${f.padEnd(36)} ${String(frames.length).padStart(5)} ${seam.toFixed(2).padStart(6)} ${step.toFixed(2).padStart(6)} ${ratio.toFixed(1).padStart(6)}  ${verdict}`,
  )
}

const ok = rows.filter((r) => r.verdict === 'loops')
const soft = rows.filter((r) => r.verdict === 'soft bump')
const jump = rows.filter((r) => r.verdict === 'VISIBLE JUMP')
const bad = rows.filter((r) => r.bad)

console.log(`\n${ok.length} loop cleanly · ${soft.length} soft bump · ${jump.length} visible jump · ${bad.length} unreadable`)
if (jump.length) {
  console.log('\nRe-generate these, or trim them to a whole movement cycle:')
  for (const r of jump.sort((a, b) => b.ratio - a.ratio)) console.log(`   ${r.f}  (ratio ${r.ratio.toFixed(1)})`)
}
if (soft.length) {
  console.log('\nWorth a look, in this order:')
  for (const r of soft.sort((a, b) => b.ratio - a.ratio)) console.log(`   ${r.f}  (ratio ${r.ratio.toFixed(1)})`)
}
