import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'
import { fileToBase64, analyze, extractFrames, scaleImageToBase64, urlToBase64, startOfTodayISO, sumMacros, remainingMacros, setPersona, setNutritionStyle, setRecovery, setHealthContext, mealByHour, MEALS } from './lib.js'
import { LEVELS, FOOD_NUDGES, WORKOUT_NUDGES, pickNudge, daySeed } from './accountability.js'
import { PERF_TESTS, TEST_BY_KEY, TEST_GROUPS, bestValue } from './perfTests.js'
import { NUTRITION_KB, NUTRITION_AREAS } from './nutritionExpert.js'
import { WELLNESS, readinessScore, readinessLight, loadMetrics, acwrFlag, combinedReadiness } from './monitoring.js'
import { ageYears, maturityOffset, maturityPhase, growthVelocity, growthGuidance } from './growth.js'
import { pushSupported, pushStatus, enablePush, disablePush, sendTestPush, isIOS, isStandalone } from './push.js'
import { ExerciseRowsEditor, newExerciseRow, rowsToExercises, planToRows, setTypeLabel } from './WorkoutRows.jsx'
import { computeTargets, GOALS, ACTIVITY } from './Onboarding.jsx'
import { MessageThread } from './MessageThread.jsx'
import { ValdTests } from './VALD.jsx'
import { ExerciseGuide } from './ExerciseGuide.jsx'
import { RecipeCreator } from './RecipeCreator.jsx'
import { FoodDiary } from './FoodDiary.jsx'
import { CommunityFeed } from './CommunityFeed.jsx'
import { LiftProgress } from './LiftProgress.jsx'
import { ProgressPhotos } from './ProgressPhotos.jsx'
import { CameraCapture } from './CameraCapture.jsx'
import { PROGRAM_DIMS, programTagLabel, programMatches } from './programMeta.js'
import { formatAnswer } from './checkinForms.js'
import { RTP_LADDER, BODY_REGIONS, availabilityOf, statusLabel } from './rehab.js'
import { FoodSearch } from './FoodSearch.jsx'
import { MealPlanBuilder } from './MealPlan.jsx'
import { ClientMealPlan } from './MealPlans.jsx'
import { ClientLifeCard, CycleTracker } from './LifeEvents.jsx'
import { activeHoliday } from './lifeEvents.js'
import { MuscleTargeter } from './MuscleTargeter.jsx'
import { StravaConnect } from './StravaConnect.jsx'
import { Classes } from './Classes.jsx'
import { exchangeStrava } from './strava.js'
import {
  Ring, MacroBar, MacroRow, Loader, TrendChart,
  IconHome, IconTrain, IconFridge, IconMeal, IconBody, IconAsk, IconForm, IconContent, IconCommunity, IconTest, ExSets,
} from './ui.jsx'

const FOCUS_OPTIONS = ['Full body', 'Push', 'Pull', 'Legs', 'Upper body']

// Bottom nav. A brand may define `nav` in themes.js (array of { id, label }) to
// group screens its own way; brands without one fall back to DEFAULT_NAV, so the
// default six-tab bar (Kim / PPH / BBL) is byte-identical to before. Icons and
// fallback labels resolve by id here so themes.js stays free of JSX.
const TAB_META = {
  home:      { label: 'Today',     icon: IconHome },
  train:     { label: 'Train',     icon: IconTrain },
  trainhub:  { label: 'Train',     icon: IconTrain },
  nutrition: { label: 'Nutrition', icon: IconMeal },
  fridge:    { label: 'Fridge',    icon: IconFridge },
  meal:      { label: 'Meal',      icon: IconMeal },
  videos:    { label: 'Videos',    icon: IconContent },
  body:      { label: 'Body',      icon: IconBody },
  ask:       { label: 'Coach',     icon: IconAsk },
  coachhub:  { label: 'Coach',     icon: IconAsk },
}
const DEFAULT_NAV = [
  { id: 'home' }, { id: 'train' }, { id: 'fridge' },
  { id: 'meal' }, { id: 'body' }, { id: 'ask' },
]
// So a hub tab stays lit while you're inside one of its screens.
const HUB_CHILDREN = {
  trainhub:  ['train', 'programs', 'muscles', 'testing', 'strava'],
  nutrition: ['meal', 'fridge', 'food', 'barcode', 'recipes', 'calc', 'expert', 'health'],
  body:      ['body', 'growth', 'monitoring'],
  coachhub:  ['ask', 'form', 'content', 'community', 'videos', 'supplements', 'shop', 'podcasts', 'files'],
}

