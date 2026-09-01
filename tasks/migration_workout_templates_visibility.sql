-- Applied via Supabase MCP 2026-09-01.
--
-- Paul, relaying a client: "every session I have built for any client is
-- showing in his list of sessions". True, and self-inflicted. The programme
-- builder was auto-publishing every custom-built session into the coach-wide
-- template library (TrainerApp addSession), and wt_client_read shows an
-- untagged template to EVERY client of that coach. 13 of Paul's 14 templates
-- were created that way on 30 Aug, so all his clients saw the same 13.
--
-- audience_tag was the only lever, and it is the wrong one: it answers "which
-- group is this for", not "is this shared at all". Hiding a template meant
-- inventing a tag nobody holds (Paul had already resorted to tagging one
-- "none"). So visibility gets its own column.
--
-- The client_schedule branch is deliberate: a template the coach has put on a
-- client's weekday is assigned work, and must stay readable even when it is not
-- shared to the library — otherwise hiding one blanks that client's day, which
-- is the disappearing-session bug all over again.
alter table workout_templates
  add column if not exists visible_to_clients boolean not null default true;

drop policy if exists wt_client_read on workout_templates;
create policy wt_client_read on workout_templates
  for select
  using (
    coach_id = my_trainer_id()
    and (
      (visible_to_clients and (audience_tag is null or client_has_tag(audience_tag)))
      or exists (
        select 1 from client_schedule cs
        where cs.template_id = workout_templates.id and cs.client_id = auth.uid()
      )
    )
  );

-- Un-publish the auto-saved ones. Not deleted: they are Paul's sessions and
-- stay in his library, pickable for building weeks 2-4 (wt_coach_all ignores
-- this column) and one toggle away from being shared on purpose.
update workout_templates set visible_to_clients = false
where coach_id = (select id from profiles where full_name = 'Paul Andrews' limit 1)
  and created_at::date = '2026-08-30';
