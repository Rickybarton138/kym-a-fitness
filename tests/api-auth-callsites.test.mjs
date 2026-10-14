// Does every browser call to a gated endpoint actually send the token?
//
// This is the half of the fix that the deploy-side refusal script CANNOT check.
// `tasks/e2e_auth_refusals.mjs` proves the server says no to an anonymous
// caller; it cannot prove the app says who it is, because that needs a real
// logged-in browser. A call site that forgets the header does not fail at build
// time and does not fail in any test — it fails as "the AI has stopped working"
// on somebody's phone.
//
// So the guard is static, and it is a guard against the FUTURE as much as the
// present: the next session to add a fetch to one of these endpoints gets a red
// test instead of a dead feature.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// Every endpoint that now requires a session. `food-search`, `strava-*`,
// `push-*` and `coach-reset-password` are not here: the first three call no
// model, and the last already carries its own token.
const GATED = [
  'analyze', 'barcode', 'equipment-scan', 'exercise-guide', 'exercise-swap',
  'meal-plan', 'program-edit', 'program-generate', 'recipe-ai', 'recipe-generate',
]

// coachClient.js and MealPlan.jsx attach the token their own way, both of which
// predate the shared helper and both of which are correct. Named rather than
// pattern-matched, so a NEW file cannot join this list by accident.
const OWN_WAY = { 'MealPlan.jsx': 'builds the header inline from getSession()' }

const files = readdirSync(SRC).filter((f) => /\.(js|jsx)$/.test(f))

test('every call to a gated endpoint carries a session token', () => {
  const offenders = []
  let checked = 0

  for (const file of files) {
    const text = readFileSync(join(SRC, file), 'utf8')
    for (const name of GATED) {
      // The call and whatever follows it on the same statement. These are
      // written both as a one-liner and as a multi-line object, so take a
      // generous window and look inside it.
      const re = new RegExp(`functions/${name}['"\`\\)]([\\s\\S]{0,400})`, 'g')
      for (const m of text.matchAll(re)) {
        checked++
        const window = m[1]
        // Stop at the end of the fetch call rather than running into the next
        // statement, which could lend its headers to this one.
        const call = window.split(/\n\s*const |\n\s*await (?!fetch)/)[0]
        const hasToken = /authHeaders\(/.test(call) || /authorization/i.test(call)
        if (!hasToken && !OWN_WAY[file]) {
          offenders.push(`${file} -> ${name}`)
        }
      }
    }
  }

  assert.ok(checked >= GATED.length, `expected to find calls to the gated endpoints, found ${checked}`)
  assert.deepEqual(offenders, [], `these call a gated endpoint with no token:\n  ${offenders.join('\n  ')}`)
})

test('the shared helper is what sets the header, and it asks for a fresh session', () => {
  const src = readFileSync(join(SRC, 'apiAuth.js'), 'utf8')
  // getSession, not a storage read: it refreshes a token that is about to
  // expire, which is the difference between a working app and one that 401s
  // after an hour in the background.
  assert.match(src, /auth\.getSession\(\)/)
  assert.match(src, /headers\.authorization = `Bearer \$\{token\}`/)
  // A missing session must not throw here — the server decides what that means,
  // and a throw would turn "signed out" into "the app crashed".
  assert.match(src, /catch \{/)
})

test('every gated endpoint really is gated server-side', () => {
  const FNS = new URL('../netlify/functions/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  for (const name of GATED) {
    const src = readFileSync(join(FNS, `${name}.mjs`), 'utf8')
    assert.match(src, /requireAiUser|requireUser/, `${name}.mjs does not ask who is calling`)
    // And the gate has to come before the body is read, or an anonymous caller
    // can map the endpoint by reading its 400s.
    const gate = src.search(/await requireAiUser\(/)
    const parse = src.search(/readBody\(|JSON\.parse\(event\.body/)
    assert.ok(gate > -1, `${name}.mjs has no requireAiUser call`)
    assert.ok(gate < parse || parse === -1, `${name}.mjs parses the body before checking auth`)
  }
})
