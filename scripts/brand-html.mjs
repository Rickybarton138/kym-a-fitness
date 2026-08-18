// Post-build: stamp the correct brand into dist/index.html + dist/manifest.webmanifest
// so link previews (Open Graph), the browser tab, the favicon and the PWA install
// all show THIS site's brand — not the default. Driven by the BRAND env var, set
// per-site at deploy time (default 'kim'). One shared codebase, per-site identity.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BRANDS = {
  kim: {
    name: 'Coached by Kim', short: 'Coached by Kim',
    description: 'AI coaching from Kim — training, nutrition and your progress, any time.',
    theme: '#f3ede2', bg: '#f3ede2', url: 'https://coached-by-kim.netlify.app',
    icon192: '/icon-192.png', icon512: '/icon-512.png', og: '/icon-512.png',
  },
  paul: {
    name: 'ReDefine Academy', short: 'ReDefine',
    description: 'Training, nutrition and coaching from ReDefine Academy — with you every day.',
    theme: '#0d0f0e', bg: '#0d0f0e', url: 'https://app.redefineacademy.com',
    icon192: '/brands/paul/icon-192.png', icon512: '/brands/paul/icon-512.png', og: '/brands/paul/og.png',
  },
  pph: {
    name: 'The Physical Performance Hub', short: 'PPH',
    description: 'Complete support for every athlete — programming, testing, monitoring and rehab.',
    theme: '#0a0a0a', bg: '#0a0a0a', url: 'https://the-physical-performance-hub.netlify.app',
    icon192: '/pph-logo.png', icon512: '/pph-logo.png', og: '/pph-logo.png',
  },
  elev8: {
    name: 'Elev8u', short: 'Elev8u',
    description: 'Hyrox and functional-fitness coaching from Elev8u — training, testing, nutrition and an AI coach.',
    theme: '#ffffff', bg: '#f4f7f9', url: 'https://elev8-hyrox.netlify.app',
    icon192: '/brands/elev8/icon-192.png', icon512: '/brands/elev8/icon-512.png', og: '/brands/elev8/og.png',
  },
}

const brand = (process.env.BRAND || process.env.VITE_BRAND || 'kim').toLowerCase()
const b = BRANDS[brand] || BRANDS.kim
const dist = resolve(process.cwd(), 'dist')
const abs = (p) => (p.startsWith('http') ? p : b.url + p)

// ---- index.html ----
let html = readFileSync(resolve(dist, 'index.html'), 'utf8')
html = html
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${b.name}</title>`)
  .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, `$1${b.name}$2`)
  .replace(/(<meta name="theme-color" content=")[^"]*(")/, `$1${b.theme}$2`)
  .replace(/(<link rel="icon"[^>]*href=")[^"]*(")/, `$1${b.icon192}$2`)
  .replace(/(<link rel="apple-touch-icon"[^>]*href=")[^"]*(")/, `$1${b.icon192}$2`)

const og = [
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="${b.name}" />`,
  `<meta property="og:title" content="${b.name}" />`,
  `<meta property="og:description" content="${b.description}" />`,
  `<meta property="og:url" content="${b.url}" />`,
  `<meta property="og:image" content="${abs(b.og)}" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${b.name}" />`,
  `<meta name="twitter:description" content="${b.description}" />`,
  `<meta name="twitter:image" content="${abs(b.og)}" />`,
  `<meta name="description" content="${b.description}" />`,
].join('\n    ')
html = html.replace('</head>', `    ${og}\n  </head>`)
writeFileSync(resolve(dist, 'index.html'), html)

// ---- manifest.webmanifest ----
const manifest = {
  name: b.name, short_name: b.short, description: b.description,
  start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
  background_color: b.bg, theme_color: b.theme,
  icons: [
    { src: b.icon192, sizes: '192x192', type: 'image/png' },
    { src: b.icon512, sizes: '512x512', type: 'image/png' },
    { src: b.icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
writeFileSync(resolve(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2))

console.log(`brand-html: stamped "${b.name}" (BRAND=${brand}) into dist/index.html + manifest`)
