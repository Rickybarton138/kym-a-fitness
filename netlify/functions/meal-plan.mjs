// Client meal-plan builder: given their calorie/macro targets and a few
// qualifying answers (meals/day, options per meal, snacks, preferences, dietary
// needs, allergies), returns a one-day plan where picking one option per meal
// lands roughly on their targets. Haiku — structured text, no vision.
import { upstreamMessage, requireUser, requireAiUser, readBody, CORS, HttpError } from './_auth.mjs'
import { PRICE_KEYS, costOf, aggregate } from '../../src/mealPrices.js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

// content[0] is not always the answer — a model that emits a thinking block puts
// it first, and `content[0].text` is then undefined. Reading it that way is why
// the shopping list came back empty with a valid 200 behind it. Take every text
// block and ignore the rest.
const textOf = (j) => (Array.isArray(j?.content) ? j.content : [])
  .filter((c) => c?.type === 'text' && typeof c.text === 'string')
  .map((c) => c.text).join('\n') || '{}'

const int = (v) => { const n = Math.round(Number(v)); return n > 0 ? n : 0 }

// Ingredient lines, for the recipe card and for the shopping list that is
// summed from them. Capped at 24 because a meal needing more than that is not
// the weeknight cooking this plan is for, and an uncapped list is what sends
// the shopping call over max_tokens.
const ingredientsOf = (v) => (Array.isArray(v) ? v : [])
  .map((x) => String(typeof x === 'string' ? x : [x?.quantity || x?.qty, x?.item || x?.name].filter(Boolean).join(' ')).slice(0, 90).trim())
  .filter(Boolean)
  .slice(0, 24)

