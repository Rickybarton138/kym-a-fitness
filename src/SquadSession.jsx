import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient.js'
import { ExerciseRowsEditor, rowsToExercises, planToRows, newExerciseRow } from './WorkoutRows.jsx'
import { latestByName, seedWeights } from './lifts.js'

// Live weight-room squad mode: run a whole squad through one session on a tablet.
// It is the solo GuidedWorkout player run N-up — one workout_plans row per athlete,
// seeded from each athlete's own last lift. Finish stamps actuals + completion +
// load through the log_squad_athlete RPC (coach can't write those tables directly).

function toPlayer(exercises) {
  return (exercises || []).map((ex) => {
    const sets = Array.isArray(ex.sets)
      ? ex.sets.map((s) => ({ reps: String(s.reps ?? ''), weight: String(s.weight ?? ''), done: false }))
      : Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, () => ({ reps: String(ex.reps ?? ''), weight: String(ex.weight ?? ''), done: false }))
    return { ...ex, sets }
  })
}
function fromPlayer(playerExs) {
  return (playerExs || []).map((ex) => {
    const { reps, weight, sets, ...rest } = ex
    return { ...rest, sets: (sets || []).map((s) => ({ reps: String(s.reps).trim(), weight: String(s.weight).trim() || null })) }
  })
}

