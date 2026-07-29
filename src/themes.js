// White-label branding. Each coach's app is the SAME product with a different
// skin. The active brand is chosen by ?brand=<slug> (remembered per device),
// defaulting to Kim. All screens read the resolved THEME below, so adding a new
// client is just a new entry in BRANDS + a link like ...?brand=paul.

export const BRANDS = {
  // Coached by Kim — warm cream, sage green, elegant serif. Women 35+.
  kim: {
    slug: 'kim',
    name: 'Coached by Kim',
    tagline: 'A fresh start. A stronger you.',
    logo: '/logo.jpg',
    mark: 'CBK',
    features: { activityFeed: true },
    trainGymName: 'South Coast Power House',
    equipment: [
      'Squat racks & Olympic benches',
      'Plate-loaded & ISO machines',
      'Full dumbbell range',
      'Deadlift platforms',
      'Cardio (treadmill, cycle, stepper, cross-trainer)',
      'Outdoor strongman: tyres & battle ropes',
    ],
    vars: {
      '--bg': '#f3ede2',
      '--surface': '#fbf7ef',
      '--surface-2': '#ece3d4',
      '--line': '#e3d9c8',
      '--text': '#2c2b27',
      '--muted': '#8b8371',
      '--accent': '#74815a',
      '--accent-hi': '#97a179',
      '--on-accent': '#ffffff',
      '--ring-track': '#e3d9c8',
      '--radius': '18px',
    },
  },

  // ReDefine Academy (Paul Andrews PT) — bold, dark, orange accent. "No-nonsense."
  // redefineacademy.com. Online coaching; clients train at a commercial gym.
  paul: {
    slug: 'paul',
    name: 'ReDefine Academy',
    tagline: 'The time to redefine is now.',
    logo: null, // monogram badge until Paul's wordmark is dropped in
    mark: 'RD',
    scheme: 'dark',
    features: { testing: true, templates: true, programs: true, recipes: true, videos: true, barcode: true, tags: true, supplements: true, shop: true, podcasts: true, agenda: true, progressHub: true, checkinForms: true, files: true, nutritionStyle: true, activityFeed: true },
    // Grouped bottom nav (Paul's round-2 ask + his Harbiz layout). Ids map to
    // screens/hubs in ClientApp; label overrides the per-id default. Brands
    // without a `nav` keep the default six-tab bar, so Kim/PPH/BBL are untouched.
    nav: [
      { id: 'home', label: 'Home' },
      { id: 'trainhub', label: 'Train' },
      { id: 'nutrition', label: 'Nutrition' },
      { id: 'videos', label: 'Videos' },
      { id: 'body', label: 'Progress' },
      { id: 'ask', label: 'Coach' },
    ],
    trainGymName: 'your gym',
    equipment: [
      'Squat racks & Olympic benches',
      'Plate-loaded & cable machines',
      'Full dumbbell & kettlebell range',
      'Deadlift platforms',
      'Cardio (treadmill, rower, bike, ski-erg)',
      'Functional rig & sled track',
    ],
    // Palette pulled from Paul's real ReDefine logo: emerald-green lightning +
    // gold "RE" on near-black. Emerald is the accent; gold is a highlight token
    // (var(--gold)) — never a button background (white-on-gold fails contrast).
    // Dark text sits on the bright emerald for AA contrast on buttons.
    vars: {
      '--bg': '#0d0f0e',
      '--surface': '#171a18',
      '--surface-2': '#212523',
      '--line': '#2d322f',
      '--text': '#f4f6f5',
      '--muted': '#98a09b',
      '--accent': '#18c07d',
      '--accent-hi': '#3ad598',
      '--on-accent': '#052117',
      '--gold': '#f5c518',
      '--ring-track': '#2d322f',
      '--radius': '14px',
    },
  },

  // The Physical Performance Hub (Sam & Jordan) — thepph.co.uk. Sports-performance
  // hub for athletes (S&C, rehab, testing). Brand = black & white, high-contrast,
  // clinical yet energetic. Mono dark theme, white accent.
  pph: {
    slug: 'pph',
    name: 'Physical Performance Hub',
    tagline: 'Complete support for every athlete.',
    logo: '/pph-logo.png',
    mark: 'PPH',
    scheme: 'dark',
    features: { testing: true, squads: true, nutritionExpert: true, monitoring: true, growth: true },
    heroImages: ['/pph/hero1.jpg', '/pph/hero2.jpg'],
    trainGymName: 'The Physical Performance Hub',
    equipment: [
      'Squat racks & Olympic platforms',
      'Full barbell & bumper plate range',
      'Dumbbells & kettlebells',
      'Cable & plate-loaded machines',
      'Sleds, prowlers & plyo boxes',
      'Assault bikes, rower & ski-erg',
    ],
    vars: {
      '--bg': '#0a0a0a',
      '--surface': '#161616',
      '--surface-2': '#222222',
      '--line': '#333333',
      '--text': '#ffffff',
      '--muted': '#a0a0a0',
      '--accent': '#eca41d',
      '--accent-hi': '#ffbb3d',
      '--on-accent': '#0a0a0a',
      '--ring-track': '#333333',
      '--radius': '10px',
    },
  },

  // BBL Gym (Poole) — black & gold, luxury/serious commercial gym. Member app.
  bbl: {
    slug: 'bbl',
    name: 'BBL Gym',
    tagline: 'Serious facilities. No excuses left.',
    logo: null,
    mark: 'BBL',
    scheme: 'dark',
    features: { nutritionExpert: true, cashflow: true, booking: true, crm: true, briefing: true },
    trainGymName: 'BBL Gym',
    equipment: [
      'Full free-weights floor — barbells & dumbbells to 60kg',
      'Squat racks & Olympic platforms',
      'Plate-loaded & pin-loaded machines',
      'Cable stations & functional rigs',
      'Cardio zone — treadmills, bikes, rowers, ski-ergs',
      'Turf & sled track',
    ],
    vars: {
      '--bg': '#0c0b09',
      '--surface': '#17150f',
      '--surface-2': '#221d15',
      '--line': '#352d1e',
      '--text': '#f5f2ea',
      '--muted': '#a89e88',
      '--accent': '#d4af37',
      '--accent-hi': '#ecca5f',
      '--on-accent': '#0c0b09',
      '--ring-track': '#352d1e',
      '--radius': '12px',
    },
  },
}

