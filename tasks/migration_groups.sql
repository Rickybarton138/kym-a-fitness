-- Applied via Supabase MCP 2026-08-18. Groups: a named/iconed cohort (Kim's
-- Trainerize-style ask) wrapping the existing client_tags mechanism —
-- membership is a client_tags row matching the group's tag, reusing the
-- proven tag-gated community_posts.audience_tag / workout_programs.audience_tag
-- for the group feed and "subscribe to a shared programme".
create table groups (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  tag text not null,
  name text not null,
  icon text not null default '👥',
  created_at timestamptz not null default now(),
  unique (coach_id, tag)
);
alter table groups enable row level security;
create policy groups_all_coach on groups for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy groups_select_member on groups for select using (
  exists (select 1 from client_tags where client_tags.client_id = auth.uid() and client_tags.tag = groups.tag)
);

alter table coach_files add column audience_tag text;
