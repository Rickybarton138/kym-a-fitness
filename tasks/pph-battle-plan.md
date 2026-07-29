# PPH BATTLE PLAN
### Winning The Physical Performance Hub (Jordan) against Lumin Sports

---

## 1. What Lumin Sports is — and where it's weak

**What it is:** a SaaS Athlete Management System (AMS) — a centralised data hub, coach web dashboard, and athlete mobile app. It positions on being *affordable* versus the enterprise pack (Kitman Labs, Smartabase, Kinduct). Modules span S&C programming, physical testing, wellbeing/load monitoring, medical/EMR, scheduling, in-app messaging, wearable integrations, and a tablet "Team Training Mode" for the gym floor.

**The catch:** coaches get a full dashboard; **athletes get a data-entry-and-viewing tool** — fill in surveys, see the schedule, read results, chat. It's a system athletes *feed*, not one that *coaches* them.

**Its four structural holes — this is our opening:**
1. **No nutrition.** Zero meal/diet/fridge tracking. An entire dimension absent.
2. **No AI / no generative coaching.** No AI programming, no conversational coach, no plain-English data explanation. Purely dashboards + manual human analysis.
3. **Passive athlete app.** Self-report data entry, not an engaging coached experience — the classic AMS adherence problem.
4. **No white-label.** Lumin's brand on every screen. No own-brand story for a private hub.

Plus pricing/gating pain: wearables locked behind Core (~$2k), EMR locked behind Pro (~$3.35k); Lite is thin.

---

## 2. The field, briefly

The AMS/S&C category (TeamBuildr, Smartabase/Teamworks, Bridge Athletic, Kitman, VALD, CoachMePlus, Output, Teamworks) is **strong and mature on two things we must simply match:** programming + load tracking, and objective data + device integrations (force plates, GPS, EMR, 60+ syncs — the elite end owns "research-grade" credibility).

It is **uniformly weak on four things — and that's where we win:**
- **Nutrition** is an afterthought everywhere — bolted-on questionnaires at best. A real fridge-to-plate + meal-scan engine is white space.
- **No real generative AI** — "AI" in this category means predictive injury stats, not a coach that writes and explains plans.
- **Poor athlete engagement** — athlete apps are compliance tools; retention and habit-building are ignored.
- **Locked branding + enterprise-only pricing** — vendor-branded, quote-gated, priced for pro clubs. Accessible own-brand pricing is unserved.

---

## 3. What a performance hub actually needs (day-to-day)

A hub like PPH blends a private gym, a physio clinic and a sports-science lab. The prioritised jobs-to-be-done:

1. **Programme & deliver training** — build/assign individual or squad programmes; log sets/reps/load/RPE from a phone or tablet on the gym floor.
2. **Capture daily monitoring** — fast wellness/sleep/soreness check-in + session RPE; compute acute:chronic load and readiness.
3. **Flag risk automatically** — surface ACWR spikes, load drops and wellness red flags to the coach *before* problems escalate.
4. **Run & store testing batteries** — protocols, norms, personal history, trends, asymmetries.
5. **Manage injury & return-to-play** — injury log, rehab assignment, RTP stage-gates, clearance sign-off, availability status.
6. **Single source of truth per athlete** — history, tests, loads, injuries, goals, positions.
7. **Two-way comms & adherence.**
8. **Nutrition & fuelling.**
9. **Report to stakeholders** (parents, clubs, referrers).
10. **Schedule & admin.**
11. **Wearable/device integration.**
12. **Multi-coach roster management.**

Highest MVP leverage: **1, 2, 3, 6** — programming, daily monitoring, automatic red-flag surfacing, unified athlete record.

---

## 4. What our app already delivers vs the gaps

PPH is a **one-line flag flip** on the shared "Coached by Kim" platform. In `src/themes.js`, the PPH brand carries `features: { testing, squads, nutritionExpert, monitoring, growth }` — every capability below gates on `THEME.features?.x`, verified in the code. Turning the performance layer on is config, not a build.

