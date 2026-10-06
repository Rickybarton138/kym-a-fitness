import React, { useEffect, useState } from 'react'
import { THEME } from './themes.js'
import { WEEKDAYS } from './booking.js'
import { WEEK_ORDER, sortDays } from './lib.js'
import { setTypeLabel, setTypeNote } from './WorkoutRows.jsx'

// Collapsible section wrapper for the coach dashboard/ClientDetail (Paul's
// "tidy the layout up like the client side" ask) — reuses the exact
// tile-group/tile-group-title/tile-group-chev classes the client Home
// accordion already uses. Brands without features.groupedCoach get an inert
// passthrough (children render exactly as before — nobody else's dashboard
// changes shape).
// Which sections are open also survives an app-switch (the rest of "keep the
// coach where they were" lives in TrainerApp) — otherwise coming back to the
// app collapses everything he had open. Only for brands using the accordion.
export function CoachSection({ title, defaultOpen, children }) {
  const grouped = !!THEME.features?.groupedCoach
  const key = 'cbk_coach_sec_' + title
  const [open, setOpen] = useState(() => {
    if (!grouped) return !!defaultOpen
    try { const v = localStorage.getItem(key); if (v !== null) return v === '1' } catch { /* ignore */ }
    return !!defaultOpen
  })
  useEffect(() => {
    if (!grouped) return
    try { localStorage.setItem(key, open ? '1' : '0') } catch { /* ignore */ }
  }, [grouped, key, open])
  if (!grouped) return <>{children}</>
  return (
    <div className="tile-group">
      <button type="button" className="tile-group-title" onClick={() => setOpen((o) => !o)}>
        {title}
        <span className={'tile-group-chev' + (open ? ' open' : '')}>▾</span>
      </button>
      {open && <div className="stack">{children}</div>}
    </div>
  )
}

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

