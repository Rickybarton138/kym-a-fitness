import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'

// Paul: "I wonder if it is possible to configure the app to run through a series
// of 'popups' that take them through the next steps — you know how some apps do
// a 'walk through' of first up, go here and do xyz, then go to this section?"
//
// Built as a checklist that ticks ITSELF off when the client actually does the
// thing, rather than as floating tooltips. Two reasons, both about his actual
// goal of "maximise people doing the right things":
//   - a tooltip tour is dismissed once and gone, whether or not anything was
//     done; this stays until the work is genuinely done, and survives closing
//     the app because it is derived from their data, not from a progress cursor.
//   - it doubles as a to-do list for the days after they join, which is when
//     people actually drift.
// Each step takes them to the right screen, so it still walks them through.
//
// Standard members only: Inner Circle are set up by Paul personally and being
// nagged to pick their own plan would contradict what he just told them.

const STEPS = [
  {
    key: 'plan',
    title: 'Pick your training plan',
    blurb: 'Browse the programmes and put one on your schedule.',
    go: 'programs',
    check: async (id) => (await supabase.from('client_programs').select('id', { count: 'exact', head: true }).eq('client_id', id).eq('active', true)).count > 0,
  },
  {
    key: 'targets',
    title: 'Check your daily targets',
    blurb: 'Your calories and macros are set from your numbers — have a look and adjust if you need to.',
    go: 'calc',
    check: async (id) => !!(await supabase.from('profiles').select('targets_reviewed_at').eq('id', id).maybeSingle()).data?.targets_reviewed_at,
  },
  {
    key: 'session',
    title: 'Log your first session',
    blurb: 'Tick the sets off as you go and record what you actually lifted.',
    go: 'train',
    check: async (id) => (await supabase.from('workout_completions').select('id', { count: 'exact', head: true }).eq('client_id', id)).count > 0,
  },
  {
    key: 'food',
    title: 'Log your first meal',
    blurb: 'Snap it, scan a barcode or search — whichever is quickest.',
    go: 'nutrition',
    check: async (id) => (await supabase.from('nutrition_logs').select('id', { count: 'exact', head: true }).eq('client_id', id)).count > 0,
  },
  {
    key: 'start',
    title: 'Record your starting point',
    blurb: 'Weight, measurements or a photo — so you can see it change.',
    go: 'body',
    check: async (id) => (await supabase.from('body_measurements').select('id', { count: 'exact', head: true }).eq('client_id', id)).count > 0,
  },
  {
    key: 'hello',
    title: 'Say hello to your coach',
    blurb: 'Tell them anything they should know before you start.',
    go: 'coachhub',
    check: async (id) => (await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', id).eq('sender', 'client')).count > 0,
  },
]

const HIDE_KEY = 'cbk_getting_started_hidden'

export function GettingStarted({ profile, onGo }) {
  const [done, setDone] = useState(null)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    let alive = true
    Promise.all(STEPS.map((s) => s.check(profile.id).catch(() => false)))
      .then((res) => { if (alive) setDone(res) })
    return () => { alive = false }
  }, [profile.id])

  if (hidden || done === null) return null
  // Inner Circle are set up for them; this would contradict their welcome.
  if ((profile.membership_tier || 'standard') !== 'standard') return null

  const count = done.filter(Boolean).length
  if (count === STEPS.length) return null // finished — it disappears on its own

  const nextIdx = done.findIndex((d) => !d)

  const hide = () => {
    setHidden(true)
    try { localStorage.setItem(HIDE_KEY, '1') } catch { /* ignore */ }
  }

  return (
    <div className="card gs-card">
      <div className="gs-head">
        <div>
          <p className="eyebrow accent">Getting started</p>
          <p className="muted-note" style={{ margin: '2px 0 0' }}>{count} of {STEPS.length} done — they tick off as you go.</p>
        </div>
        <button type="button" className="link-btn" onClick={hide}>Hide</button>
      </div>
      <div className="gs-track"><i style={{ width: `${Math.round((count / STEPS.length) * 100)}%` }} /></div>

      <div className="gs-steps">
        {STEPS.map((s, i) => {
          const isDone = done[i]
          const isNext = i === nextIdx
          return (
            <div className={'gs-step' + (isDone ? ' done' : '') + (isNext ? ' next' : '')} key={s.key}>
              <span className="gs-tick" aria-hidden="true">{isDone ? '✓' : i + 1}</span>
              <div className="gs-body">
                <b>{s.title}</b>
                {isNext && <span>{s.blurb}</span>}
              </div>
              {isNext && (
                <button type="button" className="btn primary sm" onClick={() => onGo(s.go)}>Take me there</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Whether this brand walks new clients through their first steps at all.
export const gettingStartedOn = () => !!THEME.features?.gettingStarted
