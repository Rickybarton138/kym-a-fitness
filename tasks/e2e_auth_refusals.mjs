// Does every AI endpoint actually refuse a caller with no session?
//
//   node tasks/e2e_auth_refusals.mjs https://rick-fit.netlify.app
//   node tasks/e2e_auth_refusals.mjs https://<draft>--rick-fit.netlify.app
//
// Nine of these called api.anthropic.com on Ricky's key with no caller identity
// at all. The unit tests prove the gate's logic; only a real deploy proves the
// gate is WIRED IN — that the import landed, that the check sits before the
// parse, and that the refusal arrives as a 401 rather than wrapped in a 200
// where the client reads it as "nothing came back".
//
// Four things are asserted per endpoint:
//
//   no token            -> 401
//   a junk token        -> 401        (the header is verified, not just present)
//   an EMPTY body       -> 401        (auth before validation: an anonymous
//                                      caller must not be able to map the body
//                                      rules by reading the 400s)
//   OPTIONS             -> 204, with `authorization` in allow-headers
//
// That last one is not cosmetic. Adding an Authorization header turns a simple
// request into a preflighted one, so an endpoint that answers the preflight
// badly has its calls refused by the browser before they leave the device —
// which is exactly how the native shell broke on 8 Oct. Four of these endpoints
// had no OPTIONS branch at all until today.
//
// Nothing here signs in, writes a row or logs any food. If a site is still in
// the `AI_AUTH=observe` rollout window the 401 assertions SHOULD fail, and the
// summary says so rather than passing quietly.

const SITE = (process.argv[2] || 'https://rick-fit.netlify.app').replace(/\/$/, '')

// Every function that spends model budget. A body is given for each one that is
// valid enough to reach the endpoint's own validation, so a 400 would prove the
// gate is in the wrong place.
const ENDPOINTS = [
  ['analyze', { mode: 'ask', question: 'what should I eat' }],
  ['barcode', { barcode: '5000112637922' }],
  ['equipment-scan', { images: [] }],
  ['exercise-guide', { name: 'Back squat' }],
  ['exercise-swap', { name: 'Back squat', reason: 'sore knee' }],
  ['meal-plan', { calories: 2400, protein_g: 180, carbs_g: 240, fat_g: 80, meals: 3, options: 1 }],
  ['program-edit', { instruction: 'more hypertrophy', sessions: [{ week: 1, title: 'A', exercises: [{ name: 'Squat', sets: 3, reps: '8' }] }] }],
  ['program-generate', { goal: 'get stronger', days: 3, level: 'intermediate' }],
  ['recipe-ai', { text: '2 eggs, 1 slice of toast' }],
  ['recipe-generate', { category: 'high protein breakfasts', count: 2 }],
]

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  (' + detail + ')' : ''}`) }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}

const fn = (name) => `${SITE}/.netlify/functions/${name}`

async function send(name, body, headers = {}) {
  const res = await fetch(fn(name), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === null ? '' : JSON.stringify(body),
  })
  let j = {}
  try { j = await res.json() } catch { /* a refusal with no body is still a refusal */ }
  return { status: res.status, error: j.error, body: j }
}

console.log(`AI endpoint refusals — ${SITE}\n`)

const open = []
for (const [name, body] of ENDPOINTS) {
  console.log(name)

  const anon = await send(name, body)
  ok('refuses a caller with no session', anon.status === 401, `status ${anon.status}${anon.status === 200 ? ' — THIS ENDPOINT IS OPEN' : ''}`)
  if (anon.status !== 401) open.push(name)

  const junk = await send(name, body, { authorization: 'Bearer not-a-real-token' })
  ok('refuses a junk token, so the header is verified not counted', junk.status === 401, `status ${junk.status}`)

  // An empty body would be a 400 from every one of these if the parse came
  // first. A 401 is the proof that it does not.
  const empty = await send(name, null)
  ok('auth is checked before the body is', empty.status === 401, `status ${empty.status}`)

  ok('the refusal says what to do about it', /sign in|session|expired/i.test(anon.error || ''), anon.error || '(no message)')

  const pre = await fetch(fn(name), {
    method: 'OPTIONS',
    headers: { origin: 'https://localhost', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization, content-type' },
  })
  const allow = String(pre.headers.get('access-control-allow-headers') || '').toLowerCase()
  ok('answers the preflight', pre.status === 204 || pre.status === 200, `status ${pre.status}`)
  ok('and lets the token through it', allow.includes('authorization'), allow || '(no allow-headers)')
}

// ---- the coach-only tools, when there is a token to try them with -----------
// E2E_TOKEN is a Supabase access token, read from the browser's own session —
// there is no sign-in here, and no password anywhere in this file.
const TOKEN = process.env.E2E_TOKEN
console.log('\ncoach-only tools')
if (!TOKEN) {
  console.log('  --   skipped: no E2E_TOKEN. Authorisation (role) is covered by tests/ai-auth.test.mjs;')
  console.log('       this would prove it end to end with a real CLIENT session.')
} else {
  for (const name of ['program-edit', 'recipe-generate']) {
    const body = ENDPOINTS.find(([n]) => n === name)[1]
    const r = await send(name, body, { authorization: `Bearer ${TOKEN}` })
    // A coach token should get through; a client token should get 403. The
    // script cannot know which it was handed, so it asserts only that the
    // answer is one of those two and never an accident.
    ok(`${name} answers a real session with a decision, not a crash`, [200, 403].includes(r.status), `status ${r.status} ${r.error || ''}`)
  }
}

console.log(`\n${pass} pass / ${fail} fail`)
if (open.length) {
  console.log(`\nSTILL OPEN: ${open.join(', ')}`)
  console.log('If this site is in the AI_AUTH=observe rollout window that is expected —')
  console.log('check the site env var before treating it as a regression.')
}
process.exit(fail ? 1 : 0)
