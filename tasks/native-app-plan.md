# Taking the coaching app native — plan, sequencing, costs

Written 8 Oct 2026. Ricky: "time to make this a full App. lets get the process
started." Apple Developer account is already in place.

## The route

Capacitor, wrapping the existing Vite build. Not a rewrite: the same React
codebase ships to the web, iOS and Android, and every fix still lands everywhere
at once. React Native would mean maintaining a second app forever for one paying
customer, which is the mistake this avoids.

Two things about this codebase make it unusually ready, and one thing bites.

**Ready:** the brand is resolved from `window.location.hostname`
(`src/themes.js`), and when no host matches it falls back to the build-time
`VITE_DEFAULT_BRAND`. A native shell has no meaningful hostname, so a native
build just sets that variable — the mechanism already exists and is already used
for draft URLs. There is also already a manifest, a service worker, offline food
queueing and installable PWA behaviour.

**Bites:** push. `push_subscriptions` holds web-push rows (`endpoint`, `p256dh`,
`auth`) and `push-lib.mjs` sends through VAPID. Native push is APNs/FCM tokens —
a different shape entirely. That table needs a kind column and the sender needs a
second path. Existing subscriptions do NOT carry over, so every client who
already allowed notifications has to allow them again in the native app.

## Decisions needed before any code

**1. One app, or one per brand?**
Each store listing is its own review, screenshots, privacy declarations and
forever-updates. Recommendation: **ReDefine only, first.** Paul is the only
paying customer and the only live roster. Prove the pipeline on one app before
multiplying it by five. Revisit when there is a second paying coach.

The long-term fork is worth knowing now though: either N apps (cost scales
linearly, each coach gets "their own app" — which is what sold it) or one
platform app where clients enter a coach code (one listing forever, loses that).
Do not decide it now; do notice that shipping ReDefine first does not close
either door.

**2. What makes it worth being an app?**
Apple rejects thin website wrappers under guideline 4.2. We need real native
capability, and there is an obvious one Paul asked for in August and never got:
**Apple Health / Android Health Connect step and workout sync.** It genuinely
cannot be done from a PWA — that is on record in todo.md as "NOT feasible" — and
it is the single feature that both earns the app and gets it past review.

**ANSWERED by Paul, 8 Oct:** "Apple health and android health will be the main
ones. Some use FitBit, some use Garmin watches but I think if we're pulling from
Apple/Android/Samsung health that should cover it for steps."

He is right, and it makes Phase 2 considerably smaller than it looked. Fitbit,
Garmin and Samsung all write into the platform health store — Apple Health on
iOS, Health Connect on Android. So reading the OS health store covers every watch
his clients own, and there is NO need for per-vendor integrations: no Fitbit
OAuth, no Garmin API, no Samsung SDK, and no four separate sets of credentials,
rate limits and terms to maintain. Two integrations, not five.

Worth knowing the limits of that: a watch only reaches the health store if the
client has that vendor's sync switched on, and Garmin in particular is opt-in per
data type. Expect to have to tell clients to turn it on rather than assume it.

**3. Whose account is it published under?**
An app called "ReDefine Academy" published by "Ricky Barton t/a Rick.AI" is
normal for a platform vendor, and it is also the right answer while Ricky owns
the infrastructure. Worth saying out loud to Paul before it appears in a store,
because the publisher name is visible and permanent-ish.

## Costs

| Item | Cost | Status |
|---|---|---|
| Apple Developer Programme | £79/year | **Already have it** |
| Google Play Developer | $25 one-off (~£20) | Needed — check if already held |
| iOS build machine | — | The real constraint, see below |
| Codemagic CI (macOS builds) | Free: 500 M2 min/month | Enough at this release cadence |
| Codemagic beyond free | $0.095/min (M2) | Only if builds get frequent |
| Firebase Cloud Messaging (Android push) | Free | — |
| APNs (iOS push) | Included with Apple account | — |

**Realistic new spend to get both apps live: about £20**, assuming Codemagic's
free tier covers the build volume, which at a handful of releases a month it
will.

**The iOS build constraint:** Xcode is macOS-only and this is a Windows machine,
so iOS cannot be built here. Options, in order of sense:
1. **Codemagic** — 500 free macOS minutes a month, handles signing, TestFlight
   upload and App Store submission. Built for this.
2. GitHub Actions macOS runners — cheaper per minute ($0.062) but macOS burns
   free minutes at 10x, and every iOS-specific step (certificates, signing, IPA,
   TestFlight) is yours to wire up by hand.
3. Buy a Mac mini. Only worth it if this becomes a regular part of the business.

Android builds fine on this machine once JDK 17 and the Android SDK are
installed, which I can do.

## Sequencing

Each phase ends somewhere useful, so it can stop between any two.

**Phase 1 — Capacitor in, Android running. DONE 8 Oct, see below.** Add Capacitor, generate the Android
project, wire `VITE_DEFAULT_BRAND=paul`, icons and splash from the existing brand
assets, and get a real APK running on a device. No store, no account needed.
*Ends with: an installable ReDefine Android app.*

**Phase 2 — the thing that makes it an app.** Health Connect on Android and
HealthKit on iOS: read steps and workouts, write them into `daily_steps` and
`workout_completions`. This is the feature Paul asked for, and the answer to
Apple's 4.2.
*Ends with: steps arriving without anybody typing them.*

**Phase 3 — push, properly.** Add a kind to `push_subscriptions`, a native token
path in `push-lib.mjs`, FCM for Android and APNs for iOS. Keep web push working
— the PWA does not disappear.
*Ends with: notifications on native, web unaffected.*

**Phase 4 — iOS.** Codemagic pipeline, signing with the Apple account, first
TestFlight build. Paul and Ricky install it from TestFlight.
*Ends with: the app on a real iPhone.*

