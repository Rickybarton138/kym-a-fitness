-- Rick.Fit proactive coaching engine (2026-10-04).
--
-- NOT YET APPLIED. The brief forbids changing production infrastructure, so this
-- file is the contract the code is written against and SETUP.md lists how to
-- apply it. Everything that depends on these tables is unverified against a live
-- database until it is.
--
-- Design notes:
--  * Every table carries `brand`, and `brand` is part of the key wherever a row
--    is per-brand. The app is one database serving seven brands off one account
--    base; a client who exists on two brands must not see one brand's coaching
--    state on the other. Policies still gate on client_id = auth.uid() — brand is
--    isolation WITHIN an account, not a security boundary on its own.
--  * No coach-controlled columns anywhere here, so the column-GRANT pattern from
--    migration_profile_column_grants.sql is not needed. Clients own their rows;
--    their coach can read.
--  * Dates are DATE, and the application writes them as Europe/London civil days
--    (src/coachTime.js). A Netlify function runs in UTC, so a naive date would be
--    a day out between 23:00 and 00:00 London in summer.

-- 1. The Today card: what was suggested, and whether it was dismissed or snoozed.
-- One row per client per brand per day, so a regenerate updates rather than piles up.
create table if not exists public.coach_suggestions (
  client_id     uuid not null references public.profiles(id) on delete cascade,
  brand         text not null,
  for_day       date not null,
  action_key    text not null,
  payload       jsonb not null default '{}'::jsonb,
  -- A hash of the context the suggestion was built from. A refresh whose
  -- fingerprint matches can reuse the stored explanation instead of paying for
  -- another model call.
  fingerprint   text,
  generated_at  timestamptz not null default now(),
  dismissed_at  timestamptz,
  snoozed_until timestamptz,
  primary key (client_id, brand, for_day)
);

-- 2. Weekly reviews, kept so they can be reread. The unique key is what prevents
-- a second review being generated for a period that already has one.
create table if not exists public.coach_reviews (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  brand        text not null,
  period_start date not null,
  period_end   date not null,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  unique (client_id, brand, period_start)
);

-- 3. Coaching memory the user can inspect and clear. Free-text preferences and
-- constraints (including allergies, which have no structured home in `profiles`
-- and should not get one — its column grants are deliberately locked down).
create table if not exists public.coach_memory (
  client_id  uuid not null references public.profiles(id) on delete cascade,
  brand      text not null,
  key        text not null,
  value      text not null,
  source     text not null default 'user' check (source in ('user', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id, brand, key)
);

-- 4. Notification preferences. Times are LOCAL wall-clock in `timezone`.
create table if not exists public.coach_notification_prefs (
  client_id      uuid not null references public.profiles(id) on delete cascade,
  brand          text not null,
  enabled        boolean not null default false,
  categories     jsonb not null default '{}'::jsonb,
  timezone       text not null default 'Europe/London',
  quiet_from     time not null default '21:30',
  quiet_to       time not null default '07:30',
  preferred_hour integer not null default 8 check (preferred_hour between 0 and 23),
  max_per_day    integer not null default 2 check (max_per_day between 0 and 10),
  updated_at     timestamptz not null default now(),
  primary key (client_id, brand)
);

-- 5. Notification ledger. `dedupe_key` is what stops the same nudge going twice:
-- the sender writes the row BEFORE it sends, and the unique index refuses the
-- duplicate rather than relying on the sender to remember.
create table if not exists public.coach_notifications (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  brand            text not null,
  category         text not null,
  dedupe_key       text not null,
  body             text,
  url              text,
  sent_at          timestamptz,
  suppressed       text,
  created_at       timestamptz not null default now(),
  unique (client_id, brand, dedupe_key)
);

-- 6. Per-day call counter. This is the usage control that actually holds: a
-- module-scope counter in a Netlify function is per-instance and concurrent, so
-- it counts almost nothing.
create table if not exists public.coach_usage (
  client_id uuid not null references public.profiles(id) on delete cascade,
  day       date not null,
  calls     integer not null default 0,
  primary key (client_id, day)
);

-- 7. The readiness check-in needs the two fields the brief asks for and the table
-- does not have: soreness, and how long they have got today.
alter table public.readiness_checkins add column if not exists soreness integer;
alter table public.readiness_checkins add column if not exists minutes_available integer;

-- …and a one-per-day key. Checked against the live schema: readiness_checkins
-- has only an `id` primary key, so nothing stops two check-ins for the same day
-- and an upsert on (client_id, checked_on) has no conflict target to use. The
-- engine checks in once a day and edits that row, so:
--   a) collapse any day that already has more than one row, newest kept
--   b) add the key
-- Step (a) deletes rows. It is confined to duplicate days and keeps the most
-- recent of each; if that is not acceptable, inspect first with:
--   select client_id, checked_on, count(*) from readiness_checkins
--   group by 1,2 having count(*) > 1;
delete from public.readiness_checkins r
using public.readiness_checkins keep
where r.client_id = keep.client_id
  and r.checked_on = keep.checked_on
  and (keep.created_at, keep.id) > (r.created_at, r.id);

