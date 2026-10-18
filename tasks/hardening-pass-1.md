# Hardening pass 1 — closing the open AI endpoints

Started 14 Oct 2026, against `tasks/hardening-plan.md` item 1.

## The hole

Nine Netlify functions call `api.anthropic.com` on Ricky's key with **no caller
identity at all**. Anyone who finds a URL can spend his credit from a browser
console, in a loop, forever, and there is no record of who did. On 12 Oct the
account ran out of credit and Paul's paying clients read our billing message on
every AI screen; with nine anonymous endpoints there was no way to tell who had
spent it.

## Why this is not a one-line change per file

The functions are only half of it. Every call site in the browser has to start
sending the session token, and those two halves cannot land in the same instant:

- An **installed PWA that is resumed** keeps running the bundle already in
  memory, for days (`src/UpdatePrompt.jsx` exists because of exactly this). A
  server that starts demanding a token in the same deploy that teaches the
  client to send one returns 401 to every cached client until it reloads.
- Four of these endpoints have **no OPTIONS handler and no
  `access-control-allow-headers`**. Adding an `Authorization` header turns a
  simple request into a preflighted one, so the native shell — which runs on
  `https://localhost` and is cross-origin to everything — would have its calls
  refused by the browser before they ever left the device.

So this lands in two phases, and the phase is a **per-site env var**, not a code
change. `AI_AUTH=observe` accepts a token and tolerates its absence;
anything else (including unset) enforces. Enforcing is the default on purpose:
a site nobody configured is protected, and the tolerance has to be asked for.

| Phase | What ships | Where |
|---|---|---|
| 1 | Clients send the token · CORS + OPTIONS on every endpoint · servers accept but tolerate | Safe on all brands |
| 2 | `AI_AUTH` removed, so the server enforces | Rick.Fit first; the other four after a refresh window, with Ricky's say-so |

The native APK is Phase 1 of `tasks/native-app-plan.md` — a debug-signed
sideload, in nobody's hands but ours. It does not gate enforcement. Its CORS
needs are still honoured, because the next native build would otherwise fail
silently in exactly the way that plan warns about.

## What each endpoint gets

| Function | Guard | Note |
|---|---|---|
| `analyze.mjs` | authenticate | Vision. Dearest per call, most callers. |
| `program-generate.mjs` | authenticate | Called by a client screen too (`BuildMyProgram`), so not coach-only. |
| `program-edit.mjs` | authenticate + **coach** | `TrainerApp` only. |
| `recipe-generate.mjs` | authenticate + **coach** | `TrainerApp` only. |
| `recipe-ai.mjs` | authenticate + **URL fetch fenced** | See below. |
| `equipment-scan.mjs` | authenticate | Vision. |
| `exercise-guide.mjs` | authenticate | Writes a shared cache; any signed-in user may read one. |
| `exercise-swap.mjs` | authenticate | |
| `barcode.mjs` | authenticate | Only the photo path spends model budget, but the gate is on the whole endpoint. |
| `meal-plan.mjs` | authenticate | `method` already did; the other five actions did not. |

Auth is checked **before the body is parsed**, so an anonymous caller cannot map
the body rules by reading the 400s. `tasks/e2e_meal_recipes.mjs` already asserts
this for `meal-plan`; the new refusal script asserts it for all of them.

## `recipe-ai.mjs` fetches whatever URL it is handed

That is a server-side request forgery shape, and it is worse than it looks: a
host allowlist alone does not fix it, because Node's `fetch` follows redirects,
so a page on an allowed host can bounce the request to `127.0.0.1` or
`169.254.169.254`. The Lambda runtime API itself sits on loopback.

`netlify/functions/_fetchPage.mjs` therefore does all of:

- https only, no other scheme
- `redirect: 'manual'`, re-validating every hop, at most 3
- DNS resolution up front, refusing loopback, private, link-local, CGNAT and
  unique-local addresses
- an AbortController timeout
- a byte cap on the streamed read, so a 2 GB file cannot be pulled through

Residual risk, stated rather than papered over: validating the resolved address
and then calling `fetch` leaves a DNS-rebinding window, because the second
lookup is the one that is used. Closing that needs connecting to the checked IP
with a `Host` header, which is a bigger change than this pass. The window is
narrow and the prize is a page body fed to a model, not a credential.

## Rate limiting: deliberately NOT switched on here

`withinDailyLimit` counts against one `coach_usage` row at 120 calls a day, and
coach chat already spends from it. A single week-long meal plan is about nine
calls. Wiring nine more endpoints into that one ceiling would turn a busy
Sunday into "the coach has stopped answering", which is a worse bug than the one
being fixed. Authentication is the part that removes the anonymous abuse; the
limit becomes *possible* with this pass and is left for a sitting of its own,
which needs its own counter and a look at whether RLS lets a client UPDATE their
own usage row (if it does, the limit is advisory anyway).

