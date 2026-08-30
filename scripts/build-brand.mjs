// Build for one brand: `npm run build:paul` (or `node scripts/build-brand.mjs paul`).
//
// Exists because the brand stamping in brand-html.mjs is driven by the BRAND env
// var, and `BRAND=paul npm run build` is not portable to PowerShell — so a
// Windows deploy silently produced a Kim-branded index.html and manifest for
// Paul's site. Use the per-brand script and it cannot go wrong.
import { spawnSync } from 'node:child_process'

const brand = (process.argv[2] || 'kim').toLowerCase()
const env = { ...process.env, BRAND: brand }

// Run both through this same node binary — no shell, so nothing to escape and
// it behaves the same on PowerShell, cmd and bash.
for (const script of ['node_modules/vite/bin/vite.js build', 'scripts/brand-html.mjs']) {
  const [file, ...args] = script.split(' ')
  const r = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env })
  if (r.status !== 0) process.exit(r.status || 1)
}
