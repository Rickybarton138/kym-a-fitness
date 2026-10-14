# Message for Paul — written 12 Oct, still to send

Covers his four messages of 12 Oct, plus two things he hasn't noticed yet and
should hear from us first.

**Do not send until the promote has run.** Re-checked 13 Oct: the live site is
still deploy `6ac74d8369c7ca281c89fe3d` from 8 Oct. Re-checked again 14 Oct: still
`6ac74d8369c7ca281c89fe3d`. Paul chased it a second time.

The draft to promote is `6acff9eb4c7a993adc4d6cf7`, built 14 Oct from a clean
worktree at commit `dd54cac`. Every earlier deploy id is superseded
(`6acccbc9`, `6acea444`).

`dd54cac` is chosen, not just "latest": it carries all of Paul's fixes but
stops short of `9765f90`, which makes the ten AI endpoints demand a session.
The code default there is ENFORCE, so deploying HEAD to Paul's site would 401
every client whose installed PWA has not reloaded. That rollout needs
`AI_AUTH=observe` set first and belongs to its own pass — see
`tasks/hardening-pass-1.md`. Nothing below is live, and
the food-search bug he reported again at 12:03 is the one that has been sitting
in an unpromoted draft since 9 Oct.

```
npx netlify api restoreSiteDeploy --data '{"site_id":"bda91296-2224-4923-b91c-d6482971eab1","deploy_id":"6acff9eb4c7a993adc4d6cf7"}'
```

**The AI paragraph is now true.** The Anthropic account has been topped up —
verified 13 Oct against production and the draft: check-in replies answer, and
recipe macros are back (655 kcal on the hand-worked test, all four ingredients
costed). `e2e_round42` is 18 of 18 and `e2e_round43` all green.

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
form and show a little warning that's very easy to miss. It then told her it had sent
anyway, which is why neither of you could get to the bottom of it.
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

The AI itself had been down — the account it runs on ran out of credit, so
anything that thinks (Ask coach, meal and fridge scans, the recipe reader, the
instant check-in replies) was failing. That's sorted and tested. Worse, it was
showing your clients the billing message itself rather than something sensible.
Also fixed, everywhere.

*The link in a pause message.* Yes, now — a YouTube link you put in that box is
tappable for them, and opens in a new tab so they don't lose the app. One catch:
the note only saves when you tap an access button, so for someone already
paused, add the link and then tap "Paused" again.

And a small one: a client's own recipes aren't visible to you — only the ones
you've added. If you want to see what they've built, say so and I'll open that
up.

One thing: close the app down fully and reopen it, rather than just switching
back to it, or you'll still be looking at the old version. Same for anyone who
says a fix hasn't landed.

---

## Notes for Ricky, not for Paul

- **The promote is now the only blocker.** Credit is sorted; the deploy isn't.
  Run the command above, load the app once, then send.
- Kim's, PPH's and Elev8's sites still carry the old code that would leak the
  billing text next time the account runs dry. The fix is in the repo and not
  built for them — say the word.
- Test against `app.redefineacademy.com` after the promote, not the draft URL.
  Everything green today was green on the draft.
- Alanna: "most likely cause", not proven. The logs show the form opened and
  nothing sent; the repro was Chromium on the same markup and she's on Firefox
  for Android. Her answer to the steps question would settle it.
