import React, { useState, useEffect } from 'react'
import { getRecovery, getHealthContext, apiUrl } from './lib.js'
import { THEME } from './themes.js'
import { supabase } from './supabaseClient.js'
import { PRICE_NOTE } from './mealPrices.js'
import { STORES, searchUrl } from './shopLinks.js'

// Client meal-plan builder. Uses their saved macro targets as the budget, asks a
// few qualifying questions, then the AI returns either:
//   - a DAY, where picking one option per meal lands on target, or
//   - a WEEK, one meal per slot, with the shopping list to go with it.
//
// A week is deliberately one meal per slot rather than a menu: a shopping list
// only means anything if it matches exactly what the plan says to eat.
//
// Two things fix "boring and repetitive". A week can't repeat a meal within
// itself, and every regenerate — whole plan or single meal — sends back what it
// has just offered as an `avoid` list, so "build another" is genuinely another.
const DIETARY = ['Vegetarian', 'Vegan', 'Pescatarian', 'Dairy-free', 'Gluten-free', 'Halal']

// The week is planned from today forward, so a day card can say what it actually
// is and "Log this" can put the meal on the right date.
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function dayDate(i) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); return d }
function dayLabel(i) { return i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WD[dayDate(i).getDay()] }

// Week plans are Rick.Fit only. Paul has `mealPlans` too, and the week path has
// never run on his clients' eating — it went live on Ricky's own site first,
// deliberately. Gating it on a flag rather than on remembering not to deploy is
// what actually keeps that true: the code is shared, so any Paul deploy would
// otherwise ship it.
//
// Gated in three places, because the toggle alone is not enough: a week saved in
// localStorage would put a brand without the flag straight back into week mode
// on mount, and the submit handler would still take the week branch.
const WEEK_ON = THEME.features?.weekMealPlans === true

// Tappable meal cards, with the ingredient quantities and the method behind
// them. Flagged separately from the week, because recipes apply to a single
// day too and a day plan is live on Kim's and Paul's clients — without a flag
// the next deploy of either would ship this to them untested.
const RECIPES_ON = THEME.features?.mealRecipes === true

// Which supermarket the shopping list links out to. Its own key rather than a
// field on the week, so choosing Asda once survives building a new week — and
// so clearing the week does not quietly put it back to Tesco.
const STORE_KEY = 'mp_store_v1'
const loadStore = () => { try { return STORES.some((s) => s.id === localStorage.getItem(STORE_KEY)) ? localStorage.getItem(STORE_KEY) : STORES[0].id } catch { return STORES[0].id } }
const saveStore = (v) => { try { localStorage.setItem(STORE_KEY, v) } catch { /* private mode */ } }

const WEEK_KEY = 'mp_week_v1'
const loadWeek = () => { try { return JSON.parse(localStorage.getItem(WEEK_KEY) || 'null') } catch { return null } }
const saveWeek = (v) => { try { v ? localStorage.setItem(WEEK_KEY, JSON.stringify(v)) : localStorage.removeItem(WEEK_KEY) } catch { /* private mode */ } }

const macroLine = (o) => [o.calories ? o.calories + ' kcal' : null, o.protein_g ? o.protein_g + 'g P' : null, o.carbs_g ? o.carbs_g + 'g C' : null, o.fat_g ? o.fat_g + 'g F' : null].filter(Boolean).join(' · ')

