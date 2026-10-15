// Which exact pack to put in the trolley.
//
// The search handoff in shopLinks.js takes a line to a results page. This takes
// the common ones straight to the product, which is one tap from Add, and says
// how many packs the week needs: 380g of thigh fillets is one 600g pack, not
// 380g of anything.
//
// WHY A HAND-KEPT TABLE, the same argument mealPrices.js makes about prices: a
// model asked for a product id will write a plausible one, it will resolve to
// some other food or to nothing, and there is no date on it and no way to
// correct it. These were each read off a real results page. A wrong row here is
// one row to edit.
//
// WHY ONLY SOME KEYS. An absent row falls back to the search, which is always
// correct if less direct. That makes this table safe to grow one row at a time
// and pointless to guess at. Keys not here are deliberate, not forgotten.
//
// HOW A ROW WAS CHOSEN: the plainest own-label version of the food. Tesco's
// results for "chicken thigh fillets" include Finest, BBQ, Organic and "Feta &
// Lemon ... with Tomato Tapenade" — that last one has dairy in it. A row must
// be the food itself, never a flavoured, marinated or made-up version of it,
// because the line it is standing in for says "chicken thigh fillets" and
// nothing more. The test file enforces that as far as a name can show it.
//
// NO IMPORTS and no window: the rules below are the testable half.

export const PRODUCTS_AS_OF = 'October 2026'
export const PRODUCT_NOTE = `Pack suggestions were read off the shops' own pages in ${PRODUCTS_AS_OF}, and products do get delisted or change size — so check the pack on the way past before you add it.`

