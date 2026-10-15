// What the shopping list costs.
//
// These cover the half of the job that is NOT the model's. The model only ever
// supplies a key naming the food; the quantity comes out of the line's own text
// and the arithmetic is JavaScript. So every way the total can go wrong is in
// here, and testable without a network call.
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseQty, penceFor, costOf, aggregate, formatGrams, PRICES, PRICE_KEYS, AISLE_ORDER } from '../src/mealPrices.js'

// No globals stubbed, on purpose: mealPrices.js imports nothing, because a
// Netlify function reads it too. If this file ever needs a window, that rule
// has been broken.

test('quantities come out of the line itself', () => {
  assert.equal(parseQty('600g chicken thigh fillets').grams, 600)
  assert.equal(parseQty('1.2kg potatoes').grams, 1200)
  assert.equal(parseQty('500ml semi-skimmed milk').grams, 500)
  assert.equal(parseQty('1l whole milk').grams, 1000)
  assert.equal(parseQty('fresh coriander').grams, null)
})

test('a multipack beats the plain weight match', () => {
  // "2 x 400g" must not price as one 400g tin, which is how a list ends up
  // quietly half costed.
  assert.equal(parseQty('2 x 400g tins chopped tomatoes').grams, 800)
  assert.equal(parseQty('2 x 400g tins chopped tomatoes').count, 2)
  assert.equal(parseQty('3 × 400g tins').grams, 1200)
})

test('a leading number with no unit is a count', () => {
  assert.equal(parseQty('12 eggs').count, 12)
  assert.equal(parseQty('12 eggs').grams, null)
  assert.equal(parseQty('1 bunch spring onions').count, 1)
  assert.equal(parseQty('fresh coriander').count, null)
})

test('a daft count is refused rather than priced', () => {
  // A line claiming 400 lemons is a parse accident. Pricing it is worse than
  // admitting the line could not be priced.
  assert.equal(parseQty('400 lemons').count, null)
})

test('a stated weight wins over a leading number', () => {
  assert.equal(parseQty('2 chicken breasts, 300g total').grams, 300)
})

test('spoons are a quantity', () => {
  // How every sauce, oil, vinegar and paste gets written. Without this they
  // came back unpriced while the food was sitting in the table.
  assert.equal(parseQty('1 tbsp balsamic vinegar').grams, 15)
  assert.equal(parseQty('2 tablespoons soy sauce').grams, 30)
  assert.equal(parseQty('1 tsp honey').grams, 5)
  assert.equal(parseQty('3 teaspoons sesame oil').grams, 15)
  // A stated weight still wins over a spoon in the same line.
  assert.equal(parseQty('30g (2 tbsp) peanut butter').grams, 30)
  assert.equal(penceFor({ text: '1 tbsp balsamic vinegar', key: 'balsamic-vinegar' }), 6)
})

test('one line, priced by weight or by the item', () => {
  assert.equal(penceFor({ text: '600g chicken thigh fillets', key: 'chicken-thigh-fillet' }), 390)
  assert.equal(penceFor({ text: '12 eggs', key: 'egg' }), 300)
})

test('a line converts between weight and count', () => {
  // 320g of peppers against a per-item price is two peppers; two courgettes
  // against a per-kilo price is 400g.
  assert.equal(penceFor({ text: '320g peppers', key: 'pepper' }), 130)
  assert.equal(penceFor({ text: '2 courgettes', key: 'courgette' }), 72)
})

test('an unpriceable line is null, never zero', () => {
  // Same rule the coach context uses for a missing day: absent is not zero. A
  // line nobody can price must not make the shop look cheaper than it is.
  assert.equal(penceFor({ text: '2 star anise', key: 'star-anise' }), null)
  assert.equal(penceFor({ text: 'a pinch of saffron', key: '' }), null)
  assert.equal(penceFor({ text: 'fresh coriander', key: 'fresh-herbs' }), null)
})

test('the model may only supply a quantity the text omits', () => {
  // Its estimate rescues "fresh coriander"...
  assert.equal(penceFor({ text: 'fresh coriander', key: 'fresh-herbs', grams: 30 }), 80)
  // ...but can never override a quantity the line already states, so a
  // mistyped number cannot move the total.
  assert.equal(penceFor({ text: '600g chicken thigh fillets', key: 'chicken-thigh-fillet', grams: 60 }), 390)
})

