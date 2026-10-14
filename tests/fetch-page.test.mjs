// The fence around the one place a caller picks the address we fetch.
//
// The test that matters most is "a redirect off a public host is re-checked".
// That is the whole reason _fetchPage.mjs exists instead of a host allowlist:
// with Node's default redirect following, an allowed recipe site answering 302
// to http://127.0.0.1/ takes the fetch there and the allowlist never sees it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isBlockedAddress, assertPublicUrl, fetchPage, BlockedUrl, MAX_HOPS } from '../netlify/functions/_fetchPage.mjs'

const resolveTo = (map) => async (host) => {
  const addrs = map[host]
  if (!addrs) throw new Error('ENOTFOUND')
  return addrs.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
}

test('every way of writing a non-public address is blocked', () => {
  const blocked = [
    '127.0.0.1', '127.1.2.3', '0.0.0.0',
    '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // carrier NAT reaches other tenants
    '192.0.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1',
    '::ffff:127.0.0.1', // loopback wearing an IPv6 coat
    '::ffff:7f00:1', // the same thing again, in hex
    '64:ff9b::169.254.169.254', // and again, through NAT64
    '', 'not-an-address', 'localhost',
  ]
  for (const ip of blocked) assert.equal(isBlockedAddress(ip), true, `${ip} should be blocked`)
})

test('ordinary public addresses are not blocked', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '99.63.255.255', '2606:4700:4700::1111']) {
    assert.equal(isBlockedAddress(ip), false, `${ip} should be allowed`)
  }
})

test('only https, and not with credentials buried in it', async () => {
  const resolve = resolveTo({ 'recipes.example': ['93.184.216.34'] })
  await assert.rejects(() => assertPublicUrl('http://recipes.example/r', { resolve }), BlockedUrl)
  await assert.rejects(() => assertPublicUrl('file:///etc/passwd', { resolve }), BlockedUrl)
  await assert.rejects(() => assertPublicUrl('https://u:p@recipes.example/r', { resolve }), BlockedUrl)
  await assert.rejects(() => assertPublicUrl('nonsense', { resolve }), BlockedUrl)
  const ok = await assertPublicUrl('https://recipes.example/r', { resolve })
  assert.equal(ok.hostname, 'recipes.example')
})

test('a hostname that resolves inward is refused, however it is spelt', async () => {
  const resolve = resolveTo({
    'metadata.example': ['169.254.169.254'],
    'loop.example': ['127.0.0.1'],
  })
  await assert.rejects(() => assertPublicUrl('https://metadata.example/', { resolve }), BlockedUrl)
  await assert.rejects(() => assertPublicUrl('https://loop.example/', { resolve }), BlockedUrl)
  // A literal address is checked the same way as a resolved one.
  await assert.rejects(() => assertPublicUrl('https://169.254.169.254/latest/meta-data/', { resolve }), BlockedUrl)
})

test('ONE private record among public ones is still a refusal', async () => {
  // Both an attack and a plain misconfiguration look like this, and neither
  // should get through on the strength of the first answer in the list.
  const resolve = resolveTo({ 'split.example': ['93.184.216.34', '127.0.0.1'] })
  await assert.rejects(() => assertPublicUrl('https://split.example/r', { resolve }), BlockedUrl)
})

// ---- the redirect, which is the bypass a host allowlist cannot see ----------

const reply = (status, headers = {}, body = '') => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  body: null,
  text: async () => body,
})

test('a public page redirecting to loopback is refused at the hop', async () => {
  const resolve = resolveTo({ 'recipes.example': ['93.184.216.34'] })
  const seen = []
  const doFetch = async (href) => {
    seen.push(href)
    if (href.includes('recipes.example')) return reply(302, { location: 'https://127.0.0.1/latest/' })
    return reply(200, { 'content-type': 'text/html' }, '<html>should never be reached</html>')
  }
  await assert.rejects(
    () => fetchPage('https://recipes.example/r', { resolve, doFetch }),
    (e) => e instanceof BlockedUrl && /not reachable/i.test(e.message),
  )
  assert.deepEqual(seen, ['https://recipes.example/r'], 'the second hop must never be requested')
})

test('a relative redirect is followed and re-checked', async () => {
  const resolve = resolveTo({ 'recipes.example': ['93.184.216.34'] })
  const doFetch = async (href) => (href.endsWith('/final')
    ? reply(200, { 'content-type': 'text/html; charset=utf-8' }, '<html>dinner</html>')
    : reply(301, { location: '/final' }))
  const html = await fetchPage('https://recipes.example/r', { resolve, doFetch })
  assert.match(html, /dinner/)
})

test('a redirect loop stops instead of running until the platform kills it', async () => {
  const resolve = resolveTo({ 'recipes.example': ['93.184.216.34'] })
  let hops = 0
  const doFetch = async () => { hops++; return reply(302, { location: 'https://recipes.example/again' }) }
  await assert.rejects(() => fetchPage('https://recipes.example/r', { resolve, doFetch }), BlockedUrl)
  assert.equal(hops, MAX_HOPS + 1)
})

test('a binary is not read as a page, and a big one is capped', async () => {
  const resolve = resolveTo({ 'recipes.example': ['93.184.216.34'] })
  const img = async () => reply(200, { 'content-type': 'image/jpeg' }, 'JFIF...')
  await assert.rejects(() => fetchPage('https://recipes.example/x.jpg', { resolve, doFetch: img }), BlockedUrl)

  const huge = 'x'.repeat(50_000)
  const page = async () => reply(200, { 'content-type': 'text/html' }, huge)
  const out = await fetchPage('https://recipes.example/r', { resolve, doFetch: page, maxBytes: 1000 })
  assert.equal(out.length, 1000, 'the read is capped, not the whole body')
})

test('a timeout and an unreachable host both come back as readable refusals', async () => {
  const resolve = resolveTo({ 'recipes.example': ['93.184.216.34'] })
  const aborts = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e }
  await assert.rejects(
    () => fetchPage('https://recipes.example/r', { resolve, doFetch: aborts }),
    (e) => e instanceof BlockedUrl && /too long/i.test(e.message),
  )
  const refuses = async () => { throw new Error('ECONNREFUSED') }
  await assert.rejects(() => fetchPage('https://recipes.example/r', { resolve, doFetch: refuses }), BlockedUrl)
})
