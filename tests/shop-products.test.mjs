// Which pack, and how many of them.
//
// Two different jobs in here. The first is the SAFETY rule: a product link
// replaces the line's own words with a specific product, and the price key it
// is looked up by has already thrown away the dietary qualifier — `pasta` is
// what "gluten-free pasta" is tagged as. Those tests are the ones that matter.
//
// The second is the table itself. Every id in it was opened in a real browser
// on 15 Oct 2026 and confirmed to resolve to the product named beside it
// (33 Tesco rows, 27 Asda rows, one name corrected on the way). That cannot be
// re-run here, so what the guard test below enforces is the shape, and the one
// thing a name can still show: that a row is the plain food and not a
// flavoured, breaded or premium version of it.
import test from 'node:test'
import assert from 'node:assert/strict'
import { PRODUCTS, PRODUCT_URL, productFor, packsFor, productLinksAllowed, labelIsPlain } from '../src/shopProducts.js'
import { PRICES } from '../src/mealPrices.js'

const CLEAN = { meals: 3, options: 2, snacks: false, diet: [], allergies: '', prefs: '' }

test('a week with dietary requirements gets no product links at all', () => {
  // The hazard, stated as a test: the tagger maps BY FOOD, so a gluten-free
  // pasta line is tagged `pasta`, and `pasta` is wheat. The search link carries
  // the line's own words to the shop; a product link throws them away.
  assert.equal(productLinksAllowed({ ...CLEAN, diet: ['Gluten-free'] }), false)
  assert.equal(productLinksAllowed({ ...CLEAN, diet: ['Vegan'] }), false)
  assert.equal(productLinksAllowed({ ...CLEAN, allergies: 'dairy' }), false)
  assert.equal(productLinksAllowed({ ...CLEAN, allergies: '   ' }), true, 'whitespace is not an allergy')
  assert.equal(productLinksAllowed(CLEAN), true)
})

test('a week saved before the answers were kept gets no product links either', () => {
  // MealPlan.jsx already warns about this week: restored without its inputs, so
  // nobody knows what it was built around. Absent beats assumed.
  assert.equal(productLinksAllowed(null), false)
  assert.equal(productLinksAllowed(undefined), false)
})

test('a line that names its own version of the food stays a search', () => {
  // Even on a week with no dietary answers at all. "oat milk" is tagged `milk`.
  assert.equal(labelIsPlain('500g milk'), true)
  assert.equal(labelIsPlain('500g oat milk'), false)
  assert.equal(labelIsPlain('500g almond milk'), false)
  assert.equal(labelIsPlain('400g gluten-free pasta'), false)
  assert.equal(labelIsPlain('400g free-from pasta'), false)
  assert.equal(labelIsPlain('200g vegan cheddar'), false)
  assert.equal(labelIsPlain('500g halal chicken breast'), false)
  assert.equal(labelIsPlain('400g brown rice'), false)
  assert.equal(labelIsPlain('600g chicken breast'), true)
})

test('the whole chain has to agree before a line gets a pack', () => {
  assert.equal(productFor('tesco', 'chicken-breast', '650g chicken breast', CLEAN)?.id, '294007923')
  // Any one of these alone is enough to fall back to a search.
  assert.equal(productFor('tesco', 'chicken-breast', '650g halal chicken breast', CLEAN), null)
  assert.equal(productFor('tesco', 'chicken-breast', '650g chicken breast', { ...CLEAN, diet: ['Halal'] }), null)
  assert.equal(productFor('tesco', 'star-anise', '3 star anise', CLEAN), null, 'not in the table')
  assert.equal(productFor('tesco', '', '3 star anise', CLEAN), null, 'unpriced lines have no key')
  assert.equal(productFor('sainsburys', 'chicken-breast', '650g chicken breast', CLEAN), null)
})

test('the pack link is the url the browser check used', () => {
  const p = productFor('tesco', 'pasta', '500g pasta', CLEAN)
  assert.equal(p.url, 'https://www.tesco.com/shop/en-GB/products/254878482')
  const a = productFor('asda', 'pasta', '500g pasta', CLEAN)
  assert.equal(a.url, 'https://www.asda.com/groceries/product/2567932')
})

test('packs round up, because half a pack is not orderable', () => {
  const thighs = PRODUCTS.tesco['chicken-thigh-fillet'] // 600g
  assert.equal(packsFor(thighs, { grams: 380, count: 0 }), 1)
  assert.equal(packsFor(thighs, { grams: 600, count: 0 }), 1)
  assert.equal(packsFor(thighs, { grams: 601, count: 0 }), 2)
  assert.equal(packsFor(thighs, { grams: 1800, count: 0 }), 3)

  const eggs = PRODUCTS.tesco['egg'] // 10 a box
  assert.equal(packsFor(eggs, { grams: 0, count: 6 }), 1)
  assert.equal(packsFor(eggs, { grams: 0, count: 10 }), 1)
  assert.equal(packsFor(eggs, { grams: 0, count: 14 }), 2)
})

test('a line with no quantity still asks for one pack, never zero or NaN', () => {
  const oil = PRODUCTS.tesco['olive-oil']
  assert.equal(packsFor(oil, { grams: 0, count: 0 }), 1)
  assert.equal(packsFor(oil, null), 1)
  assert.equal(packsFor(oil, { grams: NaN, count: NaN }), 1)
  assert.equal(packsFor(null, { grams: 500 }), 0, 'no pack, no packs')
})

test('every row is shaped right, keyed to a real food, and is the plain one', () => {
  // The guard on a hand-kept table. A row that cannot be checked against a
  // shop can at least be checked against itself.
  //
  // Not usable as a signal here: "&" and "with". Asda's own-label names carry
  // adjectives — "ASDA Crunchy & Sweet Carrots 1kg" is just the bag of carrots.
  const VARIANT = /finest|exceptional|organic|bbq|marinated|flavoured|breaded|battered|teriyaki|tikka|smoked|spread/i
  let rows = 0
  for (const [store, table] of Object.entries(PRODUCTS)) {
    assert.ok(PRODUCT_URL[store], `${store} has no product url builder`)
    for (const [key, entry] of Object.entries(table)) {
      rows++
      const where = `${store}.${key}`
      assert.ok(PRICES[key], `${where} is not a price key, so nothing will ever look it up`)
      assert.match(entry.id, /^\d{4,}$/, `${where} id`)
      assert.ok(entry.name && entry.name.length > 6, `${where} needs a name to show`)
      assert.doesNotMatch(entry.name, VARIANT, `${where} looks like a variant, not the plain food`)
      assert.ok(entry.g > 0 || entry.n > 0, `${where} needs a pack size or the pack count is a guess`)
      if (entry.g) assert.ok(entry.g >= 50 && entry.g <= 10000, `${where} pack weight ${entry.g} is not plausible`)
      if (entry.n) assert.ok(entry.n >= 1 && entry.n <= 30, `${where} pack count ${entry.n} is not plausible`)
      assert.ok(!PRODUCT_URL[store](entry.id).includes(' '), `${where} url has a space in it`)
    }
  }
  assert.equal(rows, 60, 'the table that was verified in a browser had 60 rows')
})
