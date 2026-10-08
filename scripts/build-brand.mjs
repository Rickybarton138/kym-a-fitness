// Build for one brand: `npm run build:paul` (or `node scripts/build-brand.mjs paul`).
//
// Exists because the brand stamping in brand-html.mjs is driven by the BRAND env
// var, and `BRAND=paul npm run build` is not portable to PowerShell — so a
// Windows deploy silently produced a Kim-branded index.html and manifest for
// Paul's site. Use the per-brand script and it cannot go wrong.
import { spawnSync } from 'node:child_process'

const brand = (process.argv[2] || 'kim').toLowerCase()
// A NATIVE build differs from the web one in exactly two ways, and both are
// environment, not code (see tasks/native-app-plan.md):
//   VITE_DEFAULT_BRAND — a Capacitor shell has no hostname to resolve a brand
//     from, so the brand that HOST_BRAND would have matched is baked in.
//   VITE_API_BASE — "/.netlify/functions/..." is relative, and in the shell it
//     is relative to capacitor://localhost, where nothing is listening. The
//     calls have to point at the deployed site.
// Unset for a web build, so the web output is unchanged.
const native = process.argv.includes('--native')
const API_BASE = { paul: 'https://app.redefineacademy.com' }
const env = {
  ...process.env,
  BRAND: brand,
  ...(native ? { VITE_DEFAULT_BRAND: brand, VITE_API_BASE: API_BASE[brand] || '' } : {}),
}
if (native && !API_BASE[brand]) {
  console.error(`No API base known for brand "${brand}" — add one in scripts/build-brand.mjs before building it native.`)
  process.exit(1)
}
if (native) console.log(`native build: brand=${brand} api=${env.VITE_API_BASE}`)

// Run both through this same node binary — no shell, so nothing to escape and
// it behaves the same on PowerShell, cmd and bash.
for (const script of ['node_modules/vite/bin/vite.js build', 'scripts/brand-html.mjs']) {
  const [file, ...args] = script.split(' ')
  const r = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env })
  if (r.status !== 0) process.exit(r.status || 1)
}