export function SquadSession({ squad, members, coachId, onExit }) {
  const [stage, setStage] = useState('setup') // setup | board | done
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [focus, setFocus] = useState('')
  const [rows, setRows] = useState([newExerciseRow()])
  const [attend, setAttend] = useState(() => new Set(members.map((m) => m.client_id)))
  const [layout, setLayout] = useState('byAthlete') // byAthlete | byExercise
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [sessionId, setSessionId] = useState(null)
  const [athletes, setAthletes] = useState([]) // { clientId, name, planId, exs, rpe, saved }
  const [tab, setTab] = useState(0)
  const [duration, setDuration] = useState('')
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    supabase.from('workout_templates').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
      .then(({ data }) => setTemplates(data || []))
  }, [])

  function pickTemplate(id) {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    if (t) {
      setTitle((cur) => cur || t.title || '')
      setFocus((cur) => cur || t.focus || '')
      setRows(planToRows(t.exercises || []))
    }
  }
  const toggleAttend = (id) => setAttend((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function start() {
    const prescription = rowsToExercises(rows, 'Squad plan')
    if (prescription.length === 0) { setError('Add at least one exercise with a set.'); return }
    const ids = members.filter((m) => attend.has(m.client_id)).map((m) => m.client_id)
    if (ids.length === 0) { setError('Pick at least one athlete for today.'); return }
    setBusy(true); setError('')

    // Snapshot the prescription on the header so post-session review survives the
    // actuals overwrite — for both the template and the build-inline path.
    const { data: sess, error: se } = await supabase.from('squad_sessions')
      .insert({ squad_id: squad.id, coach_id: coachId, title: title.trim() || 'Squad session', template_id: templateId || null, prescription })
      .select().single()
    if (se || !sess) { setBusy(false); setError(se?.message || 'Could not start session.'); return }

    // Seed weights from history BEFORE inserting today's rows, else the new rows
    // (created now) would feed their own seed. Only look at prior, non-squad plans.
    const { data: hist } = await supabase.from('workout_plans').select('client_id, exercises, created_at')
      .in('client_id', ids).is('squad_session_id', null)
    const histBy = {}
    ;(hist || []).forEach((p) => { (histBy[p.client_id] = histBy[p.client_id] || []).push(p) })

    const toInsert = ids.map((cid) => ({
      client_id: cid,
      title: title.trim() || 'Squad session',
      focus: focus.trim() || 'Squad plan',
      exercises: seedWeights(prescription, latestByName(histBy[cid] || [])),
      assigned_by: coachId,
      squad_session_id: sess.id,
    }))
    const { data: plans, error: pe } = await supabase.from('workout_plans').insert(toInsert).select('id, client_id, exercises')
    if (pe || !plans) { setBusy(false); setError(pe?.message || 'Could not create athlete plans.'); return }

    const nameOf = (cid) => members.find((m) => m.client_id === cid)?.name || 'Athlete'
    const board = plans.map((p) => ({ clientId: p.client_id, name: nameOf(p.client_id), planId: p.id, exs: toPlayer(p.exercises), rpe: '', saved: false }))
    setSessionId(sess.id)
    setAthletes(board)
    setTab(0)
    setStage('board')
    setBusy(false)
  }

  // --- editing helpers (operate per athlete) ---
  const dirty = useRef(new Set())
  const editExs = (clientId, fn) => setAthletes((a) => a.map((x) => (x.clientId !== clientId ? x : { ...x, exs: fn(x.exs), saved: false })))
  const toggleSet = (clientId, ei, si) => { dirty.current.add(clientId); editExs(clientId, (exs) => exs.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== si ? s : { ...s, done: !s.done })) }))) }
  const updateSet = (clientId, ei, si, k, v) => { dirty.current.add(clientId); editExs(clientId, (exs) => exs.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== si ? s : { ...s, [k]: v })) }))) }
  const setRpe = (clientId, v) => setAthletes((a) => a.map((x) => (x.clientId !== clientId ? x : { ...x, rpe: v })))

  // Debounced autosave (~3s) — flush dirty athletes' actuals. The coach has UPDATE
  // on their clients' plans, so a plain update is enough here; the RPC is for finish.
  const [savedAt, setSavedAt] = useState('')
  useEffect(() => {
    if (stage !== 'board') return
    const t = setTimeout(async () => {
      const ids = [...dirty.current]
      if (ids.length === 0) return
      dirty.current.clear()
      for (const cid of ids) {
        const a = athletes.find((x) => x.clientId === cid)
        if (a) await supabase.from('workout_plans').update({ exercises: fromPlayer(a.exs) }).eq('id', a.planId)
      }
      setSavedAt('Autosaved')
      setTimeout(() => setSavedAt(''), 1500)
    }, 3000)
    return () => clearTimeout(t)
  }, [athletes, stage])

  async function finishAll() {
    setBusy(true); setError('')
    const dur = duration === '' ? null : Number(duration)
    const results = []
    for (const a of athletes) {
      const { error: err } = await supabase.rpc('log_squad_athlete', {
        p_plan_id: a.planId,
        p_exercises: fromPlayer(a.exs),
        p_squad_session_id: sessionId,
        p_rpe: a.rpe === '' ? null : Number(a.rpe),
        p_duration_min: dur,
      })
      results.push({ name: a.name, ok: !err, err: err?.message })
    }
    await supabase.from('squad_sessions').update({ finished_at: new Date().toISOString() }).eq('id', sessionId)
    setBusy(false)
    setSummary(results)
    setStage('done')
  }

  // ---------- render ----------
  if (stage === 'setup') {
    return (
      <div className="app">
        <header className="topbar">
          <button className="link-btn" onClick={onExit}>‹ {squad.name}</button>
          <span className="brand-name">Run session</span>
          <span style={{ width: 40 }} />
        </header>
        <main className="screen"><div className="stack">
          <p className="eyebrow accent">Live weight-room</p>
          <h1 className="h1">Run the squad through one session.</h1>

          {templates.length > 0 && (
            <label className="field">Start from a template
              <select value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
                <option value="">Build from scratch…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
          )}
          <label className="field">Session title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pre-season Power" /></label>
          <label className="field">Focus<input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Speed & power" /></label>

          <div className="card">
            <p className="eyebrow">Exercises</p>
            <ExerciseRowsEditor rows={rows} setRows={setRows} />
          </div>

          <div className="card">
            <p className="eyebrow">Who's in today ({[...attend].length}/{members.length})</p>
            {members.map((m) => (
              <label className="sq-attend" key={m.client_id}>
                <input type="checkbox" checked={attend.has(m.client_id)} onChange={() => toggleAttend(m.client_id)} />
                <span>{m.name}</span>
              </label>
            ))}
          </div>

          <div className="card">
            <p className="eyebrow">Board layout</p>
            <div className="seg">
              <button type="button" className={layout === 'byAthlete' ? 'on' : ''} onClick={() => setLayout('byAthlete')}>Athlete by athlete</button>
              <button type="button" className={layout === 'byExercise' ? 'on' : ''} onClick={() => setLayout('byExercise')}>Set by set (station)</button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}
          <button className="btn primary big" disabled={busy} onClick={start}>{busy ? 'Setting up…' : 'Start session'}</button>
        </div></main>
      </div>
    )
  }

  if (stage === 'done') {
    const okCount = (summary || []).filter((r) => r.ok).length
    return (
      <div className="app">
        <header className="topbar"><span style={{ width: 40 }} /><span className="brand-name">{squad.name}</span><span style={{ width: 40 }} /></header>
        <main className="screen"><div className="stack">
          <p className="logged-ok big">Session saved ✓</p>
          <p className="muted-note">{okCount}/{(summary || []).length} athletes logged — actuals are in each athlete's weights-lifted progress, and it counts toward their weekly load.</p>
          {(summary || []).map((r, i) => (
            <div className="logrow" key={i}><span className="logname">{r.name}</span><span className="logmac">{r.ok ? 'Saved ✓' : 'Failed'}</span></div>
          ))}
          {(summary || []).some((r) => !r.ok) && <p className="error">{(summary || []).find((r) => !r.ok)?.err}</p>}
          <button className="btn primary big" onClick={onExit}>Done</button>
        </div></main>
      </div>
    )
  }

  // stage === 'board'
  const exList = athletes[0]?.exs || []
  return (
    <div className="app">
      <header className="topbar">
        <button className="link-btn" onClick={onExit}>‹ Exit</button>
        <span className="brand-name">{title.trim() || 'Squad session'}</span>
        <span className="sq-saved">{savedAt}</span>
      </header>
      <main className="screen"><div className="stack">
        <div className="seg">
          <button type="button" className={layout === 'byAthlete' ? 'on' : ''} onClick={() => setLayout('byAthlete')}>By athlete</button>
          <button type="button" className={layout === 'byExercise' ? 'on' : ''} onClick={() => setLayout('byExercise')}>By station</button>
        </div>

        {layout === 'byAthlete' && (
          <>
            <div className="sq-tabs">
              {athletes.map((a, i) => (
                <button type="button" key={a.clientId} className={'sq-tab' + (i === tab ? ' on' : '')} onClick={() => setTab(i)}>{a.name.split(' ')[0]}</button>
              ))}
            </div>
            {athletes[tab] && (
              <AthleteColumn a={athletes[tab]} onToggle={toggleSet} onUpdate={updateSet} onRpe={setRpe} />
            )}
          </>
        )}

        {layout === 'byExercise' && exList.map((ex, ei) => (
          <div className="card gw-ex" key={ei} style={{ background: 'var(--surface-2)' }}>
            <div className="gw-ex-head"><div className="ex-name">{ex.name}</div>{ex.rpe && <span className="settype-chip rpe">RPE {ex.rpe}</span>}</div>
            {athletes.map((a) => (
              <div className="sq-station-row" key={a.clientId}>
                <span className="sq-station-name">{a.name.split(' ')[0]}</span>
                <div className="sq-station-sets">
                  {(a.exs[ei]?.sets || []).map((s, si) => (
                    <label className={'gw-set' + (s.done ? ' done' : '')} key={si}>
                      <input type="checkbox" checked={s.done} onChange={() => toggleSet(a.clientId, ei, si)} />
                      <input className="gw-in" inputMode="numeric" placeholder="reps" value={s.reps} onChange={(e) => updateSet(a.clientId, ei, si, 'reps', e.target.value)} />
                      <input className="gw-in" inputMode="decimal" placeholder="kg" value={s.weight} onChange={(e) => updateSet(a.clientId, ei, si, 'weight', e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="card">
          <p className="eyebrow">Finish</p>
          <label className="field">Session length (mins) — feeds each athlete's load
            <input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 60" />
          </label>
          <p className="muted-note">Session RPE per athlete (0–10, optional):</p>
          {athletes.map((a) => (
            <div className="sq-rpe-row" key={a.clientId}>
              <span>{a.name}</span>
              <input className="gw-in" inputMode="numeric" value={a.rpe} onChange={(e) => setRpe(a.clientId, e.target.value)} placeholder="RPE" />
            </div>
          ))}
          {error && <p className="error">{error}</p>}
          <button className="btn primary big" disabled={busy} onClick={finishAll}>{busy ? 'Saving…' : 'End & save session'}</button>
        </div>
      </div></main>
    </div>
  )
}

function AthleteColumn({ a, onToggle, onUpdate, onRpe }) {
  const totalSets = a.exs.reduce((n, ex) => n + ex.sets.length, 0)
  const doneSets = a.exs.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0)
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0
  return (
    <div className="stack gw">
      <div className="gw-progress"><div className="gw-bar" style={{ width: pct + '%' }} /></div>
      <p className="muted-note">{doneSets}/{totalSets} sets done</p>
      {a.exs.map((ex, ei) => (
        <div className="card gw-ex" key={ei} style={{ background: 'var(--surface-2)' }}>
          <div className="gw-ex-head"><div className="ex-name">{ex.name}</div>{ex.rpe && <span className="settype-chip rpe">RPE {ex.rpe}</span>}</div>
          <div className="gw-sets">
            {ex.sets.map((s, si) => (
              <label className={'gw-set' + (s.done ? ' done' : '')} key={si}>
                <input type="checkbox" checked={s.done} onChange={() => onToggle(a.clientId, ei, si)} />
                <span className="gw-set-n">Set {si + 1}</span>
                <input className="gw-in" inputMode="numeric" placeholder="reps" value={s.reps} onChange={(e) => onUpdate(a.clientId, ei, si, 'reps', e.target.value)} />
                <input className="gw-in" inputMode="decimal" placeholder="kg" value={s.weight} onChange={(e) => onUpdate(a.clientId, ei, si, 'weight', e.target.value)} />
              </label>
            ))}
          </div>
          {ex.cue && <p className="ex-cue">{ex.cue}</p>}
        </div>
      ))}
    </div>
  )
}
