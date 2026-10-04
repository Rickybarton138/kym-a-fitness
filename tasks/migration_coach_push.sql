-- The brand-scoped push queue for the coaching engine (2026-10-04).
--
-- WHY THIS EXISTS AT ALL. The nudge RPCs this app already has — `nudges_due`,
-- `daily_reminders_due`, `coach_alerts_due` — take only a shared secret and
-- return EVERY brand's clients. Each brand's site runs its own hourly copy
-- against that one global queue, which is why Rick.Fit's deploy can push to
-- Kim's and Paul's clients. These two take the brand and cannot.
--
-- Three independent gates, so no single mistake sends to a stranger:
--   1. the shared secret, as with every other scheduled RPC here
--   2. `p_brand`, matched against coach_notification_prefs.brand
--   3. prefs.enabled, which defaults false — nobody is in the queue until they
--      switch it on themselves, on that brand
--
-- Scheduling is NOT computed here. Working out whether a session falls today
-- means the programme's week maths, day_map remapping and repeat handling, all
-- of which exist and are tested in src/programSchedule.js. Reimplementing that
-- in PL/pgSQL would be a second copy to keep in step, so this returns the
-- programme rows and the function does the maths with the code that already
-- knows how.

-- Everything one client needs for the sender to decide, in one row.
create or replace function public.coach_push_state(
  p_secret       text,
  p_brand        text,
  p_day          date,
  p_period_start date
)
returns table (
  client_id      uuid,
  coach_id       uuid,
  endpoint       text,
  p256dh         text,
  auth           text,
  prefs          jsonb,
  programme      jsonb,
  trained_today  boolean,
  logged_today   boolean,
  review_exists  boolean,
  sent_today     integer,
  sent_keys      text[]
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare ok boolean;
begin
  select (value = p_secret) into ok from app_config where key = 'nudge_cron_secret';
  if not coalesce(ok, false) then
    raise exception 'bad secret';
  end if;

  return query
  select
    pr.id,
    pr.trainer_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth,
    to_jsonb(np) - 'client_id',
    (
      -- The active assignment plus its sessions, or null. Shaped like
      -- loadClientProgram() so sessionForDay can read it unchanged.
      select jsonb_build_object(
        'asg', jsonb_build_object(
          'start_date', cp.start_date, 'repeat', cp.repeat,
          'day_map', coalesce(cp.day_map, '[]'::jsonb), 'coach_id', cp.coach_id),
        'dayMap', coalesce(cp.day_map, '[]'::jsonb),
        'byCoach', cp.coach_id is not null,
        'title', coalesce(wp.title, 'Your program'),
        'cycleWeeks', coalesce((select max(coalesce(s.week, 1)) from program_sessions s where s.program_id = cp.program_id), 1),
        'sessions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id, 'week', s.week, 'dow', s.dow, 'position', s.position,
            'title', s.title, 'focus', s.focus))
          from program_sessions s where s.program_id = cp.program_id), '[]'::jsonb)
      )
      from client_programs cp
      left join workout_programs wp on wp.id = cp.program_id
      where cp.client_id = pr.id and cp.active
      order by cp.created_at desc
      limit 1
    ),
    exists (select 1 from workout_completions wc where wc.client_id = pr.id and wc.completed_on = p_day),
    exists (
      select 1 from nutrition_logs nl
      where nl.client_id = pr.id
        and nl.logged_at >= (p_day::timestamp at time zone 'Europe/London')
        and nl.logged_at <  ((p_day + 1)::timestamp at time zone 'Europe/London')
    ),
    exists (select 1 from coach_reviews cr
            where cr.client_id = pr.id and cr.brand = p_brand and cr.period_start = p_period_start),
    (select count(*)::int from coach_notifications n
       where n.client_id = pr.id and n.brand = p_brand
         and n.sent_at >= (p_day::timestamp at time zone 'Europe/London')),
    (select coalesce(array_agg(n.dedupe_key), '{}'::text[]) from coach_notifications n
       where n.client_id = pr.id and n.brand = p_brand and n.sent_at is not null)
  from coach_notification_prefs np
  join profiles pr on pr.id = np.client_id
  join push_subscriptions ps on ps.client_id = pr.id
  where np.brand = p_brand
    and np.enabled
    and coalesce(pr.status, 'active') = 'active';
end
$function$;

revoke all on function public.coach_push_state(text, text, date, date) from public, anon, authenticated;

-- Claim a notification BEFORE sending it. The unique index on
-- (client_id, brand, dedupe_key) is what actually prevents a double — two
-- instances running the same minute both call this, and only one gets `true`.
-- Relying on the sender to remember would not survive that.
create or replace function public.coach_push_claim(
  p_secret   text,
  p_client   uuid,
  p_brand    text,
  p_category text,
  p_key      text,
  p_body     text,
  p_url      text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare ok boolean; inserted boolean;
begin
  select (value = p_secret) into ok from app_config where key = 'nudge_cron_secret';
  if not coalesce(ok, false) then
    raise exception 'bad secret';
  end if;

  insert into coach_notifications (client_id, brand, category, dedupe_key, body, url)
  values (p_client, p_brand, p_category, p_key, p_body, p_url)
  on conflict (client_id, brand, dedupe_key) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end
$function$;

revoke all on function public.coach_push_claim(text, uuid, text, text, text, text, text) from public, anon, authenticated;

-- Mark a claimed notification as actually delivered, or record why it was not.
create or replace function public.coach_push_settle(
  p_secret     text,
  p_client     uuid,
  p_brand      text,
  p_key        text,
  p_sent       boolean,
  p_suppressed text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare ok boolean;
begin
  select (value = p_secret) into ok from app_config where key = 'nudge_cron_secret';
  if not coalesce(ok, false) then return; end if;

  update coach_notifications
  set sent_at = case when p_sent then now() else null end,
      suppressed = p_suppressed
  where client_id = p_client and brand = p_brand and dedupe_key = p_key;
end
$function$;

revoke all on function public.coach_push_settle(text, uuid, text, text, boolean, text) from public, anon, authenticated;
