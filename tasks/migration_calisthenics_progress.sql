-- Where a client is on each calisthenics skill ladder.
--
-- One row per client per skill; the ladders themselves live in
-- src/calisthenics.js, so this stores nothing but a position. step_index is
-- clamped in the app (stepIndex) rather than constrained to a length here — a
-- ladder gains steps over time and a CHECK would have to be migrated every time
-- one does.
--
-- Client-owned throughout: no coach-controlled columns, so the column-GRANT
-- pattern from migration_profile_column_grants.sql is not needed. The coach can
-- read, which is what makes the tracker useful to them, and nothing more.
create table if not exists public.calisthenics_progress (
  client_id  uuid not null references public.profiles(id) on delete cascade,
  skill_key  text not null,
  step_index integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (client_id, skill_key)
);

alter table public.calisthenics_progress enable row level security;

drop policy if exists calis_own on public.calisthenics_progress;
create policy calis_own on public.calisthenics_progress
  for all to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists calis_trainer_read on public.calisthenics_progress;
create policy calis_trainer_read on public.calisthenics_progress
  for select to authenticated
  using (public.is_my_client(client_id));
