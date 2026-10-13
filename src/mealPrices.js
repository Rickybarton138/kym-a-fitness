// What a week's shopping list costs.
//
// NO IMPORTS — a Netlify function reads this file, same rule as callisthenics.js.
//
// Why a table in code rather than asking the model for a price:
//
// A model will happily write "£46.20" for a shopping list and it will read as
// authoritative, but it is a guess made fresh on every call. Ask twice and get
// two numbers. There is no audit trail, no date, and no way for Ricky to
// correct one that is wrong — and the figures drift as the model ages.
//
// So the split is the same one recipe-ai.mjs settled on for macros: the model
// RECALLS (which food is this line?), the code does the ARITHMETIC. A wrong
// price here is one number to edit, and every number carries the same date.
//
// These are hand-written estimates of own-label prices, not a licenced feed —
// nothing in this project has one. The UI must say so; see PRICE_NOTE.

export const PRICES_AS_OF = 'October 2026'
export const PRICE_BASIS = 'mid-range UK supermarket own-label'
export const PRICE_NOTE = `Indicative only — own-label prices as of ${PRICES_AS_OF}, not a live feed. Priced pro-rata: the list says 600g of chicken, so this counts 600g, not the 1kg pack you actually put in the trolley.`

// per: 'kg' prices by weight (millilitres are treated as grammes — near enough for
//      everything here except oil, and oil is pennies either way).
// per: 'each' prices by the item.
// g:   typical grammes of ONE, which lets a line convert between the two. "320g
//      peppers" against a per-each price, or "2 courgettes" against a per-kg
//      one, both resolve instead of coming back unpriced.
export const PRICES = {
  // --- Meat, fish ---------------------------------------------------------
  'chicken-breast': { per: 'kg', gbp: 7.5 },
  'chicken-thigh-fillet': { per: 'kg', gbp: 6.5 },
  'chicken-thigh-bone-in': { per: 'kg', gbp: 3.5 },
  'chicken-whole': { per: 'kg', gbp: 3.5 },
  'chicken-mince': { per: 'kg', gbp: 7.0 },
  'turkey-mince': { per: 'kg', gbp: 7.5 },
  'beef-mince-lean': { per: 'kg', gbp: 8.5 },
  'beef-mince': { per: 'kg', gbp: 6.5 },
  'beef-steak': { per: 'kg', gbp: 14.0 },
  'beef-stewing': { per: 'kg', gbp: 9.0 },
  'pork-loin': { per: 'kg', gbp: 7.0 },
  'pork-mince': { per: 'kg', gbp: 6.0 },
  'pork-shoulder': { per: 'kg', gbp: 5.5 },
  'sausages': { per: 'kg', gbp: 6.5, g: 57 },
  'bacon': { per: 'kg', gbp: 8.0, g: 30 },
  'lamb-mince': { per: 'kg', gbp: 9.5 },
  'lamb-chops': { per: 'kg', gbp: 13.0 },
  'ham-slices': { per: 'kg', gbp: 9.0 },
  'chorizo': { per: 'kg', gbp: 12.0 },
  'salmon-fillet': { per: 'kg', gbp: 16.0, g: 130 },
  'cod-fillet': { per: 'kg', gbp: 14.0, g: 140 },
  'white-fish-fillet': { per: 'kg', gbp: 8.0, g: 130 },
  'tuna-steak': { per: 'kg', gbp: 18.0 },
  'prawns': { per: 'kg', gbp: 14.0 },
  'smoked-salmon': { per: 'kg', gbp: 22.0 },
  'tuna-tin': { per: 'each', gbp: 1.1, g: 110 },
  'mackerel-tin': { per: 'each', gbp: 1.0, g: 110 },
  'sardines-tin': { per: 'each', gbp: 1.0, g: 90 },

  // --- Dairy, eggs --------------------------------------------------------
  'egg': { per: 'each', gbp: 0.25, g: 58 },
  'milk': { per: 'kg', gbp: 1.2 },
  'greek-yogurt': { per: 'kg', gbp: 3.5 },
  'natural-yogurt': { per: 'kg', gbp: 2.0 },
  'skyr': { per: 'kg', gbp: 5.0 },
  'cottage-cheese': { per: 'kg', gbp: 4.5 },
  'cheddar': { per: 'kg', gbp: 8.0 },
  'mozzarella': { per: 'kg', gbp: 6.5, g: 125 },
  'feta': { per: 'kg', gbp: 8.0 },
  'parmesan': { per: 'kg', gbp: 16.0 },
  'halloumi': { per: 'kg', gbp: 10.0, g: 225 },
  'butter': { per: 'kg', gbp: 7.5 },
  'cream-cheese': { per: 'kg', gbp: 6.0 },
  'soured-cream': { per: 'kg', gbp: 4.0 },
  'double-cream': { per: 'kg', gbp: 4.0 },
  'creme-fraiche': { per: 'kg', gbp: 4.5 },

  // --- Carbohydrate, bakery -----------------------------------------------
  'basmati-rice': { per: 'kg', gbp: 2.0 },
  'white-rice': { per: 'kg', gbp: 1.4 },
  'brown-rice': { per: 'kg', gbp: 2.0 },
  'rice-pouch': { per: 'each', gbp: 1.0, g: 250 },
  'pasta': { per: 'kg', gbp: 1.0 },
  'wholewheat-pasta': { per: 'kg', gbp: 1.4 },
  'egg-noodles': { per: 'kg', gbp: 3.0 },
  'rice-noodles': { per: 'kg', gbp: 3.0 },
  'couscous': { per: 'kg', gbp: 2.0 },
  'bulgur-wheat': { per: 'kg', gbp: 2.2 },
  'quinoa': { per: 'kg', gbp: 5.0 },
  'oats': { per: 'kg', gbp: 1.2 },
  'potato': { per: 'kg', gbp: 1.0, g: 180 },
  'sweet-potato': { per: 'kg', gbp: 1.6, g: 200 },
  'bread-loaf': { per: 'each', gbp: 1.3, g: 800 },
  'wrap': { per: 'each', gbp: 0.2, g: 60 },
  'pitta': { per: 'each', gbp: 0.2, g: 60 },
  'bagel': { per: 'each', gbp: 0.35, g: 85 },
  'naan': { per: 'each', gbp: 0.6, g: 130 },
  'crumpet': { per: 'each', gbp: 0.2, g: 60 },
  'flour': { per: 'kg', gbp: 1.0 },
  'gnocchi': { per: 'kg', gbp: 2.5, g: 500 },
  'tortilla-chips': { per: 'kg', gbp: 4.0 },
  'rice-cake': { per: 'each', gbp: 0.08, g: 9 },

  // --- Vegetables ---------------------------------------------------------
  'onion': { per: 'kg', gbp: 0.9, g: 150 },
  'red-onion': { per: 'kg', gbp: 1.4, g: 150 },
  'spring-onion': { per: 'each', gbp: 0.6, g: 100 },
  'garlic': { per: 'each', gbp: 0.35, g: 50 },
  'carrot': { per: 'kg', gbp: 0.7, g: 90 },
  'broccoli': { per: 'kg', gbp: 1.8, g: 350 },
  'cauliflower': { per: 'each', gbp: 1.2, g: 700 },
  'pepper': { per: 'each', gbp: 0.65, g: 160 },
  'courgette': { per: 'kg', gbp: 1.8, g: 200 },
  'aubergine': { per: 'each', gbp: 0.9, g: 300 },
  'mushrooms': { per: 'kg', gbp: 3.5 },
  'tomato': { per: 'kg', gbp: 2.5, g: 100 },
  'cherry-tomatoes': { per: 'kg', gbp: 5.0 },
  'spinach': { per: 'kg', gbp: 6.0 },
  'kale': { per: 'kg', gbp: 4.0 },
  'salad-leaves': { per: 'kg', gbp: 8.0 },
  'cucumber': { per: 'each', gbp: 0.75, g: 350 },
  'lettuce': { per: 'each', gbp: 0.8, g: 300 },
  'green-beans': { per: 'kg', gbp: 4.0 },
  'mangetout': { per: 'kg', gbp: 8.0 },
  'peas-frozen': { per: 'kg', gbp: 1.8 },
  'sweetcorn-tin': { per: 'each', gbp: 0.6, g: 165 },
  'leek': { per: 'kg', gbp: 2.0, g: 150 },
  'celery': { per: 'each', gbp: 0.85, g: 400 },
  'cabbage': { per: 'each', gbp: 0.9, g: 800 },
  'butternut-squash': { per: 'kg', gbp: 1.6, g: 900 },
  'asparagus': { per: 'kg', gbp: 10.0 },
  'beetroot': { per: 'kg', gbp: 2.0 },
  'pak-choi': { per: 'each', gbp: 0.8, g: 200 },
  'ginger': { per: 'kg', gbp: 6.0 },
  'chilli': { per: 'kg', gbp: 10.0, g: 15 },
  'mixed-veg-frozen': { per: 'kg', gbp: 1.6 },
  'stir-fry-veg': { per: 'kg', gbp: 2.5 },
  'olives': { per: 'kg', gbp: 8.0 },
  'hummus': { per: 'kg', gbp: 5.0 },

  // --- Fruit --------------------------------------------------------------
  'banana': { per: 'kg', gbp: 0.9, g: 120 },
  'apple': { per: 'kg', gbp: 2.0, g: 150 },
  'orange': { per: 'kg', gbp: 1.8, g: 180 },
  'pear': { per: 'kg', gbp: 2.2, g: 170 },
  'grapes': { per: 'kg', gbp: 3.5 },
  'strawberries': { per: 'kg', gbp: 6.0 },
  'blueberries': { per: 'kg', gbp: 10.0 },
  'raspberries': { per: 'kg', gbp: 12.0 },
  'berries-frozen': { per: 'kg', gbp: 4.0 },
  'lemon': { per: 'each', gbp: 0.35, g: 100 },
  'lime': { per: 'each', gbp: 0.3, g: 70 },
  'avocado': { per: 'each', gbp: 1.0, g: 170 },
  'melon': { per: 'each', gbp: 1.5, g: 1200 },
  'pineapple': { per: 'each', gbp: 1.3, g: 1000 },
  'mango': { per: 'each', gbp: 1.0, g: 300 },
  'kiwi': { per: 'each', gbp: 0.35, g: 80 },
  'dates': { per: 'kg', gbp: 6.0 },
  'raisins': { per: 'kg', gbp: 3.5 },

  // --- Tins, pulses -------------------------------------------------------
  'chopped-tomatoes-tin': { per: 'each', gbp: 0.55, g: 400 },
  'passata': { per: 'each', gbp: 0.9, g: 500 },
  'tomato-puree': { per: 'each', gbp: 0.9, g: 200 },
  'chickpeas-tin': { per: 'each', gbp: 0.6, g: 240 },
  'black-beans-tin': { per: 'each', gbp: 0.75, g: 240 },
  'kidney-beans-tin': { per: 'each', gbp: 0.6, g: 240 },
  'butter-beans-tin': { per: 'each', gbp: 0.7, g: 240 },
  'cannellini-tin': { per: 'each', gbp: 0.7, g: 240 },
  'baked-beans': { per: 'each', gbp: 0.6, g: 400 },
  'lentils-dried': { per: 'kg', gbp: 2.0 },
  'red-lentils': { per: 'kg', gbp: 2.0 },
  'coconut-milk-tin': { per: 'each', gbp: 1.1, g: 400 },

  // --- Fats, nuts, seeds --------------------------------------------------
  'olive-oil': { per: 'kg', gbp: 7.0 },
  'vegetable-oil': { per: 'kg', gbp: 2.5 },
  'sesame-oil': { per: 'kg', gbp: 12.0 },
  'peanut-butter': { per: 'kg', gbp: 4.0 },
  'almonds': { per: 'kg', gbp: 10.0 },
  'cashews': { per: 'kg', gbp: 11.0 },
  'walnuts': { per: 'kg', gbp: 12.0 },
  'mixed-nuts': { per: 'kg', gbp: 10.0 },
  'peanuts': { per: 'kg', gbp: 4.5 },
  'chia-seeds': { per: 'kg', gbp: 10.0 },
  'pumpkin-seeds': { per: 'kg', gbp: 8.0 },
  'sunflower-seeds': { per: 'kg', gbp: 4.0 },
  'sesame-seeds': { per: 'kg', gbp: 8.0 },
  'flaxseed': { per: 'kg', gbp: 6.0 },
  'tahini': { per: 'kg', gbp: 7.0 },
  'dark-chocolate': { per: 'kg', gbp: 12.0 },

  // --- Store cupboard that is NOT a basic ---------------------------------
  // The shopping prompt already drops salt, pepper and cooking oil. What is
  // left here is the stuff that genuinely goes in the trolley.
  'soy-sauce': { per: 'kg', gbp: 4.0 },
  'fish-sauce': { per: 'kg', gbp: 6.0 },
  'oyster-sauce': { per: 'kg', gbp: 5.0 },
  'sweet-chilli-sauce': { per: 'kg', gbp: 4.0 },
  'hot-sauce': { per: 'kg', gbp: 6.0 },
  'honey': { per: 'kg', gbp: 6.0 },
  'maple-syrup': { per: 'kg', gbp: 10.0 },
  'balsamic-vinegar': { per: 'kg', gbp: 4.0 },
  'vinegar': { per: 'kg', gbp: 1.5 },
  'mustard': { per: 'kg', gbp: 4.0 },
  'mayonnaise': { per: 'kg', gbp: 3.5 },
  'ketchup': { per: 'kg', gbp: 2.5 },
  'curry-paste': { per: 'kg', gbp: 6.0 },
  'harissa': { per: 'kg', gbp: 10.0 },
  'pesto': { per: 'kg', gbp: 8.0 },
  'miso-paste': { per: 'kg', gbp: 12.0 },
  'gochujang': { per: 'kg', gbp: 10.0 },
  'stock-cube': { per: 'each', gbp: 0.1, g: 10 },
  // Liquid stock, and wine for cooking. Added after a real plan priced 19 lines
  // and left these three unmatched — the food was in the trolley, just not in
  // the table.
  'stock': { per: 'kg', gbp: 1.2 },
  'red-wine': { per: 'kg', gbp: 7.0 },
  'white-wine': { per: 'kg', gbp: 7.0 },
  'dried-spice': { per: 'each', gbp: 1.2, g: 40 },
  'fresh-herbs': { per: 'each', gbp: 0.8, g: 30 },

  // --- Plant protein, milk alternatives -----------------------------------
  'tofu': { per: 'kg', gbp: 6.0, g: 280 },
  'tempeh': { per: 'kg', gbp: 12.0 },
  'quorn-mince': { per: 'kg', gbp: 7.0 },
  'soy-milk': { per: 'kg', gbp: 1.3 },
  'almond-milk': { per: 'kg', gbp: 1.5 },
  'oat-milk': { per: 'kg', gbp: 1.3 },

  // --- Supplements --------------------------------------------------------
  'whey-protein': { per: 'kg', gbp: 25.0 },
  'protein-bar': { per: 'each', gbp: 1.8, g: 60 },
}

