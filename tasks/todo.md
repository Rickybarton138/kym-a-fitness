# Kym A Fitness — Tasks

## Kim's feature wishlist (2026-08-05) — green-lit "whole lot, wave order"
### DONE + LIVE (coached-by-kim.netlify.app)
Wave 1:
- [x] Video library enabled for Kim (coach adds titled YouTube/Vimeo links -> client folders). Flag `videos`.
- [x] Coach analytics: avg calories/day (week total /7, Kim's method) + lowest weight (7d) on each client's adherence card.
Wave 2:
- [x] Coach meal-plan templates — author (one-tap 5-day starter skeleton), Assign copies to client, adapt per-client, client "My meal plan" tile. Tables meal_plans + client_meal_plans (RLS verified e2e_mealplans.mjs). Flag `coachMealPlans`. New file src/MealPlans.jsx.
- [x] Front/side/back progress photos — body_scans.pose col; same-angle AI compare; pose filter in ProgressPhotos (client+coach). Enabled `progressHub` for Kim.
- [x] Week planner + payment reminders — WeekPlanner grid on ClientDetail (sessions + reminder chips per day, week nav); new 'payment' client_task kind (kind CHECK extended); enabled `agenda` for Kim (clients now get the daily plan card; coach gets WeeklySchedule + ClientReminders).

### TODO — Wave 3 (PICK UP HERE next session)
- [ ] #26 Event countdowns + holiday mode — new table client_events (kind countdown|holiday, label, start_date, end_date). Countdown "N weeks to go" on client + coach; holiday range auto-pauses check-in/measurement reminders while away (skip taskDueToday if date within an active holiday). 
- [ ] #27 Birthday + client-anniversary greetings — add dob + client_since to profiles (or use created_at for anniversary); happy-birthday + 6mo/1yr/2yr prompts to coach + client agenda.
- [ ] #28 Menstrual cycle tracking — new table cycle_logs (client_id, period_start); predict next period + flag luteal phase; client input + display; optional coach visibility. Fits Kim's women-35+ base.

### Paul (app.redefineacademy.com) — all shipped 2026-08-05
- [x] Tag capitalisation bug — audience_tag lowercased on all 3 programme-save sites.
- [x] AI programme builder fills ALL weeks — clones base week across N weeks: progressive overload + deload every 4th, default days (Mon/Wed/Fri...), each session week+dow, editable. (progressExercises/daySpread in TrainerApp; logic unit-tested.)
- [x] Shift-worker per-week days — already works via multi-week week+dow; explained, no build.

### Resume notes
- DB reachable via claude.ai Supabase MCP (project ezwmfbuuopsnpanebtal) — run migrations directly; verify/clean test rows via execute_sql. See lessons.md.
- NOT feasible: Apple Health auto step-import (HealthKit is native-iOS-only, walled off from PWAs). Manual steps already exist. Ricky told.
- Deploy: `npm run build` (BRAND=kim default; `BRAND=paul npm run build` for Paul) -> `netlify deploy --dir=dist --site <id>` -> `netlify api restoreSiteDeploy` to promote. Kim site 08a2f0ba-f0a8-4ee9-80f5-cd314abacce3; Paul (redefine-academy) bda91296-2224-4923-b91c-d6482971eab1.
- No emojis anywhere (UI/chat) — Ricky's font renders them as tofu.

## Paul batch 3 (2026-08-03)
Shipped (all 4 sites unless noted):
- [x] Scanner iOS "low memory" crash fixed — all image scanners downscale on-device
      (scaleImageToBase64) before send; also HEIC→JPEG. Universal.
- [x] Macro rule guard (coach): fat%/protein-g/kg readout + "Apply the rule" (protein
      2g/kg, fat 25%, carbs fill) on the client's macro targets card. (Calculator already
      enforced it for new clients.)
- [x] AI meal-plan builder (Paul only, `mealPlans` flag): Nutrition tab → qualifying
      questions (meals/day, options/meal, snacks, dietary, allergies, prefs) → AI day that
      hits their targets; log any option. Fn `meal-plan.mjs` (Haiku).

