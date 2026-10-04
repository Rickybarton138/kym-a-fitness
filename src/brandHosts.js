// Which host serves which brand.
//
// Split out of themes.js so a Netlify function can resolve the brand from the
// request's Host header. themes.js cannot be imported server-side at all: it
// calls resolveBrandSlug() at module scope, which reads `import.meta.env`, and
// outside Vite that throws before anything else runs.
//
// The brand always comes from the host, never from the request body. A
// body-supplied brand would defeat the isolation it is there to provide, in
// exactly the way a body-supplied client_id defeats account isolation.

export const HOST_BRAND = {
  'redefine-academy.netlify.app': 'paul',
  'app.redefineacademy.com': 'paul',
  'redefineacademy.com': 'paul',
  'www.redefineacademy.com': 'paul',
  'coached-by-kim.netlify.app': 'kim',
  'the-physical-performance-hub.netlify.app': 'pph',
  'elev8-hyrox.netlify.app': 'elev8',
  'rick-fit.netlify.app': 'ricky',
  'lennon-gk.netlify.app': 'lennon',
  'kelsey-fit.netlify.app': 'kelsey',
}

/**
 * The brand a request belongs to, from its Host header.
 *
 * `fallback` is only for local development, where the host is localhost and the
 * brand comes from a query string the app itself resolves. A request from an
 * unknown host gets null, and callers treat that as "no brand-specific
 * behaviour" rather than guessing.
 */
export function brandForHost(host, fallback = null) {
  if (!host) return fallback
  const clean = String(host).toLowerCase().split(':')[0].trim()
  return HOST_BRAND[clean] || fallback
}