export const PRICE_KEYS = Object.keys(PRICES)

/**
 * Pull a quantity out of a shopping line.
 *
 * Done in code, not by the model, because the line already SAYS the quantity —
 * "600g chicken thigh fillets". Asking a model to repeat a number back is how
 * you get 60 or 6000 one time in twenty, and nothing downstream would catch it.
 *
 * Millilitres count as grammes. Wrong for oil by about 8%, which is under a penny
 * on any line here, and right for the stock, milk and passata that make up the
 * rest of the volume lines.
 *
 * Returns a weight and a count, each null where the text does not say.
 */
export function parseQty(text) {
  const s = String(text || '').toLowerCase()
  const out = { grams: null, count: null }

  // "2 x 400g tins" — multipack first, or the plain weight match below would
  // take the 400g and silently halve the line.
  const multi = s.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/)
  if (multi) {
    const n = Number(multi[1])
    const each = Number(multi[2]) * (multi[3] === 'kg' || multi[3] === 'l' ? 1000 : 1)
    out.grams = n * each
    out.count = n
    return out
  }

  const w = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/)
  if (w) {
    out.grams = Number(w[1]) * (w[2] === 'kg' || w[2] === 'l' ? 1000 : 1)
    return out
  }

  // Spoons. Worth parsing because they are how every sauce, oil, vinegar and
  // paste is written, and those lines came back unpriced while the food itself
  // was sitting in the table. Standard UK measures: 15ml and 5ml.
  const spoon = s.match(/(\d+(?:\.\d+)?)\s*(tbsp|tablespoons?|tsp|teaspoons?)\b/)
  if (spoon) {
    out.grams = Number(spoon[1]) * (/^t(b|ablespoon)/.test(spoon[2]) ? 15 : 5)
    return out
  }

  // No weight, so a leading number is a count: "12 eggs", "2 peppers",
  // "1 bunch spring onions". Reject a year or a daft number — a line claiming
  // 400 lemons is a parse accident, and pricing it would be worse than
  // admitting the line is unpriced.
  const c = s.match(/^\s*(\d+)\b/)
  if (c) {
    const n = Number(c[1])
    if (n >= 1 && n <= 60) out.count = n
  }
  return out
}

