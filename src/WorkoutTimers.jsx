import React, { useCallback, useEffect, useRef, useState } from 'react'
import { TIMER_NAMES, MAX_TIMER_SECONDS, timerStorageKey, newTimers, restoreTimers, remainingMs, changeTimer, formatTimer } from './workoutTimers.js'

export function useWorkoutTimers({ enabled, clientId, brand, planId }) {
  const key = timerStorageKey(clientId, brand, planId)
  const [state, setState] = useState(() => {
    if (enabled) { try { return restoreTimers(localStorage.getItem(key)) } catch { /* unavailable storage */ } }
    return newTimers()
  })
  const current = useRef(state)
  const audio = useRef(null)
  const cleared = useRef(false)
  const [now, setNow] = useState(Date.now)
  const [storageError, setStorageError] = useState('')
  const [notice, setNotice] = useState('')

  const commit = useCallback((next) => {
    current.current = next
    setState(next)
    if (!enabled || cleared.current) return
    try { localStorage.setItem(key, JSON.stringify(next)); setStorageError('') }
    catch { setStorageError('Timer progress cannot be saved on this device. Keep this screen open.') }
  }, [enabled, key])

  function enableAudio() {
    if (!enabled || !current.current.sound) return
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!audio.current && AudioContext) audio.current = new AudioContext()
      audio.current?.resume().catch(() => {})
    } catch { /* visual completion remains available */ }
  }

  const alertDone = useCallback((names) => {
    setNotice(names.map((name) => `${TIMER_NAMES[name]} finished`).join('. ') + '.')
    if (!current.current.sound || document.visibilityState !== 'visible') return
    try {
      const ctx = audio.current
      if (!ctx || ctx.state !== 'running') return
      for (let i = 0; i < 3; i++) {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + i * 0.25
        oscillator.frequency.value = 880
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(0.12, at + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16)
        oscillator.connect(gain); gain.connect(ctx.destination)
        oscillator.start(at); oscillator.stop(at + 0.18)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      }
    } catch { /* browser sound is optional */ }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const tick = () => {
      if (cleared.current) return
      const time = Date.now(), prev = current.current, next = { ...prev }, completed = []
      setNow(time)
      for (const name of Object.keys(TIMER_NAMES)) {
        next[name] = changeTimer(prev[name], 'tick', time)
        if (next[name] !== prev[name]) completed.push(name)
      }
      if (completed.length) { commit(next); alertDone(completed) }
    }
    tick()
    const interval = setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('pageshow', tick)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pageshow', tick) }
  }, [enabled, commit, alertDone])

  useEffect(() => () => { audio.current?.close().catch(() => {}); audio.current = null }, [])

  function act(name, action, seconds) {
    if (!enabled) return
    if (action === 'start' || action === 'restart') enableAudio()
    const time = Date.now()
    setNow(time); setNotice('')
    commit({ ...current.current, [name]: changeTimer(current.current[name], action, time, seconds) })
  }

  return {
    state, now, storageError, notice, act,
    setOption(name, value) { commit({ ...current.current, [name]: value }); if (name === 'sound' && value) enableAudio() },
    onSetComplete() { if (enabled && current.current.autoRest) act('rest', 'restart') },
    pauseAll() {
      if (!enabled) return
      const time = Date.now(), next = { ...current.current }
      for (const name of Object.keys(TIMER_NAMES)) next[name] = changeTimer(next[name], 'pause', time)
      commit(next)
    },
    clear() {
      if (!enabled) return
      cleared.current = true
      current.current = newTimers(); setState(current.current)
      try { localStorage.removeItem(key) } catch { /* completed timers cannot resume */ }
    },
  }
}

export function WorkoutTimers({ timers }) {
  const { state, now, act } = timers
  return (
    <section className="workout-timers" aria-label="Workout timers">
      <div className="workout-timer-grid">
        {Object.entries(TIMER_NAMES).map(([name, label]) => {
          const timer = state[name], running = timer.status === 'running', done = timer.status === 'done'
          return <div className={'workout-timer' + (running ? ' running' : '') + (done ? ' complete' : '')} key={name}>
            <h3>{label} <span>{done ? 'Finished' : running ? 'Running' : timer.status === 'paused' ? 'Paused' : 'Ready'}</span></h3>
            <output role="timer" aria-label={`${label} time remaining`} aria-live="off">{formatTimer(remainingMs(timer, now))}</output>
            <div className="workout-timer-actions">
              <button type="button" className="btn primary sm" aria-label={`${running ? 'Pause' : timer.status === 'paused' ? 'Resume' : 'Start'} ${name} timer`} onClick={() => act(name, running ? 'pause' : 'start')}>{running ? 'Pause' : timer.status === 'paused' ? 'Resume' : 'Start'}</button>
              <button type="button" className="btn ghost sm" aria-label={`Reset ${name} timer`} onClick={() => act(name, 'reset')}>Reset</button>
            </div>
          </div>
        })}
      </div>
      <details className="workout-timer-settings">
        <summary>Timer settings</summary>
        <div className="workout-timer-grid">
          {Object.entries(TIMER_NAMES).map(([name, label]) => <label className="field" key={name}>{label} seconds
            <input type="number" inputMode="numeric" min="1" max={MAX_TIMER_SECONDS} defaultValue={state[name].seconds} key={state[name].seconds} disabled={state[name].status === 'running' || state[name].status === 'paused'} onBlur={(e) => {
              const value = Number(e.target.value)
              if (Number.isInteger(value) && value >= 1 && value <= MAX_TIMER_SECONDS) act(name, 'duration', value)
              else e.target.value = state[name].seconds
            }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
          </label>)}
        </div>
        <p className="muted-note">Set 1–3,600 seconds. Reset a timer to change its duration.</p>
        <label className="workout-timer-option"><input type="checkbox" checked={state.autoRest} onChange={(e) => timers.setOption('autoRest', e.target.checked)} />Start rest automatically when I tick a set</label>
        <label className="workout-timer-option"><input type="checkbox" checked={state.sound} onChange={(e) => timers.setOption('sound', e.target.checked)} />Play a sound when finished</label>
        <p className="muted-note">Keep the app open for sound. If you switch apps or lock your phone, the countdown catches up when you return. Pause & leave pauses both timers.</p>
      </details>
      <p className="workout-timer-notice" role="status">{timers.notice}</p>
      {timers.storageError && <p className="error">{timers.storageError}</p>}
    </section>
  )
}
