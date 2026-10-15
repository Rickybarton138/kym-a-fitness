-- The daily AI call limit was advisory: the person it limits could reset it.
--
-- 14 Oct 2026, found in the hardening pass. `coach_usage` holds one row per
-- (client_id, day) with a `calls` count, and `withinDailyLimit` in
-- `netlify/functions/_auth.mjs` read it, added one, and wrote it back through
-- PostgREST as the caller. The policy allowing that was:
--
--     coach_usage_own   ALL   using (client_id = auth.uid())
--                             with check (client_id = auth.uid())
--
-- ALL, not SELECT. So the client could UPDATE their own row back to zero, or
-- DELETE it, from the browser console — and the ceiling meant nothing. Same
-- shape as the `trainer_id` hole in `migration_profile_column_grants.sql`:
-- the row was correctly restricted TO them, and that was the problem.
--
-- The second fault is a race, and it is not hypothetical on this app. Read,
-- add one, write back is three round trips, and Netlify runs many concurrent
-- short-lived instances. A week-long meal plan fires nine calls at once, so
-- several read the same number and all write the same number back: nine calls
-- counted as one.
--
-- Both are fixed by moving the increment into the database, where it is one
-- statement.
--
-- ---------------------------------------------------------------------------
-- PART 1 — apply now. Purely additive: nothing that exists stops working.
-- ---------------------------------------------------------------------------

-- The counter, incremented atomically and only up to the ceiling.
--
-- `p_limit` is passed by the caller rather than hardcoded so the ceiling stays
-- one decision in one place (`_auth.mjs`), and because a caller cannot raise
-- its own allowance by lying about it — a bigger number only lets them spend
-- more of their OWN quota, and the identity is not theirs to choose.
--
-- The identity comes from `auth.uid()` and is NOT a parameter. That is the
-- whole point: a parameter could name somebody else, and this function runs as
-- the owner, so there would be nothing to stop it.
create or replace function public.coach_usage_bump(p_day date, p_limit integer default 120)
returns table(allowed boolean, used integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_used integer;
begin
  -- No session, no counter. Anonymous callers reach this function because
  -- PostgREST exposes it, and refusing here is what stops one sharing a row
  -- with everybody else.
  if v_uid is null then
    raise exception 'no session';
  end if;

  -- A ceiling of zero means "allow nothing", and the insert below would
  -- otherwise allow exactly one: a brand-new row is created with calls = 1
  -- without consulting the limit at all, because there is no conflict for the
  -- DO UPDATE's WHERE to refuse. Handled here rather than in the statement,
  -- where it is the one case the ON CONFLICT clause cannot see.
  if greatest(p_limit, 0) < 1 then
    select calls into v_used from coach_usage where client_id = v_uid and day = p_day;
    return query select false, coalesce(v_used, 0);
    return;
  end if;

  -- One statement, so two concurrent calls cannot both read 5 and both write 6.
  -- The WHERE on the DO UPDATE is what makes the ceiling atomic as well as the
  -- increment: at or over the limit the update matches nothing, RETURNING gives
  -- no row, and v_used stays null.
  insert into coach_usage (client_id, day, calls)
    values (v_uid, p_day, 1)
  on conflict (client_id, day) do update
    set calls = coach_usage.calls + 1
    where coach_usage.calls < greatest(p_limit, 0)
  returning coach_usage.calls into v_used;

  if v_used is null then
    -- Refused. Report what they have actually used rather than a guess.
    select calls into v_used from coach_usage where client_id = v_uid and day = p_day;
    return query select false, coalesce(v_used, 0);
    return;
  end if;

  return query select true, v_used;
end
$function$;

comment on function public.coach_usage_bump(date, integer) is
  'Atomically count one AI call against today''s ceiling for the CALLER. Identity from auth.uid(), never a parameter. See tasks/migration_coach_usage_counter.sql.';

revoke execute on function public.coach_usage_bump(date, integer) from anon;
grant execute on function public.coach_usage_bump(date, integer) to authenticated;


-- ---------------------------------------------------------------------------
-- PART 2 — APPLIED 15 Oct 2026.
-- ---------------------------------------------------------------------------
--
-- The precondition turned out to be met immediately, so this did not have to
-- wait for the brand rollout after all. The precondition is "every site whose
-- clients call coach.mjs runs the new code", and the coaching engine is gated
-- on `features.coach` in src/themes.js, which is set for Rick.Fit ONLY. The old
-- coach.mjs on the other four brands has no callers at all, so there was
-- nothing left to fail open. Rick.Fit was already on the deploy that counts
-- through coach_usage_bump.
--
-- Applied as migration `coach_usage_counter_part2_revoke_direct_write`. The
-- statements are below as a record; they do not need running again.
--
-- This is what actually closes the hole, and it must be the LAST step, after
-- every brand is running code that calls `coach_usage_bump`. The database is
-- shared by all seven sites. `withinDailyLimit` fails OPEN by design — a
-- broken counter must not take the coaching feature out — so revoking the
-- direct write while a brand still does its own read-add-write moves that
-- brand from an advisory limit to NO limit at all. Strictly worse than today.
--
-- Run it as the final step of the Phase 2 rollout in
-- tasks/hardening-pass-1.md, and re-run the advisor check afterwards.
--
--   drop policy if exists coach_usage_own on public.coach_usage;
--
--   -- Read your own, so a usage figure can be shown in the app. Nothing more:
--   -- the only writer is coach_usage_bump, which runs as the owner.
--   create policy coach_usage_read_own on public.coach_usage
--     for select using (client_id = auth.uid());
--
--   revoke insert, update, delete on public.coach_usage from authenticated, anon;
--
-- `coach_usage_coach_read` (select, is_my_client) is untouched by all of this.
