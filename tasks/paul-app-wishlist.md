# ReDefine Academy — Paul's app wishlist (scope)

Captured 2026-07-23 from Paul's meeting. Brand slug `paul`. This is the feature
list Paul wants in his app. Below: his raw list, a gap-analysis vs what's already
live, and a recommended build order.

## Paul's raw list

**App journey / onboarding (Standard membership)**
- Standard membership tier
- First thing: calorie calculator
- Select goal
- Programme library

**Inner Circle (coached tier)**
- Send invite to join, assign workouts
- Workouts as templates so clients can "start a workout" and choose which to do

**Workout builder — set types**
- Supersets
- Clusters
- Pyramid sets
- Drop sets

**Libraries & nutrition**
- Video library
- Recipe library
- Barcode scanner
- Create nutrition targets for calories and protein (plus other macros if needed)
- Submit form review videos

**Community & access control**
- Lock down visibility based on tags
- Community
- Embed links
- Tag clients

## Gap analysis (vs what's live today)

| Feature | Status | Notes |
|---|---|---|
| Nutrition targets (cals/protein/carbs/fat) | LIVE | Coach sets per client; rings on client home |
| Submit form review videos | LIVE | "Form check" — client uploads clip, AI + coach review |
| Community feed | LIVE (basic) | Post + cheer; no tags/embeds/gating yet |
| Assign workouts | LIVE | Coach builds & sends a session to a client |
| Invite / link client to coach | PARTIAL | Works via trainer code; no "send invite" link/email |
| Calorie calculator (onboarding) | NEW | TDEE from stats + activity |
| Select goal | NEW | Lose / maintain / gain → drives targets |
| Membership tiers (Standard vs Inner Circle) | NEW | Gate features by tier |
| Programme library | NEW | Browsable pre-built programmes a client can follow |
| Workout templates + "start a workout" picker | NEW | Client self-selects a session |
| Supersets / drop sets / pyramid / clusters | NEW | Advanced set structures in the builder |
| Video library | NEW | Technique/exercise videos |
| Recipe library | NEW | Saved recipes (distinct from Fridge-to-Plate AI) |
| Barcode scanner | NEW | Barcode → nutrition lookup |
| Tag clients | NEW | Tagging system |
| Lock visibility by tags | NEW | Tag-gated content/community |
| Embed links | NEW | Rich links in community/content |

## Two-tier model (the spine everything hangs off)

- **Standard membership** — self-serve. Onboarding calculator → goal → auto
  targets → programme library + tracking + libraries + community. No 1:1.
- **Inner Circle** — coached. Invited by Paul, gets assigned workouts, form
  reviews, direct coaching, tag-gated content.

## Recommended build order

**Phase 1 — Onboarding & membership spine — DONE 2026-07-23 (LIVE)**
Calorie calculator (first screen) → select goal → auto-set nutrition targets;
`membership_tier` on profile (standard / inner_circle) to gate the rest.
*Why first: it's the front door and everything gates off the tier.*
- `src/Onboarding.jsx` — Mifflin-St Jeor TDEE calc; stats → goal → targets → saves
  macro_targets + profile stats + starting body measurement; shown by App.jsx when
  a client has no `onboarded_at`.
- Migration `onboarding_and_membership_tier`: profile cols (membership_tier,
  onboarded_at, goal, sex, age, height_cm, activity_level) + `set_member_tier` RPC.
- Coach: Inner Circle badge on client cards + Membership toggle in ClientDetail.
- Verified live: new client walks calculator → lands with correct targets; coach
  badge + tier toggle work.

