// Fetching a page whose address the caller chose.
//
// `recipe-ai.mjs` takes a recipe URL and reads the page. That is a useful
// feature and a server-side request forgery shape at the same time: the caller
// picks the address, our server makes the request, and our server sits inside a
// network they cannot otherwise reach. On Lambda the runtime API itself answers
// on loopback, and cloud metadata services famously answer on 169.254.169.254.
//
// A HOST ALLOWLIST DOES NOT FIX THIS. Node's `fetch` follows redirects by
// default, so an allowed recipe site can answer 302 to http://127.0.0.1/ and
// the fetch obediently goes there — the allowlist only ever saw the first URL.
// That is why this module exists instead of a one-line check.
//
// What it does, all of which is needed for any of it to mean anything:
//
//   https only            — no file:, no gopher:, no http: downgrade
//   redirect: 'manual'    — every hop is re-validated, at most MAX_HOPS of them
//   DNS up front          — the hostname is resolved and EVERY address it
//                           returns is checked, so a name with one public and
//                           one private A record is refused
//   address rules         — loopback, private, link-local, CGNAT, unique-local,
//                           multicast and the IPv4-mapped and NAT64 forms of
//                           all of those
//   a timeout             — an address that accepts and never answers otherwise
//                           holds the function open until the platform kills it
//   a byte cap            — a 2 GB file cannot be pulled through us
//   a content-type check  — a page, not a binary
//
// THE RESIDUAL RISK, stated rather than papered over: this resolves the name,
// checks the addresses, and then calls `fetch`, which resolves the name again.
// Between those two lookups a DNS record can change — rebinding. Closing that
// needs connecting to the address that was checked and passing the hostname in
// a Host header, which is a bigger change than this pass. The window is narrow,
// it needs control of a domain's DNS, and the prize is a page body handed to a
// language model rather than a credential.

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const MAX_BYTES = 512 * 1024
export const TIMEOUT_MS = 8000
export const MAX_HOPS = 3

const OK_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain', 'application/json', 'text/']

// A browser's own headers. Recipe sites block anything that looks like a script,
// and this was already here before the fence went in.
const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-GB,en;q=0.9',
}

export class BlockedUrl extends Error {}

const v4Num = (ip) => ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0)
const inV4 = (ip, cidr) => {
  const [net, bits] = cidr.split('/')
  const mask = bits === '0' ? 0 : (-1 << (32 - Number(bits))) >>> 0
  return (v4Num(ip) & mask) === (v4Num(net) & mask)
}

// Everything that is not the public internet.
const V4_BLOCKED = [
  '0.0.0.0/8', // "this host"
  '10.0.0.0/8', // private
  '100.64.0.0/10', // carrier NAT — reaches other tenants, not the internet
  '127.0.0.0/8', // loopback, which on Lambda is the runtime API
  '169.254.0.0/16', // link-local, which is where cloud metadata lives
  '172.16.0.0/12', // private
  '192.0.0.0/24', // IETF protocol assignments
  '192.168.0.0/16', // private
  '198.18.0.0/15', // benchmarking
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved, and 255.255.255.255 with it
]

/**
 * Is this address somewhere a caller should not be able to point us?
 * Takes a literal address, not a hostname.
 */
export function isBlockedAddress(addr) {
  const ip = String(addr || '').trim().toLowerCase()
  if (!ip) return true

  if (isIP(ip) === 4) return V4_BLOCKED.some((c) => inV4(ip, c))
  if (isIP(ip) !== 6) return true

  // An IPv6 address can carry an IPv4 one inside it, and both forms are a way
  // of writing 127.0.0.1 that a naive string check would wave through.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isBlockedAddress(mapped[1])
  const nat64 = ip.match(/^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/)
  if (nat64) return isBlockedAddress(nat64[1])
  // ::ffff:7f00:1 is the same address again, written in hex.
  const hexMapped = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16)
    const lo = parseInt(hexMapped[2], 16)
    return isBlockedAddress([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'))
  }

  if (ip === '::1' || ip === '::') return true
  const head = ip.split(':')[0]
  const n = parseInt(head || '0', 16)
  if ((n & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((n & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((n & 0xff00) === 0xff00) return true // ff00::/8 multicast
  return false
}

/**
 * Check one URL: scheme, and every address its host resolves to.
 * Returns the parsed URL. Throws BlockedUrl with a sentence worth showing.
 */
export async function assertPublicUrl(raw, { resolve = lookup } = {}) {
  let u
  try { u = new URL(String(raw)) } catch { throw new BlockedUrl('That does not look like a web address.') }
  if (u.protocol !== 'https:') throw new BlockedUrl('Only https addresses can be imported.')
  if (u.username || u.password) throw new BlockedUrl('That address cannot be imported.')

  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new BlockedUrl('That address is not reachable from here.')
    return u
  }

  let addrs
  try {
    addrs = await resolve(host, { all: true })
  } catch {
    throw new BlockedUrl('That address could not be looked up.')
  }
  if (!addrs?.length) throw new BlockedUrl('That address could not be looked up.')
  // EVERY address, not the first. A name with one public and one private record
  // is a deliberate attack and a misconfiguration, and neither should pass.
  if (addrs.some((a) => isBlockedAddress(a.address))) {
    throw new BlockedUrl('That address is not reachable from here.')
  }
  return u
}

async function readCapped(res, maxBytes) {
  const reader = res.body?.getReader?.()
  if (!reader) return (await res.text()).slice(0, maxBytes)
  const chunks = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(value))
      total += value.byteLength
      if (total >= maxBytes) break
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8')
}

/**
 * Fetch a caller-chosen page, following redirects by hand so each hop is
 * checked. Returns the body text, capped. Throws BlockedUrl for anything the
 * caller should be told about.
 */
export async function fetchPage(raw, { resolve = lookup, doFetch = fetch, maxBytes = MAX_BYTES, timeoutMs = TIMEOUT_MS } = {}) {
  const control = new AbortController()
  const timer = setTimeout(() => control.abort(), timeoutMs)
  try {
    let next = raw
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const u = await assertPublicUrl(next, { resolve })
      let res
      try {
        res = await doFetch(u.href, {
          headers: BROWSER_HEADERS,
          redirect: 'manual',
          signal: control.signal,
        })
      } catch (e) {
        if (e?.name === 'AbortError') throw new BlockedUrl('That page took too long to answer.')
        throw new BlockedUrl('That page could not be reached.')
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) throw new BlockedUrl('That page redirected to nowhere.')
        // Relative redirects are normal; resolve against the hop we are on, and
        // the next turn of the loop checks the result like any other address.
        next = new URL(loc, u.href).href
        continue
      }
      if (!res.ok) throw new BlockedUrl('That page could not be read — some sites block it.')

      const type = String(res.headers.get('content-type') || '').toLowerCase()
      if (type && !OK_TYPES.some((t) => type.includes(t))) {
        throw new BlockedUrl('That address is not a web page.')
      }
      return await readCapped(res, maxBytes)
    }
    throw new BlockedUrl('That page redirected too many times.')
  } finally {
    clearTimeout(timer)
  }
}