## How it is verified

`tasks/e2e_auth_refusals.mjs` walks every endpoint and asserts, against a real
deploy:

- no token → 401
- a junk token → 401
- an empty body → 401 (auth before validation)
- `OPTIONS` → 204 with `authorization` in `access-control-allow-headers`

The success paths are not re-tested from a script with somebody's password. The
meal-plan e2e scripts take a token from `E2E_TOKEN` and skip their success
assertions when it is absent, so they stay honest instead of passing vacuously.
Nothing writes to a food diary and no production account is signed into.

## Phase 1 on a brand that is not Rick.Fit — the exact procedure

Verified facts this rests on: **no site auto-builds from the repo**
(`build_settings.repo_url` is empty on all seven), so pushing to GitHub deploys
nothing and the only way enforcement reaches a brand is somebody running a
deploy for that site. The brands and their site ids:

| Brand | Site | id |
|---|---|---|
| Rick.Fit | rick-fit | `8c3924ca-1d69-46ad-b211-c10229216882` |
| Coached by Kim | coached-by-kim | `08a2f0ba-f0a8-4ee9-80f5-cd314abacce3` |
| ReDefine (Paul) | redefine-academy | `bda91296-2224-4923-b91c-d6482971eab1` |
| ReDefine coaching | redefine-academy-coaching | `380c0cdc-d7d7-4e80-b12e-2c7533291584` |
| PPH (Jordan) | the-physical-performance-hub | `5e998585-cfd2-4e16-a272-b5ceac659c95` |
| Elev8 | elev8-hyrox | `a7852fc7-7d64-429c-a9d5-041084399b9d` |
| Elev8 landing | elev8-landing | `aba10137-4e67-4777-9a3a-91525f16f54b` |

1. **Set the variable BEFORE the deploy**, through `netlify api` with an
   explicit `site_id`, and read it back:

       npx netlify api createEnvVars --data '{"account_id":"698094fd72d00ee4b3786542","site_id":"<id>","body":[{"key":"AI_AUTH","scopes":["builds","functions","post_processing","runtime"],"values":[{"context":"all","value":"observe"}]}]}'
       npx netlify api getEnvVars --data '{"account_id":"698094fd72d00ee4b3786542","site_id":"<id>"}'

   The payload key is **`body`**, not `env_vars`. This document said `env_vars`
   until 18 Oct 2026, when the command was run against Paul's site for the first
   time and the API answered `JSONHTTPError: Bad Request` with nothing else. The
   CLI passes an operation's request body under `body`, and anything else is
   simply dropped, so the call is well-formed JSON describing no env var at all.
   Give the full four scopes too: every other variable on these sites carries
   `builds, functions, post_processing, runtime`, and `["functions"]` alone was
   the other half of the guess.

   NOT `netlify env:set --site`. That flag was ignored once and set Kim's BRAND
   to another brand's value — see CLAUDE.md. Use `deleteEnvVar` +
   `createEnvVars` to change one.

2. **Deploy with `--skip-functions-cache`.** A new env var does not reach
   functions otherwise; that is a known trap in this account
   (`netlify-cli-stale-function-env`). Build with the brand's own script first,
   or the site ships Kim's branding.

       npm run build:<brand>
       npx netlify deploy --dir=dist --site=<id> --skip-functions-cache

3. **Prove observe is actually observing**, on the draft:

       node tasks/e2e_auth_refusals.mjs https://<draft>--<site>.netlify.app

   Expect it to report **STILL OPEN on all ten**. That is the pass condition
   for this step, not a failure. If it reports 401s, the variable did not reach
   the functions and the deploy would enforce — stop.

4. Promote the tested draft with `netlify api restoreSiteDeploy` (a direct
   `--prod` gets a 403 on this account).

5. **Wait, then read the logs.** Every anonymous call now logs
   `ai-auth observe: anonymous call allowed <path>`. When a brand's functions
   stop producing that line, every client on it has reloaded onto a bundle that
   sends the token, and enforcing is safe. That is a measurement, not a guess
   about how long a week is.

6. **Enforce** by deleting the variable and redeploying with
   `--skip-functions-cache`, then run the refusal script again and expect
   60/60.

## The landmine, and where the warning lives

The code default is enforce. That is the right default for security and the
wrong one for a surprise deploy: a session that deploys Kim, Paul, PPH or Elev8
for an unrelated fix turns enforcement on for paying clients with no refresh
window. The warning therefore sits in `CLAUDE.md`'s deploy section, which is
what a deploying session actually reads, not only here.

## What is NOT closed

- **Production is still open on every brand.** This commit changes code, not
  exposure. All brands share one Anthropic key, so until the LAST site enforces,
  the credit-spend hole is reachable through whichever site still has the old
  functions.
