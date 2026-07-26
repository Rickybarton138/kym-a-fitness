# ReDefine Academy — Paul's feedback ROUND 2 (post-use)

Captured 2026-07-26 after Paul used the live client app. Brand slug `paul`.
Below: his raw asks, what's ALREADY built (so we don't rebuild), genuine
decisions to confirm, and a recommended phased build order (phases 5+).

Round-1 scope (phases 1-4, all live) is in `paul-app-wishlist.md`.

---

## Direct questions Paul asked (answers)

- **"Are targets calculated when they join?"** — YES. The onboarding calculator
  (Mifflin-St Jeor TDEE → goal → macro targets) runs on first login and writes
  `macro_targets`. Live since phase 1.
- **"Calorie calculator tab to recalculate?"** — not yet a standalone tab; the calc
  logic exists in `Onboarding.jsx`, just needs surfacing as a re-runnable screen.
- **"Programme library as part of standard join-up?"** — the pieces exist (onboarding
  + programme library); needs wiring into one join flow (join → pay → calc → pick programme).

---

## Triage

### A. Quick wins — copy / gating / regroup existing features
- Tone level 4 "she means it" → gender-neutral (Paul is male). Make tone copy neutral
  or coach-gender aware.
- In-app **Calorie calculator** tab (reuse Onboarding calc; recalculate any time).
- **RPE** (1-10 intensity) field per workout/session.
- **Nutrition tab** grouping: scan meal + fridge scan + log food + barcode + recipes
  under one Nutrition entry.
- **Training tab** grouping: muscle targeter + today's session + performance testing/PBs
  + programme library under one Training entry.
- New **bottom toolbar**: Home · Train · Log food · Recipes · Video Library · Progress.
- **Video library folders** by tag (nutrition / mindset / lifestyle) — tags already exist.
- **Supplements** section — link to Protein Works affiliate + 10% discount code.
- **Shop** section — link to Paul's book on Amazon etc.
- **Podcasts** section (coach-managed links).

### B. Daily agenda + guided workout
- **Daily agenda** on home = today's actions:
  - Monday → check-in (fill form + update measurements + photos).
  - Steps action vs an assigned **step target** (coach sets).
  - **Start workout** button: on a scheduled training day the planned session is ready;
    on a rest day, "add a session" → pick one of their workouts as template / build own /
    ask AI.
- **Guided workout player**: super-simple "start a workout" that walks them through —
  tick each set as done, log weight/sets/reps (+ RPE), with a how-to **video per exercise**.
- **Scheduled programme → daily actions**: a 12-week programme that says what to train on
  which day and surfaces daily actions.

### C. Programme library upgrades
- **Filters**: home vs gym · equipment vs bodyweight · men's/women's · goal.
- **Gate by membership** (see decision D1).
- Slot into the standard join-up flow.

### D. Progress hub
- One space: progress photos + **side-by-side compare**, body scan, measurements, weight,
  plus **training progress** (in-gym strength/volume over time).
- Visible to **both** coach and client.

### E. Check-in form builder (biggest new build)
- Paul creates check-in forms. His default template fields:
  calorie target hit (over/under) · steps hit (avg daily) · protein hit (over/under) ·
  fluids 2-3l/day · sessions hit · strength /10 · energy&recovery /10 · appetite /10 ·
  sleep /10 · stress /10 · challenges (text) · wins (text) · confidence next week /10 ·
  events coming up (text).
- Client fills weekly; results flow to coach.

### F. Community + files + welcome + nutrition tone
- **Community groups** by tag + **pin posts** (tags + audience gating already exist).
- **Files** section — coach uploads shared PDFs (general nutrition doc etc.); each client
  can view. Needs **Supabase Storage** (new bucket).
- **Scheduled welcome message** in app chat on standard join + next-steps.
- **Nutrition tone levels** (mirror the existing detail toggle): "Lifestyle changes"
  (relationship with food, calorie intake, nutrient quality, include foods they like) vs
  "Performance & recovery optimisation" (nutrient timing, macro splits, maximise results).

### G. Coaching-side IA restructure (threads through everything)
Section the coach app: **Clients** (list, filter by tag / payment plan; drill into each:
info, programme, nutrition plan, performance, training adherence, progress physical+gym) ·
**Training** (inner-circle programmes + library programmes) · **Nutrition** (plans + recipes) ·
**Community** (groups + pin) · **Shop** · **Supplements** · **Podcasts**.

---

## Decisions to confirm with Paul (via Ricky)

- **D1. "Lock down programme library for standard members"** — does Paul mean gate access
  behind active/paid membership, OR curate which programmes standard vs inner-circle see?
  (Recommend: tier-based visibility — standard sees library programmes, inner-circle also
  sees coach-assigned. Plus an active-membership gate.)
- **D2. Form builder scope** — full drag-drop custom builder, or ship Paul's exact default
  template first (fast) and add a builder later? (Recommend: template first.)
