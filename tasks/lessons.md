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

## A prompt is a request; a check is a guarantee (2026-09-04)
Building programmes around a client's own kit, the generator put a lat pulldown
in a plan whose entire inventory was dumbbells, a bench and bands — about one
run in five. Two rounds of firmer wording ("HARD CONSTRAINT", "there is NO cable
machine") reduced it but never removed it, because an instruction is something
the model weighs, not something it obeys.
What fixed it was checking the output: any exercise naming kit the person does
not own triggers one rebuild and is dropped if it survives. Three clean runs
before the guard, five after.
Rule: when a wrong answer would quietly harm the user — twelve weeks built
around a machine they do not own — validate the output in code. Reserve prompt
wording for improving the median answer, never for guaranteeing the floor. The
same pattern as the barcode check digit and the exercise-image confidence floor.

## Escapes in a python heredoc keep breaking JS (2026-09-04)
Third time this session: `\n` written inside `python - <<'PY'` reaches the file
as a real newline, producing an unterminated JS string. It broke the analyze
function, then a test file. It is silent when the surrounding syntax still
parses, which is worse.
Rule: patch anything containing a backslash escape with the Edit tool, not a
python heredoc. If a heredoc is already in flight, `node --check` the file
afterwards — it catches this in one second.
UPDATE 2026-09-07: broke this rule twice more the same week — a `/
{2,}/`
regex that became a literal newline, and a shell heredoc that would not even
parse. Writing the rule down was not enough. The stronger version, which does
work: NEVER author or patch a whole file through a heredoc. Use the Write tool
for new files and Edit for changes; reserve heredocs for plain prose with no
backslashes at all. It is not a judgement call each time — the escape layers
are simply not worth reasoning about.

## `1fr` is `minmax(auto, 1fr)`, and an input will not shrink (2026-09-06)
Paul's client: "there's a couple of bits where the text box goes off screen."
`.grid-2` was `grid-template-columns: 1fr 1fr`. A bare `1fr` is
`minmax(auto, 1fr)`, so each column refuses to go below its content's intrinsic
width — and an `<input>` carries a built-in width of roughly 20 characters. Two
of those plus a gap exceed a 360px phone, which scrolls the WHOLE page sideways
and pushes the labels off the left edge. It had been wrong in all 48 uses of the
class since the start; nobody hit it until a client on a narrow screen did.
Rule: in any grid or flex row holding form controls, use `minmax(0, 1fr)` and
`min-width: 0` on the children. `1fr` alone is a latent overflow.
The check that matters more than the fix: a sweep of every screen at 320px and
360px asserting `documentElement.scrollWidth <= clientWidth`, naming the widest
offending element. Cheap, catches the whole class, and it is in round 23 now.

## Positional mapping silently drops what it cannot place (2026-09-06)
"I could see the TRX training session but not the legs one." A programme was
authored Tue + Thu; the assignment's day_map was [Tue]. `sessionForDay` maps
chosen days onto the week's sessions BY POSITION, so a one-entry map could only
ever reach session one. The Thursday session existed in the database, rendered
in listings, and no date could ever resolve to it.
Rule: when mapping list A onto list B by index, decide explicitly what happens
to the leftovers. Silently dropping them is almost never right — here they now
fall back to the day the coach authored, so nothing can vanish. And say it at
input time: the picker now states how many sessions are left unplaced.
Worth noting the shape — the data was perfect and the bug was in the reading of
it. Querying program_sessions showed both sessions present, which pointed
straight at the resolver rather than at the builder.

## "It isn't saving" often means "I can't find my way back" (2026-09-06)
Benn: "it's not saving his progress as he goes so when he comes out of the
browser and back in it's reloading back to the home page and he's having to
start again." Every tick and weight WAS being saved — the player writes to
localStorage on each change. What was missing was the route back: the flag that
reopens a session lived in sessionStorage, which a browser discards on close, so
the app had no idea there was anything to return to.
Rule: when a user says data is lost, check whether it is the data or the way
back to it. Reading what is actually in storage answers it in a minute, and the
two have completely different fixes.
Corollary that nearly hid the fix: the session card reads the resume flag once,
at mount. Someone whose last screen was already Train set the flag and saw
nothing, because the screen never changed and so never remounted. State read
only at mount needs a deliberate remount when something outside changes it.

## A test that finishes a workout changes what the app offers (2026-09-06)
Round 24 finishes a session to prove the drops are stored. That inserts a
workout_completion for today, which makes Home show "Start" instead of "Start a
workout" — and round 10, which clicks that button, started failing. It looked
like a regression from the change under test.
What settled it in one run: the same suite failed against PRODUCTION, which did
not have the new code. Not mine.
Rule: a suite must undo every side effect it creates, not just the rows it
obviously owns — completions, targets and streak state all steer other screens.
And when a sibling suite starts failing, run it against production first; if it
fails there too, the change under test is innocent.

## Derive onboarding progress from the work, not from a cursor (2026-09-07)
Paul asked for a walkthrough — "you know how some apps do a walk through of
first up, go here and do xyz". The obvious build is a tooltip tour with Next
buttons. It was built as a checklist that ticks itself off from the client's
real rows instead, because his actual goal was "maximise people doing the right
things" and a tour is dismissed once whether or not anything was done. Deriving
it also means it survives closing the app for free, with no progress cursor to
keep in sync, and it keeps working as a to-do list through the first week, which
is when people drift.
Rule: when asked for a walkthrough, ask what the walkthrough is FOR. If the goal
is completion rather than orientation, measure completion.
Cheap correctness point that mattered: targets are seeded at signup, so "has
targets" proves nothing about whether anyone looked. Opening the screen is the
signal. Check whether the state you are testing was created by the user or by a
default.

## Test setup that works around RLS is hiding something (2026-09-07)
A test set a client's tier with a direct profiles update and silently got back
zero rows — the only UPDATE policy is own-row, and set_member_tier is the coach's
real route. The instinct is to reach for the service role and move on; the
policy was doing its job and the test was wrong.
The same run showed two fixture clients had `trainer_id: null`: they had been
created with joining code REDEF1 when Paul's is FA128C, so they were never
actually linked to him. Assertions had been passing around an account that was
not in the state it claimed to be.
Rules:
- If test setup needs to bypass a policy, use the same route the product uses.
  A test that needs more power than the user has is testing something else.
- Assert the fixture is in the state you think it is. `trainer_id: null` would
  have shown in one select and saved two rounds of debugging.

## The deploy runs the build; your local one is decorative (2026-09-07)
The Physical Performance Hub served "Coached by Kim" for weeks. Local builds
were correct — `npm run build:pph` stamped the right name into dist every time —
and the deployed site was still wrong. The reason: netlify.toml sets
`command = "npm run build"`, so `netlify deploy` runs that build and stamps the
HTML from the SITE's BRAND env var. PPH's BRAND was never set, and the default
is kim. Paul, Kim and Elev8 all looked fine only because their BRAND happened to
be right.
Rule: when a deployed artefact disagrees with the one you built, stop comparing
your build and go and read what the deploy pipeline actually runs. I re-verified
the local stamp three times over two sessions before checking netlify.toml.

## `--site` was ignored, and it wrote to the wrong customer's site (2026-09-07)
`netlify env:set BRAND ricky --site <rick-fit-id>` set BRAND=ricky on COACHED BY
KIM — this folder is linked to Kim's site and the flag did not win. Kim's live
site was never rebuilt so nothing shipped, but one deploy of hers would have put
another brand's name, icon and install title in front of her clients.
Rules:
- For anything that writes to a specific site, use `netlify api` with an explicit
  `site_id`, never a CLI flag on a folder linked to a different site.
- Read it back on EVERY site afterwards. One read showed kim=ricky and
  ricky=paul; without that the damage would have sat there waiting for a deploy.
- A tool that silently targets something other than what you named is worth
  writing down, not working around once and forgetting.

## `Math.max(2, x)` can never be the sentinel you're testing for (2026-09-08)
Week mode was gated on `const days = Math.min(7, Math.max(2, Number(b.days) || 0))`
then `if (days)`. The clamp floors at 2, so `days` is never 0, so the branch was
always taken — every ordinary one-day meal plan, the thing Paul's clients already
use daily, went down the untested week path. It shipped to a draft and would have
shipped to production; the advisor caught it by reading, not by running.
Rules:
- Check "was this asked for?" BEFORE clamping. `b.days ? clamp(b.days) : 0`.
- When adding a branch to a shared endpoint, the test for the OLD behaviour is
  the important one. Round 31 asserts `!d1.days` — "not a week" — for this reason.

## content[0].text is not the answer on a model that thinks (2026-09-08)
The shopping list returned a clean HTTP 200 with an empty list, so it read as the
model failing at the task. It was not: `content[0]` was a `thinking` block, so
`content[0].text` was undefined and the parse ran on `'{}'`. With three meals it
finished thinking and produced text; with twelve it spent the whole 2500-token
budget reasoning and stopped on `max_tokens` with no text block at all.
Rules:
- Read the first block of `type === 'text'`, never `content[0]`. All four call
  sites in meal-plan.mjs were wrong the same way; `analyse.mjs` and the other
  brands' functions want the same check.
- `stop_reason === 'max_tokens'` is a different failure from a bad answer and
  deserves a different message. Print it before theorising.
- The diagnostic that solved it was returning `{status, stop_reason, content
  types}` in the error body. Two minutes, after twenty of guessing.

## A prompt cannot hold two rules that contradict each other (2026-09-08)
"Be varied" and "keep the shopping list small" were both in the day prompt.
Weighted one way it wanted duck, halibut, sea bass and kippers in a single week —
97 items. Weighted the other it served the same dinner four nights running, which
is the exact complaint being fixed. Reordering the instructions and shouting
ABSOLUTE at one of them just moved which side lost. Four attempts, no progress.
Rule: when two instructions genuinely conflict, take the decision away from the
model. A cheap call now picks five proteins and four cuisines, and code assigns
each day its own pairing — the shop is small because the proteins repeat, the
days differ because the cooking does, and neither is left to chance.
Corollary: that assignment was wrong twice (four days of chicken thigh, then
repeated pairings) and a six-line brute force over every plausible list size
caught both in seconds. Arithmetic you can enumerate, you should enumerate.

## A safer helper is still a behaviour change (2026-09-09)
Six functions read `j?.content?.[0]?.text || '{}'`. Replacing them with a shared
`firstText(j, '{}')` that ended `return tb?.text ?? fallback` looked like a pure
improvement — it fixes the thinking-block case the old code got wrong. It also
quietly changed what happens on an EMPTY text block: `||` fell back to `'{}'`,
`??` returns `''`, and `JSON.parse('')` throws where it used to parse cleanly.
All six run on Haiku and all six work today, so the only way this sweep could
matter to a user was by breaking something that already worked.
Rules:
- `??` and `||` are not interchangeable when you are replacing `||`. Read the
  fallback and ask what the old code did with a falsy-but-present value.
- When a refactor's whole justification is "this can never fire today", the
  tests worth writing are for the paths that DO fire. `tasks/test_claude_text.mjs`
  is 11 cases and 6 of them assert the pre-existing behaviour.
- Caught by reading the diff, not by running anything. Diff every mechanical
  sweep before deploying it, especially one applied by script.

## Numbers a user quotes are not always the number you need (2026-09-09)
Asked for height and waist to date a fat-loss target; got "5'11" and 32"". Run
through Navy body-fat that gives ~11% — already at the goal — and the advice
flips from "keep cutting" to "stop cutting and build". But a photo from eight
weeks and 3 kg earlier plainly showed otherwise. The 32" was a jeans size, not a
tape at the navel; trouser sizing runs 2-4" under.
Rule: when one input swings the recommendation to its opposite, say so and give
both branches rather than picking the flattering one. State how to resolve it
(tape at the navel, relaxed, breathed out) instead of quietly assuming.

## The error in the screenshot was the browser's, not ours (2026-09-09)
Paul sent a photo of the steps card: "Value must be greater than or equal to
2026-09-03". Nothing in the logs, no error state in the app, and the save path
looked correct — because none of it ever ran. The date input carried
`min={week[6]}`, so Chrome rejected the submit before React saw the event. A
constraint written in JSX as an attribute is enforced by the browser, silently,
with a tooltip we neither wrote nor can style, and it produces exactly the
symptom of a broken feature while leaving no trace anywhere we look.
Rules:
- A customer's screenshot of a validation message: first ask whose message it
  is. Native ones are grey-on-dark bubbles pointing at the field, and their
  wording is the browser's, not the codebase's — grep the string; no hit means
  it is not ours.
- Before debugging a form that "does nothing", read its `min`, `max`, `step`,
  `pattern`, `required` and `type`. `type="number"` on a field someone types
  "8,500" into is the same class of bug.
- Same shape as the `.thumb-del` positioning bug: the feature was present and
  correct, and something outside the logic stopped it reaching the user.

Corollary, from the fix: widening the seven-day list to show older entries broke
a round-23 assertion that counted every `.step-day` in the card. The assertion
was right about what it meant and wrong about how it selected. Give a new
section its own class (`.step-week`, `.step-earlier`) and scope the old
assertion to it — never re-scope by `nth-child`, which breaks again the next
time anything is inserted.

## RLS does not restrict COLUMNS (2026-09-12)
`profiles_update_own` is `USING (id = auth.uid())` and looked like a tight
policy. It is not a policy about columns, because RLS has none: it decides which
ROWS you may touch, and `authenticated` held table-level UPDATE, so a client
owned every column of their own row. From the browser console they could set
`membership_tier` (self-upgrade to the paid tier), `role = 'trainer'`, and
`trainer_id` — and `my_trainer_id()` reads that last one, with every
coach-content policy keyed off it. Proven: a client of one gym repointed and
read another gym's recipes by name. In a white-label product sharing one
database, that boundary IS the product, and nothing tested it.
Rules:
- A row-level policy plus a table-level grant means the user owns the whole row.
  For any column only the server should set, use column GRANTs. You cannot
  revoke one column out of a table-level grant: revoke the table, grant the
  allowed columns back. The allow-list then locks new columns by default, which
  is the behaviour you want.
- Coach-controlled fields already had the right shape here (`set_member_tier`,
  `set_step_target`, `set_client_dob` — SECURITY DEFINER RPCs). The hole was
  that the RPC was the polite route, not the only one.
- Write the test BEFORE the migration and watch it fail. Six assertions failed,
  the grant went on, the same six passed. That ordering is what makes it proof.

## A negative security assertion needs a control (2026-09-12)
The isolation test above passed on its first run for three separate wrong
reasons, and each would have shipped as "verified".
- `trainer_id` was set to an all-zeros uuid. The write was refused by a FOREIGN
  KEY, not by permissions, and the test read that as "blocked". Use a real
  target.
- "cannot read the other coach's recipes" passed because that coach had no
  recipes. Any query returning nothing satisfies a no-leak assertion. Add a
  control that MUST return rows — here, the same query against the client's own
  coach — so an empty result means isolation rather than an empty table.
- The test restored the columns it was allowed to write and left the ones it had
  just proven it could break: a demo account sat on `role='trainer'`,
  `active=false`, `trainer_code='HACKED'`. A test that can change something must
  restore it and then ASSERT the restore landed, or it is an attack with a
  tidy-up intention.

## The britfix hook edits files after you write them (2026-09-21)
A global hook rewrites American spellings to British in any file written through
the Write/Edit tools. Writing `src/callisthenics.js` came back with its first
comment reading "Callisthenics", and a `\n` inside a JS string literal in
`programme-generate.mjs` came back as a REAL newline, which is a syntax error the
build reports miles from the cause.
- It only touched comments here. It does not know the difference between prose
  and an identifier, so a rewrite of `features.callisthenics` or a session key
  would silently switch the feature off with everything still compiling.
- After writing a file through the tools, `node --input-type=module -e "import(...)"`
  it, or grep for the identifier you care about. The build alone did not catch
  the newline: only importing the function did.
- Prefer template literals over `\n` escapes in strings that get written this way.

## A feature flag is not a route (2026-09-21)
The calisthenics tile went into TrainHub first, which looked right — every other
training screen is listed there. TrainHub only renders for brands that define
`nav` in themes.js, which is Paul and Elev8. Rick.Fit and Lennon use
DEFAULT_NAV, so the tile was live, flagged on, and unreachable.
`homeTileDefs` is the list that every brand actually reads. Check which of the
two a brand uses before deciding a screen is wired up, and drive it in a browser
on the brand that asked for it — the build passes either way.

## A feature flag is not a route — the second time (2026-10-04)
Already written down on 2026-09-21 after the calisthenics tile went into
TrainHub, which Rick.Fit never renders. Repeated anyway: the notification
settings screen had exactly one way in — an inline "Level 2 · adjust" link
inside the coach's check-in card on Home — and I told Ricky to look in the Train
tab. There was nothing there, or anywhere.
- Shipping a screen means shipping the tap that reaches it, on the brand that
  asked for it. `homeTileDefs` is what Rick.Fit and Lennon actually read;
  TrainHub only exists for brands with a `nav` key (Paul, Elev8).
- Before telling anyone where to find something, open it the way they would:
  sign in on that brand and click through. A one-minute browser check would have
  caught both of these.
- Writing the lesson down is not applying it. This one goes in the pre-ship list,
  not the archive.

## A silent installer is a blocked installer (2026-10-08)
`winget install` for the JDK ran for over ten minutes in a background shell and
produced zero bytes of output and nothing on disk. It was not slow. A
machine-scope MSI wants UAC, and in a non-interactive session that prompt is
invisible and waits forever.
- Zero output plus no artefact is a block, not progress. Downloads print
  progress; a stalled elevation prompt prints nothing at all.
- Prefer the zip over the installer for dev toolchains. Temurin and the Android
  cmdline-tools both ship as plain zips that extract to a user directory, need
  no admin, and leave the machine's PATH alone.
- Kill the stalled task before switching approach, or it sits there holding a
  lock on whatever it half-created.

## The native shell is a different origin (2026-10-08)
The Capacitor build runs on `https://localhost`, so every call to
app.redefineacademy.com is cross-origin. Ten endpoints already set CORS; the
other eight the client calls never needed it, because the web app is same-origin
and nothing ever preflighted them.
- Barcode scan, meal and fridge scan, food search, Strava and push test would
  all have failed on Ricky's phone with nothing in the UI to explain why.
- Found it by probing production with curl and an `Origin: https://localhost`
  header — not by reading the code and reasoning about it. Four lines of curl
  settled what an afternoon of reading would have left as a guess.
- Generalises: anything that quietly assumed same-origin breaks only once it is
  running on a phone. Check it before each native phase, not after.

## A function declaration silently eats a prop of the same name (2026-10-08)
`FoodSearch({ onLog, pick })` also declared `function pick(f)`. Function
declarations are bound when the scope is instantiated and overwrite the
parameter, so `pick` was always the function, always truthy. Every client
logging food got the ingredient-picker variant — no Meal, no Day, a button
saying "Add to recipe" — and the prop could not be reached from outside.
- It builds clean, lints clean and reads fine. Nothing points at it.
- Shipped the same day as the feature that introduced the prop, so the obvious
  suspect was the new feature's logic rather than its name.
- The test is a guard on the CLASS, not the instance: scan every component for
  a function declaration colliding with one of its own destructured props
  (`tasks/e2e_round42.mjs`). Clean across 80 files once fixed.
- Naming the handler after the prop is the trap. `choose()` for the action,
  `pick` for the mode.

## Verify the exit code you think you are reading (2026-10-08)
Ran `npx vite build | tail -5 && echo "BUILD OK"` and reported a successful
build. `&&` tests `tail`, which always exits 0, so "BUILD OK" printed over a
build that had actually failed on a syntax error I had just introduced.
- `${PIPESTATUS[0]}` is the one that matters in a pipeline.
- The file had a raw newline inside a single-quoted JS string, which is a hard
  syntax error — exactly the heredoc escaping trap already written down below.
  Use the Edit tool for anything containing backslash escapes; the lesson was
  on this page and I did it anyway.

## `<input type="number">` inside a form is a silent submit blocker (2026-10-12)
Alanna McCann told Paul her check-in "doesn't actually submit". It didn't: the
Supabase edge logs show her opening the form at 10:55:12 and no POST to
`checkin_responses` at all. Run server-side as her, RLS and the grants allowed
the insert — so the form never asked.
- A browser will not submit a form containing an `:invalid` field. Paul's
  template has two `number` fields; `<input type="number">` with no `step`
  defaults to `step=1`, so **8.5** is a step mismatch and **"10,000 steps"**,
  **"12-15"** and **"-"** are `badInput`. Each blocks the submit behind a
  validation bubble that is easy to miss on a phone.
- Worse, `"3 or 4"` is silently kept as `34`. Valid, submitted, wrong.
- The fix is free text with `inputMode="decimal"`, parsed by us, plus
  `noValidate` on the form. Then nothing the client types can stop the send.
- **Proving it needs real key presses.** `input.value = '10,000 steps'` is
  sanitised to `''` and the field stays VALID — a programmatic test reports no
  bug at all. `tasks/e2e_round43.mjs` drives Chromium with
  `pressSequentially`, and the positive control is that the OLD markup must
  still fail.
- The second half of the same bug: `const { data } = await ...insert()` threw
  the error away and printed "Sent ✓" regardless, so a check-in that never
  saved was indistinguishable from one that did — to her AND to Paul. Same
  shape as the food-queue bug of 15 Sept. Check `error`, keep the answers.

## An upstream API error is for the log, never for the customer (2026-10-12)
The Anthropic account ran out of credit. Six call sites did
`data?.error?.message || 'Claude API error.'`, so every AI screen on Paul's
site showed his paying clients *"Your credit balance is too low to access the
Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."*
Our billing problem, verbatim, inside their coaching app.
- `upstreamMessage()` in `_auth.mjs` now logs the real message and returns
  something safe. `e2e_round43.mjs` asserts no response body ever matches
  /credit balance|Plans & Billing|api.key|anthropic/i.
- It also hid the diagnosis for an hour: `recipe-ai` swallowed the same error
  into "Couldn't read that recipe", which reads as a bad URL rather than an
  outage. An endpoint that calls a paid API should say WHICH kind of failure it
  had — the error `type` is enough, and gives nothing away.
- A green LLM test on Tuesday says nothing about Thursday. Round 42 passed 18/18
  on 10 Oct and 9/18 today without a line of its code changing.

## A positional lookup table has no safe "just add a row" (2026-10-13)
`src/rickFitVideos.js` maps exercise name -> clip by POSITION: entry *i* is
`rick_fit_(i+1)`. To make `Calf Raise` resolve I appended a new row that
repeated a name already on an earlier row. Nothing warned me, and
`new Map(...)` keeps the LAST value for a duplicate key — so the *working*
`Standing Dumbbell Calf Raise` demo would have started pointing at an id with
no clips. The feature I was adding would have broken the one next to it.
- `tests/rick-fit-videos.test.mjs` caught it, because it asserts every exercise
  resolves to its OWN clips rather than just counting views.
- An extra name for an existing thing goes INSIDE its existing row. The comment
  above the table now says so.

## A test asserting something resolves to NOTHING is a decision, not a gap (2026-10-13)
I "fixed" two missing aliases — `Calf Raise` and `Triceps Pushdown (cable)` —
and the video handoff's own test failed, because it explicitly asserts both
resolve to zero clips. That exclusion was deliberate: the generic names are just
as likely to mean the seated calf machine and a straight-bar pushdown, and
showing the dumbbell or rope version would be the wrong equipment.
- Reverted both and put them to Ricky as his call, in
  `tasks/rick-fit-video-gaps.md`. A passing test going red on a change I was
  confident about is evidence about the change, not about the test.
- Generic-to-specific aliasing is only safe where the movement has effectively
  one common form (`Plank`, `Leg extension`), not where the equipment varies.

## Persisted data with un-persisted inputs goes stale silently (2026-10-13)
`MealPlan.jsx` saved the week to `localStorage` but kept the answers it was
built from — allergies, dietary requirements, meals per day — in plain
component state. After a reload the week came back on screen with the form
blank behind it, so the next swap or recipe request went off with
`allergies: ''`. A vegetarian week could come back with chicken in it, and an
allergy could be reintroduced by the app that had just been told about it.
- If you persist a result, persist the inputs that produced it, and restore
  both. Anything that regenerates part of that result later depends on them.
- Data saved before the fix has neither, so it now says so on screen rather than
  acting on blanks.

## Verify AI paths on a draft deploy, not by fetching the key (2026-10-13)
The local env file holds a placeholder `ANTHROPIC_API_KEY`, so every model call
in `netlify dev` 401s. Pulling the real key out of Netlify was refused as
credential materialisation — correctly.
- `netlify deploy` without `--prod` gives a draft URL that runs the functions
  with the key server-side. Test there, then promote that exact deploy by id
  (`netlify api restoreSiteDeploy`) so production gets the bytes that were
  tested rather than a fresh build.
- Also: `netlify dev` cannot start while vite's port is held (strictPort), which
  happens whenever an older session left one running. `--target-port 5220` plus
  a `--command` that merely blocks reuses the running server instead of killing
  someone else's process.

## The working tree may hold another session's work (2026-10-13)
`git status` showed uncommitted changes to `src/App.jsx` and `src/lib.js` that
were not mine — a finished tappable-links feature from a parallel session. My
`npm run build:ricky` picked them up, so promoting my deploy shipped their
unreviewed work to rick-fit as well.
- Check `git status` BEFORE building for a deploy, not just before committing.
  Commit only your own paths, and say what else rode along.

## When you split on a pattern, decide from the match, not from the text

`linkParts` split a note on a URL pattern and then decided which runs were
links by re-testing each run with `/^https?:\/\//`. A run of ordinary text can
itself begin "https://" without being an address, so "https:// is a prefix"
came back as one link covering the whole sentence. The split told me where the
matches were and I threw that information away, then guessed it back.

Walk the matches (`matchAll`) and slice the text between them. The type of each
run is then a fact, not an inference.

Found by my own test on 13 Oct, not in review — the case was in the list
because it looked silly, which is the best reason to put a case in a list.

## A test that demands exactness from two AI calls will cry wolf

`e2e_round42` asserted that asking for 2 servings and 4 servings agreed to
within 2 kcal. It failed on 13 Oct at 660 vs 322x2 and sent me looking for a
regression in a change that had touched three files, none of them on that path.

The division by servings is exact and is done in code. But the two numbers came
from two separate calls, each recalling its own per-100g figures, so the TOTALS
differed before anything was divided. The assertion was testing model
determinism while its label claimed arithmetic.

Before loosening a flaky assertion, work out which half of it is wrong. Here
the code was right and the claim was wrong. Had it been the other way round,
loosening it would have buried the bug.

## A URL allowlist does not stop an SSRF, because fetch follows redirects

`recipe-ai` fetched whatever URL it was handed. The obvious fix — only allow
known recipe hosts — would have been worthless on its own: Node's `fetch`
follows redirects by default, so an allowed host can answer 302 to
`http://127.0.0.1/` and the request goes there. The allowlist only ever sees
the first address.

What actually closes it is `redirect: 'manual'` plus re-validating every hop,
and resolving the hostname first and checking EVERY address it returns, not the
first. `::ffff:127.0.0.1` and `64:ff9b::169.254.169.254` are loopback and cloud
metadata wearing an IPv6 coat, so the address rules have to understand those
forms too.

The test worth having is not "a private address is blocked". It is "a PUBLIC
page redirecting to a private one is blocked, and the second hop is never
requested" — `tests/fetch-page.test.mjs`.

## The server half of an auth change is the easy half

Adding `requireUser` to nine endpoints took minutes. The work was everywhere
else: twelve browser call sites that had never sent a token, four endpoints
whose CORS answered the preflight so badly that adding an `Authorization`
header would have had the browser refuse the call before it left the device,
two e2e scripts that would have gone red, and installed PWAs that keep running
a resumed bundle for days and would have met a 401 they could not fix.

So the phase is a per-site env var (`AI_AUTH=observe`), not a second code
change — the client half lands everywhere first, and enforcing becomes a config
decision per brand that can be reverted in seconds. Default to enforce,
including when the variable is unset: `coach-notify`'s hole lasted ten days
precisely because it failed open and so stayed quiet.

## Prove a refusal AND prove you did not break permission

`tasks/e2e_auth_refusals.mjs` proves every endpoint says no to an anonymous
caller. It cannot prove the app says who it is, because that needs a real
logged-in browser — and a missing `Authorization` header fails at no build step
and in no test, it fails as "the AI has stopped working" on somebody's phone.

`tests/api-auth-callsites.test.mjs` is the static half of that: it walks `src/`
for fetches to the gated endpoints and asserts each one carries the header. Then
I broke one call site on purpose to check the test went red, because a guard
that cannot fail is not a guard.

## Do not reach for a password to finish a verification

The success path needed a session token. The documented seeded test account
would have produced one, and the pull to use it was strong — the alternative was
reporting an unverified gap.

It is still a password, on a production Supabase host, and that is not mine to
type. The honest move was to close as much of the gap as could be closed
without one (a static call-site guard, and a mutation test proving it bites),
then name the exact remaining step and who can take it. Reaching for the
credential would have made a complete-looking report out of a rule quietly
broken.

## Inserting an import after "the last import line" breaks a multi-line import

A script that found the last `/^import .*$/m` and inserted after it put a new
import INSIDE `ClientApp.jsx`'s multi-line `import {` block, and the build died
with "Expected 'as' but found '{'". Nine other files were fine, which is what
made it look like a safe pattern.

Anchor on the END of the import block (`} from '...'`), or on a line that is
unambiguously a complete statement. And run the build before the deploy, not
after — this cost one cycle and would have cost a broken draft.

## A row restricted TO someone is not a row they should be able to write

`coach_usage` counts a client's AI calls against a daily ceiling. Its policy was
`ALL using (client_id = auth.uid())`, which reads like textbook RLS and meant
the person being rate-limited could UPDATE their own counter to zero from the
browser console. The limit was decoration.

This is the second time the same mistake has appeared in this schema. In
September it was `profiles`: a client could rewrite their own `trainer_id`,
because the row was theirs. The question to ask of an `ALL` policy is not "whose
row is this" but "would I let them write every column of it". A counter, a
status, an owner link and an audit trail are all rows that belong to someone and
that they must not be able to write.

Found by reading `pg_policies`, not by reading the app.

## Three round trips is not a counter

The same function read the count, added one, and wrote it back. Netlify runs
many concurrent short-lived instances and a week-long meal plan fires nine calls
at once, so several read the same number and all wrote the same number back:
nine calls counted as one. The ceiling leaked in both directions at the same
time — resettable by the user AND undercounting.

`insert ... on conflict do update set calls = calls + 1 where calls < limit
returning calls` is the whole thing, atomic, in the database. The conditional
`WHERE` on the DO UPDATE is what makes the ceiling atomic too, not just the
increment. Watch the one case it cannot see: a brand-new row has no conflict, so
a limit of zero still allows the first call unless it is guarded separately.

## revoke execute ... from anon does nothing on its own

Postgres grants `EXECUTE` on a new function to `PUBLIC` by default, and `anon`
inherits that. Revoking from `anon` by name leaves the PUBLIC grant in place, so
the function stays callable and the revoke looks like it worked.

Name `PUBLIC` in the revoke, then grant to the roles that should have it, then
prove it with `has_function_privilege('anon', oid, 'EXECUTE')` rather than
believing the statement that returned no error.

This is also why Supabase's advisor lists dozens of functions as anon-executable
at once: it is one default, not dozens of decisions. Do not bulk-revoke in
response — the cron senders call those RPCs with the publishable key, as anon,
and they already fail closed on a secret check.

## An audit has to write down what came back clean

Nine `p_client` setters, five id-taking functions, nineteen secret-takers and
five tables' policies were checked and only one was wrong. Recording only the
finding would mean the next person re-derives all of it, or assumes the rest is
unchecked and either panics or ignores it.

The clean list is the deliverable as much as the fix is — and it has to say what
was actually verified. "References auth.uid()" is not "scoped by auth.uid()": a
function can mention it and still `delete where id = p_id`.

## Ask what a session is actually worth before calling an endpoint closed

I authenticated ten AI endpoints, proved 60/60 refusals on a real deploy, and
was about to report the credit-spend hole closed. Then: what does it cost to get
a session? Signup is open on this project, email confirmation is off, and
`handle_new_user` reads the role from `raw_user_meta_data->>'role'` — which the
client supplies, via the app's own "I'm the coach" button. One POST to
/auth/v1/signup returns a trainer session that satisfies both the gate and the
coach-only check.

So the pass bought attribution and a place to hang a ceiling. It did not buy
unreachability. "Authenticated" is only a barrier if an account is expensive,
and an account was free.

The honest table is anonymous/untraceable/unlimited becoming
attributable/logged/capped. Writing "closed" would have been the most damaging
sentence in the whole piece, because it would have stopped anyone looking.

## RLS does not restrict TRUNCATE

Supabase's default grant hands `TRUNCATE` to `anon` and `authenticated` on every
table, and a policy saying "your own row" is no defence against emptying the
table. It was on all 80 here.

Not reachable through PostgREST, which has no TRUNCATE verb — so latent rather
than live, and worth saying which it is instead of either panicking or
shrugging. Revoked, since nothing truncates anything. A freshly created table
gets the default back, so the revoke belongs in the migration that creates one.

## Verify a fail-open counter against the real thing, in a transaction

Both usage counters fail open on purpose: a broken ceiling must not take every
AI feature out across five brands. The cost of that choice is that a counter
which never counts is indistinguishable from one that works — the app keeps
answering either way, which is the quiet-failure pattern three other lessons
here already name.

`begin; set_config('request.jwt.claims', ...); set local role authenticated;
<call it three times>; rollback;` proved the conditional DO UPDATE and the
`returning into` going null at the ceiling, against the live schema, with
nothing persisted. Unit tests with a stubbed fetch could never have caught a
wrong ON CONFLICT clause.

## A blocker is worth re-checking once the facts are in

I parked the `coach_usage` revoke as "after the brand rollout", because the
helper fails open and revoking under a brand still doing its own read-add-write
would leave it with no limit at all. Sound reasoning, wrong precondition: the
coaching engine is gated on `features.coach`, set for Rick.Fit only, so the old
code on the other four brands has no callers and there was nothing to fail open.

One grep of `themes.js` turned a parked item into a done one. Before deferring
something behind a rollout, check the rollout actually applies to it.

## 403 to curl, 200 to a browser, is a finding in itself

Both Tesco and Asda refused a plain HTTP client with 403 and served a real
browser 200 on the identical URL. That one asymmetry answered three questions at
once: the URL shape was fine all along (so the 403 proved nothing about it), the
sites are edge-protected against non-browser callers, and anything server-side —
including a Netlify function — is a dead end rather than merely a terms-of-service
problem.

Worth the two minutes before designing around a 403. It also means a URL shape
can only be verified in a real browser, which is why the test file says so
rather than pretending the assertion covers it.

## There is no UK grocery basket API, and the vendors are not hiding one

Tesco's developer programme was retired years ago; Asda never ran one. Every
product that claims to fill a UK basket — Pepesto, and the reverse-engineered
projects behind it — does the same thing: drives the retailer's own site with the
shopper's logged-in session. There is no secret endpoint to find. What a vendor
actually sells is maintaining that treadmill across 27 retailers, which is also
the reason not to start it: the app would be holding a credential that can place
orders on a card-linked account.

So the shopping list hands OVER to a search instead. Writing down why in
`src/shopLinks.js` matters more than the code does, because the next person to
look at this will otherwise spend the same afternoon finding the same nothing.

## A link inside a `<label>` ticks the checkbox

Each shopping line is a `<label>` wrapping the tickbox and the text, which is
right — tapping anywhere on the line ticks it off. Putting the supermarket button
inside that label would have made "go and buy this" also mean "I already have
this", and the tick is how they know what is in the trolley. The button is a
sibling of the label, not a child, and the comment in `MealPlan.jsx` says why so
nobody tidies it back in.

## A price key is a FOOD, so it cannot stand in for a product

The shopping list's price keys come from a tagging step told to match "by FOOD,
ignoring brand and preparation". That is right for pricing and wrong for buying:
"gluten-free pasta" is tagged `pasta`, "oat milk" is `milk`, halal chicken is
`chicken-breast`. A search link survives it, because the line's own words go to
the shop. A product link throws them away, and the product's NAME would not warn
anyone, because wheat pasta is not called anything.

So product links need three things to agree: the week has answers on file, those
answers name no dietary requirement and no allergy, and the line itself does not
name its own version of the food. Any one missing and it stays a search. It is
the same failure MealPlan.jsx already guards in another place — the app putting
back the allergy it had just been told about.

## "Add the top search result" would have bought adverts

Asda's first result for "semi-skimmed milk" is Sponsored: Arla 2L at GBP 2.50,
with the own-label 2 pints at GBP 1.20 further down. So any auto-fill built on
"search, take the first hit" quietly buys the ad and inflates the shop. It is
also the argument FOR a hand-kept product table rather than against it.

## Verify a hand-kept table against the thing it names

Sixty product rows were read off results pages, then every id was opened and its
page title compared to the name stored beside it. One mismatch came back — a row
I had shortened to "Tesco Red Onions 1kg" when the product is "Tesco Red Onions
Pack 1Kg". Nothing else would have caught that, and the name is the bit the app
shows the client as a promise about what they are about to add.

Own-label naming is not a reliable signal either: Asda's plain bag of carrots is
"ASDA Crunchy & Sweet Carrots 1kg", so "&" cannot be used to spot a variant the
way it can at Tesco. The guard test checks shape, plausible pack sizes, and that
every key is a real price key; the browser check is what proves the ids.

## Ask where the user actually is before building the clever version

Two days went into working out how to press Add in Ricky's logged-in browser:
which store pages name the product on the button, how to tell a login bounce
from a real page, how an extension survives a navigation. All of it correct, and
all of it pointless, because he shops on his phone. Chrome on Android and iOS
runs no extensions at all, the Tesco app is sealed, and the app's session is not
the mobile browser's session, so none of the three ways in exist there.

What works, and already shipped weeks before any of that: sign in to the shop in
the PHONE browser once, then every pack link on the shopping list opens the
product and Add is one tap. The basket is held against the account, so items
added in the mobile browser are in the native app's basket when he goes to book
a slot. Fifteen taps for a fifteen-item list, nothing installed.

The phone was also the right place for a second reason that should have been the
tell: the week lives in the phone PWA's localStorage. The desktop extension
needed a whole extra mechanism just to get the list to where it was running.
When the plan needs a bridge to reach the data, check whether the data is
already sitting next to the user.

Worth keeping from the dead end: "search, take the first hit" buys sponsored
products (see above), and both shops bounce a signed-out Add to a login page, so
nothing server-side can ever touch a basket.
