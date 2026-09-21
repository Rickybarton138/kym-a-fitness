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
- [x] Proactive comms: TELEGRAM NUDGES LIVE 2026-09-11 (deploy 6aa3c58d). Verified
      end to end - `?hour=8` and `?hour=19` both returned sent:true and landed.
      `netlify/functions/rickfit-telegram.mjs`, hourly Netlify schedule '5 * * * *'.
      Reads state through a NEW `rickfit_daily_state(p_secret)` RPC - SECURITY
      DEFINER, same app_config secret gate as the existing nudge RPCs, and it
      HARDCODES Ricky's client_id so it cannot return another brand's client no
      matter who calls it. Deliberately does NOT use `nudges_due`/
      `daily_reminders_due`: those take only p_secret, return every brand, and are
      paired with *_mark_sent, so calling them here would either mark Kim's and
      Paul's clients sent without sending or double-send. `src/accountability.js`
      untouched - its copy is Kim's voice and ships to Paul.
      Needed the RPC because RLS blocks the publishable key from macro_targets,
      nutrition_logs and body_measurements. First attempt read them directly and
      silently returned undefined targets, which would have shipped a nudge saying
      "Target today: undefined kcal".
      De-dup is STRUCTURAL not stored: each nudge fires on one London hour, so the
      hourly schedule can only deliver it once a day. No state table.
      Schedule: 08:00 brief, 14:00 if nothing logged, 19:00 protein gap,
      21:00 if neither food nor training. `?hour=N&secret=...` previews any of them.
      USING ASTRA'S BOT (`Astra_notify138_bot`) and Astra's chat, so gym nudges land
      alongside Astra operational alerts. Change TELEGRAM_CHAT_ID on the rick-fit
      site to split them; a separate bot is also cheap.
- [ ] Original investigation notes, 2026-09-10.
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
      REUSE FROM ASTRA (checked 2026-09-10, `~/astra-removals`): yes, substantially.
      These are ACCOUNT-level assets, callable over HTTP from a Netlify function -
      the Python/Railway vs JS/Netlify split does not matter:
      - Twilio WhatsApp, PRODUCTION not sandbox: 11 Meta-approved templates with real
        HX content SIDs in `app/whatsapp.py` (one marked "APPROVED by Meta 2026-07-30").
        `ADMIN_ALERT_WHATSAPP_TO` already points at Ricky's personal mobile.
      - ElevenLabs conversational agent WITH a Twilio phone number
        (`ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID`), placing real
        outbound calls via `/v1/convai/twilio/outbound_call`. This IS "the app phones
        me and asks questions" - already built, for Astra leads.
      - Telegram bot, already wired and already alerting Ricky.
      - The PATTERN worth copying: a queue endpoint (`/outbound/queue` in
        `app/voice_routes.py`) that n8n polls and fans out to ElevenLabs. Rick.Fit
        would expose an equivalent "who needs a nudge call" endpoint.
      WHAT DOES NOT TRANSFER: the templates are Meta-approved per use case and
      branded Astra Removals - "your quote is ready" cannot carry "did you train".
      New fitness templates need fresh Meta approval (days). The ElevenLabs agent's
      persona is removals sales; a second agent can reuse the same phone number.
      RECOMMENDATION: Telegram FIRST. No 24h window, no template approval, no
      per-message cost, bot already wired to him, and it is two-way. WhatsApp's
      24h window is the whole problem and Telegram simply does not have it.
      Voice second: a second ElevenLabs agent with a fitness prompt on the existing
      number. WhatsApp last, if ever - it is the most work for the least gain here.
- [ ] Asked 2026-09-09: should Rick.Fit be its own repo? Recommendation was no - it
      would fork one codebase into five and every fix would need doing five times.

## Paul's membership + accounts batch (2026-09-12)
Voice note. Seven asks, plus one thing found while scoping them.

