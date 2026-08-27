-- Paul (27 Aug): "any new exercises I add to the program workouts aren't saving
-- and updating the list either, so I am having to create the session and any new
-- exercises each time". src/exercises.js is a static catalogue — a typed name
-- lived only in that one session.
--
-- Mirrors the proven coach_foods pattern: owned by the coach, shared across all
-- their sessions, readable by their clients (who use the same editor for their
-- own plans).
create table if not exists public.coach_exercises (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists coach_exercises_unique on public.coach_exercises (coach_id, lower(name));

alter table public.coach_exercises enable row level security;

drop policy if exists ce_coach_all on public.coach_exercises;
create policy ce_coach_all on public.coach_exercises
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- Clients read their own coach's list, and can add (they use the same editor for
-- their own plans) — mirrors coach_foods, where a client's manual add is kept.
drop policy if exists ce_client_read on public.coach_exercises;
create policy ce_client_read on public.coach_exercises
  for select using (coach_id = my_trainer_id());

drop policy if exists ce_client_insert on public.coach_exercises;
create policy ce_client_insert on public.coach_exercises
  for insert with check (coach_id = my_trainer_id() and created_by = auth.uid());
