// The gate on the nine endpoints that were open to the internet, and the
// rollout switch that lets the client half land first.
//
// The property worth pinning down is which way it fails when nobody has
// configured it. `coach-notify` failed OPEN for ten days because an empty body
// was read as proof the scheduler had called it; this must fail CLOSED, so an
// unset variable has to mean enforce.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireAiUser, requireCoach, readBody, HttpError, MAX_BODY, MAX_UPLOAD_BODY } from '../netlify/functions/_auth.mjs'

const GOOD = 'a-real-looking-token'

// Stand in for Supabase: /auth/v1/user answers for GOOD and refuses the rest,
// and the profiles read answers with whatever role the test asked for.
function stubSupabase({ role = 'client', profilesMissing = false } = {}) {
  const real = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    const auth = String(opts.headers?.authorization || '')
    if (String(url).includes('/auth/v1/user')) {
      if (auth !== `Bearer ${GOOD}`) return { ok: false, status: 401, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => ({ id: 'user-1', email: 'x@y.z' }) }
    }
    if (String(url).includes('/rest/v1/profiles')) {
      if (profilesMissing) return { ok: false, status: 404, text: async () => '', json: async () => ({}) }
      return { ok: true, status: 200, json: async () => (role === null ? [] : [{ role }]) }
    }
    throw new Error('unexpected fetch: ' + url)
  }
  return () => { globalThis.fetch = real }
}

const withMode = async (mode, fn) => {
  const before = process.env.AI_AUTH
  if (mode === undefined) delete process.env.AI_AUTH
  else process.env.AI_AUTH = mode
  try { return await fn() } finally {
    if (before === undefined) delete process.env.AI_AUTH
    else process.env.AI_AUTH = before
  }
}

const ev = (token) => ({ headers: token ? { authorization: `Bearer ${token}` } : {} })

test('unset means ENFORCE — a site nobody configured is not left open', async () => {
  const restore = stubSupabase()
  try {
    await withMode(undefined, async () => {
      await assert.rejects(() => requireAiUser(ev(null)), (e) => e instanceof HttpError && e.status === 401)
      await assert.rejects(() => requireAiUser(ev('junk')), (e) => e instanceof HttpError && e.status === 401)
      const user = await requireAiUser(ev(GOOD))
      assert.equal(user.id, 'user-1')
    })
  } finally { restore() }
})

test('a value nobody recognises also enforces, rather than being read as off', async () => {
  const restore = stubSupabase()
  try {
    // 'false', 'off', 'no', a typo — none of these are the opt-out, and all of
    // them must leave the gate shut.
    for (const mode of ['false', 'off', '0', 'no', 'obsrve', '']) {
      await withMode(mode, async () => {
        await assert.rejects(() => requireAiUser(ev(null)), (e) => e instanceof HttpError && e.status === 401, `AI_AUTH=${mode}`)
      })
    }
  } finally { restore() }
})

test('observe tolerates a missing token but still resolves a real one', async () => {
  const restore = stubSupabase()
  try {
    await withMode('observe', async () => {
      assert.equal(await requireAiUser(ev(null)), null, 'no token is tolerated during the rollout')
      assert.equal(await requireAiUser(ev('junk')), null, 'a dead token is tolerated too, not thrown')
      const user = await requireAiUser(ev(GOOD))
      assert.equal(user.id, 'user-1', 'a good token is still resolved, so the window is observable')
    })
    // Case and whitespace from a hand-typed env var should not decide security.
    await withMode(' OBSERVE ', async () => {
      assert.equal(await requireAiUser(ev(null)), null)
    })
  } finally { restore() }
})

test('coach-only means coach: a client session is refused, not merely identified', async () => {
  let restore = stubSupabase({ role: 'trainer' })
  try {
    assert.equal(await requireCoach({ id: 'user-1', token: GOOD }), 'trainer')
  } finally { restore() }

  restore = stubSupabase({ role: 'client' })
  try {
    await assert.rejects(() => requireCoach({ id: 'user-1', token: GOOD }), (e) => e instanceof HttpError && e.status === 403)
  } finally { restore() }

  restore = stubSupabase({ role: null })
  try {
    await assert.rejects(() => requireCoach({ id: 'user-1', token: GOOD }), (e) => e instanceof HttpError && e.status === 403)
  } finally { restore() }
})

test('an unreadable profiles table refuses rather than waving the caller through', async () => {
  // userQuery.select returns null for a missing table, which elsewhere means
  // "not loaded yet" and is safe. On an authorisation check it is not: failing
  // open here is how a client ends up editing a coach's library.
  const restore = stubSupabase({ profilesMissing: true })
  try {
    await assert.rejects(() => requireCoach({ id: 'user-1', token: GOOD }), (e) => e instanceof HttpError && e.status === 502)
  } finally { restore() }
})

test('the body ceiling is per endpoint, so a photo is not a 413', () => {
  const chat = { body: JSON.stringify({ q: 'x'.repeat(100 * 1024) }) }
  assert.throws(() => readBody(chat), (e) => e instanceof HttpError && e.status === 413)
  assert.equal(readBody(chat, { max: MAX_UPLOAD_BODY }).q.length, 100 * 1024)

  // And the upload ceiling is still a ceiling — it refuses before Netlify's own
  // limit does, because the platform's refusal arrives with no usable body.
  const absurd = { body: JSON.stringify({ image: 'x'.repeat(MAX_UPLOAD_BODY) }) }
  assert.throws(() => readBody(absurd, { max: MAX_UPLOAD_BODY }), (e) => e instanceof HttpError && e.status === 413)
  assert.ok(MAX_UPLOAD_BODY > MAX_BODY)
})
