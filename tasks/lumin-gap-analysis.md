# Lumin Sports — gap analysis & how PPH exploits it

Research date: July 2026. Sources: Lumin's own public feedback board
(feedback.luminsports.com), their changelog, Apple/Google app-store reviews,
IntuitionLabs software profile, competitor-comparison framing.

## Sourcing caveat (itself a finding)
Lumin has an almost non-existent independent review footprint — **no G2, Capterra,
GetApp, SoftwareAdvice, TrustRadius or Trustpilot listing**, and only ~12-27 app-store
ratings across fragmented white-label listings. (The 14k-review "Lumin" on Trustpilot
is a skincare brand — not them.) So the richest evidence is **Lumin's own public
feature-request board** — real named coaches/athletes, with vote counts and statuses.
That's effectively an admitted-gaps list. Thin social proof is also a weakness we can
exploit: **a strong case study with Jordan/PPH is worth a lot in a category with almost
no public validation.**

## What Lumin is (verified)
Australian AMS (founded 2018, formerly "Arc"), luminsports.com. Modules: S&C programmer,
medical/EMR, wellbeing monitoring, scheduling, physical testing, chat, TV/team-training
mode, and — their real strength — deep GPS/force integrations (Catapult, VALD, Hawkin,
Polar, Garmin, PlayerData). **No nutrition module. No real AI** (only "exercise-library
AI autofill").

Pricing (USD/yr): **Lite $600 · Core $2,000 (most popular) · Pro $3,350 (adds EMR)** ·
Lumin Strength $350 student. Their pricing page now hides exact numbers and shows
**user bands (up to 50 / 51-250 / 251-500 / 501+)** — i.e. they price by athlete count
too, which validates our per-athlete tier model.

## IMPORTANT: Lumin ships fast — don't claim gaps they've closed
Their changelog shows TV Mode (Apr 2026), Rehab Plans (Dec 2025), a Physical Testing
overhaul (Jun 2026), VALD/Hawkin/GPS integrations and a public API (2025-26) all recently
shipped. The **durable** gaps are the structural ones below, not the small bugs they're
actively fixing.

---

## The gaps, ranked, mapped to our stack

### HAVE / clear advantage (pitch these hard)
1. **Coaches' mobile experience** — Lumin's #1 most-upvoted request (35 votes, ~2 years
   unfulfilled): a coaches' app so staff aren't "stuck at a laptop" to see dashboards.
   **We are mobile/tablet-first — coaches run the whole squad from the floor.** Their
   biggest gap is our starting point.
2. **Nutrition** — Lumin has none (positioned performance-only). We have a full nutrition
   engine + AI meal/fridge/body scans. Biggest structural category they lack.
3. **Real AI coaching** — Lumin's "AI" autofills an exercise name; Kitman markets AI
   injury modelling, Lumin doesn't. Ours writes and explains programmes and answers
   athletes. 
4. **Individualised squad/TV mode** — coaches ask Lumin's TV mode to show each athlete's
   *modified* programme, not a generic team one (5 votes, "in development"). **Our squad
   board already runs every athlete's own plan, weights pre-seeded from their last lift.**
5. **App reliability** — recurring athlete complaints: stuck on loading screen, force-close
   repeatedly, app-update broke login, broken forgot-password. Ours is a stable web app —
   nothing to update, nothing to break.
6. **Chat / comms** — Lumin's chat is buggy (disappears, absent on desktop, no sender
   names, can't mute). We have proper messaging + community + activity feed.

### QUICK-WIN — buildable on our stack in days (turn "Lumin users want this" into "we have it")
A. **Coach alert when an athlete's availability/status changes** (injury → modified /
   unavailable / RTP / cleared). Lumin request has 6 votes and tops one board; it's still
   open. We already have the activity feed + digest + web push + rehab availability — this
   is a small event wire-up that also strengthens the rehab module. **Highest-value.**
B. **Configurable check-in reminder time** per athlete (app-store request). We already
   have per-client reminders — just expose the time.
C. **Session section headers** (Warm Up / Strength / Accessories) + **AMAP/ALAP rep type**
   in the workout builder. Matches a 10-vote programming request. Tiny.
D. **Automatic welcome/onboarding message** on athlete join (we have seed_welcome_message).
   Make it fire automatically. Small.
E. **Athlete/squad report → PDF export.** We have PDF generation. Medium effort, nice-to-have.

### ROADMAP — where Lumin is genuinely stronger (be honest; don't fight here)
- **Wearable / GPS / force-plate integrations** (Catapult, VALD, Hawkin, Polar, Garmin).
  Their real investment area. We have Strava only. Acknowledge it; put on roadmap.
- **Enterprise scale** — org management for 1000+ athletes, many coaches, hierarchical
  calendars. We'd have our own scaling to prove.
- **Public API** and an established pro/college install base.

---

## Pitch talking points (Ricky's words, for Jordan)
- "Lumin's single most-requested feature, for two years, is a coaches' mobile app so staff
  aren't stuck at a laptop. You just ran the whole squad from a tablet on the floor."
- "Lumin has no nutrition at all. You get a full nutrition engine and AI meal, fridge and
  body scans."
- "Their 'AI' autofills an exercise name. Ours writes and explains the whole programme."
- "Lumin's team-display mode shows one generic programme; coaches are asking it to show each
  athlete's own plan. Your squad board already does that — every athlete, their own numbers."
- "Their athletes complain the app locks them out after updates. Yours is a web app —
  nothing to install, nothing to break."
- "In a category with almost no public reviews, being an early PPH partner makes you the
  reference everyone else checks."

## Pricing implication
Our tiers are well-anchored against Lumin: Starter £149/mo (£1,788/yr) sits between Lumin
Core and Pro; Squad £299/mo (£3,588/yr) sits above Lumin Pro — justified by nutrition + AI
+ rehab-with-alerts + the mobile-first coaching they lack. Lumin pricing by user band
confirms per-athlete tiers are the category-normal model, so it won't feel odd to Jordan.
