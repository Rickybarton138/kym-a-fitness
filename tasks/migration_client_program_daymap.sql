-- Applied via Supabase MCP 2026-08-23. Paul's ask: let a client "Add to my
-- plan" a whole 12-week program in one go, picking which real weekdays they
-- want to train, instead of adding every week's sessions to their plan one
-- at a time. day_map stores the client's chosen weekdays (sorted array of
-- 0-6); when set, the Home-screen "today's session" lookup maps each week's
-- sessions onto those days BY POSITION (ordered by the session's own dow,
-- falling back to position) rather than the program's original authored dow
-- — so the client's own day choice wins. Null day_map (existing coach-
-- assigned rows) keeps the exact original behaviour: sessions land on
-- whatever weekday the coach set when building the program.
alter table client_programs add column day_map jsonb;

create policy client_programs_client_write on client_programs
  for insert
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from workout_programs p
      where p.id = client_programs.program_id
        and p.coach_id = my_trainer_id()
        and (p.client_id = auth.uid() or (p.client_id is null and (p.audience_tag is null or client_has_tag(p.audience_tag))))
    )
  );

create policy client_programs_client_update on client_programs
  for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());
