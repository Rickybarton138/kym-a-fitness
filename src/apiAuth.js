// The session token, on every call to our own functions.
//
// Until 14 Oct 2026 the nine AI endpoints took no identity at all, because no
// call site sent one. That was the whole reason they could not be authenticated:
// the server rule was easy, the missing half was here.
//
// This is deliberately a HEADER helper rather than a fetch wrapper. Each call
// site reads its response differently — some throw on a bad status, some read
// `json.error` out of a 200, `ExerciseGuide` expects arrays back even on a
// failure — and replacing all of that with one wrapper would be a much larger
// change than the one being made. Spreading these headers into the existing
// fetch leaves every call site's error handling exactly as it was.
//
// `getSession()` refreshes an expired token on the way past, which is why it is
// used rather than reading storage. A missing token is not special-cased: if
// there genuinely is no session the app is already showing the login screen, and
// the server's 401 says the right thing anyway.
//
// It lives in its own module rather than in `lib.js` because `lib.js` is
// imported by node tests and e2e scripts, and a Supabase client needs
// `import.meta.env`, which does not exist outside Vite.
import { supabase } from './supabaseClient.js'

export async function authHeaders(extra) {
  const headers = { 'content-type': 'application/json', ...(extra || {}) }
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (token) headers.authorization = `Bearer ${token}`
  } catch { /* private mode, or no session — the server decides what that means */ }
  return headers
}
