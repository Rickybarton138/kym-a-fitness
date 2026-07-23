# Replacing ClubWise + FitSense for BBL — Full Product Scope & Build Plan

**Framing:** Behave as the founder of ClubWise who has just discovered AI, and is rebuilding
every system from scratch — AI-native, automation-first, nothing done by a human that a
machine can do reliably. The goal for Lekan (BBL Gym) is a single professional product that
replaces **everything** he pays FitSense + ClubWise for, and does more.

---

## 1. The reframe

ClubWise is a 20-year-old admin platform with a member app (FitSense) bolted on top. It was
built before AI existed, so a human does the work: chasing payments, watching cashflow,
answering the phone, spotting who's about to quit, filling classes, writing the newsletter.

We're not "adding AI to a gym app". We're building **what ClubWise would be if it were founded
in 2026**: one system where the software does the work and the owner just gets told what
happened and what needs him. Every ClubWise function becomes an automation; every FitSense
screen becomes AI-powered.

One platform. Three doors into it: **Member**, **Front desk / staff**, **Owner**.
White-label, so it's *BBL's* product, not ours on the outside.

---

## 2. What it needs to BE (the non-negotiables of a "professional" product)

Replacing his core business software is not a features race — it's a trust transfer. To be
professional it must be:

1. **One system, all roles** — member app, staff desk, owner command centre — same data, one login model. No more app-plus-admin-plus-spreadsheet.
2. **AI-native + automation-first** — the default answer to "who does this?" is *the system does*. Humans only handle exceptions and relationships.
3. **Regulated money on proper rails** — we do NOT become a BACS bureau. Collection + recovery run on **GoCardless** (FCA-regulated, BACS-approved, Success+ auto-retry). We build the intelligence and the view on top. This removes the single biggest risk and objection.
4. **Mission-critical reliability** — billing and access cannot break. Every critical cutover runs **in parallel with ClubWise until proven** — no gap, no missed collection, reversible.
5. **The gym owns its data** — members, payments, history exportable and his. No lock-in — the opposite of ClubWise.
6. **Real onboarding, migration & support** — data migration from ClubWise, a proper go-live, a support line, uptime he can rely on. "Professional" = he never feels stranded.

---

## 3. The product — 10 modules, each re-imagined with AI + automation

