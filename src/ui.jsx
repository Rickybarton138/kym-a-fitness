import React from 'react'
import { setTypeLabel, setTypeNote } from './WorkoutRows.jsx'

export function Ring({ value, label, children }) {
  const deg = Math.round(Math.min(Math.max(value, 0), 1) * 360)
  return (
    <div className="ring" style={{ background: `conic-gradient(var(--accent-hi) ${deg}deg, var(--ring-track) ${deg}deg)` }}>
      <div className="ring-inner">
        <div className="ring-val">{children}</div>
        <span className="ring-label">{label}</span>
      </div>
    </div>
  )
}

export function MacroBar({ label, have, goal, unit }) {
  const pct = goal ? Math.min(have / goal, 1) * 100 : 0
  return (
    <div className="mbar">
      <div className="mbar-top">
        <span>{label}</span>
        <span className="num">{have} / {goal}{unit}</span>
      </div>
      <div className="mbar-track"><i style={{ width: pct + '%' }} /></div>
    </div>
  )
}

export function MacroRow({ m }) {
  if (!m) return null
  return (
    <div className="macro-row">
      <span><b>{m.protein_g}g</b> protein</span>
      <span><b>{m.carbs_g}g</b> carbs</span>
      <span><b>{m.fat_g}g</b> fat</span>
      <span className="kcal"><b>{m.calories}</b> kcal</span>
    </div>
  )
}

export function Loader({ text }) {
  return (
    <div className="loader">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  )
}

export function TrendChart({ data, field }) {
  const w = 300, h = 120, pad = 10
  if (!data || data.length < 2) {
    return <p className="muted-note">Log at least two measurements to see your trend.</p>
  }
  const ys = data.map((d) => Number(d[field]))
  const min = Math.min(...ys) - 0.5, max = Math.max(...ys) + 0.5
  const span = max - min || 1
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (Number(d[field]) - min) / span) * (h - pad * 2)
    return [x, y]
  })
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`
  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Trend">
      <path d={area} fill="var(--accent)" opacity="0.12" />
      <path d={line} fill="none" stroke="var(--accent-hi)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="var(--accent-hi)" />
    </svg>
  )
}

// Renders an exercise's sets. New format = sets array (per-set reps/weight);
// old format = a set count + single reps/weight (kept for existing sessions).
export function ExSets({ ex }) {
  const extra = ex.equipment && !['Own choice', 'Coach plan', 'Squad plan'].includes(ex.equipment) ? ' · ' + ex.equipment : ''
  const type = ex.set_type && ex.set_type !== 'straight' ? ex.set_type : null
  const chip = type ? (type === 'superset' && ex.group ? 'Superset ' + ex.group : setTypeLabel(type)) : null
  const setWord = type === 'dropset' ? 'Drop' : 'Set'
  if (Array.isArray(ex.sets)) {
    return (
      <div className="set-list">
        {chip && <span className="settype-chip">{chip}</span>}
        {ex.rpe && <span className="settype-chip rpe">RPE {ex.rpe}</span>}
        {ex.sets.map((st, i) => (
          <div className="set-line" key={i}>
            <span className="sl-n">{setWord} {i + 1}</span>
            <span className="sl-v">{st.reps ? st.reps + ' reps' : '—'}{st.weight ? ' @ ' + st.weight + 'kg' : ''}</span>
          </div>
        ))}
        {type && setTypeNote(type) && <div className="ex-meta">{setTypeNote(type)}</div>}
        {extra && <div className="ex-meta">{extra.replace(' · ', '')}</div>}
      </div>
    )
  }
  return <div className="ex-meta">{ex.sets} × {ex.reps}{ex.weight ? ' @ ' + ex.weight : ''}{ex.rpe ? ' · RPE ' + ex.rpe : ''}{extra}</div>
}

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
export function IconHome() { return <svg viewBox="0 0 24 24" {...s}><path d="M3 11l9-7 9 7M5 10v10h14V10" /></svg> }
export function IconTrain() { return <svg viewBox="0 0 24 24" {...s}><path d="M6 7v10M18 7v10M4 9.5v5M20 9.5v5M6 12h12" /></svg> }
export function IconFridge() { return <svg viewBox="0 0 24 24" {...s}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M5 12h14M9 6v2M9 15v2" /></svg> }
export function IconMeal() { return <svg viewBox="0 0 24 24" {...s}><path d="M4 8l2-3h12l2 3" /><rect x="4" y="8" width="16" height="12" rx="2" /><circle cx="12" cy="14" r="3" /></svg> }
export function IconBody() { return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="7" r="4" /><path d="M5 21c0-4 3-6 7-6s7 2 7 6" /></svg> }
export function IconAsk() { return <svg viewBox="0 0 24 24" {...s}><path d="M20 4H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4v3l4-3h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z" /><path d="M9.6 9a2.4 2.4 0 0 1 3.5-1.4c1.3.8 1.1 2.4 0 3-.7.4-1.1.9-1.1 1.6" /><path d="M12 14.6h.01" /></svg> }
export function IconForm() { return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.2l4.5 2.8L10 14.8z" /></svg> }
export function IconContent() { return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="12" cy="12" r="3.2" /><path d="M17 6.8h.01" /></svg> }
export function IconCommunity() { return <svg viewBox="0 0 24 24" {...s}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.8M18 20c0-2.8-1.4-4.3-3.5-4.8" /></svg> }
export function IconTest() { return <svg viewBox="0 0 24 24" {...s}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg> }