// `g` is the pack weight in grammes; `n` is how many a pack holds. One or the
// other, because that is how the quantity on the list is expressed.
export const PRODUCTS = {
  // Each row was read off a real results page on 15 Oct 2026, and every id was
  // then opened to confirm it resolves to that product. The name is here so the
  // app can SHOW what it is about to send you to — a silent substitution is the
  // thing to avoid, and a name you can read is the cheapest possible guard.
  tesco: {
    // Meat & fish
    'chicken-breast': { id: '294007923', name: 'Tesco British Chicken Breast Fillets 650g', g: 650 },
    'chicken-thigh-fillet': { id: '288661225', name: 'Tesco British Chicken Thigh Fillets 600g', g: 600 },
    'chicken-mince': { id: '308104406', name: 'Tesco Chicken Mince 5% Fat 500g', g: 500 },
    'turkey-mince': { id: '313618678', name: 'Tesco British Turkey Breast Mince 2% Fat 500g', g: 500 },
    'beef-mince': { id: '308083458', name: 'Tesco Beef Mince 20% Fat 500g', g: 500 },
    'beef-mince-lean': { id: '282470731', name: 'Tesco Lean Beef Steak Mince 5% Fat 750g', g: 750 },
    'salmon-fillet': { id: '296920881', name: 'Tesco 2 Boneless Salmon Fillets 260g', g: 260 },
    'cod-fillet': { id: '301882975', name: 'Tesco Cod Fillets 360g', g: 360 },
    'tuna-tin': { id: '303887546', name: 'Tesco Tuna Chunks In Spring Water 145g', n: 1 },
    // Dairy & eggs
    'egg': { id: '313857728', name: 'Tesco British Barn Eggs 10 Pack', n: 10 },
    'greek-yogurt': { id: '258170229', name: 'Tesco Greek Style Yogurt 500g', g: 500 },
    'cheddar': { id: '305951277', name: 'Tesco Medium Cheddar 400g', g: 400 },
    'butter': { id: '290920510', name: 'Tesco British Salted Block Butter 250g', g: 250 },
    // Bread, rice & pasta
    'basmati-rice': { id: '254877477', name: 'Tesco Basmati Rice 1kg', g: 1000 },
    'pasta': { id: '254878482', name: 'Tesco Penne Pasta Quills 500g', g: 500 },
    'oats': { id: '254853776', name: 'Tesco Scottish Oats Porridge 1kg', g: 1000 },
    'potato': { id: '313165959', name: 'Tesco All Rounder Potatoes 2kg', g: 2000 },
    'sweet-potato': { id: '310190037', name: 'Tesco Sweet Potatoes 1kg', g: 1000 },
    // Fruit & veg
    'onion': { id: '255736044', name: 'Tesco Brown Onions 1kg', g: 1000 },
    'red-onion': { id: '262645072', name: 'Tesco Red Onions Pack 1Kg', g: 1000 },
    'carrot': { id: '305953125', name: 'Tesco Carrots 1kg', g: 1000 },
    'broccoli': { id: '307344549', name: 'Tesco Broccoli 375g', g: 375 },
    'spinach': { id: '275549004', name: 'Tesco Spinach 500g', g: 500 },
    'mushrooms': { id: '312570515', name: 'Tesco Closed Cup Mushrooms 400g', g: 400 },
    'cherry-tomatoes': { id: '313968087', name: 'Tesco Cherry Tomatoes 300g', g: 300 },
    'pepper': { id: '258421636', name: 'Tesco Red Peppers Each', n: 1 },
    // Tins & packets
    'chopped-tomatoes-tin': { id: '251825089', name: 'Tesco Italian Chopped Tomatoes 400g', n: 1 },
    'chickpeas-tin': { id: '262490576', name: 'Tesco Chickpeas In Water 400g', n: 1 },
    'black-beans-tin': { id: '297021336', name: 'Tesco Black Beans 400g', n: 1 },
    // Oils, and the three store-cupboard lines that come up most
    'olive-oil': { id: '254918424', name: 'Tesco Olive Oil 1L', g: 1000 },
    'peanut-butter': { id: '264769626', name: 'Tesco Smooth Peanut Butter 340g', g: 340 },
    'honey': { id: '254850860', name: 'Tesco Clear Honey 454g', g: 454 },
    'soy-sauce': { id: '294781229', name: 'Tesco Light Soy Sauce 150ml', g: 150 },
  },
  // Asda's own-label names carry adjectives — "Crunchy & Sweet Carrots" is the
  // plain bag of carrots. So an "&" in a name means nothing here, which is why
  // the guard test cannot use it as a signal the way it could on Tesco.
  //
  // This table is shorter than Tesco's on purpose. Several Asda own-label lines
  // do not state a pack weight in the name at all, and a row with a guessed
  // weight would hand out the wrong number of packs — so those keys are left
  // out and fall back to a search.
  asda: {
    'chicken-breast': { id: '5832636', name: 'ASDA Chicken Breast Fillets 600g', g: 600 },
    'turkey-mince': { id: '5366752', name: 'ASDA Extra Lean Turkey Mince 500g', g: 500 },
    'beef-mince': { id: '7311848', name: 'JUST ESSENTIALS by ASDA Beef Mince 500g', g: 500 },
    'beef-mince-lean': { id: '5391423', name: 'ASDA Beef Mince <5% Fat 500g', g: 500 },
    'salmon-fillet': { id: '9311950', name: 'ASDA 2 Boneless Salmon Fillets 260g', g: 260 },
    'cod-fillet': { id: '4681763', name: 'ASDA 2 Cod Fillets 260g', g: 260 },
    'tuna-tin': { id: '6117168', name: 'ASDA Tuna Chunks in Spring Water 145g', n: 1 },
    'egg': { id: '1058519', name: 'ASDA 12 Free Range Medium Eggs', n: 12 },
    'greek-yogurt': { id: '1944643', name: 'ASDA Creamy Greek Style Yogurt 500g', g: 500 },
    'cheddar': { id: '6793868', name: 'ASDA British Mature Cheddar 400g', g: 400 },
    'butter': { id: '3580294', name: 'ASDA British Salted Butter 250g', g: 250 },
    'basmati-rice': { id: '18631', name: 'ASDA Basmati White Rice 1kg', g: 1000 },
    'pasta': { id: '2567932', name: 'ASDA Penne 500g', g: 500 },
    'oats': { id: '5805443', name: 'ASDA Scottish Porridge Oats 1kg', g: 1000 },
    'potato': { id: '9402722', name: 'ASDA British White Potatoes 2kg', g: 2000 },
    'sweet-potato': { id: '2076628', name: 'ASDA Creamy & Flavoursome Sweet Potatoes 1kg', g: 1000 },
    'onion': { id: '2110666', name: 'ASDA Brown Onions 1kg', g: 1000 },
    'carrot': { id: '150208', name: 'ASDA Crunchy & Sweet Carrots 1kg', g: 1000 },
    'spinach': { id: '5792183', name: 'ASDA Mild & Tender Spinach 300g', g: 300 },
    'cherry-tomatoes': { id: '9041476', name: 'ASDA Crunchy & Juicy Cherry Tomatoes 300g', g: 300 },
    'pepper': { id: '1857059', name: 'ASDA Loose Red Pepper', n: 1 },
    'chopped-tomatoes-tin': { id: '5611428', name: 'ASDA Chopped Tomatoes 400g', n: 1 },
    'chickpeas-tin': { id: '5016063', name: 'ASDA Chickpeas in Water 400g', n: 1 },
    'black-beans-tin': { id: '6038347', name: 'ASDA Black Beans in Water 400g', n: 1 },
    'olive-oil': { id: '6722819', name: 'ASDA Olive Oil 1 Litre', g: 1000 },
    'peanut-butter': { id: '4139288', name: 'ASDA Classic Smooth Peanut Butter 340g', g: 340 },
    'soy-sauce': { id: '7734510', name: 'ASDA Light Soy Sauce 150ml', g: 150 },
  },
}

