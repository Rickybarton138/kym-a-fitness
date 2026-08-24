-- Applied via Supabase MCP 2026-08-24. Paul's ask: session templates
-- currently show to every client regardless of tag — lock them down the same
-- way workout_programs already does. Mirrors wp_client_read exactly, minus
-- the client_id branch (templates have no per-client variant, only coach-wide
-- with an optional tag).
alter table workout_templates add column if not exists audience_tag text;

drop policy if exists wt_client_read on workout_templates;
create policy wt_client_read on workout_templates
  for select
  using (coach_id = my_trainer_id() and (audience_tag is null or client_has_tag(audience_tag)));
