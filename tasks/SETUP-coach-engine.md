# Rick.Fit coaching engine — state of play

Last updated 2026-10-04, after everything below was applied and deployed. The
history matters less than the current state, so this is written as "what is
true now".

Live on **rick-fit.netlify.app only**, behind `THEME.features.coach`. No other
brand has the flag, and none of their sites has been redeployed.

---

## 1. Database — APPLIED

`tasks/migration_coach_engine.sql` and `tasks/migration_coach_push.sql` are both
applied to `ezwmfbuuopsnpanebtal`.

Six tables: `coach_suggestions`, `coach_reviews`, `coach_memory`,
`coach_notification_prefs`, `coach_notifications`, `coach_usage` — each with RLS
on and two policies (client owns own, their coach may read). Four alterations:
`soreness` and `minutes_available` on `readiness_checkins`, `used` and `brand` on
`brain_chats`. One new unique index, `readiness_checkins (client_id, checked_on)`,
which the table did not have — it deleted nothing, as there were no duplicate
days.

Three secret-gated SECURITY DEFINER functions for the push queue:
`coach_push_state`, `coach_push_claim`, `coach_push_settle`.

Checked after applying: `node tasks/e2e_tenant_isolation.mjs` green,
`node tasks/e2e_calisthenics_rls.mjs` green.

## 2. Configuration — DONE

- `ANTHROPIC_API_KEY` was already on the site; the coaching endpoint reuses it.
- `COACH_NOTIFY_ENABLED=true`, set on the Rick.Fit site only and read back to
  confirm. Kim's site does not have it.
- `NUDGE_CRON_SECRET` was already there and is unchanged.

No service-role key is involved anywhere, and none should be added: the endpoint
reads the caller's Supabase token, verifies it, and runs every query as them, so
RLS does the isolation.

## 3. Notifications — LIVE as of 2026-10-04

Done and deployed. `tasks/migration_coach_push.sql` is applied: three
secret-gated SECURITY DEFINER functions, `coach_push_state`, `coach_push_claim`
and `coach_push_settle`. `COACH_NOTIFY_ENABLED=true` is set on the Rick.Fit site
only (checked: Kim's site does not have it), and `coach-notify.mjs` carries
`schedule: '7 * * * *'`.

**The old global queue is not used.** `nudges_due`, `daily_reminders_due` and
`coach_alerts_due` take only a secret and return every brand's clients; that is
why Rick.Fit's deploy can push to Kim's and Paul's. `coach_push_state` takes the
brand and joins `coach_notification_prefs`, so there are three independent gates:
the secret, the brand, and an opt-in row that defaults to false.

Proven on production, with the test rows removed afterwards: a client opted in on
the **kim** brand returned `kim_queue: 1` and `ricky_queue: 0` from the same
function in the same query.

Also checked: a wrong secret into the RPC gets `bad secret`; `app_config` returns
`[]` to the publishable key, so the secret cannot be read out; the sender refuses
a manual call without the secret; and it refuses to run at all if the brand
cannot be resolved from the Host header, rather than falling back to "everyone".

One correction worth noting: the functions were first created with
`revoke all ... from anon`, which made them uncallable — the Netlify function
uses the publishable key, which authenticates as `anon`, so the 401 came from the
gateway before the body ran. Execute is now granted and the secret inside is the
gate, which is the same pattern `nudge_drop` already used.

**A notification is claimed before it is sent.** The row goes into
`coach_notifications` first and the unique index on
`(client_id, brand, dedupe_key)` decides who wins, so two instances in the same
minute cannot both send. Dead subscriptions are pruned via `nudge_drop`.

### What is still needed from the user

Nothing is sent to anybody until they opt in, on their own device:

1. Train tab → Phone reminders → **Turn on phone reminders** (browser permission
   plus the push subscription). On iPhone the app has to be installed to the Home
   Screen first.
2. The **Coach notifications** card below it → switch it on, choose categories,
   usual time, quiet hours and a daily cap.

Until step 1 and 2 are both done the queue is empty — verified: a live run
returns `inQueue: 0, sent: 0`.

### Not yet proven

No notification has actually been delivered to a device, because that needs a
real subscription and there is none on this account yet. The send path
(claim → webpush → settle → prune) is written and its decision logic is covered
by 13 tests, but the delivery itself is unverified.

## 4. What is verified, and what is still not

**Verified.** 98 unit tests (74 new): recommendation priority, missing-versus-zero,
planned-versus-completed, date and DST boundaries, notification suppression and
de-duplication, brand and account isolation, stale-response ordering, failed
saves, and the auth rules (identity from the token, refused impersonation, body
limits, key never logged, timeout handling). Rick.Fit, Kim and Paul builds pass.
Both RLS suites pass against production after the migration. On the live site:
the endpoint returns 401 without a token and with a forged one; the notification
queue is brand-scoped (demonstrated with a seeded row, since removed); a wrong
secret into the RPC is refused; `app_config` is unreadable to the publishable
key. The UI was driven at 320px and 375px in a real browser.

**Still not verified:**

- **The AI prose.** No model call has been made from this code. The prompts are
  built and asserted in tests; the first sentence it writes to anybody will be
  the first anyone has read.
- **A delivered notification.** The queue is empty because there is no push
  subscription on the account yet, so claim → send → settle → prune has never run
  end to end against a device.
- **The real screens at mobile width.** The dev harness (`/?coachpreview=1`)
  reproduces the components' markup and classes, and is checked in a browser, but
  it does not mount `CoachCard`, `Readiness` or `WeeklyReview` — those need a
  session. Layout and CSS are verified; the components' own behaviour is not.
- **The service-worker notification click.** Written on both sides, needs a real
  push to prove.
