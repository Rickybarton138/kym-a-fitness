-- Applied via Supabase MCP 2026-08-19. Manually-added foods get saved so
-- they're remembered per-client and shared across a coach's whole roster —
-- Paul's ask: "can we build this so the manually added meal/food gets added
-- to the library of foods... or at least stored in the users app".
create table coach_foods (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  name text not null,
  calories integer not null default 0,
  protein_g integer not null default 0,
  carbs_g integer not null default 0,
  fat_g integer not null default 0,
  fibre_g integer not null default 0,
  created_at timestamptz not null default now()
);
alter table coach_foods enable row level security;
create policy coach_foods_select_member on coach_foods for select using (
  coach_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and trainer_id = coach_foods.coach_id)
);
create policy coach_foods_insert on coach_foods for insert with check (
  created_by = auth.uid() and (
    coach_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and trainer_id = coach_foods.coach_id)
  )
);
create policy coach_foods_delete_coach on coach_foods for delete using (coach_id = auth.uid());