### 0. SECURITY, found while scoping. DONE + LIVE 2026-09-12 (migration `profile_column_grants`)
`profiles_update_own` is `USING (id = auth.uid())` with no column-level grants,
and `authenticated` holds UPDATE on every column. Proven against production with
a demo client's own JWT (restored immediately): a signed-in client can set their
own `membership_tier`, set `role = 'trainer'`, and set `trainer_id`.
The third is the serious one - `my_trainer_id()` reads `profiles.trainer_id` for
the caller, and every coach-content policy (recipes `rc_client_read`, videos,
programmes, files, community posts) keys off it. So a client can repoint at
another coach and read that coach's entire library. Cross-tenant isolation is
the core promise of the white-label product.
Pre-existing, not caused by this batch - but load-bearing for it: a paused
client could set `status = 'active'` and let themselves back in.
Fix: `REVOKE UPDATE (role, trainer_id, membership_tier, active, trainer_code,
trainer_code_ic, status, is_test) ON public.profiles FROM authenticated, anon;`
and route coach writes through SECURITY DEFINER RPCs (house pattern already:
`set_member_tier`, `set_client_health_context`, `set_step_target`).
DONE: `tasks/migration_profile_column_grants.sql`, applied to production.
Table-level UPDATE revoked from authenticated + anon; 16 client-owned columns
granted back. The allow-list locks any FUTURE column by default, so `status`
and `is_test` arrive definer-only for free.
Verified: `tasks/e2e_tenant_isolation.mjs` - 8 failing before, 14 passing after,
including a control proving the leak query can see anything at all. Coach RPCs
(set_member_tier / set_step_target / set_water_target) still write. A real
signup with Paul's join code still links, seeds targets and completes
onboarding. Round 17/23/27/32 green on production.
Run `node tasks/e2e_tenant_isolation.mjs` on every deploy - nothing tested
cross-tenant isolation before today.

### 1. Pause / end a client's access — DONE + LIVE 2026-09-12
"when people stop working and they have a payment, they still have access... the
ability to pause and then resume as well as fully disable... if somebody pauses
for a couple of months, keep everything there so that when they come back they
can get access to everything they've put in."
- `profiles.status` ('active' | 'paused' | 'ended'), default 'active'. NOT a
  reuse of `profiles.active`, which means "whole gym suspended" and is read off
  the COACH's row for both roles in `src/App.jsx:24-40`.
- Gate becomes: the client's own status AND their coach's `active`.
- Paused and ended keep every row. "Fully disable" = ended, not deleted -
  reversible, and he may well want them back.
- Paused/ended/test clients must drop OUT of the active-client count: his
  pricing band is per active client (Starter, up to 25, he is at ~15), so a
  paused client silently costing him a band would be a bug that bills him.

### 2. Remove clients (coach side) — DONE + LIVE 2026-09-12 (= status 'ended')
Not built at all today. = set status 'ended'. Hard delete reserved for test
accounts, behind its own confirmation.

### 3. Tag + filter test accounts — DONE + LIVE 2026-09-12
`profiles.is_test`. Coach dashboard filter: All / Standard / Inner Circle / Test.
Test accounts excluded from counts and metrics.

### 4. Client calorie chart: the numbers, and an average bar
Value above each bar, plus an "Avg" bar at the end of the chart itself (the
average is text-only today, in `src/FoodDiary.jsx` around the `.diary-week`
block). Keep the over/under colouring. KEEPING the rolling 7-day window - he
described it ("Sunday to Friday") rather than complained about it, and a fixed
Mon-Sun week would change what "this week" means in his check-ins.

### 5. Coach chart: totals <-> where the calories come from
Toggle on the coach's view of a client's chart: totals, or broken down by
breakfast / lunch / dinner / snacks, "to spot patterns, behaviours and trends".
Stacked bars per day beat a pie - a pie shows one aggregate, he asked for trends.
SMALL, because `nutrition_logs.meal_type` is already stored on every log with a
time-based fallback (`mealOf`). No migration, no backfill.

### 6. Client account screen
Icon top right next to Sign out. Scope confirmed by Ricky 2026-09-12:
- Display name, profile photo (needs `profiles.avatar_path`), change password
  (exists, but buried at the bottom of the health screen - move it), push
  notifications, sign out, and manage membership.
- **Email is READ-ONLY.** Shown, not editable - "ask your coach to change this".
  Changing an auth email needs a confirmation round-trip, and locking it removes
  the single easiest way for a client to lock themselves out of their own
  account.
- Changing a password while SIGNED IN needs no email at all
  (`supabase.auth.updateUser`), so none of this screen depends on item 7.

