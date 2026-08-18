# Lessons

## PWA app-switch state loss (client AND coach)
On mobile the PWA reloads when backgrounded/resumed, wiping all React state.
Every screen/in-progress form must persist to session/localStorage or the user
lands back on Home and loses their work.
- Client side (fixed earlier): screen persisted to sessionStorage (`cbk_screen`);
  guided workout progress to localStorage (`cbk_gw:<id>`).
- Coach side (fixed 2026-07-31, Paul report): the selected client/squad reset to
  null on reload -> dropped the coach on the dashboard. Now persisted in
  sessionStorage (`cbk_coach_sel` / `cbk_coach_squad`), restored after lists load.
  In-progress workout builds (title/focus/rows) persist via `useWorkoutDraft(key)`
  in WorkoutRows.jsx -> localStorage `cbk_wbdraft:<key>`; builders auto-open a
  restored draft and call clear() on save. Applied to AssignWorkout + CoachTemplates.
- Rule: any new multi-step builder/form gets the same treatment. Squad builder
  still TODO (not in Paul's brand, lower priority).

## Adding exercises to the workout builder
Exercise names come from `src/exercises.js` (EXERCISE_GROUPS, a curated <optgroup>
list) PLUS an "Other (type your own)" free-text option in the dropdown. Coaches can
already add any bespoke exercise via "Other"; add commonly-requested ones to
exercises.js so they're permanent for everyone. No per-coach custom library yet
(candidate future feature: coach_exercises table merged into the dropdown).

## Editing & reordering workouts (2026-07-31, Paul)
- `WorkoutEditForm` (WorkoutRows.jsx) is the shared edit form; wired into assigned
  workouts (CoachSessionCard), templates (CoachTemplates), programme sessions
  (CoachPrograms). RLS already allows coach UPDATE on all three (is_my_client /
  coach_id). No RPC needed.
- Reorder: up/down (`row-move`) buttons in ExerciseRowsEditor `move(i,dir)` — chose
  buttons over drag-and-drop for mobile reliability. Benefits every builder.

## Programme built-in check-in/measurement schedule (2026-07-31, Paul)
- No client-programme enrollment exists — clients browse the library, they don't
  "start" a programme. So a programme's accountability can't auto-apply on follow.
- Design: `workout_programs.schedule_tasks jsonb` (array of {kind,dow,cadence},
  same kinds/cadences as per-client `client_tasks`). Coach sets it on the programme
  (ProgramSchedule editor in the open-programme view). To apply, the coach picks a
  programme on a client's page (ApplyProgramSchedule) -> upserts client_tasks per
  kind -> the existing home "due today" engine shows the prompts. Reuses the
  working per-client task engine end to end.
- Inner Circle vs standard steer: Inner Circle = bespoke templates + per-client
  Weekly schedule (already has check-in/measurement scheduling); standard/low-cost
  = programme library + this built-in schedule (one-to-many, less work).

## kym-a-fitness DB IS reachable via the claude.ai Supabase MCP (2026-08-05)
The `mcp__claude_ai_Supabase__*` tools (apply_migration / execute_sql, project_id
`ezwmfbuuopsnpanebtal`) reach kym-a-fitness directly — run migrations yourself, no
more pasting SQL. Verify + clean up test rows via execute_sql (service role, bypasses
RLS). RLS still tested properly via anon-key logins (see e2e_mealplans.mjs: coach
author -> assign/copy -> client reads own -> client blocked from templates). If the
MCP drops again, fall back to the SQL-editor paste flow below.

## Running kym-a-fitness DB migrations when the MCP is down (2026-08-03)
The claude.ai multi-project Supabase MCP (which targets kym-a-fitness ezwmfbuuopsnpanebtal)
drops sometimes; the project-scoped MCPs connected (magna-park-crm / primehaul-leads /
telomind) each hit a DIFFERENT project and CANNOT reach kym-a-fitness. Supabase CLI is
logged in (keyring, no token file) but `db push` needs the DB password (don't ask for it).
Fastest unblock: hand Ricky the migration SQL to paste at
https://supabase.com/dashboard/project/ezwmfbuuopsnpanebtal/sql/new (direct link avoids
org-hunting — kym-a-fitness is under org ovigywooundgufotygyn, not the one he usually opens).
Then verify + build via the anon key + a seeded coach login. Permanent fix: add a
project-scoped kym-a-fitness Supabase MCP entry (ref ezwmfbuuopsnpanebtal) like the others.

## Multi-week programmes (2026-08-03, Paul) — schema + logic
`program_sessions.week` (int) + `.dow` (0-6, null=unscheduled); `client_programs`
(client_id, coach_id, program_id, start_date, repeat, active) RLS coach=is_my_client,
client=own. Agenda maths (ClientApp Home load): diffDays from start_date, weekNum =
floor(diffDays/7)+1, wrap `((weekNum-1)%cycleWeeks)+1` if repeat else null past the end;
cycleWeeks = max session week. Today's session = week==weekNum && dow==getDay().
Coach: AssignProgram (one active/client, replace on reassign) + week/day on addSession.

## Scanner "low memory" crash on iOS (2026-08-03, Paul's client)
"Unable to complete previous operation due to low memory" = iOS Safari/WebKit OOM,
NOT a billing/credit issue. Cause: meal/fridge/recipe scanners sent the FULL-res
phone photo via `fileToBase64` (12MP → ~5MB base64 string + full decode) — iOS aborts.
Fix: route all image sends through `scaleImageToBase64(file, 900)` (createImageBitmap
→ canvas downscale → JPEG ~0.82, `bmp.close()` + zero the canvas to free memory).
Bonus: also converts iOS HEIC → JPEG, which Claude vision accepts (HEIC can be rejected).
Rule: never `fileToBase64` a camera photo for upload — always downscale first.

## Paul's "changes not visible" = app.redefineacademy.com is NXDOMAIN (2026-08-06)
The Netlify site `redefine-academy` (bda91296) has custom_domain `app.redefineacademy.com`
set, but NO DNS record exists for it — two resolvers return NXDOMAIN (status 3). So that
"nice" URL is DEAD; deploys never reach anyone on it. `redefineacademy.com` + `www` point to
SQUARESPACE (Paul's marketing site), NOT the app. The ONLY working app URL is
`redefine-academy.netlify.app` — that's where deploys land and where I verify. Earlier notes
saying "verified live at app.redefineacademy.com" were wrong (restoreSiteDeploy just echoes the
configured custom domain; real verify was via the netlify.app subdomain).
FIX: (a) immediate — Paul uses redefine-academy.netlify.app (remove/re-install any PWA from the
dead domain). (b) proper — add a CNAME `app` -> `redefine-academy.netlify.app` at the DNS host
that manages redefineacademy.com (Squarespace), then Netlify provisions SSL. Ricky action (DNS creds).
Lesson: ALWAYS confirm a custom domain actually resolves (DoH: dns.google/resolve?name=) before
claiming a deploy is "live at" it; a Netlify custom_domain field is not proof of working DNS.

## Recovery-aware nutrition mode (2026-08-11, Paul) — SAFETY-CRITICAL
Paul flagged a client with an ED history who restricts well but fears increasing
calories. Built a gentle "nutrition support" mode. Design:
- Schema: profiles.nutrition_sensitive (bool) + nutrition_sensitive_note (text);
  coach sets via RPC set_nutrition_support (SECURITY DEFINER, is-my-client check).
  Feature flag `nutritionSupport` (Paul on). Coach UI = NutritionSupport card in
  ClientDetail (sensitively worded).
- AI injection: `recoveryLine(recovery)` appended AFTER styleLine to EVERY nutrition
  prompt in analyse.mjs (fridge/meal/ask/bodyscan) + a recovery block in meal-plan.mjs.
  It forbids suggesting deficits/restriction/weight-loss, bans good/bad-food framing,
  reframes eating enough as progress, and signposts GP/Beat. Client injects it via
  lib.js setRecovery/getRecovery (from their profile) into every analyse() + meal-plan call.
- Client UX: gentle number-free signpost in MealPlanBuilder when on (Beat 0808 801 0677 + GP).
- VERIFIED the behaviour actually flips: same "how low should I cut calories?" question →
  recovery OFF gives a 15-20% deficit; recovery ON refuses the number, redirects to
  nourishment, signposts help. Test the contrast, don't assume a prompt line works.
Rule: for anything touching disordered eating, tone is safety-critical — companion not
treatment, always signpost, and get a clinician to review wording before wide rollout.
The bigger standalone version is its own project: ~/recovery-app ("Enough").

## Standalone Netlify functions: use Haiku, not claude-sonnet-5 (2026-08-06)
Building programme-edit.mjs, `claude-sonnet-5` intermittently returned a valid 200
`type:"message"` response with EMPTY content (no text block) — ~50% of calls, so the
feature silently no-op'd. Switching to `claude-haiku-4-5-20251001` (what the other
standalone functions use) was 100% reliable and plenty capable for structured JSON
rewrites. Also: (a) parse model JSON robustly — strip ```json fences, accept BOTH
{"sessions":[...]} and a bare [...] array; (b) merge revised sessions back by ARRAY
POSITION, not a model-echoed index field (the model drops it); (c) retry the call 2-3x
with backoff; (d) surface a real error instead of silently returning the originals
(a silent fallback looks identical to "the AI did nothing"). Don't hammer the endpoint
while testing — a few max_tokens:8000 calls in seconds trips the key's TPM rate limit.

## Verifying live Netlify deploys
Custom domains behind Cloudflare (e.g. app.redefineacademy.com) block plain curl.
Verify the deployed bundle via the raw `<site>.netlify.app` subdomain instead, then
grep the /assets/index-*.js for the new symbol.
