// Paul, 13 Oct: "the message I can add when I pause someone's account... if I
// put a youtube link in the message box will they be able to click that link?"
//
// He could not. The note was rendered as a plain text node and no browser
// auto-links a bare URL in page text — proven in Chromium against the exact
// markup App.jsx produced: 0 anchors. The address was written out on his
// client's hold screen and tapping it did nothing.
//
// linkParts() in src/lib.js is deliberately a pure function returning text and
// link runs, not a component, so it can be tested here in Node rather than
// only through a browser. App.jsx turns those runs into React children, which
// is why a note can never inject markup however it is written.
//
// Run: node tasks/e2e_round44.mjs
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PW = 'C:/Users/info/AppData/Roaming/npm/node_modules/playwright/index.mjs'

let failures = 0
const ok = (label, pass, extra = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
}
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')

const { linkParts } = await import(pathToFileURL(path.join(ROOT, 'src/lib.js')).href)

const links = (t) => linkParts(t).filter((p) => p.type === 'link').map((p) => p.href)
const rebuilt = (t) => linkParts(t).map((p) => p.value).join('')

// --- what Paul will actually type ------------------------------------------

const NOTE = 'Paused until November. Have a watch of this: https://www.youtube.com/watch?v=dQw4w9WgXcQ'
ok('a YouTube link in a pause note becomes a link',
  links(NOTE).length === 1 && links(NOTE)[0] === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  JSON.stringify(links(NOTE)))

// A link mid-sentence is the common case, and the full stop is not part of it.
ok('a trailing full stop stays in the sentence',
  links('See https://youtu.be/abc123.')[0] === 'https://youtu.be/abc123',
  links('See https://youtu.be/abc123.')[0])
ok('...and so does a closing bracket',
  links('(see https://youtu.be/abc123)')[0] === 'https://youtu.be/abc123',
  links('(see https://youtu.be/abc123)')[0])

ok('the short youtu.be form works', links('https://youtu.be/abc123').length === 1)
ok('two links in one note both work',
  links('Warm up https://youtu.be/aaa then stretch https://youtu.be/bbb').length === 2)

// Not guessing a scheme for someone: a bare domain stays as text rather than
// becoming a link that might go somewhere they did not mean.
ok('a bare youtube.com with no https stays plain text',
  links('watch youtube.com/watch?v=abc').length === 0)
ok('"https://" on its own is not an address', links('https:// is a prefix').length === 0)

// A coach's note is free text shown to their client. Only http(s) may ever
// become clickable: no other scheme gets a link, whatever a note contains.
for (const nasty of [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html;base64,PHNjcmlwdD4=',
  'file:///C:/Windows/System32',
  '<img src=x onerror=alert(1)>',
]) {
  ok(`never links ${JSON.stringify(nasty.slice(0, 32))}`, links(nasty).length === 0, JSON.stringify(links(nasty)))
}

// A pasted <a href="..."> is nonsense input rather than an attack: linking the
// http address inside it is harmless, and the markup around it must stay inert
// text. What must NOT happen is the link swallowing the quote and bracket into
// its own href, which is what the first cut of this did.
const PASTED = '<a href="https://evil.test">tap me</a>'
ok('a pasted anchor links only the address inside it',
  links(PASTED).length === 1 && links(PASTED)[0] === 'https://evil.test',
  JSON.stringify(links(PASTED)))

// Nothing may be silently dropped from or added to what the coach wrote.
for (const t of [NOTE, 'See https://youtu.be/abc123.', '(see https://youtu.be/abc123)', 'no links here', '', 'https://a.test/x https://b.test/y']) {
  ok(`the note reads back exactly as written: ${JSON.stringify(t.slice(0, 28))}`, rebuilt(t) === t, JSON.stringify(rebuilt(t)))
}
ok('an empty or missing note yields nothing to render',
  linkParts('').length === 0 && linkParts(null).length === 0 && linkParts(undefined).length === 0)

// --- the browser half: a real anchor, and the control that it used to not be -

