# Hardening pass — scope

Asked for 13 Oct 2026. **Scoped, not started.** This is the list, in the order
I would do it.

## 1. Nine AI endpoints are open to the internet (do this first)

> **DONE, 14 Oct 2026.** All ten (the nine plus `meal-plan`'s other five
> actions) now resolve identity from the verified session before they parse a
> body. `tasks/hardening-pass-1.md` is the write-up; `tasks/e2e_auth_refusals.mjs`
> is the proof, 60/60 against a real deploy. Two things are NOT done and are
> deliberate: the per-brand `AI_AUTH=observe` rollout window for Kim, Paul, PPH
> and Elev8 is Ricky's call, and the success path has not been driven by a
> logged-in browser.

Every one of these calls `api.anthropic.com` on Ricky's key with **no
authentication**, and most carry `access-control-allow-origin: *`. Anyone who
finds the URL can spend his credit from a browser console, in a loop, from
anywhere.

| Function | Model calls | max_tokens | What it does |
|---|---|---|---|
| `analyze.mjs` | 1 | 900 | **Vision** — fridge and meal photos. Dearest per call. |
| `program-edit.mjs` | 1 | 4000 | Rewrites a training programme |
| `program-generate.mjs` | 1 | 3000 | Builds a whole programme |
| `recipe-generate.mjs` | 1 | 2500 | Batch of recipes |
| `recipe-ai.mjs` | 2 | 900 | URL/photo recipe import, **fetches an arbitrary URL** |
| `equipment-scan.mjs` | 1 | 700 | **Vision** — gym equipment photo |
| `exercise-guide.mjs` | 1 | 400 | How-to for one exercise |
| `exercise-swap.mjs` | 1 | — | Alternative exercise |
| `barcode.mjs` | 1 | 60 | Barcode to food |

`meal-plan.mjs` is half done: the new `method` action requires a session, its
other five actions do not.

**This is not hypothetical.** `tasks/lessons.md`, 12 Oct: the Anthropic account
ran out of credit and every AI screen on Paul's site showed his paying clients
our billing message. Whatever caused that, nine uncapped endpoints with no
caller identity make it impossible to tell *who* spent it — there is no record
of who called what.

The machinery already exists in `_auth.mjs`: `requireUser`, `withinDailyLimit`
(a DB counter, fails open), `rejectImpersonation`, `brandOf`. `coach.mjs` shows
the shape.

Two things that make this more than a one-line change per file, and are the
reason it needs a proper sitting rather than being tacked onto a feature:

- Every caller must send the token. `src/coachClient.js` already does; the
  other call sites do not.
- Two scripts call `meal-plan` unauthenticated and would break:
  `tasks/e2e_round31.mjs` and `scripts/ricky-week-plan.mjs`.

Suggested order: `analyze` and `equipment-scan` first (vision, dearest), then
`program-*` and `recipe-*` (largest token budgets), then the rest, then
`meal-plan`'s remaining actions.

## 2. `recipe-ai.mjs` fetches a URL the caller chooses

> **DONE, 14 Oct 2026.** `netlify/functions/_fetchPage.mjs`, with
> `tests/fetch-page.test.mjs` behind it. The allowlist-alone answer sketched
> below would NOT have worked: Node's `fetch` follows redirects, so an allowed
> recipe site answering 302 to loopback takes the request there and the
> allowlist never sees the second address. That specific bypass is now a test.

Unauthenticated **and** it will fetch any URL handed to it, then feed the page
to a model. That is a server-side request forgery shape: internal addresses,
cloud metadata endpoints, enormous files. Needs, at minimum, a scheme and host
allowlist, a size cap, a timeout, and no redirects to private ranges.

## 3. Rate limiting is per-user, so it cannot bind an anonymous caller

> **PART DONE, 14 Oct 2026.** Authenticating the endpoints (item 1) made the
> limit possible; the audit then found it was not working anyway. The policy on
> `coach_usage` was ALL rather than SELECT, so the person being limited could
> reset their own counter, and the read-add-write was not atomic, so nine
> concurrent calls counted as one. Both fixed - see
> `tasks/hardening-db-audit-2026-10-14.md` and
> `tasks/migration_coach_usage_counter.sql`. What is still NOT done is wiring
> the nine AI endpoints into a ceiling: they would share coach chat's 120 a day,
> and giving them their own bucket needs the primary key widened, which would
> break the brands still running the old code. After Phase 2.

`withinDailyLimit` counts against a user id. With no user there is nothing to
count, so the only brake on the nine endpoints above is Anthropic's own. Once
they authenticate, the limit starts working — which is another reason to do 1
before anything clever.

## 4. Smaller items

- ~~`coach-notify.mjs` is gated by `COACH_NOTIFY_ENABLED`; confirm the gate is
  still the only path that can send~~ — **done, 14 Oct, and it was not the only
  path.** An empty-body POST was read as proof that Netlify's scheduler had
  called it, so anyone could run a real send loop with no secret. Fixed in
  `dd54cac`. `coach_notifications` is empty: nothing has ever been delivered,
  which is still unexplained and needs either a function log or an 08:07
  observation.
- ~~`app_config` `nudge_cron_secret` — confirm no RPC remains callable without
  it.~~ **Done, 14 Oct: none is.** All 19 secret-taking RPCs read the key from
  `app_config` and gate on `coalesce(ok, false)`, so a missing key fails closed.
  The secret is 48 characters and `app_config` has RLS on with no policies, so
  it cannot be read through the API.
- ~~The `*` CORS on most functions can narrow to the known brand hosts.~~
  **Deliberately NOT doing this.** With the endpoints authenticated, the token
  is what stands between a stranger and the key, not the origin header — and
  narrowing it would break the native shell, which is cross-origin to every
  brand. CORS never stopped a non-browser caller. Reasoning in
  `tasks/hardening-db-audit-2026-10-14.md`.
- ~~RLS spot-check across the newer coaching tables.~~ **Done, 14 Oct.** The
  September column-grant fix holds; `push_subscriptions` pins
  `client_id = auth.uid()` on write; `exercise_guides` has no write policy at
  all so the shared cache cannot be poisoned. Every `SECURITY DEFINER` function
  that takes an id was read and is scoped by `auth.uid()`. One finding, in
  `coach_usage` — see item 3.
- **NEW, Ricky's call:** leaked-password protection is off in Supabase Auth.
  An account setting, not a code change.

## What "hardening" should NOT mean here

Not a rewrite. The app works and has real clients on four brands. Each item
above is a contained change with an existing helper behind it, and each should
land with a test that proves the endpoint refuses an anonymous caller — the way
`tasks/e2e_meal_recipes.mjs` asserts the 401s for `meal-plan`'s `method`.
