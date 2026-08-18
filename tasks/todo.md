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