// Per-gym deploys map their own domain to a single brand, so one build serves
// every gym: each domain LOCKS to its brand (no ?brand= switching, no other
// gym's look ever shows). Hosts not listed here (coached-by-kim, localhost) keep
// the multi-brand behaviour below.
const HOST_BRAND = {
  'redefine-academy.netlify.app': 'paul',
  'app.redefineacademy.com': 'paul',
  'redefineacademy.com': 'paul',
  'www.redefineacademy.com': 'paul',
}

function resolveBrandSlug() {
  try {
    const host = window.location.hostname
    if (HOST_BRAND[host] && BRANDS[HOST_BRAND[host]]) return HOST_BRAND[host]
  } catch { /* SSR / no window */ }

  // Build-time override (fallback path for local/preview builds)
  const forced = import.meta.env.VITE_DEFAULT_BRAND
  if (forced && BRANDS[forced]) return forced

  let slug = null
  try {
    const params = new URLSearchParams(window.location.search)
    slug = params.get('brand')
    if (slug) localStorage.setItem('cbk_brand', slug)
    else slug = localStorage.getItem('cbk_brand')
  } catch { /* SSR / no window */ }
  return slug && BRANDS[slug] ? slug : 'kim'
}

export const BRAND_SLUG = resolveBrandSlug()
export const THEME = BRANDS[BRAND_SLUG]

export function applyTheme(theme) {
  const root = document.documentElement
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.style.colorScheme = theme.scheme || 'light'
  document.title = theme.name
}
