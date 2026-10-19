# DO NOT SEND YET
#
# This message says the form checker is live. As of writing it is NOT.
# Paul's published deploy is still 6acff9eb4c7a993adc4d6cf7 (14 Oct,
# index-CoDMx1y9.js). The fixed draft is 6ad4963b9d59fd9abf919820
# (index-CBnSBWGK.js).
#
# Ricky must run, with the ! prefix:
#   npx netlify api restoreSiteDeploy --data '{"site_id":"bda91296-2224-4923-b91c-d6482971eab1","deploy_id":"6ad4963b9d59fd9abf919820"}'
#
# Then confirm getSite shows published_deploy.id = 6ad4963b9d59fd9abf919820
# and that redefine-academy.netlify.app/index.html serves index-CBnSBWGK.js.
# Only after both checks pass does this message become true.
#
# Context: Paul tested at 16:19 on 19 Oct and hit the old build. Proof is a
# clip at 2026-10-19 15:19:59+00 in form-videos with no form_checks row -
# the old-code signature exactly. That clip has been backfilled, so
# form_checks is now 10 and his test clip is in his review queue.

Hi Paul,

That one is on us, and it is not your phone.

The fix was built and tested but it had not actually been put live when you
tried it, so your phone was still running the old version. You did everything
right - there was simply nothing new there to run. Apologies, that is a daft
way to waste your time.

It is live now, and I have checked that properly this time rather than taking
it on trust.

Two things:

1. Swipe the app fully closed and reopen it, then try the form checker once
   more. An app that has only been minimised keeps running the old version,
   which is how this would look unchanged.

2. The clip you sent at about twenty past four is not lost. It had uploaded
   fine and then hung before it could be recorded, same as Tuesday night's. It
   is in your review queue now alongside those.

On your two ideas, both good, and I would rather get this working first before
adding anything near it:

FILTERING OR HIDING OLD FORM CHECKS - yes, worth doing, and it will matter
quickly once clients send a few each. One thing to settle first: the exercise
name is currently a free-text box, so "Back squat", "back squat" and "Squats"
would each become their own filter, and the clips already sent have no exercise
on them at all. So it is probably a short list to pick from rather than typing,
plus an archive or hide control. Small job, but a decision for you on how much
you want clients steered to a fixed list.

SIDE-BY-SIDE PROGRESSION - this one I like a lot, and it is the more valuable
of the two. It needs the same thing underneath: a reliable exercise name, so it
can know which two clips are the same movement months apart. So they go
together. First-and-latest side by side with the AI pointing out what has
changed is very doable once that is in place.

Tell me how the test goes and I will scope those two properly.
