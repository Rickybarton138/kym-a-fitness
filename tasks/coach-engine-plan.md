# Rick.Fit proactive coaching engine — plan (2026-10-04)

## Note on the two documents I was asked to read

`tasks/rick-fit-audit-2026-09-10.md` and `tasks/rick-fit-implementation.md` **do not
exist** — not in `tasks/`, not anywhere under the home directory, and not in git
history (`git log --all --diff-filter=A -- "*rick-fit*"` is empty). So there are no
findings to verify against the code; everything below is derived from the code and
the live schema instead, which is what verification would have amounted to anyway.

## What is already there (verified, not assumed)

- `netlify/functions/analyze.mjs` has an `ask` mode, but **the client assembles the
  context and posts it** (`knowledge`, `comms`, `persona`, `healthContext` …) and the
  function has **no authentication at all** — it trusts the body. `src/lib.js:47`
  `analyze()` sends no Authorisation header. That is the thing to fix first, because
  every requirement here adds personal data to that endpoint.
- Tables that already hold what the context needs, so nothing is re-invented:
  `workout_plans` (`scheduled_for`, `exercises` jsonb written back on Finish),
  `workout_completions` (**confirmed** completions), `session_loads` (rpe/duration/load),
  `lift_entries` (named lift + weight + date), `client_programs` + `program_sessions`
  (+ `day_map`), `nutrition_logs`, `food_day_complete`, `macro_targets` +
  `macro_target_history` (`effective_from`, so a past day scores against the target it
  was actually chasing — `targetOn()` in `src/lib.js`), `daily_steps` (steps + water_ml),
  `body_measurements`, `readiness_checkins`, `weekly_checkins`, `soreness_logs`,
  `brain_chats`, `recipes` (`tags` array), `client_meal_plans`, `strava_connections`,
  `push_subscriptions`, `accountability_settings`.
- `readiness_checkins` exists with sleep/energy/freshness/mood/motivation/note. It has
  **no soreness and no available-time** column — those two need adding.
- There is **no structured dietary/allergy field** anywhere. `profiles.health_conditions`
  and `nutrition_sensitive_note` are free text. Allergies will live in new client-owned
  coach memory rather than in `profiles`, whose column GRANTs are deliberately locked
  down (`tasks/migration_profile_column_grants.sql`).
- Push already works: `push-lib.mjs` + scheduled functions, VAPID set, SECURITY DEFINER
  RPCs gated by `NUDGE_CRON_SECRET`. **Known defect, pre-existing:** those RPCs take only
  `p_secret` and return every brand's clients, so any brand's site can push to another
  brand's clients. New sends must not inherit that.

## Shape

Deterministic rules decide WHAT to say; the model only writes the prose. Pure modules
hold all the logic so it is testable without a database or an API key.

- `src/coachTime.js` — Europe/London civil dates, DST-correct, usable in a UTC Netlify
  function. Everything date-related goes through it.
- `src/coachContext.js` — PURE: shapes raw rows into one versioned context; separates
  planned from completed, missing from zero; records freshness per slice.
- `src/coachRules.js` — PURE: priority-ordered next action with the evidence it used.
- `src/coachNotify.js` — PURE: category/quiet-hours/frequency/suppression/dedup decisions.
- `netlify/functions/_auth.mjs` — identity from the verified session; validation, size
  limit, timeout, per-user rate limit.
- `netlify/functions/_context.mjs` — scoped loader. Queries run **as the user**
  (publishable key + the user's access token), so RLS enforces isolation rather than my
  code doing it.
- `netlify/functions/coach.mjs` — one authenticated endpoint: `today`, `feedback`,
  `chat`, `review`, `readiness`.
- `netlify/functions/coach-notify.mjs` — scheduled sender, **off by default**.
- UI, all behind `THEME.features.coach`: `CoachCard`, `CoachFeedback`, `Readiness`,
  `WeeklyReview`, `CoachMemory`, and the existing Ask screen upgraded.
- `src/coachClient.js` — token attach, request-sequence guard, foreground/save refresh,
  session cache.

## Order

1. coachTime + tests
2. coachContext + tests
3. coachRules + tests
4. _auth + _context + coach.mjs
5. coachClient + UI
6. notifications (pure + sender, disabled)
7. migrations
8. verify: unit tests, build:ricky, build:kim, mobile-width drive of the dev server

## Boundaries set by the brief

- No deploy, no production infrastructure changes: migrations are written and listed in
  SETUP, **not applied**. Everything that depends on them is therefore unverified
  against a live database and is called out as such.
- No production accounts and no test activity written to production: new tests use
  fixtures and mocks only. The existing `tasks/e2e_*.mjs` scripts that sign in as real
  test clients are left alone and NOT run.
