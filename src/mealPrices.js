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
export const PRICE_NOTE = `Indicative only — own-label prices as of ${PRICES_AS_OF}, not a live feed. Anything sold by weight is counted pro-rata, so 600g of chicken counts as 600g rather than the 1kg pack you actually put in the trolley. Things you buy whole, like eggs and peppers, are rounded up.`

// per: 'kg' prices by weight (millilitres are treated as grammes — near enough for
//      everything here except oil, and oil is pennies either way).
// per: 'each' prices by the item.
// g:   typical grammes of ONE, which lets a line convert between the two. "320g
//      peppers" against a per-each price, or "2 courgettes" against a per-kg
//      one, both resolve instead of coming back unpriced.
export const PRICES = {
  // --- Meat, fish ---------------------------------------------------------
  'chicken-breast': { per: 'kg', gbp: 7.5, aisle: 'Meat & fish' },
  'chicken-thigh-fillet': { per: 'kg', gbp: 6.5, aisle: 'Meat & fish' },
  'chicken-thigh-bone-in': { per: 'kg', gbp: 3.5, aisle: 'Meat & fish' },
  'chicken-whole': { per: 'kg', gbp: 3.5, aisle: 'Meat & fish' },
  'chicken-mince': { per: 'kg', gbp: 7.0, aisle: 'Meat & fish' },
  'turkey-mince': { per: 'kg', gbp: 7.5, aisle: 'Meat & fish' },
  'beef-mince-lean': { per: 'kg', gbp: 8.5, aisle: 'Meat & fish' },
  'beef-mince': { per: 'kg', gbp: 6.5, aisle: 'Meat & fish' },
  'beef-steak': { per: 'kg', gbp: 14.0, aisle: 'Meat & fish' },
  'beef-stewing': { per: 'kg', gbp: 9.0, aisle: 'Meat & fish' },
  'pork-loin': { per: 'kg', gbp: 7.0, aisle: 'Meat & fish' },
  'pork-mince': { per: 'kg', gbp: 6.0, aisle: 'Meat & fish' },
  'pork-shoulder': { per: 'kg', gbp: 5.5, aisle: 'Meat & fish' },
  'sausages': { per: 'kg', gbp: 6.5, g: 57, aisle: 'Meat & fish' },
  'bacon': { per: 'kg', gbp: 8.0, g: 30, aisle: 'Meat & fish' },
  'lamb-mince': { per: 'kg', gbp: 9.5, aisle: 'Meat & fish' },
  'lamb-chops': { per: 'kg', gbp: 13.0, aisle: 'Meat & fish' },
  'ham-slices': { per: 'kg', gbp: 9.0, aisle: 'Meat & fish' },
  'chorizo': { per: 'kg', gbp: 12.0, aisle: 'Meat & fish' },
  'salmon-fillet': { per: 'kg', gbp: 16.0, g: 130, aisle: 'Meat & fish' },
  'cod-fillet': { per: 'kg', gbp: 14.0, g: 140, aisle: 'Meat & fish' },
  'white-fish-fillet': { per: 'kg', gbp: 8.0, g: 130, aisle: 'Meat & fish' },
  'tuna-steak': { per: 'kg', gbp: 18.0, aisle: 'Meat & fish' },
  'prawns': { per: 'kg', gbp: 14.0, aisle: 'Meat & fish' },
  'smoked-salmon': { per: 'kg', gbp: 22.0, aisle: 'Meat & fish' },
  'tuna-tin': { per: 'each', gbp: 1.1, g: 110, aisle: 'Meat & fish' },
  'mackerel-tin': { per: 'each', gbp: 1.0, g: 110, aisle: 'Meat & fish' },
  'sardines-tin': { per: 'each', gbp: 1.0, g: 90, aisle: 'Meat & fish' },

  // --- Dairy, eggs --------------------------------------------------------
  'egg': { per: 'each', gbp: 0.25, g: 58, aisle: 'Dairy & eggs' },
  'milk': { per: 'kg', gbp: 1.2, aisle: 'Dairy & eggs' },
  'greek-yogurt': { per: 'kg', gbp: 3.5, aisle: 'Dairy & eggs' },
  'natural-yogurt': { per: 'kg', gbp: 2.0, aisle: 'Dairy & eggs' },
  'skyr': { per: 'kg', gbp: 5.0, aisle: 'Dairy & eggs' },
  'cottage-cheese': { per: 'kg', gbp: 4.5, aisle: 'Dairy & eggs' },
  'cheddar': { per: 'kg', gbp: 8.0, aisle: 'Dairy & eggs' },
  'mozzarella': { per: 'kg', gbp: 6.5, g: 125, aisle: 'Dairy & eggs' },
  'feta': { per: 'kg', gbp: 8.0, aisle: 'Dairy & eggs' },
  'parmesan': { per: 'kg', gbp: 16.0, aisle: 'Dairy & eggs' },
  'halloumi': { per: 'kg', gbp: 10.0, g: 225, aisle: 'Dairy & eggs' },
  'butter': { per: 'kg', gbp: 7.5, aisle: 'Dairy & eggs' },
  'cream-cheese': { per: 'kg', gbp: 6.0, aisle: 'Dairy & eggs' },
  'soured-cream': { per: 'kg', gbp: 4.0, aisle: 'Dairy & eggs' },
  'double-cream': { per: 'kg', gbp: 4.0, aisle: 'Dairy & eggs' },
  'creme-fraiche': { per: 'kg', gbp: 4.5, aisle: 'Dairy & eggs' },

  // --- Carbohydrate, bakery -----------------------------------------------
  'basmati-rice': { per: 'kg', gbp: 2.0, aisle: 'Bread, rice & pasta' },
  'white-rice': { per: 'kg', gbp: 1.4, aisle: 'Bread, rice & pasta' },
  'brown-rice': { per: 'kg', gbp: 2.0, aisle: 'Bread, rice & pasta' },
  'rice-pouch': { per: 'each', gbp: 1.0, g: 250, aisle: 'Bread, rice & pasta' },
  'pasta': { per: 'kg', gbp: 1.0, aisle: 'Bread, rice & pasta' },
  'wholewheat-pasta': { per: 'kg', gbp: 1.4, aisle: 'Bread, rice & pasta' },
  'egg-noodles': { per: 'kg', gbp: 3.0, aisle: 'Bread, rice & pasta' },
  'rice-noodles': { per: 'kg', gbp: 3.0, aisle: 'Bread, rice & pasta' },
  'couscous': { per: 'kg', gbp: 2.0, aisle: 'Bread, rice & pasta' },
  'bulgur-wheat': { per: 'kg', gbp: 2.2, aisle: 'Bread, rice & pasta' },
  'quinoa': { per: 'kg', gbp: 5.0, aisle: 'Bread, rice & pasta' },
  'oats': { per: 'kg', gbp: 1.2, aisle: 'Bread, rice & pasta' },
  'potato': { per: 'kg', gbp: 1.0, g: 180, aisle: 'Bread, rice & pasta' },
  'sweet-potato': { per: 'kg', gbp: 1.6, g: 200, aisle: 'Bread, rice & pasta' },
  'bread-loaf': { per: 'each', gbp: 1.3, g: 800, aisle: 'Bread, rice & pasta' },
  'wrap': { per: 'each', gbp: 0.2, g: 60, aisle: 'Bread, rice & pasta' },
  'pitta': { per: 'each', gbp: 0.2, g: 60, aisle: 'Bread, rice & pasta' },
  'bagel': { per: 'each', gbp: 0.35, g: 85, aisle: 'Bread, rice & pasta' },
  'naan': { per: 'each', gbp: 0.6, g: 130, aisle: 'Bread, rice & pasta' },
  'crumpet': { per: 'each', gbp: 0.2, g: 60, aisle: 'Bread, rice & pasta' },
  'flour': { per: 'kg', gbp: 1.0, aisle: 'Bread, rice & pasta' },
  'gnocchi': { per: 'kg', gbp: 2.5, g: 500, aisle: 'Bread, rice & pasta' },
  'tortilla-chips': { per: 'kg', gbp: 4.0, aisle: 'Bread, rice & pasta' },
  'rice-cake': { per: 'each', gbp: 0.08, g: 9, aisle: 'Bread, rice & pasta' },

  // --- Vegetables ---------------------------------------------------------
  'onion': { per: 'kg', gbp: 0.9, g: 150, aisle: 'Fruit & veg' },
  'red-onion': { per: 'kg', gbp: 1.4, g: 150, aisle: 'Fruit & veg' },
  'spring-onion': { per: 'each', gbp: 0.6, g: 100, aisle: 'Fruit & veg' },
  'garlic': { per: 'each', gbp: 0.35, g: 50, aisle: 'Fruit & veg' },
  'carrot': { per: 'kg', gbp: 0.7, g: 90, aisle: 'Fruit & veg' },
  'broccoli': { per: 'kg', gbp: 1.8, g: 350, aisle: 'Fruit & veg' },
  'cauliflower': { per: 'each', gbp: 1.2, g: 700, aisle: 'Fruit & veg' },
  'pepper': { per: 'each', gbp: 0.65, g: 160, aisle: 'Fruit & veg' },
  'courgette': { per: 'kg', gbp: 1.8, g: 200, aisle: 'Fruit & veg' },
  'aubergine': { per: 'each', gbp: 0.9, g: 300, aisle: 'Fruit & veg' },
  'mushrooms': { per: 'kg', gbp: 3.5, aisle: 'Fruit & veg' },
  'tomato': { per: 'kg', gbp: 2.5, g: 100, aisle: 'Fruit & veg' },
  'cherry-tomatoes': { per: 'kg', gbp: 5.0, aisle: 'Fruit & veg' },
  'spinach': { per: 'kg', gbp: 6.0, aisle: 'Fruit & veg' },
  'kale': { per: 'kg', gbp: 4.0, aisle: 'Fruit & veg' },
  'salad-leaves': { per: 'kg', gbp: 8.0, aisle: 'Fruit & veg' },
  'cucumber': { per: 'each', gbp: 0.75, g: 350, aisle: 'Fruit & veg' },
  'lettuce': { per: 'each', gbp: 0.8, g: 300, aisle: 'Fruit & veg' },
  'green-beans': { per: 'kg', gbp: 4.0, aisle: 'Fruit & veg' },
  'mangetout': { per: 'kg', gbp: 8.0, aisle: 'Fruit & veg' },
  'peas-frozen': { per: 'kg', gbp: 1.8, aisle: 'Fruit & veg' },
  'sweetcorn-tin': { per: 'each', gbp: 0.6, g: 165, aisle: 'Fruit & veg' },
  'leek': { per: 'kg', gbp: 2.0, g: 150, aisle: 'Fruit & veg' },
  'celery': { per: 'each', gbp: 0.85, g: 400, aisle: 'Fruit & veg' },
  'cabbage': { per: 'each', gbp: 0.9, g: 800, aisle: 'Fruit & veg' },
  'butternut-squash': { per: 'kg', gbp: 1.6, g: 900, aisle: 'Fruit & veg' },
  'asparagus': { per: 'kg', gbp: 10.0, aisle: 'Fruit & veg' },
  'beetroot': { per: 'kg', gbp: 2.0, aisle: 'Fruit & veg' },
  'pak-choi': { per: 'each', gbp: 0.8, g: 200, aisle: 'Fruit & veg' },
  'ginger': { per: 'kg', gbp: 6.0, aisle: 'Fruit & veg' },
  'chilli': { per: 'kg', gbp: 10.0, g: 15, aisle: 'Fruit & veg' },
  'mixed-veg-frozen': { per: 'kg', gbp: 1.6, aisle: 'Fruit & veg' },
  'stir-fry-veg': { per: 'kg', gbp: 2.5, aisle: 'Fruit & veg' },
  'olives': { per: 'kg', gbp: 8.0, aisle: 'Fruit & veg' },
  'hummus': { per: 'kg', gbp: 5.0, aisle: 'Fruit & veg' },

  // --- Fruit --------------------------------------------------------------
  'banana': { per: 'kg', gbp: 0.9, g: 120, aisle: 'Fruit & veg' },
  'apple': { per: 'kg', gbp: 2.0, g: 150, aisle: 'Fruit & veg' },
  'orange': { per: 'kg', gbp: 1.8, g: 180, aisle: 'Fruit & veg' },
  'pear': { per: 'kg', gbp: 2.2, g: 170, aisle: 'Fruit & veg' },
  'grapes': { per: 'kg', gbp: 3.5, aisle: 'Fruit & veg' },
  'strawberries': { per: 'kg', gbp: 6.0, aisle: 'Fruit & veg' },
  'blueberries': { per: 'kg', gbp: 10.0, aisle: 'Fruit & veg' },
  'raspberries': { per: 'kg', gbp: 12.0, aisle: 'Fruit & veg' },
  'berries-frozen': { per: 'kg', gbp: 4.0, aisle: 'Fruit & veg' },
  'lemon': { per: 'each', gbp: 0.35, g: 100, aisle: 'Fruit & veg' },
  'lime': { per: 'each', gbp: 0.3, g: 70, aisle: 'Fruit & veg' },
  'avocado': { per: 'each', gbp: 1.0, g: 170, aisle: 'Fruit & veg' },
  'melon': { per: 'each', gbp: 1.5, g: 1200, aisle: 'Fruit & veg' },
  'pineapple': { per: 'each', gbp: 1.3, g: 1000, aisle: 'Fruit & veg' },
  'mango': { per: 'each', gbp: 1.0, g: 300, aisle: 'Fruit & veg' },
  'kiwi': { per: 'each', gbp: 0.35, g: 80, aisle: 'Fruit & veg' },
  'dates': { per: 'kg', gbp: 6.0, aisle: 'Fruit & veg' },
  'raisins': { per: 'kg', gbp: 3.5, aisle: 'Fruit & veg' },

  // --- Tins, pulses -------------------------------------------------------
  'chopped-tomatoes-tin': { per: 'each', gbp: 0.55, g: 400, aisle: 'Tins & packets' },
  'passata': { per: 'each', gbp: 0.9, g: 500, aisle: 'Tins & packets' },
  'tomato-puree': { per: 'each', gbp: 0.9, g: 200, aisle: 'Tins & packets' },
  'chickpeas-tin': { per: 'each', gbp: 0.6, g: 240, aisle: 'Tins & packets' },
  'black-beans-tin': { per: 'each', gbp: 0.75, g: 240, aisle: 'Tins & packets' },
  'kidney-beans-tin': { per: 'each', gbp: 0.6, g: 240, aisle: 'Tins & packets' },
  'butter-beans-tin': { per: 'each', gbp: 0.7, g: 240, aisle: 'Tins & packets' },
  'cannellini-tin': { per: 'each', gbp: 0.7, g: 240, aisle: 'Tins & packets' },
  'baked-beans': { per: 'each', gbp: 0.6, g: 400, aisle: 'Tins & packets' },
  'lentils-dried': { per: 'kg', gbp: 2.0, aisle: 'Tins & packets' },
  'red-lentils': { per: 'kg', gbp: 2.0, aisle: 'Tins & packets' },
  'coconut-milk-tin': { per: 'each', gbp: 1.1, g: 400, aisle: 'Tins & packets' },

  // --- Fats, nuts, seeds --------------------------------------------------
  'olive-oil': { per: 'kg', gbp: 7.0, aisle: 'Oils, nuts & seeds' },
  'vegetable-oil': { per: 'kg', gbp: 2.5, aisle: 'Oils, nuts & seeds' },
  'sesame-oil': { per: 'kg', gbp: 12.0, aisle: 'Oils, nuts & seeds' },
  'peanut-butter': { per: 'kg', gbp: 4.0, aisle: 'Oils, nuts & seeds' },
  'almonds': { per: 'kg', gbp: 10.0, aisle: 'Oils, nuts & seeds' },
  'cashews': { per: 'kg', gbp: 11.0, aisle: 'Oils, nuts & seeds' },
  'walnuts': { per: 'kg', gbp: 12.0, aisle: 'Oils, nuts & seeds' },
  'mixed-nuts': { per: 'kg', gbp: 10.0, aisle: 'Oils, nuts & seeds' },
  'peanuts': { per: 'kg', gbp: 4.5, aisle: 'Oils, nuts & seeds' },
  'chia-seeds': { per: 'kg', gbp: 10.0, aisle: 'Oils, nuts & seeds' },
  'pumpkin-seeds': { per: 'kg', gbp: 8.0, aisle: 'Oils, nuts & seeds' },
  'sunflower-seeds': { per: 'kg', gbp: 4.0, aisle: 'Oils, nuts & seeds' },
  'sesame-seeds': { per: 'kg', gbp: 8.0, aisle: 'Oils, nuts & seeds' },
  'flaxseed': { per: 'kg', gbp: 6.0, aisle: 'Oils, nuts & seeds' },
  'tahini': { per: 'kg', gbp: 7.0, aisle: 'Oils, nuts & seeds' },
  'dark-chocolate': { per: 'kg', gbp: 12.0, aisle: 'Oils, nuts & seeds' },

  // --- Store cupboard that is NOT a basic ---------------------------------
  // The shopping prompt already drops salt, pepper and cooking oil. What is
  // left here is the stuff that genuinely goes in the trolley.
  'soy-sauce': { per: 'kg', gbp: 4.0, aisle: 'Condiments & sauces' },
  'fish-sauce': { per: 'kg', gbp: 6.0, aisle: 'Condiments & sauces' },
  'oyster-sauce': { per: 'kg', gbp: 5.0, aisle: 'Condiments & sauces' },
  'sweet-chilli-sauce': { per: 'kg', gbp: 4.0, aisle: 'Condiments & sauces' },
  'hot-sauce': { per: 'kg', gbp: 6.0, aisle: 'Condiments & sauces' },
  'honey': { per: 'kg', gbp: 6.0, aisle: 'Condiments & sauces' },
  'maple-syrup': { per: 'kg', gbp: 10.0, aisle: 'Condiments & sauces' },
  'balsamic-vinegar': { per: 'kg', gbp: 4.0, aisle: 'Condiments & sauces' },
  'vinegar': { per: 'kg', gbp: 1.5, aisle: 'Condiments & sauces' },
  'mustard': { per: 'kg', gbp: 4.0, aisle: 'Condiments & sauces' },
  'mayonnaise': { per: 'kg', gbp: 3.5, aisle: 'Condiments & sauces' },
  'ketchup': { per: 'kg', gbp: 2.5, aisle: 'Condiments & sauces' },
  'curry-paste': { per: 'kg', gbp: 6.0, aisle: 'Condiments & sauces' },
  'harissa': { per: 'kg', gbp: 10.0, aisle: 'Condiments & sauces' },
  'pesto': { per: 'kg', gbp: 8.0, aisle: 'Condiments & sauces' },
  'miso-paste': { per: 'kg', gbp: 12.0, aisle: 'Condiments & sauces' },
  'gochujang': { per: 'kg', gbp: 10.0, aisle: 'Condiments & sauces' },
  'stock-cube': { per: 'each', gbp: 0.1, g: 10, aisle: 'Condiments & sauces' },
  // Liquid stock, and wine for cooking. Added after a real plan priced 19 lines
  // and left these three unmatched — the food was in the trolley, just not in
  // the table.
  'stock': { per: 'kg', gbp: 1.2, aisle: 'Condiments & sauces' },
  'red-wine': { per: 'kg', gbp: 7.0, aisle: 'Condiments & sauces' },
  'white-wine': { per: 'kg', gbp: 7.0, aisle: 'Condiments & sauces' },
  'dried-spice': { per: 'each', gbp: 1.2, g: 40, aisle: 'Condiments & sauces' },
  'fresh-herbs': { per: 'each', gbp: 0.8, g: 30, aisle: 'Condiments & sauces' },

  // --- Plant protein, milk alternatives -----------------------------------
  'tofu': { per: 'kg', gbp: 6.0, g: 280, aisle: 'Chilled & plant-based' },
  'tempeh': { per: 'kg', gbp: 12.0, aisle: 'Chilled & plant-based' },
  'quorn-mince': { per: 'kg', gbp: 7.0, aisle: 'Chilled & plant-based' },
  'soy-milk': { per: 'kg', gbp: 1.3, aisle: 'Chilled & plant-based' },
  'almond-milk': { per: 'kg', gbp: 1.5, aisle: 'Chilled & plant-based' },
  'oat-milk': { per: 'kg', gbp: 1.3, aisle: 'Chilled & plant-based' },

  // --- Supplements --------------------------------------------------------
  'whey-protein': { per: 'kg', gbp: 25.0, aisle: 'Supplements' },
  'protein-bar': { per: 'each', gbp: 1.8, g: 60, aisle: 'Supplements' },
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

// The order a shop is walked in, roughly. 'Other' last — it is where anything
// with no price key lands.
export const AISLE_ORDER = [
  'Fruit & veg', 'Meat & fish', 'Dairy & eggs', 'Bread, rice & pasta',
  'Tins & packets', 'Oils, nuts & seeds', 'Condiments & sauces',
  'Chilled & plant-based', 'Supplements', 'Other',
]

/** "1.2kg", "600g", "12". Whole kilos lose the decimal. */
export function formatGrams(g) {
  if (g >= 1000) {
    const kg = g / 1000
    return `${Number.isInteger(kg) ? kg : kg.toFixed(1)}kg`
  }
  return `${Math.round(g)}g`
}

/**
 * Turn every meal's ingredient lines into ONE shopping list, grouped by aisle,
 * with the quantities added up and priced.
 *
 * This is in code, not in a prompt, because asking a model to do it does not
 * work. Given 197 exact ingredient lines and told to add them up, Haiku
 * returned 108 lines against the 62 it produced from loose descriptions — it
 * passed most of them straight through. Measured on a real week: ginger
 * appeared as three separate lines (15g, 12g, 10g), black beans twice, red
 * pepper twice. Summing a couple of hundred numbers is the one part of this
 * job a computer is strictly better at.
 *
 * So the model's only job is still recall — which food is this line, and what
 * is it called — and the grouping, the arithmetic and the aisles happen here.
 *
 * `tagged` is one entry per INGREDIENT line: { text, key, name, grammes, count }.
 * Returns the finished list and its cost, which therefore cannot disagree.
 */
export function aggregate(tagged) {
  const groups = new Map()
  for (const line of Array.isArray(tagged) ? tagged : []) {
    const text = String(line?.text || '')
    const key = PRICES[line?.key] ? line.key : ''
    const name = String(line?.name || '').trim() || text.replace(/^[\d.]+\s*(kg|g|ml|l|tbsp|tsp)?\s*/i, '').trim() || text
    // Without a price key, group on the name the model gave it, so two ways of
    // writing the same unpriceable thing still merge into one line.
    const id = key || `~${name.toLowerCase()}`
    const q = parseQty(text)
    const g = q.grams || (Number(line?.grams) > 0 ? Number(line.grams) : 0)
    const n = q.count || (Number(line?.count) > 0 ? Number(line.count) : 0)
    const cur = groups.get(id) || { key, name, grams: 0, count: 0, lines: 0 }
    cur.grams += g
    cur.count += n
    cur.lines++
    // Keep the shortest name — the model tends to write "60g red bell pepper
    // (additional)" on one line and "red pepper" on another.
    if (name.length < cur.name.length) cur.name = name
    groups.set(id, cur)
  }

  const byAisle = new Map()
  let pence = 0
  let priced = 0
  const unpriced = []

  for (const grp of groups.values()) {
    const entry = PRICES[grp.key]
    let label
    let p = null

    if (entry && entry.per === 'each') {
      // Things bought whole. A weight converts, and the total rounds UP,
      // because you cannot put 1.7 peppers in the trolley.
      let n = grp.count + (grp.grams && entry.g ? grp.grams / entry.g : 0)
      n = Math.max(1, Math.ceil(n))
      label = `${n} ${grp.name}`
      p = Math.round(n * entry.gbp * 100)
    } else if (entry) {
      // Priced by weight, so the quantity stays as it is — pro-rata.
      const g = grp.grams + (grp.count && entry.g ? grp.count * entry.g : 0)
      if (g > 0) {
        label = `${formatGrams(g)} ${grp.name}`
        p = Math.round((g / 1000) * entry.gbp * 100)
      } else {
        label = grp.name
      }
    } else {
      // No price for it. It still belongs on the list — he has to buy it.
      label = grp.grams > 0 ? `${formatGrams(grp.grams)} ${grp.name}`
        : grp.count > 0 ? `${Math.ceil(grp.count)} ${grp.name}`
        : grp.name
    }

    if (p === null) unpriced.push(label)
    else { pence += p; priced++ }

    const aisle = entry?.aisle || 'Other'
    if (!byAisle.has(aisle)) byAisle.set(aisle, [])
    byAisle.get(aisle).push(label)
  }

  const shopping = AISLE_ORDER
    .filter((a) => byAisle.has(a))
    .map((a) => ({ aisle: a, items: byAisle.get(a).sort((x, y) => x.localeCompare(y)) }))

  return {
    shopping,
    cost: {
      pence,
      gbp: pence / 100,
      priced,
      unpriced,
      total: priced + unpriced.length,
      asOf: PRICES_AS_OF,
      basis: PRICE_BASIS,
    },
  }
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
