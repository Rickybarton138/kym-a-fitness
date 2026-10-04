import test from 'node:test'
import assert from 'node:assert/strict'
import * as f from './coach-fixtures.mjs'

// `fetch` is stubbed for the whole file: these tests are about what the endpoint
// DOES with a request, and they must never touch Supabase, Anthropic or
// production data. Every call is recorded so the assertions can be about the
// requests themselves — which token was sent, which rows were asked for.
const calls = []
const realFetch = globalThis.fetch

function stubFetch({ user = { id: f.CLIENT, email: 'test@example.com' }, userStatus = 200, rows = {} } = {}) {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url)
    calls.push({ url: u, headers: opts.headers || {}, method: opts.method || 'GET', body: opts.body })
    if (u.includes('/auth/v1/user')) {
      return { ok: userStatus === 200, status: userStatus, json: async () => (userStatus === 200 ? user : { error: 'bad' }) }
    }
    if (u.includes('/rest/v1/')) {
      const table = u.split('/rest/v1/')[1].split('?')[0]
      return { ok: true, status: 200, json: async () => rows[table] ?? [] }
    }
    if (u.includes('api.anthropic.com')) {
      return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'Plain English answer.' }] }) }
    }
    return { ok: false, status: 404, text: async () => 'nope', json: async () => ({}) }
  }
}

test.afterEach(() => { globalThis.fetch = realFetch; calls.length = 0 })

const event = (body, headers = {}) => ({
  httpMethod: 'POST',
  headers: { authorization: 'Bearer token-abc', host: 'rick-fit.netlify.app', ...headers },
  body: JSON.stringify(body),
})

const load = async () => (await import('../netlify/functions/_auth.mjs'))

test('identity comes from the token, and the body cannot name someone else', async () => {
  stubFetch()
  const { requireUser, rejectImpersonation, HttpError } = await load()

  const user = await requireUser(event({ action: 'today' }))
  assert.equal(user.id, f.CLIENT)
  // The token went to Supabase, not the body.
  assert.ok(calls.some((c) => c.url.includes('/auth/v1/user') && c.headers.authorization === 'Bearer token-abc'))

  // A body naming the same person is fine; a different person is refused.
  rejectImpersonation({ clientId: f.CLIENT }, user)
  assert.throws(() => rejectImpersonation({ clientId: f.OTHER }, user), (e) => e instanceof HttpError && e.status === 403)
  assert.throws(() => rejectImpersonation({ client_id: f.OTHER }, user), (e) => e.status === 403)
})

test('a missing or rejected token is a 401 before any query runs', async () => {
  stubFetch({ userStatus: 401 })
  const { requireUser, HttpError } = await load()

  await assert.rejects(() => requireUser({ headers: {}, body: '{}' }), (e) => e instanceof HttpError && e.status === 401)
  assert.equal(calls.length, 0, 'no network call at all without a token')

  await assert.rejects(() => requireUser(event({})), (e) => e.status === 401)
  // One call, to the auth endpoint. Nothing reached PostgREST.
  assert.ok(!calls.some((c) => c.url.includes('/rest/v1/')))
})

test('queries carry the user token, so RLS does the isolation', async () => {
  stubFetch({ rows: { profiles: [f.profile] } })
  const { userQuery } = await load()
  const q = userQuery('token-abc')
  await q.select('profiles', `id=eq.${f.CLIENT}&select=*`)
  const call = calls.find((c) => c.url.includes('/rest/v1/profiles'))
  assert.equal(call.headers.authorization, 'Bearer token-abc')
  assert.ok(call.headers.apikey, 'the publishable key is still sent as apikey')
  // No service-role key anywhere near this.
  assert.ok(!JSON.stringify(calls).includes('service_role'))
})

test('a body that is too large, or not an object, is refused', async () => {
  const { readBody, MAX_BODY, HttpError } = await load()
  assert.deepEqual(readBody({ body: '' }), {})
  assert.deepEqual(readBody({ body: '{"a":1}' }), { a: 1 })
  assert.throws(() => readBody({ body: 'not json' }), (e) => e instanceof HttpError && e.status === 400)
  assert.throws(() => readBody({ body: '[1,2,3]' }), (e) => e.status === 400)
  assert.throws(() => readBody({ body: 'x'.repeat(MAX_BODY + 1) }), (e) => e.status === 413)
})

