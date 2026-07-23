import React, { useState } from 'react'
import { MUSCLES, FRONT_SHAPES, BACK_SHAPES } from './muscles.js'

// A stylised, tappable body map. Tap a muscle group to see exercises for it.
export function MuscleTargeter() {
  const [view, setView] = useState('front')
  const [selected, setSelected] = useState(null)
  const shapes = view === 'front' ? FRONT_SHAPES : BACK_SHAPES
  const muscle = selected ? MUSCLES[selected] : null

  function switchView(v) { setView(v); setSelected(null) }

  return (
    <div className="stack">
      <div className="seg">
        <button type="button" className={view === 'front' ? 'on' : ''} onClick={() => switchView('front')}>Front</button>
        <button type="button" className={view === 'back' ? 'on' : ''} onClick={() => switchView('back')}>Back</button>
      </div>

      <div className="card body-card">
        <svg viewBox="0 0 220 400" className="body-svg" role="img" aria-label="Muscle map">
          <g className="body-base">
            <circle cx="110" cy="34" r="20" />
            <rect x="102" y="52" width="16" height="12" rx="4" />
            <rect x="80" y="76" width="60" height="122" rx="22" />
            <rect x="46" y="86" width="22" height="112" rx="11" />
            <rect x="152" y="86" width="22" height="112" rx="11" />
            <rect x="84" y="196" width="26" height="176" rx="13" />
            <rect x="110" y="196" width="26" height="176" rx="13" />
          </g>
          {shapes.map((s, i) => {
            const cls = 'm-zone' + (selected === s.m ? ' on' : '')
            return s.el === 'ellipse'
              ? <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} className={cls} onClick={() => setSelected(s.m)} />
              : <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} className={cls} onClick={() => setSelected(s.m)} />
          })}
        </svg>
        <p className="muted-note body-hint">Tap a muscle group{muscle ? '' : ' to see exercises'}.</p>
      </div>

      {muscle && (
        <div className="card">
          <p className="eyebrow accent">{muscle.label}</p>
          <p className="muted-note">Exercises to target your {muscle.label.toLowerCase()}:</p>
          <div className="ex-chips">
            {muscle.exercises.map((e) => <span className="ex-chip" key={e}>{e}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}
