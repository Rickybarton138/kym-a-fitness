# 2026-09-15 - "I logged food a few times today and it all vanished" (Rick.Fit)

## Finding: nothing was deleted. Today's logs never reached the server.

Ricky's client_id = `d5790573-e082-418c-8029-90a125b14074` (coach = Rick.Fit
`3525e7da`). Read-only investigation, Supabase `ezwmfbuuopsnpanebtal`.

- `nutrition_logs` for him: **36 rows total, newest 2026-09-14 14:56 UTC.** Zero
  rows for 15 Sep. The 36 reconcile exactly to the per-day counts 8-14 Sep + the
  two July days, so no row is hiding under a wrong `logged_at`.
- **No DELETE was issued.** edge_logs for 15 Sep contain no DELETE to
  `/rest/v1/nutrition_logs` at all, and the 19 POSTs that day reconcile exactly
  to the 21 rows that exist (one was a `?columns=` bulk of 3): Harry Smith x2
  (`source=meal`, timestamps match the POSTs to the millisecond) and 19 rows for
  Paul's clients Rosalind / Bex / Augustine (`source=manual`, `logged_at` pinned
  to 11:00:00Z by the diary's add-to-day path). Not one POST is unaccounted for,
  so nothing was inserted-and-then-removed.
  (`postgres_logs` has no statement logging, so a manual SQL delete would be
  invisible there - the POST/row reconciliation is what rules it out.)
- His session WAS alive all day: Home loads at 10:47 and 16:41, training/agenda
  and brain_chats/messages reads 17:48-19:33. All 200s. **But zero FoodDiary
  queries** (`FoodDiary.jsx:140/164` date-range GETs) - on 14 Sep those fired
  repeatedly at 19:05-19:08. So today he never got into the diary, and no insert
  ever left his device.
- Live bundle checked: right project (`ezwmfbuuopsnpanebtal`), Rick.Fit branding,
  food code present. Not a wrong-database or wrong-brand story.

## Why a failed save looks identical to a successful one

- `src/ClientApp.jsx:195` - `const { data } = await supabase...insert(row)`.
  The `error` is destructured away. A failed insert silently no-ops.
- `src/FoodSearch.jsx:202` - `onLog(...)` is called WITHOUT await, then
  `setLogged(m.name)` shows the "logged" confirmation for 2.2s regardless.

So the app confirms the food is logged before it knows whether the row saved.
Offline, flaky signal, or any client-side throw produces exactly the reported
symptom: it looked logged, then it was gone on reload. There is no offline queue
(`localStorage` is used only for the workout draft in `WorkoutRows.jsx:63`), so
nothing is recoverable from the device either.

## Fix - DONE, live on Rick.Fit only (deploy 6aa9a3d5)

1. `src/foodQueue.js` (new): rows that do not reach Supabase are parked in
   localStorage under `cbk_food_queue` and retried on the next app load and on
   the `online` event. Entries carry their own `client_id`, so a queue written
   by one account can never flush into another's diary. Flush stops at the first
   failure rather than hammering a dead connection.
2. `ClientApp.logFood` now reads `{ data, error }`, queues on failure and
   **returns true/false**. `syncFood()` flushes and folds anything from today
   back into the Home totals without a refetch.
3. `PendingFoodBanner` in ClientApp, shown on EVERY screen (not just the food
   ones - the failure being fixed is food that looked saved): "N items are still
   on this phone", with Try now / Discard them. It appears without a reload via a
   `cbk-food-queued` window event, so a row parked by the diary reaches the
   banner owned by ClientApp.
4. `FoodDiary.addFood` had the same swallowed error - same treatment, same
   true/false contract.
5. Confirmations now wait for the answer: `FoodSearch` (search, fixed-portion and
   manual paths) and `FoodCapture` (barcode + meal photo) only say "Added" once
   the row is on the server, and say "saved on this phone" otherwise. A caller
   that returns nothing is treated as success, so older call sites cannot cry
   wolf.

Tests: `node --test tests/food-queue.test.mjs` - 7 passing, covering keep-on-
failure, per-client isolation, ordering across a failed flush, no re-send of what
already went in, discard, and a corrupt queue. (`node --test tests/` fails on
this Node/Windows - point it at the file.)

NOT deployed to Kim, Paul, PPH, Elev8, Lennon or Kelsey. Shared codebase, so
they get it on their next `npm run build:<brand>` + deploy.

## Reinstating today - DONE

No server-side copy existed, so the six items were re-entered from what he said
he ate, as `source=manual` rows on 15 Sept with meal-appropriate times:

| Item | Meal | kcal | P | C | F | Fibre |
|---|---|---|---|---|---|---|
| 3-egg omelette, 1 slice toast, butter & ketchup | Breakfast | 335 | 22 | 21 | 18 | 2 |
| Fridge Raiders chicken bites (small pack) | Snacks | 120 | 17 | 2 | 5 | 0 |
| Teriyaki beef noodles with broccoli & carrots | Lunch | 550 | 35 | 65 | 15 | 6 |
| UFIT protein shake | Snacks | 150 | 22 | 6 | 4 | 0 |
| Jaffa Cakes (6) | Snacks | 246 | 2 | 50 | 4 | 1 |
| Milbona high protein coffee | Snacks | 100 | 15 | 7 | 2 | 0 |

Day total 1,501 kcal / 113g P / 151g C / 48g F / 9g fibre against targets
2,100 / 180 / 187 / 70. Macros are estimates from UK product values - the
noodles are the softest number (portion unknown, +/- 150 kcal); everything else
is within about 20 kcal. Edit any of them in the diary.
