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
    instagram: 'cbk_coachedbykim',
    features: { activityFeed: true, videos: true, coachMealPlans: true, progressHub: true, agenda: true, events: true, cycle: true, nutritionSupport: true, groups: true },
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
    logo: '/brands/paul/logo.png', // Paul's real ReDefine logo
    mark: 'RD',
    instagram: 'paulandrewspt',
    tiktok: 'paulandrewspt',
    scheme: 'dark',
    features: { testing: true, templates: true, programs: true, recipes: true, videos: true, barcode: true, tags: true, supplements: true, shop: true, podcasts: true, agenda: true, progressHub: true, checkinForms: true, checkinAI: true, files: true, nutritionStyle: true, activityFeed: true, exerciseGuides: true, mealPlans: true, nutritionSupport: true, groupedHome: true, groupedCoach: true, parq: true, foodDayComplete: true, water: true, awards: true, clientProgramAi: true, gettingStarted: true },
    // Grouped bottom nav (Paul's round-2 ask + his Harbiz layout; simplified to
    // 5 tabs 2026-08-18 per his feedback — Videos folded into the Coach hub,
    // Coach+Community merged into one tab). Ids map to screens/hubs in
    // ClientApp; label overrides the per-id default. Brands without a `nav`
    // keep the default six-tab bar, so Kim/PPH/BBL are untouched.
    nav: [
      { id: 'home', label: 'Home' },
      { id: 'trainhub', label: 'Train' },
      { id: 'nutrition', label: 'Nutrition' },
      { id: 'body', label: 'Check-ins & Progress' },
      { id: 'coachhub', label: 'Coach' },
    ],
    // Paul's members know the gym as ReDefine, not as "Paul".
    communityName: 'The ReDefine Community.',
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
    features: { testing: true, squads: true, squadMode: true, nutritionExpert: true, monitoring: true, growth: true, rehab: true, activityFeed: true, vald: true },
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

  // Elev8u (Bournemouth) — Hyrox / functional-fitness gym. Matches their REAL
  // brand exactly: green circle "E" mark (#45b263) + navy wordmark on white.
  // Light scheme so their navy logo + clean white identity carry through — no
  // re-brand. Green is the accent; button text is dark-green for AA contrast.
  // Ricky's own training app. Not a fork — a brand. Same codebase, same
  // database, so every fix and every feature built for a customer lands here
  // too, and nothing has to be ported. RLS already keeps one coach's data away
  // from another's, so his numbers are no more visible to Paul than Paul's are
  // to Kim.
  //
  // Every feature is on: there is no upsell tier to protect and no client to
  // confuse, and he wants the AI to do the programming and the nutrition.
  ricky: {
    slug: 'ricky',
    scheme: 'dark',
    name: 'Rick.Fit',
    tagline: 'Lose the belly fat. Keep the muscle.',
    mark: 'R',
    logo: '/brands/ricky/icon-512.png',
    // Shipped with the build rather than uploaded: THEME.heroImages is
    // concatenated ahead of any the coach uploads, so this needs no storage
    // bucket and no credentials. All eight are built by
    // scripts/make-ricky-heroes.py, which documents where each one comes from:
    // the original gym shots with Ricky's face swapped in, the two originals
    // that had no face to swap, and his own goal renders, interleaved.
    heroImages: [
      '/brands/ricky/hero-1.jpg',
      '/brands/ricky/hero-2.jpg',
      '/brands/ricky/hero-3.jpg',
      '/brands/ricky/hero-4.jpg',
      '/brands/ricky/hero-5.jpg',
      '/brands/ricky/hero-6.jpg',
      '/brands/ricky/hero-7.jpg',
      '/brands/ricky/hero-8.jpg',
    ],
    features: {
      testing: true, templates: true, programs: true, recipes: true, videos: true,
      barcode: true, tags: true, supplements: true, shop: true, podcasts: true,
      agenda: true, progressHub: true, checkinForms: true, checkinAI: true, files: true,
      nutritionStyle: true, activityFeed: true, exerciseGuides: true, mealPlans: true,
      // Week plans + shopping list. Rick.Fit ONLY - Paul has mealPlans but has
      // never seen the week path, and it is his clients' eating either way.
      weekMealPlans: true,
      // Rest + hold timers in the guided session. Rick.Fit only - see ClientApp.
      workoutTimers: true,
      nutritionSupport: true, groupedHome: true, groupedCoach: true, water: true, foodDayComplete: true,
      awards: true, clientProgramAi: true, gettingStarted: true, nutritionExpert: true,
      monitoring: true, coachMealPlans: true,
      // Calisthenics: the six skill ladders, the sessions built off them and a
      // bodyweight style in the programme builder. Rick.Fit and Lennon only.
      calisthenics: true,
      // No PAR-Q: it is a screening form for taking on other people's risk,
      // and there is nobody here but him.
      parq: false,
    },
    trainGymName: 'the gym',
    equipment: [
      'Barbell, rack & bench',
      'Dumbbells',
      'Cable machine',
      'Leg press & leg machines',
      'Pull-up bar',
      'Treadmill, bike & rower',
    ],
    vars: {
      // Lifted from the look Ricky liked: near-black with a single neon green,
      // nothing else competing. The green only ever appears on the thing you
      // are meant to press or the number that matters — used everywhere it
      // stops meaning anything.
      '--bg': '#070a08',
      '--surface': '#0e1310',
      '--surface-2': '#161d18',
      '--line': '#232d26',
      '--text': '#eef5ef',
      '--muted': '#8b9c90',
      '--accent': '#2ee85c',
      '--accent-hi': '#5bff86',
      '--on-accent': '#04120a',
      '--gold': '#2ee85c',
      '--good': '#2ee85c',
      '--ring-track': '#1c2620',
      '--radius': '16px',
      // Headings drop the default serif for a heavy system sans. The first
      // attempt reached for Haettenschweiler and Impact to get the condensed
      // look of the reference; neither is reliably installed, and the wordmark
      // rendered as an unreadable squeezed blob. Weight and letter-spacing get
      // most of that character with a stack that exists everywhere.
      '--serif': "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
  },
  // Lennon — Ricky's son, a contracted goalkeeper at Shrewsbury Town (he has
  // permission to use the club brand; this is his own app, not public marketing).
  // Shrewsbury's blue and amber.
  //
  // DELIBERATELY NOT A PROGRAMME APP. His club has S&C staff and his gym work is
  // their job; a second programme running alongside theirs is how a young player
  // ends up overtrained and how a parent ends up contradicting a professional
  // coach. So `programs`, `templates` and `clientProgramAi` are OFF, and what he
  // gets instead is everything the club does not sit with him for every day:
  // fuelling around training and matchdays, hydration, sleep, and goalkeeper
  // prehab — wrists, shoulders, hips, the joints that take the landings.
  lennon: {
    slug: 'lennon',
    scheme: 'dark',
    name: 'Lennon GK',
    tagline: 'Goalkeeper. Fuelled properly.',
    mark: 'LG',
    logo: '/brands/lennon/icon-512.png',
    features: {
      // programs ON so his club block can live in the app and he can log against
      // it; aiWorkoutGen OFF so the app never writes him a programme of its own.
      programs: true, aiWorkoutGen: false,
      videos: true, recipes: true, barcode: true, tags: true, agenda: true,
      progressHub: true, checkinForms: true, checkinAI: true, files: true,
      nutritionStyle: true, activityFeed: true, exerciseGuides: true,
      mealPlans: true, coachMealPlans: true, nutritionExpert: true,
      nutritionSupport: true, groupedHome: true, water: true,
      foodDayComplete: true, monitoring: true, awards: true,
      gettingStarted: true, workoutTimers: true,
      // Calisthenics is bodyweight work he can do anywhere, and the tracker is
      // his own to chase. It does NOT reopen app-written programming: the style
      // only appears in the builder, and aiWorkoutGen stays false above, so the
      // club keeps owning his gym work.
      calisthenics: true,
    },
    trainGymName: 'the training ground',
    equipment: [
      'Club gym — full S&C provision',
      'Goalkeeping pitch & handling area',
      'Med balls & reaction balls',
      'Bands, mobility & prehab kit',
      'Recovery — bike, foam rollers',
    ],
    vars: {
      '--bg': '#080f1e',
      '--surface': '#0e1a30',
      '--surface-2': '#16243f',
      '--line': '#22334f',
      '--text': '#eef4fc',
      '--muted': '#8fa3bf',
      '--accent': '#ffb81c',
      '--accent-hi': '#ffca50',
      '--on-accent': '#101828',
      '--ring-track': '#22334f',
      '--radius': '14px',
    },
  },

  // Kelsey — Ricky's daughter. Full gym, and the goal she actually stated:
  // glutes. So the programme is lower-body led and the app keeps the whole
  // training side switched on, which is the opposite of her brother's.
  kelsey: {
    slug: 'kelsey',
    scheme: 'dark',
    name: 'Kelsey Fit',
    tagline: 'Glutes, strength, shape.',
    mark: 'K',
    logo: '/brands/kelsey/icon-512.png',
    features: {
      programs: true, templates: true, clientProgramAi: true, exerciseGuides: true,
      videos: true, recipes: true, barcode: true, tags: true, agenda: true,
      progressHub: true, checkinForms: true, checkinAI: true, files: true,
      nutritionStyle: true, activityFeed: true, mealPlans: true,
      coachMealPlans: true, nutritionExpert: true, nutritionSupport: true,
      groupedHome: true, water: true, foodDayComplete: true, awards: true,
      gettingStarted: true, workoutTimers: true, progressPhotos: true,
    },
    trainGymName: 'the gym',
    equipment: [
      'Hip thrust bench & barbells',
      'Cable machines & rope attachments',
      'Leg press & hack squat',
      'Smith machine',
      'Full dumbbell range',
      'Bands & ankle straps',
    ],
    vars: {
      '--bg': '#150a13',
      '--surface': '#211020',
      '--surface-2': '#2d182b',
      '--line': '#3d2439',
      '--text': '#fbf0f7',
      '--muted': '#b294a8',
      '--accent': '#e9548c',
      '--accent-hi': '#f377a8',
      '--on-accent': '#1a0812',
      '--ring-track': '#3d2439',
      '--radius': '16px',
    },
  },

  elev8: {
    slug: 'elev8',
    name: 'Elev8u',
    tagline: 'Train. Race. Elevate.',
    logo: '/brands/elev8/logo.png',
    mark: 'E',
    // The same grouped five-tab bar ReDefine uses. Without a `nav` a brand keeps
    // the old six tabs (Today/Train/Fridge/Meal/Body/Coach), which is a poor
    // showing for a demo now that this brand has twenty-five more screens
    // behind it. The hubs already suit a Hyrox gym: `trainhub` carries
    // `testing` and `body` carries `monitoring` (see HUB_CHILDREN).
    nav: [
      { id: 'home', label: 'Today' },
      { id: 'trainhub', label: 'Train' },
      { id: 'nutrition', label: 'Nutrition' },
      { id: 'body', label: 'Progress' },
      { id: 'coachhub', label: 'Coach' },
    ],
    // Feature parity with ReDefine (Ricky, 12 Sept: "add all of the
    // functionality of redefine to the elev8 app"), keeping Elev8's own Hyrox
    // extras — squads, squad mode, monitoring and the Hyrox testing battery —
    // which ReDefine does not have.
    //
    // Not included: `weekMealPlans`, which is Rick.Fit only and has never run
    // in front of anyone but Ricky; and `coachMealPlans`, which is Kim's, not
    // ReDefine's. `parq` IS on — a gym taking on members wants the screening,
    // and it is a demo selling point — but the wording was signed off by Paul
    // Andrews for ReDefine, so Elev8u should read it before using it for real.
    features: {
      // Elev8's own
      testing: true, squads: true, squadMode: true, monitoring: true,
      // and everything ReDefine runs
      templates: true, programs: true, recipes: true, videos: true,
      barcode: true, tags: true, supplements: true, shop: true, podcasts: true,
      agenda: true, progressHub: true, checkinForms: true, checkinAI: true, files: true,
      nutritionStyle: true, activityFeed: true, exerciseGuides: true, mealPlans: true,
      nutritionExpert: true, nutritionSupport: true, groupedHome: true, groupedCoach: true,
      parq: true, foodDayComplete: true, water: true, awards: true,
      clientProgramAi: true, gettingStarted: true,
    },
    trainGymName: 'Elev8u',
    equipment: [
      'Sled track — push & pull',
      'SkiErg & Concept2 rowers',
      'Wall-ball targets & med balls',
      'Sandbags, kettlebells & farmers handles',
      'Assault bikes',
      'Running lanes',
    ],
    vars: {
      '--bg': '#f4f7f9',
      '--surface': '#ffffff',
      '--surface-2': '#eaeff3',
      '--line': '#d9e1e8',
      '--text': '#161f2e',
      '--muted': '#64748b',
      '--accent': '#45b263',
      '--accent-hi': '#379a52',
      '--on-accent': '#ffffff',
      '--gold': '#45b263',
      '--ring-track': '#e0e7ec',
      '--radius': '12px',
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
  'coached-by-kim.netlify.app': 'kim',
  'the-physical-performance-hub.netlify.app': 'pph',
  'elev8-hyrox.netlify.app': 'elev8',
  'rick-fit.netlify.app': 'ricky',
  'lennon-gk.netlify.app': 'lennon',
  'kelsey-fit.netlify.app': 'kelsey',
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
  // A brand hook for the handful of things a CSS variable cannot express —
  // letter-spacing, casing, a glow. Everything else should stay in vars.
  root.classList.forEach((c) => { if (c.startsWith('brand-')) root.classList.remove(c) })
  if (theme.slug) root.classList.add('brand-' + theme.slug)
}
