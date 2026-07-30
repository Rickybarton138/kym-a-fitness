# PPH demo script — Live weight-room squad mode (for Jordan)

Live at **the-physical-performance-hub.netlify.app**. This walks the squad flow end to
end, with what to click (DO) and what to say (SAY). Keep it to ~6 minutes. The whole
point Jordan needs to feel: *this replaces Lumin's Team Training Mode and does more.*

---

## 0. Before Jordan arrives (prep — do NOT skip)

- **Log in on the tablet you'll demo on** as the coach: `sam@pphub.app` / `SquadTest123`.
  Have it already on the squad screen so you're not typing passwords in front of him.
- **Second device optional:** log in as an athlete (`ben@pphub.app` / `RehabTest123`) on a
  phone, so you can flip to the athlete's view for the payoff at the end.
- **Seeding needs history to shine.** The killer detail — weights pre-filled from each
  athlete's last lift — only shows numbers if the athletes have prior logged sessions.
  Sam's squad (Dorset Cricket U18) may be empty. **Ask Ricky/Claude to pre-load a couple
  of prior sessions for the squad athletes before the demo** so the board opens populated,
  not blank. (Takes 2 minutes.)
- Have the one-line price ready: **£99/month, founding partner, first year.**

---

## 1. Open — the positioning (30 sec, before you touch anything)

SAY: *"Lumin gives you a data dashboard your athletes have to feed. I'll show you the same
programming, testing and monitoring under YOUR brand — the Physical Performance Hub — plus
two things Lumin charges extra for or does manually. Let me show you the one every S&C coach
asks about first: running a whole squad through a session live, on the floor."*

---

## 2. Into the squad (30 sec)

DO: From the coach dashboard, tap the squad **Dorset Cricket U18**.

SAY: *"This is a squad. Every athlete here has their own full profile — history, tests,
monitoring, injuries. Note the coloured dots by each name: that's their readiness today,
pulled from their morning check-in. Green good, amber caution, red compromised. Lumin has
that; so do we."*

DO: Point at the roster (readiness dots + "sessions this wk"), and the leaderboard below.

SAY: *"Leaderboard ranks the squad on any test — sprint, jump, whatever. But here's what I
wanted to show you —"*

---

## 3. Run session — setup (1 min)

DO: Tap **Run session** (the "Live weight-room" card).

SAY: *"This is the gym-floor mode. I build one session, and it runs the whole squad through
it on this one tablet."*

DO: Either pick a **template** from "Start from a template", or type a title (e.g.
"Pre-season Power") and add 2-3 exercises in the editor (e.g. Back Squat 3x5, Bench 3x8,
Trap-bar deadlift 3x5).

SAY: *"I can start from a saved template or build it here. Real prescription — sets, reps,
target RPE, supersets, all of it."*

DO: Scroll to **Who's in today** — tick/untick a couple of names.

SAY: *"Not everyone's in every day — injured, resting, away. I pick who's training. The
athletes I leave out just don't get today's session."*

DO: Show the **Board layout** toggle (Athlete by athlete / Set by set).

SAY: *"Two ways to run it — I'll show you both in a second."*

DO: Tap **Start session**.

---

## 4. The board — the moment that sells it (2 min)

DO: Land on the board. It opens on **By athlete** (tabs across the top).

SAY: *"Here's the whole squad. Tabs across the top — one per athlete."*

DO: **This is the key line.** Point at the weight fields, already populated.

SAY: *"Look — every athlete's weights are already filled in. That's not me typing. Each
number is pulled from THAT athlete's last logged session for that exact lift. So on the
floor I'm not entering 30 numbers for 8 athletes — I'm nudging today's load up or down from
where they were last week. That's the difference between a tool coaches actually use mid-
session and one they fill in afterwards from memory."*

DO: Tap a few set checkboxes, tweak a weight. Switch the layout to **By station**.

SAY: *"Or — station view. One exercise, every athlete in a row. This is how you actually
coach a rack rotation: everyone's on the squat, I go down the line ticking sets and logging
what each one lifted. Then move to the next station."*

DO: Point out the small "Autosaved" note near the top after an edit.

SAY: *"It's saving as I go — no save button to remember, nothing lost if the tablet sleeps."*

---

## 5. Finish (45 sec)

DO: Scroll to the **Finish** card. Enter **Session length (mins)** once (e.g. 60). Add a
quick **RPE** for one or two athletes.

SAY: *"At the end I log how long it ran and how hard each athlete found it — one number
each. That RPE times the duration is their session load, which feeds the acute:chronic
workload tracking automatically. That's the injury-risk signal — Lumin's flagship number.
We compute it from the session I just ran, not a separate form."*

DO: Tap **End & save session**. Land on **"Session saved ✓"** with the per-athlete list.

SAY: *"Done. Every athlete just got their session logged — actuals, completion, and load —
in one tap."*

---

## 6. The payoff — where it went (1 min)

DO: Go back, open one of those athletes from the client list. Show their **weights-lifted
progress** (the lift you just logged is now on their chart). Show their **load/readiness**.

SAY: *"And here's the point. That squad session didn't go into a black hole — it's already
in this athlete's individual progress. Their strength trend just updated. Their weekly load
just updated. One session on the floor, and every athlete's personal record moved. No re-
entry, no export, no spreadsheet."*

DO (optional, second device): Open the athlete app as Ben.

SAY: *"And on the athlete's side — they see it as their record of the session, read-only.
They can't overwrite what you logged on the floor. Your data stays your data."*

---

## 7. Close (30 sec)

SAY: *"So that's live squad mode — matches Lumin's team training, plus the weight-seeding
and the automatic load calc built into the same flow. Pair it with everything you already
saw — nutrition, the AI coach that writes and explains the plans, testing, monitoring, the
rehab and return-to-play module — all under the Physical Performance Hub name, not mine.
Lumin's cheapest tier is around two grand a year and their EMR tier's over three. I'll give
you the lot, and I'll build the next features WITH you as my founding partner, for ninety-
nine a month for your first year."*

---

## Gotchas / don't-do-live

- **Don't** demo on flaky wifi without the prep history loaded — a blank board undercuts the
  seeding line, which is the whole hook.
- **Don't** click into browser dialogues / delete buttons mid-demo.
- If a save looks slow, keep talking — autosave and finish both retry; the idempotency means
  a double-tap on "End & save" can't double-count anything.
- If Jordan asks "can athletes mess up my numbers?" — that's the read-only lock in step 6.
- If he asks about two sessions in one day (AM/PM) — yes, they count as two; the system
  dedupes per-session, not per-day.

---

*Bridge: there's a companion flow for the rehab / return-to-play module (injury log, RTP
ladder, clearance, soreness feeding readiness) — ask for that script too if you want to
demo the medical side.*