test('a list totals, and owns up to what it could not price', () => {
  const c = costOf([
    { text: '600g chicken thigh fillets', key: 'chicken-thigh-fillet' },
    { text: '12 eggs', key: 'egg' },
    { text: '2 x 400g tins chopped tomatoes', key: 'chopped-tomatoes-tin' },
    { text: '320g peppers', key: 'pepper' },
    { text: 'a pinch of saffron', key: '' },
  ])
  assert.equal(c.pence, 930)
  assert.equal(c.gbp, 9.3)
  assert.equal(c.priced, 4)
  assert.equal(c.total, 5)
  assert.deepEqual(c.unpriced, ['a pinch of saffron'])
  // The date rides along with the figure, so the UI can never show a total
  // without saying how old its prices are.
  assert.ok(c.asOf)
  assert.ok(c.basis)
})

test('an empty or junk list does not throw', () => {
  assert.equal(costOf([]).pence, 0)
  assert.equal(costOf(null).priced, 0)
  assert.equal(costOf(undefined).unpriced.length, 0)
})

test('every table entry is usable', () => {
  const bad = PRICE_KEYS.filter((k) => {
    const e = PRICES[k]
    return !((e.per === 'kg' || e.per === 'each') && typeof e.gbp === 'number' && e.gbp > 0)
  })
  assert.deepEqual(bad, [], `entries missing a unit or a price: ${bad.join(', ')}`)
})

test('per-item entries know what one weighs', () => {
  // Without it, a per-item price cannot resolve a line that states a weight —
  // and most lines state a weight.
  const noWeight = PRICE_KEYS.filter((k) => PRICES[k].per === 'each' && !PRICES[k].g)
  assert.deepEqual(noWeight, [], `per-item entries with no typical weight: ${noWeight.join(', ')}`)
})

test('keys are clean and unique', () => {
  const malformed = PRICE_KEYS.filter((k) => !/^[a-z0-9-]+$/.test(k))
  assert.deepEqual(malformed, [])
  assert.equal(new Set(PRICE_KEYS).size, PRICE_KEYS.length)
})

test('every entry has an aisle, and the aisle is one we order', () => {
  const bad = PRICE_KEYS.filter((k) => !AISLE_ORDER.includes(PRICES[k].aisle))
  assert.deepEqual(bad, [], `entries with no aisle or an unknown one: ${bad.join(', ')}`)
})

test('weights read the way a shopping list writes them', () => {
  assert.equal(formatGrams(600), '600g')
  assert.equal(formatGrams(1000), '1kg')
  assert.equal(formatGrams(1200), '1.2kg')
  assert.equal(formatGrams(1250), '1.3kg')
})

// The heart of it. Measured against a real week, a model given 197 exact
// ingredient lines and told to add them up returned 108 lines — ginger three
// times, black beans twice. These assert the arithmetic that replaced it.
test('the same food from several meals becomes ONE line', () => {
  const { shopping, cost } = aggregate([
    { text: '180g chicken thigh fillets', key: 'chicken-thigh-fillet', name: 'chicken thigh fillets' },
    { text: '200g chicken thigh fillets', key: 'chicken-thigh-fillet', name: 'chicken thigh fillets' },
    { text: '220g diced chicken thigh', key: 'chicken-thigh-fillet', name: 'chicken thigh fillets' },
  ])
  const items = shopping.flatMap((g) => g.items)
  assert.equal(items.length, 1)
  assert.equal(items[0], '600g chicken thigh fillets')
  assert.equal(cost.gbp, 3.9)
})

test('the three gingers add up instead of repeating', () => {
  const { shopping } = aggregate([
    { text: '15g fresh ginger (additional)', key: 'ginger', name: 'fresh ginger' },
    { text: '12g fresh ginger', key: 'ginger', name: 'ginger' },
    { text: '10g fresh ginger (additional)', key: 'ginger', name: 'ginger' },
  ])
  const items = shopping.flatMap((g) => g.items)
  assert.equal(items.length, 1)
  // The shortest name wins, so a bracketed note on one line cannot name the
  // merged row.
  assert.equal(items[0], '37g ginger')
})