### HAVE — already maps to an AMS
- **testing** (`perfTests.js`) — performance-test battery: record/track results, trends, peer/team compare.
- **squads / squad_members** — group management, gated in Trainer and Client apps.
- **monitoring** (`monitoring.js`) — wellness/readiness/load monitoring with red-light bands and ACWR helpers.
- **growth** (`growth.js`) — growth/maturation tracking incl. injury-*risk* context for youth athletes.
- **nutritionExpert** (`nutritionExpert.js`) — advanced nutrition with periodisation logic.
- **Shared platform (flip-on):** full workout builder with supersets/dropsets/pyramids/clusters/RPE/RIR; guided player, programmes, templates, video library; progress hub (photo compare + strength trends); **AI coach "Ask", AI form-check on video, AI meal/fridge/body scan** (Claude vision via `analyze.mjs`); check-in form builder, coach activity feed, community; per-client reminders + VAPID web push; booking/classes, barcode nutrition, recipes, supplements, files, agenda; **Strava wired** (OAuth).

### GAP — what a full AMS has that we do NOT
1. **Injury / rehab EMR** — no clinical record, no rehab-protocol assignment, no RTP/availability tracking, no medical audit trail. (`growth.js` touches risk only.)
2. **Live weight-room squad mode** — squads exist for management, but no shared tablet board that runs the whole squad through a session live.
3. **Periodisation depth** — programmes are flat/template-based; no meso/block periodisation or ACWR-planned load management (periodisation logic today lives only in nutrition).
4. **Broad wearables** — Strava only. No Garmin/WHOOP/Oura/Catapult/HRV/force-plate.
5. **Team scheduling calendar** — booking/agenda exist, but no true multi-athlete team calendar.

**Net:** we already ship the athlete-facing training, testing, monitoring, nutrition and AI stack of an AMS. The gaps are the "high-performance department" layer. **Two of them — EMR and live squad mode — are the only ones Lumin can point to that we don't have. We close both for Jordan.** Wearables breadth and periodisation/scheduling depth go on the roadmap.

---

## 5. The two gap-closers to build

These are the only two features that let Lumin say "but we have X." Take both off the table. Both build on existing architecture — same RLS helper (`is_my_client(client_id)`), same flat `client_id`-keyed tables, same `THEME.features?.x` gating. No new backend service.

### 5a. Injury / Rehab / Return-to-Play module (matches Lumin's Pro-tier EMR)

**One flag:** add `rehab: true` to `pph.features`. Invisible on Kim's consumer brand — which also correctly scopes clinical data-handling to hubs that want it.

**Data model — 7 tables, one migration** (all key on `client_id`, denormalised to child tables, `author_id` for the clinical audit trail):
- `injuries` — the EMR record: body_region, side, tissue_type, mechanism, onset, severity, `status` (active → rehab → rtp → resolved), `availability` (full/modified/unavailable — the health-status bar), `current_rtp_stage`, dates.
- `injury_notes` — append-only clinical audit trail (assessment/treatment/progress/clearance); scan/prescription uploads to a **private `medical` storage bucket**. Immutable from the athlete side.
- `rehab_protocols` — assigned plan header (phase 1–4, frequency, status).
- `rehab_protocol_items` — the drills; reuses the existing `exercises` library + `WorkoutRows` set-types, or free-text physio drills; each tagged to an RTP stage.
- `rehab_sessions` — athlete's completion + **pain before/during/after (0–10)** + per-item actuals + RPE. Rising pain-*during* vs pain-*before* is the key rehab red-flag.
- `rtp_stages` — staged return-to-play ladder; seed a default 5-stage GTP ladder (Rest/Protect → Restore ROM → Rebuild Load → Sport-specific → Return-to-Play), editable; final stage needs **coach clearance sign-off** (`signed_off_by`).
- `soreness_logs` — daily body-map self-report (pain + stiffness per region); links to an injury, or flags a *new* problem when unlinked and high.

**RLS — two patterns:** athlete-writable tables (`soreness_logs`, `rehab_sessions`) use the standard client-all + trainer-read pair; **clinical tables are athlete READ-ONLY, coach full write** — so athletes see but never author their medical record. Reuses `is_my_client` verbatim.

**Coach screens (TrainerApp, behind `rehab`):** a **Medical** tab (log injury, injury record + audit trail, rehab protocol builder, return-to-play board with stage-gates + clearance) and a squad-level **Red Flags** tile beside the existing readiness board.

