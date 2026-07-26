import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'
import { startOfTodayISO, startOfWeekISO, sumMacros, analyze, setPersona } from './lib.js'
import { TrendChart, ExSets } from './ui.jsx'
import { ExerciseRowsEditor, newExerciseRow, rowsToExercises } from './WorkoutRows.jsx'
import { LEVELS } from './accountability.js'
import { PERF_TESTS, TEST_BY_KEY, TEST_GROUPS, bestValue } from './perfTests.js'
import { readinessScore, readinessLight, loadMetrics, acwrFlag } from './monitoring.js'
import { ageYears, maturityOffset, maturityPhase, growthVelocity, growthGuidance } from './growth.js'
import { MessageThread } from './MessageThread.jsx'
import { CommunityFeed } from './CommunityFeed.jsx'
import { LiftProgress } from './LiftProgress.jsx'
import { ProgressPhotos } from './ProgressPhotos.jsx'
import { PROGRAM_DIMS, programTagLabel } from './programMeta.js'
import { CashflowDashboard } from './CashflowDashboard.jsx'
import { WEEKDAYS, WEEKDAYS_FULL, upcomingSessions, bookingKey, dayLabel, fmtTime, ymd } from './booking.js'
import { SEGMENTS, loadMemberActivity, segmentCounts, lastSeenLabel } from './crm.js'

