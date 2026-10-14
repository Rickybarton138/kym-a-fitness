# Database audit — 14 Oct 2026

Hardening plan items 3 and 4. The question behind all of it: the app has no
service-role key and relies on the database to enforce account isolation, so
**is the database actually doing it?**

Everything below was read from the live schema, not reasoned about. The clean
results are written down deliberately — the point of an audit is to be able to
say what was checked, so the next person does not re-derive it or assume the
worst.

## One real finding: the daily AI limit was advisory

`coach_usage` holds one row per client per day with a `calls` count, and its
policy was:

    coach_usage_own   ALL   using (client_id = auth.uid())
                            with check (client_id = auth.uid())

**ALL, not SELECT.** So the person being rate-limited could `UPDATE` their own
row back to zero, or `DELETE` it, from the browser console. The row was
correctly restricted *to* them, and that was exactly the problem — the same
shape as the `trainer_id` hole in `migration_profile_column_grants.sql`, where
rows were restricted and columns were not.

Second fault found on the way: `withinDailyLimit` read the row, added one and
wrote it back, which is three round trips and not atomic. A week-long meal plan
fires nine calls at once, several read the same number, and all write the same
number back — **nine calls counted as one.** The ceiling was leaking in both
directions at once.

Fixed in `tasks/migration_coach_usage_counter.sql`: `coach_usage_bump(p_day,
p_limit)`, which does it in one statement, takes the identity from `auth.uid()`
rather than a parameter, and refuses a null session. Part 1 (the function) is
applied. **Part 2 — revoking the direct write — is deliberately NOT applied**,
because `withinDailyLimit` fails open by design and the database is shared by
seven sites: revoking while a brand still does its own read-add-write would move
that brand from an advisory limit to no limit at all. It is the last step of the
Phase 2 rollout.

Verified: `anon` calling the RPC gets `401 permission denied for function
coach_usage_bump` — refused at the grant, before the body runs.

### A trap worth remembering

`revoke execute ... from anon` did nothing. Postgres grants `EXECUTE` on a new
function to `PUBLIC` by default and `anon` inherits it, so the revoke has to name
`PUBLIC`. The first attempt looked like it had worked and had not;
`has_function_privilege('anon', oid, 'EXECUTE')` is what showed it. This is also
why the Supabase advisor lists **45** functions as anon-executable — that is the
default PUBLIC grant, not 45 separate decisions.

## Checked and clean

**The `p_client`-taking setters** (`set_client_dob`, `set_step_target`,
`set_water_target`, `set_member_tier`, `set_nutrition_support`,
`set_client_status`, `set_client_test`, `set_client_health_context`,
`sync_achievements`). All `SECURITY DEFINER`, so the body is the only
authorisation. Every one gates on `trainer_id = auth.uid()` or
`is_my_client(...)` and raises `'not your client'` — a real gate, not a mention.
All pin `SET search_path TO 'public'`.

**The functions taking some other object id.** This was the class most likely
to hide something, because referencing `auth.uid()` somewhere is not the same as
scoping by it:

- `cancel_booking(p_id)` — selects `where id = p_id and client_id = auth.uid()`
  and raises if nothing comes back, so it can only cancel the caller's own
  booking. The waitlist promotion that follows does touch another person's row,
  which is the intended business rule, not a leak.
- `book_class(p_class, p_date)` — requires the caller's `trainer_id` to be the
  class owner, and inserts `client_id = auth.uid()`, ignoring anything supplied.
- `class_session_counts(p_owner, ...)` — returns nothing unless `p_owner` is the
  caller or the caller's own trainer.
- `coach_activity(p_limit)` — takes no id at all, and every one of its eleven
  branches inner-joins a `profiles where trainer_id = auth.uid()` CTE. For an
  anonymous caller `auth.uid()` is null, the CTE is empty, and the whole union
  returns nothing.
- `vald_connect(...)` — requires `role = 'trainer'` and stores `auth.uid()` as
  the coach, so the credentials cannot be filed under someone else.

**The 19 secret-taking RPCs** (`nudges_due`, `daily_reminders_due`,
`coach_alerts_due`, `reminders_due`, `coach_digest`, `coach_push_state`,
`coach_push_claim`, `coach_push_settle`, `rickfit_daily_state`,
`exercise_guide_put`, `nudge_drop`, the four `*_mark_sent`, and the four
`vald_*`). Every one reads the secret from `app_config`, gates on
`coalesce(ok, false)` — so a missing key fails closed — and pins `search_path`.
**Nothing is callable without the secret.** That answers hardening plan item 4's
open question. The secret is 48 characters, and `app_config` has RLS on with no
policies at all, so it is unreadable through the API.

These RPCs are called by the cron senders using the publishable key, i.e. as
`anon`. **Do not revoke anon EXECUTE on them** in response to the advisor's
45-function warning: that would kill every scheduled send on every brand, and
they already fail closed.

**Policies on the newer coaching tables:**

| Table | Verdict |
|---|---|
| `profiles` | No INSERT policy at all, so the column-level INSERT grants are dead. UPDATE is removed from the table grants and allowed per-column only — the September fix holds, and `trainer_id`, `role`, `status`, `membership_tier`, `is_test` are not writable. |
| `push_subscriptions` | `ALL` with `with check (client_id = auth.uid())`. A client cannot register an endpoint under another client and receive their notifications. |
| `exercise_guides` | A SELECT policy only — `true`, read by every brand by design. **No write policy exists**, so despite the table grants nothing can be written through the API; the only writer is `exercise_guide_put`, which needs the secret. The shared cache cannot be poisoned. |
| `coach_notifications` | Own row (`ALL`), plus coach read via `is_my_client`. |
| `workout_templates` | Coach owns their own; a client reads only their own coach's visible ones, with the audience tag honoured. |

## Not done, and why

**CORS is still `*` on the functions, and should stay that way for now.** The
hardening plan listed narrowing it to the known brand hosts. With the AI
endpoints authenticated, `*` is no longer the thing standing between a stranger
and the Anthropic key — the token is. Narrowing it would break the native
shell, which runs on `https://localhost` and is cross-origin to every brand, and
CORS never stopped a non-browser caller anyway. The wrong order: narrow CORS and
you make the app more fragile while the caller who matters is unaffected.

**Giving the counter per-feature buckets.** A `kind` column would let the nine
AI endpoints have their own ceiling instead of sharing coach chat's 120. It
needs the primary key widened from `(client_id, day)`, and the four brands still
running the old code upsert on exactly that key — so it would break them
mid-rollout. After Phase 2.

## Ricky's call

**Leaked-password protection is off** in Supabase Auth. Turning it on checks new
passwords against HaveIBeenPwned so a client cannot set one from a known breach.
It is an account setting rather than a code change, and it is his to flip.
Worth checking the plan supports it before promising it. MFA options are
similarly thin, which matters much less for a coaching app than it would for
anything holding money.
