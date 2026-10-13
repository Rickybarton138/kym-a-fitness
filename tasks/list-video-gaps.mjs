// Which Rick.Fit exercises have a demonstration clip of Ricky, and which don't.
//
//   node tasks/list-video-gaps.mjs            summary + the gaps by group
//   node tasks/list-video-gaps.mjs --all      also list what IS covered
//
// Imports the real catalogue rather than grepping it, so a name added to
// exercises.js or to a calisthenics ladder cannot be missed. The brand is
// forced to ricky because the catalogue's shape depends on it: the calisthenics
// group and the extra demonstrations group exist only for that brand.
//
// Companion to tasks/rick-fit-video-gaps.md, which tiers the output and holds
// the production spec. Re-run this after adding clips; the counts in that
// document are a snapshot.

// themes.js resolves the brand from the hostname at import time, and the app
// modules expect a browser. Enough of one to let them load.
globalThis.window = { location: { hostname: 'rick-fit.netlify.app', search: '', href: 'https://rick-fit.netlify.app/' } }
globalThis.location = globalThis.window.location
globalThis.document = {
  documentElement: { style: { setProperty() {} } },
  head: { appendChild() {} },
  createElement: () => ({ setAttribute() {}, style: {} }),
  querySelector: () => null,
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

const { EXERCISE_GROUPS } = await import('../src/exercises.js')
const { getRickFitVideos } = await import('../src/rickFitVideos.js')
const { THEME } = await import('../src/themes.js')

if (THEME.slug !== 'ricky') {
  console.error(`Brand resolved as "${THEME.slug}", not ricky — the catalogue would be the wrong shape.`)
  process.exit(1)
}

const have = []
const missing = []
for (const group of EXERCISE_GROUPS) {
  for (const name of group.options) {
    const clips = getRickFitVideos({ name }, 'ricky')
    ;(clips.length ? have : missing).push({ group: group.label, name, demo: clips[0]?.exercise })
  }
}

const total = have.length + missing.length
console.log(`Rick.Fit exercise demos — ${have.length} of ${total} catalogue entries have one, ${missing.length} do not.\n`)

if (process.argv.includes('--all')) {
  console.log(`COVERED (${have.length})`)
  for (const h of have) console.log(`   ${h.name.padEnd(34)} -> ${h.demo}`)
  console.log('')
}

const byGroup = {}
for (const m of missing) (byGroup[m.group] ||= []).push(m.name)
console.log(`NO DEMO (${missing.length})`)
for (const [group, names] of Object.entries(byGroup)) {
  console.log(`\n  ${group} (${names.length})`)
  for (const n of names) console.log(`     ${n}`)
}
