export const TIMER_NAMES = { rest: 'Rest', exercise: 'Exercise' }
export const MAX_TIMER_SECONDS = 3600

export const timerStorageKey = (clientId, brand, planId) =>
  `workout-timers:v1:${brand}:${clientId}:${planId}`

const freshTimer = (seconds) => ({ seconds, remainingMs: seconds * 1000, endAt: null, status: 'idle' })
export const newTimers = () => ({ version: 1, rest: freshTimer(90), exercise: freshTimer(30), autoRest: false, sound: true })

// Store a deadline rather than counting interval callbacks: phones suspend
// callbacks while locked/backgrounded, but elapsed real time still counts.
export function remainingMs(timer, now = Date.now()) {
  return Math.max(0, timer.status === 'running' ? Math.min(timer.seconds * 1000, timer.endAt - now) : timer.remainingMs)
}

export function changeTimer(timer, action, now = Date.now(), seconds) {
  if (action === 'duration') {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_TIMER_SECONDS) return timer
    return freshTimer(seconds)
  }
  if (action === 'reset') return freshTimer(timer.seconds)
  if (action === 'start' || action === 'restart') {
    if (action === 'start' && timer.status === 'running') return timer
    const left = action === 'start' && timer.status === 'paused' && timer.remainingMs > 0 ? timer.remainingMs : timer.seconds * 1000
    return { ...timer, remainingMs: left, endAt: now + left, status: 'running' }
  }
  const left = remainingMs(timer, now)
  if (action === 'pause' && timer.status === 'running') return { ...timer, remainingMs: left, endAt: null, status: left ? 'paused' : 'done' }
  if (action === 'tick' && timer.status === 'running' && left === 0) return { ...timer, remainingMs: 0, endAt: null, status: 'done' }
  return timer
}

export function restoreTimers(raw) {
  const fallback = newTimers()
  try {
    const saved = JSON.parse(raw)
    if (saved?.version !== 1) return fallback
    for (const name of Object.keys(TIMER_NAMES)) {
      const t = saved[name]
      if (!t || !Number.isInteger(t.seconds) || t.seconds < 1 || t.seconds > MAX_TIMER_SECONDS ||
        !['idle', 'running', 'paused', 'done'].includes(t.status) ||
        !Number.isFinite(t.remainingMs) || t.remainingMs < 0 || t.remainingMs > t.seconds * 1000 ||
        (t.status === 'running' && (!Number.isFinite(t.endAt) || t.endAt <= 0))) continue
      fallback[name] = { seconds: t.seconds, remainingMs: t.remainingMs, endAt: t.status === 'running' ? t.endAt : null, status: t.status }
    }
    fallback.autoRest = saved.autoRest === true
    fallback.sound = saved.sound !== false
    return fallback
  } catch { return fallback }
}

export function formatTimer(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
