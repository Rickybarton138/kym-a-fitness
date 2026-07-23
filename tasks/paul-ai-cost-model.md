# AI cost model — pricing Paul as he scales

Captured 2026-07-23. Purpose: make sure Paul's fee covers the AI (Claude) calls
his members generate, with margin, as he grows his client base.

## What we pay per call (current setup)

Model pricing (per 1M tokens): Opus 4.8 = **$5 in / $25 out**. Haiku 4.5 = **$1 in / $5 out**.
The app sends **everything to Opus 4.8 except the form check** (Haiku). No prompt
caching — the full system prompt is re-sent on every call.

Per-call cost (rough, incl. system prompt + context; vision adds ~1.6k image tokens):

| AI action | Model | ~in / out tokens | Cost/call (USD) | ~GBP |
|---|---|---|---|---|
| Meal scan (vision) | Opus | 3,100 / 1,400 | $0.050 | £0.040 |
| Fridge-to-Plate (vision) | Opus | 3,100 / 1,400 | $0.050 | £0.040 |
| Workout generate | Opus | 2,000 / 1,400 | $0.045 | £0.036 |
| Knowledge parse | Opus | 2,000 / 1,400 | $0.045 | £0.036 |
| Body scan (vision) | Opus | 3,100 / 700 | $0.033 | £0.026 |
| Ask coach | Opus | 2,500 / 800 | $0.033 | £0.026 |
| Nutrition expert | Opus | 2,000 / 900 | $0.033 | £0.026 |
| Owner/coach briefing | Opus | 2,500 / 600 | $0.028 | £0.022 |
| Form check | Haiku | 5,500 / 500 | $0.008 | £0.006 |

Blended: **~$0.04 (£0.03) per AI interaction** on the current Opus-everywhere setup.

## Cost per active member per month

Depends on engagement. Three profiles:

| Member type | Monthly AI actions | AI cost/mo (USD) | ~GBP |
|---|---|---|---|
| Light (logs occasionally) | ~8 | $0.30 | £0.24 |
| Typical engaged | ~40 | $1.50 | £1.20 |
| Power user (logs every meal + asks + trains) | ~90 | $3.50 | £2.80 |

Coach-side (Paul himself): daily briefing + occasional parse ≈ **$1/mo**. Negligible.

Planning figure: **~£1.20 per active member per month** on the current setup
(assume typical-engaged; power users push it up, inactive members ~£0).

## What that means at scale

| Active members | AI COGS/mo (current, ~£1.20) | With levers below (~£0.30) |
|---|---|---|
| 50 | ~£60 | ~£15 |
| 150 | ~£180 | ~£45 |
| 400 | ~£480 | ~£120 |

The point: **AI COGS scales linearly with active members.** A flat per-gym fee
that ignores member count will get eaten alive once Paul expands. Price so the
per-member component always covers this.

## Two levers that cut COGS ~4-5x (do these before scaling)

1. **Route non-vision calls off Opus.** Ask-coach, nutrition-expert, workout,
   parse, and briefing are text-only and don't need Opus 4.8. Haiku 4.5 is 5x
   cheaper in and out; Sonnet is a middle option for quality-sensitive replies.
   Keep vision (meal/fridge/body scan) on a strong model. Estimated COGS cut:
   text calls drop ~5x → blended per-member from ~£1.20 to ~£0.40.
2. **Prompt-cache the system prompt.** The coach persona + knowledge block is
   stable and re-sent every call; caching bills the cached prefix at ~10%.
   Input is a big share of each call, so this stacks with lever 1 → ~£0.30/member.

Neither changes the product; both are wiring changes in `analyze.mjs`.

## Fee guardrail for Paul

Price Paul so the **per-member component always exceeds AI COGS with margin**,
because COGS grows with his members:

- Current-setup COGS ≈ £1.20/active member/mo. Post-levers ≈ £0.30.
- Recommended: **per-member (or member-band) pricing**, not a pure flat fee.
  A per-active-member charge of ~£4-6/mo leaves healthy gross margin even before
  the levers, and 90%+ margin after them.
- Add a **fair-use cap** (e.g. N AI actions/member/mo) with simple overage, so a
  handful of power users can't invert the economics.
- If Paul wants a flat headline price, band it: e.g. up to 50 members £X, up to
  150 £Y, up to 400 £Z — each band priced off the COGS table above.

## Assumptions to calibrate with Ricky

- Token counts are estimates; real system prompts may be larger (raises input
  share → makes prompt caching matter more).
- Engagement mix (how many members are typical vs power) drives the blended
  figure most. Once live, read real usage from the Claude/Anthropic dashboard
  and re-baseline.
- GBP at ~$1 = £0.79.