### 7. Email: per-brand sender (Ricky picked this 2026-09-12)
NOTE: with email changes off the table (item 6), the ONLY thing this now buys is
forgotten-password. Still worth it - a locked-out client currently has no
self-serve way back in and Paul resets by hand - but it is no longer a
prerequisite for anything else, so it can move down the order freely.
Supabase Send Email hook -> Netlify function -> Resend, branded per brand.
Free tier is 3,000/mo and 100/day; real volume across all five brands is tens a
month, so GBP 0. Paul first (SPF/DKIM on redefineacademy.com at Squarespace -
same DNS as the `app.` CNAME); other brands fall back to a neutral sender.
This also fixes forgotten-password, which per
[[kym-a-fitness-auth-email-broken]] has NEVER reached a real client.

### 8. Stripe (Ricky picked "go straight for Stripe billing" 2026-09-12)
Nothing Stripe exists in this repo and there are no keys.
Architecture: **Connect, SaaS pattern, direct charges** - each coach connects
their OWN Stripe (Accounts v2, `dashboard: 'full'`, `fees_collector: 'stripe'`,
`losses_collector: 'stripe'`). The coach is merchant of record, keeps 100% of
their client money and pays their own Stripe fees; the platform takes no cut,
because Ricky's revenue is the GBP 125/mo SaaS fee billed separately. Never hold
a coach's secret key in Netlify env - that does not scale past Paul and makes
Ricky liable for someone else's money.
Then: subscriptions on the connected account, "Manage membership" opens a
Customer Portal session on that account, and a webhook
(`customer.subscription.updated` / `.deleted`, `invoice.payment_failed`) writes
`profiles.status` - which is to say Stripe drives the same switch from item 1.
UNBLOCKED 2026-09-12: Paul confirms the Stripe account behind his MoonClerk is
his own.

**His terms, from him, 2026-09-12:**
- Standard GBP 50/month. Inner Circle GBP 200/month.
- Minimum commitment 3 months, then one-month rolling.
- Notice is a WHOLE month, and takes effect after the NEXT payment. His example:
  "if someone pays on the 20th and they notify me on the 10th, they have one
  last payment to make and get a full month of coaching at the end."

So the rule is:
    accessEnds = max(current_period_end + 1 month, subscription_start + 3 months)
NOT `cancel_at_period_end`. Notice given during a period does not end that
period - the next payment lands and buys a whole further month. Verified against
his example plus the edges (notice the day before / the day after a payment,
notice inside the minimum term, a 31st billing date running into February).

