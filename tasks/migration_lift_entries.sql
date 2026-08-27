-- Paul (26 Aug): let clients backdate starting weights on the training progress,
-- the way they already can with photos and measurements, so people moving from
-- another coach keep their real starting point.
--
-- Deliberately NOT a backdated workout_plans row: lift history is derived from
-- workout_plans.created_at, and several queries order by created_at and rely on
-- newest-first (lastSetsByName's "last time" reading, among others). Inserting a
-- row today carrying a 2024 date would quietly corrupt those. A separate table
-- merges into the chart only, and leaves every existing query untouched.
create table if not exists public.lift_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  weight numeric not null,
  performed_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists lift_entries_client on public.lift_entries (client_id, performed_on);

alter table public.lift_entries enable row level security;

drop policy if exists le_client_all on public.lift_entries;
create policy le_client_all on public.lift_entries
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());

-- The coach can add/amend too — they're often the one doing the migration.
drop policy if exists le_coach_all on public.lift_entries;
create policy le_coach_all on public.lift_entries
  for all using (is_my_client(client_id)) with check (is_my_client(client_id));
