import React, { useEffect, useState } from 'react'

// Why this exists: an installed PWA that is *resumed* (app-switched back to)
// never performs a navigation, so it keeps running the JS bundle already in
// memory — for days. Shipped features then look "not landed" to the client
// while production is entirely correct. The service worker can't help: it only
// re-checks on a real navigation, which is exactly what never happens.
//
// So the app asks the server what the current build is whenever it comes back
// to the foreground, and offers a reload if it has fallen behind.
//
// A prompt, never an automatic reload — a client can be mid-workout or
// mid-food-log, and silently binning that is worse than being a build behind.
const CHECK_MS = 60 * 60 * 1000 // also poll hourly while left open

export default function UpdatePrompt() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (location.hostname === 'localhost') return
    let cancelled = false

    async function check() {
      if (cancelled || stale || document.visibilityState !== 'visible') return
      try {
        // cache-bust twice over: no-store for the browser, a query for any CDN
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
        if (!res.ok) return
        const { build } = await res.json()
        if (build && build !== __BUILD_ID__) setStale(true)
      } catch { /* offline or mid-deploy — just try again next time */ }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, CHECK_MS)
    check()
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [stale])

  if (!stale) return null
  return (
    <div className="update-bar" role="status">
      <span>A new version of the app is ready.</span>
      <button type="button" onClick={() => window.location.reload()}>Reload</button>
    </div>
  )
}
