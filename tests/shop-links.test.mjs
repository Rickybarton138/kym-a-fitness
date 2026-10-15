// Taking the shopping list to the shop.
//
// The whole feature is one search URL per line, so the only two ways it can be
// wrong are the words it searches for and the URL it builds. Both are here, and
// both are testable without a network call.
//
// What is NOT testable here, and has to be checked in a real browser: that the
// URL shapes still resolve. Both were opened on 15 Oct 2026 and returned a
// results page. A plain HTTP client gets 403 from both sites, so curl and a
// Netlify function cannot confirm it — only a browser can.
import test from 'node:test'
import assert from 'node:assert/strict'
import { STORES, storeById, shopTerm, searchUrl } from '../src/shopLinks.js'

test('the quantity comes off, because it is what ruins the search', () => {
  // These are exactly the shapes aggregate() in mealPrices.js produces.
  assert.equal(shopTerm('1.2kg chicken thigh fillets'), 'chicken thigh fillets')
  assert.equal(shopTerm('600g spinach'), 'spinach')
  assert.equal(shopTerm('500ml semi-skimmed milk'), 'semi-skimmed milk')
  assert.equal(shopTerm('12 eggs'), 'eggs')
  assert.equal(shopTerm('2 red peppers'), 'red peppers')
})

test('a multipack does not leave "2 x" on the front', () => {
  assert.equal(shopTerm('2 x 400g tinned chopped tomatoes'), 'tinned chopped tomatoes')
  assert.equal(shopTerm('3 × 200g tuna tins'), 'tuna tins')
})

test('spoons, which is how every sauce and paste is written', () => {
  assert.equal(shopTerm('2 tbsp soy sauce'), 'soy sauce')
  assert.equal(shopTerm('1 tsp of smoked paprika'), 'smoked paprika')
})

test('a line with no quantity is left alone', () => {
  assert.equal(shopTerm('fresh coriander'), 'fresh coriander')
  assert.equal(shopTerm('mixed herbs'), 'mixed herbs')
})

test('the notes the model leaves on a name are not food', () => {
  assert.equal(shopTerm('60g red bell pepper (additional)'), 'red bell pepper')
  assert.equal(shopTerm('chicken breast (diced)'), 'chicken breast')
})

test('stripping down to nothing falls back to the line, never to an empty search', () => {
  // A quantity on its own should not send anyone to a blank results page.
  assert.equal(shopTerm('500g'), '500g')
  assert.equal(shopTerm('12'), '12')
  assert.equal(shopTerm(''), '')
  assert.equal(shopTerm(null), '')
})

test('a long line is cut, so the URL stays a URL', () => {
  const term = shopTerm('400g of the very finest free range organic corn fed British chicken thigh fillets')
  assert.ok(term.length <= 60, term)
})

test('the two verified stores, exactly as they were opened in a browser', () => {
  assert.equal(
    searchUrl('tesco', '600g chicken breast'),
    'https://www.tesco.com/shop/en-GB/search?query=chicken%20breast',
  )
  assert.equal(
    searchUrl('asda', '600g chicken breast'),
    'https://www.asda.com/groceries/search/chicken%20breast',
  )
})

test('an unknown store is null, not a guessed URL', () => {
  // The list is deliberately short. A store nobody has opened in a browser must
  // not get a button built from a guessed URL shape.
  assert.equal(searchUrl('sainsburys', '600g chicken breast'), null)
  assert.equal(searchUrl('', 'eggs'), null)
  assert.equal(storeById('morrisons'), null)
})

test('every store encodes its term', () => {
  // A raw & would end the query string and search for half the line; a raw
  // slash in Asda's path would invent a URL segment. This bites whoever adds
  // the third store with a hand-written template.
  for (const store of STORES) {
    const url = store.url('salt & pepper / mix')
    assert.ok(url.startsWith('https://'), `${store.id}: ${url}`)
    assert.ok(!/[&?]/.test(url.replace(/^[^?]*\?query=/, '')), `${store.id} leaked a separator: ${url}`)
    assert.ok(!url.includes(' '), `${store.id} left a space in: ${url}`)
    assert.ok(url.includes('%20'), `${store.id} did not encode: ${url}`)
    assert.ok(store.id && store.name, 'a store needs an id and a name')
  }
})
