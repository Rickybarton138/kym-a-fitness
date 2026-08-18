-- Multi-week programs (Paul Andrews). Run in the kym-a-fitness Supabase SQL editor
-- (project ezwmfbuuopsnpanebtal). Safe/idempotent.

-- 1) Give each program session a week + weekday so a program can span weeks.
alter table program_sessions add column if not exists week int not null default 1;
alter table program_sessions add column if not exists dow  int;  -- 0=Sun .. 6=Sat (JS getDay); null = unscheduled

-- 2) Assign a program to a client from a start date, optionally repeating.
create table if not exists client_programs (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references profiles(id) on delete cascade,
  coach_id   uuid not null references profiles(id) on delete cascade,
  program_id uuid not null references workout_programs(id) on delete cascade,
  start_date date not null,
  repeat     boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists client_programs_client_idx on client_programs (client_id) where active;

alter table client_programs enable row level security;

-- client sees their own assignment; coach manages their clients' assignments
drop policy if exists client_programs_client_sel on client_programs;
create policy client_programs_client_sel on client_programs
  for select using (client_id = auth.uid());

drop policy if exists client_programs_coach_all on client_programs;
create policy client_programs_coach_all on client_programs
  for all using (is_my_client(client_id)) with check (is_my_client(client_id));
