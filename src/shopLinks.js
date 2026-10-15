// Handing the shopping list over to a supermarket.
//
// WHAT THIS IS NOT: filling a basket. Neither Tesco nor Asda has a public
// ordering API — Tesco's developer programme was retired years ago with
// nothing to replace it, and Asda never ran one. Everything that claims to
// fill a UK basket does it by driving the retailer's own website with the
// shopper's logged-in session, which means holding a credential that can place
// orders on a card-linked account. That is not going in an app other people's
// clients use.
//
// Checked on 15 Oct 2026, and worth knowing before anyone tries: both sites
// answer a plain HTTP client with 403 and a real browser with 200. So they are
// edge-protected against non-browser callers, and a Netlify function cannot
// read them either. Server-side is a dead end, not just a ToS problem.
//
// So each line opens that one item in the supermarket's own search with the
// term already typed in, and the shopper picks the pack. No credentials, no
// API key, nothing to break when a retailer redesigns, and nothing promised
// that the app cannot do.
//
// NO IMPORTS, and no window: the term-stripping is the testable half and the
// tests run in node.

// URL shapes verified in a real browser on 15 Oct 2026 — both return a results
// page with no sign-in. Tesco has moved from /groceries/ to /shop/; the old
// path still redirects, and this is what it redirects TO.
//
// Only the two that were actually checked are here. A button that lands on a
// 404 in the middle of a shop is worse than no button, and adding a store is
// one line once its search URL has been opened and seen to work.
export const STORES = [
  {
    id: 'tesco',
    name: 'Tesco',
    url: (term) => `https://www.tesco.com/shop/en-GB/search?query=${encodeURIComponent(term)}`,
  },
  {
    id: 'asda',
    name: 'Asda',
    // Path-based rather than a query parameter. encodeURIComponent is still
    // right: it escapes the slash that would otherwise invent a URL segment.
    url: (term) => `https://www.asda.com/groceries/search/${encodeURIComponent(term)}`,
  },
]

export const storeById = (id) => STORES.find((s) => s.id === id) || null

/**
 * The words to search for, out of a shopping line.
 *
 * The line is written for a human with a trolley — "1.2kg chicken thigh
 * fillets", "12 eggs" — and the quantity is the part that ruins the search: a
 * supermarket asked for "600g chicken thigh fillets" matches on the pack size
 * as much as the food, and the useful results are not on the first screen.
 *
 * aggregate() in mealPrices.js builds every line as "<quantity> <name>" or
 * just "<name>", so stripping a leading quantity gets the name back without
 * the model being asked to repeat itself. Anything it does not recognise is
 * passed through whole — a slightly wide search beats an empty one.
 */
export function shopTerm(line) {
  let s = String(line || '').trim()

  // "2 x 400g tinned tomatoes". First, or the plain weight match below would
  // leave the "2 x" on the front of the search.
  s = s.replace(/^\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:kg|g|l|ml)\b\s*/i, '')
  // "600g", "1.2kg", "500ml". Also "600 g" with the space.
  s = s.replace(/^\d+(?:\.\d+)?\s*(?:kg|g|l|ml)\b\s*/i, '')
  // Spoons, which is how the sauces and pastes are written.
  s = s.replace(/^\d+(?:\.\d+)?\s*(?:tbsp|tablespoons?|tsp|teaspoons?)\b\s*(?:of\s+)?/i, '')
  // A bare count: "12 eggs", "2 red peppers".
  s = s.replace(/^\d+\s+(?=\D)/, '')
  // Notes the model sometimes leaves on a name. "(additional)" is not a food.
  s = s.replace(/\([^)]*\)/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  // Stripped down to nothing, or to a number on its own: use the original line
  // rather than searching for empty.
  if (!s || !/[a-z]/i.test(s)) return String(line || '').trim().slice(0, 60)
  return s.slice(0, 60)
}

/** The search URL for one shopping line at one store, or null if either is unknown. */
export function searchUrl(storeId, line) {
  const store = storeById(storeId)
  if (!store) return null
  const term = shopTerm(line)
  if (!term) return null
  return store.url(term)
}
