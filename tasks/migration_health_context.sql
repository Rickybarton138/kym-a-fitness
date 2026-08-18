-- Applied via Supabase MCP 2026-08-18. Client-shared health conditions (PCOS,
-- menopause, thyroid, PoTS etc) + life circumstances (kids/single parent/shift
-- work) — Paul's ask, informational context for AI tone only, no calorie maths.
alter table profiles
  add column health_conditions text,
  add column has_kids boolean not null default false,
  add column single_parent boolean not null default false,
  add column shift_worker boolean not null default false,
  add column life_context_note text;

-- Coach-side write (clients can update their own row directly via
-- profiles_update_own; a coach can't write a client's row without this,
-- mirroring set_nutrition_support).
create or replace function public.set_client_health_context(
  p_client uuid, p_conditions text, p_has_kids boolean, p_single_parent boolean,
  p_shift_worker boolean, p_life_note text
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from profiles where id = p_client and trainer_id = auth.uid()) then
    raise exception 'not your client';
  end if;
  update profiles set
    health_conditions = nullif(btrim(coalesce(p_conditions, '')), ''),
    has_kids = coalesce(p_has_kids, false),
    single_parent = coalesce(p_single_parent, false),
    shift_worker = coalesce(p_shift_worker, false),
    life_context_note = nullif(btrim(coalesce(p_life_note, '')), '')
  where id = p_client;
  return true;
end; $$;
