// Reading the model's answer out of a Claude response.
//
// `content[0]` is not the answer. A model that thinks puts a `thinking` block
// first, so `content[0].text` is `undefined` and every caller silently parses
// its fallback instead — `'{}'`, `'[]'`, `''`. That is not a visible failure:
// the request is a clean HTTP 200 and the empty result reads as the model being
// bad at the job. It cost an afternoon in meal-plan.mjs on 8 Sept before the
// diagnostic that named it (see tasks/lessons.md).
//
// Every one of these functions is on Haiku today and Haiku emits no thinking
// block, so none of them is broken right now. This is insurance: the day any of
// them is pointed at a thinking model, it fails silently rather than loudly.
//
// `stopReason` is here for the same reason — `max_tokens` with no text block is
// a budget failure, not a bad answer, and deserves a different message.

/** The first text block's content, or `fallback` if the response has none.
 *
 * `||` rather than `??` on purpose. Every caller passes a fallback that is safe
 * to parse — '{}', '[]', '' — and the code they replaced read
 * `j?.content?.[0]?.text || '{}'`, which fell back on an empty string too. With
 * `??` an empty text block would reach `JSON.parse('')` and throw where it used
 * to parse cleanly. The old behaviour is the one that must survive. */
export function firstText(j, fallback = '') {
  const tb = (j?.content || []).find((b) => b?.type === 'text')
  return tb?.text || fallback
}

/** Why the model stopped — 'max_tokens' means it ran out of budget mid-answer. */
export function stopReason(j) {
  return j?.stop_reason || null
}