test('the brand comes from the host, never from the body', async () => {
  const { brandOf } = await load()
  assert.deepEqual(brandOf({ headers: { host: 'rick-fit.netlify.app' } }), { brand: 'ricky', local: false })
  assert.deepEqual(brandOf({ headers: { host: 'coached-by-kim.netlify.app' } }), { brand: 'kim', local: false })
  // An unknown host gets no brand rather than a guess.
  assert.deepEqual(brandOf({ headers: { host: 'evil.example.com' } }), { brand: null, local: false })
  // Localhost is flagged so dev can name a brand; production never can.
  assert.deepEqual(brandOf({ headers: { host: 'localhost:5220' } }), { brand: null, local: true })
})

test('the daily limit counts in the database and fails open when it cannot', async () => {
  const { userQuery, withinDailyLimit } = await load()

  stubFetch({ rows: { coach_usage: [{ calls: 5 }] } })
  let out = await withinDailyLimit(userQuery('t'), f.CLIENT, f.TODAY, 120)
  assert.equal(out.ok, true)
  assert.equal(out.used, 6, 'incremented')

  stubFetch({ rows: { coach_usage: [{ calls: 120 }] } })
  out = await withinDailyLimit(userQuery('t'), f.CLIENT, f.TODAY, 120)
  assert.equal(out.ok, false)

  // Table missing (pre-migration): the feature must still work.
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' })
  out = await withinDailyLimit(userQuery('t'), f.CLIENT, f.TODAY, 1)
  assert.equal(out.ok, true)
  assert.equal(out.counted, false)
})

test('a unique violation on a ledger write reads as a successful de-duplication', async () => {
  globalThis.fetch = async () => ({
    ok: false, status: 409, text: async () => 'duplicate key value violates unique constraint (23505)', json: async () => ({}),
  })
  const { userQuery } = await load()
  const out = await userQuery('t').insert('coach_notifications', [{ dedupe_key: 'x' }])
  assert.deepEqual(out, { duplicate: true }, 'not an error — the row is already there')
})

test('the AI call times out into a handled error rather than a dead function', async () => {
  const { askClaude, HttpError } = await load()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  globalThis.fetch = (url, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => {
      const e = new Error('aborted'); e.name = 'AbortError'; reject(e)
    })
  })
  await assert.rejects(
    () => askClaude({ model: 'claude-haiku-4-5', system: 's', messages: [], timeoutMs: 20 }),
    (e) => e instanceof HttpError && e.status === 504,
  )
})

test('the API key never appears in what is thrown', async () => {
  const { askClaude } = await load()
  process.env.ANTHROPIC_API_KEY = 'sk-ant-secret-value'
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'upstream said sk-ant-secret-value' })
  await assert.rejects(
    () => askClaude({ model: 'claude-haiku-4-5', system: 's', messages: [] }),
    (e) => !String(e.message).includes('sk-ant-secret-value'),
  )
})

test('the system prompt is sent as a cacheable block, with the facts in the user turn', async () => {
  const { askClaude } = await load()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  let sent = null
  globalThis.fetch = async (url, opts) => {
    sent = JSON.parse(opts.body)
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) }
  }
  await askClaude({ model: 'claude-sonnet-5', system: 'RULES', messages: [{ role: 'user', content: 'FACTS' }] })
  assert.deepEqual(sent.system, [{ type: 'text', text: 'RULES', cache_control: { type: 'ephemeral' } }])
  assert.equal(sent.messages[0].content, 'FACTS')
  assert.equal(sent.model, 'claude-sonnet-5')
})

test('the handler wrapper answers preflight and refuses anything but POST', async () => {
  const { handler, json, HttpError } = await load()
  const fn = handler(async () => json(200, { ok: true }))
  assert.equal((await fn({ httpMethod: 'OPTIONS', headers: {} })).statusCode, 204)
  assert.equal((await fn({ httpMethod: 'GET', headers: {} })).statusCode, 405)

  const boom = handler(async () => { throw new HttpError(429, 'Slow down.') })
  const res = await boom({ httpMethod: 'POST', headers: {} })
  assert.equal(res.statusCode, 429)
  assert.equal(JSON.parse(res.body).error, 'Slow down.')

  // An unexpected error is not leaked to the caller.
  const ugly = handler(async () => { throw new Error('column "secret_thing" does not exist') })
  const res2 = await ugly({ httpMethod: 'POST', headers: {} })
  assert.equal(res2.statusCode, 500)
  assert.equal(JSON.parse(res2.body).error, 'Something went wrong.')
})
