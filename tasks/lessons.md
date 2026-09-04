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

## "The update hasn't landed" is usually a resumed PWA, not a failed deploy (2026-08-28)
Paul reported three shipped batches (PAR-Q, round 9, round 10) as missing. All three
were live: published deploy correct, every feature marker present in the live bundle,
all migrations applied, every `features.*` flag on for his brand, and all four e2e
suites passing against app.redefineacademy.com. Nothing had failed to ship.
Cause: an INSTALLED PWA that is resumed (app-switched back to) never performs a
navigation, so it keeps running the JS bundle already in memory — indefinitely.
`public/sw.js` is NOT to blame: navigations are network-first and only `/` plus
hashed `/assets/*` are ever cached, so a genuine reload always gets the new build.
A byte-identical sw.js across deploys is fine and needs no bump.
Rule: before debugging a "missing feature", diagnose in this order — published deploy
id, feature markers grepped from the LIVE bundle, migrations, brand feature flags,
e2e against production. If all pass, it is the user's client. Ask them to force-close
(swipe away, not switch away) and reopen before touching any code. The real fix is a
build-version check that prompts a reload on resume — a PWA has no other way to tell
a long-resumed client that a new build exists.

## Check for an existing script before building the capability (2026-08-30)
Paul's shared link previewed as "Coached by Kim" with Kim's logo. I diagnosed it
correctly (crawlers read static HTML, which was hardcoded to Kim) and then built a
Vite plugin to stamp per-brand metadata — but `scripts/brand-html.mjs` already did
exactly that, wired into `npm run build`, driven by a BRAND env var. The real bug
was that deploys ran `npx vite build` directly, skipping the post-build step, and
BRAND was never set. Two competing implementations nearly shipped.
Rule: when adding build/deploy behaviour, read `package.json` scripts AND the
`scripts/` directory FIRST. "The output is wrong" usually means an existing step
was skipped or misconfigured, not that the step is missing.
Fix in place: `npm run build:<brand>` (scripts/build-brand.mjs) sets BRAND
cross-platform — `BRAND=paul npm run build` does not work in PowerShell, which is
how the wrong branding shipped from a Windows machine in the first place.

## Async-loaded UI needs waitFor, not count() (2026-08-30)
Six of eight failures in the round-13 nav suite were my own assertions firing before
the data arrived: the agenda card paints immediately and fills in today's session
after a query, and the Train hub's hero tile does the same. `count() > 0` right after
`waitForSelector('.agenda-card')` is always a race.
Rule: assert on a locator scoped to the CONTENT (`page.locator('.agenda-item',
{ hasText: NAME }).waitFor()`), never a bare count on a container that renders early.
Two other traps from the same run: `.eyebrow` is uppercased in CSS and `innerText`
returns the transformed text (match case-insensitively), and a session title can
appear twice on the Train screen — once in the plan list, once in "Your sessions"
history — so scope to the first `.session-card` rather than counting page-wide.

## A page-wide `.first()` can turn a real assertion into a vacuous one (2026-08-31)
`e2e_round10_client_ui` clicked `getByRole('button', {name: /Start session|.../}).first()`
page-wide. After the chooser gained more session cards, `.first()` matched a different
card's button, so the player opened the WRONG session — and the follow-up check
("drops survive finishing the session") then read an untouched row and passed for the
wrong reason. Only the display assertion failed, which is what exposed it.
Rule: scope an action to the container it belongs to
(`page.locator('.session-card', { hasText: NAME })`), never a page-wide `.first()`.
And treat a passing assertion next to a failing one in the same flow as suspect —
if the failure means the flow went somewhere else, the "pass" is meaningless.

## "Feature X is broken" can mean it never worked (2026-08-31)
Paul reported forgotten-password as broken. It was never working: 43 users,
`confirmation_sent_at` null on all of them, one `recovery_sent_at` ever and that to
a test address. No custom SMTP, so Supabase's built-in mailer had never delivered to
a real person. `/recover` returns 200 either way, which is why nobody noticed.
Rule: before hunting a regression in an auth/email/webhook path, check whether it has
EVER succeeded — one aggregate query over the relevant timestamp columns settles it
in seconds and reframes the whole job. Volume matters too: two locked-out clients
produced exactly one `/recover` request in 24h, which itself said their attempts
weren't reaching the API the way the report implied.
Also: a build-time secret you don't have is a hard dependency, not a blocker to the
whole task — ship the code with a clean 503 and hand over exact instructions.