**Athlete screens (ClientApp, read-mostly, warmer than Lumin):** *My rehab* (today's session with video + cues, RTP progress), *Log rehab session* (done + actuals + pain 0–10), *Log pain/soreness* (body-map picker).

**Monitoring integration** — the highest-value bit: add `sorenessFlag()` and `combinedReadiness()` to `monitoring.js`. Soreness can only pull a readiness light *down* — a wellness-green athlete with knee pain 8 shows **red** with a reason. *This is exactly Lumin's "red-flag alerts from athlete self-reports," done automatically.* When an athlete is deliberately deloaded in rehab, suppress the ACWR "detraining" amber and surface RTP status instead.

**MVP cut:** the 7 tables + the readiness merge, all behind the single `rehab` flag. One migration, three files touched (`rehab.js`, TrainerApp, ClientApp) plus the monitoring helpers. No new architecture. *(Optional later: a `rehab` mode on `analyze.mjs` to draft progressions from an injury record — a differentiator over Lumin's purely-manual EMR.)*

### 5b. Weight-Room Squad Mode (matches Lumin's "Team Training Mode")

**Core insight:** this is **not a new logging engine** — it's the existing `GuidedWorkout` player run N-up on one tablet, writing **one `workout_plans` row per athlete**. Progress comes for free: `aggregateLifts()` already builds each athlete's strength history from that exact write path. No new progress plumbing.

**Data model — one migration:** new `squad_sessions` header table (`squad_id`, `template_id`, `coach_id`, times) + one column `workout_plans.squad_session_id`. Keeping `template_id` on the header preserves the *prescription* (templates are never mutated) so you can review "did the squad hit target load?" after `finish()` overwrites the plan row with *actuals*.

**The one unverified dependency:** the coach must be able to UPDATE another athlete's `workout_plans` row from the tablet (in `GuidedWorkout` this runs as the *client*, not the coach). Ship a `log_squad_plan(p_plan_id, p_exercises)` **security-definer RPC** so the tablet writes as one trusted call. **Confirm/author this coach-UPDATE policy before the live board will save** — it could not be verified in-repo (ref `ezwmfbuuopsnpanebtal`, no `supabase/` dir present).

**Coach flow** from `SquadDetail` via a new **"Run session"** button (gated on `THEME.features?.squadMode`): pick session template → pick who's in today → choose layout → live board → finish. **Highest-value gym-floor detail: weight-seeding** — pre-fill each athlete's weights from *their own last logged value* per exercise (`aggregateLifts().latest`), so the coach edits deltas instead of typing every number for every athlete.

**Two layouts, one state tree** (a single `Map<client_id, playerExercises[]>`, two views — keeps the diff small): **Athlete-by-athlete** (tabs across the top, full session each) and **Set-by-set / station** (one exercise header, a row per athlete — matches a rack rotation). Reuse existing `gw-*` classes (already tablet-sized); big tap targets, minimal typing; **debounced autosave (~3s)** mirrors how `GuidedWorkout` already behaves — no new offline layer.

**RPE — three distinct paths, do not conflate:** `ex.rpe` = prescribed target; per-set *actual* RPE needs a `fromSquadPlayer` that preserves `sets[].rpe` (the existing `fromPlayer` silently drops it); `session_loads.rpe` = session RPE × duration → load for monitoring/ACWR, captured once per athlete on finish.

**On finish (per athlete):** (1) write `exercises` via `log_squad_plan` → `LiftProgress` picks it up automatically — *this is the whole point*; (2) insert `workout_completions {source:'squad'}` — **bypasses the daily guard** so a solo + squad session in one day counts as two; (3) capture session RPE + duration → `session_loads` for readiness/ACWR.

**Build checklist (small diff):** the migration + RPC; `fromSquadPlayer` (+ optional `seedFromHistory`) in `WorkoutRows.jsx`; new `SquadSession.jsx` (the board); the "Run session" button in `TrainerApp.jsx`. **No change** to the exercise JSON shape, `aggregateLifts`, `LiftProgress`, or the ClientApp player.

---

## 6. Positioning, pitch & pricing

### The one-line wedge
> **"Lumin gives you a data hub. Coached by Kim gives you *your* hub — your brand, an AI coach that actually writes and explains the plans, and a real nutrition engine — the three things Lumin structurally doesn't have."**

### The three pillars Lumin can't copy quickly
1. **His brand, not ours** — PPH-branded athlete app + coach dashboard. Clients, parents and referring clinicians see "The Physical Performance Hub," not a US SaaS vendor.
2. **AI-native, not dashboards** — a Claude coach that writes programmes, explains test results in plain English, form-checks lifts on video, answers athletes 24/7. Lumin's "analysis" is a human reading a graph. Live in our code today.
3. **Nutrition as a first-class pillar** — fridge/meal/body scan + periodised targets. Lumin has *zero*. Not weak — absent.

Underneath all three: **an athlete app people actually open.** Lumin's own weakness is adherence — their app is a compliance chore. Engagement is our moat.

### Us vs Lumin — the verdict
- **Match** (table stakes we already ship): S&C programming with full set-types, exercise/video library + guided player, testing batteries + trends, daily wellness/readiness/load, check-in/survey builder + activity feed, reminders + push.
- **Win** (they can't replicate without rebuilding): **nutrition engine** (white space), **generative AI coach** (category gap), **athlete engagement/warmth**, **white-label own-brand**, plus richer progress tracking.
- **Lumin ahead** on exactly one thing: breadth of wearables — and that's their premium-*gated* card (behind Core/Pro). We have Strava; multi-wearable is roadmap.
- **Closing** for Jordan: rehab/RTP EMR and live squad mode — the two gap-closers above.

Frame the two builds as the **founding-partner build:** *"The two things Lumin still does that we don't, we're building* with *you over your first 60–90 days — so you're never behind, and you shape how they work on your floor."*

### Pricing — out-value, don't race to the bottom
Lumin: Core ~$2,000/yr (most popular) · Pro ~$3,350/yr (adds EMR). Our stack already exceeds Core (nutrition + AI + engagement + white-label); once rehab lands, it exceeds Pro too.

- **List price: $2,388/yr — billed £149/month, all-inclusive.** ~$1,000 *under* Lumin Pro while delivering more than Pro. Just above Core in headline, but a different category of product — you compete on "more," not "cheaper." **One price, everything in — no feature-gating,** which kills Lumin's biggest UX complaint in a single move.
- **Founding design-partner offer for Jordan: £99/month for the first 12 months** (~$1,600/yr — undercuts even Lumin *Core* while out-featuring *Pro*), then £149/month. Includes both gap-closer builds at no extra cost. He's already a live design partner; the founder rate buys a reference customer, a case study and product feedback worth far more than the £600 discount.
- **If he's anchored to Lumin Core's $2k:** open at £149 all-in, then drop to the £99 founder rate as the close — he hears a discount *and* still gets more than Lumin Pro for less than Lumin Core.

### The exact line to say to Jordan
> *"Lumin will give you a data dashboard your athletes have to feed — with no nutrition, no real AI coach, and their name on every screen. I'll give you the same programming, testing and monitoring under **The Physical Performance Hub** brand, plus an AI coach that writes and explains the plans, a full nutrition engine Lumin simply doesn't have, and I'll build the rehab and live weight-room modules with you as my founding partner — all in for £99 a month for your first year, which is less than Lumin's cheapest tier and more than their most expensive one."*

---

## 7. Recommended build order

1. **Demo first (days, not weeks).** Flip the five PPH flags in `themes.js` — `testing, squads, nutritionExpert, monitoring, growth` on the mono dark theme. This is config, not code, and instantly stands up an AMS that already beats Lumin Core on nutrition + AI + engagement + brand. **Walk Jordan through this live** — it carries the pitch on its own and proves the four wins are real, not roadmap.
2. **Rehab / RTP module (gap-closer #1).** One migration (7 tables + `medical` bucket), `rehab.js`, the Medical tab, the athlete Rehab tab, and the `monitoring.js` soreness merge. This closes Lumin's Pro-tier EMR — the single most credible thing they can wave at him — and folds it into the flat £149/£99 price they gate at $3.35k. Do it first because it's pure additive architecture with zero unverified dependencies.
3. **Squad weight-room mode (gap-closer #2).** One migration + RPC + `SquadSession.jsx` + the "Run session" button. Sequenced last because it carries the one open risk — **confirm/deploy the coach-UPDATE policy (or the `log_squad_plan` security-definer RPC) before the live board will save.** Everything else consumes the output unchanged.

Each step is independently shippable and each raises what Jordan sees before the next begins — demo to win the meeting, rehab to remove his strongest objection, squad mode to leave Lumin with nothing left to point at.