async function browserCheck() {
  let pw
  try { pw = await import(pathToFileURL(PW).href) } catch {
    ok('playwright is available for the render check', false, 'run this on the machine that has it')
    return
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r44-'))
  const file = path.join(dir, 'note.html')
  // Two paragraphs. The first is how App.jsx rendered the note BEFORE today:
  // one text node. The second is built the way React builds it now — DOM nodes,
  // never innerHTML — so the markup under test is the markup that ships.
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8">
<p id="before" class="muted-note"></p>
<p id="after" class="muted-note"></p>
<script>
const NOTE = ${JSON.stringify(NOTE)}
const PARTS = ${JSON.stringify(linkParts(NOTE))}
document.getElementById('before').appendChild(document.createTextNode(NOTE))
const after = document.getElementById('after')
for (const p of PARTS) {
  if (p.type === 'link') {
    const a = document.createElement('a')
    a.href = p.href; a.target = '_blank'; a.rel = 'noopener noreferrer'
    a.appendChild(document.createTextNode(p.value))
    after.appendChild(a)
  } else {
    after.appendChild(document.createTextNode(p.value))
  }
}
</script>`)

  const browser = await pw.chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(file).href)
    const r = await page.evaluate(() => {
      const a = document.querySelector('#after a')
      return {
        before: document.querySelectorAll('#before a').length,
        after: document.querySelectorAll('#after a').length,
        href: a ? a.href : null,
        rel: a ? a.getAttribute('rel') : null,
        target: a ? a.getAttribute('target') : null,
        text: document.getElementById('after').textContent,
      }
    })
    // POSITIVE CONTROL. This is the bug Paul reported. If it ever starts
    // passing as a link, this file has stopped testing anything.
    ok('control: the OLD note renders no link at all', r.before === 0, `${r.before} anchors`)
    ok('...and the note now renders exactly one real link', r.after === 1, `${r.after} anchors`)
    ok('...pointing where he typed', r.href === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', String(r.href))
    // A client on a hold screen must come back to the app, not lose it.
    ok('...opening in a new tab', r.target === '_blank', String(r.target))
    ok('...without handing the opener to YouTube', r.rel === 'noopener noreferrer', String(r.rel))
    ok('...and the sentence still reads as written', r.text === NOTE, JSON.stringify(r.text))

    // The note is the one place a client reads free text a coach typed. If a
    // coach ever pastes markup into it, it must land as visible text and not
    // as elements — this is what building React children instead of HTML buys.
    const inert = await page.evaluate((parts) => {
      const p = document.createElement('p')
      for (const part of parts) {
        if (part.type === 'link') {
          const a = document.createElement('a')
          a.href = part.href
          a.appendChild(document.createTextNode(part.value))
          p.appendChild(a)
        } else {
          p.appendChild(document.createTextNode(part.value))
        }
      }
      document.body.appendChild(p)
      return { imgs: p.querySelectorAll('img').length, anchors: p.querySelectorAll('a').length, text: p.textContent }
    }, linkParts(`${PASTED} <img src=x onerror=alert(1)>`))
    ok('pasted markup in a note stays visible text, not elements',
      inert.imgs === 0 && inert.anchors === 1 && inert.text === `${PASTED} <img src=x onerror=alert(1)>`,
      `${inert.imgs} imgs, ${inert.anchors} anchors`)
    await page.close()
  } finally { await browser.close() }
}

await browserCheck()

// --- pin it in the source ----------------------------------------------------

const app = src('src/App.jsx')
ok('the hold screen renders the note through linkParts', /linkParts\(note\)\.map/.test(app))
ok('...as React children, never as HTML', !/dangerouslySetInnerHTML/.test(app))
ok('...with the opener closed off', /rel="noopener noreferrer"/.test(app))
// Default link blue on the dark auth card is effectively unreadable.
ok('a link in a note is styled to be visible', /\.muted-note a \{[^}]*color/.test(src('src/styles.css')))

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