**CONSEQUENCE - the Stripe Customer Portal CANNOT express this.** Its cancel
options are "immediately" or "at period end", and neither is his rule; it also
has no concept of a 3-month minimum. So:
- Turn cancellation OFF in the portal. Keep it for card updates and invoices.
- "Give notice" lives in the app, which is what Paul asked for anyway ("it would
  give a notification through to me so I can let them know when their final
  payment will be"). The app shows the computed date, tells Paul, and on
  confirmation sets Stripe `cancel_at` to that timestamp.
- **Do NOT compute the date in JS.** Writing that arithmetic by hand produced
  two bugs in ten minutes: `setMonth` works in LOCAL time, so 20 Jan + 3 months
  came out as 19 April once BST was involved; and 31 Jan + 1 month normalised to
  3 March instead of 28 Feb. Stripe already knows `current_period_end` and
  anchors billing cycles correctly - read the boundary from the subscription
  rather than recomputing it. A one-day error here is a dispute about money.

**ANSWERED BY PAUL 2026-09-12:**
- **Upgrades take effect from the NEXT BILLING DATE.** No proration, no
  mid-month switch. Implement as a Stripe **subscription schedule** (phase 1 the
  current price to period end, phase 2 the new one), not
  `subscription.update` with a proration flag - a schedule says what it means and
  survives someone reading it in a year.
- **MoonClerk is GONE. Everything is native in Stripe already.** No migration,
  no third party owning the subscription objects. His live subscriptions are
  ordinary Stripe subscriptions in an account he controls.
- **"MoonClerk was an app that overlayed Stripe to manage subscriptions a little
  easier. I'd like something similar."** So the deliverable is not just a client
  "manage membership" button - it is a COACH-FACING subscription manager: per
  client, the plan, the amount, the next payment date, the status, failed
  payments, change plan, and action a notice.
- **"I don't want people to be able to authorise their own cancellations. I want
  that to flag to me and tell them their final payment date rather than just hit
  cancel and it cancel immediately."** Confirms the portal's cancel button stays
  OFF. The client's action is a REQUEST: it shows them their final payment date
  and last day of coaching straight away (deterministic from the rule above),
  and raises it with Paul. Paul actions it - at which point `cancel_at` is set.
  He keeps the conversation, which is the whole point of a month's notice.

STILL TO ASK PAUL:
- Is he VAT-registered? Decides whether GBP 50 / GBP 200 are gross or net.
- Does an upgrade restart the 3-month minimum, or does the original term stand?

### Order and staging
0 first (it gates 1). Then 1-3 as one deploy, 4-5 as a second, 6-7 as a third,
8 last. NOT one deploy carrying all of it to a live coach's clients.
0-3 DONE + LIVE 2026-09-12. Next: 4-5, the two chart changes.

HOLD-BACK NOTE, now resolved: the week meal-planner no longer needs the
revert-at-deploy dance. It is behind `features.weekMealPlans` (Rick.Fit only),
added by the other session in this repo. The revert had started CONFLICTING as
later commits touched MealPlan.jsx, which is what a deploy-time revert always
turns into. Round 33 asserts the week option is unreachable on Paul's brand.
Do NOT verify this by grepping the bundle: brands resolve at RUNTIME from the
hostname and one bundle carries every brand, so the strings are always present.
Check what the brand can actually reach.

## Calisthenics (Ricky, 21 Sept) — Rick.Fit + Lennon GK only

Asked for all three parts: the movements, ready-made sessions, a style the AI
programme builder understands, and a skill progression tracker.

The shape: ONE ladder model in `src/calisthenics.js` feeds all four surfaces, so
a step added there shows up in the tracker, in the sessions, in the exercise
dropdown and in the AI's vocabulary without being written out four times.

- [x] `src/calisthenics.js` — six skill ladders (pull, push, dip, legs, core,
      handstand), each an ordered list of steps with target, cue and what unlocks
      the next. Plus SESSIONS as slot lists that resolve against where the client
      actually is on each ladder.
- [x] `src/exercises.js` — the ladder step names become a "Calisthenics" optgroup,
      added to EXERCISE_GROUPS only when `THEME.features.calisthenics`. Every
      consumer (WorkoutRows dropdown, KNOWN_NAMES, TrainerApp) picks it up free.
- [x] `themes.js` — `calisthenics: true` on ricky and lennon.
- [x] Migration `calisthenics_progress` (client_id + skill_key PK, step_index),
      RLS client-owns-own + trainer read via is_my_client().
- [x] `src/Calisthenics.jsx` — where you are on each ladder, what the next step
      needs, and the sessions, started with startSessionNow into the guided player.
- [x] Train hub tile + screen route + HUB_CHILDREN, all behind the flag. AND the
      Home tile in `homeTileDefs` — which is the one that matters, because
      Rick.Fit and Lennon have no `nav` and so never render TrainHub at all.
      See lessons.md.
- [x] `program-generate.mjs` — a `style` input; calisthenics gets a prompt block
      naming the ladders so it writes holds and progressions rather than
      "3 sets of 10 press-ups" for twelve weeks. Gated in BuildMyProgram behind
      `calisthenics && aiWorkoutGen` — Lennon has aiWorkoutGen off ON PURPOSE
      (club S&C owns his programming) and that must not change.
- [x] Tests for the pure parts (ladder resolution, session building), build, deploy
      ricky + lennon only.

NOTE for Lennon: his theme is explicit that the app must not write a second
programme alongside the club's. The tracker and the sessions are additive
training volume for a contracted academy keeper — his call whether he uses them.

DONE 2026-09-21, live on rick-fit and lennon-gk only.
Verified: 10 unit tests (`tests/calisthenics.test.mjs`); 12 end-to-end
assertions driving the real UI on the Rick.Fit theme
(`tasks/e2e_calisthenics.mjs` — tile, six ladders, tap to advance, the step
written to the table, the step surviving a reload, the session opening in the
guided player built from the NEW step, and the saved plan carrying cues);
4 RLS assertions on the new table (`tasks/e2e_calisthenics_rls.mjs`);
`e2e_tenant_isolation.mjs` still green. The live programme function was called
with style=calisthenics and came back using the ladder names and holds in the
reps field, which also proves the new `../../src/calisthenics.js` import bundles.