Queued:
- [ ] Multi-week programmes (Paul, 1-2-1): build a programme over N weeks (e.g. 4-wk cycle),
      assign with a START DATE + optional REPEAT so it cycles without rebuilding. Needs:
      `week` on program_sessions (or weeks structure) + a client-program assignment
      (program_id, client_id, start_date, repeat) + agenda logic to compute "today's
      session" from start_date/week/dow. Design decision: how it coexists with the per-dow
      client_schedule + scheduled_for. BIG — its own build.


## Paul batch (2026-08-02)
Shipped to all 4 live sites:
- [x] #1 Step target — ANSWERED: Standard clients auto-default to 10k (`profile.step_target || 10000`); coach can override per client. No build.
- [x] #3 Recipes: AI tags generated recipes (high-protein, lunch, quick…); client Recipe library has search + tag-chip filter.
- [x] #4 Programme details/tags editable after save (ProgramMetaEditor in open programme view).
- [x] #7 Food logging: "Add food" + day picker (back-fill past / pre-log future); home "today" total only counts today.

Shipped 2026-08-02 (all 4 sites):
- [x] #2 AI exercise swap: "Can't do this? Swap it" per plan exercise (SessionCard) -> reason -> fn `exercise-swap` (Haiku) -> replaces exercise keeping sets, persists to plan.
- [x] #5 Coach adherence card (top of ClientDetail): sessions done 7d/30d, days food logged /7, last check-in, last measurement. is_my_client RLS.
- [x] #6 Client "Add to my plan" + day picker on library sessions (workout_plans.scheduled_for); home agenda "Today" slot shows a session scheduled for that day.


## Phase 1 — Foundation & accounts (DONE, verified)
- [x] Supabase project `kym-a-fitness` (ezwmfbuuopsnpanebtal)
- [x] Schema + RLS + auto-profile trigger (profiles/roles, macro_targets, nutrition_logs, workout_plans, body_measurements)
- [x] Auth UI (sign in / sign up, coach-or-client role, coach code)
- [x] Session router → role-based (ClientApp vs TrainerApp)
- [x] Client app wired to DB: targets, today's logs, fridge/meal logging, saved workouts, body measurements + trend
- [x] Coach dashboard: client code, client list, client detail (set targets, view intake/body/logs/sessions)
- [x] Build passes; auth + trainer dashboard verified live via browser