## A capability probe must not have side effects (2026-09-01)
e2e_round15 decided "is the service-role key configured?" by calling the reset
endpoint with a REAL client id and a real password. Once the key was actually set,
that probe reset Jamie's password for real and revoked his sessions — so the very
next assertion ("a client cannot reset anyone") failed with a stale token and looked
like an authorisation bug. Fixed by probing with an all-zeros UUID that belongs to
nobody: configured answers 403, unconfigured answers 503, and nothing is changed.
Rule: a probe that asks "does this work?" must be addressed at a target where the
answer costs nothing — never at live data.

## Ask for a value AFTER the thing that can destroy it (2026-09-01)
Progress-photo backdating never worked: not one photo in 43 users' data had ever
been backdated, while measurements backdated fine. The date field sat BEFORE the
"add photo" button, and picking an old photo opens the OS gallery, which backgrounds
the tab — a phone under memory pressure reloads the PWA and the typed date is gone,
so the insert falls back to now(). Measurements never open a file picker, which is
why only photos were affected.
Rule: if a user-entered value has to survive a trip through the OS (file picker,
camera, OAuth, payment sheet), either persist it or — better — ask for it AFTER the
trip, in the same uninterrupted interaction. The database honoured the explicit
created_at all along; the value simply never arrived.
Diagnostic that settled it in one query: compare the stored timestamps against the
signature the backdate path would leave (a fixed 12:00 local time). Every row had an
arbitrary clock time, proving the backdate branch had never once run.

## A convenience write inherits the destination's audience (2026-09-01)
Paul's client: "every session I have built for any client is showing in his list
of sessions ... I lost my shit and just went home." True. To spare Paul rebuilding
week 1 four times, addSession was made to also save each custom-built session into
workout_templates. The reuse worked. What was missed is that workout_templates is
not a private scratch pad: wt_client_read makes an untagged row readable by EVERY
client of that coach. So 13 sessions built inside individual clients' programs
became a shared library, and each client's "Start a workout" led with 13 sessions
that were not theirs, burying the four that were.
Rule: before writing to a table as a convenience, read its RLS policy and ask who
can now see this. A table is an audience, not just a shape. The insert was correct
in every column it set; the harm was in the column it left NULL.
Two corollaries, both of which bit:
- A permissive column default is a leak waiting to happen. visible_to_clients
  defaults true (right for a library the coach builds on purpose), so the other
  insert path states `visible_to_clients: false` explicitly rather than relying on
  a default that means the opposite of what it needs. Asserted in both directions.
- Hiding a row can break the client it was assigned to. A template on a client's
  weekday is read by id; making it invisible blanks that day. The policy therefore
  keeps an "assigned to me" branch. Jamie already had such a row, tagged out of his
  own reach — his Sunday had been silently empty and the fix repaired it.
Also: the reuse this was built for had already been solved properly by the
"Sessions in this program" picker added in the same batch. The auto-save was dead
weight carrying a leak. When a later change makes an earlier workaround redundant,
delete the workaround.

## A disabled button is a dead end unless it says why (2026-09-02)
"One of my clients is stuck on this page and they can't click continue." She had
typed her height in inches. `disabled={!statsValid}` was correct; the failure was
that nothing told her so. `.btn:disabled` is `opacity: .6`, and .6 of a saturated
green on a dark surface still looks like a live button — her screenshot shows it
looking perfectly tappable. Two clients were sitting on that screen, one for five
days, and his unstarted program was blamed on the client rather than on signup.
Rule: never gate progress on a silent `disabled`. Let the button respond, and on
press say which field is wrong and what a right answer looks like. Where a value
has units, accept the other unit and convert it — 67 for a height in cm is not a
typo, it is inches, and telling someone "67in is about 170cm" is one line of code.
Diagnostic worth repeating: `onboarded_at is null` found everyone stuck on the
same screen, including one nobody had reported.

## Fuzzy matching must be allowed to answer "I don't know" (2026-09-02)
"A seated cable row, and it's showing a standing cable upright row." The library
entry is "Seated Cable Rows" — plural — and the matcher required the movement
word to match exactly, so `row != rows` EXCLUDED the correct entry and left a
wrong one to win on an equipment bonus. It also assumed the movement was the last
word, so "Lat Pulldown (cable)" searched for "cable" and returned "Cable Chest
Press". Both were invisible because the function always returned its best
candidate, however poor.
Rules:
- A scorer with no floor will always return something. Give it a confidence
  threshold and an empty result below it. Nothing beats something wrong — the
  same call as the barcode check digit.
- Do not put body parts in a movement vocabulary. Listing "chest" made
  "Cable Chest Fly" match "Cable Chest Press"; a fly is not a press.
- Build the before/after table over every real input (`tasks/match_report.mjs`)
  and read it. Every tuning mistake I made showed up there in one run, including
  two of my own introduced while fixing it.
- Cached results make a fix invisible. `exercise_guides.images_v` stores which
  matcher produced a row so old rows re-match on read, and the RPC's version
  parameter defaults to 0 so functions still deployed elsewhere mark their writes
  stale rather than poisoning the cache. Prefer self-healing over a manual purge.

