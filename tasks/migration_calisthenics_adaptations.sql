-- Which joints a client's calisthenics has to work around.
--
-- One row per active adaptation rather than a boolean column each: the list
-- lives in ADAPTATIONS in src/calisthenics.js, and adding "shoulders" later
-- should be a code change, not another migration and another column.
-- Presence means on; the toggle inserts and deletes.
--
-- Client-owned. The coach can read it, which is the point of it being in the
-- database rather than on the device.
create table if not exists public.calisthenics_adaptations (
  client_id  uuid not null references public.profiles(id) on delete cascade,
  adaptation text not null,
  updated_at timestamptz not null default now(),
  primary key (client_id, adaptation)
);

alter table public.calisthenics_adaptations enable row level security;

drop policy if exists calis_adapt_own on public.calisthenics_adaptations;
create policy calis_adapt_own on public.calisthenics_adaptations
  for all to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists calis_adapt_trainer_read on public.calisthenics_adaptations;
create policy calis_adapt_trainer_read on public.calisthenics_adaptations
  for select to authenticated
  using (public.is_my_client(client_id));
