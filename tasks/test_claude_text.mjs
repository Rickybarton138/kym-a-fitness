// Unit test for netlify/functions/_claude-text.mjs.
//
// Most of these assert the OLD behaviour — what `j?.content?.[0]?.text || '{}'`
// did before the helper replaced it in six functions. Those are the important
// ones: all six run on Haiku and work today, so the risk in this change was
// never "does it handle a thinking model", it was "did the sweep quietly break
// the six things that already worked".
//
// Run: node tasks/test_claude_text.mjs
import { firstText, stopReason } from '../netlify/functions/_claude-text.mjs'

let failed = 0
const eq = (label, got, want) => {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`)
}

// Old behaviour, must survive.
eq('plain text response', firstText({ content: [{ type: 'text', text: 'hello' }] }, '{}'), 'hello')
eq('empty text falls back so JSON.parse does not throw', firstText({ content: [{ type: 'text', text: '' }] }, '{}'), '{}')
eq('no content key', firstText({}, '[]'), '[]')
eq('null response', firstText(null, '{}'), '{}')
eq('empty content array', firstText({ content: [] }, '{}'), '{}')
eq('default fallback is empty string', firstText({}), '')

// The fix: a thinking block first no longer hides the answer.
eq('thinking block first', firstText({ content: [{ type: 'thinking', thinking: '...' }, { type: 'text', text: 'hi' }] }, '{}'), 'hi')
eq('thinking only, no text block', firstText({ content: [{ type: 'thinking', thinking: 'x' }] }, '{}'), '{}')
eq('tool_use before text', firstText({ content: [{ type: 'tool_use', id: 't' }, { type: 'text', text: 'a' }] }, '{}'), 'a')

// max_tokens with no text is a budget failure, not a bad answer.
eq('stop reason surfaced', stopReason({ stop_reason: 'max_tokens' }), 'max_tokens')
eq('stop reason absent', stopReason({}), null)

console.log(failed ? `\n${failed} FAILED` : '\nall green')
process.exit(failed ? 1 : 0)
