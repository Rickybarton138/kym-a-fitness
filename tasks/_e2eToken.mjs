// A session token for the e2e scripts, without anybody's password.
//
// The meal planner was open to anonymous callers until 14 Oct 2026, so these
// scripts could just POST at it. Now they cannot, and the honest fix is NOT to
// script a sign-in: that would mean a real password in a shell history and real
// test activity on a production account, both of which the brief rules out.
//
// So the token comes from a browser session the person already has open. In the
// app, with devtools open:
//
//   JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('auth-token'))[1]).access_token
//
// then, in this shell:
//
//   export E2E_TOKEN=<that string>      (PowerShell: $env:E2E_TOKEN = '<that>')
//
// It is a short-lived access token, not a password and not a refresh token, and
// it expires on its own within the hour. Nothing here stores it.
//
// Without it, the scripts still run every assertion that does not need a
// session — the refusals — and say plainly that the success paths were not
// tested, rather than printing a green summary that proves nothing.

export const E2E_TOKEN = process.env.E2E_TOKEN || null

/** Headers for a call that should be authenticated. */
export const authed = (extra) => ({
  'content-type': 'application/json',
  ...(E2E_TOKEN ? { authorization: `Bearer ${E2E_TOKEN}` } : {}),
  ...(extra || {}),
})

/** The line to print when there is no token. Loud on purpose. */
export function noTokenNotice(what) {
  return [
    '',
    `  --   NOT TESTED: ${what}`,
    '       These endpoints now require a session, so there is nothing to assert without one.',
    '       Set E2E_TOKEN from a logged-in browser session — see tasks/_e2eToken.mjs for the',
    '       one-liner. No password is involved and nothing is written.',
  ].join('\n')
}