// The product page for an id. Verified shapes — see tests/shop-products.test.mjs.
export const PRODUCT_URL = {
  tesco: (id) => `https://www.tesco.com/shop/en-GB/products/${id}`,
  asda: (id) => `https://www.asda.com/groceries/product/${id}`,
}

/**
 * Whether this week may use product links at all.
 *
 * THE HAZARD. The tagging step maps an ingredient line to a key BY FOOD,
 * ignoring preparation — so "gluten-free pasta" is tagged `pasta`,
 * "lactose-free milk" is `milk`, and halal chicken is `chicken-breast`. The
 * search link survives that, because it carries the line's own words to the
 * shop. A product link does not: it would take a coeliac to wheat pasta, and
 * the product's NAME would not warn them, because wheat pasta is not called
 * anything.
 *
 * MealPlan.jsx already carries a warning about this exact failure — a week
 * restored without its answers putting back the allergy the app had just been
 * told about. So: no dietary requirements, no allergies, and answers actually
 * on file. A week saved before `inputs` existed has none, and gets searches.
 */
export function productLinksAllowed(inputs) {
  if (!inputs) return false
  if (Array.isArray(inputs.diet) && inputs.diet.length > 0) return false
  if (String(inputs.allergies || '').trim()) return false
  return true
}

// A line that names its own version of the food is not safe to swap for a
// specific pack, whatever the week's answers say — "oat milk" tagged as `milk`
// must not become dairy. Deliberately wide: "free" catches free-from and
// free-range alike, and a false refusal only costs a search.
const QUALIFIED = /\b(free|vegan|vegetarian|veggie|halal|kosher|plant|unsweetened|reduced|light|low|skimmed|wholemeal|wholewheat|brown|gluten|dairy|lactose|soya?|oat|almond|coconut|rice)\b/i

export function labelIsPlain(label) {
  return !QUALIFIED.test(String(label || ''))
}

/**
 * The pack for one line, or null to fall back to a search.
 *
 * Every condition has to pass: the week's answers allow it, the line does not
 * name its own version of the food, and the table actually has a row.
 */
export function productFor(storeId, key, label, inputs) {
  if (!productLinksAllowed(inputs)) return null
  if (!labelIsPlain(label)) return null
  const table = PRODUCTS[storeId]
  const entry = table ? table[key] : null
  if (!entry || !entry.id || !entry.name) return null
  const url = PRODUCT_URL[storeId]
  if (!url) return null
  return { ...entry, url: url(entry.id) }
}

/**
 * How many of that pack the line needs. Always at least one, and always
 * rounded UP — half a pack is not a thing you can order.
 */
export function packsFor(entry, need) {
  if (!entry) return 0
  const count = Number(need?.count) > 0 ? Number(need.count) : 0
  const grams = Number(need?.grams) > 0 ? Number(need.grams) : 0
  if (entry.n > 0 && count > 0) return Math.max(1, Math.ceil(count / entry.n))
  if (entry.g > 0 && grams > 0) return Math.max(1, Math.ceil(grams / entry.g))
  // A line with no quantity on it — "fresh coriander". One pack, and the label
  // beside it still says what the line asked for.
  return 1
}