| # | Module | Replaces (ClubWise/FitSense) | The AI + automation upgrade |
|---|--------|------------------------------|------------------------------|
| 1 | **Members & CRM** | Membership management | Auto-segments members (rising / at-risk / dormant / VIP); **churn prediction** from attendance drop-off; win-back actions drafted automatically. Join → onboarding sequence fires itself. |
| 2 | **Payments, DD & Recovery** | Direct debit collection, recovery, integrated payments | **GoCardless** collects + auto-retries. AI triages every failed payment (retry vs message vs flag), writes the chase in BBL's tone, and **predicts failures before they happen**. Full dunning ladder runs with zero staff effort. |
| 3 | **Cashflow & Owner Intelligence** | Performance dashboards, reporting | Live MRR/churn/LTV/utilisation + **forward cashflow** (what's in, when). A daily **plain-English owner briefing** ("here's the money, here's who needs you today"). Ask it anything in natural language. *(Demo already live.)* |
| 4 | **Access & Check-in** | QR access control | Desk check-in with green/red **paid-status flag** + attendance logging (manned desk, no door hardware needed at BBL). AI flags "not seen in 3 weeks" as churn risk automatically. |
| 5 | **Class & PT Booking** | Class bookings, timetable | Booking + waitlists + PT slots. AI **demand-forecasts** classes, auto-promotes waitlists, predicts no-shows, auto-charges no-show fees, flags dying classes to cut. |
| 6 | **AI Coaching** | FitSense Workout / Cardio | Already far beyond FitSense: AI workout builder, meal scan, fridge-to-plate, body scan, form check, muscle targeter, macro tracking. **This is what ClubWise simply cannot do.** *(Built.)* |
| 7 | **AI Front Desk** | — (nothing in ClubWise) | 24/7 **voice receptionist** answers the phone + web chat + WhatsApp + Instagram DMs on one brain: FAQs, prices, freeze/cancel, books tours into the calendar, captures leads to CRM, escalates only when needed. |
| 8 | **Engagement & Retention** | Member engagement, loyalty | Community feed + **accountability bot** (built), auto milestone/birthday messages, AI-written re-engagement campaigns for lapsing members, loyalty points auto-awarded on attendance/referrals. |
| 9 | **Staff & Operations** | Staff management | Rotas, roles, tasks. AI **generates the day's task list from the data** ("call these 6 at-risk members") and drafts the messages. Shift reminders automated. |
| 10 | **Marketing & Growth** | — (ClubWise barely does this) | Lead capture + referral engine + social content written by AI; the Front Desk bot nurtures leads trial→join. Turns the platform from a cost into a revenue driver. |

---

## 4. Build order — the phased roadmap

Each phase ships something usable, value lands early, and **risk only rises as trust rises.**
He keeps ClubWise running until each replaced piece is proven.

### Phase 0 — Foundation *(done / in place)*
Coaching app live, white-label branding, member+coach roles, cashflow demo, community, accountability bot, messaging, Lekan's owner login.

### Phase 1 — Replace FitSense *(≈ weeks 1–3, low risk)*
Member-app parity **and better**: booking, desk check-in with paid-flag, profile, contact, perks, engagement — on top of the AI coaching he already can't get elsewhere.
→ **Outcome:** he cancels the FitSense white-label. Runs fully alongside ClubWise.

### Phase 2 — Owner Command Centre + AI Front Desk *(≈ weeks 3–6, high value / low regulatory risk)*
Live owner intelligence + daily briefing; CRM + churn alerts; automated engagement; the **AI phone/chat/DM receptionist**.
→ **Outcome:** he *feels* more in control than ClubWise ever gave him, and the phone answers itself. This is the "I'm sold" phase — all upside, none of his money moved yet.

### Phase 3 — Payments & Recovery cutover *(≈ weeks 6–10, THE big one — premium tier)*
GoCardless live collection; **migrate ~200 direct-debit mandates** off ClubWise (staged, parallel-run, no gap); automated dunning ladder live; real cashflow wired to live data.
→ **Outcome:** the day he leaves ClubWise. Priced as a premium tier because we now run his revenue. Only attempted once Phases 1–2 have earned trust.

### Phase 4 — Full ops + growth *(ongoing)*
Staff/rotas, marketing/referral engine, loyalty automation, native app wrapper (push + Apple Health/wearables), multi-site licencing.

---

## 5. How we build it (tech)

- **Existing stack, extended:** Vite/React PWA + Supabase (Postgres/Auth/RLS/Storage) + Netlify Functions → Claude. Already carrying the coaching suite, community, accountability, cashflow, messaging.
- **New integrations:** GoCardless (BACS DD + Success+), a calendar/booking layer, Twilio Voice or a voice-agent service (Vapi/Retell/ElevenLabs) for the phone bot, WhatsApp/Instagram messaging APIs.
- **Automation engine:** n8n (already running locally) or Supabase edge functions + cron to orchestrate dunning, briefings, nudges, lead nurture, task generation — the "does it itself" layer.
- **AI layer:** Claude for the chatbot brain, owner briefings, message drafting, churn reasoning, and all coaching.
- **Reuse:** dunning/invoice-chaser muscle already built in magna-park-crm; cashflow view built; coaching, community, accountability, messaging built.

---

## 6. Commercial model (maps to phases)

- **Phase 1 (coaching + member app):** £199/gym/month flat, founding rate locked 12 months. Kills FitSense.
- **Phase 2 add-ons:** AI Front Desk / phone bot as a paid module (its own line — voice infra costs money and it's pure new value); Owner Command Centre included.
- **Phase 3 (billing takeover):** premium tier uplift — we're now running his collection + recovery. Still beats ClubWise's fee-plus-a-cut model because it's flat and doesn't scale with member count.
- **Positioning:** always flat, per-gym, never a slice of his memberships. Multi-site = per-location licence (his growth = our growth, visibly).

---

## 7. Risks & how we de-risk

| Risk | Mitigation |
|------|------------|
| Mandate migration breaks his cashflow | Parallel-run with ClubWise; staged batches; GoCardless's supported switch process; no collection gap; fully reversible until signed off. |
| Billing/access downtime | GoCardless (regulated, resilient) for money; desk check-in works offline-tolerant; critical paths monitored. |
| "Two blokes running my revenue" fear | We never touch the money — GoCardless does. We're the software. Named, trusted, regulated rails. |
| He feels stranded (professional expectation) | Real onboarding, data migration from ClubWise, support line, his data exportable — no lock-in. |
| Over-promising the build | Phase-gated; each phase shippable and paid; Phase 3 only after 1–2 prove out. |

---

## 8. Already built vs new

**Built (Phase 0 + much of 1 & 6):** AI coaching (workouts, meal/fridge/body scan, form check, muscle targeter, macros), community feed, accountability bot, weekly check-ins, messaging, white-label branding, cashflow dashboard demo, owner login, dunning logic (portable from magna-park-crm).

**New (Phases 1–4):** booking + desk check-in, GoCardless integration + mandate migration, AI phone/chat/DM front desk, owner briefing + churn model, CRM segmentation, staff/rotas, marketing/referral engine, native wrapper + wearables.

---

## 9. The one-line pitch for Lekan

> "You're running your gym on 20-year-old admin software with an app bolted on. We're giving
> you what that software would be if it were built today — one system that collects your money,
> answers your phone, spots who's about to quit, and tells you every morning exactly where you
> stand. It replaces FitSense and ClubWise piece by piece, on your timeline, ending with your
> billing when you're ready — and it costs less and never takes a cut of your members."
