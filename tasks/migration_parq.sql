-- PAR-Q (physical activity readiness questionnaire) — Paul's ask 2026-08-26:
-- screen every joining client on BOTH memberships, and let them update it later
-- from their profile alongside the health details.
--
-- Append-only: every submission is a NEW row, never an update. A health-screening
-- record has to keep its dated history, and each row snapshots the question text
-- it was answered against (same reason checkin_responses snapshots its fields) —
-- otherwise an old answer set can't be read back once the wording changes.
-- RLS mirrors checkin_responses: client owns their rows, coach reads them.
create table if not exists public.parq_responses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  questions jsonb not null,          -- [{key,text}] as shown at the time
  answers jsonb not null,            -- {key: {yes:bool, detail:text}}
  any_yes boolean not null default false,
  medications text,
  injuries text,
  declared_name text,                -- typed signature
  created_at timestamptz not null default now()
);

create index if not exists parq_client_created on public.parq_responses (client_id, created_at desc);

alter table public.parq_responses enable row level security;

drop policy if exists pq_client_all on public.parq_responses;
create policy pq_client_all on public.parq_responses
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists pq_coach_read on public.parq_responses;
create policy pq_coach_read on public.parq_responses
  for select using (is_my_client(client_id));
