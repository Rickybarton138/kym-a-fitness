# Rick.Fit exercise demos — what still has no clip of Ricky

Generated 13 Oct 2026 by importing the real catalogue (`src/exercises.js` with
`brand=ricky`, which includes the callisthenics ladders and the extra
demonstrations group) and asking `getRickFitVideos` for each name.

**22 of 139 catalogue entries have a demo. 117 do not.**

(22, not 20, because of the two plank aliases below. Re-run
`node tasks/list-video-gaps.mjs` after adding clips — these counts are a
snapshot.)

Not a judgement about filming all 117 — most of them should never be filmed.
The tiers below are the point.

---

## Production spec — match this or the new clips will not slot in

Taken from the 40 existing files, so a new batch lands in the same manifest
without special-casing.

| | |
|---|---|
| Resolution | 1280 × 720, 24 fps, MP4 (H.264) |
| Duration | 3.4 – 6.0 s, seamlessly looping |
| Views | **two per exercise**, labelled A and B |
| View A | usually `Side` — the one that shows the joint angles |
| View B | usually `Front three-quarter` — the one that shows the path of the bar or hands |
| Audio | none |
| Framing | whole body plus the bar/plates in shot; the player uses `object-fit: contain`, so nothing is cropped, but anything at the edge will letterbox |
| Clip id | `21A`, `21B`, `22A`, … continuing from the existing 20 exercises |
| Filename | `rick-fit_<id>_<short-slug>.mp4`, e.g. `rick-fit_21A_deadlift.mp4` |
| Poster | `posters/<id>.jpg`, first clean frame |
| Where they go | `public/brands/ricky/exercises/` |

Two things that are easy to get wrong:

- **Each new exercise is a NEW ROW in the alias table.** `src/rickFitVideos.js`
  is positional — entry *i* is `rick_fit_(i+1)`. Extra names for an exercise
  that already exists go *inside* its existing row. A new row for a name that is
  already listed silently shadows the original and points a working demo at an
  id with no clips. I did exactly that today; the test caught it.
- New clips arrive `review_status: "unverified"`, and personal use stays on the
  separate `personalUseAccepted` flag. Do not set `release_enabled` or rewrite
  `review_status` to get them showing.

---

## Tier 1 — film these first (22)

The compound and staple movements most likely to appear in Ricky's own
programmes, where a demo earns its keep immediately.

**Legs**
- Deadlift (conventional)
- Front Squat (barbell)
- Hack Squat
- Bulgarian Split Squat
- Walking Lunge (dumbbell)
- Lying Leg Curl

**Chest & shoulders**
- Incline Barbell Press
- Dumbbell Bench Press
- Overhead Press (barbell)
- Cable Lateral Raise
- Overhead Triceps Extension
- Dip

**Back & biceps**
- Bent-over Barbell Row
- T-Bar Row
- Pull-up / Assisted Pull-up
- Chin-up
- Face Pull (cable)
- Barbell Curl
- Hammer Curl

**Core**
- Cable Crunch
- Hanging Leg Raise
- Back Extension

## Tier 2 — second batch (13)

Machine and variant work. Useful, but a client who can already see the squat
and the bench will cope without these for a while.

Chest Press (Hammer Strength) · Pec Deck / Chest Fly · Shoulder Press (machine) ·
Landmine Press · Arnold Press · Landmine Row · Meadows Row ·
Chest-Supported Row (machine) · Cable Curl · Preacher Curl ·
Cable Glute Kickback · Ab Rollout · Russian Twist

## Tier 3 — callisthenics ladders (72)

The whole skill-ladder progression, including the knee- and wrist-adapted
variants. The highest value for Ricky's *own* training, because the adaptations
are his, and the hardest to film — a lot of these are holds and negatives where
the form cue is the whole point.

Worth doing as its own project rather than bolted onto Tier 1, and worth
starting with the first rung of each of the six ladders plus the wrist-adapted
press-up and plank steps, which is about 14 clips rather than 72.

Full list: `node tasks/list-video-gaps.mjs` — or the Callisthenics section of the
dropdown, which is generated from `calisthenics.js` and is the authority.

## Tier 4 — do NOT film (10)

Conditioning. Nobody needs a demonstration of how to use a treadmill, and a
clip of Ricky on a rower is not teaching anything the machine doesn't.

Treadmill (incline walk) · Assault / Air Bike · Stepper · Cross-trainer · Rower ·
Battle Ropes · Tyre Flips · Sled Push · Farmer's Carry · Kettlebell Swing

(Arguably Tyre Flips, Sled Push, Farmer's Carry and Kettlebell Swing *do* have
technique worth showing. Ricky's call.)

---

## Two decisions for Ricky, not for me

Both are one-line changes to the alias table, and both currently resolve to
**no demo** because the video handoff's own test asserts they must:

1. **`Calf Raise`** — the catalogue's generic name. There is a
   `Standing Dumbbell Calf Raise` demo. Should the generic name show it, or does
   the gym's calf work happen on a machine, which would make the dumbbell clip
   the wrong equipment?
2. **`Triceps Pushdown (cable)`** — there is a `Rope Triceps Pushdown` demo.
   Same question: is the rope close enough, or is a straight-bar pushdown
   different enough that showing the rope would mislead?

I did add both, then reverted them when the existing test failed on purpose —
that exclusion was deliberate, not an oversight, so it is Ricky's to overturn.

## What I did fix

`Front Plank` and `Front Plank on Forearms` — the core ladder's and the
wrist-adapted ladder's names for the hold the `Forearm Plank` demo already
shows ("forearms down, no weight through the wrist at all"). Same movement, not
a variation of it, so both now reach the clip. Two ladders that showed nothing
now show something.

---

## Prompt to paste into GPT / Grok

> I need short looping exercise demonstration videos, consistent with an
> existing set of 40.
>
> Specification for every clip: 1280×720, 24 fps, MP4, 3.4–6.0 seconds, no
> audio, seamless loop (the last frame must flow into the first), whole body and
> the equipment in frame with headroom at the edges, same subject and same gym
> setting across all clips.
>
> For each exercise produce TWO clips:
> - View A: side on, square to the subject, showing the joint angles through the
>   full range.
> - View B: front three-quarter, roughly 45 degrees, showing the path of the bar
>   or the hands.
>
> One full controlled repetition per clip at working tempo, finishing in the
> start position so it loops. Correct technique throughout — these are teaching
> clips.
>
> Exercises (two clips each):
> [paste the Tier 1 list]

Check the loop boundary on every clip before accepting it. The existing 40 have
**not** had that check — 10 of them are flagged as failed and the other 30 as
unverified, and that inspection is still outstanding.
