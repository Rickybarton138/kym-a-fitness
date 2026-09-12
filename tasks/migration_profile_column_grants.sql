-- Lock down which columns of `profiles` a signed-in user may write. (2026-09-12)
--
-- `profiles_update_own` is USING (id = auth.uid()) and `authenticated` held
-- table-level UPDATE, so a client could write ANY column of their own row.
-- Proven against production with a demo client's own JWT:
--   membership_tier -> 'inner_circle'   (self-upgrade to the paid tier)
--   role            -> 'trainer'        (promote self to coach)
--   trainer_id      -> <anything>       (the serious one)
-- my_trainer_id() reads profiles.trainer_id for the caller, and every
-- coach-content policy keys off it (recipes rc_client_read, videos, programmes,
-- files, community posts). So a client could repoint at another coach and read
-- that coach's entire library — cross-tenant, in a white-label product whose
-- whole promise is that gyms cannot see each other.
--
-- RLS cannot restrict columns. Column-level GRANTs can, and a table-level grant
-- cannot be narrowed by revoking one column — the table grant has to go first
-- and the allowed columns be granted back. That is what this does.
--
-- Everything left out of the GRANT below is writable ONLY by a SECURITY DEFINER
-- function or the service role. That is already the house pattern for every
-- coach-controlled field: set_member_tier, set_step_target, set_water_target,
-- set_client_dob, set_client_health_context, set_nutrition_support,
-- mark_activity_seen, mark_welcome_seen.
--
-- Useful side effect: the allow-list is a whitelist, so any column added to
-- profiles in future is locked to definer-only until someone deliberately opens
-- it. `status` and `is_test` (the pause/disable work) inherit that for free.

revoke update on public.profiles from authenticated, anon;

-- The columns a client legitimately writes about themselves. Each one is
-- written directly by the app today:
--   Onboarding.jsx:130       sex, age, height_cm, activity_level, goal,
--                            onboarded_at, nutrition_sensitive(+_note),
--                            health_conditions, has_kids, single_parent,
--                            shift_worker, life_context_note
--   ClientApp.jsx:106        targets_reviewed_at
--   ClientApp.jsx:3606       nutrition_style
--   ClientApp.jsx:3864       sex, age, height_cm, activity_level, goal
--   ClientApp.jsx:3939       the health-context block
-- full_name is not written by the app yet; it is granted for the account screen
-- that is coming, and a display name is the user's own to change.
grant update (
  full_name,
  sex,
  age,
  height_cm,
  activity_level,
  goal,
  onboarded_at,
  targets_reviewed_at,
  nutrition_style,
  nutrition_sensitive,
  nutrition_sensitive_note,
  health_conditions,
  has_kids,
  single_parent,
  shift_worker,
  life_context_note
) on public.profiles to authenticated;

-- anon gets nothing: an unauthenticated caller has no auth.uid(), so RLS would
-- match no row anyway, but there is no reason for the grant to exist.
