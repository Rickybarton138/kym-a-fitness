// Regression test for the form-checker hang.
//
// Paul, 17 Oct 2026: "When trying to upload a video to the form reviewer it
// just seems to hang and get stuck saying 'checking your form' but nothing
// actually happens."
//
// extractFrames waited on `loadedmetadata` and `seeked`. A clip the browser
// cannot demux fires NEITHER of those NOR `error`, so the promise never
// settled, the await never returned, and because the database insert sat behind
// it the clip was never even recorded for the coach.
//
// The positive control comes first and matters most: a test that only proves
// "a dead video resolves" would also pass if extractFrames resolved instantly
// with nothing for every input, which would silently kill the AI pointers for
// everybody.
//
// Run: node tasks/test_extract_frames_timeout.mjs
import assert from 'node:assert'

// --- the smallest DOM extractFrames needs ------------------------------------
// `behaviour` decides which events the fake <video> fires, which is the whole
// point: each one reproduces a different real-world stall.
let behaviour = 'ok'

class FakeCanvas {
  constructor() { this.width = 0; this.height = 0 }
  getContext() { return { drawImage() {} } }
  toDataURL() { return 'data:image/jpeg;base64,RkFLRUZSQU1F' }
}

class FakeVideo {
  constructor() {
    this.duration = 9
    this.videoWidth = 1920
    this.videoHeight = 1080
    this._t = 0
    this.onloadedmetadata = null
    this.onseeked = null
    this.onerror = null
    // A real element fires loadedmetadata off the task queue, not inline.
    if (behaviour !== 'never_opens') setTimeout(() => this.onloadedmetadata?.(), 1)
    if (behaviour === 'errors') setTimeout(() => this.onerror?.(), 1)
  }
  set currentTime(v) {
    this._t = v
    if (behaviour === 'ok') { setTimeout(() => this.onseeked?.(), 1); return }
    if (behaviour === 'first_seek_only') {
      // One frame lands, then seeking wedges -- a variable-frame-rate clip.
      if (this._seeked) return
      this._seeked = true
      setTimeout(() => this.onseeked?.(), 1)
    }
    // 'seek_hangs' and 'never_opens' fire nothing at all, ever.
  }
  get currentTime() { return this._t }
  removeAttribute() {}
  load() {}
}

globalThis.document = { createElement: (tag) => (tag === 'video' ? new FakeVideo() : new FakeCanvas()) }
globalThis.URL.createObjectURL = () => 'blob:fake'
globalThis.URL.revokeObjectURL = () => {}

const { extractFrames } = await import('../src/lib.js')

const FAILS = []
const ok = (label, passed, detail = '') => {
  if (!passed) FAILS.push(label)
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ' -- ' + detail : ''}`)
}
const file = { type: 'video/mp4', name: 'squat.mp4', size: 1234 }
const timed = async (fn) => { const t = Date.now(); const r = await fn(); return [r, Date.now() - t] }

// --- positive control --------------------------------------------------------

behaviour = 'ok'
let [frames, ms] = await timed(() => extractFrames(file, 3))
ok('CONTROL: a readable clip still yields three frames', frames.length === 3, `${frames.length} frames`)
ok('CONTROL: and does not wait for a timeout to do it', ms < 1000, `${ms}ms`)
ok('CONTROL: the frames are base64, with no data: prefix',
  typeof frames[0] === 'string' && frames[0] === 'RkFLRUZSQU1F', String(frames[0]).slice(0, 24))

behaviour = 'ok'
;[frames] = await timed(() => extractFrames(file, 1))
ok('a count of 1 returns exactly one frame', frames.length === 1, `${frames.length}`)

// --- the hang, in each of its forms ------------------------------------------
// Short timeouts so the suite runs in about a second rather than thirty.

behaviour = 'never_opens'
;[frames, ms] = await timed(() => extractFrames(file, 3, { totalMs: 150, seekMs: 80 }))
ok('REGRESSION: a clip that never opens RESOLVES instead of hanging forever',
  Array.isArray(frames) && frames.length === 0, `${frames.length} frames in ${ms}ms`)
ok('and it gives up on the total clock, promptly', ms < 600, `${ms}ms`)

behaviour = 'seek_hangs'
;[frames, ms] = await timed(() => extractFrames(file, 3, { totalMs: 2000, seekMs: 100 }))
ok('REGRESSION: a clip that opens but never seeks resolves too',
  Array.isArray(frames) && frames.length === 0, `${frames.length} frames in ${ms}ms`)
ok('and the per-seek clock fires without waiting out the total one', ms < 900, `${ms}ms`)

behaviour = 'first_seek_only'
;[frames, ms] = await timed(() => extractFrames(file, 3, { totalMs: 2000, seekMs: 100 }))
ok('a clip that stalls PART WAY keeps the frames it already got',
  frames.length === 1, `${frames.length} frames in ${ms}ms`)

behaviour = 'errors'
;[frames] = await timed(() => extractFrames(file, 3, { totalMs: 500, seekMs: 100 }))
ok('a genuine media error resolves empty rather than rejecting',
  Array.isArray(frames) && frames.length === 0, `${frames.length}`)

// Nothing above may reject: the caller treats a throw as "skip the AI", but an
// unhandled rejection in that position used to take the whole save with it.
behaviour = 'never_opens'
let threw = false
try { await extractFrames(file, 3, { totalMs: 100, seekMs: 50 }) } catch { threw = true }
ok('extractFrames never rejects, whatever the clip', !threw)

console.log()
if (FAILS.length) {
  console.log(`${FAILS.length} FAILED:`)
  FAILS.forEach((f) => console.log(`  - ${f}`))
  process.exit(1)
}
console.log('all passed')
