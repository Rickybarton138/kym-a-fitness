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