## Two inputs for one value: the hidden one wins (2026-09-03)
"When I assign her program it doesn't actually assign to her ... when I refresh
it disappears. If I do it from today and click the second confirm button it then
drops in. If I back date the start, do I have to change the date and click the
second confirm?" He had diagnosed it himself. `AssignProgram` had a Start date
field, and the `ProgramDayPicker` it opened had ANOTHER one, seeded to today and
ignoring the first. The picker's value is the one that reached the insert, so a
backdated start was silently discarded — and because the first button only
opened a step it gave no hint of, an abandoned flow wrote nothing at all.
Rules:
- One value, one input. Two controls bound to the same field is a bug even when
  both "work"; the user cannot tell which one counts.
- The button that commits must be the button that looks like it commits. Rename
  the earlier step ("Next: days & start date") rather than trusting people to
  discover a second confirm.
- "It disappears when I refresh" almost always means the UI showed local state
  that was never written. Check what the insert actually received, not what the
  form displayed. One `select` on the live table settled this in seconds:
  exactly one row, dated today, after several backdated attempts.

## Sunday is 0, so every weekday sort leads with Sunday (2026-09-03)
"Her week 1 is Monday, Thursday, Saturday and Sunday. But in the app it lists it
as Sunday, Monday, Thursday, Saturday." `getDay()` numbers Sunday 0, so a plain
`(a - b)` on weekdays puts Sunday first everywhere — the stored `day_map`, the
coach's session list, the client's week. The picker already drew its buttons
Monday-first from `PROGRAM_WEEK_ORDER`, so the app openly contradicted itself.
Rule: a training week is Mon..Sun, which is NOT the natural order of the numbers
it is stored in. Put the comparator in one place (`byDow`/`sortDays` in lib.js)
and route every sort and display through it; never hand-sort dow inline.

## An intermittent test failure on a counter is a lost write (2026-09-03)
Water logging failed about one run in three with `water_ml: 250` after +500 then
+250. It was tempting to call it flaky timing and move on. It was real:
`addWater` computed the new total from React state and wrote it back, so a tap
landing on a stale base overwrote the previous one. To a client that is a tap
that silently did not count.
Rule: a counter is never a read-modify-write from client state. Increment in the
database (`add_water_ml(day, delta)`) so concurrency and stale reads cannot lose
one. And pass the DAY from the caller — `now()::date` is UTC, and in BST a late
evening tap is already tomorrow.
Corollary: when a test fails intermittently on a value that should accumulate,
suspect the code before the test.

## Few-shot exemplars become a script, not a style (2026-09-04)
Paul asked to feed his book in so the AI captures his tone. The distillation
returned a style brief plus the most characteristic verbatim lines, and both
went into the prompt. The model then opened almost every reply with the same
sentence word for word — "Right, let's be honest with each other." — however
firmly it was told not to reuse them. Removing the lines was not enough: the
style BRIEF quoted the same opener back as evidence, and it kept getting lifted.
What worked was fixing the input, not the instruction: the distiller is barred
from quoting a whole opening line or catchphrase and must describe those
patterns in its own words, plus an explicit override where the brief is
injected. Three clean runs afterwards, in voice and original.
Rules:
- Verbatim exemplars are a template. If you do not want them reproduced, do not
  send them — an instruction not to copy loses to the example itself.
- Style transfers from a DESCRIPTION of the style. Keep the samples for the
  human to review; they earn trust in the feature without steering the model.
- When output keeps containing something you banned, look at what is in the
  prompt rather than adding a firmer ban.
- My first assertion demanded zero reuse of any sample line. That was the wrong
  bar: a coach's signature phrase recurring is the point of the feature. Assert
  the failure that actually harms the user — the formulaic identical opener.

## Decide what a feature refuses to reward (2026-09-04)
Building milestone awards, the obvious set includes weight lost. The app already
carries a `nutrition_sensitive` flag for clients who have struggled with
disordered eating, and a badge for losing 5kg is exactly what should never
appear on their phone. Every award is for effort and consistency — sessions,
streaks, PBs, logging — none for body weight or a measurement direction. It is
also better coaching: it rewards the part the client controls.
Two things that made it hold up:
- The maths runs in a SECURITY DEFINER function over the same rows as the rest
  of the app, and there is NO client insert policy, so awards cannot be minted.
- Thresholds were set against real data first. Paul's clients had one to four
  sessions; a ladder starting at 50 would have been furniture. First award at
  one session.
And a failure mode worth remembering: the coach's view also triggered the sync,
which would have silently consumed each client's first-award moment before they
saw it. Anything computed on view needs to ask who gets to see the result first.