test('things bought whole round UP to whole things', () => {
  // You cannot put 1.7 peppers in the trolley. 60g + 80g + 160g = 300g, which
  // is 1.875 peppers, so he buys two.
  const { shopping, cost } = aggregate([
    { text: '60g red pepper', key: 'pepper', name: 'red pepper' },
    { text: '80g red pepper', key: 'pepper', name: 'red pepper' },
    { text: '1 red pepper', key: 'pepper', name: 'red pepper' },
  ])
  assert.deepEqual(shopping.flatMap((g) => g.items), ['2 red pepper'])
  assert.equal(cost.gbp, 1.3)
})

test('a food with no price still reaches the list', () => {
  // He still has to buy it. It goes in Other, is named in `unpriced`, and is
  // not counted as free.
  const { shopping, cost } = aggregate([
    { text: '2 star anise', key: '', name: 'star anise' },
    { text: '1 star anise', key: '', name: 'star anise' },
    { text: '180g chicken thigh fillets', key: 'chicken-thigh-fillet', name: 'chicken thigh fillets' },
  ])
  const other = shopping.find((g) => g.aisle === 'Other')
  assert.deepEqual(other.items, ['3 star anise'])
  assert.equal(cost.priced, 1)
  assert.deepEqual(cost.unpriced, ['3 star anise'])
  assert.equal(cost.total, 2)
  assert.equal(cost.gbp, 1.17)
})

test('lines are grouped into aisles, in shopping order', () => {
  const { shopping } = aggregate([
    { text: '180g chicken thigh fillets', key: 'chicken-thigh-fillet', name: 'chicken thigh fillets' },
    { text: '2 red pepper', key: 'pepper', name: 'red pepper' },
    { text: '6 eggs', key: 'egg', name: 'eggs' },
  ])
  assert.deepEqual(shopping.map((g) => g.aisle), ['Fruit & veg', 'Meat & fish', 'Dairy & eggs'])
})

test('aggregating nothing does not throw', () => {
  const { shopping, cost } = aggregate([])
  assert.deepEqual(shopping, [])
  assert.equal(cost.gbp, 0)
  assert.equal(aggregate(null).shopping.length, 0)
})

test('the key list stays small enough to put in a prompt', () => {
  // The whole list goes into the tagging prompt on every shopping call, so its
  // size is a running cost that should not creep up unnoticed.
  const chars = PRICE_KEYS.join(' ').length
  assert.ok(chars < 4000, `${chars} characters of keys`)
})

// `lines` was added on 15 Oct 2026 so the UI can take a line to a specific
// supermarket PRODUCT rather than a search. It has to be additive: the Netlify
// function that returns `shopping` runs on five brands, and the model-written
// fallback list has no keys at all.
test('every finished line carries its key and the quantity its label was built from', () => {
  const { shopping, lines } = aggregate([
    { text: '180g chicken thigh fillets', key: 'chicken-thigh-fillet', name: 'chicken thigh fillets' },
    { text: '200g chicken thigh fillets', key: 'chicken-thigh-fillet', name: 'chicken thigh fillets' },
    { text: '60g red pepper', key: 'pepper', name: 'red pepper' },
    { text: '1 red pepper', key: 'pepper', name: 'red pepper' },
    { text: '2 star anise', key: '', name: 'star anise' },
  ])
  // One per finished line, and the labels are the same strings the UI renders —
  // which is what lets it look one up by the label it is drawing.
  assert.equal(lines.length, shopping.flatMap((g) => g.items).length)
  assert.deepEqual(
    [...lines].map((l) => l.label).sort(),
    shopping.flatMap((g) => g.items).sort(),
  )

  const thighs = lines.find((l) => l.key === 'chicken-thigh-fillet')
  assert.equal(thighs.label, '380g chicken thigh fillets')
  assert.equal(thighs.grams, 380)
  assert.equal(thighs.count, 0)

  // A per-item food carries the COUNT the label rounded up to, not the raw
  // weight, or the pack maths would ask for a pepper and a bit.
  const pepper = lines.find((l) => l.key === 'pepper')
  assert.equal(pepper.label, '2 red pepper')
  assert.equal(pepper.count, 2)
  assert.equal(pepper.grams, 0)

  // No price key, so nothing can be looked up for it. It still gets a line.
  const anise = lines.find((l) => l.key === '')
  assert.equal(anise.label, '2 star anise')
  assert.equal(anise.count, 2)
})

test('aggregating nothing returns no lines rather than undefined', () => {
  assert.deepEqual(aggregate([]).lines, [])
  assert.deepEqual(aggregate(null).lines, [])
})