**Phase 2 — Training depth (Paul's craft) — DONE 2026-07-23 (LIVE)**
Workout templates + client "start a workout" picker; advanced set types
(supersets, drop sets, pyramid, clusters) in the builder.
- Set types: `WorkoutRows.jsx` `SET_TYPES` + per-exercise `set_type`/`group` on
  the row model, carried through `newExerciseRow`/`planToRows`/`rowsToExercises`
  (round-trip safe — verified a client "add weights" edit keeps the chips).
  `ui.jsx` `ExSets` renders a type chip + note; superset shows group + "Drop N".
- `workout_templates` table (migration) + RLS mirroring gym_classes (coach-all;
  client-read via my_trainer_id()).
- Coach: `CoachTemplates` card on dashboard (build/list/delete), gated by
  `features.templates` (paul on). Client: "Start a workout" tab in Train lists
  the coach's templates → Start copies into workout_plans (assigned_by null).
- Verified live end-to-end: coach template with superset+dropset+pyramid → client
  starts it → edits weights → all set-type chips + values survive.

**Phase 2b — Programme library — DONE 2026-07-23 (LIVE)**
Multi-session programmes built from templates; clients browse + start sessions.
- `workout_programs` + `program_sessions` tables (migration) + RLS (coach-all;
  client-read via my_trainer_id(); sessions inherit via parent programme).
  program_sessions snapshot a template's title/focus/exercises/finisher so later
  template edits don't rewrite a published programme.
- Coach: `CoachPrograms` card (create programme w/ weeks+level+desc; add sessions
  by picking a template + day label; list/expand/delete), gated `features.programs`.
- Client: "Programme library" home tile + `ProgramLibrary` screen (browse programmes,
  expand to all sessions w/ set-type chips, Start any session → workout_plans).
- Demo programme seeded: "8-Week Lean Strength" (Intermediate, 3 days). Verified
  live: coach card renders; client browses, starts Day 2 → lands in sessions.

**Phase 3 — Libraries & nutrition — DONE 2026-07-23 (LIVE)**
Recipe library; video library; barcode scanner. (Form review already live.)
- Tables `recipes` + `videos` (migration) + RLS mirroring templates (coach-all;
  client-read via my_trainer_id()). Flags `recipes`/`videos`/`barcode` on paul.
- Coach: `CoachRecipes` + `CoachVideos` cards (create/list/delete).
- Client: Recipe library (browse → log to day), Video library (`ClientApp`
  `videoEmbed()` inlines YouTube/Vimeo, else link-out), Barcode scan.
- Barcode: `netlify/functions/barcode.mjs` hits Open Food Facts (kcal derived
  from kJ if absent; name falls back to brand/barcode; not-found handled).
  Manual entry is first-class; camera via BarcodeDetector only where supported.
- GOTCHA fixed: `nutrition_logs_source_check` only allowed fridge/meal/manual —
  widened to add `recipe`,`barcode` (migration). Logging 400'd until then.
- Verified live: logged a recipe (410 kcal hit the ring), YouTube embed played,
  barcode 3017620422003 → Nutella 539/100g → 30g scaled to 162 kcal → logged.

**Phase 3b — coach form-review queue (optional, not built)**
Form check is already live client-side; a coach-side review queue could be added.

**Phase 4 — Community & access control — DONE 2026-07-23 (LIVE)**
Client tags; tag-gated visibility; embed links.
- `client_tags` table + RLS (coach-all; client-read own) + `client_has_tag(text)`
  SECURITY DEFINER helper. Cols `audience_tag` on community_posts + featured_content,
  `link_url` on community_posts. Flag `tags` on paul.
- Client SELECT policies re-gated: `audience_tag is null OR client_has_tag(audience_tag)`
  — enforced server-side, not client-side.
- Coach: `ClientTags` card on ClientDetail (add/remove); audience selector on the
  community composer + Featured content composer (Everyone / Only: tag).
- Community posts now take a link (embed) — rendered as a clickable hostname link;
  coach view shows an "Only: tag" chip on targeted posts.
- Verified live: tagged Jamie 'prep'; posted a 'prep'-only message + link → Jamie
  (prep) saw it, Ollie (no tag) saw "No posts yet". Link rendered + clickable.

## ALL FOUR PHASES COMPLETE — full platform live on ?brand=paul (2026-07-23)
