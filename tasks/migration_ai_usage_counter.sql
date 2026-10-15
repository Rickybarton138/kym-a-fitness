-- A real ceiling on the ten AI endpoints.
--
-- WHY THIS IS NEEDED, and why it is not optional. Authenticating those
-- endpoints on 14 Oct 2026 was worth doing, but it does not stop a determined
-- caller, and it is important to be straight about that:
--
--   Signup is open on this project (it has to be — it is how Kim and Paul
--   onboarded), email confirmation is off, and `handle_new_user` takes the role
--   from `raw_user_meta_data->>'role'`, which is client-supplied. The app's own
--   sign-up screen has an "I'm the coach" button that sets it. So one POST to
--   /auth/v1/signup with the publishable key returns a TRAINER session, and
--   that session satisfies both requireAiUser and requireCoach.
--
-- What the auth pass actually bought, then: every call is now attributable to
-- an account, and — with this — cappable. It did not make the endpoints
-- unreachable. A ceiling per account is what turns "spend the whole balance in
-- a loop" into "spend 200 calls, then make another account", which is a cost
-- an attacker has to keep paying and a pattern that shows up in the logs.
--
-- WHY A NEW TABLE rather than reusing `coach_usage`. Giving the AI endpoints
-- their own bucket in `coach_usage` means widening its primary key from
-- (client_id, day), and the four brands still running the old code upsert on
-- exactly that key — it would break them mid-rollout. A separate table is
-- purely additive: no existing code touches it, so there is no rollout hazard
-- and this can be applied today.
--
-- It also keeps the two ceilings honest. Coach chat has its own 120 a day; a
-- week-long meal plan is nine calls on its own, and sharing one counter would
-- mean a busy Sunday of meal planning silently stopping the coach from
-- answering. That is a worse bug than the one being fixed.

create table if not exists public.ai_usage (
  client_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  calls integer not null default 0,
  primary key (client_id, day)
);

alter table public.ai_usage enable row level security;

-- Read only, for the owner and their coach. NOT `ALL` — that is the mistake
-- `coach_usage` shipped with, where the person being limited could UPDATE their
-- own counter back to zero because the row was theirs. The only writer here is
-- ai_usage_bump below, which runs as the table owner.
drop policy if exists ai_usage_read_own on public.ai_usage;
create policy ai_usage_read_own on public.ai_usage
  for select using (client_id = auth.uid());

drop policy if exists ai_usage_coach_read on public.ai_usage;
create policy ai_usage_coach_read on public.ai_usage
  for select using (public.is_my_client(client_id));

revoke insert, update, delete on public.ai_usage from authenticated, anon;
grant select on public.ai_usage to authenticated;

-- One statement, so concurrent calls cannot all read the same number and all
-- write the same number back. A week-long meal plan fires nine at once, which
-- is exactly how the old `coach_usage` arithmetic lost count.
--
-- The identity is auth.uid() and is NOT a parameter: a parameter could name
-- somebody else's quota, and this runs as the owner, so nothing would stop it.
create or replace function public.ai_usage_bump(p_day date, p_limit integer default 200)
returns table(allowed boolean, used integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_used integer;
begin
  if v_uid is null then
    raise exception 'no session';
  end if;

  -- A ceiling under one has to be handled here: a brand-new row has no
  -- conflict, so the DO UPDATE's WHERE never sees it and the first call of the
  -- day would be allowed regardless of the limit.
  if greatest(p_limit, 0) < 1 then
    select calls into v_used from ai_usage where client_id = v_uid and day = p_day;
    return query select false, coalesce(v_used, 0);
    return;
  end if;

  insert into ai_usage (client_id, day, calls)
    values (v_uid, p_day, 1)
  on conflict (client_id, day) do update
    set calls = ai_usage.calls + 1
    where ai_usage.calls < greatest(p_limit, 0)
  returning ai_usage.calls into v_used;

  if v_used is null then
    select calls into v_used from ai_usage where client_id = v_uid and day = p_day;
    return query select false, coalesce(v_used, 0);
    return;
  end if;

  return query select true, v_used;
end
$function$;

comment on function public.ai_usage_bump(date, integer) is
  'Atomically count one AI-endpoint call against today''s ceiling for the CALLER. Identity from auth.uid(), never a parameter. See tasks/migration_ai_usage_counter.sql.';

-- `revoke from anon` alone would do nothing: Postgres grants EXECUTE on a new
-- function to PUBLIC by default and anon inherits it. Name PUBLIC.
revoke execute on function public.ai_usage_bump(date, integer) from public;
revoke execute on function public.ai_usage_bump(date, integer) from anon;
grant execute on function public.ai_usage_bump(date, integer) to authenticated;
