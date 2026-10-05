# 2026-10-04/05 — the proactive coaching engine, Rick.Fit

Live on **rick-fit.netlify.app only**, behind `THEME.features.coach`. No other
brand has the flag and none was redeployed. Commits `b0015e0` through `2aa4166`,
all pushed.

Two documents the brief asked me to read, `tasks/rick-fit-audit-2026-09-10.md`
and `tasks/rick-fit-implementation.md`, **do not exist** — not in `tasks/`, not
under the home directory, not in git history. Everything here came from the code
and the live schema instead.

## The shape

Deterministic code decides WHAT to say; the model only writes the sentence about
it. The priority order is unit-testable, cannot drift with a prompt edit, and a
failed AI call degrades to a card with real content rather than an empty one.

Three distinctions the raw tables do not make, which everything rests on:

- **Planned is not completed.** `workout_plans` gets a row the moment somebody
  taps a session — `startSessionNow` inserts before a single set is done. Only
  `workout_completions` means it happened. Adherence counts CLOSED food days
  (`food_day_complete`), so a day still being logged is never scored as a miss.
- **Missing is not zero.** No `daily_steps` row is "we do not know", named in
  `ctx.missing`, never nudged about.
- **Freshness travels per slice**, so the card can say how old its evidence is.

## Files

| File | What it is |
|---|---|
| `src/coachTime.js` | Europe/London civil dates, correct in a UTC function |
| `src/coachContext.js` | Pure shaping into one versioned context |
| `src/coachRules.js` | Priority-ordered next action, feedback, readiness adjustment |
| `src/coachNotify.js` | Suppression, dedup, quiet hours, brand boundaries |
| `src/coachGuard.js` | Request tickets — an older answer cannot overwrite a newer |
| `src/coachClient.js` | Token, refresh bus, cache, dismiss/snooze |
| `src/brandHosts.js` | Host → brand, extracted from themes.js so functions can import it |
| `netlify/functions/_auth.mjs` | Identity, validation, limits, timeouts, Claude call |
| `netlify/functions/_context.mjs` | Scoped loader, queries run AS THE USER |
| `netlify/functions/coach.mjs` | today / feedback / chat / review / readiness / memory |
| `netlify/functions/coach-notify.mjs` | Scheduled sender, hourly |
| `CoachCard` `Readiness` `WeeklyReview` `CoachFeedback` `CoachMemory` `CoachNotifications` | UI, all flag-gated |
| `src/CoachPreview.jsx` | Dev-only fixture harness, `/?coachpreview=1` |

Migrations applied: `tasks/migration_coach_engine.sql` (six tables, RLS, four
column additions, one unique index) and `tasks/migration_coach_push.sql` (three
secret-gated RPCs).

## Security

- **Identity from the verified session.** The token is checked against
  `/auth/v1/user`; a body naming someone else is a 403.
- **Queries run as the user** — publishable key plus their token, so RLS does the
  isolation rather than my remembering a filter. No service-role key.
- **Brand from the Host header only**, never the body.
- **`analyze.mjs` untouched.** It has no auth and is live for four other brands'
  paying clients. The authenticated chat is a new endpoint; the Ask screen routes
  there only when `features.coach`.

## Notifications

The hazard: `nudges_due`, `daily_reminders_due` and `coach_alerts_due` take only
a shared secret and return EVERY brand's clients, and each brand's site runs its
own hourly copy against that one queue. That is why Rick.Fit's deploy can push to
Kim's and Paul's clients. **None of them is used here.**

`coach_push_state(secret, brand, day, period_start)` has three independent gates:
the secret, the brand, and an opt-in row defaulting to false. Proven on
production and then cleaned up — a client opted in on the **kim** brand returned
`kim_queue: 1` and `ricky_queue: 0` from the same function in the same query.

A notification is CLAIMED before it is sent: the row goes in first and the unique
index on `(client_id, brand, dedupe_key)` decides who wins, so two instances in
the same minute cannot both send. Dead subscriptions are pruned via `nudge_drop`.

Live: `COACH_NOTIFY_ENABLED=true` on Rick.Fit only (checked — Kim's site does not
have it), schedule `7 * * * *`.

## Verification

98 unit tests, 74 of them new: priorities, missing-vs-zero, planned-vs-completed,
DST boundaries, suppression and dedup, account and brand isolation,
stale-response ordering, failed saves, auth rules. Rick.Fit, Kim and Paul builds
pass. Both RLS suites green against production after the migration. Live: the
endpoint 401s without a token and with a forged one; a wrong secret into the RPC
is refused; `app_config` is unreadable to the publishable key. UI driven at 320px
and 375px.

A forced live run of the sender returned **nothing sent, correctly**: the weekly
review had already been opened at 21:41, so the "your review is ready"
notification suppressed itself. Suppression demonstrated on real data.

First real AI output seen, the weekly review: *"you completed 2 of your 4 planned
sessions, both Upper A — Push. No other session types are logged for this week,
so I can't comment on how your other lifts are coming along."* Honest about what
it cannot tell — which is the behaviour the prompt guard is for.

## Bugs this work found

1. `sessionForDay` returns a WRAPPER `{ sess, weekNum, title: <programme title> }`.
   Reading `.title` off it announced "Lean & Strong" as today's session. Caught by
   a test.
2. The allergy scan matched `fish` inside `shellfish`, quietly excluding every
   fish dish from somebody who can eat fish. Visible in the preview harness as
   "Kept clear of: shellfish, fish". Fixed with word boundaries both sides.
3. A `follow_up` notification category was offered as a switch that nothing could
   ever generate. Removed.
4. **The notification settings had no route in.** See lessons.

## Still open

- **No notification has reached a device.** The real test is 08:07 tomorrow: if a
  session is scheduled and not yet done, the ledger will show it sent, suppressed
  or failed, each with a reason. `coach_notifications` is the table to read.
- The dev harness reproduces the components' markup but does not mount
  `CoachCard` / `Readiness` / `WeeklyReview` — those need a session. Layout
  verified, component behaviour at phone width not.
- The service-worker notification click is written on both sides, unproven until
  a real push lands.

## Lessons (also in tasks/lessons.md)

**A feature flag is not a route — again.** The notification settings screen had
exactly one way in: an inline "Level 2 · adjust" link inside the coach's
check-in card on Home. I told Ricky to look in the Train tab; there was nothing
there, or anywhere. This is the same mistake as the callisthenics tile three weeks
earlier, which went into a hub Rick.Fit never renders. The lesson was already
written down from that one and I did not apply it. **Walk the route on the brand
that asked for it before telling anybody where to tap.**