export function Metric({ k, v, d, emphasize }) {
  return (
    <div className={'metric' + (emphasize ? ' metric-emphasize' : '')}>
      <div className="metric-k">{k}</div>
      <div className="metric-v">{v} {d && <span className="delta good">{d}</span>}</div>
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

export const measuredOn = (d) => {
  if (!d) return null
  const dt = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d)
  return Number.isNaN(dt.getTime()) ? null : dt
}
const shortDay = (d) => (measuredOn(d) || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// Paul, 6 Oct: "with the measurements, it shows the graph below, can we add into
// the graph the axis data that shows time and the measurement changes?"
//
// It was a bare sparkline: a shape with no numbers on it, so you could see that
// something had moved but not what it moved from, to, or over how long. Now it
// carries a value axis and dated ends.
//
// Deliberately restrained: three gridlines, hairline, in the muted ink the rest
// of the app uses for secondary text, never the series colour. The latest value
// is the only point labelled directly — a number on every point is noise on a
// 320px-wide chart.
export function TrendChart({ data, field, unit = '' }) {
  if (!data || data.length < 2) {
    return <p className="muted-note">Log at least two measurements to see your trend.</p>
  }
  const w = 320, h = 150
  const padL = 34, padR = 10, padT = 12, padB = 24   // room for the axes
  const ys = data.map((d) => Number(d[field]))
  const lo = Math.min(...ys), hi = Math.max(...ys)
  // A flat series would give a zero span and put the line on an edge; give it
  // some air so it reads as "unchanged" rather than as a boundary.
  const minV = lo === hi ? lo - 1 : lo - (hi - lo) * 0.15
  const maxV = lo === hi ? hi + 1 : hi + (hi - lo) * 0.15
  const span = maxV - minV || 1
  const x = (i) => padL + (i / (data.length - 1)) * (w - padL - padR)
  const y = (v) => padT + (1 - (Number(v) - minV) / span) * (h - padT - padB)

  const pts = data.map((d, i) => [x(i), y(d[field])])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h - padB} L${pts[0][0].toFixed(1)} ${h - padB} Z`
  const ticks = [maxV, (maxV + minV) / 2, minV]
  const round = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10)
  const last = data[data.length - 1]

  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} role="img"
      aria-label={`${field} from ${round(ys[0])}${unit} on ${shortDay(data[0].measured_at)} to ${round(ys[ys.length - 1])}${unit} on ${shortDay(last.measured_at)}`}>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{round(v)}</text>
        </g>
      ))}
      <path d={area} fill="var(--accent)" opacity="0.12" />
      <path d={line} fill="none" stroke="var(--accent-hi)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="var(--accent-hi)" />
      {/* Dated ends rather than a tick per reading: with a dozen measurements the
          labels would collide, and what a coach wants from the x axis is the
          period it covers. */}
      <text x={padL} y={h - 8} fontSize="9" fill="var(--muted)">{shortDay(data[0].measured_at)}</text>
      <text x={w - padR} y={h - 8} textAnchor="end" fontSize="9" fill="var(--muted)">{shortDay(last.measured_at)}</text>
      <text x={pts[pts.length - 1][0]} y={Math.max(10, pts[pts.length - 1][1] - 8)} textAnchor="end"
        fontSize="10" fontWeight="700" fill="var(--text)">{round(ys[ys.length - 1])}{unit}</text>
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
            <span className="sl-v">
              {st.reps ? (/[a-zA-Z]/.test(st.reps) ? st.reps : st.reps + ' reps') : '—'}{st.weight ? ' @ ' + st.weight + 'kg' : ''}
              {/* Once the client has logged the drops, show what they actually
                  did rather than only how many were prescribed — that is the
                  bit the coach wants to read back. */}
              {(st.drop_log || []).some((d) => d.reps || d.weight)
                ? ' → ' + st.drop_log.map((d) => `${d.reps || '?'}${d.weight ? '@' + d.weight : ''}`).join(' → ')
                : st.drops ? ` + ${st.drops} drop${st.drops === 1 ? '' : 's'}` : ''}
            </span>
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

// Weekday order for a training week — Monday first, Sunday last.


// Shared by the client (self-assigning from the library) and the coach
// (AssignProgram) so both flows pick training days the same way.
// `ownDays` = the programme's sessions already carry their own weekdays, so
// picking days here is optional and only overrides them. Without this the
// Confirm button was disabled until you picked days you didn't need (Paul: "if
// the programme specifies the days ... I don't then need to pick training days").
export function ProgramDayPicker({ sessionsPerWeek, initialDays, ownDays, initialStart, confirmLabel, onCancel, onConfirm }) {
  const [days, setDays] = useState(initialDays || [])
  // This is the ONLY start date in the flow. There used to be a second one on
  // the card above, which looked like the real thing and was silently thrown
  // away — Paul set a backdated start there, and the programme always began today
  // (or, if he never reached this step, was never assigned at all).
  const [start, setStart] = useState(initialStart || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })())
  const [busy, setBusy] = useState(false)
  const toggle = (dow) => setDays((ds) => (ds.includes(dow) ? ds.filter((d) => d !== dow) : sortDays([...ds, dow])))
  async function confirm() {
    setBusy(true)
    await onConfirm(days, start)
    setBusy(false)
  }
  return (
    <div className="card" style={{ background: 'var(--surface-2)', marginTop: 8 }}>
      <p className="eyebrow">{ownDays ? 'Training days (optional)' : 'Which days do you want to train?'}</p>
      <p className="muted-note">
        {ownDays
          ? 'This program already sets which day each session falls on — just pick a start date. Only choose days here if you want to override them.'
          : sessionsPerWeek ? `This program has ${sessionsPerWeek} session${sessionsPerWeek === 1 ? '' : 's'} a week — pick ${sessionsPerWeek} day${sessionsPerWeek === 1 ? '' : 's'} and it'll apply the same days across every week.` : 'Pick your training days and it applies across every week.'}
      </p>
      <div className="seg" style={{ flexWrap: 'wrap' }}>
        {WEEK_ORDER.map((dow) => (
          <button type="button" key={dow} className={days.includes(dow) ? 'on' : ''} onClick={() => toggle(dow)}>{WEEKDAYS[dow]}</button>
        ))}
      </div>
      {/* Picking FEWER days than the programme has sessions used to quietly
          strand the extras — one day chosen for a two-session week meant the
          second session could never land on a date. Say so before it is saved,
          rather than letting someone wonder where their legs day went. */}
      {sessionsPerWeek && days.length > 0 && days.length < sessionsPerWeek && (
        <p className="muted-note" style={{ marginTop: 6 }}>
          This program has {sessionsPerWeek} sessions a week and you have picked {days.length} day{days.length === 1 ? '' : 's'}.
          The {sessionsPerWeek - days.length} you have not placed will stay on the day the program sets.
        </p>
      )}
      <label className="field" style={{ marginTop: 8 }}>Start date<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn primary" disabled={(!days.length && !ownDays) || busy} onClick={confirm}>{busy ? 'Adding…' : (confirmLabel || 'Confirm')}</button>
      </div>
    </div>
  )
}

