// What the shopping list costs.
//
// These cover the half of the job that is NOT the model's. The model only ever
// supplies a key naming the food; the quantity comes out of the line's own text
// and the arithmetic is JavaScript. So every way the total can go wrong is in
// here, and testable without a network call.
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseQty, penceFor, costOf, PRICES, PRICE_KEYS } from '../src/mealPrices.js'

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

test('the key list stays small enough to put in a prompt', () => {
  // The whole list goes into the tagging prompt on every shopping call, so its
  // size is a running cost that should not creep up unnoticed.
  const chars = PRICE_KEYS.join(' ').length
  assert.ok(chars < 4000, `${chars} characters of keys`)
})