export function MealPlanBuilder({ targets, onLog, coachName, onBack }) {
  const [mode, setMode] = useState('day')
  const [days, setDays] = useState(7)
  const [meals, setMeals] = useState(3)
  const [options, setOptions] = useState(2)
  const [snacks, setSnacks] = useState(false)
  const [diet, setDiet] = useState([])
  const [allergies, setAllergies] = useState('')
  const [prefs, setPrefs] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0) // n = building day n, -1 = shopping
  const [stalled, setStalled] = useState(0)   // days completed when it gave up
  const [swapping, setSwapping] = useState('')
  const [plan, setPlan] = useState(null)
  const [week, setWeek] = useState(null)
  const [ticked, setTicked] = useState([])
  const [store, setStore] = useState(loadStore)
  const [err, setErr] = useState('')
  const [logged, setLogged] = useState('')
  const [openMeal, setOpenMeal] = useState('')
  const [recipeBusy, setRecipeBusy] = useState('')
  const [recipeErr, setRecipeErr] = useState('')

  // A shopping list is no use if it dies the moment they leave the screen — the
  // whole point is to have it in the shop. Restore the last week they built.
  useEffect(() => {
    const saved = loadWeek()
    if (WEEK_ON && saved?.plan?.days?.length) {
      const p = saved.plan
      // Restore the ANSWERS the week was built from, not just the week.
      //
      // They live in plain component state, so a reload used to bring the week
      // back with the form blank behind it — and the next swap went off with no
      // allergies, no dietary requirements and meals reset to 3. A vegetarian
      // week could come back with chicken in it, and an allergy could be
      // reintroduced by the app that had just been told about it.
      const i = p.inputs
      if (i) {
        if (Number(i.meals)) setMeals(Number(i.meals))
        if (Number(i.options)) setOptions(Number(i.options))
        setSnacks(!!i.snacks)
        setDiet(Array.isArray(i.diet) ? i.diet : [])
        setAllergies(String(i.allergies || ''))
        setPrefs(String(i.prefs || ''))
      }
      setWeek(p); setTicked(saved.ticked || []); setMode('week')
    }
  }, [])

  const toggleDiet = (d) => setDiet((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))
  const hasTargets = !!targets?.calories
  const recovery = getRecovery()

  // The shopping list links OUT to a supermarket's own search. It is a search
  // and not a basket for a reason, and the reason is in src/shopLinks.js.
  const shopAt = STORES.find((x) => x.id === store) || STORES[0]
  const shopUrl = (line) => searchUrl(shopAt.id, line)

  // Everything currently on offer. Sent back on a regenerate so the next one
  // isn't the same four dinners again. Takes the accumulator explicitly while a
  // week is mid-build, because `week` state hasn't caught up between days.
  const titlesOf = (w, p) => {
    const out = []
    if (p?.meals) p.meals.forEach((ml) => ml.options.forEach((o) => out.push(o.title)))
    if (w?.days) w.days.forEach((d) => d.meals.forEach((m) => out.push(m.title)))
    return out
  }
  const currentTitles = () => titlesOf(week, plan)

  const baseBody = () => ({
    calories: targets.calories, protein_g: targets.protein_g, carbs_g: targets.carbs_g, fat_g: targets.fat_g,
    meals, options, snacks, dietary: diet.join(', '), allergies, preferences: prefs,
    recovery: getRecovery(), healthContext: getHealthContext(),
    wantIngredients: RECIPES_ON,
  })

  // Saved alongside the week so a reload can put the form back, and so a swap
  // or a recipe asked for tomorrow still honours today's allergies.
  const inputsOf = () => ({ meals, options, snacks, diet, allergies, prefs })

  async function post(body) {
    const headers = { 'content-type': 'application/json' }
    // The recipe action resolves identity from the verified session, so every
    // request carries the token. getSession refreshes an expired one on the way
    // past; if there genuinely is no session the app is already at the login
    // screen, so a missing token here is not worth a special case.
    try {
      const t = (await supabase.auth.getSession())?.data?.session?.access_token
      if (t) headers.authorization = `Bearer ${t}`
    } catch { /* the older actions do not need it */ }
    const res = await fetch(apiUrl('/.netlify/functions/meal-plan'), {
      method: 'POST', headers, body: JSON.stringify(body),
    })
    return res.json()
  }

  async function generate() {
    if (!hasTargets) { setErr('Your calorie targets aren’t set yet — do the quick setup first.'); return }
    if (WEEK_ON && mode === 'week') { buildWeek(0, { days: [], shopping: [] }); return }
    setBusy(true); setErr('')
    try {
      setPlan(null)
      const j = await post({ ...baseBody(), avoid: currentTitles() })
      if (j.meals) setPlan(j); else setErr(j.error || 'Nothing came back — try again.')
    } catch {
      setErr('Something went wrong — try again.')
    } finally {
      setBusy(false)
    }
  }

  // The week is built a day at a time — a whole week in one request times out at
  // the edge and you get nothing back. So each day lands on screen as it
  // arrives, and each one is saved as it lands: if day 5 of 7 fails, days 1-4
  // are still there and still his, and "carry on" picks up where it stopped
  // rather than starting the week again.
  async function buildWeek(from, seed) {
    setBusy(true); setErr(''); setStalled(0)
    let acc = from === 0 ? { days: [], shopping: [], note: '', inputs: inputsOf() } : seed
    if (from === 0) { setTicked([]); setWeek(acc); saveWeek(null) }
    try {
      // Decide the shape of the week before cooking any of it — which proteins
      // get bought, and which day is cooked which way. Carried on the plan so
      // "carry on from Thursday" resumes into the same week rather than a new
      // one. Cheap enough that a resume can just redo it if it's missing.
      let themes = acc.themes
      let proteins = acc.proteins
      if (!themes?.length) {
        setProgress(0)
        const k = await post({ ...baseBody(), skeleton: true, days })
        themes = k.themes || []
        proteins = k.proteins || []
        acc = { ...acc, themes, proteins }
      }

      for (let i = from; i < days; i++) {
        setProgress(i + 1)
        const j = await post({
          ...baseBody(), weekDay: true, dayLabel: dayLabel(i),
          theme: themes[i] || null, proteins,
          avoid: titlesOf(acc, null),
        })
        if (!j.day?.meals?.length) {
          setErr(j.error || `Day ${i + 1} didn’t come back.`)
          setStalled(i)
          return
        }
        acc = { ...acc, days: [...acc.days, j.day] }
        setWeek(acc); saveWeek({ plan: acc, ticked: [] })
      }
      // Shopping last, from the days that actually exist. Absent beats wrong.
      setProgress(-1)
      const meals = acc.days.flatMap((d) => d.meals)
      const s = await post({ ...baseBody(), shoppingFor: meals })
      // The cost comes back with the list it was worked out from, in the same
      // response, so the two cannot drift apart.
      acc = { ...acc, shopping: s.shopping || [], cost: s.cost || null, stale: false }
      setWeek(acc); saveWeek({ plan: acc, ticked: [] })
      if (!s.shopping?.length) setErr('The plan is done, but the shopping list didn’t come back — tap “Shopping list” to try that bit again.')
    } catch {
      setErr('Something went wrong — your days so far are saved.')
      setStalled(acc.days.length)
    } finally {
      setBusy(false); setProgress(0)
    }
  }

  // Just the shopping, for whatever days are on screen. Also the retry when the
  // list is the only thing that failed, or has gone stale after a swap.
  async function buildShopping() {
    if (!week?.days?.length) return
    setBusy(true); setErr(''); setProgress(-1)
    try {
      const s = await post({ ...baseBody(), shoppingFor: week.days.flatMap((d) => d.meals) })
      if (s.shopping?.length) {
        const next = { ...week, shopping: s.shopping, cost: s.cost || null, stale: false }
        setWeek(next); saveWeek({ plan: next, ticked })
      } else setErr(s.error || 'The shopping list didn’t come back — try again.')
    } catch {
      setErr('Something went wrong — try again.')
    } finally {
      setBusy(false); setProgress(0)
    }
  }

  // "I don't fancy that" — replace ONE meal and keep everything else. The meal
  // being replaced goes into `avoid` alongside the rest of the plan, so it can't
  // come back as its own replacement.
  async function swap(key, mealName, current, onResult) {
    if (busy || swapping) return
    setSwapping(key); setErr('')
    try {
      const per = Math.max(1, meals + (snacks ? 1 : 0))
      const j = await post({
        ...baseBody(),
        options: 1, // one replacement, straight in — not another menu to read
        swapMeal: mealName,
        mealCalories: current.calories || Math.round(targets.calories / per),
        mealProtein: current.protein_g || Math.round(targets.protein_g / per),
        avoid: [...new Set([...currentTitles(), current.title])],
      })
      if (j.options?.length) onResult(j.options)
      else setErr(j.error || 'Couldn’t find another one — try again.')
    } catch {
      setErr('Something went wrong — try again.')
    } finally {
      setSwapping('')
    }
  }

  function swapDayMeal(mi, oi) {
    const ml = plan.meals[mi]
    swap(`d${mi}-${oi}`, ml.name, ml.options[oi], (opts) => {
      setPlan((p) => {
        const next = { ...p, meals: p.meals.map((m, i) => (i === mi ? { ...m, options: m.options.map((o, k) => (k === oi ? opts[0] : o)) } : m)) }
        return next
      })
    })
  }

  function swapWeekMeal(di, mi) {
    const m = week.days[di].meals[mi]
    swap(`w${di}-${mi}`, m.name, m, (opts) => {
      setWeek((w) => {
        const next = {
          ...w,
          days: w.days.map((d, i) => (i === di ? { ...d, meals: d.meals.map((x, k) => (k === mi ? { ...opts[0], name: x.name } : x)) } : d)),
          // The shopping list was aggregated from the old meal, so it is now
          // one meal out of date. Say so rather than quietly lying about it.
          stale: true,
        }
        saveWeek({ plan: next, ticked })
        return next
      })
    })
  }

  // Tap a meal to see what goes in it and how to cook it.
  //
  // The ingredients are NOT fetched — they arrived with the plan, which is
  // exactly what makes them agree with the shopping list. Only the method is
  // fetched, once, and then it is kept on the meal and saved with the week: a
  // recipe you have opened is readable again in the kitchen with no signal, the
  // same reason the shopping list is persisted for the shop.
  async function toggleRecipe(key, meal, apply) {
    if (openMeal === key) { setOpenMeal(''); return }
    setOpenMeal(key); setRecipeErr('')
    if (meal.recipe?.steps?.length || !meal.ingredients?.length) return
    setRecipeBusy(key)
    try {
      const j = await post({
        method: true,
        title: meal.title,
        description: meal.description,
        ingredients: meal.ingredients,
        // Sent every time rather than relied on server-side, because the method
        // is written fresh and must not reintroduce something they cannot eat.
        allergies, dietary: diet.join(', '), recovery: getRecovery(),
      })
      if (j.recipe?.steps?.length) apply(j.recipe)
      else setRecipeErr(j.error || 'Couldn’t work out the method — try again.')
    } catch {
      setRecipeErr('Something went wrong — try again.')
    } finally {
      setRecipeBusy('')
    }
  }

  function applyWeekRecipe(di, mi, recipe) {
    setWeek((w) => {
      const next = { ...w, days: w.days.map((d, i) => (i === di ? { ...d, meals: d.meals.map((m, k) => (k === mi ? { ...m, recipe } : m)) } : d)) }
      saveWeek({ plan: next, ticked })
      return next
    })
  }

  function applyDayRecipe(mi, oi, recipe) {
    setPlan((p) => ({ ...p, meals: p.meals.map((m, i) => (i === mi ? { ...m, options: m.options.map((o, k) => (k === oi ? { ...o, recipe } : o)) } : m)) }))
  }

  // A plain function, not a component, so React does not unmount and remount
  // the panel — and the fetch spinner inside it — on every parent render.
  function recipePanel(key, meal) {
    const r = meal.recipe
    const timing = [r?.prep_min ? `${r.prep_min} min prep` : null, r?.cook_min ? `${r.cook_min} min cooking` : null].filter(Boolean).join(' · ')
    return (
      <div className="recipe-panel">
        {meal.ingredients?.length ? (
          <>
            <p className="eyebrow">What you need · one serving</p>
            <ul className="recipe-list">{meal.ingredients.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </>
        ) : (
          <p className="muted-note">This meal was planned before recipes existed, so there are no quantities saved for it. Swap it and the new one comes with its recipe.</p>
        )}
        {recipeBusy === key && <p className="muted-note" style={{ marginTop: 8 }}>Working out how to cook it…</p>}
        {recipeErr && openMeal === key && <p className="error" style={{ marginTop: 8 }}>{recipeErr}</p>}
        {r?.steps?.length > 0 && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>How to cook it{timing ? ` · ${timing}` : ''}</p>
            <ol className="recipe-steps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            {r.tip && <p className="muted-note" style={{ marginTop: 8 }}>{r.tip}</p>}
          </>
        )}
      </div>
    )
  }

  // The title doubles as the button that opens the recipe. A card-wide button
  // would have to contain "Log this" and "Swap this", and a button inside a
  // button is invalid and stops working on some browsers.
  function mealTitle(key, meal, apply) {
    if (!RECIPES_ON) return <div className="session-title" style={{ marginTop: 2 }}>{meal.title}</div>
    const open = openMeal === key
    return (
      <button type="button" className="meal-open" aria-expanded={open} onClick={() => toggleRecipe(key, meal, apply)}>
        <span className="session-title">{meal.title}</span>
        <span className="meal-open-mark" aria-hidden="true">{open ? '–' : '+'}</span>
        <span className="sr-only">{open ? 'Hide the recipe' : 'Show the recipe'}</span>
      </button>
    )
  }

  function logOption(mealName, o, when) {
    onLog({
      name: o.title, calories: o.calories, protein_g: o.protein_g, carbs_g: o.carbs_g, fat_g: o.fat_g,
      meal_type: mealName, ...(when ? { logged_at: when.toISOString() } : {}),
    })
    setLogged(o.title); setTimeout(() => setLogged(''), 2200)
  }

  function tick(item) {
    setTicked((t) => {
      const next = t.includes(item) ? t.filter((x) => x !== item) : [...t, item]
      if (week) saveWeek({ plan: week, ticked: next })
      return next
    })
  }

  function clearWeek() { setWeek(null); setTicked([]); saveWeek(null) }

  const swapBtn = (key, run) => (
    <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} disabled={!!swapping || busy} onClick={run}>
      {swapping === key ? 'Finding another…' : 'Swap this'}
    </button>
  )

  return (
    <div>
      <button className="link-btn" onClick={onBack}>‹ Back</button>
      <p className="eyebrow accent">Meal plan</p>
      <h1 className="h1">Build your meal plan.</h1>
      <p className="muted-note">Tell us how you like to eat and we’ll build it around your targets{hasTargets ? ` — ${targets.calories} kcal, ${targets.protein_g}g protein` : ''}. A day gives you options to pick from; a week gives you the plan and the shopping list.</p>
      {RECIPES_ON && <p className="muted-note" style={{ marginTop: 6 }}>Tap any meal to open it up — what goes in it with quantities, and how to cook it.</p>}
      {recovery && (
        <div className="card" style={{ marginTop: 10, borderColor: 'var(--accent)' }}>
          <p className="muted-note">This is about nourishing yourself, not restriction — real, satisfying meals, at your own pace. There’s no such thing as a “bad” choice here. If food feels hard right now, please lean on {coachName?.split(' ')[0] || 'your coach'}, and support is always there: the Beat helpline (0808 801 0677) and your GP.</p>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        {WEEK_ON && (
          <div className="seg" style={{ marginBottom: 4 }}>
            <button type="button" className={mode === 'day' ? 'on' : ''} onClick={() => setMode('day')}>Just a day</button>
            <button type="button" className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>A whole week</button>
          </div>
        )}

        {mode === 'week' && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>How many days</p>
            <div className="seg small" style={{ marginTop: 6 }}>
              {[3, 5, 7].map((n) => <button key={n} type="button" className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{n}</button>)}
            </div>
          </>
        )}

        <p className="eyebrow" style={{ marginTop: 12 }}>Meals a day</p>
        <div className="seg small" style={{ marginTop: 6 }}>
          {[2, 3, 4].map((n) => <button key={n} type="button" className={meals === n ? 'on' : ''} onClick={() => setMeals(n)}>{n}</button>)}
        </div>
        {mode === 'day' && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>Options per meal</p>
            <div className="seg small" style={{ marginTop: 6 }}>
              {[1, 2, 3].map((n) => <button key={n} type="button" className={options === n ? 'on' : ''} onClick={() => setOptions(n)}>{n}</button>)}
            </div>
          </>
        )}
        <label className="field" style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={snacks} onChange={(e) => setSnacks(e.target.checked)} style={{ width: 'auto' }} />
          Include snacks
        </label>
        <p className="eyebrow" style={{ marginTop: 12 }}>Dietary</p>
        <div className="serving-chips" style={{ flexWrap: 'wrap', marginTop: 6 }}>
          {DIETARY.map((d) => <button key={d} type="button" className={diet.includes(d) ? 'on' : ''} onClick={() => toggleDiet(d)}>{d}</button>)}
        </div>
        <label className="field" style={{ marginTop: 12 }}>Allergies / intolerances<input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. nuts, shellfish — we’ll avoid these" /></label>
        <label className="field" style={{ marginTop: 10 }}>Preferences<input value={prefs} onChange={(e) => setPrefs(e.target.value)} placeholder="e.g. high protein, loves chicken, no spicy food" /></label>
        <button className="btn primary big" style={{ marginTop: 14 }} disabled={busy} onClick={generate}>
          {busy
            ? (progress === -1 ? 'Working out the shopping…' : progress ? `Building ${dayLabel(progress - 1).toLowerCase()}… (${progress} of ${days})` : 'Building your plan…')
            : (mode === 'week' ? `Plan my ${days} days` : 'Build my plan')}
        </button>
        {mode === 'week' && busy && <p className="muted-note" style={{ marginTop: 8 }}>Each day is built on its own so none of them repeat — they’ll appear below as they land.</p>}
        {err && <p className="error" style={{ marginTop: 8 }}>{err}</p>}
        {!busy && stalled > 0 && stalled < days && (
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => buildWeek(stalled, week)}>
            Carry on from {dayLabel(stalled).toLowerCase()}
          </button>
        )}
      </div>

      {logged && <p className="logged-ok">Logged {logged} ✓</p>}

      {mode === 'week' && week && (
        <div className="stack" style={{ marginTop: 14 }}>
          {week.note && <p className="muted-note">{week.note}</p>}

          {/* A week saved before this change carries neither its ingredients nor
              the answers it was built from. Say so, rather than letting a swap
              go off without his allergies attached. */}
          {!week.inputs && (
            <div className="card" style={{ borderColor: 'var(--accent)' }}>
              <p className="muted-note">This week was built before recipes and costs existed, so its meals have no quantities saved and your dietary answers above are blank. Check them before swapping a meal, or build a fresh week to get the recipes and the shop total.</p>
            </div>
          )}

          {!week.shopping?.length && week.days.length > 0 && !busy && (
            <div className="card">
              <p className="eyebrow accent">Shopping list</p>
              <p className="muted-note" style={{ marginTop: 4 }}>Not worked out yet — it needs the days above first.</p>
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={buildShopping}>Work out my shopping</button>
            </div>
          )}

          {week.shopping?.length > 0 && (
            <div className="card">
              <p className="eyebrow accent">Shopping list</p>
              <p className="muted-note" style={{ marginTop: 4 }}>Everything the {week.days.length} days need, added up. Tick as you go — it’ll still be here next time you open it.</p>
              <div className="seg small" style={{ marginTop: 8 }}>
                {STORES.map((x) => (
                  <button key={x.id} type="button" className={store === x.id ? 'on' : ''} onClick={() => { setStore(x.id); saveStore(x.id) }}>{x.name}</button>
                ))}
              </div>
              <p className="muted-note" style={{ marginTop: 6 }}>A line’s {shopAt.name} button opens that item in {shopAt.name}’s own search with the words already in — you pick the pack and add it there. Neither shop lets an app fill a basket for you, so this saves the typing, not the choosing.</p>
              {week.cost && week.cost.priced > 0 && (
                <div className="shop-cost">
                  <div className="shop-cost-total">About £{week.cost.gbp.toFixed(2)}</div>
                  <p className="muted-note" style={{ marginTop: 2 }}>
                    {week.cost.priced} of {week.cost.total} lines priced
                    {week.cost.unpriced.length > 0 && ` — ${week.cost.unpriced.length} couldn’t be matched to a price, so ${week.cost.unpriced.length === 1 ? 'it is' : 'they are'} not in that figure`}.
                  </p>
                  <p className="muted-note" style={{ marginTop: 6 }}>{PRICE_NOTE}</p>
                </div>
              )}
              {!week.cost && week.shopping?.length > 0 && !week.stale && (
                <div style={{ marginTop: 8 }}>
                  <p className="muted-note">No cost worked out for this list. It is the one part that is allowed to come back empty — a total that doesn’t match the list would be worse than none.</p>
                  <button className="btn ghost sm" style={{ marginTop: 6 }} disabled={busy} onClick={buildShopping}>Try the cost again</button>
                </div>
              )}
              {week.stale && (
                <div style={{ marginTop: 6 }}>
                  <p className="muted-note" style={{ color: 'var(--accent)' }}>You’ve swapped a meal since this was worked out, so one or two lines — and the total — will be off.</p>
                  <button className="btn ghost sm" style={{ marginTop: 6 }} disabled={busy} onClick={buildShopping}>Redo the list</button>
                </div>
              )}
              <div className="stack" style={{ marginTop: 10 }}>
                {week.shopping.map((g, gi) => (
                  <div key={gi}>
                    <p className="eyebrow">{g.aisle}</p>
                    <div className="stack" style={{ marginTop: 4, gap: 2 }}>
                      {g.items.map((it, ii) => (
                        <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* The shop link sits OUTSIDE the label deliberately.
                              Anything inside a label toggles its checkbox when
                              tapped, so a button in there would tick the line
                              off on the way to the shop — and the tick is how
                              they know what is already in the trolley. */}
                          <label className="field" style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, margin: 0 }}>
                            <input type="checkbox" checked={ticked.includes(it)} onChange={() => tick(it)} style={{ width: 'auto' }} />
                            <span style={{ textDecoration: ticked.includes(it) ? 'line-through' : 'none', opacity: ticked.includes(it) ? 0.5 : 1 }}>{it}</span>
                          </label>
                          {shopUrl(it) && (
                            <a className="btn ghost sm" href={shopUrl(it)} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>{shopAt.name}</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {week.days.map((d, di) => (
            <div className="card" key={di}>
              <p className="eyebrow accent">{dayLabel(di)}</p>
              <div className="session-sub">{d.meals.reduce((s, m) => s + (m.calories || 0), 0)} kcal · {d.meals.reduce((s, m) => s + (m.protein_g || 0), 0)}g protein</div>
              <div className="stack" style={{ marginTop: 8 }}>
                {d.meals.map((m, mi) => (
                  <div className="card" key={mi} style={{ background: 'var(--surface-2)' }}>
                    <p className="eyebrow">{m.name}</p>
                    {mealTitle(`w${di}-${mi}`, m, (r) => applyWeekRecipe(di, mi, r))}
                    {m.description && <p className="muted-note" style={{ marginTop: 4 }}>{m.description}</p>}
                    <div className="session-sub">{macroLine(m)}</div>
                    {openMeal === `w${di}-${mi}` && recipePanel(`w${di}-${mi}`, m)}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => logOption(m.name, m, dayDate(di))}>Log this</button>
                      {swapBtn(`w${di}-${mi}`, () => swapWeekMeal(di, mi))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button className="btn ghost" onClick={generate} disabled={busy}>{busy ? '…' : 'Build a different week'}</button>
          <button className="link-btn" onClick={clearWeek}>Clear this week</button>
        </div>
      )}

      {mode === 'day' && plan && (
        <div className="stack" style={{ marginTop: 14 }}>
          {plan.note && <p className="muted-note">{plan.note}</p>}
          {plan.meals.map((ml, mi) => (
            <div className="card" key={mi}>
              <p className="eyebrow accent">{ml.name}</p>
              <div className="stack" style={{ marginTop: 6 }}>
                {ml.options.map((o, oi) => (
                  <div className="card" key={oi} style={{ background: 'var(--surface-2)' }}>
                    {mealTitle(`d${mi}-${oi}`, o, (r) => applyDayRecipe(mi, oi, r))}
                    {o.description && <p className="muted-note" style={{ marginTop: 4 }}>{o.description}</p>}
                    <div className="session-sub">{macroLine(o)}</div>
                    {openMeal === `d${mi}-${oi}` && recipePanel(`d${mi}-${oi}`, o)}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => logOption(ml.name, o)}>Log this</button>
                      {swapBtn(`d${mi}-${oi}`, () => swapDayMeal(mi, oi))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn ghost" onClick={generate} disabled={busy}>{busy ? '…' : 'Build another'}</button>
        </div>
      )}
    </div>
  )
}