- **D3. Files** — confirm Supabase Storage bucket is fine (his infra, ~free at this scale).

---

## Recommended build order
5. Quick wins (A) — **DONE + LIVE 2026-07-26** (two deploys). Emerald/gold brand
   colours from Paul's real logo; brand-driven grouped nav (Home/Train/Nutrition/
   Videos/Progress/Coach) via themes.js `nav` (Kim/PPH/BBL untouched); Train +
   Nutrition hubs; in-app calorie recalculator (baseline-safe); video folders by
   tag; tone level-4 copy fix; Supplements/Shop/Podcasts (`coach_links` table +
   coach manager + client sections); per-exercise RPE (round-trip verified).
   Commits 2d8e90e + 865a4e1. Still `logo: null` — awaiting Paul's logo PNG.
6. Daily agenda + guided workout (B). **DONE + LIVE 2026-07-26.**
   - 6A: "Today's plan" agenda card (log food / steps vs coach target / train /
     weekly check-in when due) + step tracking (`daily_steps` + `set_step_target`
     RPC + coach field). Kept AccountabilityCard (push-notification route). Commit 518b3f3.
   - 6B: guided workout player — tick sets, log reps/weight, RPE + set-type chips,
     Finish → merges logged values into the exercise JSON (preserves set_type/rpe/
     cue) + marks a completion (dedup-guarded) + refreshes the agenda. Handles
     legacy count-shape plans. Per-exercise how-to video renders when `ex.video`
     is set.
   - OPEN DECISION for Ricky: exercise how-to videos. Options — (a) YouTube search
     link per exercise (fast, but sends clients to rival coaches' videos), or
     (b) coach attaches a demo URL per exercise (small follow-up, no rival links).
     Shipped with (b)'s hook only; no generic search link until Ricky decides.
   - 6C (scheduled programme -> daily "today's session") still deferred; agenda's
     Train item currently links to the Train hub.
7. Progress hub (D) — **DONE + LIVE 2026-07-26.** Progress tab is now a hub
   (gated `features.progressHub`): Photos with side-by-side compare
   (`ProgressPhotos.jsx`, shared client+coach), Body scan, Measurements, Training
   (in-gym strength). Coach sees the same compare in ClientDetail. Kim's Body
   screen unchanged. Also shipped the (b) decision: per-exercise how-to video —
   coach attaches a URL in the builder, player embeds/links it.
   **7B — Programme-library filters DONE + LIVE 2026-07-26** (commit pending):
   `workout_programs` gained location/equipment/audience (goal already existed);
   `programMeta.js` defines the dimensions; coach create form tags a programme;
   client library has a filter bar (unspecified programmes stay visible). Verified
   filtering discriminates both ways. Phase 7 fully complete.
8. Check-in form builder (E) — **DONE + LIVE 2026-07-26.** Coach builds/edits a
   check-in form (`checkin_forms`), one-tap loads Paul's exact 14-field template;
   field types scale-10/over-under/number/yes-no/text. Client answers the most
   recent form dynamically; responses (`checkin_responses`) snapshot the fields so
   old answers keep their labels after edits. Coach reviews + replies. Agenda
   check-in item is brand-aware (queries checkin_responses for Paul). Gated
   `features.checkinForms`; Kim's fixed weekly check-in untouched. No field
   reordering in v1 (delete + re-add). `checkinForms.js` holds types+template.
9. Community/files/welcome/nutrition-tone (F) — **DONE + LIVE 2026-07-26.**
   - Files: `coach-files` PUBLIC bucket (folder-scoped write, public read — no signed
     URLs) + `coach_files` table (videos RLS). Coach uploads PDFs; client Files section.
   - Pinned posts: `community_posts.pinned` + coach Pin/Unpin; pinned sorts to top
     (universal — small additive change to CommunityFeed). Groups = tag-gated feeds
     (audience_tag, already live); no separate spaces.
   - Welcome message: coach sets welcome text on `coach_personas.welcome`; new client's
     onboarding calls `seed_welcome_message()` RPC (SECURITY DEFINER — a client can't
     write a sender='coach' message; idempotent, no-op if any message exists).
   - Nutrition tone: client picks lifestyle/performance (`profiles.nutrition_style`);
     threaded via `setNutritionStyle` into every AI call; `styleLine()` appended at the
     END of the nutrition prompts in analyze.mjs (keeps the cache prefix stable).
     Verified prod returns a performance-style answer.
   Gated `features.files`/`nutritionStyle`; Kim untouched (welcome only fires if coach
   set welcome text). **ALL PHASES 5-9 COMPLETE.**
- Coaching-side IA restructure (G) folded in as each area is touched.

Cost note: most of round 2 is zero-AI (agenda, progress, forms, files, links) or
mechanical Haiku (guided workout parsing). Modest COGS impact; the levers from
`analyze.mjs` already cover the new text calls.
