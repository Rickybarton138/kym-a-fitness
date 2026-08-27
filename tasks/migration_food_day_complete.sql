-- Paul (26 Aug): logging one item ticks the whole "log your food" task for the
-- day. He wants an explicit "I'm done logging" instead, so the tick means the
-- day is actually finished rather than started.
-- One row per client per day; absence = not finished.
create table if not exists public.food_day_complete (
  client_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  completed_at timestamptz not null default now(),
  primary key (client_id, day)
);

alter table public.food_day_complete enable row level security;

drop policy if exists fdc_client_all on public.food_day_complete;
create policy fdc_client_all on public.food_day_complete
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists fdc_coach_read on public.food_day_complete;
create policy fdc_coach_read on public.food_day_complete
  for select using (is_my_client(client_id));
