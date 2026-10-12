# Message for Paul — 12 Oct

Covers his four messages this morning, plus two things he hasn't noticed yet
and should hear from us first.

**Do not send until the promote has run.** Nothing below is live otherwise, and
the food-search bug he reported again at 12:03 is the one that has been sitting
in an unpromoted draft since 9 Oct.

**The AI line is only true once the Anthropic account is topped up.** If Ricky
hasn't done that when this goes, cut that paragraph and send the rest.

Copy from here:

---

Morning mate — all four, and two you haven't hit yet.

**The food search.** You're right and it's still there — that fix has been
built since Thursday and sat waiting to go out, which is on me. It's going
live today along with everything below.

**Alanna's check-in.** Found it. Her form was genuinely never being sent — not
slow, not lost, never sent. The two number questions ("Average daily steps",
"How many sessions") would only accept a plain whole number, so typing
"10,000 steps", or "8.5", or "3-4", made the phone refuse to send the whole
form and show a little warning that's very easy to miss. It then told her
"Sent ✓" anyway, which is why neither of you could get to the bottom of it.
Both questions now take whatever she types, and if a check-in ever does fail
to send it says so and keeps her answers on screen instead of pretending.

Worth asking her what she actually typed in the steps box — I'd like to know I
got the right one, though the fix holds either way now.

**Replying to a check-in.** Your reply now shows as a reply, in the same block
the client reads it in, and the button becomes "Edit reply" so you can add to
it and send again.

**Deleting a recipe.** There, behind a confirm. Anything already logged in a
diary from that recipe stays exactly as it was — deleting a recipe never
touches someone's history.

**Editing a recipe from the diary.** Every diary entry now has a visible Edit
button. For anything logged from a recipe you also get "Update from the
recipe": change the recipe, open Thursday, tap it, and that entry is re-worked
from the recipe as it stands now. Only that entry — other days they logged it
stay as they were eaten. Changing the servings does the same thing. I've linked
up the entries already logged, so days pre-tracked before today work too.

**Two you haven't seen yet.**

The AI itself has been down — the account it runs on ran out of credit, so
anything that thinks (Ask coach, meal and fridge scans, the recipe reader, the
instant check-in replies) has been failing. That's sorted now. Worse, it was
showing your clients the billing message itself rather than something sensible.
Also fixed, everywhere.

And a small one: a client's own recipes aren't visible to you — only the ones
you've added. If you want to see what they've built, say so and I'll open that
up.

---

## Notes for Ricky, not for Paul

- **The Anthropic credit is the blocker, not the deploy.** Everything in the
  app that calls the AI is dead on all five brands — Paul's, Kim's, PPH and
  Elev8 all share the key and all four are showing clients
  "Your credit balance is too low to access the Anthropic API." Top up first,
  then promote; and look at the usage breakdown in the console before you do,
  or it'll drain the same way again.
- Only Paul's site has the fix built. Kim's, PPH's and Elev8's still leak the
  billing text until they're rebuilt and deployed — say the word.
- Don't claim the macros button works until `tasks/e2e_round42.mjs` passes
  again. It's 9 of 18 right now, entirely because of the credit.
- Alanna: "most likely cause", not proven. The logs show the form opened and
  nothing sent; the repro was Chromium on the same markup and she's on Firefox
  for Android. Her answer to the steps question would settle it.