/**
 * Cost one tagged line. `key` comes from the model, the quantity from the text.
 *
 * Returns pence, or null when it cannot be priced — and null is NOT zero. A
 * line that falls through here has to show as unpriced in the UI, the same rule
 * coachContext uses for a missing day.
 */
export function penceFor({ text, key, grams, count }) {
  const entry = PRICES[key]
  if (!entry) return null

  // The TEXT wins over anything the model supplied. The line already states the
  // quantity, and a model asked to repeat a number back gets it wrong
  // occasionally in a way nothing downstream could catch. The model's figure is
  // only a fallback for a line that states no quantity at all — "a bunch of
  // coriander", which would otherwise come back unpriced.
  const q = parseQty(text)
  let g = q.grams || (Number.isFinite(grams) && grams > 0 ? grams : null)
  let n = q.count || (Number.isFinite(count) && count > 0 ? count : null)

  if (entry.per === 'each') {
    // A weight against a per-item price: "320g peppers" is two peppers.
    if (!n && g && entry.g) n = g / entry.g
    if (!n) return null
    return Math.round(n * entry.gbp * 100)
  }

  // Priced by weight. A count converts if we know what one weighs.
  if (!g && n && entry.g) g = n * entry.g
  if (!g) return null
  return Math.round((g / 1000) * entry.gbp * 100)
}

/**
 * Total a tagged shopping list.
 *
 * `tagged` is one entry per line: the text, a price key, and optionally an
 * explicit weight or count. Lines that
 * cannot be priced are named in `unpriced` rather than counted as free, so the
 * UI can say "14 of 17 priced" and the total is never quietly short.
 */
export function costOf(tagged) {
  let pence = 0
  let priced = 0
  const unpriced = []
  for (const line of Array.isArray(tagged) ? tagged : []) {
    const p = penceFor(line)
    if (p === null) { unpriced.push(String(line?.text || '')); continue }
    pence += p
    priced++
  }
  return {
    pence,
    gbp: pence / 100,
    priced,
    unpriced,
    total: priced + unpriced.length,
    asOf: PRICES_AS_OF,
    basis: PRICE_BASIS,
  }
}