// Paul: "with measurements, can we add the option to log Waist, Chest, Hips,
// Thigh, Bicep". One definition, shared by the client's logging screen and the
// coach's view of it, so the two can never drift apart.
//
// Paul again, 21 Sept: "could we add in shoulders and calf measurements too? A
// couple of people have asked for it." Grouped rather than appended — shoulders
// sits with chest, calf with thigh — because a form that reads down the body is
// easier to work through with a tape in one hand.
export const MEASURE_SITES = [
  { key: 'waist_cm', label: 'Waist' },
  { key: 'chest_cm', label: 'Chest' },
  { key: 'shoulders_cm', label: 'Shoulders' },
  { key: 'hips_cm', label: 'Hips' },
  { key: 'thigh_cm', label: 'Thigh' },
  { key: 'calf_cm', label: 'Calf' },
  { key: 'bicep_cm', label: 'Bicep' },
]
export const MEASURE_TRENDS = [
  { key: 'weight_kg', label: 'Weight', unit: 'kg' },
  { key: 'body_fat', label: 'Body fat', unit: '%' },
  ...MEASURE_SITES.map((s) => ({ ...s, unit: 'cm' })),
]

// Latest reading for every measure that has one, plus a switchable trend.
export function BodyTrends({ measurements }) {
  const [trend, setTrend] = useState('weight_kg')
  const rows = measurements || []
  const latest = rows[rows.length - 1]
  if (!latest) return null
  // Compare like with like: the first reading that actually HAS this measure,
  // not the first row overall, or adding waist later shows a nonsense change.
  const firstWith = (k) => rows.find((m) => m[k] != null)
  const shown = MEASURE_TRENDS.filter((t) => rows.some((m) => m[t.key] != null))
  const active = shown.find((t) => t.key === trend) || shown[0]
  if (!active) return null
  const series = rows.filter((m) => m[active.key] != null)
  return (
    <>
      {/* Paul, 5 Oct: "on the coaches view, when in a clients tab, can it
          display the date their measurements were added?" The card showed the
          numbers and the change with nothing to say WHEN — so a coach could not
          tell last week's weigh-in from one in July. Shared component, so the
          client sees it too, which is right: they are their own dates. */}
      <p className="muted-note" style={{ marginBottom: 8 }}>
        Last measured <b>{shortDay(latest.measured_at)}</b>
        {rows.length > 1 && rows[0].measured_at !== latest.measured_at
          ? ` · ${rows.length} readings since ${shortDay(rows[0].measured_at)}`
          : ''}
      </p>
      <div className="metrics-2">
        {MEASURE_TRENDS.map((t) => {
          if (latest[t.key] == null) return null
          const base = firstWith(t.key)
          const d = base && base !== latest && base[t.key] != null
            ? `${(latest[t.key] - base[t.key]).toFixed(1)}${t.unit}` : ''
          return <Metric key={t.key} k={t.label} v={`${latest[t.key]}${t.unit}`} d={d} />
        })}
      </div>
      {shown.length > 1 && (
        <div className="seg small" style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {shown.map((t) => (
            <button type="button" key={t.key} className={active.key === t.key ? 'on' : ''} onClick={() => setTrend(t.key)}>{t.label}</button>
          ))}
        </div>
      )}
      {series.length > 0 && <TrendChart data={series} field={active.key} unit={active.unit} />}
    </>
  )
}
