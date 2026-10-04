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

## 3. Notifications — deliberately NOT switched on

`netlify/functions/coach-notify.mjs` has **no `export const config = { schedule }`**,
which is how every other scheduled function here opts in, and it additionally
refuses to send unless `COACH_NOTIFY_ENABLED=true`. Both are deliberate.

Before it can send anything, one thing has to be built that is not in this
change: **a brand-scoped queue RPC.**

The existing nudge RPCs (`nudges_due`, `daily_reminders_due`, `coach_alerts_due`)
take only `p_secret` and return **every brand's clients**. Every brand's site runs
its own hourly copy against that one global queue, which is why Rick.Fit's deploy
can already push to Kim's and Paul's clients. Reusing that pattern here would put
Rick.Fit's coaching wording on a paying client's lock screen, so this function
does not call those RPCs at all.

What is needed, roughly:

```sql
create or replace function public.coach_push_due(p_secret text, p_brand text)
returns table (
  client_id uuid, brand text, coach_id uuid,
  endpoint text, p256dh text, auth text,
  prefs jsonb, sent_today int, sent_keys text[]
)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select value from app_config where key = 'nudge_secret') then
    raise exception 'no';
  end if;
  return query
  select p.id, np.brand, p.trainer_id,
         ps.endpoint, ps.p256dh, ps.auth,
         to_jsonb(np) - 'client_id',
         (select count(*)::int from coach_notifications n
            where n.client_id = p.id and n.brand = p_brand
              and n.sent_at >= date_trunc('day', now() at time zone 'Europe/London')),
         (select coalesce(array_agg(n.dedupe_key), '{}') from coach_notifications n
            where n.client_id = p.id and n.brand = p_brand and n.sent_at is not null)
  from coach_notification_prefs np
  join profiles p on p.id = np.client_id
  join push_subscriptions ps on ps.client_id = p.id
  where np.brand = p_brand and np.enabled;
end $$;
```

`p_brand` is the point of it. The sender resolves the brand from its own Host
header (`brandForHost`), never from the request body, and `recipientAllowed()` in
`src/coachNotify.js` refuses any row whose brand does not match — with a named
reason, so a wiring mistake lands in the ledger instead of on a stranger's phone.

When that exists:

1. Dry run first. It reports what it WOULD send and sends nothing:
   `POST /.netlify/functions/coach-notify  {"secret": "<NUDGE_CRON_SECRET>", "dryRun": true}`
2. Check every decision line names the expected client and brand.
3. Set `COACH_NOTIFY_ENABLED=true` on the Rick.Fit site only.
4. Add `export const config = { schedule: '0 * * * *' }` to the function.

Per-client preferences live in `coach_notification_prefs` and default to
`enabled: false` — so even with all of the above, nobody receives anything until
they turn it on themselves.

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
