// Every "Saving…" spinner in this app is a promise away from hanging forever.
//
// Katie, 7 Sept: "when she hits save it just hangs and doesn't save it." The
// handler had no try/catch, so a failed request left the promise rejected, the
// busy flag never cleared, and the button sat on "Saving…" with nothing said.
// She started the session again — which is why her diary has duplicates.
//
// When that was found, 42 of the app's 60 busy-state handlers had the same
// shape. Fixing one is not the answer; this makes the class impossible to grow.
// It fails if an UNLISTED handler shows a busy state without a try/catch or
// finally, so new code must handle its own failures. The allowlist below is
// everything that was already like that, and it is only ever allowed to shrink.
//
// Run: node tasks/check_async_guards.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')
const ALLOW_FILE = join(here, 'async_guards_allowlist.json')

const BUSY = /set(Saving|Busy|Loading|Sending|Adding|Uploading|Working|Starting|Generating)\(true\)/i

export function findUnguarded() {
  const out = []
  for (const f of readdirSync(SRC).filter((n) => /\.(jsx|js)$/.test(n))) {
    const src = readFileSync(join(SRC, f), 'utf8')
    // async function bodies, to the matching close at two-space indentation —
    // good enough for this codebase's style and deliberately not a parser.
    const re = /async function (\w+)\([^)]*\)\s*\{([\s\S]*?)\n  \}/g
    let m
    while ((m = re.exec(src))) {
      const [, name, body] = m
      if (!BUSY.test(body)) continue
      const guarded = /try\s*\{/.test(body) && /(finally|catch)\s*\{/.test(body)
      if (!guarded) out.push(`${f}:${name}`)
    }
  }
  return out.sort()
}

if (process.argv[1] && process.argv[1].endsWith('check_async_guards.mjs')) {
  const found = findUnguarded()
  let allow = []
  try { allow = JSON.parse(readFileSync(ALLOW_FILE, 'utf8')) } catch { /* first run */ }

  if (process.argv.includes('--bless')) {
    writeFileSync(ALLOW_FILE, JSON.stringify(found, null, 2) + '\n')
    console.log(`Recorded ${found.length} known-unguarded handlers.`)
    process.exit(0)
  }

  const added = found.filter((x) => !allow.includes(x))
  const fixed = allow.filter((x) => !found.includes(x))

  if (fixed.length) {
    console.log(`${fixed.length} fixed since last time — run with --bless to lock that in:`)
    for (const f of fixed) console.log('  ' + f)
  }
  if (added.length) {
    console.log(`\nFAIL  ${added.length} handler(s) show a busy state with no try/catch or finally.`)
    console.log('If the request fails, the spinner never stops and the user is told nothing.')
    for (const a of added) console.log('  ' + a)
    process.exit(1)
  }
  console.log(`all guarded  (${found.length} known-unguarded remaining, none new)`)
  process.exit(0)
}