**Phase 5 — the paperwork.** Store listings, screenshots, privacy policy, Apple
privacy nutrition labels, Play data-safety form, age rating, account-deletion
route (both stores now require one if accounts can be created in-app — the
status/pause work gives us most of it).
*Ends with: submitted.*

**Phase 6 — review, release, and the treadmill.** Expect at least one rejection;
4.2 and privacy labels are the usual causes. After release, every web change that
touches native needs a store update, which is a new ongoing cost in attention
more than money.

## Risks worth naming now

- **Apple 4.2 rejection.** Mitigated by Phase 2 being real native capability
  rather than decoration. Do not submit before it exists.
- **The existing install base.** Paul's clients already have the PWA on their
  home screens and are using it daily. A native app means asking them to move,
  and the web app must keep working throughout — this is an addition, not a
  replacement. Plan the message to his clients before release, not after.
- **Push re-permission.** Every client who already allowed notifications has to
  allow them again. Expect a dip in nudge reach for a few weeks.
- **Five brands, one pipeline.** Everything above is per-app. Build it once so
  the second one is configuration, not repetition.
- **Release cadence.** Web ships in minutes today; the App Store does not. Keep
  anything time-sensitive on the web side.

## What I can do without you

Capacitor setup, Android toolchain and a working APK, icons and splash
generation from the brand assets, the Health Connect and HealthKit integration,
the push migration, the Codemagic pipeline, store listing copy, privacy policy
and the data-safety answers.

## What only you can do

Google Play account (if not already held), Apple signing identities and App Store
Connect app records, anything requiring the Apple or Google account password,
pressing Submit, and answering the question Paul was asked in August about what
his clients track steps on.

## Phase 1, as built (8 Oct 2026)

`android/app/build/outputs/apk/debug/app-debug.apk` — 7.9 MB, debug-signed,
sideloadable. Verified with `aapt2 dump badging` rather than trusting a zero
exit code:

    package: name='uk.co.rickai.redefineacademy' versionCode='1' versionName='1.0'
    application-label:'ReDefine Academy'
    minSdkVersion:'24'  targetSdkVersion:'36'

minSdk 24 means Android 7 and up, which is everything his clients will be on.

### The toolchain on this machine

No Android Studio, and none needed. `winget install` for the JDK sat for over
ten minutes producing nothing and installing nothing — a machine-scope MSI wants
UAC, and in a non-interactive session that prompt is invisible and waits
forever. Both pieces went in as plain zips instead, which need no elevation:

| Piece | Where | Why that version |
|---|---|---|
| Temurin JDK 21.0.12.1 LTS | `C:\Users\info\tools\jdk21` | AGP 8.13 floors at 17, Capacitor 8 wants 21; 21 clears both |
| Android cmdline-tools | `C:\Users\info\tools\android-sdk` | platform-tools 37.0.1, platforms;android-36, build-tools;36.0.0 |

Three traps, all of which cost a cycle or would have:

- The cmdline-tools zip extracts to `cmdline-tools/bin`, but `sdkmanager`
  demands `cmdline-tools/latest/bin` or it cannot find its own SDK root.
- `sdkmanager --licenses` prompts per licence and blocks forever on a null
  stdin. Pipe `yes` into it.
- `org.gradle.java.home` is not enough on its own. That setting tells Gradle
  which JDK to build with, but the `gradlew` launcher needs a JVM before Gradle
  exists, so `JAVA_HOME` has to be set in the environment too. The first build
  failed on exactly this.

Wiring, chosen so no future session needs to export anything:

- `android/local.properties` holds `sdk.dir` (gitignored, machine-local)
- `C:\Users\info\.gradle\gradle.properties` holds `org.gradle.java.home`.
  Deliberately NOT `android/gradle.properties`: that file is committed, and
  hardcoding this machine's path there would break the Codemagic build in
  Phase 4.
- `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT` set as user env vars.

First build took 21m30s cold (Gradle distribution, AGP and the whole AndroidX
graph). Rebuilds are incremental.

### What the native build found that the web build never could

Most of the endpoints the client app calls refuse a cross-origin preflight. The
shell runs on `https://localhost`, so every call to app.redefineacademy.com is
cross-origin; the web app is same-origin and never needed the headers. Probed
against production rather than reasoned about:

    barcode        preflight=405  allow-origin=(none)
    food-search    preflight=200  allow-origin=(none)
    analyze        preflight=405  allow-origin=(none)
    coach          preflight=204  allow-origin=*

In the app that is barcode scan, meal and fridge scan, food search, Strava and
the push test — most of the food logging Paul asked for last week — failing with
nothing in the UI to explain why. Fixed by giving the eight client-called
endpoints the house `CORS` headers from `_auth.mjs` plus an OPTIONS
short-circuit. **Deployed as a draft and verified there; still needs promoting
to production.**

This is the general shape of the risk for Phases 2-4: the native shell is a
different origin, and anything that quietly assumed same-origin breaks only once
it is running on a phone.

### Left for later, deliberately

- **Store icon art.** The launcher icon is Paul's full lockup, which is correct
  but reduces to an unreadable wordmark at 48dp. The bolt alone would read, and
  it cannot be extracted from this artwork — the wordmark is knocked out of the
  bolt and most letters break its outline, so masking leaves holes. Redrawing
  the mark is Paul's call. Phase 5.
- **The update prompt.** `UpdatePrompt.jsx` polls `/version.json`, which inside
  the shell resolves to the copy bundled in the APK and therefore never
  changes. That is the right behaviour natively — updates come from the store,
  not from a refresh — so it is left alone, not fixed.
- **Release signing.** This is the debug key. A Play upload needs a real
  keystore, which is Phase 5 work and belongs somewhere safer than the repo.