create unique index if not exists readiness_checkins_client_day
  on public.readiness_checkins (client_id, checked_on);

-- 8. Chat gains the compact record of what informed the answer (so the user can
-- see it later, not just in the moment) and the brand it was asked on.
alter table public.brain_chats add column if not exists used jsonb;
alter table public.brain_chats add column if not exists brand text;

-- RLS ------------------------------------------------------------------------
alter table public.coach_suggestions         enable row level security;
alter table public.coach_reviews             enable row level security;
alter table public.coach_memory              enable row level security;
alter table public.coach_notification_prefs  enable row level security;
alter table public.coach_notifications       enable row level security;
alter table public.coach_usage               enable row level security;

-- Written out per table rather than generated in a DO block: this file cannot be
-- run here to prove the loop syntax, and six readable pairs beat one clever one.
drop policy if exists coach_suggestions_own on public.coach_suggestions;
create policy coach_suggestions_own on public.coach_suggestions
  for all to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists coach_suggestions_coach_read on public.coach_suggestions;
create policy coach_suggestions_coach_read on public.coach_suggestions
  for select to authenticated using (public.is_my_client(client_id));

drop policy if exists coach_reviews_own on public.coach_reviews;
create policy coach_reviews_own on public.coach_reviews
  for all to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists coach_reviews_coach_read on public.coach_reviews;
create policy coach_reviews_coach_read on public.coach_reviews
  for select to authenticated using (public.is_my_client(client_id));

drop policy if exists coach_memory_own on public.coach_memory;
create policy coach_memory_own on public.coach_memory
  for all to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists coach_memory_coach_read on public.coach_memory;
create policy coach_memory_coach_read on public.coach_memory
  for select to authenticated using (public.is_my_client(client_id));

drop policy if exists coach_notification_prefs_own on public.coach_notification_prefs;
create policy coach_notification_prefs_own on public.coach_notification_prefs
  for all to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists coach_notification_prefs_coach_read on public.coach_notification_prefs;
create policy coach_notification_prefs_coach_read on public.coach_notification_prefs
  for select to authenticated using (public.is_my_client(client_id));

drop policy if exists coach_notifications_own on public.coach_notifications;
create policy coach_notifications_own on public.coach_notifications
  for all to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists coach_notifications_coach_read on public.coach_notifications;
create policy coach_notifications_coach_read on public.coach_notifications
  for select to authenticated using (public.is_my_client(client_id));

drop policy if exists coach_usage_own on public.coach_usage;
create policy coach_usage_own on public.coach_usage
  for all to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists coach_usage_coach_read on public.coach_usage;
create policy coach_usage_coach_read on public.coach_usage
  for select to authenticated using (public.is_my_client(client_id));

-- Handy for the weekly-review lookup and the notification sweep.
create index if not exists coach_reviews_client_period
  on public.coach_reviews (client_id, brand, period_start desc);
create index if not exists coach_notifications_client_created
  on public.coach_notifications (client_id, brand, created_at desc);
