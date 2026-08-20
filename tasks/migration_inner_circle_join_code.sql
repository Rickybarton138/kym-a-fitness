-- Applied via Supabase MCP 2026-08-20 (with one immediate bugfix — client_id
-- was wrongly set to v_trainer in the first pass, fixed same session, no bad
-- data created). Paul's ask: a second "Inner Circle" join code, distinct from
-- the standard one, so signup auto-detects which tier a client is joining on
-- and sets membership_tier + the matching client_tags row (tag-gated
-- programme visibility keys off the tag, not membership_tier) — no more
-- manually tagging every new client.
alter table profiles add column trainer_code_ic text unique;

update profiles set trainer_code_ic = upper(substr(md5(gen_random_uuid()::text || id::text), 1, 6))
where role = 'trainer' and trainer_code_ic is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role','client');
  v_name text := new.raw_user_meta_data->>'full_name';
  v_code text := upper(coalesce(new.raw_user_meta_data->>'trainer_code',''));
  v_trainer uuid;
  v_tier text := 'standard';
  v_tag text;
  v_welcome text;
begin
  if v_role = 'trainer' then
    insert into public.profiles(id, full_name, role, trainer_code, trainer_code_ic)
      values (new.id, v_name, 'trainer',
        upper(substr(md5(gen_random_uuid()::text),1,6)),
        upper(substr(md5(gen_random_uuid()::text),1,6)));
  else
    if v_code <> '' then
      select id into v_trainer from public.profiles where trainer_code = v_code and role = 'trainer';
      if v_trainer is not null then
        v_tier := 'standard'; v_tag := 'standard';
      else
        select id into v_trainer from public.profiles where trainer_code_ic = v_code and role = 'trainer';
        if v_trainer is not null then
          v_tier := 'inner_circle'; v_tag := 'inner circle';
        end if;
      end if;
    end if;
    insert into public.profiles(id, full_name, role, trainer_id, membership_tier)
      values (new.id, v_name, 'client', v_trainer, v_tier);
    insert into public.macro_targets(client_id) values (new.id);
    if v_trainer is not null and v_tag is not null then
      insert into public.client_tags(coach_id, client_id, tag) values (v_trainer, new.id, v_tag);
    end if;
    -- auto-send the coach's welcome message, if they've set one
    if v_trainer is not null then
      select welcome into v_welcome from public.coach_personas where coach_id = v_trainer;
      if v_welcome is not null and btrim(v_welcome) <> '' then
        insert into public.messages(client_id, sender, body) values (new.id, 'coach', btrim(v_welcome));
      end if;
    end if;
  end if;
  return new;
end;
$function$;