- **The success path has not been driven by a logged-in browser.** The refusals
  are proven on a real deploy and the call sites are checked statically; what is
  unproven is a real session going all the way through. That needs the Chrome
  extension connected, or one tap in the app.
- **The full-week shopping list has no running guard** until somebody supplies
  `E2E_TOKEN`. `tasks/e2e_meal_week_stress.mjs` now skips rather than passing
  vacuously, which is honest but is not cover.

## Deploy state as of 14 Oct 2026, 22:40 — read this before starting Phase 1

All four client brands were rebuilt and deployed from one commit, **`dd54cac`**,
which is the last commit BEFORE `9765f90`. This was deliberate: Paul had chased
his fixes twice and they had been stuck in an unpromoted draft since 9 Oct, and
deploying HEAD would have switched enforcement on for clients whose installed
PWA had not reloaded.

So `AI_AUTH` was NOT set on any site, and did not need to be. The code in all
four deploys predates enforcement entirely — the endpoints accept anonymous
calls and the client half does not send a token yet. Verified per site by an
unauthenticated POST to `analyze` returning HTTP 200.

| Brand | Site id | Deploy | State |
|---|---|---|---|
| paul | `bda91296-2224-4923-b91c-d6482971eab1` | `6acff9eb4c7a993adc4d6cf7` | PROMOTED 22:00 |
| elev8 | `a7852fc7-7d64-429c-a9d5-041084399b9d` | `6acffe0e3593ef37bdd36e92` | draft |
| pph | `5e998585-cfd2-4e16-a272-b5ceac659c95` | `6acffe487c2ac991ced7d9bb` | draft |
| kim | `08a2f0ba-f0a8-4ee9-80f5-cd314abacce3` | `6acffe87c05acdcdc3775d99` | draft |

**What this means for Phase 1.** The observe window has not started on any of
these four. When Phase 1 ships, it has to ship the client half and the
tolerant server half together, exactly as this document already says — none of
these deploys has either. rick-fit is unaffected and still enforcing.

**`coach-notify` is new to kim, pph and elev8** (it arrived 4 Oct, their last
deploy was 15 Sept). It carries `export const config = { schedule: '7 * * * *' }`
so it will start running hourly on each. It is inert: `COACH_NOTIFY_ENABLED` is
unset on all three AND on Paul's, so `dryRun` is true and it decides without
sending. Only rick-fit has it `true`. Do not set it on a client brand without
reading a dry run first.

The old cross-brand nudge functions (`push-reminders`, `push-daily-reminder`,
`push-coach-alerts`, `push-coach-digest`, `push-food`, `push-workout`) were
already on Kim's 15 Sept deploy, so this changed nothing about them. They are
still the hazard described at the top of `coach-notify.mjs`.

## The database side is ALREADY live on every brand — 15 Oct 2026

Worth knowing before reading the deploy table above and concluding that nothing
has changed for the four client brands. The schema is shared by all seven sites,
so these landed everywhere the moment they were applied, regardless of which
commit a site is deployed from:

| Change | Effect on a brand still running `dd54cac` |
|---|---|
| `ai_usage` + `ai_usage_bump`, 200 calls a day (`migration_ai_usage_counter.sql`) | None. Pre-auth code does not call it. The ceiling starts applying to a brand when Phase 1 ships there. |
| `coach_usage` part 2 — `ALL` policy dropped, direct write revoked | None. The coaching engine is gated on `features.coach`, which is Rick.Fit only, so the old `coach.mjs` on those four has no callers. `withinDailyLimit` fails open regardless. |
| `TRUNCATE` revoked from `anon`/`authenticated` on all 80 tables | None. Nothing in the app truncates anything, and PostgREST has no TRUNCATE verb. |

**And the reason the ceiling exists at all**, which changes how Phase 1 should be
read: authenticating these endpoints does **not** make them unreachable. Signup
is open, email confirmation is off, and `handle_new_user` takes the role from
client-supplied signup metadata — so one POST to `/auth/v1/signup` returns a
trainer session that satisfies both `requireAiUser` and `requireCoach`. Phase 1
and Phase 2 buy attribution and a per-account cap, not a closed door. Full
reasoning in `tasks/hardening-db-audit-2026-10-14.md`.

**Careful with the claim, though: the ceiling bounds spend PER ACCOUNT.** An
account costs one POST and an unconfirmed email address, so "spend 200 calls,
then make another account" is still a loop. What bounds the TOTAL is the signup
rate limit Supabase Auth applies, plus any spend limit set on the Anthropic
account — and that second one is the only control that holds whatever the code
does. None of this applies on the four client brands yet: they run `dd54cac`,
answer anonymous POSTs with 200, never call `ai_usage_bump`, and use the same
key.

So the order of value is now: the **ceiling** is what bounds per-account
spend; enforcement is what makes the ceiling attachable. That is an argument for
getting Phase 1 onto the four brands reasonably soon, not for treating
enforcement as the finish line.
