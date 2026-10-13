# Meal planner: recipe cards + shopping cost (13 Oct 2026)

Ricky's two ideas for the nutrition section:

1. Show the average supermarket cost for the shopping list.
2. Give cooking instructions with every meal, each meal a card you tap to open
   the recipe with quantities and how to cook it.

Both shipped to Rick.Fit only, behind `features.mealRecipes`. Live on
rick-fit.netlify.app (deploy `6ace757a055e118d86e94d4f`).

---

## The decision that shaped both: ingredients come with the meal

The obvious build for idea 2 is to generate the recipe when the card is tapped.
That is wrong, and the reason is idea 1.

The shopping list used to be inferred from each meal's one-line description
("chicken thigh with rice and greens"). If the recipe were generated separately,
later, it would make its own second guess at the quantities — and a card could
say 900g of chicken against a list that bought 600g, with no way to tell which
one was wrong.

So the **ingredient lines are asked for with the day**, in the same call that
writes the meal. The shopping list is then summed from those lines rather than
re-imagined, and only the *method* is fetched on tap. The recipe and the list
cannot disagree, because they come from the same source.

Measured on the deploy: 17 of 17 ingredient lines traceable into the finished
shopping list, 15 of 15 lines priced. The day call went from a 2000 to a 3000
token budget and takes 5.5s — well inside the edge timeout that forced the
week to be built a day at a time in the first place.

## Cost: the model never writes a price

`src/mealPrices.js` — 180 items, £/kg or £/unit, dated, no imports (a Netlify
function reads it, same rule as `calisthenics.js`).

A model asked for a shop total writes a confident "£46.20" that changes on the
next call, has no source, no date, and cannot be corrected. So the split is the
one `recipe-ai.mjs` already settled on for macros:

- **The model recalls** — which food is this line? It returns a key, nothing else.
- **The text states the quantity** — parsed in JS. The line already says "600g",
  and a model asked to repeat a number back gets it wrong occasionally in a way
  nothing downstream could catch. The model's figure is a fallback only for a
  line with no quantity at all ("fresh coriander").
- **The arithmetic is JS.** A wrong price is one number to edit.

Honest about what it is: `PRICE_NOTE` says indicative, own-label, dated, and
priced pro-rata — 600g of chicken counts as 600g, not the 1kg pack that actually
goes in the trolley. These are hand-written estimates, not a licenced feed;
there isn't one in this project.

Two rules it inherits from the rest of the app:

- **Unpriced is not zero.** A line that cannot be matched is named in the UI
  ("15 of 17 lines priced") and left out of the total, never counted as free.
- **Absent beats wrong.** The tagging call must return exactly one entry per
  line. A short or long array means the mapping has shifted and every price
  after the shift is for the wrong food, which is undetectable downstream — so
  the whole total is withheld and the UI offers a retry.

The cost is computed inside the `shoppingFor` response, not as its own request,
so a figure can never be on screen next to a list it was not worked out from.

## The bug found on the way

`allergies`, `dietary`, `meals`, `snacks` and `preferences` were plain component
state while the week itself was persisted to `localStorage`. After a reload the
week came back with the form blank behind it — so the next swap went off with no
allergies and no dietary requirements attached. A vegetarian week could come
back with chicken in it, and an allergy could be reintroduced by the app that
had just been told about it.

The build inputs are now saved **with** the week and restored on mount. Verified
in a browser: after restoring a seeded week, the method call body carried
`allergies: "nuts"` and `dietary: "Pescatarian"`.

A week saved before this change has neither ingredients nor inputs, so it says
so on screen rather than letting a swap go off half-informed.

## Auth

The new `method` action requires a verified session: `requireUser` before
anything else, so an anonymous caller cannot map the body rules by reading 400s.
`HttpError` now surfaces as a real status instead of a 200 carrying a sentence,
so the client can tell "your session went stale" from "the model could not do
it".

**Still open:** the older actions in `meal-plan.mjs` (`skeleton`, `weekDay`,
`shoppingFor`, `swapMeal`, the plain day) remain unauthenticated with open `*`
CORS. That predates this change, and closing it needs the two scripts that call
the endpoint (`e2e_round31.mjs`, `scripts/ricky-week-plan.mjs`) to obtain a
token. Belongs in the hardening pass.

## Verification

- `tests/meal-prices.test.mjs` — 16 tests, node:test. Quantity parsing
  (multipacks beating the plain weight match, spoons, a daft count refused),
  unpriced-is-null, text-beats-model, and the table's own shape.
- `tasks/e2e_meal_recipes.mjs` — 25 assertions against a real deploy. Auth
  refusals, ingredients present and quantified, the shopping list covering the
  ingredients it was built from, one cost entry per line, a swap arriving with
  its own ingredients.
- Browser, 375px, real component in a throwaway harness with a seeded week (no
  account, nothing logged): cards open, ingredients render, method fetched once
  and cached, recipe persisted to `localStorage` so it is readable in the
  kitchen with no signal, reopening does not refetch, inputs restored.
- Draft deploy verified first, then promoted by id — production got exactly the
  bytes that were tested.

Local `netlify dev` could not run the AI paths: `.env` holds a placeholder key,
and pulling the real one out of Netlify was refused as credential
materialisation. Correctly — a draft deploy keeps the key server-side and is the
better test anyway.

## Also done

`Front Plank` and `Front Plank on Forearms` now reach the `Forearm Plank` demo —
the core ladder's and the wrist-adapted ladder's names for the hold that clip
already shows. Two ladders that showed nothing now show something.

`tasks/rick-fit-video-gaps.md` + `tasks/list-video-gaps.mjs` — 22 of 139
catalogue entries have a demo, tiered by whether they are worth filming, with
the production spec and a prompt for GPT/Grok.

## Not done

- The loop-boundary inspection of the existing 40 clips. Still outstanding.
- Whether the GLP-1 flag should be on for Rick.Fit. Still unanswered.
- `coach_notifications` has not been checked since the queue went live.