export default function ClientApp({ profile, onSignOut }) {
  // Persist the current screen so backgrounding the app (mobile often reloads the
  // page on return) drops them back where they were, not on the home screen.
  const [screen, setScreen] = useState(() => { try { return sessionStorage.getItem('cbk_screen') || 'home' } catch { return 'home' } })
  useEffect(() => { try { sessionStorage.setItem('cbk_screen', screen) } catch { /* private mode */ } }, [screen])
  const [targets, setTargets] = useState(null)
  const [todayLogs, setTodayLogs] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [events, setEvents] = useState([])
  const [coachName, setCoachName] = useState('')
  const [heroImages, setHeroImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [workoutTick, setWorkoutTick] = useState(0) // bumped when a guided session finishes, so Home cards refresh

  async function loadAll() {
    setNutritionStyle(profile.nutrition_style)
    setRecovery({ on: profile.nutrition_sensitive, note: profile.nutrition_sensitive_note })
    setHealthContext({
      conditions: profile.health_conditions, hasKids: profile.has_kids,
      singleParent: profile.single_parent, shiftWorker: profile.shift_worker, note: profile.life_context_note,
    })
    const [t, logs, meas] = await Promise.all([
      supabase.from('macro_targets').select('*').eq('client_id', profile.id).maybeSingle(),
      supabase.from('nutrition_logs').select('*').eq('client_id', profile.id).gte('logged_at', startOfTodayISO()).order('logged_at', { ascending: false }),
      supabase.from('body_measurements').select('*').eq('client_id', profile.id).order('measured_at', { ascending: true }),
    ])
    setTargets(t.data || { protein_g: 150, carbs_g: 200, fat_g: 65, calories: 2200 })
    setTodayLogs(logs.data || [])
    setMeasurements(meas.data || [])
    if (THEME.features?.events) {
      const { data: ev } = await supabase.from('client_events').select('*').eq('client_id', profile.id).order('start_date', { ascending: true })
      setEvents(ev || [])
    }
    if (profile.trainer_id) {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', profile.trainer_id).maybeSingle()
      setCoachName(data?.full_name || 'your coach')
      const { data: heroes } = await supabase.from('hero_images').select('image_path').eq('coach_id', profile.trainer_id).order('created_at', { ascending: true })
      setHeroImages((heroes || []).map((h) => supabase.storage.from('content-images').getPublicUrl(h.image_path).data.publicUrl))
      const { data: p } = await supabase.from('coach_personas').select('*').eq('coach_id', profile.trainer_id).maybeSingle()
      setPersona(p ? { name: p.display_name, audience: p.audience, philosophy: p.philosophy, tone: p.tone } : null)
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // Handle the Strava OAuth return (?code=...&state=strava_<userId>): exchange
  // the code for a token, store the connection, then open the Strava screen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code'), state = params.get('state')
    if (!code || state !== 'strava_' + profile.id) return
    ;(async () => {
      try {
        const t = await exchangeStrava(code)
        await supabase.from('strava_connections').upsert({ client_id: profile.id, athlete_id: t.athlete_id, athlete_name: t.athlete_name, refresh_token: t.refresh_token, connected_at: new Date().toISOString() })
      } catch { /* surfaced on the Strava screen */ }
      window.history.replaceState({}, '', window.location.pathname)
      setScreen('strava')
    })()
  }, [])

  const consumed = sumMacros(todayLogs)
  const remaining = remainingMacros(targets, consumed)

  // Bottom nav is brand-driven (see TAB_META / DEFAULT_NAV). A hub tab stays lit
  // while you're on one of its child screens.
  const nav = THEME.nav || DEFAULT_NAV
  const activeTab = nav.some((n) => n.id === screen)
    ? screen
    : (nav.find((n) => HUB_CHILDREN[n.id]?.includes(screen))?.id || screen)
  // Screens that live under the Coach & Community hub on brands that have one
  // (Paul) go back there; everyone else (no coachhub tab) goes back to Home.
  const backFromCoach = () => setScreen(nav.some((n) => n.id === 'coachhub') ? 'coachhub' : 'home')

  async function logFood({ name, protein_g, carbs_g, fat_g, fibre_g, calories, meal_type, logged_at }, source) {
    const row = {
      client_id: profile.id, source, name: name || null, meal_type: meal_type || mealByHour(),
      protein_g: protein_g || 0, carbs_g: carbs_g || 0, fat_g: fat_g || 0, fibre_g: fibre_g || 0, calories: calories || 0,
      ...(logged_at ? { logged_at } : {}),
    }
    const { data } = await supabase.from('nutrition_logs').insert(row).select().single()
    // Only reflect on the home "today" total if it's genuinely today — a meal
    // logged for another day still shows on that day in the food diary.
    if (data) {
      const startToday = startOfTodayISO()
      const startTomorrow = new Date(new Date(startToday).getTime() + 86400000).toISOString()
      if (data.logged_at >= startToday && data.logged_at < startTomorrow) setTodayLogs((l) => [data, ...l])
    }
  }

  async function saveTargets(next) {
    setTargets(next)
    await supabase.from('macro_targets').upsert({ client_id: profile.id, ...next, updated_at: new Date().toISOString() })
  }

  async function addMeasurement(m) {
    const { data } = await supabase.from('body_measurements').insert({ client_id: profile.id, ...m }).select().single()
    if (data) setMeasurements((prev) => [...prev, data].sort((a, b) => a.measured_at.localeCompare(b.measured_at)))
  }

  if (loading) {
    return <div className="full-center"><div className="spinner" /><p className="muted">Loading your day…</p></div>
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {THEME.logo ? <img className="mark-img" src={THEME.logo} alt="" /> : <span className="mark-badge">{THEME.mark}</span>}
          <span className="brand-name">{THEME.name}</span>
        </div>
        <button className="link-btn" onClick={onSignOut}>Sign out</button>
      </header>

      <main className="screen">
        {screen === 'home' && <Home profile={profile} name={profile.full_name} coachName={coachName} heroImages={heroImages} targets={targets} consumed={consumed} remaining={remaining} foodLoggedToday={todayLogs.length > 0} clientId={profile.id} workoutTick={workoutTick} events={events} onGo={setScreen} onSaveTargets={saveTargets} />}
        {screen === 'train' && <Train onSaved={() => {}} clientId={profile.id} onWorkoutDone={() => setWorkoutTick((t) => t + 1)} />}
        {screen === 'trainhub' && <TrainHub coachName={coachName} onGo={setScreen} />}
        {screen === 'nutrition' && <NutritionHub profile={profile} coachName={coachName} onGo={setScreen} />}
        {screen === 'calc' && <CalcTargets profile={profile} onSaveTargets={saveTargets} onBack={() => setScreen(THEME.nav ? 'nutrition' : 'home')} />}
        {screen === 'health' && (
          <HealthDetails
            profile={profile}
            onBack={() => setScreen(THEME.nav ? 'nutrition' : 'home')}
            onSaved={(patch) => {
              setRecovery({ on: patch.nutrition_sensitive, note: patch.nutrition_sensitive_note })
              setHealthContext({
                conditions: patch.health_conditions, hasKids: patch.has_kids,
                singleParent: patch.single_parent, shiftWorker: patch.shift_worker, note: patch.life_context_note,
              })
            }}
          />
        )}
        {screen === 'testing' && <Testing clientId={profile.id} onBack={() => setScreen('home')} />}
        {screen === 'muscles' && (
          <div className="stack">
            <button className="link-btn" onClick={() => setScreen('home')}>‹ Back</button>
            <p className="eyebrow">Muscle targeter</p>
            <h1 className="h1">Which muscle?</h1>
            <p className="lead">Tap a muscle group to see the best exercises to train it.</p>
            <MuscleTargeter />
          </div>
        )}
        {screen === 'expert' && <NutritionExpert clientId={profile.id} onBack={() => setScreen('home')} />}
        {screen === 'monitoring' && <Monitoring clientId={profile.id} onBack={() => setScreen('home')} />}
        {screen === 'strava' && <StravaConnect clientId={profile.id} onBack={() => setScreen('home')} />}
        {screen === 'classes' && <Classes profile={profile} onBack={() => setScreen('home')} />}
        {screen === 'programs' && <ProgramLibrary clientId={profile.id} coachName={coachName} onBack={() => setScreen('home')} />}
        {screen === 'recipes' && <RecipeLibrary profile={profile} coachName={coachName} onLog={(m) => logFood(m, 'recipe')} onBack={() => setScreen('home')} />}
        {screen === 'mealplan' && <MealPlanBuilder targets={targets} coachName={coachName} onLog={(m) => logFood(m, 'manual')} onBack={() => setScreen(THEME.nav ? 'nutrition' : 'home')} />}
        {screen === 'videos' && <VideoLibrary coachName={coachName} onBack={backFromCoach} />}
        {screen === 'myplan' && <ClientMealPlan clientId={profile.id} coachName={coachName} onBack={() => setScreen('home')} />}
        {screen === 'cycle' && <CycleTracker clientId={profile.id} coachName={coachName} onBack={() => setScreen('home')} />}
        {screen === 'supplements' && <LinkList kind="supplement" coachName={coachName} onBack={backFromCoach} />}
        {screen === 'shop' && <LinkList kind="shop" coachName={coachName} onBack={backFromCoach} />}
        {screen === 'podcasts' && <LinkList kind="podcast" coachName={coachName} onBack={backFromCoach} />}
        {screen === 'files' && <FilesLibrary coachName={coachName} onBack={backFromCoach} />}
        {screen === 'rehab' && <Rehab clientId={profile.id} coachName={coachName} onBack={() => setScreen('home')} />}
        {screen === 'barcode' && <BarcodeScan onLog={(m) => logFood(m, 'barcode')} onBack={() => setScreen('home')} />}
        {screen === 'growth' && <Growth clientId={profile.id} onBack={() => setScreen('home')} />}
        {screen === 'nudges' && <NudgeSettings clientId={profile.id} onBack={() => setScreen('home')} />}
        {screen === 'checkin' && (THEME.features?.checkinForms
          ? <CheckinFormRun clientId={profile.id} trainerId={profile.trainer_id} coachName={coachName} onBack={() => setScreen('home')} />
          : <WeeklyCheckin clientId={profile.id} coachName={coachName} onBack={() => setScreen('home')} />)}
        {screen === 'diary' && <FoodDiary clientId={profile.id} onBack={() => setScreen(THEME.nav ? 'nutrition' : 'home')} />}
        {screen === 'fridge' && <FridgeScan remaining={remaining} onLog={(m) => logFood(m, 'fridge')} />}
        {screen === 'meal' && <MealScan onLog={(m) => logFood(m, 'meal')} />}
        {screen === 'food' && (
          <div className="stack">
            <p className="eyebrow">Food diary</p>
            <h1 className="h1">Log a food or drink.</h1>
            <p className="lead">Search thousands of foods and drinks, pick your portion, and it’s added to today.</p>
            <FoodSearch onLog={(m) => logFood(m, 'manual')} />
          </div>
        )}
        {screen === 'body' && <Body measurements={measurements} onAdd={addMeasurement} clientId={profile.id} coachName={coachName} />}
        {screen === 'coachhub' && <CoachHub coachName={coachName} onGo={setScreen} />}
        {screen === 'ask' && <KimHub clientId={profile.id} coachName={coachName} onBack={nav.some((n) => n.id === 'coachhub') ? backFromCoach : undefined} />}
        {screen === 'form' && <FormCheck clientId={profile.id} coachName={coachName} onBack={nav.some((n) => n.id === 'coachhub') ? backFromCoach : undefined} />}
        {screen === 'content' && <IGContent coachName={coachName} onBack={nav.some((n) => n.id === 'coachhub') ? backFromCoach : undefined} />}
        {screen === 'community' && (
          <div className="stack">
            {nav.some((n) => n.id === 'coachhub') && <button className="link-btn" onClick={backFromCoach}>‹ Back</button>}
            <p className="eyebrow">Community</p>
            <h1 className="h1">The {coachName?.split(' ')[0] || 'Kim'} community.</h1>
            <p className="lead">Share your wins and cheer each other on.</p>
            <CommunityFeed communityCoachId={profile.trainer_id} me={profile.id} myName={profile.full_name} isCoach={false} />
          </div>
        )}
      </main>

      <nav className={'tabbar' + (nav.length === 6 ? ' six' : '')}>
        {nav.map((n) => {
          const meta = TAB_META[n.id] || {}
          const label = n.label || (n.id === 'ask' ? (coachName?.split(' ')[0] || 'Coach') : meta.label || n.id)
          return <Tab key={n.id} id={n.id} label={label} active={activeTab} onGo={setScreen} icon={meta.icon || IconHome} />
        })}
      </nav>
    </div>
  )
}

/* ---------- Home ---------- */
function HeroCarousel({ images }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (images.length <= 1) return
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const t = setInterval(() => setI((x) => (x + 1) % images.length), 5000)
    return () => clearInterval(t)
  }, [images.length])
  if (!images.length) return null
  return (
    <div className="hero-banner">
      {images.map((url, idx) => (
        <img key={idx} src={url} alt="" className={'hero-slide' + (idx === i ? ' on' : '')} />
      ))}
      {images.length > 1 && (
        <div className="hero-dots">
          {images.map((_, idx) => (
            <button key={idx} type="button" className={'hero-dot' + (idx === i ? ' on' : '')} onClick={() => setI(idx)} aria-label={`Photo ${idx + 1}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function Home({ profile, name, coachName, heroImages, targets, consumed, remaining, foodLoggedToday, clientId, workoutTick, events, onGo, onSaveTargets }) {
  const [editing, setEditing] = useState(false)
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const pct = targets?.calories ? consumed.calories / targets.calories : 0
  return (
    <div className="stack">
      <HeroCarousel images={(THEME.heroImages || []).concat(heroImages)} />
      <p className="eyebrow">Today</p>
      <h1 className="h1">Hi {name?.split(' ')[0] || 'there'} — let’s hit your numbers.</h1>
      {coachName && <p className="lead">Coached by {coachName}.</p>}

      {THEME.features?.events && <ClientLifeCard profile={profile} events={events} coachName={coachName} />}
      {THEME.features?.agenda && <AgendaCard profile={profile} coachName={coachName} foodLoggedToday={foodLoggedToday} workoutTick={workoutTick} events={events} onGo={onGo} />}
      <AccountabilityCard clientId={clientId} coachName={coachName} foodLoggedToday={foodLoggedToday} workoutTick={workoutTick} onGo={onGo} />

      <div className="card ring-card">
        <Ring value={pct} label="of daily kcal">
          <b>{consumed.calories}</b>
          <span>/ {targets?.calories || 0} kcal</span>
        </Ring>
        <div className="macro-list">
          <MacroBar label="Protein" have={consumed.protein_g} goal={targets?.protein_g || 0} unit="g" />
          <MacroBar label="Carbs" have={consumed.carbs_g} goal={targets?.carbs_g || 0} unit="g" />
          <MacroBar label="Fat" have={consumed.fat_g} goal={targets?.fat_g || 0} unit="g" />
        </div>
      </div>

      <p className="remaining-note">
        {remaining.calories} kcal left · {remaining.protein_g}g protein to go ·{' '}
        <button className="link-btn inline" onClick={() => setEditing((v) => !v)}>{editing ? 'close' : 'adjust targets'}</button>
        {' · '}<button className="link-btn inline" onClick={() => onGo('diary')}>food diary</button>
      </p>

      {editing && <TargetEditor targets={targets} onSave={(t) => { onSaveTargets(t); setEditing(false) }} />}

      <HomeTiles coachFirst={coachFirst} onGo={onGo} />
    </div>
  )
}

// Every Home tile, in the original flat order, tagged with the group it
// belongs to. Brands without `features.groupedHome` render this flat (same
// order/output as before — Kim/PPH/BBL/Elev8 untouched); Paul renders it
// chunked under section headers instead (his ask: "group things into sections
// or widgets", his Home tab was one 25-tile wall).
// Tile order within each group follows the matching hub tab's order (Paul's
// ask — Home and the hub tabs should agree), not just alphabetical/legacy order.
function homeTileDefs(coachFirst) {
  return [
    { id: 'classes', group: 'Training', hero: true, show: THEME.features?.booking, Icon: IconTrain, title: 'Book a class', sub: 'See the timetable & book your spot' },
    { id: 'train', group: 'Training', show: true, Icon: IconTrain, title: 'Today’s session', sub: 'A plan built for your gym’s kit' },
    { id: 'programs', group: 'Training', hero: true, show: THEME.features?.programs, Icon: IconTrain, title: 'Program library', sub: `Follow a full plan built by ${coachFirst}` },
    { id: 'muscles', group: 'Training', show: true, Icon: IconTrain, title: 'Muscle targeter', sub: 'Tap a muscle, get exercises to train it' },
    { id: 'strava', group: 'Training', show: true, Icon: IconBody, title: 'Connect Strava', sub: 'Pull your runs, rides & workouts into the app' },
    { id: 'testing', group: 'Training', show: THEME.features?.testing, Icon: IconTest, title: 'Performance testing', sub: 'Log your tests & track your PBs' },
    { id: 'meal', group: 'Nutrition', show: true, Icon: IconMeal, title: 'Scan a meal', sub: 'Photo → calories & macros' },
    { id: 'fridge', group: 'Nutrition', hero: true, show: true, Icon: IconFridge, title: 'Fridge-to-Plate', sub: 'Snap your fridge, get a meal that fits your macros' },
    { id: 'food', group: 'Nutrition', show: true, Icon: IconMeal, title: 'Log food', sub: 'Search foods & drinks, add your portion' },
    { id: 'barcode', group: 'Nutrition', show: THEME.features?.barcode, Icon: IconMeal, title: 'Barcode scan', sub: 'Scan a product, log it in a tap' },
    { id: 'recipes', group: 'Nutrition', show: THEME.features?.recipes, Icon: IconMeal, title: 'Recipes', sub: `${coachFirst}’s go-to meals, log in one tap` },
    { id: 'mealplan', group: 'Nutrition', hero: true, show: THEME.features?.mealPlans, Icon: IconMeal, title: 'Meal plan', sub: 'Build a day around your targets' },
    { id: 'myplan', group: 'Nutrition', hero: true, show: THEME.features?.coachMealPlans, Icon: IconMeal, title: 'My meal plan', sub: `${coachFirst}’s plan for you — ideas & structure` },
    { id: 'expert', group: 'Nutrition', hero: true, show: THEME.features?.nutritionExpert, Icon: IconMeal, title: 'Nutrition Expert', sub: 'Evidence-based sports nutrition, any time' },
    { id: 'health', group: 'Nutrition', show: true, Icon: IconAsk, title: 'My details', sub: 'Health conditions & life circumstances — optional' },
    { id: 'body', group: 'Progress & Body', show: true, Icon: IconBody, title: 'Body scan', sub: 'Track your progress' },
    { id: 'cycle', group: 'Progress & Body', show: THEME.features?.cycle, Icon: IconBody, title: 'Cycle', sub: 'Log your period, train with your body' },
    { id: 'checkin', group: 'Progress & Body', hero: true, show: true, Icon: IconAsk, title: 'Weekly check-in', sub: `Send ${coachFirst} your progress & how the week went` },
    { id: 'monitoring', group: 'Progress & Body', show: THEME.features?.monitoring, Icon: IconBody, title: 'Readiness & load', sub: 'Daily check-in & training-load tracking' },
    { id: 'rehab', group: 'Progress & Body', show: THEME.features?.rehab, Icon: IconBody, title: 'My rehab', sub: 'Your rehab plan, return-to-play & soreness' },
    { id: 'growth', group: 'Progress & Body', show: THEME.features?.growth, Icon: IconTest, title: 'Growth tracker', sub: 'Your height, growth & maturation' },
    { id: 'community', group: 'Coach & Community', show: true, Icon: IconCommunity, title: 'Community', sub: 'Share wins & cheer each other on' },
    { id: 'videos', group: 'Coach & Community', show: THEME.features?.videos, Icon: IconForm, title: 'Video library', sub: `Technique & mindset clips from ${coachFirst}` },
    { id: 'ask', group: 'Coach & Community', hero: true, show: true, Icon: IconAsk, title: `Ask ${coachFirst}`, sub: `Get an answer in ${coachFirst}’s method, any time` },
    { id: 'form', group: 'Coach & Community', show: true, Icon: IconForm, title: 'Form check', sub: `Upload a clip — AI + ${coachFirst} check your form` },
    { id: 'content', group: 'Coach & Community', show: true, Icon: IconContent, title: `From ${coachFirst}`, sub: `${coachFirst}’s latest posts & inspiration` },
    { id: 'supplements', group: 'Coach & Community', show: THEME.features?.supplements, Icon: IconMeal, title: 'Supplements', sub: 'Trusted brands & your discount code' },
    { id: 'shop', group: 'Coach & Community', show: THEME.features?.shop, Icon: IconContent, title: 'Shop', sub: `${coachFirst}’s book, merch & gear` },
    { id: 'podcasts', group: 'Coach & Community', show: THEME.features?.podcasts, Icon: IconContent, title: 'Podcasts', sub: `Listen to ${coachFirst}’s episodes` },
    { id: 'files', group: 'Coach & Community', show: THEME.features?.files, Icon: IconForm, title: 'Files', sub: `${coachFirst}’s guides & resources` },
  ]
}
// Section order matches the bottom nav order (Home, Train, Nutrition,
// Check-ins & Progress, Coach); labels match the nav's own labels too — Paul's
// ask, so Home and the tab bar read as the same taxonomy.
const HOME_GROUPS = ['Training', 'Nutrition', 'Progress & Body', 'Coach & Community']
const HOME_GROUP_LABELS = { Training: 'Train', Nutrition: 'Nutrition', 'Progress & Body': 'Check-ins & Progress', 'Coach & Community': 'Coach & Community' }

function HomeTile({ t, onGo }) {
  const Icon = t.Icon
  return (
    <button className={'tile' + (t.hero ? ' tile-hero' : '')} onClick={() => onGo(t.id)}>
      <Icon />
      <div><b>{t.title}</b><span>{t.sub}</span></div>
    </button>
  )
}

function HomeTiles({ coachFirst, onGo }) {
  const tiles = homeTileDefs(coachFirst).filter((t) => t.show)
  const [open, setOpen] = useState('')
  if (!THEME.features?.groupedHome) {
    return <div className="tiles">{tiles.map((t) => <HomeTile key={t.id} t={t} onGo={onGo} />)}</div>
  }
  return (
    <>
      {HOME_GROUPS.map((g) => {
        const group = tiles.filter((t) => t.group === g)
        if (!group.length) return null
        const isOpen = open === g
        return (
          <div className="tile-group" key={g}>
            <button type="button" className="tile-group-title" onClick={() => setOpen(isOpen ? '' : g)}>
              {HOME_GROUP_LABELS[g] || g}
              <span className={'tile-group-chev' + (isOpen ? ' open' : '')}>▾</span>
            </button>
            {isOpen && <div className="tiles">{group.map((t) => <HomeTile key={t.id} t={t} onGo={onGo} />)}</div>}
          </div>
        )
      })}
    </>
  )
}

function TargetEditor({ targets, onSave }) {
  const [v, setV] = useState({ ...targets })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: Number(e.target.value) || 0 }))
  return (
    <div className="card">
      <div className="grid-2">
        <label className="field">Calories<input type="number" value={v.calories} onChange={set('calories')} /></label>
        <label className="field">Protein (g)<input type="number" value={v.protein_g} onChange={set('protein_g')} /></label>
        <label className="field">Carbs (g)<input type="number" value={v.carbs_g} onChange={set('carbs_g')} /></label>
        <label className="field">Fat (g)<input type="number" value={v.fat_g} onChange={set('fat_g')} /></label>
      </div>
      <button className="btn primary" onClick={() => onSave(v)}>Save targets</button>
    </div>
  )
}

/* ---------- Daily agenda ("Today's plan") ---------- */
function AgendaItem({ done, label, sub, children }) {
  return (
    <div className={'agenda-item' + (done ? ' done' : '')}>
      <span className="agenda-dot" aria-hidden="true" />
      <div className="agenda-body"><b>{label}</b><span>{sub}</span></div>
      {children && <div className="agenda-action">{children}</div>}
    </div>
  )
}

// A recurring client task (check-in / measurements / weight / photos) is due today
// when the weekday matches and the cadence lands on this week or month.
function taskDueToday(task, date = new Date()) {
  if (date.getDay() !== task.dow) return false
  if (task.cadence === 'monthly') return date.getDate() <= 7 // first matching weekday of the month
  if (task.cadence === 'fortnightly') {
    const wk = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2024, 0, 1)) / (7 * 86400000))
    return wk % 2 === 0
  }
  return true // weekly
}
const TASK_META = {
  measurements: { label: 'Take your measurements', go: 'body' },
  weight: { label: 'Log your weight', go: 'body' },
  photos: { label: 'Add progress photos', go: 'body' },
  payment: { label: 'Membership payment due', go: null },
}
function AgendaCard({ profile, coachName, foodLoggedToday, workoutTick, events, onGo }) {
  const coach = coachName?.split(' ')[0] || 'your coach'
  // One client-side date basis for the whole card (matches AccountabilityCard).
  const today = new Date().toISOString().slice(0, 10)
  const target = profile.step_target || 10000
  const [steps, setSteps] = useState(null)
  const [stepInput, setStepInput] = useState('')
  const [savingSteps, setSavingSteps] = useState(false)
  const [trainedToday, setTrainedToday] = useState(false)
  const [marking, setMarking] = useState(false)
  const [lastCheckin, setLastCheckin] = useState(undefined)
  const [todaySession, setTodaySession] = useState(null) // scheduled session for today (6C)
  const [scheduledPlan, setScheduledPlan] = useState(null) // client self-scheduled a library session for today
  const [programToday, setProgramToday] = useState(null)   // today's session from an assigned multi-week programme
  const [reminders, setReminders] = useState([])         // coach's custom reminders
  const [remDone, setRemDone] = useState(() => new Set())
  const [tasks, setTasks] = useState([])                 // coach-scheduled recurring tasks

  async function load() {
    const dow = new Date().getDay()
    const [{ data: ds }, { data: comps }, { data: ci }, { data: sc }, { data: rem }, { data: rd }, { data: ct }, { data: sp }] = await Promise.all([
      supabase.from('daily_steps').select('*').eq('client_id', profile.id).eq('day', today).maybeSingle(),
      supabase.from('workout_completions').select('id').eq('client_id', profile.id).eq('completed_on', today),
      supabase.from(THEME.features?.checkinForms ? 'checkin_responses' : 'weekly_checkins').select('created_at').eq('client_id', profile.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('client_schedule').select('template_id').eq('client_id', profile.id).eq('dow', dow).maybeSingle(),
      supabase.from('client_reminders').select('*').eq('client_id', profile.id).order('at_time', { ascending: true }),
      supabase.from('reminder_done').select('reminder_id').eq('client_id', profile.id).eq('done_on', today),
      supabase.from('client_tasks').select('kind, dow, cadence').eq('client_id', profile.id),
      supabase.from('workout_plans').select('id, title').eq('client_id', profile.id).eq('scheduled_for', today).order('created_at', { ascending: false }).limit(1),
    ])
    setScheduledPlan((sp && sp[0]) || null)

    // Active multi-week programme → compute which session lands today (advances by
    // week from the start date; wraps if set to repeat).
    let progToday = null
    const { data: cp } = await supabase.from('client_programs')
      .select('program_id, start_date, repeat, workout_programs(title)')
      .eq('client_id', profile.id).eq('active', true).order('created_at', { ascending: false }).limit(1)
    if (cp && cp[0]) {
      const asg = cp[0]
      const { data: psess } = await supabase.from('program_sessions').select('week, dow, title, focus, exercises, finisher').eq('program_id', asg.program_id)
      const list = psess || []
      const cycleWeeks = list.reduce((mx, s) => Math.max(mx, s.week || 1), 1)
      const startMid = new Date(asg.start_date + 'T00:00:00')
      const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
      const diffDays = Math.floor((todayMid - startMid) / 86400000)
      if (diffDays >= 0) {
        let weekNum = Math.floor(diffDays / 7) + 1
        if (weekNum > cycleWeeks) weekNum = asg.repeat ? ((weekNum - 1) % cycleWeeks) + 1 : null
        if (weekNum) {
          const sess = list.find((s) => (s.week || 1) === weekNum && s.dow === new Date().getDay())
          if (sess) progToday = { sess, weekNum, title: asg.workout_programs?.title || 'Your program' }
        }
      }
    }
    setProgramToday(progToday)
    setSteps(ds || null); if (ds && ds.steps != null) setStepInput(String(ds.steps))
    setTrainedToday((comps || []).length > 0)
    setLastCheckin(ci && ci[0] ? ci[0].created_at : null)
    setReminders(rem || [])
    setRemDone(new Set((rd || []).map((x) => x.reminder_id)))
    setTasks(ct || [])
    if (sc?.template_id) {
      const { data: tpl } = await supabase.from('workout_templates').select('*').eq('id', sc.template_id).maybeSingle()
      setTodaySession(tpl || null)
    } else setTodaySession(null)
  }
  useEffect(() => { load() }, [foodLoggedToday, workoutTick])

  async function startTodaySession() {
    // Prefer the assigned programme's session for today, else the weekly-scheduled template.
    const src = programToday?.sess || todaySession
    if (!src) { onGo(THEME.nav ? 'trainhub' : 'train'); return }
    await supabase.from('workout_plans').insert({
      client_id: profile.id, title: src.title, focus: src.focus || 'Session',
      exercises: src.exercises || [], finisher: src.finisher || null, assigned_by: null,
    })
    onGo('train')
  }

  async function doReminder(r) {
    setRemDone((s) => new Set(s).add(r.id))
    await supabase.from('reminder_done').upsert({ reminder_id: r.id, client_id: profile.id, done_on: today }, { onConflict: 'reminder_id,done_on' })
    if (r.kind === 'reply' || r.kind === 'evidence') onGo('ask') // open the coach chat
  }

  async function saveSteps() {
    const n = Math.max(0, parseInt(stepInput, 10) || 0)
    setSavingSteps(true)
    const { data } = await supabase.from('daily_steps')
      .upsert({ client_id: profile.id, day: today, steps: n, updated_at: new Date().toISOString() }, { onConflict: 'client_id,day' })
      .select().single()
    if (data) setSteps(data)
    setSavingSteps(false)
  }
  async function markTrained() {
    setMarking(true)
    const { error } = await supabase.from('workout_completions').insert({ client_id: profile.id, source: 'agenda' })
    if (!error) setTrainedToday(true)
    setMarking(false)
  }

  const stepsVal = steps?.steps || 0
  const checkedInToday = lastCheckin ? lastCheckin.slice(0, 10) === today : false
  const daysSince = lastCheckin ? (Date.now() - new Date(lastCheckin).getTime()) / 86400000 : 999
  // If the coach scheduled the check-in onto a day, honour that; else weekly/Monday default.
  const checkinTask = tasks.find((t) => t.kind === 'checkin')
  const checkinDue = checkinTask ? taskDueToday(checkinTask) : (new Date().getDay() === 1 || daysSince >= 7)
  // Holiday mode: while a client is away, pause accountability prompts (check-in,
  // measurements, weight, photos) but keep payment reminders — money's still due.
  const onHoliday = activeHoliday(events)
  const showCheckin = !onHoliday && lastCheckin !== undefined && (checkedInToday || checkinDue)
  const dueTasks = tasks.filter((t) => t.kind !== 'checkin' && taskDueToday(t) && !(onHoliday && t.kind !== 'payment'))
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="card agenda-card">
      <div className="agenda-head">
        <b>Today’s plan</b>
        <span className="muted-note">{dateLabel}</span>
      </div>
      <div className="agenda-list">
        <AgendaItem done={foodLoggedToday} label="Log your food" sub={foodLoggedToday ? 'Logged for today' : 'Keep your calories on track'}>
          {!foodLoggedToday && <button className="btn ghost sm" onClick={() => onGo(THEME.nav ? 'nutrition' : 'meal')}>Log</button>}
        </AgendaItem>

        <AgendaItem done={stepsVal >= target} label={`Steps · ${stepsVal.toLocaleString()} / ${target.toLocaleString()}`} sub={stepsVal >= target ? 'Target hit — nice one' : 'Log your step count'}>
          <span className="agenda-steps">
            <input inputMode="numeric" placeholder="steps" value={stepInput} onChange={(e) => setStepInput(e.target.value)} />
            <button className="btn ghost sm" disabled={savingSteps} onClick={saveSteps}>{savingSteps ? '…' : 'Save'}</button>
          </span>
        </AgendaItem>

        <AgendaItem
          done={trainedToday}
          label={!trainedToday && (programToday || todaySession || scheduledPlan) ? `Today: ${(programToday?.sess || todaySession || scheduledPlan).title}` : 'Train'}
          sub={trainedToday ? 'Session done — great work'
            : programToday ? `Week ${programToday.weekNum} · ${programToday.title}`
            : (todaySession || scheduledPlan) ? 'Your planned session is ready'
            : 'Rest day — add a session if you fancy it'}
        >
          {!trainedToday && (
            <span className="agenda-steps">
              <button className="btn primary sm" onClick={(programToday || todaySession) ? startTodaySession : () => onGo(THEME.nav ? 'trainhub' : 'train')}>Start</button>
              <button className="btn ghost sm" disabled={marking} onClick={markTrained}>Done</button>
            </span>
          )}
        </AgendaItem>

        {showCheckin && (
          <AgendaItem done={checkedInToday} label="Weekly check-in" sub={checkedInToday ? 'Sent — nice one' : `Send ${coach} how your week went`}>
            {!checkedInToday && <button className="btn ghost sm" onClick={() => onGo('checkin')}>Open</button>}
          </AgendaItem>
        )}

        {dueTasks.map((t) => {
          const meta = TASK_META[t.kind]
          return meta ? (
            <AgendaItem key={t.kind} label={meta.label} sub={`From ${coach} · due today`}>
              {meta.go && <button className="btn ghost sm" onClick={() => onGo(meta.go)}>Open</button>}
            </AgendaItem>
          ) : null
        })}

        {reminders.map((r) => {
          const done = remDone.has(r.id)
          const cta = r.kind === 'evidence' ? 'Send' : r.kind === 'reply' ? 'Reply' : 'Done'
          return (
            <AgendaItem key={r.id} done={done} label={r.message} sub={done ? 'Done — nice one' : `From ${coach} · ${(r.at_time || '').slice(0, 5)}`}>
              {!done && <button className="btn ghost sm" onClick={() => doReminder(r)}>{cta}</button>}
            </AgendaItem>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Accountability bot ---------- */
function AccountabilityCard({ clientId, coachName, foodLoggedToday, workoutTick, onGo }) {
  const [settings, setSettings] = useState(null)
  const [trainedToday, setTrainedToday] = useState(false)
  const [marking, setMarking] = useState(false)
  const coach = coachName?.split(' ')[0] || 'Kim'

  async function load() {
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: s }, { data: comps }] = await Promise.all([
      supabase.from('accountability_settings').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('workout_completions').select('id').eq('client_id', clientId).eq('completed_on', today),
    ])
    setSettings(s || { level: 2, food_nudges: true, workout_nudges: true })
    setTrainedToday((comps || []).length > 0)
  }
  useEffect(() => { load() }, [foodLoggedToday, workoutTick])

  async function markTrained() {
    setMarking(true)
    const { error } = await supabase.from('workout_completions').insert({ client_id: clientId, source: 'nudge' })
    if (!error) setTrainedToday(true)
    setMarking(false)
  }

  if (!settings) return null
  const level = settings.level || 2
  const seed = daySeed()
  const showFood = settings.food_nudges && !foodLoggedToday
  const showWorkout = settings.workout_nudges && !trainedToday

  return (
    <div className={'card nudge-card lvl-' + level}>
      <div className="nudge-head">
        <b>{coach}’s check-in</b>
        <button className="link-btn inline" onClick={() => onGo('nudges')}>Level {level} · adjust</button>
      </div>
      {!showFood && !showWorkout && (
        <p className="nudge-msg done">Food logged and trained — you’re smashing it today. Proud of you.</p>
      )}
      {showFood && (
        <div className="nudge-row">
          <p className="nudge-msg">{pickNudge(FOOD_NUDGES, level, seed)}</p>
          <button className="btn primary sm" onClick={() => onGo('meal')}>Log a meal</button>
        </div>
      )}
      {showWorkout && (
        <div className="nudge-row">
          <p className="nudge-msg">{pickNudge(WORKOUT_NUDGES, level, seed + 1)}</p>
          <div className="nudge-actions">
            <button className="btn primary sm" onClick={() => onGo('train')}>Start a workout</button>
            <button className="btn ghost sm" disabled={marking} onClick={markTrained}>I trained today</button>
          </div>
        </div>
      )}
    </div>
  )
}

function NudgeSettings({ clientId, onBack }) {
  const [settings, setSettings] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    supabase.from('accountability_settings').select('*').eq('client_id', clientId).maybeSingle()
      .then(({ data }) => setSettings(data || { level: 2, food_nudges: true, workout_nudges: true }))
  }, [])
  async function save(next) {
    setSettings(next)
    await supabase.from('accountability_settings').upsert({ client_id: clientId, ...next, updated_at: new Date().toISOString() })
    setSaved(true); setTimeout(() => setSaved(false), 1200)
  }
  if (!settings) return <p className="muted-note">Loading…</p>
  const level = settings.level || 2
  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Accountability</p>
      <h1 className="h1">How hard should I push you?</h1>
      <p className="lead">Pick the tone that keeps you on track. Change it any time — and your coach can nudge it too.</p>
      <div className="level-picker">
        {LEVELS.map((l) => (
          <button key={l.n} type="button" className={'level-opt' + (level === l.n ? ' on' : '')} onClick={() => save({ ...settings, level: l.n })}>
            <div className="level-n">{l.n}</div>
            <div className="level-body"><b>{l.label}</b><span>{l.blurb}</span></div>
          </button>
        ))}
      </div>
      <div className="card">
        <p className="eyebrow">Preview — level {level}</p>
        <p className="nudge-msg">{pickNudge(FOOD_NUDGES, level, daySeed())}</p>
        <p className="nudge-msg">{pickNudge(WORKOUT_NUDGES, level, daySeed() + 1)}</p>
      </div>
      <div className="card">
        <label className="toggle-row"><span>Food reminders</span><input type="checkbox" checked={settings.food_nudges} onChange={(e) => save({ ...settings, food_nudges: e.target.checked })} /></label>
        <label className="toggle-row"><span>Workout reminders</span><input type="checkbox" checked={settings.workout_nudges} onChange={(e) => save({ ...settings, workout_nudges: e.target.checked })} /></label>
        <label className="toggle-row"><span>Daily reminder</span><input type="checkbox" checked={!!settings.daily_reminder} onChange={(e) => save({ ...settings, daily_reminder: e.target.checked })} /></label>
        {settings.daily_reminder && (
          <label className="field" style={{ marginTop: 8 }}>What time?
            <input type="time" value={(settings.reminder_time || '18:00').slice(0, 5)} onChange={(e) => save({ ...settings, reminder_time: e.target.value })} />
          </label>
        )}
      </div>
      {saved && <p className="logged-ok">Saved ✓</p>}

      <PushReminders clientId={clientId} />
    </div>
  )
}

function PushReminders({ clientId }) {
  const [status, setStatus] = useState('checking') // checking | unsupported | denied | off | on
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function refresh() { setStatus(await pushStatus()) }
  useEffect(() => { if (pushSupported()) refresh(); else setStatus('unsupported') }, [])

  async function turnOn() {
    setBusy(true); setErr(''); setMsg('')
    try { await enablePush(clientId); await refresh(); setMsg('Phone reminders are on.') }
    catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }
  async function turnOff() {
    setBusy(true); setErr(''); setMsg('')
    try { await disablePush(); await refresh(); setMsg('Phone reminders turned off.') }
    catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }
  async function test() {
    setBusy(true); setErr(''); setMsg('')
    try { await sendTestPush(); setMsg('Test sent — check your notifications.') }
    catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  const needsInstall = isIOS() && !isStandalone()
  return (
    <div className="card">
      <p className="eyebrow">Phone reminders</p>
      <p className="muted-note">Get nudged even when the app is closed — a morning food reminder and an evening workout reminder, in the tone you picked.</p>
      {status === 'checking' && <p className="muted-note">Checking…</p>}
      {status === 'unsupported' && <p className="muted-note">This browser can’t do phone reminders. Try Chrome on Android, or add the app to your Home Screen.</p>}
      {needsInstall && status !== 'unsupported' && (
        <p className="disclaimer-note">On iPhone: tap Share → “Add to Home Screen”, open the app from there, then turn reminders on.</p>
      )}
      {status === 'denied' && <p className="error">Notifications are blocked. Turn them on for this site in your browser settings, then come back.</p>}
      {status === 'off' && <button className="btn primary big" disabled={busy} onClick={turnOn}>{busy ? 'Turning on…' : 'Turn on phone reminders'}</button>}
      {status === 'on' && (
        <div className="stack">
          <p className="logged-ok">Reminders are on ✓</p>
          <div className="nudge-actions">
            <button className="btn primary sm" disabled={busy} onClick={test}>Send me a test</button>
            <button className="btn ghost sm" disabled={busy} onClick={turnOff}>Turn off</button>
          </div>
        </div>
      )}
      {msg && <p className="logged-ok">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  )
}

/* ---------- Weekly check-in ---------- */
function ScaleRow({ label, value, onChange }) {
  return (
    <div className="scale-row">
      <span className="scale-label">{label}</span>
      <div className="scale-btns">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={'scale-btn' + (value === n ? ' on' : '')} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
    </div>
  )
}

function CheckinCard({ c, coach }) {
  return (
    <div className="card">
      <p className="eyebrow accent">Check-in · {(c.created_at || '').slice(0, 10)}</p>
      <div className="checkin-scores">
        <span>Energy {c.energy}</span><span>Sleep {c.sleep}</span><span>Nutrition {c.nutrition}</span><span>Training {c.training}</span>
        {c.weight_kg != null && <span>{c.weight_kg}kg</span>}
      </div>
      {c.wins && <p className="checkin-line"><b>Wins:</b> {c.wins}</p>}
      {c.struggles && <p className="checkin-line"><b>Struggles:</b> {c.struggles}</p>}
      {c.question && <p className="checkin-line"><b>Asked:</b> {c.question}</p>}
      {c.coach_reply
        ? <div className="fc-block coach"><b>From {coach}</b><p>{c.coach_reply}</p></div>
        : <p className="muted-note">Waiting for {coach}’s reply.</p>}
    </div>
  )
}

function WeeklyCheckin({ clientId, coachName, onBack }) {
  const coach = coachName?.split(' ')[0] || 'Kim'
  const [energy, setEnergy] = useState(3)
  const [sleep, setSleep] = useState(3)
  const [nutrition, setNutrition] = useState(3)
  const [training, setTraining] = useState(3)
  const [weight, setWeight] = useState('')
  const [wins, setWins] = useState('')
  const [struggles, setStruggles] = useState('')
  const [question, setQuestion] = useState('')
  const [state, setState] = useState('idle') // idle | saving | done
  const [past, setPast] = useState([])

  async function load() {
    const { data } = await supabase.from('weekly_checkins').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(6)
    setPast(data || [])
  }
  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    setState('saving')
    const row = { client_id: clientId, energy, sleep, nutrition, training, weight_kg: weight ? Number(weight) : null, wins: wins.trim() || null, struggles: struggles.trim() || null, question: question.trim() || null }
    const { data } = await supabase.from('weekly_checkins').insert(row).select().single()
    if (data) setPast((p) => [data, ...p])
    setWins(''); setStruggles(''); setQuestion(''); setWeight('')
    setState('done')
  }

  if (state === 'done') {
    return (
      <div className="stack">
        <button className="link-btn" onClick={onBack}>‹ Back</button>
        <p className="logged-ok big">Sent to {coach} ✓</p>
        <p className="lead">Thanks for checking in. {coach} will read this and come back to you.</p>
        <button className="btn ghost" onClick={() => setState('idle')}>New check-in</button>
        {past.map((c) => <CheckinCard key={c.id} c={c} coach={coach} />)}
      </div>
    )
  }
  return (
    <form className="stack" onSubmit={submit}>
      <button type="button" className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Weekly check-in</p>
      <h1 className="h1">How was your week?</h1>
      <p className="lead">A quick snapshot for {coach} — rate each from 1 (tough) to 5 (great).</p>
      <div className="card">
        <ScaleRow label="Energy" value={energy} onChange={setEnergy} />
        <ScaleRow label="Sleep" value={sleep} onChange={setSleep} />
        <ScaleRow label="Nutrition" value={nutrition} onChange={setNutrition} />
        <ScaleRow label="Training" value={training} onChange={setTraining} />
        <label className="field">Weight this week (kg, optional)<input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
      </div>
      <label className="field">Wins this week<textarea value={wins} onChange={(e) => setWins(e.target.value)} placeholder="What went well?" /></label>
      <label className="field">Struggles<textarea value={struggles} onChange={(e) => setStruggles(e.target.value)} placeholder="What was hard?" /></label>
      <label className="field">Anything to ask {coach}?<textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Questions, worries, wins to celebrate…" /></label>
      <button className="btn primary big" disabled={state === 'saving'} type="submit">{state === 'saving' ? 'Sending…' : `Send to ${coach}`}</button>
      {past.length > 0 && <p className="eyebrow section-gap">Past check-ins</p>}
      {past.map((c) => <CheckinCard key={c.id} c={c} coach={coach} />)}
    </form>
  )
}

/* ---------- Dynamic check-in (coach-built forms) ---------- */
function Scale10Row({ label, value, onChange }) {
  return (
    <div className="field">
      <span className="scale-label">{label}</span>
      <div className="scale10-btns">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={'scale10-btn' + (value === n ? ' on' : '')} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
    </div>
  )
}

function FieldInput({ field, value, onChange }) {
  if (field.type === 'scale10') return <Scale10Row label={field.label} value={value} onChange={onChange} />
  if (field.type === 'overunder') return (
    <div className="field">
      <span className="scale-label">{field.label}</span>
      <div className="seg three" style={{ marginTop: 6 }}>
        {[['over', 'Over'], ['on', 'On track'], ['under', 'Under']].map(([v, l]) => (
          <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
        ))}
      </div>
    </div>
  )
  if (field.type === 'yesno') return (
    <div className="field">
      <span className="scale-label">{field.label}</span>
      <div className="seg" style={{ marginTop: 6 }}>
        <button type="button" className={value === true ? 'on' : ''} onClick={() => onChange(true)}>Yes</button>
        <button type="button" className={value === false ? 'on' : ''} onClick={() => onChange(false)}>No</button>
      </div>
    </div>
  )
  if (field.type === 'number') return (
    <label className="field">{field.label}<input type="number" inputMode="numeric" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} /></label>
  )
  return <label className="field">{field.label}<textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></label>
}

// Renders a past response against its OWN snapshot of the fields, so later form
// edits never change how an old check-in reads.
function ResponseCard({ resp, coach }) {
  const fields = resp.fields || []
  return (
    <div className="card">
      <p className="eyebrow accent">Check-in · {(resp.created_at || '').slice(0, 10)}</p>
      <div className="stack" style={{ gap: 6 }}>
        {fields.map((f) => <p className="checkin-line" key={f.id}><b>{f.label}:</b> {formatAnswer(f, resp.answers?.[f.id])}</p>)}
      </div>
      {resp.coach_reply
        ? <div className="fc-block coach"><b>From {coach}</b><p>{resp.coach_reply}</p></div>
        : <p className="muted-note">Waiting for {coach}’s reply.</p>}
    </div>
  )
}

function CheckinFormRun({ clientId, trainerId, coachName, onBack }) {
  const coach = coachName?.split(' ')[0] || 'your coach'
  const [form, setForm] = useState(undefined) // undefined = loading, null = none set up
  const [answers, setAnswers] = useState({})
  const [past, setPast] = useState([])
  const [state, setState] = useState('idle')

  async function load() {
    const [{ data: forms }, { data: resps }] = await Promise.all([
      supabase.from('checkin_forms').select('*').order('created_at', { ascending: false }).limit(1),
      supabase.from('checkin_responses').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(8),
    ])
    setForm(forms && forms[0] ? forms[0] : null)
    setPast(resps || [])
  }
  useEffect(() => { load() }, [])

  const setAnswer = (id, v) => setAnswers((a) => ({ ...a, [id]: v }))

  async function submit(e) {
    e.preventDefault()
    setState('saving')
    const { data } = await supabase.from('checkin_responses').insert({
      form_id: form.id, coach_id: trainerId, client_id: clientId, answers, fields: form.fields || [],
    }).select().single()
    if (data) setPast((p) => [data, ...p])
    setAnswers({})
    setState('done')
  }

  if (form === undefined) return <div className="stack"><button className="link-btn" onClick={onBack}>‹ Back</button><p className="muted-note">Loading…</p></div>
  if (form === null) {
    return (
      <div className="stack">
        <button className="link-btn" onClick={onBack}>‹ Back</button>
        <p className="eyebrow">Weekly check-in</p>
        <h1 className="h1">Check-in</h1>
        <p className="muted-note">{coach} hasn’t set up your check-in yet — it’ll appear here soon.</p>
        {past.map((r) => <ResponseCard key={r.id} resp={r} coach={coach} />)}
      </div>
    )
  }
  if (state === 'done') {
    return (
      <div className="stack">
        <button className="link-btn" onClick={onBack}>‹ Back</button>
        <p className="logged-ok big">Sent to {coach} ✓</p>
        <p className="lead">Thanks for checking in. {coach} will read this and come back to you.</p>
        <button className="btn ghost" onClick={() => setState('idle')}>New check-in</button>
        {past.map((r) => <ResponseCard key={r.id} resp={r} coach={coach} />)}
      </div>
    )
  }
  return (
    <form className="stack" onSubmit={submit}>
      <button type="button" className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Weekly check-in</p>
      <h1 className="h1">{form.title || 'How was your week?'}</h1>
      <p className="lead">A quick snapshot for {coach}.</p>
      <div className="card">
        {(form.fields || []).map((f) => <FieldInput key={f.id} field={f} value={answers[f.id]} onChange={(v) => setAnswer(f.id, v)} />)}
      </div>
      <button className="btn primary big" disabled={state === 'saving'} type="submit">{state === 'saving' ? 'Sending…' : `Send to ${coach}`}</button>
      {past.length > 0 && <p className="eyebrow section-gap">Past check-ins</p>}
      {past.map((r) => <ResponseCard key={r.id} resp={r} coach={coach} />)}
    </form>
  )
}

/* ---------- Performance testing ---------- */
function Testing({ clientId, onBack }) {
  const [rows, setRows] = useState([])
  const [testKey, setTestKey] = useState(PERF_TESTS[0].key)
  const [value, setValue] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [pb, setPb] = useState(false)

  async function load() {
    const { data } = await supabase.from('performance_tests').select('*').eq('client_id', clientId).order('tested_on', { ascending: true })
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault()
    const v = Number(value)
    if (!v) return
    setSaving(true); setPb(false)
    const t = TEST_BY_KEY[testKey]
    const prior = rows.filter((r) => r.test_key === testKey)
    const isPb = prior.length === 0 || (t.lowerBetter ? v < bestValue(prior, true) : v > bestValue(prior, false))
    const row = { client_id: clientId, test_key: testKey, value: v, tested_on: date || undefined, note: note.trim() || null }
    const { data } = await supabase.from('performance_tests').insert(row).select().single()
    setSaving(false)
    if (data) {
      setRows((r) => [...r, data].sort((a, b) => (a.tested_on || '').localeCompare(b.tested_on || '')))
      setValue(''); setNote('')
      if (isPb) { setPb(true); setTimeout(() => setPb(false), 4000) }
    }
  }

  const byTest = {}
  rows.forEach((r) => { (byTest[r.test_key] = byTest[r.test_key] || []).push(r) })
  const testedKeys = Object.keys(byTest)

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Performance testing</p>
      <h1 className="h1">Your numbers.</h1>
      <p className="lead">Log your test results and watch your PBs climb.</p>

      <form className="card" onSubmit={save}>
        <p className="eyebrow">Log a result</p>
        <label className="field">Test
          <select value={testKey} onChange={(e) => setTestKey(e.target.value)}>
            {Object.entries(TEST_GROUPS).map(([g, tests]) => (
              <optgroup key={g} label={g}>
                {tests.map((t) => <option key={t.key} value={t.key}>{t.name} ({t.unit})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="grid-2">
          <label className="field">Result ({TEST_BY_KEY[testKey].unit})<input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></label>
          <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <label className="field">Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Conditions, kit, how it felt…" /></label>
        <button className="btn primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Log result'}</button>
        {pb && <p className="logged-ok big">New personal best!</p>}
      </form>

      {testedKeys.length === 0 && <p className="muted-note">No results logged yet. Add your first above.</p>}
      {testedKeys.map((k) => <TestResultCard key={k} testKey={k} rows={byTest[k]} />)}
    </div>
  )
}

function TestResultCard({ testKey, rows }) {
  const t = TEST_BY_KEY[testKey]
  if (!t) return null
  const sorted = [...rows].sort((a, b) => (a.tested_on || '').localeCompare(b.tested_on || ''))
  const latest = sorted[sorted.length - 1]
  const first = sorted[0]
  const best = bestValue(rows, t.lowerBetter)
  const latestIsBest = Number(latest.value) === best
  const delta = Number(latest.value) - Number(first.value)
  const improved = t.lowerBetter ? delta < 0 : delta > 0
  const deltaStr = sorted.length > 1 ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}${t.unit}` : ''
  return (
    <div className="card">
      <div className="test-head">
        <div>
          <p className="eyebrow accent">{t.group}</p>
          <div className="test-name">{t.name}</div>
        </div>
        <div className="test-val">
          <b>{Number(latest.value)}</b><span>{t.unit}</span>
          {latestIsBest && <span className="pb-badge">PB</span>}
        </div>
      </div>
      <p className="test-meta">Best {best}{t.unit}{deltaStr && <span className={improved ? 'delta good' : 'delta'}> · {deltaStr} since first</span>}</p>
      <TrendChart data={sorted} field="value" />
    </div>
  )
}

/* ---------- Growth tracker (youth) ---------- */
function Growth({ clientId, onBack }) {
  const [yp, setYp] = useState(null)
  const [meas, setMeas] = useState([])
  const [dob, setDob] = useState('')
  const [sex, setSex] = useState('M')
  const [h, setH] = useState(''); const [sh, setSh] = useState(''); const [wt, setWt] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function load() {
    const [{ data: p }, { data: gm }] = await Promise.all([
      supabase.from('youth_profiles').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('growth_measurements').select('*').eq('client_id', clientId).order('measured_on', { ascending: true }),
    ])
    setYp(p || null); if (p) { setDob(p.dob || ''); setSex(p.sex || 'M') }
    setMeas(gm || [])
  }
  useEffect(() => { load() }, [])

  async function saveProfile() {
    if (!dob) return
    const { data } = await supabase.from('youth_profiles').upsert({ client_id: clientId, dob, sex, updated_at: new Date().toISOString() }).select().single()
    if (data) setYp(data)
  }
  async function saveMeasurement() {
    if (!h) return
    setSaving(true)
    const { data } = await supabase.from('growth_measurements').insert({ client_id: clientId, height_cm: Number(h) || null, sitting_height_cm: Number(sh) || null, weight_kg: Number(wt) || null }).select().single()
    setSaving(false)
    if (data) { setMeas((m) => [...m, data]); setH(''); setSh(''); setWt(''); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }

  const latest = meas[meas.length - 1]
  const age = yp?.dob && latest ? ageYears(yp.dob, latest.measured_on) : null
  const offset = (yp?.dob && latest) ? maturityOffset({ sex: yp.sex, age, height: latest.height_cm, sittingHeight: latest.sitting_height_cm, weight: latest.weight_kg }) : null
  const phase = maturityPhase(offset)
  const velocity = growthVelocity(meas)

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Growth tracker</p>
      <h1 className="h1">Growing strong.</h1>

      {!yp?.dob && (
        <div className="card">
          <p className="eyebrow">Set up</p>
          <p className="muted-note">Add your date of birth and sex so we can track your growth and maturation.</p>
          <div className="grid-2">
            <label className="field">Date of birth<input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></label>
            <label className="field">Sex<select value={sex} onChange={(e) => setSex(e.target.value)}><option value="M">Male</option><option value="F">Female</option></select></label>
          </div>
          <button className="btn primary" onClick={saveProfile}>Save</button>
        </div>
      )}

      {offset != null && (
        <div className="card">
          <p className="eyebrow">Your maturation</p>
          <div className="rd-status">
            <span className={'rd-light ' + phase.color} />
            <div><b>{phase.label}</b><span className="muted-note"> · {offset > 0 ? '+' : ''}{offset.toFixed(1)} yrs from your growth peak</span></div>
          </div>
          {velocity != null && <p className="muted-note">Growing about {velocity.toFixed(1)} cm/year.{velocity > 7 ? ' That’s a fast phase — listen to your body and tell your coach about any aches.' : ''}</p>}
          <TrendChart data={meas.filter((m) => m.height_cm > 0)} field="height_cm" />
          <p className="checkin-line">{growthGuidance(phase.key)}</p>
        </div>
      )}

      <div className="card">
        <p className="eyebrow">Log a measurement</p>
        <div className="grid-2">
          <label className="field">Height (cm)<input type="number" step="0.1" value={h} onChange={(e) => setH(e.target.value)} /></label>
          <label className="field">Sitting height (cm)<input type="number" step="0.1" value={sh} onChange={(e) => setSh(e.target.value)} /></label>
          <label className="field">Weight (kg)<input type="number" step="0.1" value={wt} onChange={(e) => setWt(e.target.value)} /></label>
        </div>
        <button className="btn primary" disabled={saving} onClick={saveMeasurement}>{saving ? 'Saving…' : 'Save measurement'}</button>
        {saved && <p className="logged-ok">Saved ✓</p>}
        <p className="disclaimer-note">This is a guide to help plan your training, not a medical assessment.</p>
      </div>
    </div>
  )
}

/* ---------- Readiness & load monitoring ---------- */
function Monitoring({ clientId, onBack }) {
  const [checkins, setCheckins] = useState([])
  const [loads, setLoads] = useState([])
  const [soreness, setSoreness] = useState([])
  const [tab, setTab] = useState('status')
  const [w, setW] = useState({ sleep: 3, energy: 3, freshness: 3, mood: 3, motivation: 3 })
  const [savingC, setSavingC] = useState(false)
  const [savedC, setSavedC] = useState(false)
  const [rpe, setRpe] = useState(6)
  const [dur, setDur] = useState('')
  const [savingS, setSavingS] = useState(false)
  const [savedS, setSavedS] = useState(false)

  async function load() {
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: c }, { data: l }, { data: sr }] = await Promise.all([
      supabase.from('readiness_checkins').select('*').eq('client_id', clientId).order('checked_on', { ascending: true }).limit(60),
      supabase.from('session_loads').select('*').eq('client_id', clientId).order('session_on', { ascending: true }).limit(120),
      supabase.from('soreness_logs').select('pain').eq('client_id', clientId).eq('logged_on', today),
    ])
    setCheckins(c || []); setLoads(l || []); setSoreness(sr || [])
  }
  useEffect(() => { load() }, [])

  async function saveCheckin() {
    setSavingC(true)
    const { data } = await supabase.from('readiness_checkins').insert({ client_id: clientId, ...w }).select().single()
    setSavingC(false)
    if (data) { setCheckins((x) => [...x, data]); setSavedC(true); setTimeout(() => { setSavedC(false); setTab('status') }, 1200) }
  }
  async function saveSession() {
    const d = Number(dur); if (!d) return
    setSavingS(true)
    const { data } = await supabase.from('session_loads').insert({ client_id: clientId, rpe: Number(rpe), duration_min: d, load: Number(rpe) * d }).select().single()
    setSavingS(false)
    if (data) { setLoads((x) => [...x, data]); setDur(''); setSavedS(true); setTimeout(() => { setSavedS(false); setTab('status') }, 1200) }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCheckin = checkins.filter((c) => c.checked_on === todayStr).slice(-1)[0]
  const score = readinessScore(todayCheckin)
  // Soreness (rehab layer) can only pull today's readiness light down.
  const light = combinedReadiness(readinessLight(todayCheckin ? score : null), soreness)
  const metrics = loadMetrics(loads)
  const flag = acwrFlag(metrics.acwr)
  const readinessTrend = checkins.map((c) => ({ score: readinessScore(c) })).filter((x) => x.score != null)
  const setWv = (k) => (v) => setW((s) => ({ ...s, [k]: v }))

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Readiness &amp; load</p>
      <h1 className="h1">How ready are you?</h1>
      <div className="seg three">
        <button type="button" className={tab === 'status' ? 'on' : ''} onClick={() => setTab('status')}>Status</button>
        <button type="button" className={tab === 'checkin' ? 'on' : ''} onClick={() => setTab('checkin')}>Check-in</button>
        <button type="button" className={tab === 'session' ? 'on' : ''} onClick={() => setTab('session')}>Log session</button>
      </div>

      {tab === 'status' && (
        <div className="stack">
          <div className="card">
            <p className="eyebrow">Today’s readiness</p>
            <div className="rd-status">
              <span className={'rd-light ' + light.color} />
              <div><b>{light.label}</b>{todayCheckin && score != null && <span className="muted-note"> · {score.toFixed(1)}/5</span>}</div>
            </div>
            {!todayCheckin && <p className="muted-note">No check-in yet today — tap Check-in.</p>}
            <TrendChart data={readinessTrend} field="score" />
            <p className="muted-note">Your readiness over time.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Training load</p>
            <div className="metrics-2">
              <Metric k="This week (AU)" v={metrics.acute} d="" />
              <Metric k="ACWR" v={metrics.acwr != null ? metrics.acwr.toFixed(2) : '—'} d="" />
            </div>
            <p className="rd-flag"><span className={'rd-light ' + flag.color} /> {flag.label}</p>
            <p className="muted-note">Acute:chronic workload ratio. Around 0.8–1.3 is the sweet spot; sharp spikes raise injury risk.</p>
          </div>
          {THEME.features?.vald && <ValdTests clientId={clientId} title="Your force & speed testing" />}
        </div>
      )}

      {tab === 'checkin' && (
        <div className="card">
          <p className="eyebrow">Morning check-in</p>
          <p className="muted-note">Rate each from 1 (worst) to 5 (best).</p>
          {WELLNESS.map((item) => <ScaleRow key={item.key} label={item.label} value={w[item.key]} onChange={setWv(item.key)} />)}
          <button className="btn primary" disabled={savingC} onClick={saveCheckin}>{savingC ? 'Saving…' : 'Save check-in'}</button>
          {savedC && <p className="logged-ok">Saved ✓</p>}
        </div>
      )}

      {tab === 'session' && (
        <div className="card">
          <p className="eyebrow">Log a session</p>
          <p className="muted-note">After training, rate how hard it felt and how long it lasted.</p>
          <label className="field">Effort — RPE (1 easy … 10 max)
            <select value={rpe} onChange={(e) => setRpe(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="field">Duration (minutes)<input type="number" value={dur} onChange={(e) => setDur(e.target.value)} /></label>
          {dur && <p className="muted-note">Session load: {Number(rpe) * Number(dur)} AU</p>}
          <button className="btn primary" disabled={savingS} onClick={saveSession}>{savingS ? 'Saving…' : 'Log session'}</button>
          {savedS && <p className="logged-ok">Logged ✓</p>}
        </div>
      )}
    </div>
  )
}

/* ---------- Nutrition Expert ---------- */
function NutritionExpert({ clientId, onBack }) {
  const [tab, setTab] = useState('ask')
  const [chats, setChats] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('expert_chats').select('*').eq('client_id', clientId).order('created_at', { ascending: true }).limit(50).then(({ data }) => setChats(data || []))
  }, [])

  async function ask() {
    const question = q.trim()
    if (!question || busy) return
    setBusy(true); setError('')
    const tempId = 'temp-' + Date.now()
    setChats((c) => [...c, { id: tempId, question, answer: null }])
    setQ('')
    try {
      const { answer } = await analyze({ mode: 'expert', question })
      const { data } = await supabase.from('expert_chats').insert({ client_id: clientId, question, answer }).select().single()
      setChats((c) => c.map((x) => (x.id === tempId ? (data || { id: tempId, question, answer }) : x)))
    } catch (err) {
      setError(err.message); setChats((c) => c.filter((x) => x.id !== tempId))
    } finally { setBusy(false) }
  }

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Nutrition Expert</p>
      <h1 className="h1">Fuel like a pro.</h1>
      <p className="lead">Evidence-based sports nutrition, grounded in the ISSN, IOC and ACSM guidelines.</p>
      <div className="seg">
        <button type="button" className={tab === 'ask' ? 'on' : ''} onClick={() => setTab('ask')}>Ask the expert</button>
        <button type="button" className={tab === 'lib' ? 'on' : ''} onClick={() => setTab('lib')}>Guidelines</button>
      </div>
      {tab === 'ask' ? (
        <>
          <div className="chat">
            {chats.length === 0 && <p className="muted-note">Try “How much protein and carbs should I have as a 78kg footballer?” or “What’s the evidence on creatine?”</p>}
            {chats.map((c) => (
              <div className="chat-pair" key={c.id}>
                <div className="bubble q">{c.question}</div>
                {c.answer === null
                  ? <div className="bubble a typing"><span className="spinner tiny" /> Checking the evidence…</div>
                  : <div className="bubble a">{c.answer}</div>}
              </div>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="ask-bar">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about fuelling, protein, supplements…" onKeyDown={(e) => { if (e.key === 'Enter') ask() }} />
            <button className="btn primary" disabled={busy || !q.trim()} onClick={ask}>Ask</button>
          </div>
          <p className="disclaimer-note">General nutrition education, not medical or individual dietetic advice. For personal plans, medical conditions or any worries about eating or energy, speak to your coach and a registered dietitian.</p>
        </>
      ) : (
        <div className="stack">
          {NUTRITION_AREAS.map((area) => (
            <div className="card" key={area}>
              <p className="eyebrow accent">{area}</p>
              {NUTRITION_KB.filter((k) => k.area === area).map((k) => (
                <div className="fc-block" key={k.id}><b>{k.title}</b><p>{k.content}</p><p className="muted-note">Evidence: {k.source}</p></div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Train ---------- */
function Train({ clientId, onWorkoutDone }) {
  const [tab, setTab] = useState(THEME.features?.templates ? 'start' : 'ai')
  const [history, setHistory] = useState([])

  async function loadHistory() {
    const { data } = await supabase.from('workout_plans').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(50)
    setHistory(data || [])
  }
  useEffect(() => { loadHistory() }, [])

  function onSaved(plan) {
    if (plan) setHistory((h) => [plan, ...h])
  }

  return (
    <div className="stack">
      <p className="eyebrow">Today’s session</p>
      <h1 className="h1">Train your way.</h1>

      <div className="seg">
        {THEME.features?.templates && <button type="button" className={tab === 'start' ? 'on' : ''} onClick={() => setTab('start')}>Start a workout</button>}
        <button type="button" className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')}>Generate with AI</button>
        <button type="button" className={tab === 'own' ? 'on' : ''} onClick={() => setTab('own')}>Build your own</button>
      </div>

      {tab === 'start' && <StartWorkout clientId={clientId} onStarted={onSaved} />}
      {tab === 'ai' && <AiPlan clientId={clientId} onSaved={onSaved} />}
      {tab === 'own' && <OwnPlan clientId={clientId} onSaved={onSaved} />}

      <LiftProgress plans={history} title="Weights lifted" />

      {history.length > 0 && (
        <div className="stack">
          <p className="eyebrow">Your sessions</p>
          {history.map((p) => <SessionCard key={p.id} plan={p} clientId={clientId} onWorkoutDone={onWorkoutDone} onUpdate={(u) => setHistory((h) => h.map((x) => (x.id === u.id ? u : x)))} />)}
        </div>
      )}
    </div>
  )
}

function AiPlan({ clientId, onSaved }) {
  const [goal, setGoal] = useState('Push')
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [equip, setEquip] = useState(null) // { data, preview } — optional photo of available kit
  const equipRef = useRef(null)

  async function pickEquip(e) {
    const file = e.target.files?.[0]; if (!file) return
    setError('')
    try { const data = await scaleImageToBase64(file, 1000); setEquip({ data, preview: URL.createObjectURL(file) }) }
    catch { setError('Could not read that photo — try another.') }
  }

  async function generate() {
    setState('loading'); setError('')
    try {
      const json = await analyze({ mode: 'workout', goal, equipment: THEME.equipment, gymName: THEME.trainGymName, ...(equip ? { image: equip.data, mediaType: 'image/jpeg' } : {}) })
      const { data } = await supabase.from('workout_plans').insert({
        client_id: clientId, title: json.title, focus: json.focus,
        exercises: json.exercises || [], finisher: json.finisher || null,
      }).select().single()
      onSaved(data)
      setState('done')
      setTimeout(() => setState('idle'), 2000)
    } catch (err) {
      setError(err.message); setState('error')
    }
  }

  return (
    <div className="stack">
      <p className="lead">Pick a focus and the AI writes a session using {equip ? 'the equipment in your photo' : `only the kit at ${THEME.trainGymName}`}.</p>
      <div className="focus-row">
        {FOCUS_OPTIONS.map((f) => (
          <button key={f} className={'focus-chip' + (goal === f ? ' on' : '')} onClick={() => setGoal(f)}>{f}</button>
        ))}
      </div>
      <input ref={equipRef} type="file" accept="image/*" capture="environment" hidden onChange={pickEquip} />
      {!equip
        ? <button type="button" className="btn ghost sm" onClick={() => equipRef.current?.click()}>Training somewhere else? Snap the equipment you’ve got</button>
        : <div className="stack"><div className="shot"><img src={equip.preview} alt="Your equipment" /></div><button type="button" className="link-btn inline" onClick={() => equipRef.current?.click()}>Retake</button>{' · '}<button type="button" className="link-btn inline" onClick={() => setEquip(null)}>Use my usual gym</button></div>}
      {state !== 'loading' && <button className="btn primary big" onClick={generate}>Generate a session</button>}
      {state === 'loading' && <Loader text="Writing your session…" />}
      {state === 'done' && <p className="logged-ok">Added to your sessions ✓</p>}
      {state === 'error' && <p className="error">{error}</p>}
      <p className="muted-note">Your saved sessions appear below — tap one to view it.</p>
    </div>
  )
}

function OwnPlan({ clientId, onSaved }) {
  const [title, setTitle] = useState('')
  const [focus, setFocus] = useState('')
  const [rows, setRows] = useState([newExerciseRow()])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const exercises = rowsToExercises(rows, 'Own choice')
    if (exercises.length === 0) { setError('Add at least one exercise with a set.'); return }
    setSaving(true); setError('')
    const { data } = await supabase.from('workout_plans').insert({
      client_id: clientId, title: title.trim() || 'My session', focus: focus.trim() || 'Custom', exercises, finisher: null,
    }).select().single()
    setSaving(false)
    if (data) {
      onSaved(data)
      setSaved(true)
      setTitle(''); setFocus(''); setRows([newExerciseRow()])
      setTimeout(() => setSaved(false), 2500)
    }
  }

  return (
    <div className="stack">
      <p className="lead">Add your own session — your exercises, sets and reps.</p>
      <div className="grid-2">
        <label className="field">Session name<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leg day" /></label>
        <label className="field">Focus<input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Legs" /></label>
      </div>
      <ExerciseRowsEditor rows={rows} setRows={setRows} />
      {error && <p className="error">{error}</p>}
      <button className="btn primary big" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save session'}</button>
      {saved && <p className="logged-ok">Saved to your sessions ✓</p>}
    </div>
  )
}

// Programme library: browse the coach's multi-session programmes and start any
// session from one (copies its snapshot into the client's sessions to log).
function ProgramLibrary({ clientId, coachName, onBack }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const [programs, setPrograms] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [sessions, setSessions] = useState({})
  const [startedId, setStartedId] = useState(null)
  const [filters, setFilters] = useState({})
  const [schedDay, setSchedDay] = useState({})
  const todayLocal = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()

  useEffect(() => {
    supabase.from('workout_programs').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setPrograms(data || []))
  }, [])

  const anyFilter = Object.values(filters).some(Boolean)
  const shown = (programs || []).filter((pr) => programMatches(pr, filters))

  async function open(id) {
    setOpenId((o) => (o === id ? null : id))
    if (!sessions[id]) {
      const { data } = await supabase.from('program_sessions').select('*').eq('program_id', id).order('position', { ascending: true })
      setSessions((s) => ({ ...s, [id]: data || [] }))
    }
  }

  async function startSession(ps) {
    setStartedId(ps.id)
    const when = schedDay[ps.id] || todayLocal
    await supabase.from('workout_plans').insert({
      client_id: clientId, title: ps.title, focus: ps.focus || 'Session',
      exercises: ps.exercises || [], finisher: ps.finisher || null, assigned_by: null,
      scheduled_for: when,
    })
    setTimeout(() => setStartedId(null), 2800)
  }

  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Program library</p>
      <h1 className="h1">Follow a plan.</h1>
      <p className="muted-note">Structured programs built by {coachFirst}. Open one, pick a session and add it to your plan on a day — it shows on your agenda, ready to start.</p>

      {programs === null && <Loader text="Loading programs…" />}
      {programs !== null && programs.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>No programs yet — {coachFirst} will add them here.</p>}

      {programs !== null && programs.length > 0 && (
        <div className="prog-filters">
          {PROGRAM_DIMS.map((d) => (
            <select key={d.key} value={filters[d.key] || ''} onChange={(e) => setFilters((f) => ({ ...f, [d.key]: e.target.value || undefined }))}>
              <option value="">{d.label}: any</option>
              {d.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          {anyFilter && <button type="button" className="link-btn inline" onClick={() => setFilters({})}>Clear</button>}
        </div>
      )}
      {programs !== null && programs.length > 0 && shown.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>No programs match those filters — try clearing one.</p>}

      <div className="stack" style={{ marginTop: 12 }}>
        {shown.map((pr) => (
          <div className="card session-card" key={pr.id}>
            <button type="button" className="session-head" onClick={() => open(pr.id)}>
              <div>
                <div className="session-title">{pr.title}</div>
                <div className="session-sub">{[pr.level, pr.weeks ? pr.weeks + ' weeks' : null, ...PROGRAM_DIMS.map((d) => programTagLabel(d.key, pr[d.key]))].filter(Boolean).join(' · ')}</div>
              </div>
              <span className="chev">{openId === pr.id ? '−' : '+'}</span>
            </button>
            {openId === pr.id && (
              <div className="stack" style={{ marginTop: 8 }}>
                {pr.description && <p className="muted-note">{pr.description}</p>}
                {(sessions[pr.id] || []).map((ps) => (
                  <div className="card" key={ps.id} style={{ background: 'var(--surface-2)' }}>
                    <div className="session-title">{ps.label ? ps.label + ' · ' : ''}{ps.title}</div>
                    <ol className="ex-list" style={{ marginTop: 6 }}>
                      {(ps.exercises || []).map((ex, i) => (
                        <li className="ex" key={i}>
                          <span className="ex-n">{i + 1}</span>
                          <div className="ex-body"><div className="ex-name">{ex.name}</div><ExSets ex={ex} />{ex.cue && <div className="ex-cue">{ex.cue}</div>}</div>
                        </li>
                      ))}
                      {ps.finisher && <p className="finisher"><b>Finisher:</b> {ps.finisher}</p>}
                    </ol>
                    <div className="grid-2" style={{ marginTop: 4 }}>
                      <label className="field">Add to day
                        <input type="date" value={schedDay[ps.id] || todayLocal} min={todayLocal}
                          onChange={(e) => setSchedDay((m) => ({ ...m, [ps.id]: e.target.value || todayLocal }))} />
                      </label>
                      <button type="button" className="btn primary sm" style={{ alignSelf: 'end' }} onClick={() => startSession(ps)}>
                        {startedId === ps.id ? 'Added to your plan ✓' : 'Add to my plan'}
                      </button>
                    </div>
                  </div>
                ))}
                {sessions[pr.id] && sessions[pr.id].length === 0 && <p className="muted-note">Sessions coming soon.</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Recipe library — the coach's saved meals with macros. Tap one to log it.
function RecipeLibrary({ profile, coachName, onLog, onBack }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const [recipes, setRecipes] = useState(null)
  const [loggedId, setLoggedId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const clientId = profile?.id

  async function load() {
    const { data } = await supabase.from('recipes').select('*').order('created_at', { ascending: false })
    setRecipes(data || [])
  }
  useEffect(() => { load() }, [])

  const allTags = Array.from(new Set((recipes || []).flatMap((r) => r.tags || []).map((t) => String(t).trim()).filter(Boolean))).sort()
  const shown = (recipes || []).filter((r) => {
    const okTag = !tag || (r.tags || []).includes(tag)
    const hay = (r.title + ' ' + (r.tags || []).join(' ') + ' ' + (r.description || '')).toLowerCase()
    const okQ = !q.trim() || hay.includes(q.trim().toLowerCase())
    return okTag && okQ
  })

  function log(r) {
    onLog({ name: r.title, protein_g: r.protein_g || 0, carbs_g: r.carbs_g || 0, fat_g: r.fat_g || 0, fibre_g: r.fibre_g || 0, calories: r.calories || 0 })
    setLoggedId(r.id); setTimeout(() => setLoggedId(null), 2500)
  }
  async function copyShopping(r) {
    const list = (r.ingredients || []).join('\n')
    try { await navigator.clipboard.writeText(`${r.title} — shopping list\n\n${list}`); setCopiedId(r.id); setTimeout(() => setCopiedId(null), 2000) } catch { /* clipboard blocked */ }
  }

  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Recipes</p>
      <h1 className="h1">{coachFirst}’s meals.</h1>
      <p className="muted-note">Coach-approved meals with the macros worked out — plus any you add yourself. Tap to log one to today.</p>
      {clientId && <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>+ Create a recipe</button>}
      {recipes === null && <Loader text="Loading recipes…" />}
      {recipes !== null && recipes.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>No recipes yet — add your own or {coachFirst} will add some.</p>}
      {recipes !== null && recipes.length > 0 && (
        <>
          <input className="food-input" style={{ marginTop: 12 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes — e.g. high protein, lunch…" />
          {allTags.length > 0 && (
            <div className="serving-chips" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" className={tag === '' ? 'on' : ''} onClick={() => setTag('')}>All</button>
              {allTags.map((t) => <button type="button" key={t} className={tag === t ? 'on' : ''} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>)}
            </div>
          )}
        </>
      )}
      {recipes !== null && recipes.length > 0 && shown.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>No recipes match — try another search or tag.</p>}
      <div className="stack" style={{ marginTop: 12 }}>
        {shown.map((r) => (
          <div className="card" key={r.id}>
            {(r.image_path || r.image_url) && <img className="link-img" src={r.image_path ? supabase.storage.from('content-images').getPublicUrl(r.image_path).data.publicUrl : r.image_url} alt={r.title} loading="lazy" />}
            <div className="session-title">{r.title}{r.client_id ? <span className="muted-note"> · yours</span> : ''}</div>
            <div className="session-sub">{[r.calories ? r.calories + ' kcal' : null, r.protein_g ? r.protein_g + 'g P' : null, r.carbs_g ? r.carbs_g + 'g C' : null, r.fat_g ? r.fat_g + 'g F' : null].filter(Boolean).join(' · ')}{r.serving_label ? ' · ' + r.serving_label : ''}</div>
            {r.description && <p className="muted-note" style={{ marginTop: 6 }}>{r.description}</p>}
            {(r.tags || []).length > 0 && (
              <div className="serving-chips" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                {(r.tags || []).map((t) => <button type="button" key={t} className={tag === t ? 'on' : ''} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>)}
              </div>
            )}
            <div className="nudge-actions">
              <button className="btn primary sm" onClick={() => log(r)}>{loggedId === r.id ? 'Added to today ✓' : 'Log this meal'}</button>
              {(r.ingredients || []).length > 0 && <button className="btn ghost sm" onClick={() => copyShopping(r)}>{copiedId === r.id ? 'Copied ✓' : 'Shopping list'}</button>}
            </div>
          </div>
        ))}
      </div>
      {creating && <RecipeCreator clientId={clientId} onSaved={(rec) => setRecipes((rs) => [rec, ...(rs || [])])} onClose={() => setCreating(false)} />}
    </div>
  )
}

// Turn a YouTube/Vimeo link into an embeddable URL; null => link out instead.
function videoEmbed(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' && u.searchParams.get('v')) return 'https://www.youtube.com/embed/' + u.searchParams.get('v')
    if (host === 'youtu.be') return 'https://www.youtube.com/embed/' + u.pathname.slice(1)
    if (host === 'vimeo.com') { const id = u.pathname.split('/').filter(Boolean)[0]; if (/^\d+$/.test(id)) return 'https://player.vimeo.com/video/' + id }
  } catch { /* not a URL */ }
  return null
}

// YouTube thumbnail straight from the video id (free, no API). Vimeo needs an API
// call so we skip it and fall back to a plain card.
function videoThumb(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    let id = null
    if (host === 'youtube.com') id = u.searchParams.get('v')
    else if (host === 'youtu.be') id = u.pathname.slice(1)
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  } catch { /* not a URL */ }
  return null
}

// Video library — the coach's technique/mindset clips.
function VideoLibrary({ coachName, onBack }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const [videos, setVideos] = useState(null)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    supabase.from('videos').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setVideos(data || []))
  }, [])

  // Group into folders by category/tag, so clips sit under Nutrition / Mindset /
  // Lifestyle etc. Untagged videos fall into a "General" folder.
  const videoFolders = (() => {
    const groups = {}
    ;(videos || []).forEach((v) => { const k = (v.category || 'General').trim() || 'General'; (groups[k] = groups[k] || []).push(v) })
    return Object.entries(groups).sort((a, b) => (a[0] === 'General' ? 1 : b[0] === 'General' ? -1 : a[0].localeCompare(b[0])))
  })()

  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Video library</p>
      <h1 className="h1">Watch &amp; learn.</h1>
      <p className="muted-note">Technique and mindset clips from {coachFirst} — tap to watch.</p>
      {videos === null && <Loader text="Loading videos…" />}
      {videos !== null && videos.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>No videos yet — {coachFirst} will add them here.</p>}
      {videoFolders.map(([folder, items]) => (
        <div className="stack" key={folder} style={{ marginTop: 12 }}>
          <p className="eyebrow accent">{folder}</p>
          {items.map((v) => {
            const embed = videoEmbed(v.url)
            const open = openId === v.id
            const thumb = videoThumb(v.url)
            return (
              <div className="card" key={v.id}>
                {!open && thumb && (
                  <button type="button" className="vid-thumb" onClick={() => embed ? setOpenId(v.id) : window.open(v.url, '_blank')}>
                    <img src={thumb} alt={v.title} loading="lazy" />
                    <span className="vid-play" aria-hidden="true">▶</span>
                  </button>
                )}
                <div className="session-title">{v.title}</div>
                {v.description && <p className="muted-note" style={{ marginTop: 6 }}>{v.description}</p>}
                {open && embed && (
                  <div className="video-embed"><iframe src={embed} title={v.title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
                )}
                {embed ? (
                  <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setOpenId(open ? null : v.id)}>{open ? 'Hide' : 'Watch here'}</button>
                ) : (
                  <a className="btn ghost sm" style={{ marginTop: 10, display: 'inline-block' }} href={v.url} target="_blank" rel="noopener noreferrer">Open video</a>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Supplements / Shop / Podcasts — simple lists of the coach's outbound links.
// RLS (cl_client_read) scopes coach_links to the client's own coach.
const LINK_META = {
  supplement: { eyebrow: 'Supplements', h1: 'Supplements & discounts.', lead: (c) => `${c}’s trusted brands — with your discount codes.`, cta: 'Shop now', empty: 'No supplement links yet.' },
  shop:       { eyebrow: 'Shop',        h1: 'Shop.',                     lead: (c) => `Books, merch and gear from ${c}.`,          cta: 'View',      empty: 'Nothing in the shop yet.' },
  podcast:    { eyebrow: 'Podcasts',    h1: 'Podcasts.',                 lead: (c) => `Listen in to ${c}’s episodes.`,            cta: 'Listen',    empty: 'No podcasts linked yet.' },
}
function LinkList({ kind, coachName, onBack }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const meta = LINK_META[kind] || LINK_META.shop
  const [links, setLinks] = useState(null)
  useEffect(() => {
    supabase.from('coach_links').select('*').eq('kind', kind)
      .order('position', { ascending: true }).order('created_at', { ascending: true })
      .then(({ data }) => setLinks(data || []))
  }, [kind])
  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">{meta.eyebrow}</p>
      <h1 className="h1">{meta.h1}</h1>
      <p className="muted-note">{meta.lead(coachFirst)}</p>
      {links === null && <Loader text="Loading…" />}
      {links !== null && links.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>{meta.empty}</p>}
      <div className="stack" style={{ marginTop: 12 }}>
        {(links || []).map((l) => (
          <div className="card" key={l.id}>
            {l.image_url && <img className="link-img" src={l.image_url} alt={l.label} loading="lazy" />}
            <div className="session-title">{l.label}</div>
            {l.note && <p className="muted-note" style={{ marginTop: 6 }}>{l.note}</p>}
            <a className="btn primary sm" style={{ marginTop: 10, display: 'inline-block' }} href={l.url} target="_blank" rel="noopener noreferrer">{meta.cta}</a>
          </div>
        ))}
      </div>
    </div>
  )
}

// Athlete rehab view (PPH): read-only injury/RTP + log rehab sessions & soreness.
function Rehab({ clientId, coachName, onBack }) {
  const coach = coachName?.split(' ')[0] || 'your coach'
  const [tab, setTab] = useState('plan')
  const [injuries, setInjuries] = useState(null)
  const [items, setItems] = useState([])
  const [sess, setSess] = useState({ pain_before: '', pain_during: '', pain_after: '', rpe: '', note: '' })
  const [sore, setSore] = useState({ body_region: BODY_REGIONS[0], pain: '' })
  const [saved, setSaved] = useState('')

  const [error, setError] = useState('')
  async function load() {
    const { data: inj } = await supabase.from('injuries').select('*').eq('client_id', clientId).neq('status', 'resolved').order('created_at', { ascending: false })
    setInjuries(inj || [])
    // Only the drills for the athlete's active injuries.
    const injIds = (inj || []).map((i) => i.id)
    let its = []
    if (injIds.length) {
      const { data: prots } = await supabase.from('rehab_protocols').select('id').eq('client_id', clientId).in('injury_id', injIds)
      const pIds = (prots || []).map((p) => p.id)
      if (pIds.length) {
        const { data } = await supabase.from('rehab_protocol_items').select('*').in('protocol_id', pIds).order('position', { ascending: true })
        its = data || []
      }
    }
    setItems(its)
  }
  useEffect(() => { load() }, [])

  const num = (v) => (v === '' ? null : Number(v))
  async function logSession(e) {
    e.preventDefault(); setError('')
    const { error: err } = await supabase.from('rehab_sessions').insert({ client_id: clientId, pain_before: num(sess.pain_before), pain_during: num(sess.pain_during), pain_after: num(sess.pain_after), rpe: num(sess.rpe), note: sess.note.trim() || null })
    if (err) { setError(err.message); return }
    setSess({ pain_before: '', pain_during: '', pain_after: '', rpe: '', note: '' }); setSaved('Session logged ✓'); setTimeout(() => setSaved(''), 2000)
  }
  async function logSoreness(e) {
    e.preventDefault(); setError('')
    if (sore.pain === '') return
    const { error: err } = await supabase.from('soreness_logs').insert({ client_id: clientId, body_region: sore.body_region, pain: Number(sore.pain), note: null })
    if (err) { setError(err.message); return }
    setSore({ body_region: BODY_REGIONS[0], pain: '' }); setSaved('Soreness logged ✓'); setTimeout(() => setSaved(''), 2000)
  }

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Rehab</p>
      <h1 className="h1">Back to full fitness.</h1>
      <div className="seg three">
        <button type="button" className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>My plan</button>
        <button type="button" className={tab === 'session' ? 'on' : ''} onClick={() => setTab('session')}>Log session</button>
        <button type="button" className={tab === 'soreness' ? 'on' : ''} onClick={() => setTab('soreness')}>Soreness</button>
      </div>
      {saved && <p className="logged-ok">{saved}</p>}
      {error && <p className="error">{error}</p>}

      {tab === 'plan' && (
        <div className="stack">
          {injuries === null && <p className="muted-note">Loading…</p>}
          {injuries !== null && injuries.length === 0 && <p className="muted-note">No active injuries — you’re good to go.</p>}
          {(injuries || []).map((inj) => {
            const av = availabilityOf(inj.availability)
            return (
              <div className="card" key={inj.id}>
                <div className="post-head" style={{ marginBottom: 6 }}>
                  <div className="session-title">{inj.body_region}{inj.side && inj.side !== 'N/A' ? ` (${inj.side})` : ''}</div>
                  <span className={'avail-badge ' + av.color} style={{ marginLeft: 'auto' }}>{av.label}</span>
                </div>
                <p className="muted-note">Status: {statusLabel(inj.status)} · set by {coach}</p>
                <div className="rtp-ladder" style={{ marginTop: 8 }}>
                  {RTP_LADDER.map((s, i) => (
                    <div key={i} className={'rtp-step' + (i < inj.current_rtp_stage ? ' done' : '') + (i === inj.current_rtp_stage ? ' current' : '')}>
                      <span className="rtp-n">{i + 1}</span><span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {items.length > 0 && (
            <div className="card">
              <p className="eyebrow accent">Your rehab drills</p>
              {items.map((it) => <div key={it.id} className="checkin-line"><b>{it.name}</b>{it.detail ? ` — ${it.detail}` : ''}</div>)}
            </div>
          )}
        </div>
      )}

      {tab === 'session' && (
        <form className="card" onSubmit={logSession}>
          <p className="muted-note">Log your rehab session and how it felt — pain 0 (none) to 10 (severe).</p>
          <div className="grid-2">
            <label className="field">Pain before<input type="number" inputMode="numeric" min="0" max="10" value={sess.pain_before} onChange={(e) => setSess((s) => ({ ...s, pain_before: e.target.value }))} /></label>
            <label className="field">Pain during<input type="number" inputMode="numeric" min="0" max="10" value={sess.pain_during} onChange={(e) => setSess((s) => ({ ...s, pain_during: e.target.value }))} /></label>
            <label className="field">Pain after<input type="number" inputMode="numeric" min="0" max="10" value={sess.pain_after} onChange={(e) => setSess((s) => ({ ...s, pain_after: e.target.value }))} /></label>
            <label className="field">Effort (RPE)<input type="number" inputMode="numeric" min="0" max="10" value={sess.rpe} onChange={(e) => setSess((s) => ({ ...s, rpe: e.target.value }))} /></label>
          </div>
          <label className="field">Note<textarea value={sess.note} onChange={(e) => setSess((s) => ({ ...s, note: e.target.value }))} placeholder="How did it feel?" /></label>
          <button className="btn primary big" type="submit">Log rehab session</button>
        </form>
      )}

      {tab === 'soreness' && (
        <form className="card" onSubmit={logSoreness}>
          <p className="muted-note">Flag any soreness or niggles — {coach} sees these, and it feeds your readiness score.</p>
          <div className="grid-2">
            <label className="field">Area<select value={sore.body_region} onChange={(e) => setSore((s) => ({ ...s, body_region: e.target.value }))}>{BODY_REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="field">Pain (0–10)<input type="number" inputMode="numeric" min="0" max="10" value={sore.pain} onChange={(e) => setSore((s) => ({ ...s, pain: e.target.value }))} /></label>
          </div>
          <button className="btn primary big" type="submit" disabled={sore.pain === ''}>Log soreness</button>
        </form>
      )}
    </div>
  )
}

// Files — the coach's shared PDFs/guides (public bucket, open in a new tab).
function FilesLibrary({ coachName, onBack }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const [files, setFiles] = useState(null)
  useEffect(() => {
    supabase.from('coach_files').select('*').order('created_at', { ascending: false }).then(({ data }) => setFiles(data || []))
  }, [])
  const fileUrl = (path) => supabase.storage.from('coach-files').getPublicUrl(path).data.publicUrl
  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Files</p>
      <h1 className="h1">Guides &amp; resources.</h1>
      <p className="muted-note">Documents from {coachFirst} — tap to open.</p>
      {files === null && <Loader text="Loading…" />}
      {files !== null && files.length === 0 && <p className="muted-note" style={{ marginTop: 12 }}>No files yet — {coachFirst} will add them here.</p>}
      <div className="stack" style={{ marginTop: 12 }}>
        {(files || []).map((f) => (
          <div className="card" key={f.id}>
            <div className="session-title">{f.title}</div>
            {f.note && <p className="muted-note" style={{ marginTop: 6 }}>{f.note}</p>}
            <a className="btn primary sm" style={{ marginTop: 10, display: 'inline-block' }} href={fileUrl(f.path)} target="_blank" rel="noopener noreferrer">Open</a>
          </div>
        ))}
      </div>
    </div>
  )
}

// Barcode scanner. Manual entry is the primary path (works everywhere); the
// camera is a bonus where the browser supports BarcodeDetector (Chrome/Android).
function BarcodeScan({ onLog, onBack }) {
  const [code, setCode] = useState('')
  const [state, setState] = useState('idle') // idle | loading | found | notfound | error
  const [product, setProduct] = useState(null)
  const [grams, setGrams] = useState('100')
  const [meal, setMeal] = useState(mealByHour())
  const [error, setError] = useState('')
  const [logged, setLogged] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const videoRef = useRef(null)
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window

  async function lookup(barcode) {
    setState('loading'); setError(''); setProduct(null); setLogged(false)
    try {
      const res = await fetch('/.netlify/functions/barcode', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ barcode }),
      })
      const json = await res.json()
      if (!res.ok || json.status === 'not_found' || !json.product) { setState('notfound'); return }
      setProduct(json.product); setState('found')
    } catch { setState('error'); setError('Couldn’t look that up. Try again, or use Log food.') }
  }

  function stopCam() {
    const v = videoRef.current
    if (v && v.srcObject) { v.srcObject.getTracks().forEach((t) => t.stop()); v.srcObject = null }
    setCamOn(false)
  }
  async function startCam() {
    if (!canScan) return
    setError(''); setCamOn(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const v = videoRef.current
      v.srcObject = stream; await v.play()
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
      const tick = async () => {
        const el = videoRef.current
        if (!el || !el.srcObject) return
        try {
          const codes = await detector.detect(el)
          if (codes && codes.length && codes[0].rawValue) { const bc = codes[0].rawValue; stopCam(); setCode(bc); lookup(bc); return }
        } catch { /* keep trying */ }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    } catch { setError('Couldn’t open the camera — type the barcode instead.'); setCamOn(false) }
  }
  useEffect(() => () => stopCam(), [])

  function submitManual(e) { e.preventDefault(); const c = code.replace(/\D/g, ''); if (c) lookup(c) }

  const per = product?.per100
  const g = Number(grams) || 0
  const scale = g / 100
  const scaled = per ? {
    name: product.name,
    protein_g: Math.round((per.protein_g || 0) * scale),
    carbs_g: Math.round((per.carbs_g || 0) * scale),
    fat_g: Math.round((per.fat_g || 0) * scale),
    fibre_g: Math.round((per.fibre_g || 0) * scale),
    calories: Math.round((per.calories || 0) * scale),
  } : null

  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Barcode scan</p>
      <h1 className="h1">Scan a product.</h1>
      <p className="muted-note">Scan the barcode or type the number — we’ll pull the nutrition and you set the portion.</p>

      {canScan && (
        camOn ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <video ref={videoRef} className="barcode-cam" muted playsInline />
            <button className="btn ghost" onClick={stopCam}>Stop camera</button>
          </div>
        ) : (
          <button className="btn primary big" style={{ marginTop: 12 }} onClick={startCam}>Scan with camera</button>
        )
      )}

      <form className="auth-form" onSubmit={submitManual} style={{ marginTop: 14 }}>
        <label>Barcode number
          <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 5000159484695" />
        </label>
        <button className="btn ghost" type="submit" disabled={!code.replace(/\D/g, '')}>Look up</button>
      </form>

      {state === 'loading' && <Loader text="Looking it up…" />}
      {state === 'notfound' && <p className="muted-note" style={{ marginTop: 14 }}>Couldn’t find that product. Use “Log food” to add it by name instead.</p>}
      {error && <p className="error">{error}</p>}

      {state === 'found' && product && per && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="session-title">{product.name}</div>
          <div className="session-sub">Per 100{product.unit || 'g'}: {per.calories ?? '—'} kcal · {per.protein_g ?? 0}g P · {per.carbs_g ?? 0}g C · {per.fat_g ?? 0}g F</div>
          <label className="field" style={{ marginTop: 12 }}>Portion (grams)<input type="number" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)} /></label>
          {product.serving && (
            <div className="serving-chips">
              <button type="button" className={grams === String(product.serving) ? 'on' : ''} onClick={() => setGrams(String(product.serving))}>Standard serving · {product.serving}g</button>
              <button type="button" className={grams === '100' ? 'on' : ''} onClick={() => setGrams('100')}>100g</button>
            </div>
          )}
          {scaled && <p className="muted-note">This portion: {scaled.calories} kcal · {scaled.protein_g}g P · {scaled.carbs_g}g C · {scaled.fat_g}g F</p>}
          <label className="field" style={{ marginTop: 8 }}>Meal<select value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></label>
          <button className="btn primary" style={{ marginTop: 10 }} disabled={!scaled || g <= 0} onClick={() => { if (scaled) { onLog({ ...scaled, meal_type: meal }); setLogged(true) } }}>
            {logged ? 'Added to today ✓' : 'Add to today'}
          </button>
        </div>
      )}
    </div>
  )
}

// Client-facing template picker. Lists the coach's published templates (RLS
// scopes to the client's own coach) and copies the chosen one into the client's
// sessions so they can log it. Self-started => assigned_by stays null.
function StartWorkout({ clientId, onStarted }) {
  const [templates, setTemplates] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [startingId, setStartingId] = useState(null)
  const [startedId, setStartedId] = useState(null)

  useEffect(() => {
    supabase.from('workout_templates').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setTemplates(data || []))
  }, [])

  async function start(t) {
    setStartingId(t.id)
    const { data } = await supabase.from('workout_plans').insert({
      client_id: clientId, title: t.title, focus: t.focus || 'Session',
      exercises: t.exercises || [], finisher: t.finisher || null, assigned_by: null,
    }).select().single()
    setStartingId(null)
    if (data) { onStarted && onStarted(data); setStartedId(t.id); setTimeout(() => setStartedId(null), 2500) }
  }

  if (templates === null) return <Loader text="Loading sessions…" />
  if (templates.length === 0) return <p className="muted-note">No sessions from your coach yet — they’ll appear here to start with one tap.</p>

  return (
    <div className="stack">
      <p className="lead">Pick a session your coach has built and start it — it drops into your sessions to log as you go.</p>
      {templates.map((t) => (
        <div className="card session-card" key={t.id}>
          <button type="button" className="session-head" onClick={() => setOpenId((o) => (o === t.id ? null : t.id))}>
            <div>
              <div className="session-title">{t.title}</div>
              <div className="session-sub">{t.focus ? t.focus + ' · ' : ''}{(t.exercises || []).length} exercise{(t.exercises || []).length === 1 ? '' : 's'}</div>
            </div>
            <span className="chev">{openId === t.id ? '−' : '+'}</span>
          </button>
          {openId === t.id && (
            <ol className="ex-list">
              {(t.exercises || []).map((ex, i) => (
                <li className="ex" key={i}>
                  <span className="ex-n">{i + 1}</span>
                  <div className="ex-body">
                    <div className="ex-name">{ex.name}</div>
                    <ExSets ex={ex} />
                    {ex.cue && <div className="ex-cue">{ex.cue}</div>}
                  </div>
                </li>
              ))}
              {t.finisher && <p className="finisher"><b>Finisher:</b> {t.finisher}</p>}
            </ol>
          )}
          <button type="button" className="btn primary sm" disabled={startingId === t.id} onClick={() => start(t)}>
            {startedId === t.id ? 'Added to your sessions ✓' : startingId === t.id ? 'Starting…' : 'Start this session'}
          </button>
        </div>
      ))}
    </div>
  )
}

// Guided workout player — walk through a session, tick each set, log what you
// actually lifted. Merges logged reps/weight back into the EXISTING exercise
// objects (preserving set_type/group/rpe/cue/name/equipment) — never via
// rowsToExercises, which would strip them. Handles legacy plans where `sets` is
// a count rather than an array.
function toPlayer(exercises) {
  return (exercises || []).map((ex) => {
    const sets = Array.isArray(ex.sets)
      ? ex.sets.map((s) => ({ reps: String(s.reps ?? ''), weight: String(s.weight ?? ''), done: false }))
      : Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, () => ({ reps: String(ex.reps ?? ''), weight: String(ex.weight ?? ''), done: false }))
    return { ...ex, sets }
  })
}
function fromPlayer(playerExs) {
  return playerExs.map((ex) => {
    const { reps, weight, sets, ...rest } = ex
    return { ...rest, sets: (sets || []).map((s) => ({ reps: String(s.reps).trim(), weight: String(s.weight).trim() || null })) }
  })
}

const GW_KEY = (id) => 'cbk_gw:' + id
function GuidedWorkout({ plan, clientId, onDone, onFinishedToday, onExit }) {
  // Restore an in-progress session (survives app-switch / reload), so ticked sets
  // and logged weights aren't lost until they hit Finish.
  const [exs, setExs] = useState(() => {
    try { const s = localStorage.getItem(GW_KEY(plan.id)); if (s) return JSON.parse(s) } catch { /* ignore */ }
    return toPlayer(plan.exercises)
  })
  const [saving, setSaving] = useState(false)
  const [finished, setFinished] = useState(false)
  const [guideEx, setGuideEx] = useState(null)

  // Mark this session active + persist progress as they go.
  useEffect(() => { try { sessionStorage.setItem('cbk_gw_active', plan.id) } catch { /* ignore */ } }, [])
  useEffect(() => { try { localStorage.setItem(GW_KEY(plan.id), JSON.stringify(exs)) } catch { /* ignore */ } }, [exs])
  const clearSaved = () => { try { localStorage.removeItem(GW_KEY(plan.id)); sessionStorage.removeItem('cbk_gw_active') } catch { /* ignore */ } }
  const exit = () => { clearSaved(); onExit && onExit() }

  const totalSets = exs.reduce((n, ex) => n + ex.sets.length, 0)
  const doneSets = exs.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0)
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0

  const toggleSet = (ei, si) => setExs((xs) => xs.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== si ? s : { ...s, done: !s.done })) })))
  const updateSet = (ei, si, k, v) => setExs((xs) => xs.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== si ? s : { ...s, [k]: v })) })))

  async function finish() {
    setSaving(true)
    const exercises = fromPlayer(exs)
    const { data } = await supabase.from('workout_plans').update({ exercises }).eq('id', plan.id).select().single()
    // Mark today complete once — guard against a duplicate if they already tapped "Done".
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabase.from('workout_completions').select('id').eq('client_id', clientId).eq('completed_on', today).limit(1)
    if (!existing || existing.length === 0) {
      await supabase.from('workout_completions').insert({ client_id: clientId, source: 'guided' })
    }
    setSaving(false)
    clearSaved()
    if (data) onDone && onDone(data)
    onFinishedToday && onFinishedToday()
    setFinished(true)
  }

  if (finished) {
    return (
      <div className="stack" style={{ marginTop: 10 }}>
        <p className="logged-ok big">Session complete ✓</p>
        <p className="muted-note">Logged and saved — nice work. It’s in your weights-lifted progress.</p>
        <button className="btn ghost sm" onClick={exit}>Done</button>
      </div>
    )
  }

  return (
    <div className="stack gw" style={{ marginTop: 10 }}>
      <div className="gw-progress"><div className="gw-bar" style={{ width: pct + '%' }} /></div>
      <p className="muted-note">{doneSets}/{totalSets} sets done — tick each set as you go and log what you actually lifted.</p>
      {exs.map((ex, ei) => {
        const embed = ex.video ? videoEmbed(ex.video) : null
        const sh = ex.section && ex.section !== exs[ei - 1]?.section
        return (
          <div key={ei}>
          {sh && <p className="gw-section">{ex.section}</p>}
          <div className="card gw-ex" style={{ background: 'var(--surface-2)' }}>
            <div className="gw-ex-head">
              {THEME.features?.exerciseGuides
                ? <button type="button" className="ex-name eg-tap" onClick={() => setGuideEx(ex)}>{ex.name}</button>
                : <div className="ex-name">{ex.name}</div>}
              {ex.video && !embed && <a className="link-btn inline" href={ex.video} target="_blank" rel="noopener noreferrer">How to</a>}
            </div>
            <div className="gw-chips">
              {(ex.set_type && ex.set_type !== 'straight') && <span className="settype-chip">{ex.set_type === 'superset' && ex.group ? 'Superset ' + ex.group : setTypeLabel(ex.set_type)}</span>}
              {ex.rpe && <span className="settype-chip rpe">RPE {ex.rpe}</span>}
            </div>
            {embed && <div className="video-embed"><iframe src={embed} title={ex.name} allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>}
            <div className="gw-sets">
              {ex.sets.map((s, si) => (
                <label className={'gw-set' + (s.done ? ' done' : '')} key={si}>
                  <input type="checkbox" checked={s.done} onChange={() => toggleSet(ei, si)} />
                  <span className="gw-set-n">Set {si + 1}</span>
                  <input className="gw-in" inputMode="numeric" placeholder="reps" value={s.reps} onChange={(e) => updateSet(ei, si, 'reps', e.target.value)} />
                  <input className="gw-in" inputMode="decimal" placeholder="kg" value={s.weight} onChange={(e) => updateSet(ei, si, 'weight', e.target.value)} />
                </label>
              ))}
            </div>
            {ex.cue && <p className="ex-cue">{ex.cue}</p>}
          </div>
          </div>
        )
      })}
      {plan.finisher && <p className="finisher"><b>Finisher:</b> {plan.finisher}</p>}
      <div className="nudge-actions">
        <button className="btn primary big" disabled={saving} onClick={finish}>{saving ? 'Saving…' : 'Finish session'}</button>
        <button className="btn ghost sm" onClick={exit}>Exit</button>
      </div>
      {guideEx && <ExerciseGuide ex={guideEx} onClose={() => setGuideEx(null)} />}
    </div>
  )
}

function SessionCard({ plan, onUpdate, clientId, onWorkoutDone }) {
  // If this session was mid-play when the app was backgrounded, reopen it so the
  // player comes straight back up with their saved sets.
  const resuming = (() => { try { return sessionStorage.getItem('cbk_gw_active') === plan.id } catch { return false } })()
  const [open, setOpen] = useState(resuming)
  const [editing, setEditing] = useState(false)
  const [playing, setPlaying] = useState(resuming)
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [guideEx, setGuideEx] = useState(null)
  const exs = plan.exercises || []
  // A squad-session plan is the coach's floor record — read-only here so the
  // athlete can't overwrite logged actuals by re-finishing it.
  const squadLocked = !!plan.squad_session_id

  function startEdit() {
    setRows(planToRows(exs))
    setEditing(true)
    setOpen(true)
  }
  async function save() {
    const exercises = rowsToExercises(rows, exs[0]?.equipment || 'Own choice')
    if (exercises.length === 0) { setEditing(false); return }
    setSaving(true)
    const { data } = await supabase.from('workout_plans').update({ exercises }).eq('id', plan.id).select().single()
    setSaving(false)
    if (data) { onUpdate && onUpdate(data); setEditing(false) }
  }

  // Flag an exercise you can't do (injury / no kit) and let the AI swap in an
  // alternative, keeping the same sets. Persists to this plan.
  const [swapFor, setSwapFor] = useState(null)
  const [swapReason, setSwapReason] = useState('')
  const [swapBusy, setSwapBusy] = useState(false)
  const [swapSug, setSwapSug] = useState(null)
  const [swapErr, setSwapErr] = useState('')
  const [swapImg, setSwapImg] = useState(null)
  const [showSwapCam, setShowSwapCam] = useState(false)
  function openSwap(i) { setSwapFor(i); setSwapReason(''); setSwapSug(null); setSwapErr(''); setSwapImg(null) }
  async function pickSwapImg(file) {
    if (!file) return
    try { setSwapImg(await scaleImageToBase64(file, 1000)) } catch { setSwapErr('Could not read that photo.') }
  }
  async function findAlt(i) {
    setSwapBusy(true); setSwapSug(null); setSwapErr('')
    try {
      const res = await fetch('/.netlify/functions/exercise-swap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: exs[i].name, reason: swapReason, ...(swapImg ? { image: swapImg, mediaType: 'image/jpeg' } : {}) }) })
      const j = await res.json()
      if (j.name) setSwapSug(j); else setSwapErr(j.error || 'No suggestion — try again.')
    } catch { setSwapErr('Could not get a suggestion.') }
    setSwapBusy(false)
  }
  async function applySwap(i) {
    if (!swapSug?.name) return
    const next = exs.map((ex, j) => (j === i ? { ...ex, name: swapSug.name, cue: swapSug.cue ? `Swapped in — ${swapSug.cue}` : ex.cue } : ex))
    const { data } = await supabase.from('workout_plans').update({ exercises: next }).eq('id', plan.id).select().single()
    if (data) { onUpdate && onUpdate(data); setSwapFor(null); setSwapSug(null); setSwapReason('') }
  }

  return (
    <div className="card session-card">
      <button type="button" className="session-head" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="session-title">{plan.title}</div>
          <div className="session-sub">{plan.focus} · {exs.length} exercise{exs.length === 1 ? '' : 's'}{squadLocked ? ' · Squad session, logged with your coach' : plan.assigned_by ? ' · From your coach' : ''}</div>
        </div>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && !editing && !playing && (
        <>
          <ol className="ex-list">
            {exs.map((ex, i) => {
              const sh = ex.section && ex.section !== exs[i - 1]?.section
              return [
                sh && <li className="ex-section" key={'s' + i}>{ex.section}</li>,
                <li className="ex" key={i}>
                  <span className="ex-n">{i + 1}</span>
                  <div className="ex-body">
                    {THEME.features?.exerciseGuides
                      ? <button type="button" className="ex-name eg-tap" onClick={() => setGuideEx(ex)}>{ex.name}</button>
                      : <div className="ex-name">{ex.name}</div>}
                    <ExSets ex={ex} />
                    {ex.cue && <div className="ex-cue">{ex.cue}</div>}
                    {!squadLocked && (swapFor === i ? (
                      <div className="swap-panel" style={{ marginTop: 6 }}>
                        <input className="food-input" value={swapReason} onChange={(e) => setSwapReason(e.target.value)} placeholder="Why can't you do it? e.g. sore knee, no cable machine" />
                        <button type="button" className="link-btn inline" style={{ marginTop: 6 }} onClick={() => setShowSwapCam(true)}>{swapImg ? 'Equipment photo added ✓ — retake' : 'Snap what you’ve got (optional)'}</button>
                        {swapErr && <p className="error" style={{ marginTop: 4 }}>{swapErr}</p>}
                        {swapSug && (
                          <div className="card" style={{ background: 'var(--surface-2)', marginTop: 6 }}>
                            <div className="ex-name">{swapSug.name}</div>
                            {swapSug.cue && <div className="ex-cue">{swapSug.cue}</div>}
                          </div>
                        )}
                        <div className="nudge-actions" style={{ marginTop: 6 }}>
                          {!swapSug
                            ? <button type="button" className="btn primary sm" disabled={swapBusy} onClick={() => findAlt(i)}>{swapBusy ? 'Finding…' : 'Find alternative'}</button>
                            : <>
                              <button type="button" className="btn primary sm" onClick={() => applySwap(i)}>Use this swap</button>
                              <button type="button" className="btn ghost sm" disabled={swapBusy} onClick={() => findAlt(i)}>{swapBusy ? 'Finding…' : 'Try another'}</button>
                            </>}
                          <button type="button" className="btn ghost sm" onClick={() => setSwapFor(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="link-btn inline" style={{ marginTop: 4 }} onClick={() => openSwap(i)}>Can’t do this? Swap it</button>
                    ))}
                  </div>
                </li>,
              ]
            })}
            {plan.finisher && <p className="finisher"><b>Finisher:</b> {plan.finisher}</p>}
          </ol>
          {squadLocked ? (
            <p className="muted-note">Logged live with your coach — this is your record of the session.</p>
          ) : (
            <div className="nudge-actions">
              <button type="button" className="btn primary sm" onClick={() => { setPlaying(true); setOpen(true) }}>Start session</button>
              <button type="button" className="btn ghost sm" onClick={startEdit}>Edit / add weights</button>
            </div>
          )}
        </>
      )}
      {open && playing && !squadLocked && (
        <GuidedWorkout plan={plan} clientId={clientId} onDone={onUpdate} onFinishedToday={onWorkoutDone} onExit={() => setPlaying(false)} />
      )}
      {open && editing && (
        <div className="stack" style={{ marginTop: 10 }}>
          <p className="muted-note">Log the reps and weight for each set — this feeds your weights-lifted progress.</p>
          <ExerciseRowsEditor rows={rows} setRows={setRows} />
          <div className="nudge-actions">
            <button className="btn primary sm" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
            <button className="btn ghost sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
      {guideEx && <ExerciseGuide ex={guideEx} onClose={() => setGuideEx(null)} />}
      {showSwapCam && <CameraCapture onCapture={(file) => { setShowSwapCam(false); pickSwapImg(file) }} onClose={() => setShowSwapCam(false)} />}
    </div>
  )
}

/* ---------- Fridge ---------- */
function FridgeScan({ remaining, onLog }) {
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [logged, setLogged] = useState(false)
  const [showCam, setShowCam] = useState(false)

  async function handleFile(file) {
    if (!file) return
    setLogged(false); setPreview(URL.createObjectURL(file)); setState('loading'); setError('')
    try {
      const data = await scaleImageToBase64(file, 900)
      const json = await analyze({ mode: 'fridge', image: data, mediaType: 'image/jpeg', remaining })
      setResult(json); setState('done')
    } catch (err) { setError(err.message); setState('error') }
  }

  return (
    <div className="stack">
      <p className="eyebrow">Fridge-to-Plate</p>
      <h1 className="h1">What’s in the fridge?</h1>
      <p className="lead">Photograph your fridge or cupboard. The AI builds a meal that fits your <b>{remaining.calories} kcal</b> and <b>{remaining.protein_g}g protein</b> left today.</p>
      {preview && <div className="shot"><img src={preview} alt="Your fridge" /></div>}
      {state === 'idle' && <button className="btn primary big" onClick={() => setShowCam(true)}>Scan my fridge</button>}
      {state === 'loading' && <Loader text="Reading your ingredients…" />}
      {state === 'error' && <div className="stack"><p className="error">{error}</p><button className="btn ghost" onClick={() => setShowCam(true)}>Try another photo</button></div>}
      {state === 'done' && result && (
        <div className="stack">
          <div className="chips">{result.ingredients?.map((ing, i) => <span className="chip" key={i}>{ing}</span>)}</div>
          <div className="card meal-card">
            <p className="eyebrow accent">Best fit for your macros</p>
            <h2 className="meal-name">{result.meal?.name}</h2>
            <p className="meal-desc">{result.meal?.description}</p>
            <MacroRow m={result.meal} />
            <p className="fit-note">{result.meal?.fit_note}</p>
            {logged ? <p className="logged-ok">Added to today ✓</p> : <button className="btn primary" onClick={() => { onLog(result.meal); setLogged(true) }}>Log this meal</button>}
          </div>
          <button className="btn ghost" onClick={() => setShowCam(true)}>Scan again</button>
        </div>
      )}
      {showCam && <CameraCapture onCapture={(file) => { setShowCam(false); handleFile(file) }} onClose={() => setShowCam(false)} />}
    </div>
  )
}

/* ---------- Meal ---------- */
function MealScan({ onLog }) {
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [logged, setLogged] = useState(false)
  const [cooking, setCooking] = useState('')
  const [meal, setMeal] = useState(mealByHour())
  const [showCam, setShowCam] = useState(false)

  async function handleFile(file) {
    if (!file) return
    setLogged(false); setPreview(URL.createObjectURL(file)); setState('loading'); setError('')
    try {
      const data = await scaleImageToBase64(file, 900)
      const json = await analyze({ mode: 'meal', image: data, mediaType: 'image/jpeg', extras: cooking.trim() || undefined })
      setResult(json); setState('done')
    } catch (err) { setError(err.message); setState('error') }
  }

  return (
    <div className="stack">
      <p className="eyebrow">Meal scan</p>
      <h1 className="h1">Snap your plate.</h1>
      <p className="lead">Photograph any meal and the AI logs the calories and macros — no manual food diary.</p>
      {state === 'idle' && (
        <label className="field">Cooked with any oil, butter, dressing or sauce? (optional — improves accuracy)
          <input value={cooking} onChange={(e) => setCooking(e.target.value)} placeholder="e.g. 1 tbsp olive oil, a spoon of mayo" />
        </label>
      )}
      {preview && <div className="shot"><img src={preview} alt="Your meal" /></div>}
      {state === 'idle' && <button className="btn primary big" onClick={() => setShowCam(true)}>Scan my meal</button>}
      {state === 'loading' && <Loader text="Identifying your meal…" />}
      {state === 'error' && <div className="stack"><p className="error">{error}</p><button className="btn ghost" onClick={() => setShowCam(true)}>Try another photo</button></div>}
      {state === 'done' && result && (
        <div className="stack">
          <div className="card meal-card">
            <p className="eyebrow accent">Detected · {result.confidence} confidence</p>
            <h2 className="meal-name">{result.food_name}</h2>
            <div className="chips">{result.items?.map((it, i) => <span className="chip" key={i}>{it}</span>)}</div>
            <MacroRow m={result} />
            <label className="field" style={{ marginTop: 8 }}>Meal<select value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></label>
            {logged ? <p className="logged-ok">Added to today ✓</p> : <button className="btn primary" onClick={() => { onLog({ ...result, name: result.food_name, meal_type: meal }); setLogged(true) }}>Add to today</button>}
          </div>
          <button className="btn ghost" onClick={() => setShowCam(true)}>Scan again</button>
        </div>
      )}
      {showCam && <CameraCapture onCapture={(file) => { setShowCam(false); handleFile(file) }} onClose={() => setShowCam(false)} />}
    </div>
  )
}

/* ---------- Body / Progress ---------- */
// Brands with features.progressHub get the full Progress hub (photos + compare,
// AI scan, measurements, in-gym training progress). Others keep the original
// two-tab Body screen unchanged.
function Body({ measurements, onAdd, clientId, coachName }) {
  const hub = THEME.features?.progressHub
  const [tab, setTab] = useState(hub ? 'photos' : 'scan')
  const [plans, setPlans] = useState([])

  useEffect(() => {
    if (!hub) return
    supabase.from('workout_plans').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => setPlans(data || []))
  }, [])

  if (!hub) {
    return (
      <div className="stack">
        <p className="eyebrow">Body scan</p>
        <h1 className="h1">Track your progress.</h1>
        <div className="seg">
          <button type="button" className={tab === 'scan' ? 'on' : ''} onClick={() => setTab('scan')}>AI scan</button>
          <button type="button" className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>Measurements</button>
        </div>
        {tab === 'scan' ? <BodyScan clientId={clientId} coachName={coachName} /> : <BodyLog measurements={measurements} onAdd={onAdd} />}
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="eyebrow">Progress</p>
      <h1 className="h1">Your progress.</h1>
      <div className="seg four">
        <button type="button" className={tab === 'photos' ? 'on' : ''} onClick={() => setTab('photos')}>Photos</button>
        <button type="button" className={tab === 'scan' ? 'on' : ''} onClick={() => setTab('scan')}>Body scan</button>
        <button type="button" className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>Measurements</button>
        <button type="button" className={tab === 'train' ? 'on' : ''} onClick={() => setTab('train')}>Training</button>
      </div>
      {tab === 'photos' && <ProgressPhotos clientId={clientId} />}
      {tab === 'scan' && <BodyScan clientId={clientId} coachName={coachName} />}
      {tab === 'log' && <BodyLog measurements={measurements} onAdd={onAdd} />}
      {tab === 'train' && (
        plans.length ? <LiftProgress plans={plans} title="Weights lifted" />
          : <p className="muted-note">Log some weights in your sessions and your strength trend shows here.</p>
      )}
    </div>
  )
}

const BODY_POSES = [['front', 'Front'], ['side', 'Side'], ['back', 'Back']]
function BodyScan({ clientId, coachName }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const [scans, setScans] = useState([])
  const [state, setState] = useState('idle') // idle | scanning | done | error
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [pose, setPose] = useState('front')
  const [showCam, setShowCam] = useState(false)

  async function load() {
    const { data } = await supabase.from('body_scans').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20)
    setScans(data || [])
  }
  useEffect(() => { load() }, [])

  async function handleFile(file) {
    if (!file) return
    setError(''); setSummary(''); setState('scanning')
    try {
      const current = await scaleImageToBase64(file, 800)
      // Compare against the most recent prior photo of the SAME pose (front vs
      // front), so the AI reads real change not a change of angle. Older scans
      // with no pose count as "front" for back-compatibility.
      let frames = [current]
      const prev = scans.find((s) => (s.pose || 'front') === pose) || null
      if (prev) {
        try {
          const { data: signed } = await supabase.storage.from('body-photos').createSignedUrl(prev.photo_path, 300)
          if (signed?.signedUrl) frames = [await urlToBase64(signed.signedUrl, 800), current] // previous first, latest second
        } catch { /* compare is best-effort */ }
      }
      // Upload the full photo and run the scan in parallel.
      const path = `${clientId}/${crypto.randomUUID()}.jpg`
      const uploadPromise = supabase.storage.from('body-photos').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
      const { summary: s } = await analyze({ mode: 'bodyscan', frames })
      if (s) setSummary(s)
      const up = await uploadPromise
      if (up.error) throw new Error(up.error.message)
      const { data } = await supabase.from('body_scans').insert({ client_id: clientId, photo_path: path, summary: s || null, pose }).select().single()
      if (data) setScans((c) => [data, ...c])
      setState('done')
    } catch (err) { setError(err.message); setState('error') }
  }

  const first = scans.length === 0
  const poseLabel = (BODY_POSES.find((p) => p[0] === pose) || [])[1] || 'Front'
  return (
    <div className="stack">
      <p className="lead">{first
        ? 'Take front, side and back photos — these become your baseline. Each time, the AI compares the same angle so you see real change.'
        : 'Add a front, side or back photo and the AI compares it to your last one of that angle.'}</p>
      <p className="eyebrow">Angle</p>
      <div className="seg" style={{ marginBottom: 4 }}>
        {BODY_POSES.map(([v, l]) => <button type="button" key={v} className={pose === v ? 'on' : ''} onClick={() => setPose(v)}>{l}</button>)}
      </div>
      {state !== 'scanning' && <button className="btn primary big" onClick={() => setShowCam(true)}>Add {poseLabel.toLowerCase()} photo</button>}
      {state === 'scanning' && <Loader text="Scanning your progress…" />}
      {summary && <div className="card"><div className="fc-block"><b>{first ? 'Your baseline' : 'Since your last scan'}</b><p>{summary}</p></div></div>}
      {state === 'error' && <p className="error">{error}</p>}
      <p className="disclaimer-note">Photos are private to you and {coachFirst}. AI reads visible change only — it can’t measure exact inches or body-fat, so treat figures as estimates.</p>
      {showCam && <CameraCapture onCapture={(file) => { setShowCam(false); handleFile(file) }} onClose={() => setShowCam(false)} />}
      {scans.map((sc) => <BodyScanCard key={sc.id} scan={sc} />)}
    </div>
  )
}

function BodyScanCard({ scan }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    supabase.storage.from('body-photos').createSignedUrl(scan.photo_path, 3600).then(({ data }) => setUrl(data?.signedUrl || null))
  }, [])
  const when = (scan.created_at || '').slice(0, 10)
  const poseLbl = scan.pose ? scan.pose[0].toUpperCase() + scan.pose.slice(1) : null
  return (
    <div className="card">
      <p className="eyebrow accent">{poseLbl ? poseLbl + ' · ' : 'Scan · '}{when}</p>
      {url ? <div className="shot"><img src={url} alt="Progress scan" /></div> : <p className="muted-note">Loading photo…</p>}
      {scan.summary && <div className="fc-block"><p>{scan.summary}</p></div>}
    </div>
  )
}

function BodyLog({ measurements, onAdd }) {
  const [w, setW] = useState('')
  const [bf, setBf] = useState('')
  const [waist, setWaist] = useState('')
  const [saving, setSaving] = useState(false)
  const latest = measurements[measurements.length - 1]
  const first = measurements[0]

  async function submit(e) {
    e.preventDefault()
    if (!w && !bf && !waist) return
    setSaving(true)
    await onAdd({
      weight_kg: w ? Number(w) : null,
      body_fat: bf ? Number(bf) : null,
      waist_cm: waist ? Number(waist) : null,
    })
    setW(''); setBf(''); setWaist(''); setSaving(false)
  }

  return (
    <div className="stack">
      {latest && (
        <div className="card">
          <div className="metrics-2">
            {latest.weight_kg != null && <Metric k="Weight" v={`${latest.weight_kg}kg`} d={first?.weight_kg != null ? `${(latest.weight_kg - first.weight_kg).toFixed(1)}kg` : ''} />}
            {latest.body_fat != null && <Metric k="Body fat" v={`${latest.body_fat}%`} d={first?.body_fat != null ? `${(latest.body_fat - first.body_fat).toFixed(1)}%` : ''} />}
          </div>
          <TrendChart data={measurements.filter((m) => m.weight_kg != null)} field="weight_kg" />
          <p className="muted-note">Your weight trend over time.</p>
        </div>
      )}

      <form className="card" onSubmit={submit}>
        <p className="eyebrow">Log this week</p>
        <div className="grid-2">
          <label className="field">Weight (kg)<input type="number" step="0.1" value={w} onChange={(e) => setW(e.target.value)} /></label>
          <label className="field">Body fat (%)<input type="number" step="0.1" value={bf} onChange={(e) => setBf(e.target.value)} /></label>
          <label className="field">Waist (cm)<input type="number" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} /></label>
        </div>
        <button className="btn primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save measurement'}</button>
      </form>
    </div>
  )
}

function Metric({ k, v, d }) {
  return (
    <div className="metric">
      <div className="metric-k">{k}</div>
      <div className="metric-v">{v} {d && <span className="delta good">{d}</span>}</div>
    </div>
  )
}

function KimHub({ clientId, coachName, onBack }) {
  const [tab, setTab] = useState('ai')
  return (
    <div className="stack">
      {onBack && <button className="link-btn" onClick={onBack}>‹ Back</button>}
      <p className="eyebrow">Your coach</p>
      <h1 className="h1">{coachName || 'Kim'}, any time.</h1>
      <div className="seg">
        <button type="button" className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')}>Ask AI</button>
        <button type="button" className={tab === 'msg' ? 'on' : ''} onClick={() => setTab('msg')}>Message {coachName?.split(' ')[0] || 'Kim'}</button>
      </div>
      {tab === 'ai'
        ? <AskKim clientId={clientId} coachName={coachName} />
        : (
          <>
            <p className="lead">Message {coachName?.split(' ')[0] || 'your coach'} directly — they’ll reply here.</p>
            <MessageThread clientId={clientId} me="client" placeholder={`Message ${coachName?.split(' ')[0] || 'your coach'}…`} />
          </>
        )}
    </div>
  )
}

function AskKim({ clientId, coachName }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const [knowledge, setKnowledge] = useState([])
  const [comms, setComms] = useState([])
  const [chats, setChats] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('coach_knowledge').select('title, content').then(({ data }) => setKnowledge(data || []))
    supabase.from('messages').select('sender, body').eq('client_id', clientId).order('created_at', { ascending: true }).limit(30).then(({ data }) => setComms(data || []))
    supabase.from('brain_chats').select('*').eq('client_id', clientId).order('created_at', { ascending: true }).limit(50).then(({ data }) => setChats(data || []))
  }, [])

  async function ask() {
    const question = q.trim()
    if (!question || busy) return
    setBusy(true); setError('')
    const tempId = 'temp-' + Date.now()
    setChats((c) => [...c, { id: tempId, question, answer: null }])
    setQ('')
    try {
      const { answer } = await analyze({ mode: 'ask', question, knowledge, comms })
      const { data } = await supabase.from('brain_chats').insert({ client_id: clientId, question, answer }).select().single()
      setChats((c) => c.map((x) => (x.id === tempId ? (data || { id: tempId, question, answer }) : x)))
    } catch (err) {
      setError(err.message)
      setChats((c) => c.filter((x) => x.id !== tempId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <p className="lead">Ask a training or nutrition question and get an answer in {coachFirst}’s method — instantly.</p>

      <div className="chat">
        {chats.length === 0 && (
          <p className="muted-note">Try “How much protein should I aim for?” or “I’m really sore — should I still train?”</p>
        )}
        {chats.map((c) => (
          <div className="chat-pair" key={c.id}>
            <div className="bubble q">{c.question}</div>
            {c.answer === null
              ? <div className="bubble a typing"><span className="spinner tiny" /> {coachFirst}’s brain is thinking…</div>
              : <div className="bubble a">{c.answer}</div>}
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}

      <div className="ask-bar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask ${coachFirst} anything…`} onKeyDown={(e) => { if (e.key === 'Enter') ask() }} />
        <button className="btn primary" disabled={busy || !q.trim()} onClick={ask}>Ask</button>
      </div>
      <p className="disclaimer-note">General guidance in {coachFirst}’s style — not medical advice. For anything specific, message {coachFirst}.</p>
    </div>
  )
}

function FormCheck({ clientId, coachName, onBack }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  const [exercise, setExercise] = useState('')
  const [checks, setChecks] = useState([])
  const [state, setState] = useState('idle')
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  async function load() {
    const { data } = await supabase.from('form_checks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20)
    setChecks(data || [])
  }
  useEffect(() => { load() }, [])

  async function onPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setPreview('')
    try {
      setState('analysing')
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
      const path = `${clientId}/${crypto.randomUUID()}.${ext}`

      // Upload the clip and run the AI form check at the same time, so the
      // pointers (what the client is waiting for) don't sit behind the upload.
      const uploadPromise = supabase.storage.from('form-videos').upload(path, file, { contentType: file.type || 'video/mp4', upsert: false })

      let ai_feedback = null
      try {
        // A video → pull a few frames; a photo → use the photo itself as one frame.
        const frames = file.type.startsWith('image/') ? [await scaleImageToBase64(file, 800)] : await extractFrames(file, 3)
        if (frames.length) {
          const { feedback } = await analyze({ mode: 'form', exercise: exercise.trim(), frames })
          ai_feedback = feedback
          if (feedback) setPreview(feedback) // show pointers instantly, upload keeps running
        }
      } catch { /* AI is best-effort — Kim still reviews */ }

      const up = await uploadPromise
      if (up.error) throw new Error(up.error.message)
      const { data } = await supabase.from('form_checks').insert({ client_id: clientId, storage_path: path, exercise: exercise.trim() || null, ai_feedback }).select().single()
      if (data) setChecks((c) => [data, ...c])
      setExercise('')
      setState('done')
      setTimeout(() => { setState('idle'); setPreview('') }, 4000)
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  return (
    <div className="stack">
      {onBack && <button className="link-btn" onClick={onBack}>‹ Back</button>}
      <p className="eyebrow">Form check</p>
      <h1 className="h1">Check your form.</h1>
      <p className="lead">Upload a short video or a photo of your lift — record a new one or choose an existing file — and get instant AI pointers, then {coachFirst} reviews it.</p>
      <label className="field">Which exercise?<input value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="e.g. Back squat" /></label>
      <input ref={inputRef} type="file" accept="video/*,image/*" hidden onChange={onPick} />
      {state === 'idle' && <button className="btn primary big" onClick={() => inputRef.current?.click()}>Upload a video or photo</button>}
      {state === 'analysing' && !preview && <Loader text="Checking your form…" />}
      {preview && <div className="card"><div className="fc-block"><b>Instant AI pointers</b><p>{preview}</p></div>{state === 'analysing' && <p className="disclaimer-note">Saving your clip for {coachFirst}…</p>}</div>}
      {state === 'done' && <p className="logged-ok">Sent to {coachFirst} ✓</p>}
      {state === 'error' && <div className="stack"><p className="error">{error}</p><button className="btn ghost" onClick={() => inputRef.current?.click()}>Try again</button></div>}
      <p className="disclaimer-note">Keep clips short (a few reps). AI pointers are general guidance — {coachFirst} gives the final word.</p>

      {checks.map((c) => <FormCheckCard key={c.id} check={c} coachFirst={coachFirst} />)}
    </div>
  )
}

function FormCheckCard({ check, coachFirst }) {
  const coach = coachFirst || 'your coach'
  const [url, setUrl] = useState(null)
  const isImage = /\.(jpe?g|png|webp|heic|gif)$/i.test(check.storage_path || '')
  useEffect(() => {
    supabase.storage.from('form-videos').createSignedUrl(check.storage_path, 3600).then(({ data }) => setUrl(data?.signedUrl || null))
  }, [])
  return (
    <div className="card">
      <p className="eyebrow accent">{check.exercise || 'Form check'}</p>
      {url
        ? (isImage ? <div className="shot"><img src={url} alt="Form check" /></div> : <video className="form-video" src={url} controls playsInline />)
        : <p className="muted-note">Loading…</p>}
      {check.ai_feedback && <div className="fc-block"><b>AI pointers</b><p>{check.ai_feedback}</p></div>}
      {check.coach_feedback
        ? <div className="fc-block coach"><b>From {coach}</b><p>{check.coach_feedback}</p></div>
        : <p className="muted-note">{coach} will review this and add feedback.</p>}
    </div>
  )
}

function IgEmbed({ url }) {
  useEffect(() => {
    if (!document.getElementById('ig-embed-js')) {
      const s = document.createElement('script')
      s.id = 'ig-embed-js'
      s.async = true
      s.src = 'https://www.instagram.com/embed.js'
      s.onload = () => window.instgrm?.Embeds?.process()
      document.body.appendChild(s)
    } else {
      window.instgrm?.Embeds?.process()
    }
  }, [url])
  return (
    <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-width="100%" style={{ margin: 0, width: '100%', minHeight: 120 }}>
      <a href={url} target="_blank" rel="noreferrer">View on Instagram</a>
    </blockquote>
  )
}

function IGContent({ coachName, onBack }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const first = coachName?.split(' ')[0] || 'Kim'
  useEffect(() => {
    supabase.from('featured_content').select('*').order('created_at', { ascending: false }).then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])
  return (
    <div className="stack">
      {onBack && <button className="link-btn" onClick={onBack}>‹ Back</button>}
      <p className="eyebrow">From {first}</p>
      <h1 className="h1">Content &amp; inspiration.</h1>
      <p className="lead">Posts and reels {first} wants you to see.</p>
      {loading && <p className="muted-note">Loading…</p>}
      {!loading && items.length === 0 && <p className="muted-note">No content yet — check back soon.</p>}
      {items.map((it) => (
        <div className="card ig-card" key={it.id}>
          {it.caption && <p className="ig-caption">{it.caption}</p>}
          {it.image_path
            ? <img className="content-img" src={supabase.storage.from('content-images').getPublicUrl(it.image_path).data.publicUrl} alt={it.caption || 'Content'} />
            : <IgEmbed url={it.ig_url} />}
        </div>
      ))}
      {THEME.instagram && <a className="btn ghost" href={`https://www.instagram.com/${THEME.instagram}`} target="_blank" rel="noreferrer">Follow {first} on Instagram</a>}
      {THEME.tiktok && <a className="btn ghost" href={`https://www.tiktok.com/@${THEME.tiktok}`} target="_blank" rel="noreferrer">Follow {first} on TikTok</a>}
    </div>
  )
}

/* ---------- Grouped hubs (brands with a grouped nav, e.g. ReDefine) ---------- */
function TrainHub({ coachName, onGo }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  return (
    <div className="stack">
      <p className="eyebrow">Train</p>
      <h1 className="h1">Your training.</h1>
      <p className="lead">Everything for the gym floor in one place.</p>
      <div className="tiles">
        <button className="tile tile-hero" onClick={() => onGo('train')}>
          <IconTrain />
          <div><b>Today’s session</b><span>Start a workout, generate one, or build your own</span></div>
        </button>
        {THEME.features?.programs && (
          <button className="tile" onClick={() => onGo('programs')}>
            <IconTrain />
            <div><b>Program library</b><span>Follow a full plan built by {coachFirst}</span></div>
          </button>
        )}
        <button className="tile" onClick={() => onGo('muscles')}>
          <IconTrain />
          <div><b>Muscle targeter</b><span>Tap a muscle, get exercises to train it</span></div>
        </button>
        <button className="tile" onClick={() => onGo('strava')}>
          <IconBody />
          <div><b>Connect Strava</b><span>Pull your runs, rides &amp; workouts into the app</span></div>
        </button>
        {THEME.features?.testing && (
          <button className="tile" onClick={() => onGo('testing')}>
            <IconTest />
            <div><b>Performance testing</b><span>Log your tests &amp; track your PBs</span></div>
          </button>
        )}
      </div>
    </div>
  )
}

function NutritionStyle({ profile }) {
  const [style, setStyle] = useState(profile.nutrition_style || '')
  const [saved, setSaved] = useState(false)
  async function pick(s) {
    setStyle(s); setNutritionStyle(s)
    await supabase.from('profiles').update({ nutrition_style: s }).eq('id', profile.id)
    setSaved(true); setTimeout(() => setSaved(false), 1200)
  }
  return (
    <div className="card">
      <p className="eyebrow">Nutrition style</p>
      <p className="muted-note">How much detail do you want from your nutrition coaching? Change any time.</p>
      <div className="level-picker" style={{ marginTop: 8 }}>
        <button type="button" className={'level-opt' + (style === 'lifestyle' ? ' on' : '')} onClick={() => pick('lifestyle')}>
          <div className="level-body"><b>Lifestyle</b><span>A healthy relationship with food — sensible intake, good quality, and the foods you enjoy.</span></div>
        </button>
        <button type="button" className={'level-opt' + (style === 'performance' ? ' on' : '')} onClick={() => pick('performance')}>
          <div className="level-body"><b>Performance &amp; recovery</b><span>Go deeper — macro splits, nutrient timing and recovery to maximise results.</span></div>
        </button>
      </div>
      {saved && <p className="logged-ok">Saved ✓</p>}
    </div>
  )
}

function NutritionHub({ profile, coachName, onGo }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  return (
    <div className="stack">
      <p className="eyebrow">Nutrition</p>
      <h1 className="h1">Fuel your day.</h1>
      <p className="lead">Log food, scan meals and stay on your targets.</p>
      {THEME.features?.nutritionStyle && <NutritionStyle profile={profile} />}
      <div className="tiles">
        <button className="tile tile-hero" onClick={() => onGo('diary')}>
          <IconMeal />
          <div><b>Food diary</b><span>See &amp; edit each day, plan meals ahead</span></div>
        </button>
        <button className="tile tile-hero" onClick={() => onGo('meal')}>
          <IconMeal />
          <div><b>Scan a meal</b><span>Photo → calories &amp; macros</span></div>
        </button>
        <button className="tile tile-hero" onClick={() => onGo('fridge')}>
          <IconFridge />
          <div><b>Fridge-to-Plate</b><span>Snap your fridge, get a meal that fits your macros</span></div>
        </button>
        <button className="tile" onClick={() => onGo('food')}>
          <IconMeal />
          <div><b>Log food</b><span>Search foods &amp; drinks, add your portion</span></div>
        </button>
        {THEME.features?.barcode && (
          <button className="tile" onClick={() => onGo('barcode')}>
            <IconMeal />
            <div><b>Barcode scan</b><span>Scan a product, log it in a tap</span></div>
          </button>
        )}
        {THEME.features?.recipes && (
          <button className="tile" onClick={() => onGo('recipes')}>
            <IconMeal />
            <div><b>Recipes</b><span>{coachFirst}’s go-to meals, log in one tap</span></div>
          </button>
        )}
        {THEME.features?.mealPlans && (
          <button className="tile tile-hero" onClick={() => onGo('mealplan')}>
            <IconMeal />
            <div><b>Meal plan</b><span>Build a day around your targets</span></div>
          </button>
        )}
        <button className="tile" onClick={() => onGo('calc')}>
          <IconMeal />
          <div><b>Calorie calculator</b><span>Recalculate your targets any time</span></div>
        </button>
        <button className="tile" onClick={() => onGo('health')}>
          <IconAsk />
          <div><b>My details</b><span>Health conditions &amp; life circumstances — optional</span></div>
        </button>
      </div>
    </div>
  )
}

// Coach & Community hub (brands with a `coachhub` nav tab — Paul). Community
// and the video library lead, per his ask; everything else that used to be
// scattered Home tiles or a standalone Videos tab lives here now.
function CoachHub({ coachName, onGo }) {
  const coachFirst = coachName?.split(' ')[0] || 'your coach'
  return (
    <div className="stack">
      <p className="eyebrow">Coach &amp; Community</p>
      <h1 className="h1">{coachFirst} &amp; the crew.</h1>
      <p className="lead">Everyone and everything outside training and nutrition.</p>
      <div className="tiles">
        <button className="tile tile-hero" onClick={() => onGo('community')}>
          <IconCommunity />
          <div><b>Community</b><span>Share wins &amp; cheer each other on</span></div>
        </button>
        {THEME.features?.videos && (
          <button className="tile tile-hero" onClick={() => onGo('videos')}>
            <IconContent />
            <div><b>Video library</b><span>Technique &amp; mindset clips from {coachFirst}</span></div>
          </button>
        )}
        <button className="tile" onClick={() => onGo('ask')}>
          <IconAsk />
          <div><b>Ask {coachFirst}</b><span>Get an answer in {coachFirst}’s method, any time</span></div>
        </button>
        <button className="tile" onClick={() => onGo('form')}>
          <IconForm />
          <div><b>Form check</b><span>Upload a clip — AI + {coachFirst} check your form</span></div>
        </button>
        <button className="tile" onClick={() => onGo('content')}>
          <IconContent />
          <div><b>From {coachFirst}</b><span>{coachFirst}’s latest posts &amp; inspiration</span></div>
        </button>
        {THEME.features?.supplements && (
          <button className="tile" onClick={() => onGo('supplements')}>
            <IconMeal />
            <div><b>Supplements</b><span>Trusted brands &amp; your discount code</span></div>
          </button>
        )}
        {THEME.features?.shop && (
          <button className="tile" onClick={() => onGo('shop')}>
            <IconContent />
            <div><b>Shop</b><span>{coachFirst}’s book, merch &amp; gear</span></div>
          </button>
        )}
        {THEME.features?.podcasts && (
          <button className="tile" onClick={() => onGo('podcasts')}>
            <IconContent />
            <div><b>Podcasts</b><span>Listen to {coachFirst}’s episodes</span></div>
          </button>
        )}
        {THEME.features?.files && (
          <button className="tile" onClick={() => onGo('files')}>
            <IconForm />
            <div><b>Files</b><span>{coachFirst}’s guides &amp; resources</span></div>
          </button>
        )}
      </div>
    </div>
  )
}

// In-app recalculator. Reuses the onboarding maths but only ever upserts
// macro_targets + the profile stats — never onboarded_at, and never inserts a
// "Starting weight" row (that belongs to first-run onboarding only).
function CalcTargets({ profile, onSaveTargets, onBack }) {
  const [sex, setSex] = useState(profile.sex || 'male')
  const [age, setAge] = useState(profile.age ? String(profile.age) : '')
  const [height, setHeight] = useState(profile.height_cm ? String(profile.height_cm) : '')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState(profile.activity_level || 'moderate')
  const [goal, setGoal] = useState(profile.goal || 'lose')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill weight from the most recent measurement so a recalc starts from today.
  useEffect(() => {
    supabase.from('body_measurements').select('weight_kg').eq('client_id', profile.id)
      .not('weight_kg', 'is', null).order('measured_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data && data[0]?.weight_kg != null) setWeight(String(data[0].weight_kg)) })
  }, [])

  const valid = Number(age) >= 13 && Number(age) <= 100 && Number(height) >= 120 && Number(height) <= 230 && Number(weight) >= 30 && Number(weight) <= 300
  const targets = valid ? computeTargets({ sex, age: Number(age), height_cm: Number(height), weight_kg: Number(weight), activity, goal }) : null

  async function apply() {
    if (!targets) return
    setSaving(true); setError('')
    try {
      await onSaveTargets({ calories: targets.calories, protein_g: targets.protein_g, carbs_g: targets.carbs_g, fat_g: targets.fat_g })
      const upP = await supabase.from('profiles').update({ sex, age: Number(age), height_cm: Number(height), activity_level: activity, goal }).eq('id', profile.id)
      if (upP.error) throw new Error(upP.error.message)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">Calorie calculator</p>
      <h1 className="h1">Recalculate your targets.</h1>
      <p className="lead">Update your numbers and we’ll set fresh calorie and macro targets.</p>
      <div className="card">
        <div className="seg small">
          <button type="button" className={sex === 'male' ? 'on' : ''} onClick={() => setSex('male')}>Male</button>
          <button type="button" className={sex === 'female' ? 'on' : ''} onClick={() => setSex('female')}>Female</button>
        </div>
        <div className="grid-2">
          <label className="field">Age<input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="years" /></label>
          <label className="field">Height (cm)<input type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="cm" /></label>
          <label className="field">Weight (kg)<input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg" /></label>
        </div>
        <label className="field">Activity
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            {ACTIVITY.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
        <label className="field">Goal
          <select value={goal} onChange={(e) => setGoal(e.target.value)}>
            {GOALS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </label>
      </div>
      {targets && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="eyebrow accent">New daily target</p>
          <p style={{ fontSize: 34, fontWeight: 700, margin: '4px 0' }}>{targets.calories} <span className="muted" style={{ fontSize: 16 }}>kcal</span></p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 8 }}>
            <span><b>{targets.protein_g}g</b><span className="muted" style={{ display: 'block', fontSize: 12 }}>Protein</span></span>
            <span><b>{targets.carbs_g}g</b><span className="muted" style={{ display: 'block', fontSize: 12 }}>Carbs</span></span>
            <span><b>{targets.fat_g}g</b><span className="muted" style={{ display: 'block', fontSize: 12 }}>Fat</span></span>
          </div>
          <p className="muted-note" style={{ marginTop: 12 }}>Maintenance is around {targets.tdee} kcal.</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <button className="btn primary big" disabled={!targets || saving} onClick={apply}>{saving ? 'Saving…' : 'Save new targets'}</button>
      {saved && <p className="logged-ok">Targets updated ✓</p>}
    </div>
  )
}

// Client-editable health conditions + life circumstances (Paul's ask). Same
// fields captured at onboarding, editable any time. Feeds AI tone only —
// see healthLine() in analyse.mjs — never changes calorie/macro maths.
function HealthDetails({ profile, onBack, onSaved }) {
  const [nutritionSensitive, setNutritionSensitive] = useState(!!profile.nutrition_sensitive)
  const [nutritionSensitiveNote, setNutritionSensitiveNote] = useState(profile.nutrition_sensitive_note || '')
  const [healthConditions, setHealthConditions] = useState(profile.health_conditions || '')
  const [hasKids, setHasKids] = useState(!!profile.has_kids)
  const [singleParent, setSingleParent] = useState(!!profile.single_parent)
  const [shiftWorker, setShiftWorker] = useState(!!profile.shift_worker)
  const [lifeContextNote, setLifeContextNote] = useState(profile.life_context_note || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    const patch = {
      nutrition_sensitive: nutritionSensitive, nutrition_sensitive_note: nutritionSensitive ? (nutritionSensitiveNote.trim() || null) : null,
      health_conditions: healthConditions.trim() || null,
      has_kids: hasKids, single_parent: singleParent, shift_worker: shiftWorker,
      life_context_note: lifeContextNote.trim() || null,
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id)
    setSaving(false)
    if (!error) { onSaved(patch); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="stack">
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow">My details</p>
      <h1 className="h1">Health &amp; circumstances.</h1>
      <p className="lead">Optional — sharing this helps your coach and the AI support you better. Private to you and your coach.</p>
      <div className="card">
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={nutritionSensitive} onChange={(e) => setNutritionSensitive(e.target.checked)} style={{ width: 'auto' }} />
          I’ve struggled with disordered eating
        </label>
        {nutritionSensitive && (
          <label className="field" style={{ marginTop: 8 }}>What do you find hardest? (optional — guides the AI)
            <input value={nutritionSensitiveNote} onChange={(e) => setNutritionSensitiveNote(e.target.value)} placeholder="e.g. increasing calories, fear foods, eating regularly" />
          </label>
        )}
      </div>
      <div className="card">
        <label className="field">Any health conditions we should know about?
          <input value={healthConditions} onChange={(e) => setHealthConditions(e.target.value)} placeholder="e.g. PCOS, menopause, thyroid, PoTS" />
        </label>
      </div>
      <div className="card">
        <p className="eyebrow">Life circumstances</p>
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <input type="checkbox" checked={hasKids} onChange={(e) => setHasKids(e.target.checked)} style={{ width: 'auto' }} />
          I have kids
        </label>
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <input type="checkbox" checked={singleParent} onChange={(e) => setSingleParent(e.target.checked)} style={{ width: 'auto' }} />
          I’m a single parent
        </label>
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <input type="checkbox" checked={shiftWorker} onChange={(e) => setShiftWorker(e.target.checked)} style={{ width: 'auto' }} />
          I work shifts
        </label>
        <label className="field" style={{ marginTop: 8 }}>Anything else?
          <input value={lifeContextNote} onChange={(e) => setLifeContextNote(e.target.value)} placeholder="e.g. travel a lot for work, caring responsibilities" />
        </label>
      </div>
      <button className="btn primary big" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      {saved && <p className="logged-ok">Saved ✓</p>}
    </div>
  )
}

function Tab({ id, label, active, onGo, icon: Icon }) {
  return (
    <button className={'tab' + (active === id ? ' on' : '')} onClick={() => onGo(id)}>
      <Icon /><span>{label}</span>
    </button>
  )
}