export default function TrainerApp({ profile, onSignOut }) {
  const [clients, setClients] = useState([])
  const [squads, setSquads] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedSquad, setSelectedSquad] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  async function loadClients() {
    const { data } = await supabase
      .from('profiles').select('id, full_name, created_at, membership_tier, goal, step_target')
      .eq('trainer_id', profile.id).order('created_at', { ascending: true })
    setClients(data || [])
    setLoading(false)
  }
  async function loadSquads() {
    const { data } = await supabase.from('squads').select('*').eq('coach_id', profile.id).order('created_at', { ascending: true })
    setSquads(data || [])
  }
  useEffect(() => { loadClients(); if (THEME.features?.squads) loadSquads() }, [])

  function copyCode() {
    navigator.clipboard?.writeText(profile.trainer_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (selected) {
    return <ClientDetail client={selected} trainerId={profile.id} onBack={() => setSelected(null)} />
  }
  if (selectedSquad) {
    return <SquadDetail squad={selectedSquad} clients={clients} onBack={() => setSelectedSquad(null)} />
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {THEME.logo ? <img className="mark-img" src={THEME.logo} alt="" /> : <span className="mark-badge">{THEME.mark}</span>}
          <span className="brand-name">{THEME.name}</span>
        </div>
        <button className="link-btn" onClick={onSignOut}>Sign out</button>
      </header>

      <main className="screen">
        <p className="eyebrow">Coach dashboard</p>
        <h1 className="h1">Hi {profile.full_name?.split(' ')[0] || 'Coach'}.</h1>

        <div className="card code-card">
          <div>
            <p className="eyebrow">Your client code</p>
            <p className="code-big">{profile.trainer_code}</p>
            <p className="muted-note">Share this with clients — they enter it when they create their account to link to you.</p>
          </div>
          <button className="btn ghost" onClick={copyCode}>{copied ? 'Copied ✓' : 'Copy'}</button>
        </div>

        {THEME.features?.cashflow && <CashflowDashboard />}

        {THEME.features?.briefing && <CoachBriefing profile={profile} clients={clients} />}

        {THEME.features?.booking && <CoachTimetable profile={profile} clients={clients} />}

        <HeroImageSetting profile={profile} />

        {THEME.features?.crm ? (
          <CoachMembers clients={clients} loading={loading} onOpen={setSelected} />
        ) : (
          <>
            <p className="eyebrow" style={{ marginTop: 8 }}>Your clients ({clients.length})</p>
            {loading && <p className="muted-note">Loading…</p>}
            {!loading && clients.length === 0 && <p className="muted-note">No clients yet. Share your code above to get them started.</p>}
            <div className="stack">
              {clients.map((c) => (
                <button className="tile" key={c.id} onClick={() => setSelected(c)}>
                  <span className="avatar">{(c.full_name || '?').charAt(0).toUpperCase()}</span>
                  <div><b>{c.full_name || 'Client'}</b><span>View progress & set targets</span></div>
                  {c.membership_tier === 'inner_circle' && (
                    <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--accent-hi)', border: '1px solid var(--accent)', borderRadius: 999, padding: '3px 9px' }}>Inner Circle</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {THEME.features?.squads && (
          <SquadList squads={squads} coachId={profile.id} onOpen={setSelectedSquad} onCreated={(s) => setSquads((xs) => [...xs, s])} />
        )}

        {THEME.features?.templates && <CoachTemplates coachId={profile.id} />}
        {THEME.features?.programs && <CoachPrograms coachId={profile.id} />}
        {THEME.features?.recipes && <CoachRecipes coachId={profile.id} />}
        {THEME.features?.videos && <CoachVideos coachId={profile.id} />}
        {(THEME.features?.supplements || THEME.features?.shop || THEME.features?.podcasts) && <CoachLinks coachId={profile.id} />}

        <CoachVoice coachId={profile.id} coachName={profile.full_name} />
        <KimBrain coachId={profile.id} coachName={profile.full_name} />
        <FeaturedContent coachId={profile.id} coachName={profile.full_name} />

        <div className="stack">
          <p className="eyebrow" style={{ marginTop: 4 }}>Community</p>
          <p className="muted-note" style={{ margin: '0 0 4px' }}>Post announcements and cheer your members’ wins — everyone linked to you sees this.</p>
          <CommunityFeed communityCoachId={profile.id} me={profile.id} myName={profile.full_name} isCoach={true} />
        </div>
      </main>
    </div>
  )
}

function ClientDetail({ client, trainerId, onBack }) {
  const [targets, setTargets] = useState(null)
  const [today, setToday] = useState({ protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 })
  const [logs, setLogs] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [tier, setTier] = useState(client.membership_tier || 'standard')
  const [tierBusy, setTierBusy] = useState(false)
  const [stepTarget, setStepTarget] = useState(client.step_target != null ? String(client.step_target) : '')
  const [stepSaved, setStepSaved] = useState(false)

  async function changeTier(t) {
    if (t === tier) return
    setTierBusy(true)
    const { error } = await supabase.rpc('set_member_tier', { p_client: client.id, p_tier: t })
    if (!error) setTier(t)
    setTierBusy(false)
  }

  async function saveStepTarget() {
    const n = Math.max(0, parseInt(stepTarget, 10) || 0)
    const { error } = await supabase.rpc('set_step_target', { p_client: client.id, p_steps: n })
    if (!error) { setStepTarget(String(n)); setStepSaved(true); setTimeout(() => setStepSaved(false), 1500) }
  }

  async function load() {
    const [t, dayLogs, recent, meas, pl] = await Promise.all([
      supabase.from('macro_targets').select('*').eq('client_id', client.id).maybeSingle(),
      supabase.from('nutrition_logs').select('*').eq('client_id', client.id).gte('logged_at', startOfTodayISO()),
      supabase.from('nutrition_logs').select('*').eq('client_id', client.id).order('logged_at', { ascending: false }).limit(8),
      supabase.from('body_measurements').select('*').eq('client_id', client.id).order('measured_at', { ascending: true }),
      supabase.from('workout_plans').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(20),
    ])
    setTargets(t.data || { protein_g: 150, carbs_g: 200, fat_g: 65, calories: 2200 })
    setToday(sumMacros(dayLogs.data))
    setLogs(recent.data || [])
    setMeasurements(meas.data || [])
    setPlans(pl.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveTargets() {
    await supabase.from('macro_targets').upsert({ client_id: client.id, ...targets, updated_at: new Date().toISOString() })
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }
  const set = (k) => (e) => setTargets((s) => ({ ...s, [k]: Number(e.target.value) || 0 }))
  const latest = measurements[measurements.length - 1]
  const first = measurements[0]

  return (
    <div className="app">
      <header className="topbar">
        <button className="link-btn" onClick={onBack}>‹ Clients</button>
        <span className="brand-name">{client.full_name}</span>
        <span style={{ width: 40 }} />
      </header>
      <main className="screen">
        {loading ? <p className="muted-note">Loading…</p> : (
          <div className="stack">
            <div className="card">
              <p className="eyebrow">Membership</p>
              <div className="seg small" style={{ marginTop: 8 }}>
                <button type="button" className={tier === 'standard' ? 'on' : ''} disabled={tierBusy} onClick={() => changeTier('standard')}>Standard</button>
                <button type="button" className={tier === 'inner_circle' ? 'on' : ''} disabled={tierBusy} onClick={() => changeTier('inner_circle')}>Inner Circle</button>
              </div>
              <p className="muted-note" style={{ marginTop: 8 }}>
                {tier === 'inner_circle'
                  ? 'Coached tier — assigned workouts, form reviews and direct coaching.'
                  : 'Self-serve tier — calculator, programs and tracking.'}
              </p>
            </div>

            {THEME.features?.tags && <ClientTags clientId={client.id} coachId={trainerId} />}

            {THEME.features?.agenda && (
              <div className="card">
                <p className="eyebrow">Daily step target</p>
                <p className="muted-note" style={{ marginBottom: 8 }}>Shows on {(client.full_name || 'your client').split(' ')[0]}’s daily plan. Leave blank for the default 10,000.</p>
                <div className="grid-2">
                  <label className="field">Steps / day<input type="number" inputMode="numeric" value={stepTarget} onChange={(e) => setStepTarget(e.target.value)} placeholder="10000" /></label>
                </div>
                <button className="btn primary" onClick={saveStepTarget}>{stepSaved ? 'Saved ✓' : 'Save step target'}</button>
              </div>
            )}

            <div className="card">
              <p className="eyebrow accent">Today’s intake</p>
              <MacroRowSmall m={today} target={targets} />
            </div>

            <div className="card">
              <p className="eyebrow">Set macro targets</p>
              <div className="grid-2">
                <label className="field">Calories<input type="number" value={targets.calories} onChange={set('calories')} /></label>
                <label className="field">Protein (g)<input type="number" value={targets.protein_g} onChange={set('protein_g')} /></label>
                <label className="field">Carbs (g)<input type="number" value={targets.carbs_g} onChange={set('carbs_g')} /></label>
                <label className="field">Fat (g)<input type="number" value={targets.fat_g} onChange={set('fat_g')} /></label>
              </div>
              <button className="btn primary" onClick={saveTargets}>{saved ? 'Saved ✓' : 'Save targets'}</button>
            </div>

            <AssignWorkout clientId={client.id} trainerId={trainerId} onAssigned={(p) => setPlans((pl) => [p, ...pl])} />

            <div className="card">
              <p className="eyebrow">Messages</p>
              <MessageThread clientId={client.id} me="coach" placeholder={`Reply to ${(client.full_name || 'your client').split(' ')[0]}…`} />
            </div>

            {THEME.features?.monitoring && <CoachMonitoring clientId={client.id} />}

            {THEME.features?.growth && <CoachGrowth clientId={client.id} />}

            {THEME.features?.testing && <CoachPerformanceTests clientId={client.id} />}

            <CoachCheckins clientId={client.id} />

            <CoachAccountability clientId={client.id} clientName={client.full_name} />

            <FormChecksReview clientId={client.id} />

            <ClientBodyScans clientId={client.id} />

            {THEME.features?.progressHub && (
              <div className="card">
                <p className="eyebrow">Progress photos</p>
                <p className="muted-note" style={{ marginBottom: 8 }}>Tap two to compare {(client.full_name || 'your client').split(' ')[0]}’s photos side by side.</p>
                <ProgressPhotos clientId={client.id} />
              </div>
            )}

            {latest && (
              <div className="card">
                <p className="eyebrow">Body progress</p>
                <div className="metrics-2">
                  {latest.weight_kg != null && <Metric k="Weight" v={`${latest.weight_kg}kg`} d={first?.weight_kg != null ? `${(latest.weight_kg - first.weight_kg).toFixed(1)}kg` : ''} />}
                  {latest.body_fat != null && <Metric k="Body fat" v={`${latest.body_fat}%`} d={first?.body_fat != null ? `${(latest.body_fat - first.body_fat).toFixed(1)}%` : ''} />}
                </div>
                <TrendChart data={measurements.filter((m) => m.weight_kg != null)} field="weight_kg" />
              </div>
            )}

            <div className="card">
              <p className="eyebrow">Recent food log</p>
              {logs.length === 0 && <p className="muted-note">Nothing logged yet.</p>}
              {logs.map((l) => (
                <div className="logrow" key={l.id}>
                  <span className="logname">{l.name || l.source}</span>
                  <span className="logmac">{l.calories} kcal · {l.protein_g}p</span>
                </div>
              ))}
            </div>

            <LiftProgress plans={plans} title="Weights lifted" />

            <div className="card">
              <p className="eyebrow">Their sessions</p>
              <p className="muted-note">Tap a session to see the exercises, sets, reps and weights they’ve logged.</p>
              {plans.length === 0 && <p className="muted-note">No sessions yet.</p>}
              {plans.map((p) => <CoachSessionCard key={p.id} plan={p} trainerId={trainerId} />)}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// The coach's AI voice — name, audience, philosophy, tone — shaping every AI reply.
// Loads on mount and sets the active persona (so Kim Brain parsing uses it too).
function CoachVoice({ coachId, coachName }) {
  const [p, setP] = useState(null)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    supabase.from('coach_personas').select('*').eq('coach_id', coachId).maybeSingle().then(({ data }) => {
      const persona = data || { display_name: (coachName || '').split(' ')[0] || 'Coach', audience: '', philosophy: '', tone: '' }
      setP(persona)
      setPersona({ name: persona.display_name, audience: persona.audience, philosophy: persona.philosophy, tone: persona.tone })
    })
  }, [])
  async function save() {
    await supabase.from('coach_personas').upsert({ coach_id: coachId, display_name: p.display_name, audience: p.audience, philosophy: p.philosophy, tone: p.tone, updated_at: new Date().toISOString() })
    setPersona({ name: p.display_name, audience: p.audience, philosophy: p.philosophy, tone: p.tone })
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }
  if (!p) return null
  const set = (k) => (e) => setP((s) => ({ ...s, [k]: e.target.value }))
  return (
    <div className="card">
      <p className="eyebrow">Your AI voice</p>
      <p className="muted-note">How the AI sounds to your clients — your name, who you coach, your philosophy and tone. This shapes every AI reply, meal idea, workout and form check.</p>
      {!open && (
        <div className="stack">
          <p className="muted-note">Currently: <b>{p.display_name || 'Coach'}</b>{p.tone ? ` — ${p.tone}` : ''}</p>
          <button className="btn ghost" onClick={() => setOpen(true)}>Edit AI voice</button>
        </div>
      )}
      {open && (
        <div className="stack">
          <label className="field">Name clients see<input value={p.display_name || ''} onChange={set('display_name')} placeholder="e.g. Paul" /></label>
          <label className="field">Who you coach<input value={p.audience || ''} onChange={set('audience')} placeholder="e.g. everyday people chasing real results" /></label>
          <label className="field">Your philosophy<textarea value={p.philosophy || ''} onChange={set('philosophy')} placeholder="e.g. no-nonsense, honest coaching over gimmicks or quick fixes" /></label>
          <label className="field">Your tone<textarea value={p.tone || ''} onChange={set('tone')} placeholder="e.g. direct, motivating, straight-talking with a bit of tough love" /></label>
          <button className="btn primary" onClick={save}>{saved ? 'Saved ✓' : 'Save AI voice'}</button>
        </div>
      )}
    </div>
  )
}

// Kim sets how hard the accountability bot pushes this client.
function CoachAccountability({ clientId, clientName }) {
  const [settings, setSettings] = useState(null)
  const [saved, setSaved] = useState(false)
  const first = (clientName || 'your client').split(' ')[0]
  useEffect(() => {
    supabase.from('accountability_settings').select('*').eq('client_id', clientId).maybeSingle()
      .then(({ data }) => setSettings(data || { level: 2, food_nudges: true, workout_nudges: true }))
  }, [])
  async function setLevel(n) {
    const next = { ...settings, level: n }
    setSettings(next)
    await supabase.from('accountability_settings').upsert({ client_id: clientId, level: n, food_nudges: next.food_nudges ?? true, workout_nudges: next.workout_nudges ?? true, updated_at: new Date().toISOString() })
    setSaved(true); setTimeout(() => setSaved(false), 1200)
  }
  if (!settings) return null
  const level = settings.level || 2
  return (
    <div className="card">
      <p className="eyebrow">Accountability level</p>
      <p className="muted-note">How firmly the reminders push {first}. They can set this themselves — you can override it.</p>
      <div className="level-row">
        {LEVELS.map((l) => (
          <button key={l.n} type="button" className={'level-chip' + (level === l.n ? ' on' : '')} onClick={() => setLevel(l.n)} title={l.blurb}>{l.n}</button>
        ))}
      </div>
      <p className="muted-note">Level {level} — {LEVELS.find((l) => l.n === level)?.label}. {saved && <span className="delta good">Saved</span>}</p>
    </div>
  )
}

/* ---------- Squads / teams ---------- */
function SquadList({ squads, coachId, onOpen, onCreated }) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  async function create() {
    if (!name.trim()) return
    setSaving(true)
    const { data } = await supabase.from('squads').insert({ coach_id: coachId, name: name.trim(), sport: sport.trim() || null }).select().single()
    setSaving(false)
    if (data) { onCreated(data); setName(''); setSport(''); setOpen(false) }
  }
  return (
    <div className="card">
      <p className="eyebrow">Squads</p>
      <p className="muted-note">Group athletes into teams — assign a session to a whole squad and rank them on a leaderboard.</p>
      {squads.length === 0 && <p className="muted-note">No squads yet.</p>}
      <div className="stack">
        {squads.map((s) => (
          <button className="tile" key={s.id} onClick={() => onOpen(s)}>
            <span className="avatar">{(s.name || '?').charAt(0).toUpperCase()}</span>
            <div><b>{s.name}</b><span>{s.sport || 'Squad'}</span></div>
          </button>
        ))}
      </div>
      {!open && <button className="btn ghost" onClick={() => setOpen(true)}>New squad</button>}
      {open && (
        <div className="stack">
          <label className="field">Squad name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dorset Cricket U18" /></label>
          <label className="field">Sport (optional)<input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="e.g. Cricket" /></label>
          <button className="btn primary" disabled={saving} onClick={create}>{saving ? 'Creating…' : 'Create squad'}</button>
        </div>
      )}
    </div>
  )
}

function SquadDetail({ squad, clients, onBack }) {
  const [members, setMembers] = useState([])
  const [testKey, setTestKey] = useState(PERF_TESTS[0].key)
  const [board, setBoard] = useState([])
  const [activity, setActivity] = useState({})
  const [addId, setAddId] = useState('')
  const [busy, setBusy] = useState(false)

  const nameOf = (cid) => (clients.find((c) => c.id === cid)?.full_name) || 'Athlete'
  const memberIds = members.map((m) => m.client_id)

  async function loadMembers() {
    const { data } = await supabase.from('squad_members').select('*').eq('squad_id', squad.id)
    setMembers(data || [])
  }
  useEffect(() => { loadMembers() }, [])

  useEffect(() => {
    if (memberIds.length === 0) { setBoard([]); return }
    let cancelled = false
    ;(async () => {
      const t = TEST_BY_KEY[testKey]
      const { data } = await supabase.from('performance_tests').select('client_id, value').eq('test_key', testKey).in('client_id', memberIds)
      const byClient = {}
      ;(data || []).forEach((r) => { (byClient[r.client_id] = byClient[r.client_id] || []).push(Number(r.value)) })
      const rows = memberIds.map((cid) => {
        const vals = byClient[cid]
        const best = vals && vals.length ? (t.lowerBetter ? Math.min(...vals) : Math.max(...vals)) : null
        return { client_id: cid, name: nameOf(cid), best }
      })
      rows.sort((a, b) => (a.best == null ? 1 : b.best == null ? -1 : (t.lowerBetter ? a.best - b.best : b.best - a.best)))
      if (!cancelled) setBoard(rows)
    })()
    return () => { cancelled = true }
  }, [testKey, members.length])

  useEffect(() => {
    if (memberIds.length === 0) { setActivity({}); return }
    ;(async () => {
      const { data } = await supabase.from('workout_completions').select('client_id').gte('completed_on', startOfWeekISO()).in('client_id', memberIds)
      const counts = {}
      ;(data || []).forEach((r) => { counts[r.client_id] = (counts[r.client_id] || 0) + 1 })
      setActivity(counts)
    })()
  }, [members.length])

  const [readiness, setReadiness] = useState({})
  useEffect(() => {
    if (memberIds.length === 0 || !THEME.features?.monitoring) { setReadiness({}); return }
    ;(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('readiness_checkins').select('*').eq('checked_on', today).in('client_id', memberIds)
      const map = {}
      ;(data || []).forEach((c) => { map[c.client_id] = readinessLight(readinessScore(c)).color })
      setReadiness(map)
    })()
  }, [members.length])

  async function addMember() {
    if (!addId) return
    setBusy(true)
    const { data } = await supabase.from('squad_members').insert({ squad_id: squad.id, client_id: addId }).select().single()
    setBusy(false)
    if (data) { setMembers((m) => [...m, data]); setAddId('') }
  }
  async function removeMember(id) {
    await supabase.from('squad_members').delete().eq('id', id)
    setMembers((m) => m.filter((x) => x.id !== id))
  }

  const available = clients.filter((c) => !memberIds.includes(c.id))
  const t = TEST_BY_KEY[testKey]

  return (
    <div className="app">
      <header className="topbar">
        <button className="link-btn" onClick={onBack}>‹ Squads</button>
        <span className="brand-name">{squad.name}</span>
        <span style={{ width: 40 }} />
      </header>
      <main className="screen">
        <div className="stack">
          {squad.sport && <p className="eyebrow accent">{squad.sport}</p>}

          <div className="card">
            <p className="eyebrow">Roster ({members.length})</p>
            {members.length === 0 && <p className="muted-note">No athletes yet — add them below.</p>}
            {members.map((m) => (
              <div className="logrow" key={m.id}>
                <span className="logname">{THEME.features?.monitoring && <span className={'rd-light ' + (readiness[m.client_id] || 'grey')} />} {nameOf(m.client_id)}</span>
                <span className="logmac">{activity[m.client_id] || 0} sessions this wk <button className="thumb-del" onClick={() => removeMember(m.id)}>×</button></span>
              </div>
            ))}
            {available.length > 0 && (
              <div className="add-row">
                <select value={addId} onChange={(e) => setAddId(e.target.value)}>
                  <option value="">Add an athlete…</option>
                  {available.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
                <button className="btn primary sm" disabled={busy || !addId} onClick={addMember}>Add</button>
              </div>
            )}
          </div>

          <div className="card">
            <p className="eyebrow">Leaderboard</p>
            <label className="field">Test
              <select value={testKey} onChange={(e) => setTestKey(e.target.value)}>
                {Object.entries(TEST_GROUPS).map(([g, tests]) => (
                  <optgroup key={g} label={g}>{tests.map((x) => <option key={x.key} value={x.key}>{x.name} ({x.unit})</option>)}</optgroup>
                ))}
              </select>
            </label>
            {board.length === 0 && <p className="muted-note">Add athletes to see the leaderboard.</p>}
            {board.map((row, i) => (
              <div className="lb-row" key={row.client_id}>
                <span className="lb-rank">{row.best == null ? '–' : i + 1}</span>
                <span className="lb-name">{row.name}</span>
                <span className="lb-val">{row.best == null ? '—' : `${row.best}${t.unit}`}</span>
              </div>
            ))}
          </div>

          <SquadAssign squad={squad} memberIds={memberIds} count={members.length} />
        </div>
      </main>
    </div>
  )
}

function SquadAssign({ squad, memberIds, count }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [focus, setFocus] = useState('')
  const [rows, setRows] = useState([newExerciseRow()])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState('')
  async function assign() {
    const exercises = rowsToExercises(rows, 'Squad plan')
    if (exercises.length === 0) { setError('Add at least one exercise with a set.'); return }
    if (memberIds.length === 0) { setError('No athletes in this squad yet.'); return }
    setBusy(true); setError('')
    const toInsert = memberIds.map((cid) => ({ client_id: cid, title: title.trim() || 'Squad session', focus: focus.trim() || 'Squad plan', exercises, finisher: null, assigned_by: squad.coach_id }))
    const { data, error: err } = await supabase.from('workout_plans').insert(toInsert).select('id')
    setBusy(false)
    if (err) { setError(err.message); return }
    setDone((data || []).length); setTitle(''); setFocus(''); setRows([newExerciseRow()])
    setTimeout(() => { setDone(0); setOpen(false) }, 2500)
  }
  return (
    <div className="card">
      <p className="eyebrow">Assign to whole squad</p>
      <p className="muted-note">Build one session and send it to all {count} athlete{count === 1 ? '' : 's'} at once.</p>
      {!open && <button className="btn ghost" onClick={() => setOpen(true)}>Assign a session</button>}
      {open && (
        <div className="stack">
          <label className="field">Session title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pre-season Power" /></label>
          <label className="field">Focus<input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Speed & power" /></label>
          <ExerciseRowsEditor rows={rows} setRows={setRows} />
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy} onClick={assign}>{busy ? 'Assigning…' : `Assign to ${count} athlete${count === 1 ? '' : 's'}`}</button>
          {done > 0 && <p className="logged-ok">Assigned to {done} athlete{done === 1 ? '' : 's'} ✓</p>}
        </div>
      )}
    </div>
  )
}

// Coach's growth & maturation assessment for a youth athlete.
function CoachGrowth({ clientId }) {
  const [profile, setProfile] = useState(null)
  const [meas, setMeas] = useState([])
  const [dob, setDob] = useState('')
  const [sex, setSex] = useState('M')
  const [savingP, setSavingP] = useState(false)
  const [h, setH] = useState(''); const [sh, setSh] = useState(''); const [wt, setWt] = useState(''); const [mdate, setMdate] = useState('')
  const [savingM, setSavingM] = useState(false)

  async function load() {
    const [{ data: yp }, { data: gm }] = await Promise.all([
      supabase.from('youth_profiles').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('growth_measurements').select('*').eq('client_id', clientId).order('measured_on', { ascending: true }),
    ])
    setProfile(yp || null)
    if (yp) { setDob(yp.dob || ''); setSex(yp.sex || 'M') }
    setMeas(gm || [])
  }
  useEffect(() => { load() }, [])

  async function saveProfile() {
    if (!dob) return
    setSavingP(true)
    const { data } = await supabase.from('youth_profiles').upsert({ client_id: clientId, dob, sex, updated_at: new Date().toISOString() }).select().single()
    setSavingP(false)
    if (data) setProfile(data)
  }
  async function saveMeasurement() {
    if (!h) return
    setSavingM(true)
    const { data } = await supabase.from('growth_measurements').insert({ client_id: clientId, height_cm: Number(h) || null, sitting_height_cm: Number(sh) || null, weight_kg: Number(wt) || null, measured_on: mdate || undefined }).select().single()
    setSavingM(false)
    if (data) { setMeas((m) => [...m, data].sort((a, b) => (a.measured_on || '').localeCompare(b.measured_on || ''))); setH(''); setSh(''); setWt('') }
  }

  const latest = meas[meas.length - 1]
  const age = profile?.dob && latest ? ageYears(profile.dob, latest.measured_on) : null
  const offset = (profile?.dob && latest) ? maturityOffset({ sex: profile.sex, age, height: latest.height_cm, sittingHeight: latest.sitting_height_cm, weight: latest.weight_kg }) : null
  const phase = maturityPhase(offset)
  const aphv = (age != null && offset != null) ? age - offset : null
  const velocity = growthVelocity(meas)

  return (
    <div className="card">
      <p className="eyebrow">Growth &amp; maturation</p>
      {!profile?.dob && (
        <div className="stack">
          <p className="muted-note">Set date of birth and sex to estimate maturation.</p>
          <div className="grid-2">
            <label className="field">Date of birth<input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></label>
            <label className="field">Sex<select value={sex} onChange={(e) => setSex(e.target.value)}><option value="M">Male</option><option value="F">Female</option></select></label>
          </div>
          <button className="btn primary sm" disabled={savingP} onClick={saveProfile}>Save profile</button>
        </div>
      )}
      {profile?.dob && (
        <>
          <p className="muted-note">DOB {profile.dob} · {profile.sex === 'F' ? 'Female' : 'Male'}{age != null ? ` · ${age.toFixed(1)} yrs at last measure` : ''}</p>
          {offset != null ? (
            <>
              <div className="rd-status">
                <span className={'rd-light ' + phase.color} />
                <div><b>{phase.label}</b><span className="muted-note"> · {offset > 0 ? '+' : ''}{offset.toFixed(1)} yrs from PHV</span></div>
              </div>
              <p className="muted-note">Estimated age at PHV: {aphv != null ? aphv.toFixed(1) : '—'} yrs{velocity != null ? ` · growth ${velocity.toFixed(1)} cm/yr` : ''}{velocity != null && velocity > 7 ? ' — rapid growth, monitor load & impact' : ''}</p>
              <TrendChart data={meas.filter((m) => m.height_cm > 0)} field="height_cm" />
              <p className="checkin-line">{growthGuidance(phase.key)}</p>
              <p className="muted-note">Estimate via Mirwald et al. 2002 (maturity offset). A guide, not a diagnosis — use alongside qualified assessment.</p>
            </>
          ) : <p className="muted-note">Add a measurement with height, sitting height and weight to estimate maturation.</p>}
        </>
      )}
      <div className="grid-2" style={{ marginTop: 8 }}>
        <label className="field">Height (cm)<input type="number" step="0.1" value={h} onChange={(e) => setH(e.target.value)} /></label>
        <label className="field">Sitting height (cm)<input type="number" step="0.1" value={sh} onChange={(e) => setSh(e.target.value)} /></label>
        <label className="field">Weight (kg)<input type="number" step="0.1" value={wt} onChange={(e) => setWt(e.target.value)} /></label>
        <label className="field">Date<input type="date" value={mdate} onChange={(e) => setMdate(e.target.value)} /></label>
      </div>
      <button className="btn primary sm" disabled={savingM} onClick={saveMeasurement}>{savingM ? 'Saving…' : 'Log measurement'}</button>
    </div>
  )
}

// Coach's readiness + training-load snapshot for one athlete.
function CoachMonitoring({ clientId }) {
  const [checkins, setCheckins] = useState([])
  const [loads, setLoads] = useState([])
  useEffect(() => {
    supabase.from('readiness_checkins').select('*').eq('client_id', clientId).order('checked_on', { ascending: true }).limit(60).then(({ data }) => setCheckins(data || []))
    supabase.from('session_loads').select('*').eq('client_id', clientId).order('session_on', { ascending: true }).limit(120).then(({ data }) => setLoads(data || []))
  }, [])
  if (checkins.length === 0 && loads.length === 0) return null
  const latest = checkins[checkins.length - 1]
  const score = readinessScore(latest)
  const light = readinessLight(score)
  const metrics = loadMetrics(loads)
  const flag = acwrFlag(metrics.acwr)
  const trend = checkins.map((c) => ({ score: readinessScore(c) })).filter((x) => x.score != null)
  return (
    <div className="card">
      <p className="eyebrow">Readiness &amp; load</p>
      <div className="rd-status">
        <span className={'rd-light ' + light.color} />
        <div><b>{light.label}</b>{score != null && <span className="muted-note"> · {score.toFixed(1)}/5 {latest ? `(${latest.checked_on})` : ''}</span>}</div>
      </div>
      <div className="metrics-2">
        <Metric k="This week (AU)" v={metrics.acute} d="" />
        <Metric k="ACWR" v={metrics.acwr != null ? metrics.acwr.toFixed(2) : '—'} d="" />
      </div>
      <p className="rd-flag"><span className={'rd-light ' + flag.color} /> {flag.label}</p>
      {trend.length >= 2 && <TrendChart data={trend} field="score" />}
    </div>
  )
}

// Coach logs & reviews an athlete's performance test results.
function CoachPerformanceTests({ clientId }) {
  const [rows, setRows] = useState([])
  const [testKey, setTestKey] = useState(PERF_TESTS[0].key)
  const [value, setValue] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('performance_tests').select('*').eq('client_id', clientId).order('tested_on', { ascending: true })
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    const v = Number(value)
    if (!v) return
    setSaving(true)
    const { data } = await supabase.from('performance_tests').insert({ client_id: clientId, test_key: testKey, value: v, tested_on: date || undefined }).select().single()
    setSaving(false)
    if (data) { setRows((r) => [...r, data].sort((a, b) => (a.tested_on || '').localeCompare(b.tested_on || ''))); setValue('') }
  }

  const byTest = {}
  rows.forEach((r) => { (byTest[r.test_key] = byTest[r.test_key] || []).push(r) })

  return (
    <div className="card">
      <p className="eyebrow">Performance tests</p>
      <p className="muted-note">Log results from your testing sessions — the athlete sees their PBs and trends.</p>
      <label className="field">Test
        <select value={testKey} onChange={(e) => setTestKey(e.target.value)}>
          {Object.entries(TEST_GROUPS).map(([g, tests]) => (
            <optgroup key={g} label={g}>
              {tests.map((t) => <option key={t.key} value={t.key}>{t.name} ({t.unit})</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="grid-2">
        <label className="field">Result ({TEST_BY_KEY[testKey].unit})<input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></label>
        <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <button className="btn primary sm" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Log result'}</button>
      {Object.keys(byTest).map((k) => {
        const t = TEST_BY_KEY[k]; if (!t) return null
        const sorted = byTest[k]
        const latest = sorted[sorted.length - 1]
        const best = bestValue(sorted, t.lowerBetter)
        return (
          <div className="fc-block" key={k}>
            <b>{t.name}</b>
            <p className="checkin-line">Latest {Number(latest.value)}{t.unit} · Best {best}{t.unit} · {sorted.length} result{sorted.length === 1 ? '' : 's'}</p>
            <TrendChart data={sorted} field="value" />
          </div>
        )
      })}
    </div>
  )
}

// Kim reads each weekly check-in and replies.
function CoachCheckins({ clientId }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    supabase.from('weekly_checkins').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => setItems(data || []))
  }, [])
  if (items.length === 0) return null
  return (
    <div className="card">
      <p className="eyebrow">Weekly check-ins</p>
      {items.map((c) => <CoachCheckinRow key={c.id} c={c} onReplied={(reply) => setItems((xs) => xs.map((x) => x.id === c.id ? { ...x, coach_reply: reply } : x))} />)}
    </div>
  )
}

function CoachCheckinRow({ c, onReplied }) {
  const [reply, setReply] = useState(c.coach_reply || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  async function send() {
    if (!reply.trim()) return
    setSaving(true)
    const { error } = await supabase.from('weekly_checkins').update({ coach_reply: reply.trim() }).eq('id', c.id)
    setSaving(false)
    if (!error) { setDone(true); onReplied(reply.trim()); setTimeout(() => setDone(false), 1200) }
  }
  return (
    <div className="fc-block">
      <b>Check-in · {(c.created_at || '').slice(0, 10)}</b>
      <div className="checkin-scores">
        <span>Energy {c.energy}</span><span>Sleep {c.sleep}</span><span>Nutrition {c.nutrition}</span><span>Training {c.training}</span>
        {c.weight_kg != null && <span>{c.weight_kg}kg</span>}
      </div>
      {c.wins && <p className="checkin-line"><b>Wins:</b> {c.wins}</p>}
      {c.struggles && <p className="checkin-line"><b>Struggles:</b> {c.struggles}</p>}
      {c.question && <p className="checkin-line"><b>Asked:</b> {c.question}</p>}
      <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to this check-in…" />
      <button className="btn primary sm" disabled={saving} onClick={send}>{done ? 'Sent ✓' : saving ? 'Sending…' : 'Send reply'}</button>
    </div>
  )
}

// Kim's view of a client's AI progress scans (photo + change summary).
function ClientBodyScans({ clientId }) {
  const [scans, setScans] = useState([])
  useEffect(() => {
    supabase.from('body_scans').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setScans(data || []))
  }, [])
  if (scans.length === 0) return null
  return (
    <div className="card">
      <p className="eyebrow">Progress scans</p>
      {scans.map((sc) => <CoachScanCard key={sc.id} scan={sc} />)}
    </div>
  )
}

function CoachScanCard({ scan }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    supabase.storage.from('body-photos').createSignedUrl(scan.photo_path, 3600).then(({ data }) => setUrl(data?.signedUrl || null))
  }, [])
  return (
    <div className="fc-block">
      <b>Scan · {(scan.created_at || '').slice(0, 10)}</b>
      {url ? <div className="shot"><img src={url} alt="Progress scan" /></div> : <p className="muted-note">Loading photo…</p>}
      {scan.summary && <p>{scan.summary}</p>}
    </div>
  )
}

// Expandable session card so Kim can review the full workout a client built or
// that she assigned — every exercise, sets × reps, weight and cue.
function CoachSessionCard({ plan, trainerId }) {
  const [open, setOpen] = useState(false)
  const exs = plan.exercises || []
  const mine = plan.assigned_by === trainerId
  const source = mine ? 'Assigned by you' : 'Built by client'
  return (
    <div className="card session-card">
      <button type="button" className="session-head" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="session-title">{plan.title}</div>
          <div className="session-sub">{plan.focus} · {exs.length} exercise{exs.length === 1 ? '' : 's'} · {source}</div>
        </div>
        <span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ol className="ex-list">
          {exs.map((ex, i) => (
            <li className="ex" key={i}>
              <span className="ex-n">{i + 1}</span>
              <div className="ex-body">
                <div className="ex-name">{ex.name}</div>
                <ExSets ex={ex} />
                {ex.cue && <div className="ex-cue">{ex.cue}</div>}
              </div>
            </li>
          ))}
          {plan.finisher && <p className="finisher"><b>Finisher:</b> {plan.finisher}</p>}
        </ol>
      )}
    </div>
  )
}

// Coach-published recipes. Clients browse them and can log one straight to their
// day. Macros are per serving. Mirrors the templates RLS pattern.
function CoachRecipes({ coachId }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', description: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', serving_label: '', tags: '' })
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('recipes').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
    setItems(data || [])
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function save() {
    if (!f.title.trim()) { setError('Give the recipe a name.'); return }
    const row = {
      coach_id: coachId, title: f.title.trim(), description: f.description.trim() || null,
      calories: Number(f.calories) || null, protein_g: Number(f.protein_g) || null,
      carbs_g: Number(f.carbs_g) || null, fat_g: Number(f.fat_g) || null,
      serving_label: f.serving_label.trim() || 'per serving',
      tags: f.tags.trim() ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
    }
    const { data, error: err } = await supabase.from('recipes').insert(row).select().single()
    if (err) { setError(err.message); return }
    setItems((i) => [data, ...i])
    setF({ title: '', description: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', serving_label: '', tags: '' })
    setOpen(false); setError('')
  }
  async function del(id) {
    await supabase.from('recipes').delete().eq('id', id)
    setItems((i) => i.filter((x) => x.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Recipe library</p>
      <p className="muted-note">Save go-to meals with their macros — clients browse them and log one straight to their day.</p>

      {items.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {items.map((r) => (
            <div className="card" key={r.id} style={{ background: 'var(--surface-2)' }}>
              <div className="session-title">{r.title}</div>
              <div className="session-sub">{[r.calories ? r.calories + ' kcal' : null, r.protein_g ? r.protein_g + 'g P' : null, r.serving_label].filter(Boolean).join(' · ')}</div>
              {r.description && <p className="muted-note" style={{ marginTop: 6 }}>{r.description}</p>}
              <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => del(r.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!open ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setOpen(true); setError('') }}>New recipe</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">Recipe name<input value={f.title} onChange={set('title')} placeholder="e.g. High-protein overnight oats" /></label>
          <label className="field">Method / notes<textarea rows={3} value={f.description} onChange={set('description')} placeholder="How to make it — kept short" /></label>
          <div className="grid-2">
            <label className="field">Calories<input type="number" value={f.calories} onChange={set('calories')} placeholder="kcal" /></label>
            <label className="field">Protein (g)<input type="number" value={f.protein_g} onChange={set('protein_g')} /></label>
            <label className="field">Carbs (g)<input type="number" value={f.carbs_g} onChange={set('carbs_g')} /></label>
            <label className="field">Fat (g)<input type="number" value={f.fat_g} onChange={set('fat_g')} /></label>
          </div>
          <div className="grid-2">
            <label className="field">Serving<input value={f.serving_label} onChange={set('serving_label')} placeholder="per serving" /></label>
            <label className="field">Tags<input value={f.tags} onChange={set('tags')} placeholder="breakfast, high-protein" /></label>
          </div>
          <button className="btn primary big" onClick={save}>Save recipe</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// Coach-published videos (technique, form, mindset). Clients watch them in the
// video library. YouTube/Vimeo embed where recognised, else a link out.
function CoachVideos({ coachId }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', url: '', category: '', description: '' })
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('videos').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
    setItems(data || [])
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function save() {
    if (!f.title.trim()) { setError('Give the video a title.'); return }
    if (!f.url.trim()) { setError('Paste the video link.'); return }
    const { data, error: err } = await supabase.from('videos').insert({
      coach_id: coachId, title: f.title.trim(), url: f.url.trim(),
      category: f.category.trim() || null, description: f.description.trim() || null,
    }).select().single()
    if (err) { setError(err.message); return }
    setItems((i) => [data, ...i])
    setF({ title: '', url: '', category: '', description: '' }); setOpen(false); setError('')
  }
  async function del(id) {
    await supabase.from('videos').delete().eq('id', id)
    setItems((i) => i.filter((x) => x.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Video library</p>
      <p className="muted-note">Add technique and mindset clips (YouTube, Vimeo or a link) — they show in your clients’ app.</p>

      {items.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {items.map((v) => (
            <div className="card" key={v.id} style={{ background: 'var(--surface-2)' }}>
              <div className="session-title">{v.title}</div>
              <div className="session-sub">{[v.category, v.url].filter(Boolean).join(' · ')}</div>
              <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => del(v.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!open ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setOpen(true); setError('') }}>Add video</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">Title<input value={f.title} onChange={set('title')} placeholder="e.g. How to brace for a heavy squat" /></label>
          <label className="field">Video link<input value={f.url} onChange={set('url')} placeholder="YouTube / Vimeo URL" /></label>
          <div className="grid-2">
            <label className="field">Category<input value={f.category} onChange={set('category')} placeholder="Technique" /></label>
            <label className="field">Note (optional)<input value={f.description} onChange={set('description')} placeholder="One line" /></label>
          </div>
          <button className="btn primary big" onClick={save}>Save video</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// Supplements / Shop / Podcasts — outbound links the coach manages, surfaced in
// the client app (gated per brand). One card handles all three kinds.
const LINK_KINDS = [
  { key: 'supplement', label: 'Supplement' },
  { key: 'shop', label: 'Shop' },
  { key: 'podcast', label: 'Podcast' },
]
function CoachLinks({ coachId }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ kind: 'supplement', label: '', url: '', note: '' })
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('coach_links').select('*').eq('coach_id', coachId).order('kind', { ascending: true }).order('position', { ascending: true }).order('created_at', { ascending: true })
    setItems(data || [])
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function save() {
    if (!f.label.trim()) { setError('Give the link a label.'); return }
    if (!f.url.trim()) { setError('Paste the link.'); return }
    const { data, error: err } = await supabase.from('coach_links').insert({
      coach_id: coachId, kind: f.kind, label: f.label.trim(), url: f.url.trim(), note: f.note.trim() || null,
    }).select().single()
    if (err) { setError(err.message); return }
    setItems((i) => [...i, data])
    setF({ kind: f.kind, label: '', url: '', note: '' }); setOpen(false); setError('')
  }
  async function del(id) {
    await supabase.from('coach_links').delete().eq('id', id)
    setItems((i) => i.filter((x) => x.id !== id))
  }

  const label = (k) => (LINK_KINDS.find((x) => x.key === k) || {}).label || k

  return (
    <div className="card">
      <p className="eyebrow">Supplements · Shop · Podcasts</p>
      <p className="muted-note">Add links your clients see — Protein Works (with your code), your book, your podcast.</p>

      {items.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {items.map((l) => (
            <div className="card" key={l.id} style={{ background: 'var(--surface-2)' }}>
              <div className="session-title">{l.label}</div>
              <div className="session-sub">{[label(l.kind), l.note, l.url].filter(Boolean).join(' · ')}</div>
              <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => del(l.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!open ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setOpen(true); setError('') }}>Add link</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">Type
            <select value={f.kind} onChange={set('kind')}>
              {LINK_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
          <label className="field">Label<input value={f.label} onChange={set('label')} placeholder="e.g. The Protein Works" /></label>
          <label className="field">Link<input value={f.url} onChange={set('url')} placeholder="https://…" /></label>
          <label className="field">Note (optional)<input value={f.note} onChange={set('note')} placeholder="e.g. Use code PAUL10 for 10% off" /></label>
          <button className="btn primary big" onClick={save}>Save link</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// Coach-assigned tags on a client. These drive audience-targeting of community
// posts and featured content (a post tagged 'prep' shows only to prep clients).
function ClientTags({ clientId, coachId }) {
  const [tags, setTags] = useState([])
  const [input, setInput] = useState('')

  async function load() {
    const { data } = await supabase.from('client_tags').select('*').eq('coach_id', coachId).eq('client_id', clientId).order('created_at', { ascending: true })
    setTags(data || [])
  }
  useEffect(() => { load() }, [])

  async function add() {
    const t = input.trim().toLowerCase()
    if (!t) return
    const { data, error: err } = await supabase.from('client_tags').insert({ coach_id: coachId, client_id: clientId, tag: t }).select().single()
    if (!err && data) setTags((x) => [...x, data])
    setInput('')
  }
  async function remove(id) {
    await supabase.from('client_tags').delete().eq('id', id)
    setTags((x) => x.filter((t) => t.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Tags</p>
      <p className="muted-note">Group this client — then target community posts and content to a tag so only the right people see them.</p>
      <div className="tag-row" style={{ marginTop: 10 }}>
        {tags.map((t) => (
          <span className="tag-pill" key={t.id}>{t.tag}<button type="button" onClick={() => remove(t.id)} aria-label="Remove tag">×</button></span>
        ))}
        {tags.length === 0 && <span className="muted-note">No tags yet.</span>}
      </div>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <input className="ex-name-in" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. prep, online, beginner" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" className="btn ghost" onClick={add} disabled={!input.trim()}>Add tag</button>
      </div>
    </div>
  )
}

const PROGRAM_LEVELS = ['Beginner', 'Intermediate', 'Advanced']

// Multi-session programmes built from the coach's templates. Each programme session
// snapshots a template (title/focus/exercises/finisher) so later template edits
// don't rewrite a published programme. Clients browse these in "Program library".
function CoachPrograms({ coachId }) {
  const [programs, setPrograms] = useState([])
  const [templates, setTemplates] = useState([])
  const [sessions, setSessions] = useState({}) // program_id -> rows
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [weeks, setWeeks] = useState('')
  const [level, setLevel] = useState('Beginner')
  const [meta, setMeta] = useState({}) // location / equipment / audience / goal filters
  const [error, setError] = useState('')
  const [addFor, setAddFor] = useState(null) // program_id we're adding a session to
  const [pickTpl, setPickTpl] = useState('')
  const [dayLabel, setDayLabel] = useState('')

  async function load() {
    const [p, t] = await Promise.all([
      supabase.from('workout_programs').select('*').eq('coach_id', coachId).order('created_at', { ascending: false }),
      supabase.from('workout_templates').select('*').eq('coach_id', coachId).order('created_at', { ascending: false }),
    ])
    setPrograms(p.data || [])
    setTemplates(t.data || [])
  }
  useEffect(() => { load() }, [])

  async function loadSessions(programId) {
    const { data } = await supabase.from('program_sessions').select('*').eq('program_id', programId).order('position', { ascending: true })
    setSessions((s) => ({ ...s, [programId]: data || [] }))
  }
  function toggle(programId) {
    setOpenId((o) => (o === programId ? null : programId))
    if (!sessions[programId]) loadSessions(programId)
  }

  async function createProgram() {
    if (!title.trim()) { setError('Give the program a name.'); return }
    const { data, error: err } = await supabase.from('workout_programs').insert({
      coach_id: coachId, title: title.trim(), description: desc.trim() || null,
      weeks: Number(weeks) || null, level,
      location: meta.location || null, equipment: meta.equipment || null,
      audience: meta.audience || null, goal: meta.goal || null,
    }).select().single()
    if (err) { setError(err.message); return }
    setPrograms((p) => [data, ...p])
    setTitle(''); setDesc(''); setWeeks(''); setLevel('Beginner'); setMeta({}); setCreating(false); setError('')
    setOpenId(data.id); setSessions((s) => ({ ...s, [data.id]: [] })); setAddFor(data.id)
  }

  async function addSession(programId) {
    const tpl = templates.find((t) => t.id === pickTpl)
    if (!tpl) { setError('Pick a template to add.'); return }
    const pos = (sessions[programId] || []).length
    const { data, error: err } = await supabase.from('program_sessions').insert({
      program_id: programId, position: pos, label: dayLabel.trim() || null,
      title: tpl.title, focus: tpl.focus, exercises: tpl.exercises || [], finisher: tpl.finisher || null,
    }).select().single()
    if (err) { setError(err.message); return }
    setSessions((s) => ({ ...s, [programId]: [...(s[programId] || []), data] }))
    setPickTpl(''); setDayLabel(''); setError('')
  }

  async function delSession(programId, id) {
    await supabase.from('program_sessions').delete().eq('id', id)
    setSessions((s) => ({ ...s, [programId]: (s[programId] || []).filter((x) => x.id !== id) }))
  }
  async function delProgram(id) {
    await supabase.from('workout_programs').delete().eq('id', id)
    setPrograms((p) => p.filter((x) => x.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Program library</p>
      <p className="muted-note">Bundle your templates into a plan clients can follow — they’ll browse these in “Program library”.</p>

      {programs.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {programs.map((pr) => (
            <div className="card session-card" key={pr.id}>
              <button type="button" className="session-head" onClick={() => toggle(pr.id)}>
                <div>
                  <div className="session-title">{pr.title}</div>
                  <div className="session-sub">{[pr.level, pr.weeks ? pr.weeks + ' weeks' : null, ...PROGRAM_DIMS.map((d) => programTagLabel(d.key, pr[d.key]))].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="chev">{openId === pr.id ? '−' : '+'}</span>
              </button>
              {openId === pr.id && (
                <div className="stack" style={{ marginTop: 8 }}>
                  {pr.description && <p className="muted-note">{pr.description}</p>}
                  {(sessions[pr.id] || []).map((ps) => (
                    <div className="card" key={ps.id} style={{ background: 'var(--surface-2)' }}>
                      <div className="session-title">{ps.label ? ps.label + ' · ' : ''}{ps.title}</div>
                      <ol className="ex-list" style={{ marginTop: 6 }}>
                        {(ps.exercises || []).map((ex, i) => (
                          <li className="ex" key={i}>
                            <span className="ex-n">{i + 1}</span>
                            <div className="ex-body"><div className="ex-name">{ex.name}</div><ExSets ex={ex} /></div>
                          </li>
                        ))}
                      </ol>
                      <button type="button" className="btn ghost sm" onClick={() => delSession(pr.id, ps.id)}>Remove</button>
                    </div>
                  ))}
                  {(sessions[pr.id] || []).length === 0 && <p className="muted-note">No sessions yet — add one from your templates.</p>}

                  {templates.length === 0 ? (
                    <p className="muted-note">Build a session template first (above) — programs are made from templates.</p>
                  ) : (
                    <div className="grid-2">
                      <label className="field">Add session
                        <select className="ex-select" value={pickTpl} onChange={(e) => { setPickTpl(e.target.value); setAddFor(pr.id) }}>
                          <option value="">Choose a template…</option>
                          {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                      </label>
                      <label className="field">Day label<input value={addFor === pr.id ? dayLabel : ''} onChange={(e) => { setDayLabel(e.target.value); setAddFor(pr.id) }} placeholder="e.g. Day 1" /></label>
                    </div>
                  )}
                  {templates.length > 0 && <button type="button" className="btn ghost" onClick={() => addSession(pr.id)}>Add to program</button>}
                  <button type="button" className="link-btn" onClick={() => delProgram(pr.id)}>Delete program</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!creating ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setCreating(true); setError('') }}>New program</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">Program name<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 8-Week Lean Strength" /></label>
          <label className="field">Description<textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Who it’s for and what it delivers" /></label>
          <div className="grid-2">
            <label className="field">Weeks<input type="number" value={weeks} onChange={(e) => setWeeks(e.target.value)} placeholder="e.g. 8" /></label>
            <label className="field">Level
              <select className="ex-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                {PROGRAM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          </div>
          <p className="muted-note">Tags (help clients filter — optional):</p>
          <div className="grid-2">
            {PROGRAM_DIMS.map((d) => (
              <label className="field" key={d.key}>{d.label}
                <select className="ex-select" value={meta[d.key] || ''} onChange={(e) => setMeta((m) => ({ ...m, [d.key]: e.target.value || undefined }))}>
                  <option value="">Any / unspecified</option>
                  {d.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button className="btn primary big" onClick={createProgram}>Create program</button>
          <button type="button" className="link-btn" onClick={() => { setCreating(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// Reusable session templates the coach builds once. Clients can then "Start a
// workout" and pick one (see ClientApp). Supports the advanced set types.
function CoachTemplates({ coachId }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [focus, setFocus] = useState('')
  const [rows, setRows] = useState([newExerciseRow()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)

  async function load() {
    const { data } = await supabase.from('workout_templates').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
    setItems(data || [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    const exercises = rowsToExercises(rows, 'Coach plan')
    if (exercises.length === 0) { setError('Add at least one exercise with a set.'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('workout_templates').insert({
      coach_id: coachId, title: title.trim() || 'Session template', focus: focus.trim() || null, exercises,
    }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) {
      setItems((i) => [data, ...i])
      setTitle(''); setFocus(''); setRows([newExerciseRow()]); setOpen(false)
    }
  }

  async function del(id) {
    await supabase.from('workout_templates').delete().eq('id', id)
    setItems((i) => i.filter((x) => x.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Session templates</p>
      <p className="muted-note">Build a session once — your clients can start it themselves from “Start a workout”. Supports supersets, drop sets, pyramids and clusters.</p>

      {items.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {items.map((t) => (
            <div className="card session-card" key={t.id}>
              <button type="button" className="session-head" onClick={() => setOpenId((o) => (o === t.id ? null : t.id))}>
                <div>
                  <div className="session-title">{t.title}</div>
                  <div className="session-sub">{t.focus ? t.focus + ' · ' : ''}{(t.exercises || []).length} exercise{(t.exercises || []).length === 1 ? '' : 's'}</div>
                </div>
                <span className="chev">{openId === t.id ? '−' : '+'}</span>
              </button>
              {openId === t.id && (
                <>
                  <ol className="ex-list">
                    {(t.exercises || []).map((ex, i) => (
                      <li className="ex" key={i}>
                        <span className="ex-n">{i + 1}</span>
                        <div className="ex-body">
                          <div className="ex-name">{ex.name}</div>
                          <ExSets ex={ex} />
                          {ex.cue && <div className="ex-cue">{ex.cue}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <button type="button" className="btn ghost sm" onClick={() => del(t.id)}>Delete template</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!open ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>New template</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="grid-2">
            <label className="field">Template name<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Upper Push A" /></label>
            <label className="field">Focus<input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Push" /></label>
          </div>
          <ExerciseRowsEditor rows={rows} setRows={setRows} />
          {error && <p className="error">{error}</p>}
          <button className="btn primary big" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save template'}</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function AssignWorkout({ clientId, trainerId, onAssigned }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [focus, setFocus] = useState('')
  const [rows, setRows] = useState([newExerciseRow()])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function assign() {
    const exercises = rowsToExercises(rows, 'Coach plan')
    if (exercises.length === 0) { setError('Add at least one exercise with a set.'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('workout_plans').insert({
      client_id: clientId, title: title.trim() || 'Assigned session', focus: focus.trim() || 'Coach plan',
      exercises, finisher: null, assigned_by: trainerId,
    }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) {
      onAssigned(data)
      setSaved(true)
      setTitle(''); setFocus(''); setRows([newExerciseRow()])
      setTimeout(() => { setSaved(false); setOpen(false) }, 1800)
    }
  }

  return (
    <div className="card">
      <p className="eyebrow">Assign a workout</p>
      {!open ? (
        <>
          <p className="muted-note">Build a session and send it straight to this client’s app.</p>
          <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>New workout</button>
        </>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="grid-2">
            <label className="field">Session name<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lower body" /></label>
            <label className="field">Focus<input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. Legs" /></label>
          </div>
          <ExerciseRowsEditor rows={rows} setRows={setRows} />
          {error && <p className="error">{error}</p>}
          <button className="btn primary big" disabled={saving} onClick={assign}>{saving ? 'Assigning…' : 'Assign to client'}</button>
          {saved && <p className="logged-ok">Assigned ✓ — it’s now in their app.</p>}
          <button type="button" className="link-btn" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function HeroImageSetting({ profile }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const pub = (p) => supabase.storage.from('content-images').getPublicUrl(p).data.publicUrl

  async function load() {
    const { data } = await supabase.from('hero_images').select('*').eq('coach_id', profile.id).order('created_at', { ascending: true })
    setItems(data || [])
  }
  useEffect(() => { load() }, [])

  async function onPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const p = `${profile.id}/hero-${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('content-images').upload(p, file, { contentType: file.type || 'image/jpeg' })
      if (up.error) throw new Error(up.error.message)
      const { data } = await supabase.from('hero_images').insert({ coach_id: profile.id, image_path: p }).select().single()
      if (data) setItems((i) => [...i, data])
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  async function del(id) {
    await supabase.from('hero_images').delete().eq('id', id)
    setItems((i) => i.filter((x) => x.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">App hero photos</p>
      <p className="muted-note">Photos that rotate at the top of your clients’ app. Grab them from your Instagram.</p>
      {items.length > 0 && (
        <div className="hero-thumbs">
          {items.map((it) => (
            <div className="hero-thumb" key={it.id}>
              <img src={pub(it.image_path)} alt="" />
              <button type="button" className="thumb-del" onClick={() => del(it.id)} aria-label="Delete">×</button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
      <button type="button" className="btn ghost small" style={{ marginTop: 12 }} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : 'Add photo'}</button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function FeaturedContent({ coachId, coachName }) {
  const first = (coachName || 'your coach').split(' ')[0]
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('image')
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tags, setTags] = useState([])
  const [audience, setAudience] = useState('')
  const fileRef = useRef(null)

  async function load() {
    const { data } = await supabase.from('featured_content').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
    setItems(data || [])
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!THEME.features?.tags) return
    supabase.from('client_tags').select('tag').eq('coach_id', coachId)
      .then(({ data }) => setTags([...new Set((data || []).map((r) => r.tag))].sort()))
  }, [])

  function reset() { setUrl(''); setCaption(''); setAudience(''); setOpen(false); setError(''); if (fileRef.current) fileRef.current.value = '' }

  async function addLink() {
    const u = url.trim()
    if (!u) return
    const { data } = await supabase.from('featured_content').insert({ coach_id: coachId, ig_url: u, caption: caption.trim() || null, audience_tag: audience || null }).select().single()
    if (data) { setItems((i) => [data, ...i]); reset() }
  }

  async function onImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${coachId}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('content-images').upload(path, file, { contentType: file.type || 'image/jpeg' })
      if (up.error) throw new Error(up.error.message)
      const { data } = await supabase.from('featured_content').insert({ coach_id: coachId, image_path: path, caption: caption.trim() || null, audience_tag: audience || null }).select().single()
      if (data) { setItems((i) => [data, ...i]); reset() }
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function del(id) {
    await supabase.from('featured_content').delete().eq('id', id)
    setItems((i) => i.filter((x) => x.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Featured content</p>
      <p className="muted-note">Upload an image or paste an Instagram link — it shows to all your clients in “From {first}”.</p>
      {!open ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>Add content</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="seg small">
            <button type="button" className={kind === 'image' ? 'on' : ''} onClick={() => setKind('image')}>Upload image</button>
            <button type="button" className={kind === 'link' ? 'on' : ''} onClick={() => setKind('link')}>Instagram link</button>
          </div>
          <label className="field">Caption (optional)<input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption" /></label>
          {THEME.features?.tags && tags.length > 0 && (
            <label className="field">Show to
              <select className="ex-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="">Everyone</option>
                {tags.map((t) => <option key={t} value={t}>Only: {t}</option>)}
              </select>
            </label>
          )}
          {kind === 'image' ? (
            <>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onImage} />
              <button type="button" className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : 'Choose image & push'}</button>
            </>
          ) : (
            <>
              <label className="field">Instagram post/reel URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" /></label>
              <button type="button" className="btn primary" onClick={addLink}>Add to app</button>
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button type="button" className="link-btn" onClick={reset}>Cancel</button>
        </div>
      )}
      {items.length > 0 && (
        <div className="stack" style={{ marginTop: 14 }}>
          {items.map((it) => (
            <div className="know-row" key={it.id}>
              <div><div className="know-title">{it.caption || (it.image_path ? 'Image' : 'Instagram post')}</div><div className="know-content">{it.image_path ? 'Uploaded image' : it.ig_url}</div></div>
              <button type="button" className="row-del" onClick={() => del(it.id)} aria-label="Delete">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FormChecksReview({ clientId }) {
  const [checks, setChecks] = useState([])
  useEffect(() => {
    supabase.from('form_checks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20).then(({ data }) => setChecks(data || []))
  }, [clientId])
  if (checks.length === 0) return null
  return (
    <div className="card">
      <p className="eyebrow">Form checks ({checks.length})</p>
      {checks.map((c) => <CoachFormCheck key={c.id} check={c} />)}
    </div>
  )
}

function CoachFormCheck({ check }) {
  const [url, setUrl] = useState(null)
  const [fb, setFb] = useState(check.coach_feedback || '')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    supabase.storage.from('form-videos').createSignedUrl(check.storage_path, 3600).then(({ data }) => setUrl(data?.signedUrl || null))
  }, [])
  async function save() {
    await supabase.from('form_checks').update({ coach_feedback: fb.trim() || null }).eq('id', check.id)
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }
  return (
    <div className="fc-review">
      <div className="fc-review-top"><b>{check.exercise || 'Form check'}</b></div>
      {url ? <video className="form-video" src={url} controls playsInline /> : <p className="muted-note">Loading…</p>}
      {check.ai_feedback && <div className="fc-block"><b>AI pointers</b><p>{check.ai_feedback}</p></div>}
      <label className="field" style={{ marginTop: 12 }}>Your feedback<textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Give your form feedback…" /></label>
      <button className="btn primary" onClick={save}>{saved ? 'Saved ✓' : 'Save feedback'}</button>
    </div>
  )
}

function KimBrain({ coachId, coachName }) {
  const first = (coachName || 'your coach').split(' ')[0]
  const [entries, setEntries] = useState([])
  const [mode, setMode] = useState(null) // null | 'add' | 'parse'
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [raw, setRaw] = useState('')
  const [parsing, setParsing] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('coach_knowledge').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
    setEntries(data || [])
  }
  useEffect(() => { load() }, [])

  function switchMode(m) { setMode((cur) => (cur === m ? null : m)); setSuggestions(null); setError('') }

  async function addEntry() {
    if (!content.trim()) return
    const { data } = await supabase.from('coach_knowledge').insert({ coach_id: coachId, title: title.trim() || null, content: content.trim(), source: 'manual' }).select().single()
    if (data) { setEntries((e) => [data, ...e]); setTitle(''); setContent(''); setMode(null) }
  }

  async function parse() {
    if (!raw.trim()) return
    setParsing(true); setError('')
    try {
      const { entries: sug } = await analyze({ mode: 'parse', text: raw })
      setSuggestions((sug || []).map((s) => ({ ...s, keep: true })))
    } catch (err) { setError(err.message) } finally { setParsing(false) }
  }

  async function saveSuggestions() {
    const rows = (suggestions || []).filter((s) => s.keep).map((s) => ({ coach_id: coachId, title: s.title, content: s.content, source: 'parsed' }))
    if (rows.length) {
      const { data } = await supabase.from('coach_knowledge').insert(rows).select()
      if (data) setEntries((e) => [...data.reverse(), ...e])
    }
    setSuggestions(null); setRaw(''); setMode(null)
  }

  async function del(id) {
    await supabase.from('coach_knowledge').delete().eq('id', id)
    setEntries((e) => e.filter((x) => x.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">{first}’s Brain</p>
      <p className="muted-note">Your knowledge powers the “Ask {first}” answers your clients get. Add your methods, or paste a script/messages and let AI structure them.</p>
      <div className="seg small" style={{ marginTop: 12 }}>
        <button type="button" className={mode === 'add' ? 'on' : ''} onClick={() => switchMode('add')}>Add knowledge</button>
        <button type="button" className={mode === 'parse' ? 'on' : ''} onClick={() => switchMode('parse')}>Paste &amp; parse</button>
      </div>

      {mode === 'add' && (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">Title (optional)<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Protein target" /></label>
          <label className="field">Knowledge<textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write it in your voice…" /></label>
          <button className="btn primary" onClick={addEntry}>Save to brain</button>
        </div>
      )}

      {mode === 'parse' && (
        <div className="stack" style={{ marginTop: 12 }}>
          {!suggestions ? (
            <>
              <label className="field">Paste a script, transcript, or your typical replies<textarea rows={6} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Paste here — AI turns it into clean knowledge entries" /></label>
              {error && <p className="error">{error}</p>}
              <button className="btn primary" disabled={parsing} onClick={parse}>{parsing ? 'Reading…' : 'Parse into knowledge'}</button>
            </>
          ) : (
            <>
              <p className="muted-note">{suggestions.length} entries found — untick any you don’t want, then save.</p>
              {suggestions.map((s, i) => (
                <label className="sug" key={i}>
                  <input type="checkbox" checked={s.keep} onChange={(e) => setSuggestions((su) => su.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} />
                  <span><b>{s.title}</b><br />{s.content}</span>
                </label>
              ))}
              <button className="btn primary" onClick={saveSuggestions}>Save selected to brain</button>
            </>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div className="stack" style={{ marginTop: 14 }}>
          <p className="eyebrow">In your brain ({entries.length})</p>
          {entries.map((e) => (
            <div className="know-row" key={e.id}>
              <div><div className="know-title">{e.title || 'Untitled'}</div><div className="know-content">{e.content}</div></div>
              <button type="button" className="row-del" onClick={() => del(e.id)} aria-label="Delete">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Owner's class timetable: build the weekly schedule and see who's booked, with
// a desk check-in (present / no-show) for each upcoming session.
function CoachTimetable({ profile, clients }) {
  const [classes, setClasses] = useState([])
  const [bookings, setBookings] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', instructor: '', weekday: 1, start_time: '18:00', duration_min: 45, capacity: 12, location: '' })
  const [saving, setSaving] = useState(false)
  const nameOf = (id) => (clients.find((c) => c.id === id)?.full_name) || 'Member'

  async function load() {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const to = new Date(today); to.setDate(today.getDate() + 7)
    const [{ data: cls }, { data: bk }] = await Promise.all([
      supabase.from('gym_classes').select('*').eq('owner_id', profile.id).order('weekday').order('start_time'),
      supabase.from('class_bookings').select('*').eq('owner_id', profile.id)
        .gte('session_date', ymd(today)).lte('session_date', ymd(to)).neq('status', 'cancelled'),
    ])
    setClasses(cls || [])
    setBookings(bk || [])
  }
  useEffect(() => { load() }, [])

  async function addClass() {
    if (!form.title.trim()) return
    setSaving(true)
    const { data } = await supabase.from('gym_classes').insert({
      owner_id: profile.id, title: form.title.trim(), instructor: form.instructor.trim() || null,
      weekday: Number(form.weekday), start_time: form.start_time, duration_min: Number(form.duration_min) || 45,
      capacity: Number(form.capacity) || 12, location: form.location.trim() || null,
    }).select().single()
    setSaving(false)
    if (data) { setClasses((c) => [...c, data]); setForm({ title: '', instructor: '', weekday: 1, start_time: '18:00', duration_min: 45, capacity: 12, location: '' }); setOpen(false) }
  }
  async function toggle(c) {
    await supabase.from('gym_classes').update({ active: !c.active }).eq('id', c.id)
    setClasses((cs) => cs.map((x) => x.id === c.id ? { ...x, active: !x.active } : x))
  }
  async function del(id) {
    await supabase.from('gym_classes').delete().eq('id', id)
    setClasses((cs) => cs.filter((x) => x.id !== id))
  }
  async function mark(bk, status) {
    await supabase.from('class_bookings').update({ status }).eq('id', bk.id)
    setBookings((bs) => bs.map((x) => x.id === bk.id ? { ...x, status } : x))
  }

  const sessions = upcomingSessions(classes, 7)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="card">
      <p className="eyebrow accent">Class timetable</p>
      <p className="muted-note" style={{ marginTop: 0 }}>Build your weekly schedule; members book in the app. Check them in below.</p>

      {/* Weekly schedule */}
      {classes.length > 0 && (
        <div className="stack" style={{ gap: 6, marginTop: 6 }}>
          {classes.map((c) => (
            <div className="logrow" key={c.id}>
              <span className="logname">{c.active ? '' : '(paused) '}{c.title} · {WEEKDAYS[c.weekday]} {fmtTime(c.start_time)}</span>
              <span className="logmac">
                cap {c.capacity}
                <button className="thumb-del" title={c.active ? 'Pause' : 'Resume'} onClick={() => toggle(c)}>{c.active ? '❚❚' : '▶'}</button>
                <button className="thumb-del" title="Delete" onClick={() => del(c.id)}>×</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!open ? (
        <button className="btn ghost small" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>Add a class</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">Class name<input value={form.title} onChange={set('title')} placeholder="e.g. Spin, HIIT, Legs & Core" /></label>
          <div className="grid-2">
            <label className="field">Day<select value={form.weekday} onChange={set('weekday')}>{WEEKDAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></label>
            <label className="field">Start time<input type="time" value={form.start_time} onChange={set('start_time')} /></label>
            <label className="field">Length (min)<input type="number" value={form.duration_min} onChange={set('duration_min')} /></label>
            <label className="field">Capacity<input type="number" value={form.capacity} onChange={set('capacity')} /></label>
            <label className="field">Instructor<input value={form.instructor} onChange={set('instructor')} placeholder="e.g. Lekan" /></label>
            <label className="field">Location<input value={form.location} onChange={set('location')} placeholder="e.g. Studio 1" /></label>
          </div>
          <button className="btn primary sm" disabled={saving} onClick={addClass}>{saving ? 'Adding…' : 'Add class'}</button>
          <button className="link-btn" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}

      {/* Upcoming rosters + desk check-in */}
      {sessions.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="eyebrow">Upcoming — check-in</p>
          {sessions.map(({ cls, dateStr }) => {
            const roster = bookings.filter((b) => b.class_id === cls.id && b.session_date === dateStr)
            if (roster.length === 0) return null
            const booked = roster.filter((r) => ['booked', 'attended', 'no_show'].includes(r.status))
            const waits = roster.filter((r) => r.status === 'waitlist')
            return (
              <div className="fc-block" key={bookingKey(cls.id, dateStr)}>
                <b>{cls.title} · {dayLabel(dateStr)} {fmtTime(cls.start_time)}</b>
                <p className="checkin-line">{booked.length}/{cls.capacity} booked{waits.length ? ` · ${waits.length} waiting` : ''}</p>
                {booked.map((b) => (
                  <div className="logrow" key={b.id}>
                    <span className="logname">
                      {b.status === 'attended' && <span className="delta good">✓ </span>}
                      {b.status === 'no_show' && <span className="delta">✕ </span>}
                      {nameOf(b.client_id)}
                    </span>
                    <span className="logmac">
                      <button className="btn ghost small" onClick={() => mark(b, b.status === 'attended' ? 'booked' : 'attended')}>Present</button>
                      <button className="btn ghost small" onClick={() => mark(b, b.status === 'no_show' ? 'booked' : 'no_show')}>No-show</button>
                    </span>
                  </div>
                ))}
                {waits.map((b) => (
                  <div className="logrow" key={b.id}>
                    <span className="logname muted-note">{nameOf(b.client_id)} — waitlist</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Members CRM: every member scored by churn risk from their activity, most-urgent
// first, so the owner sees at a glance who's fading before they cancel.
function CoachMembers({ clients, loading, onOpen }) {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('attention')
  useEffect(() => {
    if (!clients || clients.length === 0) { setRows([]); return }
    loadMemberActivity(supabase, clients).then(setRows)
  }, [clients.length])

  const counts = rows ? segmentCounts(rows) : { active: 0, new: 0, atrisk: 0, dormant: 0 }
  const needsCount = counts.atrisk + counts.dormant
  const shown = (rows || []).filter((r) => filter === 'all' ? true : r.seg.needs)

  return (
    <div className="card">
      <p className="eyebrow accent">Members</p>
      <p className="muted-note" style={{ marginTop: 0 }}>Everyone scored by how recently they've engaged — so you can reach the fading ones before they quit.</p>

      <div className="metrics-2" style={{ marginTop: 8 }}>
        <Metric k="Active" v={counts.active} d="" />
        <Metric k="At risk" v={counts.atrisk} d="" />
        <Metric k="Dormant" v={counts.dormant} d="" />
        <Metric k="New" v={counts.new} d="" />
      </div>

      <div className="seg small" style={{ marginTop: 12 }}>
        <button type="button" className={filter === 'attention' ? 'on' : ''} onClick={() => setFilter('attention')}>Needs attention ({needsCount})</button>
        <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All ({clients.length})</button>
      </div>

      {(loading || rows === null) && <p className="muted-note" style={{ marginTop: 10 }}>Loading…</p>}
      {rows && clients.length === 0 && <p className="muted-note" style={{ marginTop: 10 }}>No members yet. Share your code above to get them started.</p>}
      {rows && shown.length === 0 && clients.length > 0 && <p className="muted-note" style={{ marginTop: 10 }}>Nobody needs chasing right now — nice work.</p>}

      <div className="stack" style={{ marginTop: 10 }}>
        {shown.map((r) => (
          <button className="tile" key={r.id} onClick={() => onOpen(r)}>
            <span className="avatar" style={{ position: 'relative' }}>
              {(r.full_name || '?').charAt(0).toUpperCase()}
              <span className={'rd-light ' + r.seg.color} style={{ position: 'absolute', right: -2, bottom: -2 }} />
            </span>
            <div>
              <b>{r.full_name || 'Member'}</b>
              <span>{r.seg.label} · {lastSeenLabel(r.lastActiveMs)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Owner briefing: an AI "operations manager" that reads the gym's numbers and
// writes a short plain-English morning brief — money, who to chase, what's on.
function CoachBriefing({ profile, clients }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function gatherStats() {
    const [rows, { data: classes }, { data: bookings }] = await Promise.all([
      loadMemberActivity(supabase, clients),
      supabase.from('gym_classes').select('*').eq('owner_id', profile.id).eq('active', true),
      supabase.from('class_bookings').select('class_id, session_date, status').eq('owner_id', profile.id).neq('status', 'cancelled'),
    ])
    const counts = segmentCounts(rows)
    const atRisk = rows.filter((r) => r.seg.needs)
      .map((r) => ({ name: r.full_name, status: r.seg.label, last_seen: lastSeenLabel(r.lastActiveMs) }))
      .slice(0, 6)
    const sessions = upcomingSessions(classes || [], 2).map(({ cls, dateStr }) => {
      const booked = (bookings || []).filter((b) => b.class_id === cls.id && b.session_date === dateStr && ['booked', 'attended'].includes(b.status)).length
      return { class: cls.title, when: dayLabel(dateStr) + ' ' + fmtTime(cls.start_time), booked, capacity: cls.capacity }
    })
    return {
      date: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      members: { total: clients.length, active: counts.active, new_this_period: counts.new, at_risk: atRisk, at_risk_count: counts.atrisk, dormant_count: counts.dormant },
      classes_next_48h: sessions,
      money: { expected_next_30_days: 8180, collected_this_month: 7410, in_arrears_amount: 340, in_arrears_members: 9, auto_recovered: 470, currency: 'GBP' },
    }
  }

  async function run() {
    setLoading(true); setError('')
    try {
      const stats = await gatherStats()
      const persona = { name: (profile.full_name || 'there').split(' ')[0] }
      const { briefing } = await analyze({ mode: 'briefing', stats, persona })
      setText(briefing || 'No briefing available.')
    } catch (err) { setError(err.message || 'Could not generate the briefing.') } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <p className="eyebrow accent">Today's briefing</p>
      <p className="muted-note" style={{ marginTop: 0 }}>Your AI gym manager reads the numbers and tells you what needs you today.</p>
      {!text && !loading && <button className="btn primary" onClick={run}>Get today's briefing</button>}
      {loading && <p className="muted-note">Reading your gym…</p>}
      {error && <p className="error">{error}</p>}
      {text && (
        <>
          <p style={{ whiteSpace: 'pre-wrap', marginTop: 6, lineHeight: 1.6 }}>{text}</p>
          <button className="btn ghost small" style={{ marginTop: 10 }} disabled={loading} onClick={run}>Refresh</button>
        </>
      )}
    </div>
  )
}

function MacroRowSmall({ m, target }) {
  return (
    <div className="macro-row">
      <span><b>{m.calories}</b>/{target?.calories || 0} kcal</span>
      <span><b>{m.protein_g}</b>/{target?.protein_g || 0}g P</span>
      <span><b>{m.carbs_g}</b>/{target?.carbs_g || 0}g C</span>
      <span><b>{m.fat_g}</b>/{target?.fat_g || 0}g F</span>
    </div>
  )
}

function Metric({ k, v, d }) {
  return (
    <div className="metric">
      <div className="metric-k">{k}</div>
      <div className="metric-v">{v} {d && <span className="delta good">{d}</span>}</div>
    </div>
  )
}
