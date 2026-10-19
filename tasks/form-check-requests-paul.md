# Form checker - Paul's requests, 19 Oct 2026

Both raised at 16:26 after the failed test. Neither is started. Both are
blocked behind Paul confirming the hang fix works on a real device, because a
new commit now would invalidate the tested draft and muddy that test.

## The shared blocker: `exercise` is free text

`src/ClientApp.jsx:3798`

    <label className="field">Which exercise?
      <input value={exercise} onChange={(e) => setExercise(e.target.value)}
             placeholder="e.g. Back squat" /></label>

and `:3770` inserts `exercise: exercise.trim() || null`, so the column is
nullable and uncontrolled. `:3825` renders `check.exercise || 'Form check'`.

Consequence for both features:

- All 10 rows in `form_checks` today have `exercise = null` (9 backfilled 18
  Oct, 1 backfilled 19 Oct). A filter built now would show one bucket called
  Unlabelled and nothing else.
- "Back squat", "back squat", "Squats" and "BB squat" are four different
  filters and four different progression timelines.

So the first piece of work is the field, not the feature: a picker (searchable
list, with the client's own recent entries at the top) and a free-text fallback
that normalises. Needs a decision from Paul on how hard to steer clients onto a
fixed list. Also needs a one-off tidy for existing rows - probably "ask the
client" or just leave them Unlabelled rather than guess from the video.

## 1. Filter / hide previous form checks

Paul: "it may be helpful for the client to be able to either filter or hide
previous form checks so it's a bit tidier. Maybe if it can allow them to be
filtered by exercise?"

Scope once the field is sorted:
- Filter chips by exercise on the client's list.
- An archive/hide per check. Hide should be the client's own view only - the
  coach must keep seeing everything, or a client could quietly bury a check
  their coach has not looked at yet.
- Needs a column (`hidden_at`, client-writable) and therefore a column-level
  GRANT, not a table-level one. See `tasks/migration_profile_column_grants.sql`
  for why; `form_checks` needs the same treatment if clients get write access
  to any column of it.

## 2. Side-by-side progression

Paul: "like the body scan where the AI can point out side by side progressions
between videos? So they can see how their form was when they first submitted
and how it has progressed?"

The more valuable of the two. Shape:
- Pick two checks of the same exercise - default first and latest.
- Two players side by side (stacked on a phone; portrait clips will not sit
  side by side at 375px).
- AI pass comparing frames from both, in the same style as the body scan.
  Frames are already extracted for the single-clip path, so the extraction is
  reusable; the prompt is new.
- Hard dependency on exercise names being consistent, hence the blocker above.

Cost note: this is a second AI call per comparison on clips that have already
been analysed once. Cache the comparison against the pair of ids rather than
re-running it every time the screen opens, and keep it behind the same rate
caps as the rest.
