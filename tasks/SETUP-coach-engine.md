# Rick.Fit coaching engine — what has to be done before it works

Written 2026-10-04. **Nothing in this file has been applied.** The task that
produced this code was explicitly not to deploy or change production
infrastructure, so the migration is written and not run, and the feature is
behind `THEME.features.coach`, which is on for `ricky` only.

Until step 1 is done the app does not break — every new table read is written to
treat "table missing" as "not loaded", and the UI says so where it matters
("Suggestions are not being saved yet", "Memory is not set up on the server
yet"). But nothing persists, and several things cannot work at all.

---

## 1. Apply the migration

```
tasks/migration_coach_engine.sql
```

Six new tables (`coach_suggestions`, `coach_reviews`, `coach_memory`,
`coach_notification_prefs`, `coach_notifications`, `coach_usage`), each with RLS
written out per table, plus four alterations to existing tables.

**Read this part before running it.** The migration adds a unique index on
`readiness_checkins (client_id, checked_on)`, which the table does not have
today — it has only an `id` primary key, so nothing currently stops two
check-ins for the same day and the upsert the engine does has no conflict target.
To add the index it first **deletes duplicate rows**, keeping the newest of each
day. Check what that would remove first:

```sql
select client_id, checked_on, count(*)
from readiness_checkins group by 1, 2 having count(*) > 1;
```

If that returns nothing, the delete is a no-op. There were 10 rows in the table
when this was written.

The other alterations are additive and safe: `soreness` and `minutes_available`
on `readiness_checkins`, `used` and `brand` on `brain_chats`.

Apply with the Supabase MCP `apply_migration`, the SQL editor, or
`supabase db push`. Afterwards:

```sh
node tasks/e2e_tenant_isolation.mjs    # must stay green
```

## 2. Nothing else is required for the app

`ANTHROPIC_API_KEY` is already set on the Rick.Fit site (the existing AI features
use it). The coaching endpoint reads the same variable. No new secrets.

The endpoint authenticates callers itself: it reads the Supabase access token
from the Authorisation header, verifies it against `/auth/v1/user`, and then runs
every query with that token so RLS applies as the user. There is no service-role
key involved and none should be added.

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

## 4. What is verified and what is not

**Verified here:** 98 unit tests (74 of them new) covering recommendation
priority, missing-versus-zero, planned-versus-completed, date and DST
boundaries, notification suppression and de-duplication, brand and account
isolation, stale-response ordering, failed saves, and the auth rules
(token-derived identity, refused impersonation, body limits, key never logged,
timeout handling). Rick.Fit, Kim and Paul production builds all pass. The UI was
driven at 320px and 375px in a real browser through a development-only fixture
harness (`/?coachpreview=1`, `import.meta.env.DEV` only).

**Not verified, and why:**

- **Anything that needs the new tables.** The migration is not applied, so the
  suggestion cache, saved reviews, memory, notification preferences and the usage
  counter have never run against a real database. The code paths that read them
  are written and tested against mocks, including the "table is missing" branch.
- **The live endpoint end to end.** It has never been called against production
  data, because that would mean using a real account.
- **The AI prose.** No model call has been made from this code. The prompts are
  built and asserted in tests; the text that comes back is unseen.
- **The real screens at mobile width.** The harness reproduces the components'
  markup and classes and is checked in a browser, but it does not mount
  `CoachCard`, `Readiness` or `WeeklyReview` themselves — those need a session.
  Layout and CSS are verified; the components' own behaviour at that width is not.
- **The service-worker notification click.** The code is written and the app side
  listens for it, but it needs a real push to prove.