export const handler = async (event) => {
  const cors = CORS
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  try {
    // The whole endpoint, not just `method`. Until 14 Oct 2026 only the recipe
    // action asked who was calling and the other five — skeleton, day, swap,
    // shopping, single-day plan — were open to anyone, which on a week build is
    // nine model calls a go. Auth sits before the parse so an anonymous caller
    // cannot read the action rules off the 400s.
    await requireAiUser(event)
    const b = readBody(event, { max: 1024 * 1024 })
    // Used to time-box the shopping action's second model call. See there.
    const startedAt = Date.now()

    // ---- How to cook ONE meal ----------------------------------------------
    // Fetched when a meal card is tapped, not when the plan is built. A week
    // is up to 28 meals and nobody reads 28 recipes, so writing them all up
    // front would throw away most of a week's model spend.
    //
    // The ingredients are NOT generated here. They come in fixed from the plan,
    // and this only writes the method for a list that already exists — which is
    // what keeps the recipe and the shopping list agreeing with each other.
    //
    // `requireUser`, not `requireAiUser`, and that is deliberate rather than
    // leftover. The whole endpoint is now gated above, but the gate above can
    // be put in `observe` mode per site while the client half of the rollout
    // spreads. This action has never been open, so it must not be loosened by
    // that window — it enforces unconditionally.
    if (b.method) {
      await requireUser(event)
      const title = String(b.title || '').slice(0, 90).trim()
      const ingredients = ingredientsOf(b.ingredients)
      if (!title) return { statusCode: 400, headers: cors, body: '{"error":"No meal given."}' }
      if (!ingredients.length) return { statusCode: 400, headers: cors, body: '{"error":"That meal was planned before recipes were added — swap it and the recipe will come with it."}' }

      const mAllergies = String(b.allergies || '').slice(0, 200).trim()
      const mDietary = String(b.dietary || '').slice(0, 200).trim()
      const mRecovery = !!(b.recovery && b.recovery.on)
      const methodPrompt =
        `Write the cooking method for this one meal, for a client who cooks on a weeknight.\n` +
        `Meal: ${title}\n` +
        (b.description ? `In short: ${String(b.description).slice(0, 200)}\n` : '') +
        `Ingredients, which are FIXED — use all of them, add nothing but salt, pepper and a little cooking oil, and do not change a quantity:\n${ingredients.map((i) => `- ${i}`).join('\n')}\n` +
        `This is one serving for one person.\n` +
        (mAllergies ? `They cannot eat: ${mAllergies}. Nothing in the method may introduce it.\n` : '') +
        (mDietary ? `Dietary requirements: ${mDietary}.\n` : '') +
        (mRecovery ? `Warm, non-judgmental wording. Never "light", "skinny", "low-cal" or "guilt-free", and never suggest eating less of it than the ingredients say.\n` : '') +
        `Numbered steps, each one short enough to follow with your hands busy. Say the pan, the heat and the time. No waffle, no introduction, no nutrition talk.\n` +
        `Return STRICT JSON only, no markdown:\n` +
        `{"prep_min":<int>,"cook_min":<int>,"steps":["Heat a wide pan over a medium heat."],"tip":"1 short line, or empty"}`

      const mr = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: methodPrompt }] }),
      })
      const mj = await mr.json()
      if (!mr.ok) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: upstreamMessage(mr.status, mj) }) }
      const mm = textOf(mj).match(/\{[\s\S]*\}/)
      let mp
      try { mp = JSON.parse(mm ? mm[0] : '{}') } catch { return { statusCode: 200, headers: cors, body: '{"error":"Could not read the method — try again."}' } }
      const steps = (Array.isArray(mp.steps) ? mp.steps : [])
        .map((s) => String(s || '').slice(0, 300).trim())
        .filter(Boolean)
        .slice(0, 14)
      if (!steps.length) return { statusCode: 200, headers: cors, body: '{"error":"Could not write the method — try again."}' }
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ recipe: { steps, prep_min: int(mp.prep_min), cook_min: int(mp.cook_min), tip: String(mp.tip || '').slice(0, 160) } }),
      }
    }

    const calories = Math.max(0, Math.round(Number(b.calories) || 0))
    const protein_g = Math.max(0, Math.round(Number(b.protein_g) || 0))
    const carbs_g = Math.max(0, Math.round(Number(b.carbs_g) || 0))
    const fat_g = Math.max(0, Math.round(Number(b.fat_g) || 0))
    if (!calories) return { statusCode: 400, headers: cors, body: '{"error":"targets required"}' }
    const meals = Math.min(4, Math.max(2, Number(b.meals) || 3))
    const options = Math.min(3, Math.max(1, Number(b.options) || 2))
    const snacks = !!b.snacks
    const dietary = String(b.dietary || '').slice(0, 200).trim()
    const allergies = String(b.allergies || '').slice(0, 200).trim()
    const preferences = String(b.preferences || '').slice(0, 300).trim()
    const recovery = !!(b.recovery && b.recovery.on)
    const recoveryNote = recovery && b.recovery.note ? String(b.recovery.note).slice(0, 200) : ''
    const hc = b.healthContext || null
    const lifeBits = hc ? [hc.hasKids && 'has kids', hc.singleParent && 'single parent', hc.shiftWorker && 'works shifts'].filter(Boolean) : []
    const healthLine = hc && (hc.conditions || lifeBits.length || hc.note)
      ? `Client context (not a diagnosis, just realism): ${[hc.conditions && `health condition(s): ${String(hc.conditions).slice(0, 200)}`, lifeBits.length && lifeBits.join(', '), hc.note].filter(Boolean).join('; ')}. Keep meals realistic and achievable for this — e.g. quick/low-effort options for shift work or a busy household with kids; nothing here changes the calorie/macro targets above.\n`
      : ''

    // Swap mode: replace ONE meal and keep the rest. "I don't fancy that"
    // without regenerating the whole day and losing the meals they were happy
    // with. `avoid` carries what they have just been offered AND what they have
    // actually logged this week, which is the real cure for a plan that feels
    // repetitive — it stops suggesting the same four dinners.
    const swapMeal = String(b.swapMeal || '').slice(0, 40).trim()
    const avoid = Array.isArray(b.avoid)
      ? [...new Set(b.avoid.map((x) => String(x).slice(0, 60).trim()).filter(Boolean))].slice(0, 40)
      : []
    const avoidLine = avoid.length
      ? `Do NOT suggest any of these, or close variations of them — they have had them recently or just turned them down: ${avoid.join('; ')}.\n`
      : ''

    if (swapMeal) {
      const mealKcal = Math.max(1, Math.round(Number(b.mealCalories) || calories / meals))
      const mealPro = Math.max(1, Math.round(Number(b.mealProtein) || protein_g / meals))
      const swapPrompt =
        `Suggest ${options} fresh option(s) for ONE meal of a coaching client's day.\n` +
        `Meal: ${swapMeal}. Aim for about ${mealKcal} kcal and ${mealPro}g protein.\n` +
        avoidLine +
        `Make them genuinely different from each other and from anything listed above — different main protein, different carbohydrate, different cuisine where you can.\n` +
        (recovery ? `RECOVERY-AWARE: generous, satisfying, real food. Never "light", "skinny", "low-cal" or "guilt-free". Warm, non-judgmental descriptions.\n` : '') +
        healthLine +
        (dietary ? `Dietary requirements: ${dietary}. ` : '') +
        (allergies ? `NEVER include these allergens/intolerances: ${allergies}. ` : '') +
        (preferences ? `Preferences: ${preferences}. ` : '') +
        `Shopping-friendly and quick to make.\n` +
        // A swapped meal without ingredients is a card whose recipe cannot be
        // opened and a line the shopping list cannot account for, so the
        // replacement has to arrive in the same shape as the meal it replaces.
        //
        // Gated on the same flag as everywhere else. Without the gate a swap on
        // Kim's or Paul's site would change prompt and output size for their
        // clients with no flag protecting it, which is the exact thing the flag
        // exists to prevent.
        (b.wantIngredients
          ? `Each option also needs an "ingredients" list: one line per ingredient with a METRIC quantity, for ONE person eating it once, written shopping-list style ("180g chicken thigh fillets", "1 red pepper"). The quantities must produce the calories and protein you report. Leave out salt, pepper and cooking oil.\n`
          : '') +
        `Return STRICT JSON only, no markdown:\n` +
        `{"options":[{"title":"","description":"1 short line, key ingredients",${b.wantIngredients ? '"ingredients":["qty + item"],' : ''}"calories":<int>,"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>}]}`

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: swapPrompt }] }),
      })
      const rj = await r.json()
      const rt = textOf(rj)
      const rm = rt.match(/\{[\s\S]*\}/)
      const rp = JSON.parse(rm ? rm[0] : '{}')
      const opts = (Array.isArray(rp.options) ? rp.options : []).slice(0, options).map((o) => ({
        title: String(o.title || '').slice(0, 90),
        description: String(o.description || '').slice(0, 200),
        ingredients: ingredientsOf(o.ingredients),
        calories: int(o.calories), protein_g: int(o.protein_g), carbs_g: int(o.carbs_g), fat_g: int(o.fat_g),
      })).filter((o) => o.title)
      return { statusCode: 200, headers: cors, body: JSON.stringify({ options: opts }) }
    }

    // ---- The week's skeleton, decided before any of it is cooked ------------
    // Variety and a small shopping list pull against each other, and no amount
    // of prompt wording holds both: told to reuse ingredients the model serves
    // the same dinner four nights running, and told to be varied it needs duck,
    // halibut and sea bass in one week. Neither is a plan he'd follow.
    //
    // So the argument is settled in code instead. One cheap call picks a SMALL
    // pool of proteins for the week and a DIFFERENT cuisine for each day. The
    // assignment below is arithmetic, so the same protein cooked the same way
    // twice is not something the model can choose — the shop stays small
    // because the proteins repeat, and the days stay different because the
    // cooking doesn't.
    if (b.skeleton) {
      const n = Math.min(7, Math.max(2, Number(b.days) || 3))
      const pool = Math.min(5, Math.max(3, Math.ceil(n / 1.6)))
      // Fewer cuisines than days, deliberately. One per day sounds like more
      // variety and shops like a nightmare: seven cuisines means seven separate
      // sets of spices and condiments, most used once. Four cuisines cycled
      // against five proteins still gives every day its own pairing.
      const styles = Math.min(4, n)
      const skelPrompt =
        `Plan the shape of a ${n}-day meal plan for someone who cooks. Do not write any meals yet.\n` +
        `Pick exactly ${pool} main proteins for the whole week — everyday, affordable ones from a normal supermarket that each work several different ways. No luxury or one-off items.\n` +
        `Pick exactly ${styles} cuisines or cooking styles that suit those proteins and largely SHARE a store cupboard. Avoid any cuisine that needs specialist ingredients which would only get used once.\n` +
        `Pick exactly ${pool} carbohydrate bases.\n` +
        (dietary ? `Dietary requirements: ${dietary}. ` : '') +
        (allergies ? `NEVER include: ${allergies}. ` : '') +
        (preferences ? `Preferences: ${preferences}\n` : '') +
        `Return STRICT JSON only, no markdown:\n` +
        `{"proteins":["chicken thigh"],"cuisines":["Indian"],"carbs":["basmati rice"]}`

      const kr = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: 'user', content: skelPrompt }] }),
      })
      const kj = await kr.json()
      const km = textOf(kj).match(/\{[\s\S]*\}/)
      let kp
      try { kp = JSON.parse(km ? km[0] : '{}') } catch { kp = {} }
      const clean = (a, max) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, 40).trim()).filter(Boolean).slice(0, max)
      // Three of each is what the day assignment below needs to guarantee a
      // different brief every day. Asking for five and getting two is a fluke
      // rather than the norm, but it's a fluke that would quietly hand him the
      // same dinner twice, so top the lists up rather than trusting them. The
      // fallbacks are ordinary things anyone eats; anything the client can't
      // have is filtered by the allergy and dietary lines in the day prompt.
      const topUp = (a, fallback) => {
        const out = [...a]
        for (const f of fallback) { if (out.length >= 3) break; if (!out.some((x) => x.toLowerCase() === f.toLowerCase())) out.push(f) }
        return out
      }
      const proteins = topUp(clean(kp.proteins, pool), ['chicken thigh', 'eggs', 'minced beef', 'tinned chickpeas'])
      const cuisines = topUp(clean(kp.cuisines, styles), ['Mediterranean', 'Indian', 'East Asian', 'British'])
      const carbs = topUp(clean(kp.carbs, pool), ['rice', 'potatoes', 'wholemeal bread', 'pasta'])
      // Arithmetic, not judgement. The two lists are different lengths and both
      // cycle, so every day gets a pairing no other day has — which is what
      // stops two days coming out the same without asking the model to
      // remember what it already wrote.
      // Both lists cycle, one place per day, so the protein changes every day
      // AND the cuisine does. Advancing the protein only once per lap of the
      // cuisines looked fine on paper and gave four consecutive days of chicken
      // thigh, because with four cuisines over four days the lap never
      // completed.
      //
      // Two cycles only stay out of step while their lengths share no factor —
      // four proteins against four cuisines repeats on day five. So use however
      // many cuisines keeps them out of step longest, which is not always all of
      // them. The carb is a third cycle, and breaks the tie in the rare case
      // where the model hands back too few of either to cover the week.
      // so both advance every single day. Where that lands on a brief already
      // used — which it does whenever the two list lengths share a factor — the
      // carbohydrate moves on until it doesn't. Protein and cuisine therefore
      // still change daily, and no two days get the same brief.
      const P = proteins.length
      const C = cuisines.length
      const K = Math.max(1, carbs.length)
      const used = new Set()
      const themes = Array.from({ length: n }, (_, i) => {
        const a = i % P, c = i % C
        let k = i % K
        for (let t = 0; t < K && used.has(`${a}|${c}|${k}`); t++) k = (k + 1) % K
        used.add(`${a}|${c}|${k}`)
        return { protein: proteins[a], cuisine: cuisines[c], carb: carbs[k] || '' }
      })
      return { statusCode: 200, headers: cors, body: JSON.stringify({ themes, proteins }) }
    }

    // ---- A week, built ONE DAY PER REQUEST ----------------------------------
    // A whole week in a single call is a 60-second job and the function times
    // out at the edge long before it finishes — a 504 and nothing to show for
    // it. So the client asks for one day at a time, passing back everything it
    // already has as `avoid`. That keeps each request small and fast, keeps the
    // no-repeat guarantee (day 5 knows about days 1-4), and means a failure
    // halfway loses one day rather than the whole week.
    //
    // Deliberately ONE meal per slot rather than a menu: a shopping list only
    // means anything if it matches exactly what the plan says to eat.
    if (b.weekDay) {
      const label = String(b.dayLabel || 'Day').slice(0, 30)
      // Do the division here rather than asking the model to. Left to itself it
      // lands a day 30% under target roughly one time in four, which on a fat
      // loss plan is the difference between a deficit and a crash diet. Given
      // an explicit budget per meal it just fills the slots.
      const slots = []
      const names = meals === 2 ? ['Breakfast', 'Dinner'] : meals === 4 ? ['Breakfast', 'Lunch', 'Afternoon meal', 'Dinner'] : ['Breakfast', 'Lunch', 'Dinner']
      const shares = snacks
        ? { 2: [0.4, 0.45], 3: [0.27, 0.3, 0.28], 4: [0.22, 0.24, 0.24, 0.15] }[meals]
        : { 2: [0.45, 0.55], 3: [0.3, 0.35, 0.35], 4: [0.25, 0.27, 0.27, 0.21] }[meals]
      names.forEach((n, i) => slots.push({ n, k: Math.round(calories * shares[i]), p: Math.round(protein_g * shares[i]) }))
      if (snacks) {
        const used = slots.reduce((s, x) => s + x.k, 0)
        const usedP = slots.reduce((s, x) => s + x.p, 0)
        slots.push({ n: 'Snack', k: Math.max(100, calories - used), p: Math.max(5, protein_g - usedP) })
      }
      const budget = slots.map((s) => `${s.n}: about ${s.k} kcal and ${s.p}g protein`).join('; ')

      // The day's assigned slot in the week, decided by the skeleton call. This
      // is what keeps the shop small without the model having to referee its own
      // "be varied but reuse everything" contradiction: the protein repeats
      // across the week, the cuisine never does.
      const th = b.theme || null
      const pool = Array.isArray(b.proteins)
        ? b.proteins.map((x) => String(x).slice(0, 40).trim()).filter(Boolean).slice(0, 6)
        : []
      const themeLine = th
        ? `THIS DAY'S BRIEF: cook ${String(th.protein || '').slice(0, 40)} in a ${String(th.cuisine || '').slice(0, 40)} style${th.carb ? `, with ${String(th.carb).slice(0, 40)} as the carbohydrate` : ''}. That brief is for the main meal; the other slots should lean on the same week's shopping.\n` +
          (pool.length ? `The only proteins bought this week are: ${pool.join(', ')}. Use those and nothing else for the main meals — a new one means another trip to the shop.\n` : '') +
          // Held apart from the pool on purpose. Told to build the snack out of
          // the week's proteins too, it produced "pork loin and grapes" and a
          // beef broth at nine o'clock at night. A snack is something you take
          // out of the fridge, not a fourth thing to cook.
          (snacks ? `The SNACK is the exception and is not part of that pool: it must be something simple and high-protein that needs no cooking — Greek yogurt, skyr, cottage cheese, a whey shake, a boiled egg, nuts, fruit. Never a cooked dish.\n` : '') +
          `The cuisine is what makes this day different from the others, so commit to it properly.\n`
        : ''

      const dayPrompt =
        `Build ONE day of a multi-day meal plan for a coaching client — this is ${label}.\n` +
        `Targets for the whole day: ${calories} kcal, ${protein_g}g protein, ${carbs_g}g carbs, ${fat_g}g fat.\n` +
        `Use exactly these slots, in this order, ONE meal in each. No alternatives, no choices.\n` +
        `${budget}.\n` +
        `CRITICAL: hit each slot's budget above within about 10%, so the day adds up to ${calories} kcal and ${protein_g}g protein. Report the real numbers for the food you describe — do not just repeat the budget back.\n` +
        themeLine +
        avoidLine +
        (avoid.length
          ? `That list is absolute. Not one of those meals may appear again, and neither may a near-variation — the same dish with a word changed, a garnish swapped or a side added is the SAME MEAL and is not allowed. Cook the same ingredients a different way instead.\n`
          : '') +
        (recovery ? `RECOVERY-AWARE MODE: every meal generous, satisfying and genuinely nourishing. NEVER use "light", "skinny", "low-cal" or "guilt-free", and never fall short of the targets. Warm, non-judgmental descriptions.\n` : '') +
        healthLine +
        (dietary ? `Dietary requirements: ${dietary}. ` : '') +
        (allergies ? `NEVER include these allergens/intolerances: ${allergies}. ` : '') +
        (preferences ? `Preferences: ${preferences}. ` : '') +
        `They cook. Keep it shopping-friendly and quick on a weeknight.\n` +
        // The ingredient lines are asked for HERE, with the meal, rather than
        // when the card is tapped. Two reasons, and the second is the important
        // one:
        //   The shopping list is aggregated from these lines instead of from a
        //   one-line description, so it is a sum of real quantities.
        //   The recipe and the shopping list cannot contradict each other. Work
        //   the ingredients out later and a tap could say 900g of chicken
        //   against a list that bought 600g, and there is no way to tell which
        //   one is wrong.
        `Every meal also needs an "ingredients" list: one line per ingredient, each with a METRIC quantity, for ONE person eating that meal once — not a family-sized batch. The quantities must actually produce the calories and protein you reported for that meal. Write them shopping-list style ("180g chicken thigh fillets", "1 red pepper", "200g tinned chopped tomatoes"). Leave out salt, pepper and cooking oil.\n` +
        `Return STRICT JSON only, no markdown:\n` +
        `{"meals":[{"name":"Breakfast","title":"","description":"1 short line, key ingredients","ingredients":["qty + item"],"calories":<int>,"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>}]}`

      const dr = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: dayPrompt }] }),
      })
      const dj = await dr.json()
      if (!dr.ok) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: upstreamMessage(dr.status, dj) }) }
      const dm = textOf(dj).match(/\{[\s\S]*\}/)
      let dp
      try { dp = JSON.parse(dm ? dm[0] : '{}') } catch { return { statusCode: 200, headers: cors, body: '{"error":"Could not read that day — try again."}' } }
      const dayMeals = (Array.isArray(dp.meals) ? dp.meals : []).slice(0, 5).map((m) => ({
        name: String(m.name || 'Meal').slice(0, 30),
        title: String(m.title || '').slice(0, 90),
        description: String(m.description || '').slice(0, 200),
        ingredients: ingredientsOf(m.ingredients),
        calories: int(m.calories), protein_g: int(m.protein_g), carbs_g: int(m.carbs_g), fat_g: int(m.fat_g),
      })).filter((m) => m.title)
      if (!dayMeals.length) return { statusCode: 200, headers: cors, body: '{"error":"Could not build that day — try again."}' }
      return { statusCode: 200, headers: cors, body: JSON.stringify({ day: { label, meals: dayMeals } }) }
    }

    // ---- The shopping for whatever days they ended up with -------------------
    // Big input, small output, so it fits in one request. Runs on Haiku, not the
    // mid tier: the mid tier thinks before it writes and the thinking scales
    // with the number of meals, which put a full week's list at over 30 seconds
    // and straight into an edge timeout. Whether the quantities actually add up
    // is asserted in tasks/e2e_round31.mjs rather than assumed.
    if (Array.isArray(b.shoppingFor) && b.shoppingFor.length) {
      // ---- Built by adding the ingredient lines up, in code -----------------
      // The model is asked only which food each line is and what to call it.
      // The grouping, the arithmetic, the aisles and the price all happen in
      // src/mealPrices.js.
      //
      // The obvious version — hand the model the ingredient lines and tell it
      // to add them up — was built first and measured on a real week: 197
      // lines in, 108 lines out, against the 62 the same model produced from
      // loose descriptions. It passed most of them straight through. Ginger
      // came back as three lines, black beans as two. It also cost a second
      // model call for the price, which on a full week left no time inside the
      // request to make it, so the cost never appeared at all.
      //
      // Tagging instead gives one pass that produces BOTH the list and the
      // cost, correctly summed, and the chunks run in parallel.
      const allLines = []
      for (const m of b.shoppingFor.slice(0, 40)) {
        for (const i of ingredientsOf(m.ingredients)) allLines.push(i)
      }

      if (allLines.length >= 4) {
        try {
          // Chunked because a week is around 200 lines and one response that
          // long risks stopping on max_tokens — which would silently drop the
          // tail of the shop. In parallel, so it costs one call's latency.
          const CHUNK = 60
          const chunks = []
          for (let i = 0; i < allLines.length; i += CHUNK) chunks.push(allLines.slice(i, i + CHUNK))

          const tagged = await Promise.all(chunks.map(async (chunk) => {
            const prompt =
              `For each ingredient line below, identify the food.\n` +
              `Keys: ${PRICE_KEYS.join(' ')}\n\n` +
              `Lines, in order:\n${chunk.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n` +
              `For each line return [key, name]:\n` +
              `  key  — the closest key above by FOOD, ignoring brand and preparation ("diced chicken breast" is chicken-breast, "baby spinach" is spinach, "cooked black beans" is black-beans-tin). Use "" if nothing on the list is the same food.\n` +
              `  name — a short shopping name for it, lower case, no quantity, no brand, no preparation words and no notes in brackets. "red pepper", not "60g red bell pepper (additional)". Use the SAME name every time the same food appears.\n` +
              `Return STRICT JSON only, no markdown, one entry per line IN THE ORDER GIVEN and the same number of entries as lines:\n` +
              `{"l":[["chicken-thigh-fillet","chicken thigh fillets"]]}`
            const r = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
            })
            const j = await r.json()
            if (!r.ok) throw new Error(`tagging ${r.status}`)
            const mm = textOf(j).match(/\{[\s\S]*\}/)
            const rows = mm ? (JSON.parse(mm[0]).l || []) : []
            // One entry per line or the chunk is unusable: the tuples carry no
            // copy of the line they belong to, so a short array means every
            // row after the gap describes the wrong food.
            if (rows.length !== chunk.length) throw new Error(`tagging returned ${rows.length} for ${chunk.length} lines`)
            return chunk.map((text, i) => {
              const row = Array.isArray(rows[i]) ? rows[i] : []
              return { text, key: String(row[0] || ''), name: String(row[1] || '').slice(0, 60) }
            })
          }))

          const { shopping: agg, cost, lines } = aggregate(tagged.flat())
          if (agg.length) {
            return { statusCode: 200, headers: cors, body: JSON.stringify({ shopping: agg, cost, lines }) }
          }
        } catch (e) {
          // Fall through to the model-written list below. A worse list beats no
          // list, and this is the part he takes to the shop.
          console.error('shopping aggregate failed, falling back', String(e.message || e))
        }
      }

      // Built from the meals' own ingredient lines where they have them, and
      // only from the one-line description where they don't. That is the whole
      // point of asking for ingredients up front: summing stated quantities is
      // arithmetic, whereas inferring them from "chicken thigh with rice and
      // greens" is a second guess that the recipe card would then contradict.
      //
      // Old weeks saved in localStorage have no ingredients, so both shapes
      // have to keep working.
      const forMeals = b.shoppingFor.slice(0, 40)
      const withIngredients = forMeals.filter((m) => ingredientsOf(m.ingredients).length).length
      const lines = forMeals
        .map((m) => {
          const t = String(m.title || '').slice(0, 90)
          const ing = ingredientsOf(m.ingredients)
          return ing.length
            ? `- ${t}\n${ing.map((i) => `    ${i}`).join('\n')}`
            : `- ${t}: ${String(m.description || '').slice(0, 200)}`
        })
        .join('\n')
      const shopPrompt =
        `Write the shopping list for these ${forMeals.length} meals, which are a client's plan for the next few days:\n${lines}\n\n` +
        (withIngredients
          ? `The indented lines under each meal are its exact ingredients, already sized for one person eating that meal once. Your ONLY job is to add them up. Do not re-estimate a quantity, do not invent an ingredient, and do not drop one.\n`
          : '') +
        `Cover EVERY meal above and nothing else. Add the quantities up across all of them — if four meals use chicken thigh, that is ONE line with the total weight, not four lines.\n` +
        `Group by supermarket aisle. Metric weights. Skip storecupboard basics like salt, pepper and cooking oil.\n` +
        `Every line is ONE ingredient and its total quantity. Never write a line that names a meal — "400g chicken for the tagine" is wrong, that chicken belongs in the single chicken line. Check before you finish that no ingredient appears twice.\n` +
        `At most 8 aisles, and no two that overlap — one "Dairy & eggs", not that plus "Dairy & condiments".\n` +
        (allergies ? `They cannot have: ${allergies}. ` : '') +
        `Return STRICT JSON only, no markdown:\n` +
        `{"shopping":[{"aisle":"Meat & fish","items":["600g chicken thigh fillets","12 eggs"]}]}`

      const sr = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: shopPrompt }] }),
      })
      const sj = await sr.json()
      if (!sr.ok) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: upstreamMessage(sr.status, sj) }) }
      const sText = textOf(sj)
      const sm = sText.match(/\{[\s\S]*\}/)
      let sp
      try { sp = JSON.parse(sm ? sm[0] : '{}') } catch { return { statusCode: 200, headers: cors, body: '{"error":"Could not read the shopping list — try again."}' } }
      // Asked for a list of {aisle, items} and it will sometimes hand back a
      // plain object keyed by aisle instead, with or without the wrapper. Both
      // say the same thing, so take either rather than telling him it failed.
      const raw = Array.isArray(sp.shopping) ? sp.shopping
        : sp.shopping && typeof sp.shopping === 'object' ? Object.entries(sp.shopping).map(([aisle, items]) => ({ aisle, items }))
        : Array.isArray(sp) ? sp
        : Object.entries(sp).filter(([, v]) => Array.isArray(v)).map(([aisle, items]) => ({ aisle, items }))
      const shopping = raw.slice(0, 12).map((g) => ({
        aisle: String(g.aisle || 'Other').slice(0, 40),
        items: (Array.isArray(g.items) ? g.items : [])
          .slice(0, 40)
          .map((x) => (typeof x === 'string' ? x : [x?.item || x?.name, x?.quantity || x?.qty].filter(Boolean).join(' ')))
          .map((x) => String(x).slice(0, 80).trim())
          .filter(Boolean),
      })).filter((g) => g.items.length)
      // Name the cut-off case rather than blaming the model for it: a response
      // that stopped on max_tokens has no text to read and looks identical to a
      // refusal from out here.
      if (!shopping.length) {
        const cut = sj?.stop_reason === 'max_tokens'
        return { statusCode: 200, headers: cors, body: JSON.stringify({ error: cut ? 'The list was too long to finish — try fewer days.' : 'Could not build the shopping list — try again.' }) }
      }

      // ---- What the shop costs ---------------------------------------------
      // Folded into THIS response rather than offered as a separate request, so
      // a cost can never be on screen next to a list it was not worked out
      // from.
      //
      // The model's only job is to say WHICH FOOD each line is. Every price and
      // every sum comes from src/mealPrices.js, which is dated and editable.
      // Asked for a total directly a model writes a confident "£46.20" that
      // changes on the next call and cannot be corrected or sourced — the same
      // reason recipe-ai.mjs stopped asking a model to total macros.
      // Time-boxed, because it is the SECOND model call in this one request and
      // the list is what he actually needs. A full week is around 35 meals and
      // 200 ingredient lines; if the pair of calls runs past the edge's
      // synchronous cap the whole response dies and he loses the shopping list,
      // not just the total. So once the list is in hand, the cost only gets
      // whatever time is left — and is abandoned rather than allowed to take
      // the list down with it.
      let cost = null
      const BUDGET_MS = 11000
      const elapsed = () => Date.now() - startedAt
      try {
        if (elapsed() > BUDGET_MS) throw new Error('no time left for the cost')
        const flat = shopping.flatMap((g) => g.items).slice(0, 120)
        const tagPrompt =
          `Match each shopping line to exactly ONE key from this list, or null if nothing on the list fits.\n` +
          `Keys: ${PRICE_KEYS.join(' ')}\n\n` +
          `Lines, in order:\n${flat.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n` +
          `Pick the closest key by FOOD, ignoring brand and preparation — "diced chicken breast" is chicken-breast, "baby spinach" is spinach. Use null rather than a key that is a different food.\n` +
          `Return STRICT JSON only, no markdown, one entry per line IN THE ORDER GIVEN and the same number of entries as lines:\n` +
          `{"l":[["key",<grams or 0>]]}\n` +
          `The number is ONLY for a line that states no quantity at all, like "a bunch of coriander" — put your best grams estimate there. If the line already states a weight or a count, put 0.`
        // Hard stop on whatever is left of the budget, so a slow tagging call
        // cannot run the whole request into the edge timeout.
        const ac = new AbortController()
        const timer = setTimeout(() => ac.abort(), Math.max(1500, BUDGET_MS - elapsed()))
        let tj
        try {
          const tr = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content: tagPrompt }] }),
            signal: ac.signal,
          })
          tj = await tr.json()
        } finally {
          clearTimeout(timer)
        }
        const tm = textOf(tj).match(/\{[\s\S]*\}/)
        const tp = tm ? JSON.parse(tm[0]) : {}
        const rows = Array.isArray(tp.l) ? tp.l : []
        // One entry per line or nothing. The tuples carry no copy of the line
        // they belong to, so a short or long array means the mapping has
        // shifted and every price after the shift is for the wrong food. There
        // is no way to detect that downstream, so refuse the whole total —
        // absent beats wrong, the same call the shopping list itself makes.
        if (rows.length === flat.length) {
          cost = costOf(flat.map((text, i) => {
            const row = Array.isArray(rows[i]) ? rows[i] : []
            const g = Number(row[1])
            return { text, key: String(row[0] || ''), grams: Number.isFinite(g) && g > 0 ? g : null }
          }))
        }
      } catch {
        cost = null // No cost line. The list is still useful without one.
      }

      return { statusCode: 200, headers: cors, body: JSON.stringify({ shopping, cost }) }
    }

    const prompt =
      `Build a realistic one-day meal plan for a coaching client.\n` +
      `Daily targets: ${calories} kcal, ${protein_g}g protein, ${carbs_g}g carbs, ${fat_g}g fat.\n` +
      `${meals} main meals${snacks ? ' plus a snacks group' : ''}. Give ${options} distinct option(s) per meal — the client picks ONE per meal.\n` +
      `CRITICAL: choosing one option from each main meal (and one snack if present) must sum to roughly the daily targets (within ~5%). Split the calories/macros sensibly across the meals.\n` +
      (recovery
        ? `RECOVERY-AWARE MODE — this client is in recovery from disordered eating${recoveryNote ? ` and finds this hard: ${recoveryNote}` : ''}. Every option must be generous, satisfying and genuinely nourishing — real, adequate meals. NEVER use "light", "skinny", "low-cal", "guilt-free" or any restrictive framing, and never fall short of the targets. Warm, non-judgmental descriptions. The "note" must be gentle and encouraging about nourishing themselves and going at their own pace — not about hitting numbers or eating less.\n`
        : '') +
      healthLine +
      (dietary ? `Dietary requirements: ${dietary}. ` : '') +
      (allergies ? `NEVER include these allergens/intolerances: ${allergies}. ` : '') +
      (preferences ? `Preferences: ${preferences}. ` : '') +
      `Keep meals shopping-friendly and quick to make.\n` +
      // Asked for only when the client says it can show them. A single day
      // offers 2-3 options per meal, so ingredients for all of them is three
      // times the output of the week path — worth it on a brand that renders
      // recipe cards, wasted tokens and extra timeout risk on one that doesn't.
      (b.wantIngredients
        ? `Every option also needs an "ingredients" list: one line per ingredient with a METRIC quantity, for ONE person eating it once, written shopping-list style ("180g chicken thigh fillets", "1 red pepper"). The quantities must produce the calories and protein you report. Leave out salt, pepper and cooking oil.\n`
        : '') +
      `Return STRICT JSON only, no markdown:\n` +
      `{"meals":[{"name":"Breakfast","options":[{"title":"","description":"1 short line, key ingredients",${b.wantIngredients ? '"ingredients":["qty + item"],' : ''}"calories":<int>,"protein_g":<int>,"carbs_g":<int>,"fat_g":<int>}]}],"note":"1 short line on how to use it"}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    })
    const j = await res.json()
    const text = textOf(j)
    const m = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(m ? m[0] : '{}')
    const cleanMeals = (Array.isArray(parsed.meals) ? parsed.meals : []).map((ml) => ({
      name: String(ml.name || 'Meal').slice(0, 40),
      options: (Array.isArray(ml.options) ? ml.options : []).slice(0, options).map((o) => ({
        title: String(o.title || 'Option').slice(0, 100),
        description: String(o.description || '').slice(0, 200),
        ingredients: ingredientsOf(o.ingredients),
        calories: int(o.calories), protein_g: int(o.protein_g), carbs_g: int(o.carbs_g), fat_g: int(o.fat_g),
      })),
    })).filter((ml) => ml.options.length)
    if (!cleanMeals.length) return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'Could not build a plan — try again.' }) }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ meals: cleanMeals, note: String(parsed.note || '').slice(0, 160) }) }
  } catch (e) {
    // An auth failure has to arrive as a 401, not as a 200 carrying a sentence
    // about signing in — the client needs to tell "your session went stale"
    // apart from "the model could not do it", and only the status says which.
    if (e instanceof HttpError) {
      return { statusCode: e.status, headers: cors, body: JSON.stringify({ error: e.message }) }
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ error: String(e.message || e) }) }
  }
}