## Done 2026-07-12
- [x] Disabled email confirmation via `supabase config push` (verified real signup)
- [x] "Coached by Kim" branding — cream/sage/serif + CBK logo
- [x] Deployed: https://coached-by-kim.netlify.app (env vars set)
- [x] AI voice tuned for women 35+ (strength over restriction / learn food don't fear it) — verified live
- [x] End-to-end verified: coach account + client signup (code 94BA86) + coach dashboard shows client

## Added 2026-07-12 (after Ricky feedback)
- [x] Train screen: "Build your own" workout (manual exercises/sets/reps/notes) alongside AI generate, + "Your sessions" history (expandable). Verified + deployed.
- [x] Coach can ASSIGN workouts to a client from the dashboard (client detail → "Assign a workout" builder). `workout_plans.assigned_by` column; client sees it tagged "From your coach". Verified end-to-end (Kim→Sam) + deployed.
- [x] Exercise dropdown (Power House machines, grouped, + "Other" fallback) in both builders — shared `WorkoutRows.jsx` + `exercises.js`. Deployed.
- Note: client-name RLS fix earlier means clients now correctly see "Coached by <name>". Real test data exists incl. a client "Richard Anderson" (likely Ricky testing live) — confirm before deleting.

## Kim Brain — CORE DONE + verified live 2026-07-12
- [x] `coach_knowledge` + `brain_chats` tables + RLS (coach manages own knowledge; client reads their coach's; client owns own chats; coach reads).
- [x] Function modes: `parse` (script/transcript → structured knowledge entries) + `ask` (free-text answer in Kim's voice using her knowledge, lean retrieval = KB in prompt). Both verified live.
- [x] Coach dashboard "Kim's Brain": add knowledge, OR "Paste & parse" (AI structures pasted text → tick entries → save), list + delete.
- [x] Client "Ask" tab (6th tab) + Home tile: chat UI, answers logged. Verified live (protein Q → on-brand answer).
- [x] Messaging + comms-logging: `messages` table + RLS (client↔coach). Client "Kim" tab = toggle "Ask AI" / "Message Kim"; coach sees + replies in each client's detail. Recent messages fed into the `ask` brain context (`comms` param). Verified two-way live + deployed.
- [x] Weights: added `weight` field to the shared exercise editor (`WorkoutRows.jsx`) — clients log weights building their own plans AND Kim sets weights when assigning. Shows as "@ 40kg" in session detail. Verified + deployed.
- [x] PWA install: manifest.webmanifest + 192/512 PNG icons (from CBK logo, via OpenCV resize) + maskable, apple-touch-icon + apple meta (iOS standalone), service worker (`public/sw.js`, network-first nav / cache-first assets), SW registered (prod only), manifest MIME + sw no-cache headers in netlify.toml. Verified assets serve + 0 console errors. Add-to-Home-Screen works.
- [ ] Later: pgvector RAG when KB large; mark-session-done; Kim edit/remove knowledge & assigned workouts.

- [x] Video FORM-CHECK: `form-videos` Storage bucket + `form_checks` table + RLS. Client uploads a clip → stored → 3 frames extracted client-side (`extractFrames` in lib.js) → Claude vision `form` mode gives instant pointers in Kim's voice → Kim reviews the video + adds her feedback. Client "Form check" via Home tile (screen 'form'); coach review card in client detail. Function mode verified live; deployed. **NOTE: real video-upload UI not auto-tested — Ricky to test on a phone.**

- [x] "From Kim" CONTENT area: coach "Featured content" — Kim UPLOADS an image (Storage bucket `content-images`, public) OR pastes an IG post/reel link → shows to ALL her clients in the client "From Kim" screen (Home tile). `featured_content` table (ig_url nullable + image_path). IG embeds via embed.js. Verified live end-to-end (Kim upload → client sees it). This also = "daily content pushed to all members". IG scraping is BLOCKED (confirmed) — Kim uploads instead.

- [x] COMMUNITY feed: `community_posts` + `community_cheers` tables + RLS (per-coach community = coach + all their clients share one feed). Post text + optional photo (content-images bucket), 👏 Cheer (like). Client Home tile 'community'; coach card on dashboard (can post + moderate). Shared `CommunityFeed.jsx`. Verified live (post + cheer). Author/coach can delete.

## REAL accounts (2026-07-13): Kim Roffe (kimroffe@hotmail.com, trainer) = the REAL Kim. Her clients: Richard Anderson (r-anderson9@sky.com, Kim's husband, testing) + Ricky Barton (rickybarton138@btinternet.com). DO NOT DELETE these. Only `Kym Test`/`Sam Client` are dummies to clear.

- [x] DECORATE with Kim's images — ROTATING HERO CAROUSEL: coach uploads multiple "App hero photos" (`hero_images` table, content-images bucket) → auto-rotating carousel with dots at top of client Home. Ricky grabs from her IG, Kim/he uploads (dashboard "App hero photos → Add photo"). Verified live with 3 of Kim's real photos. (`profiles.hero_image_path` deprecated → migrated into hero_images.) Home only; can extend to more screens.

## Backlog — Ricky's open ideas (awaiting priority)
- **BBL QR gym-access — GYM white-label product (`~/thryve-prototype`), NOT Kim's app.** Member QR pass + check-in + staff scanner (Ricky's chosen scope). Physical door access = later hardware integration.
- Polish: clear test accounts (incl. "Richard Anderson" = likely Ricky), mark-session-done, edit knowledge/plans.

## Needs Ricky / next
- [ ] Kim creates her real coach account → shares her code with clients
- [ ] Delete test accounts (kymtest@ / sam@) before real onboarding
- [ ] (optional) set Supabase Auth site_url to the Netlify URL

## Next phases
- [ ] Phase 2 polish: progress photos (Supabase Storage) on body scan; workout history view for clients
- [ ] Phase 4: PWA manifest + install prompt + app icons; onboarding for Kym + first clients
- [ ] Nice-to-have: client messaging to coach; weekly check-in summary for Kym

## Pending: template-visibility fix on the sibling brands (2026-09-01)
`c4b0885` is live on ReDefine only. Kim, PPH and Elev8 run the same `TrainerApp`
and still have the old builder, so the next custom session a coach there builds
inside a programme gets auto-published to that coach's whole client list.

No existing leak on those sites: the backfill was scoped to Paul's coach_id, and
Elev8's four demo templates are still shared exactly as before. The schema and
policy change are global and already applied.

To finish: `npm run build:<brand>` then deploy + `restoreSiteDeploy` for
- coached-by-kim `08a2f0ba-f0a8-4ee9-80f5-cd314abacce3` (real clients)
- the-physical-performance-hub `5e998585-cfd2-4e16-a272-b5ceac659c95`
- elev8-hyrox `a7852fc7-7d64-429c-a9d5-041084399b9d`

Unrelated, found while deploying: the PPH site serves "Coached by Kim" as its
title, og: tags and install name, on production and on a fresh draft built with
`build:pph` — even though that build stamps dist/index.html correctly. So it is
the site, not the build script. Not diagnosed; not touched.

## Nutrition plan variety (2026-09-08)
Ricky, using the app as a client on his own brand: "my nutrition plan is very
limited and pretty boring and repetitive, how can we improve this feature?"
Not from Paul — this one came from using it, which is why it goes to every brand
rather than sitting behind Paul's flags.

SHIPPED TO RICK.FIT ONLY (2026-09-08, deploy 6aa06ff3). Deliberately NOT to
Paul, Kim, PPH or Elev8: Paul did not ask for this and has not seen it. It runs
on Ricky's own site first, on his own eating, before it goes near a paying
coach's clients. The code is unflagged, so promoting any other brand ships it —
that is a decision, not a formality.

Built (draft-tested, round 31 + round 31 UI + round 31 swap green, 29-suite
regression green on draft 6aa06e27):
- [x] Week plans with a shopping list. `meal-plan.mjs` gained three modes:
      `skeleton` (picks the week's proteins/cuisines/carbs), `weekDay` (one day),
      `shoppingFor` (aggregated aisle list). The client builds a week ONE DAY PER
      REQUEST — a whole week in one call is ~60s and dies at the edge with a 504.
      Days appear as they land and each is saved as it lands, so a failure at day
      5 keeps days 1-4 and offers "carry on from Friday".
- [x] Swap a single meal ("Swap this") with an avoid list, in both day and week mode.
- [x] Shopping list ticks off and survives leaving the screen (`mp_week_v1`).
- [x] Per-meal calorie/protein budgets computed in code — the model was landing a
      day 30% under target about one time in four.
- [x] `exercise-swap`: now has a test (`e2e_round31_swap.mjs`) — it had none.
      Raised the photo path's token cap from 200 and made it read the first TEXT
      block. NOTE: it was NOT broken — production passes the new test. I said it
      was, on the strength of the meal-plan bug, and checking proved me wrong.
      The change is insurance against the same failure at a bigger input, not a
      fix for a live fault.

Done 2026-09-09 (deploy 6aa18e05, rick-fit.netlify.app):
- [x] The `content[0].text` sweep. New shared helper `netlify/functions/_claude-text.mjs`
      (`firstText` / `stopReason`), applied to barcode, exercise-guide, program-edit,
      program-generate, recipe-ai, recipe-generate. It uses `||` not `??` on purpose:
      the code it replaced fell back on an empty string too, and `??` would have sent
      `''` to `JSON.parse` where it used to parse `'{}'` cleanly. Unit test
      `tasks/test_claude_text.mjs` - 11 cases, most asserting the OLD behaviour, green.
      NOTE: these functions are shared by all five brands but only Rick.Fit was
      deployed. Kim, Paul, PPH and Elev8 still run the old code. That is deliberate -
      deploying them would also ship the unflagged week meal plan (see above). Their
      deploy is a separate decision.
- [x] The three dark suites. `e2e_mealplans`, `e2e_wave3`, `e2e_personal` used
      `@kymafit.test` fixtures, which Supabase rejects as an invalid email format.
      Moved to `@e2e.kymafit.app` - one dedicated domain, so a single grep finds every
      fixture account ever made and no real address can collide. All three PASS.
      Fixture accounts from the verification run were deleted afterwards (5 auth
      users, 1 template, 2 programmes); 0 left.
- [x] Ricky's week plan is in the app. `client_meal_plans` now holds the 7-day,
      28-meal rotation as "Lean & Strong - 7-day rotation"; the old hand-written
      3-day plan is kept but inactive. `scripts/ricky-week-plan.mjs` now also emits
      `.private/ricky/ricky-week-plan.json` in the app's plan shape
      ([{label, meals:[{name, detail, kcal}]}]) so publishing never has to parse the
      markdown back out. `macro_targets` corrected 2400/195 -> 2100/180/187/70 to
      match the plan - they disagreed, so the remaining-calories readout was wrong
      every day.
- [x] Home-screen heroes: EIGHT, Rick.Fit only (corrected, deploy 6aa192db). First
      pass replaced the four stock shots with his goal renders; he wanted the stock
      shots KEPT with his face on the men in them, plus the goal renders added.
      `scripts/ricky-face-swap.mjs` (new, sibling to ricky-transform.mjs - that one
      keeps him and changes the body, this one keeps the body and changes the head)
      sends the scene plus a face crop from july-16.jpg to gpt-image-2.
      IMPORTANT: only stock-1 and stock-4 contain a visible face. stock-2 is a close
      crop of an arm and stock-3 is an empty gym - asked to swap a face in those the
      model invented an entirely new man and scene, so those two ship UNCHANGED.
      Final set interleaves 2 swapped + 2 untouched originals + 4 goal renders.
      Originals recovered from git into `.private/ricky/stock/`.
- [x] De-aged, deploy 6aa19770. First pass came back looking mid-fifties; Ricky is
      45 and asked for 40. Cause: the face reference is ~150x220 real pixels off a
      mirror selfie, so the model invents the facial detail and what it invents is
      wrinkles. "Match the reference" cannot fix that - the reference is too soft to
      argue with, so the target age has to be stated outright in the prompt.
      Face swaps: age block added to `ricky-face-swap.mjs` and re-run.
      Goal renders: new `scripts/ricky-deage.mjs` edits the FACE ONLY in place.
      Deliberately not regenerated from the four bespoke scripts - that would have
      returned four different physiques and he liked these. Pre-de-age versions kept
      as `*-aged.png`.
- [x] Transformation plan with dates: `.private/ricky/ricky-transformation-plan.md`.
      RESOLVED 2026-09-10 - measured 104 cm waist / 40 cm neck. The 32" was indeed a
      jeans size, and the real tape is 41", so he is at ~27.6% body fat (24.0 kg fat,
      63.0 kg lean) - higher than EITHER branch I had sketched. Target ~74 kg at 12%
      allowing 2 kg of regained muscle, so ~13 kg to go, landing early April 2027 on
      the current 2100 kcal. Mifflin-St Jeor predicts 0.43 kg/wk on that intake and he
      is observing 0.46, so the dates are calibrated against his own data rather than
      a formula. 2100 kcal CONFIRMED correct (the earlier assumption held). Advice is
      to hold 2100 until Christmas then consider 1950 - at 27.6% a bigger deficit is
      low-risk for muscle, but January is better timed than December.
      Baseline logged to `body_measurements` (waist 104, body_fat 27.6, weight left
      null - he gave a tape reading, not a new weigh-in; do not invent one).

- [x] Real face reference, deploy 6aa26068. Ricky sent a proper front-on photo
      (`.private/ricky/in/hero/face-source.jpg`); `face-ref.jpg` is now a 670x1080 crop
      of it instead of a 150x220 upscale off a mirror selfie - about 20x the actual
      facial detail. `ricky-face-swap.mjs` rewritten to drive BOTH families off it:
      the 2 stock shots with a face, and the 4 goal renders (whose invented face was
      wrong in identity, not just age - gaunter, more angular, wrong hair colour).
      Goal renders re-swapped from their FIRST-generation `-aged.png` sources so each
      output is one edit on an original, not two stacked. `ricky-deage.mjs` deleted -
      superseded, a real reference beats arguing age into a prompt.
- [x] Yoga: three 10-minute lounge-floor sessions in `workout_plans` (blocks + ball).
      Hips & Hamstrings, Chest/Shoulders/Upper Back, Full Body Unwind. ALL WRIST-SAFE
      by design - forearms, fists or hands on blocks, never flat palms under load,
      because every pressing cue in his own programme says neutral grip and "if the
      wrist grumbles". Weekly placement added to the transformation plan.

- [x] ISOLATION 2026-09-10 (deploy 6aa2663b), on Ricky's instruction: keep everything
      from this session Rick.Fit-only. Two things could otherwise have reached Paul,
      the only other brand with `mealPlans`:
      1. The six shared functions from c9e414d are REVERTED. Paul's runtime is now
         byte-identical to before 10 Sept. `_claude-text.mjs` and its test removed
         with them. The fix is not lost - it is in git at c9e414d and can be
         cherry-picked when Paul is next deliberately deployed. Rick.Fit gave it up
         too; that was the accepted cost of one shared codebase.
      2. Week meal plans are now behind `weekMealPlans`, on for ricky ONLY. Gated in
         THREE places in MealPlan.jsx, not one: the mode toggle, the localStorage
         restore (a saved week would otherwise drop a brand straight into week mode
         on mount) and the submit handler. Verified off for kim/paul/pph/elev8/bbl.
      "Rick.Fit only" is now enforced by code rather than by remembering not to
      deploy. Kim, PPH, Elev8 and BBL never had `mealPlans` at all and were never
      exposed either way.

Still open:
- [ ] Publishing a plan to `client_meal_plans` is still a manual SQL step - there is
      no service-role key in `.env`, so a script cannot write through RLS. Either add
      one, or have the publish script sign in as the coach.
- [ ] Wave 3 #26 (event countdowns) would put the late-January target date on his
      home screen as "N weeks to go". Not started - see the Wave 3 list above.
- [ ] Proactive comms for Rick.Fit. INVESTIGATED 2026-09-10, not built.
      ALREADY WORKING, zero build needed: web push. Rick.Fit has VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY, VAPID_SUBJECT, VITE_VAPID_PUBLIC_KEY and NUDGE_CRON_SECRET
      all set, and `push-daily-reminder.mjs` carries
      `export const config = { schedule: '0 * * * *' }` - a Netlify scheduled
      function running hourly on his site right now. `src/accountability.js` has a
      FIVE-level escalating nudge ladder for food and workouts.
      THE ONLY BLOCKER: Ricky has NO row in `push_subscriptions`. The three that
      exist are Richard Anderson, Lekan and Rosalind Smithers - Kim's and Paul's
      clients. He needs to open the installed PWA and allow notifications. 30 seconds.
      COPY MISMATCH: the nudges are in Kim's voice for women 35+ ("it'd be lovely",
      "no pressure"). Wrong register for him - but see the coupling below before
      editing them.
      ** CROSS-BRAND COUPLING, pre-existing, NOT from this session **
      `daily_reminders_due`, `nudges_due` and `coach_alerts_due` all take only
      `p_secret` - NO brand or coach parameter. Every brand's site runs its own
      hourly copy against the same global queue; `*_mark_sent` de-dupes so nobody
      gets doubles, but it means RICK.FIT'S SITE SENDS PUSH TO KIM'S AND PAUL'S
      CLIENTS. Consequence: `src/accountability.js` is shared AND the sender is
      unscoped, so rewriting the nudge copy for Ricky would put his wording on
      Paul's paying clients' phones. Scope the RPCs by coach before touching it.
      NOT BUILT - WhatsApp: needs Meta WhatsApp Business API or Twilio. Outbound
      needs pre-approved templates; free-form replies only inside a 24h window after
      HE messages first. Meta Business verification + template approval takes days.
      NOT BUILT - voice: Twilio Voice + TTS (ElevenLabs key already on hand). A call
      that asks questions also needs speech recognition and dialogue handling.
      KEY POINT for the decision: push and WhatsApp look identical on a lock screen.
      What WhatsApp actually buys is a REPLY - two-way is the accountability
      mechanism, not the channel. Push is one-way.
- [ ] Asked 2026-09-09: should Rick.Fit be its own repo? Recommendation was no - it
      would fork one codebase into five and every fix would need doing five times.
