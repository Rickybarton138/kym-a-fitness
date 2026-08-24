import React, { useState } from 'react'
import { aggregateLifts } from './lifts.js'
import { TrendChart } from './ui.jsx'

// Per-exercise weight progression, built from saved sessions. Shown to the client
// (their own lifts) and the coach (their client's lifts).
export function LiftProgress({ plans, title = 'Weights lifted' }) {
  const lifts = aggregateLifts(plans)
  if (lifts.length === 0) return null
  return (
    <div className="card">
      <p className="eyebrow">{title}</p>
      <p className="muted-note">Weight lifted over time, pulled from saved sessions. Tap a lift to see the trend.</p>
      {lifts.map((l) => <LiftRow key={l.name} lift={l} />)}
    </div>
  )
}

function LiftRow({ lift }) {
  const [open, setOpen] = useState(false)
  const hasHistory = lift.points.length > 1
  const up = hasHistory && lift.latest > lift.start
  const down = hasHistory && lift.latest < lift.start
  return (
    <div className="lift-row">
      <button type="button" className="lift-head" onClick={() => setOpen((o) => !o)}>
        <span className="lift-name">{lift.name}</span>
        <span className="lift-val">
          {hasHistory ? (
            <>Started {lift.start}kg → now {lift.latest}kg{up && <span className="delta good"> ↑</span>}{down && <span className="delta"> ↓</span>}</>
          ) : (
            <>{lift.latest}kg <span className="muted-note">· first log</span></>
          )}
          {lift.best !== lift.latest && <span className="muted-note"> · best {lift.best}kg</span>}
        </span>
      </button>
      {open && (lift.points.length >= 2
        ? <TrendChart data={lift.points} field="weight" />
        : <p className="muted-note">Log this lift again to see the trend.</p>)}
    </div>
  )
}
