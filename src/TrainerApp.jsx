import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { THEME } from './themes.js'
import { startOfTodayISO, startOfWeekISO, sumMacros, analyze, setPersona, scaleImageToBlob } from './lib.js'
import { TrendChart, ExSets, Metric, CoachSection } from './ui.jsx'
import { ExerciseRowsEditor, newExerciseRow, rowsToExercises, useWorkoutDraft, planToRows, WorkoutEditForm } from './WorkoutRows.jsx'
import { LEVELS } from './accountability.js'
import { PERF_TESTS, TEST_BY_KEY, TEST_GROUPS, bestValue } from './perfTests.js'
import { readinessScore, readinessLight, loadMetrics, acwrFlag, combinedReadiness } from './monitoring.js'
import { ageYears, maturityOffset, maturityPhase, growthVelocity, growthGuidance } from './growth.js'
import { ParqReview } from './Parq.jsx'
import { MessageThread } from './MessageThread.jsx'
import { CommunityFeed } from './CommunityFeed.jsx'
import { LiftProgress } from './LiftProgress.jsx'
import { SquadSession } from './SquadSession.jsx'
import { printClientReport } from './report.js'
import { CoachVald, ValdTests } from './VALD.jsx'
import { FoodDiary } from './FoodDiary.jsx'
import { ProgressPhotos } from './ProgressPhotos.jsx'
import { CoachMealPlans, ClientMealPlanPanel } from './MealPlans.jsx'
import { ClientEventsCoach, ClientDob, CoachCycle, TodayCelebrations } from './LifeEvents.jsx'
import { PROGRAM_DIMS, programTagLabel } from './programMeta.js'
import { FIELD_TYPES, newField, paulTemplate, formatAnswer } from './checkinForms.js'
import { pushSupported, pushStatus, enablePush, disablePush, isIOS, isStandalone } from './push.js'
import { BODY_REGIONS, SIDES, TISSUES, SEVERITIES, INJURY_STATUS, AVAILABILITY, NOTE_TYPES, RTP_LADDER, statusLabel, availabilityOf, noteTypeLabel } from './rehab.js'
import { CashflowDashboard } from './CashflowDashboard.jsx'
import { WEEKDAYS, WEEKDAYS_FULL, upcomingSessions, bookingKey, dayLabel, fmtTime, ymd } from './booking.js'
import { SEGMENTS, loadMemberActivity, segmentCounts, lastSeenLabel } from './crm.js'

export default function TrainerApp({ profile, onSignOut }) {
  const [clients, setClients] = useState([])
  const [squads, setSquads] = useState([])
  const [groups, setGroups] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedSquad, setSelectedSquad] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState('')

  async function loadClients() {
    const { data } = await supabase
      .from('profiles').select('id, full_name, created_at, membership_tier, goal, step_target, nutrition_sensitive, nutrition_sensitive_note, health_conditions, has_kids, single_parent, shift_worker, life_context_note')
      .eq('trainer_id', profile.id).order('created_at', { ascending: true })
    setClients(data || [])
    setLoading(false)
  }
  async function loadSquads() {
    const { data } = await supabase.from('squads').select('*').eq('coach_id', profile.id).order('created_at', { ascending: true })
    setSquads(data || [])
  }
  async function loadGroups() {
    const { data } = await supabase.from('groups').select('*').eq('coach_id', profile.id).order('created_at', { ascending: true })
    setGroups(data || [])
  }
  useEffect(() => { loadClients(); if (THEME.features?.squads) loadSquads(); if (THEME.features?.groups) loadGroups() }, [])

  // Keep the coach where they were: a phone app-switch reloads the PWA and would
  // otherwise drop them back on the dashboard. Uses localStorage, not
  // sessionStorage — iOS can drop sessionStorage across a home-screen-app
  // switch/relaunch, which is exactly the case this exists to survive (Paul's
  // report: coming back to the app dropped him back on the dashboard).
  // Cleared on sign-out below so it can't leak into another coach's session.
  useEffect(() => {
    if (loading) return
    if (!selected) {
      const id = localStorage.getItem('cbk_coach_sel')
      if (id) { const c = clients.find((x) => x.id === id); if (c) setSelected(c) }
    }
    if (!selectedSquad) {
      const id = localStorage.getItem('cbk_coach_squad')
      if (id) { const s = squads.find((x) => x.id === id); if (s) setSelectedSquad(s) }
    }
    if (!selectedGroup) {
      const id = localStorage.getItem('cbk_coach_group')
      if (id) { const g = groups.find((x) => x.id === id); if (g) setSelectedGroup(g) }
    }
  }, [loading, clients, squads, groups])
  useEffect(() => {
    try { selected ? localStorage.setItem('cbk_coach_sel', selected.id) : localStorage.removeItem('cbk_coach_sel') } catch { /* ignore */ }
  }, [selected])
  useEffect(() => {
    try { selectedSquad ? localStorage.setItem('cbk_coach_squad', selectedSquad.id) : localStorage.removeItem('cbk_coach_squad') } catch { /* ignore */ }
  }, [selectedSquad])
  useEffect(() => {
    try { selectedGroup ? localStorage.setItem('cbk_coach_group', selectedGroup.id) : localStorage.removeItem('cbk_coach_group') } catch { /* ignore */ }
  }, [selectedGroup])

  function copyCode(code, which) {
    navigator.clipboard?.writeText(code || '')
    setCopied(which)
    setTimeout(() => setCopied(''), 1500)
  }

  if (selected) {
    return <ClientDetail client={selected} trainerId={profile.id} onBack={() => setSelected(null)} />
  }
  if (selectedSquad) {
    return <SquadDetail squad={selectedSquad} clients={clients} onBack={() => setSelectedSquad(null)} />
  }
  if (selectedGroup) {
    return (
      <GroupDetail
        group={selectedGroup} coachId={profile.id} coachName={profile.full_name} clients={clients}
        onBack={() => setSelectedGroup(null)}
        onUpdated={(g) => { setGroups((gs) => gs.map((x) => x.id === g.id ? g : x)); setSelectedGroup(g) }}
        onDeleted={(id) => { setGroups((gs) => gs.filter((x) => x.id !== id)); setSelectedGroup(null) }}
      />
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {THEME.logo ? <img className="mark-img" src={THEME.logo} alt="" /> : <span className="mark-badge">{THEME.mark}</span>}
          <span className="brand-name">{THEME.name}</span>
        </div>
        <button className="link-btn" onClick={() => { try { localStorage.removeItem('cbk_coach_sel'); localStorage.removeItem('cbk_coach_squad'); localStorage.removeItem('cbk_coach_group') } catch { /* ignore */ } onSignOut() }}>Sign out</button>
      </header>

      <main className="screen">
        <p className="eyebrow">Coach dashboard</p>
        <h1 className="h1">Hi {profile.full_name?.split(' ')[0] || 'Coach'}.</h1>

        <div className="card code-card">
          <div>
            <p className="eyebrow">Standard join code</p>
            <p className="code-big">{profile.trainer_code}</p>
            <p className="muted-note">Send this to a standard client — signing up with it links them to you and tags them "standard" automatically.</p>
          </div>
          <button className="btn ghost" onClick={() => copyCode(profile.trainer_code, 'standard')}>{copied === 'standard' ? 'Copied ✓' : 'Copy'}</button>
        </div>

        <div className="card code-card">
          <div>
            <p className="eyebrow">Inner Circle join code</p>
            <p className="code-big">{profile.trainer_code_ic}</p>
            <p className="muted-note">Send this to an Inner Circle client instead — signing up with it sets their membership and "inner circle" tag automatically, so their tagged programmes show up straight away.</p>
          </div>
          <button className="btn ghost" onClick={() => copyCode(profile.trainer_code_ic, 'ic')}>{copied === 'ic' ? 'Copied ✓' : 'Copy'}</button>
        </div>

        {THEME.features?.activityFeed && <CoachActivity profile={profile} clients={clients} onOpenClient={setSelected} />}

        {THEME.features?.activityFeed && <CoachDigestToggle coachId={profile.id} />}

        {THEME.features?.cashflow && <CashflowDashboard />}

        {THEME.features?.briefing && <CoachBriefing profile={profile} clients={clients} />}

        <CoachSection title="Clients" defaultOpen>
          {THEME.features?.booking && <CoachTimetable profile={profile} clients={clients} />}

          <HeroImageSetting profile={profile} />

          {THEME.features?.events && <TodayCelebrations clients={clients} />}

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
        </CoachSection>

        <CoachSection title="Groups & squads">
          {THEME.features?.squads && (
            <SquadList squads={squads} coachId={profile.id} onOpen={setSelectedSquad} onCreated={(s) => setSquads((xs) => [...xs, s])} />
          )}

          {THEME.features?.groups && (
            <GroupsPanel groups={groups} coachId={profile.id} onOpen={setSelectedGroup} onCreated={(g) => setGroups((xs) => [...xs, g])} />
          )}
        </CoachSection>

        <CoachSection title="Content library">
          {THEME.features?.vald && <CoachVald coachId={profile.id} clients={clients} />}

          {THEME.features?.templates && <CoachTemplates coachId={profile.id} />}
          {THEME.features?.programs && <CoachPrograms coachId={profile.id} />}
          {THEME.features?.recipes && <CoachRecipes coachId={profile.id} />}
          {THEME.features?.coachMealPlans && <CoachMealPlans coachId={profile.id} clients={clients} />}
          {THEME.features?.videos && <CoachVideos coachId={profile.id} />}
          {(THEME.features?.supplements || THEME.features?.shop || THEME.features?.podcasts) && <CoachLinks coachId={profile.id} />}
          {THEME.features?.checkinForms && <CheckinFormBuilder coachId={profile.id} />}
          {THEME.features?.files && <CoachFiles coachId={profile.id} />}
        </CoachSection>

        <CoachSection title="Your brand & AI">
          <CoachVoice coachId={profile.id} coachName={profile.full_name} />
          <KimBrain coachId={profile.id} coachName={profile.full_name} />
          <FeaturedContent coachId={profile.id} coachName={profile.full_name} />
        </CoachSection>

        <CoachSection title="Community">
          <div className="stack">
            <p className="eyebrow" style={{ marginTop: 4 }}>Community</p>
            <p className="muted-note" style={{ margin: '0 0 4px' }}>Post announcements and cheer your members’ wins — everyone linked to you sees this.</p>
            <CommunityFeed communityCoachId={profile.id} me={profile.id} myName={profile.full_name} isCoach={true} />
          </div>
        </CoachSection>
      </main>
    </div>
  )
}

// Coach opt-in for the once-a-day activity digest (phone push). Reuses the same
// web-push plumbing as the client reminders.
function CoachDigestToggle({ coachId }) {
  const [status, setStatus] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function refresh() { setStatus(await pushStatus()) }
  useEffect(() => { if (pushSupported()) refresh(); else setStatus('unsupported') }, [])
  async function on() { setBusy(true); setErr(''); try { await enablePush(coachId); await refresh() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  async function off() { setBusy(true); setErr(''); try { await disablePush(); await refresh() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const needsInstall = isIOS() && !isStandalone()
  return (
    <div className="card">
      <p className="eyebrow">Daily summary</p>
      <p className="muted-note">Get one phone notification a day summarising what your clients have been up to.</p>
      {status === 'checking' && <p className="muted-note">Checking…</p>}
      {status === 'unsupported' && <p className="muted-note">This browser can’t do notifications. Try Chrome on Android, or add the app to your Home Screen.</p>}
      {needsInstall && status !== 'unsupported' && <p className="disclaimer-note">On iPhone: add the app to your Home Screen first, open it from there, then turn this on.</p>}
      {status === 'denied' && <p className="error">Notifications are blocked — turn them on for this site in your browser settings, then come back.</p>}
      {status === 'off' && <button className="btn primary" disabled={busy} onClick={on}>{busy ? 'Turning on…' : 'Turn on daily summary'}</button>}
      {status === 'on' && <div className="stack"><p className="logged-ok">Daily summary is on ✓</p><button className="btn ghost sm" disabled={busy} onClick={off}>Turn off</button></div>}
      {err && <p className="error">{err}</p>}
    </div>
  )
}

// Live feed of everything a coach's clients do (Kim's request). Reads the
// coach_activity() RPC (server-side, tenant-filtered). Items newer than the
// coach's last-seen time are highlighted; "Mark all read" advances it. Tap a
// row to open that client.
function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const mn = Math.floor(s / 60); if (mn < 60) return mn + 'm ago'
  const h = Math.floor(mn / 60); if (h < 24) return h + 'h ago'
  return Math.floor(h / 24) + 'd ago'
}
function CoachActivity({ profile, clients, onOpenClient }) {
  const [items, setItems] = useState(null)
  const [seen, setSeen] = useState(profile.activity_seen_at || null)
  // Paul: "clear them from my view after reading, or filter read/unread".
  // Defaults to All so nobody's feed changes shape on load; "Mark all read"
  // then empties the Unread view, which is the tidy-up he's after.
  const [filter, setFilter] = useState('all') // all | unread

  async function load() {
    const { data } = await supabase.rpc('coach_activity', { p_limit: 40 })
    setItems(data || [])
  }
  useEffect(() => { load() }, [])

  const seenT = seen ? new Date(seen).getTime() : 0
  const unread = (items || []).filter((a) => new Date(a.at).getTime() > seenT).length

  async function markRead() {
    setSeen(new Date().toISOString())
    await supabase.rpc('mark_activity_seen')
  }
  const openClient = (id) => { const c = (clients || []).find((x) => x.id === id); if (c) onOpenClient(c) }
  const shown = filter === 'unread'
    ? (items || []).filter((a) => new Date(a.at).getTime() > seenT)
    : (items || [])

  if (items === null) return null
  return (
    <div className="card">
      <div className="nudge-head">
        <b>Client activity{unread > 0 ? ` · ${unread} new` : ''}</b>
        {unread > 0 && <button className="link-btn inline" onClick={markRead}>Mark all read</button>}
      </div>
      <div className="seg small" style={{ marginTop: 8 }}>
        <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        <button type="button" className={filter === 'unread' ? 'on' : ''} onClick={() => setFilter('unread')}>Unread{unread > 0 ? ` · ${unread}` : ''}</button>
      </div>
      {items.length === 0 && <p className="muted-note">No client activity yet — it’ll show here as your clients use the app.</p>}
      {items.length > 0 && shown.length === 0 && <p className="muted-note" style={{ marginTop: 8 }}>All caught up — nothing unread.</p>}
      <div className="stack" style={{ marginTop: 6, gap: 0 }}>
        {shown.map((a, i) => {
          const isNew = new Date(a.at).getTime() > seenT
          const flag = a.kind === 'flag'
          return (
            <button type="button" key={i} className={'act-row' + (isNew ? ' new' : '') + (flag ? ' flag' : '')} onClick={() => openClient(a.client_id)}>
              <span className="act-dot" aria-hidden="true" />
              <span className="act-body"><b>{(a.client_name || 'Client').split(' ')[0]}</b> {a.detail}{flag && <span className="act-flag">Needs attention</span>}</span>
              <span className="act-time">{timeAgo(a.at)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Quick adherence read for a client: sessions completed, days food logged, and how
// recently they checked in / took measurements. Coach reads via is_my_client RLS.
// targets (macro_targets row) is optional — when given, also shows the weekly
// nutrition snapshot Paul asked for: net calories vs weekly target, and weekly
// average protein/carbs/fat/fibre (protein emphasised — it's what he checks first).
function ClientAdherence({ clientId, targets }) {
  const [a, setA] = useState(null)
  useEffect(() => {
    (async () => {
      const now = Date.now()
      const d7 = new Date(now - 7 * 86400000).toISOString().slice(0, 10)
      const iso7 = new Date(now - 7 * 86400000).toISOString()
      const d30 = new Date(now - 30 * 86400000).toISOString().slice(0, 10)
      const useForms = THEME.features?.checkinForms
      const [comp7, comp30, food, ci, meas] = await Promise.all([
        supabase.from('workout_completions').select('completed_on').eq('client_id', clientId).gte('completed_on', d7),
        supabase.from('workout_completions').select('id').eq('client_id', clientId).gte('completed_on', d30),
        supabase.from('nutrition_logs').select('logged_at, calories, protein_g, carbs_g, fat_g, fibre_g').eq('client_id', clientId).gte('logged_at', iso7),
        supabase.from(useForms ? 'checkin_responses' : 'weekly_checkins').select('created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
        supabase.from('body_measurements').select('weight_kg, measured_at').eq('client_id', clientId).order('measured_at', { ascending: false }).limit(30),
      ])
      const byDay = {}
      ;(food.data || []).forEach((r) => {
        const k = (r.logged_at || '').slice(0, 10); if (!k) return
        const d = (byDay[k] = byDay[k] || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 })
        d.calories += Number(r.calories) || 0; d.protein_g += Number(r.protein_g) || 0
        d.carbs_g += Number(r.carbs_g) || 0; d.fat_g += Number(r.fat_g) || 0; d.fibre_g += Number(r.fibre_g) || 0
      })
      const days = Object.keys(byDay)
      // Kim's "add it all up and divide by seven" — total calories over the week
      // averaged across all 7 days (blank days count as zero, as she asked). Net
      // uses the same convention: real weekly intake vs the full weekly target.
      const totalCal = Object.values(byDay).reduce((s, d) => s + d.calories, 0)
      const avgCal = Math.round(totalCal / 7)
      // Macro averages are per LOGGED day instead — a day they forgot to log
      // shouldn't drag "what does their protein intake look like" toward zero.
      const macroAvg = days.length ? {
        protein_g: Math.round(days.reduce((s, k) => s + byDay[k].protein_g, 0) / days.length),
        carbs_g: Math.round(days.reduce((s, k) => s + byDay[k].carbs_g, 0) / days.length),
        fat_g: Math.round(days.reduce((s, k) => s + byDay[k].fat_g, 0) / days.length),
        fibre_g: Math.round(days.reduce((s, k) => s + byDay[k].fibre_g, 0) / days.length),
      } : null
      // Lowest bodyweight of the week — only from weigh-ins in the last 7 days.
      const wk = (meas.data || []).filter((r) => r.measured_at && r.measured_at >= d7 && r.weight_kg != null)
      const lowW = wk.length ? Math.min(...wk.map((r) => Number(r.weight_kg))) : null
      setA({
        s7: (comp7.data || []).length, s30: (comp30.data || []).length, foodDays: days.length,
        lastCi: ci.data?.[0]?.created_at || null, lastMeas: meas.data?.[0]?.measured_at || null,
        avgCal, totalCal, macroAvg, foodLogged: (food.data || []).length > 0, lowW,
      })
    })()
  }, [clientId])
  const ago = (d) => {
    if (!d) return 'None yet'
    const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
    return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n}d ago`
  }
  if (!a) return null
  const netCal = targets?.calories ? a.totalCal - targets.calories * 7 : null
  return (
    <div className="card">
      <p className="eyebrow">Adherence · last 7 days</p>
      <div className="metrics-2" style={{ marginTop: 8 }}>
        <Metric k="Sessions done" v={String(a.s7)} d={`${a.s30} in 30d`} />
        <Metric k="Days food logged" v={`${a.foodDays} / 7`} />
        <Metric k="Avg calories / day" v={a.foodLogged ? `${a.avgCal}` : '—'} d="week total ÷ 7" />
        <Metric k="Lowest weight (7d)" v={a.lowW != null ? `${a.lowW} kg` : '—'} />
        <Metric k="Last check-in" v={ago(a.lastCi)} />
        <Metric k="Last measurement" v={ago(a.lastMeas)} />
      </div>
      {a.macroAvg && (
        <div className="week-snapshot">
          <p className="eyebrow" style={{ marginTop: 14 }}>This week’s nutrition</p>
          {netCal != null && (
            <p className="muted-note" style={{ marginTop: 4 }}>
              Net <b className={netCal > 0 ? 'over' : 'under'}>{netCal > 0 ? '+' : ''}{netCal} kcal</b> vs weekly target ({targets.calories} × 7)
            </p>
          )}
          <div className="metrics-2" style={{ marginTop: 8 }}>
            <Metric k="Protein / day" v={`${a.macroAvg.protein_g}g`} d={targets?.protein_g ? `target ${targets.protein_g}g` : ''} emphasize />
            <Metric k="Fibre / day" v={`${a.macroAvg.fibre_g}g`} d={targets?.fibre_g ? `target ${targets.fibre_g}g` : ''} />
            <Metric k="Carbs / day" v={`${a.macroAvg.carbs_g}g`} d={targets?.carbs_g ? `target ${targets.carbs_g}g` : ''} />
            <Metric k="Fat / day" v={`${a.macroAvg.fat_g}g`} d={targets?.fat_g ? `target ${targets.fat_g}g` : ''} />
          </div>
        </div>
      )}
    </div>
  )
}

// Coach control for recovery-aware nutrition. Flags a client who has struggled
// with disordered eating (+ what they find hard) so the whole nutrition AI turns
// gentle and never pushes restriction. Sensitive — worded with care.
function NutritionSupport({ client }) {
  const [on, setOn] = useState(!!client.nutrition_sensitive)
  const [note, setNote] = useState(client.nutrition_sensitive_note || '')
  const [saved, setSaved] = useState(false)
  const first = (client.full_name || 'this client').split(' ')[0]
  async function save() {
    const { error } = await supabase.rpc('set_nutrition_support', { p_client: client.id, p_on: on, p_note: note.trim() || null })
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }
  return (
    <div className="card">
      <p className="eyebrow">Nutrition support</p>
      <p className="muted-note">For clients who’ve struggled with disordered eating. Turn this on and the whole nutrition side — meal ideas, the AI coach, scans — becomes gentle: it never suggests cutting calories, restricting or losing weight, and it supports eating enough. Private to you and {first}.</p>
      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} style={{ width: 'auto' }} />
        {first} has struggled with disordered eating
      </label>
      {on && (
        <label className="field" style={{ marginTop: 8 }}>What do they find hardest? (optional — guides the AI)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. increasing calories, fear foods, eating regularly" />
        </label>
      )}
      <button className="btn primary" style={{ marginTop: 10 }} onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
    </div>
  )
}

// Coach control for health conditions (PCOS, menopause, thyroid, PoTS etc) +
// life circumstances (kids/single parent/shift work). Clients can also set
// this themselves from Home > My details — either side can flag it. Feeds AI
// tone only (see healthLine() in analyse.mjs) — never changes calorie maths.
function ClientHealthContext({ client }) {
  const [conditions, setConditions] = useState(client.health_conditions || '')
  const [hasKids, setHasKids] = useState(!!client.has_kids)
  const [singleParent, setSingleParent] = useState(!!client.single_parent)
  const [shiftWorker, setShiftWorker] = useState(!!client.shift_worker)
  const [note, setNote] = useState(client.life_context_note || '')
  const [saved, setSaved] = useState(false)
  const first = (client.full_name || 'this client').split(' ')[0]
  async function save() {
    const { error } = await supabase.rpc('set_client_health_context', {
      p_client: client.id, p_conditions: conditions.trim() || null, p_has_kids: hasKids,
      p_single_parent: singleParent, p_shift_worker: shiftWorker, p_life_note: note.trim() || null,
    })
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }
  return (
    <div className="card">
      <p className="eyebrow">Health &amp; circumstances</p>
      <p className="muted-note">Optional context that shapes AI tone and suggestions — never changes {first}’s calorie/macro targets. {first} can also set this themselves from Home &gt; My details.</p>
      <label className="field" style={{ marginTop: 8 }}>Health conditions
        <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. PCOS, menopause, thyroid, PoTS" />
      </label>
      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <input type="checkbox" checked={hasKids} onChange={(e) => setHasKids(e.target.checked)} style={{ width: 'auto' }} />
        Has kids
      </label>
      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <input type="checkbox" checked={singleParent} onChange={(e) => setSingleParent(e.target.checked)} style={{ width: 'auto' }} />
        Single parent
      </label>
      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <input type="checkbox" checked={shiftWorker} onChange={(e) => setShiftWorker(e.target.checked)} style={{ width: 'auto' }} />
        Works shifts
      </label>
      <label className="field" style={{ marginTop: 8 }}>Anything else?
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. travel a lot for work, caring responsibilities" />
      </label>
      <button className="btn primary" style={{ marginTop: 10 }} onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
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
  // Macro rule (Paul): fat <= 25% of calories, protein 2.0 g/kg bodyweight, carbs
  // fill the rest. One tap snaps the targets to it; the readout flags breaches.
  const bw = latest?.weight_kg ? Number(latest.weight_kg) : null
  const r5 = (n) => Math.max(0, Math.round(n / 5) * 5)
  function applyMacroRule() {
    const cal = Number(targets?.calories) || 0
    if (!cal || !bw) return
    const protein_g = r5(2.0 * bw)
    const fat_g = r5((cal * 0.25) / 9)
    const carbs_g = r5((cal - protein_g * 4 - fat_g * 9) / 4)
    setTargets((s) => ({ ...s, protein_g, carbs_g, fat_g }))
  }
  const fatPct = targets?.calories ? Math.round(((targets.fat_g * 9) / targets.calories) * 100) : null
  const protPerKg = bw && targets?.protein_g ? (targets.protein_g / bw) : null

  return (
    <div className="app">
      <header className="topbar">
        <button className="link-btn" onClick={onBack}>‹ Clients</button>
        <span className="brand-name">{client.full_name}</span>
        <button className="link-btn inline" onClick={() => printClientReport(client)}>Report</button>
      </header>
      <main className="screen">
        {loading ? <p className="muted-note">Loading…</p> : (
          <div className="stack">
            <ClientAdherence clientId={client.id} targets={targets} />

            <CoachSection title="Profile">
              {THEME.features?.parq && <ParqReview clientId={client.id} />}

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

              {THEME.features?.events && <ClientDob client={client} />}

              {THEME.features?.events && <ClientEventsCoach clientId={client.id} coachId={trainerId} />}

              {THEME.features?.cycle && <CoachCycle clientId={client.id} />}
            </CoachSection>

            <CoachSection title="Schedule">
              {THEME.features?.agenda && <WeekPlanner clientId={client.id} coachId={trainerId} />}

              {THEME.features?.agenda && <WeeklySchedule clientId={client.id} coachId={trainerId} />}

              {THEME.features?.agenda && <ClientReminders clientId={client.id} coachId={trainerId} />}

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
            </CoachSection>

            <CoachSection title="Nutrition">
              <div className="card">
                <p className="eyebrow accent">Today’s intake</p>
                <MacroRowSmall m={today} target={targets} />
              </div>

              {THEME.features?.nutritionSupport && <NutritionSupport client={client} />}
              {THEME.features?.nutritionSupport && <ClientHealthContext client={client} />}

              {THEME.features?.coachMealPlans && <ClientMealPlanPanel clientId={client.id} coachId={trainerId} />}

              <div className="card">
                <p className="eyebrow">Set macro targets</p>
                <div className="grid-2">
                  <label className="field">Calories<input type="number" value={targets.calories} onChange={set('calories')} /></label>
                  <label className="field">Protein (g)<input type="number" value={targets.protein_g} onChange={set('protein_g')} /></label>
                  <label className="field">Carbs (g)<input type="number" value={targets.carbs_g} onChange={set('carbs_g')} /></label>
                  <label className="field">Fat (g)<input type="number" value={targets.fat_g} onChange={set('fat_g')} /></label>
                </div>
                {(fatPct != null || protPerKg != null) && (
                  <p className="muted-note" style={{ marginTop: 4 }}>
                    {fatPct != null && <span style={{ color: fatPct > 25 ? 'var(--gold, #e0a83d)' : 'var(--muted)' }}>Fat {fatPct}% of calories{fatPct > 25 ? ' — over the 25% cap' : ''}</span>}
                    {protPerKg != null && <span style={{ color: (protPerKg < 1.5 || protPerKg > 2.2) ? 'var(--gold, #e0a83d)' : 'var(--muted)' }}>{'  ·  '}Protein {protPerKg.toFixed(1)} g/kg{(protPerKg < 1.5 || protPerKg > 2.2) ? ' — outside 1.5–2.2' : ''}</span>}
                  </p>
                )}
                <div className="nudge-actions">
                  <button className="btn primary sm" onClick={saveTargets}>{saved ? 'Saved ✓' : 'Save targets'}</button>
                  {bw && <button type="button" className="btn ghost sm" onClick={applyMacroRule} title="Protein 2g/kg, fat 25% of calories, carbs fill the rest">Apply the rule</button>}
                </div>
                {!bw && <p className="muted-note" style={{ marginTop: 6 }}>Add a bodyweight in their measurements to auto-apply the protein rule.</p>}
              </div>
            </CoachSection>

            <CoachSection title="Training">
              <AssignWorkout clientId={client.id} trainerId={trainerId} onAssigned={(p) => setPlans((pl) => [p, ...pl])} />

              {THEME.features?.programs && <CoachPrograms coachId={trainerId} clientId={client.id} clientName={client.full_name} />}

              {THEME.features?.programs && <AssignProgram clientId={client.id} coachId={trainerId} clientName={client.full_name} />}

              {THEME.features?.programs && <ApplyProgramSchedule clientId={client.id} coachId={trainerId} />}

              <div className="card">
                <p className="eyebrow">Messages</p>
                <MessageThread clientId={client.id} me="coach" placeholder={`Reply to ${(client.full_name || 'your client').split(' ')[0]}…`} />
              </div>
            </CoachSection>

            <CoachSection title="Testing & monitoring">
              {THEME.features?.monitoring && <CoachMonitoring clientId={client.id} />}

              {THEME.features?.vald && <ValdTests clientId={client.id} />}

              {THEME.features?.rehab && <RehabCoach clientId={client.id} coachId={trainerId} />}

              {THEME.features?.growth && <CoachGrowth clientId={client.id} />}

              {THEME.features?.testing && <CoachPerformanceTests clientId={client.id} />}
            </CoachSection>

            <CoachSection title="Check-ins">
              {THEME.features?.checkinForms ? <CoachCheckinResponses clientId={client.id} /> : <CoachCheckins clientId={client.id} />}

              <CoachAccountability clientId={client.id} clientName={client.full_name} />
            </CoachSection>

            <CoachSection title="Progress & diary">
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

              <FoodDiary clientId={client.id} coachId={trainerId} contributorId={trainerId} title="Food diary" />

              <LiftProgress plans={plans} clientId={client.id} canAdd title="Weights lifted" />

              <div className="card">
                <p className="eyebrow">Their sessions</p>
                <p className="muted-note">Tap a session to see the exercises, sets, reps and weights they’ve logged.</p>
                {plans.length === 0 && <p className="muted-note">No sessions yet.</p>}
                {plans.map((p) => <CoachSessionCard key={p.id} plan={p} trainerId={trainerId} onUpdated={(np) => setPlans((pl) => pl.map((x) => (x.id === np.id ? np : x)))} />)}
              </div>
            </CoachSection>
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
    await supabase.from('coach_personas').upsert({ coach_id: coachId, display_name: p.display_name, audience: p.audience, philosophy: p.philosophy, tone: p.tone, welcome: p.welcome || null, updated_at: new Date().toISOString() })
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
          <label className="field">Welcome message<textarea value={p.welcome || ''} onChange={set('welcome')} placeholder="Auto-sent to each new client's chat when they join — welcome them and point them to their next steps." /></label>
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
  const [running, setRunning] = useState(false)

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

  if (running) {
    return (
      <SquadSession
        squad={squad}
        members={members.map((m) => ({ client_id: m.client_id, name: nameOf(m.client_id) }))}
        coachId={squad.coach_id}
        onExit={() => { setRunning(false); loadMembers() }}
      />
    )
  }

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

          {THEME.features?.squadMode && (
            <div className="card">
              <p className="eyebrow">Live weight-room</p>
              <p className="muted-note">Run the whole squad through one session on a tablet on the gym floor — weights pre-seeded from each athlete's last lift.</p>
              <button className="btn primary" disabled={members.length === 0} onClick={() => setRunning(true)}>Run session</button>
            </div>
          )}

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
  const [soreness, setSoreness] = useState([])
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('readiness_checkins').select('*').eq('client_id', clientId).order('checked_on', { ascending: true }).limit(60).then(({ data }) => setCheckins(data || []))
    supabase.from('session_loads').select('*').eq('client_id', clientId).order('session_on', { ascending: true }).limit(120).then(({ data }) => setLoads(data || []))
    supabase.from('soreness_logs').select('pain').eq('client_id', clientId).eq('logged_on', today).then(({ data }) => setSoreness(data || []))
  }, [])
  if (checkins.length === 0 && loads.length === 0 && soreness.length === 0) return null
  const latest = checkins[checkins.length - 1]
  const score = readinessScore(latest)
  const light = combinedReadiness(readinessLight(score), soreness)
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

// Coach review of dynamic check-in responses — each rendered against its own
// field snapshot, so old responses read correctly after the form is edited.
function CoachCheckinResponses({ clientId }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    supabase.from('checkin_responses').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => setItems(data || []))
  }, [])
  if (items.length === 0) return null
  return (
    <div className="card">
      <p className="eyebrow">Weekly check-ins</p>
      {items.map((c) => <CoachResponseRow key={c.id} c={c} onReplied={(reply) => setItems((xs) => xs.map((x) => x.id === c.id ? { ...x, coach_reply: reply } : x))} />)}
    </div>
  )
}

function CoachResponseRow({ c, onReplied }) {
  const [reply, setReply] = useState(c.coach_reply || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  async function send() {
    if (!reply.trim()) return
    setSaving(true)
    const { error } = await supabase.from('checkin_responses').update({ coach_reply: reply.trim() }).eq('id', c.id)
    setSaving(false)
    if (!error) { setDone(true); onReplied(reply.trim()); setTimeout(() => setDone(false), 1200) }
  }
  return (
    <div className="fc-block">
      <b>Check-in · {(c.created_at || '').slice(0, 10)}</b>
      {(c.fields || []).map((f) => <p className="checkin-line" key={f.id}><b>{f.label}:</b> {formatAnswer(f, c.answers?.[f.id])}</p>)}
      <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to this check-in…" />
      <button className="btn primary sm" disabled={saving} onClick={send}>{done ? 'Sent ✓' : saving ? 'Sending…' : 'Send reply'}</button>
    </div>
  )
}

// Coach-side check-in form builder: create a form, load Paul's template, add /
// remove / label fields. Clients answer the most recently created form.
function CheckinFormBuilder({ coachId }) {
  const [forms, setForms] = useState([])
  const [editing, setEditing] = useState(null) // { id?, title, fields }
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('checkin_forms').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
    setForms(data || [])
  }
  useEffect(() => { load() }, [])

  const startNew = () => { setEditing({ title: 'Weekly check-in', fields: paulTemplate() }); setError('') }
  const startBlank = () => { setEditing({ title: 'Weekly check-in', fields: [newField('scale10', '')] }); setError('') }
  const editForm = (f) => setEditing({ id: f.id, title: f.title, fields: (f.fields || []).map((x) => ({ ...x })) })

  const setField = (i, k, v) => setEditing((e) => ({ ...e, fields: e.fields.map((f, j) => j === i ? { ...f, [k]: v } : f) }))
  const addField = () => setEditing((e) => ({ ...e, fields: [...e.fields, newField('scale10', '')] }))
  const removeField = (i) => setEditing((e) => ({ ...e, fields: e.fields.filter((_, j) => j !== i) }))

  async function save() {
    const fields = editing.fields.filter((f) => (f.label || '').trim()).map((f) => ({ ...f, label: f.label.trim() }))
    if (fields.length === 0) { setError('Add at least one labelled question.'); return }
    const row = { coach_id: coachId, title: editing.title.trim() || 'Weekly check-in', fields }
    const res = editing.id
      ? await supabase.from('checkin_forms').update(row).eq('id', editing.id).select().single()
      : await supabase.from('checkin_forms').insert(row).select().single()
    if (res.error) { setError(res.error.message); return }
    await load(); setEditing(null); setError('')
  }
  async function del(id) {
    await supabase.from('checkin_forms').delete().eq('id', id)
    setForms((fs) => fs.filter((f) => f.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Check-in forms</p>
      <p className="muted-note">Build the weekly check-in your clients fill in. Clients answer your most recent form.</p>

      {!editing && (
        <>
          {forms.length > 0 && (
            <div className="stack" style={{ marginTop: 12 }}>
              {forms.map((f, idx) => (
                <div className="card" key={f.id} style={{ background: 'var(--surface-2)' }}>
                  <div className="session-title">{f.title}{idx === 0 ? ' · live' : ''}</div>
                  <div className="session-sub">{(f.fields || []).length} question{(f.fields || []).length === 1 ? '' : 's'}</div>
                  <div className="nudge-actions" style={{ marginTop: 8 }}>
                    <button type="button" className="btn ghost sm" onClick={() => editForm(f)}>Edit</button>
                    <button type="button" className="btn ghost sm" onClick={() => del(f.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="nudge-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn primary" onClick={startNew}>Use my template</button>
            <button type="button" className="btn ghost" onClick={startBlank}>Start blank</button>
          </div>
        </>
      )}

      {editing && (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">Form name<input value={editing.title} onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))} /></label>
          {editing.fields.map((f, i) => (
            <div className="card" key={f.id} style={{ background: 'var(--surface-2)' }}>
              <input className="ex-name-in" placeholder="Question" value={f.label} onChange={(e) => setField(i, 'label', e.target.value)} />
              <div className="ex-settype">
                <select className="ex-select" value={f.type} onChange={(e) => setField(i, 'type', e.target.value)}>
                  {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
                <button type="button" className="row-del" onClick={() => removeField(i)} aria-label="Remove question">×</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={addField}>+ Add question</button>
          {error && <p className="error">{error}</p>}
          <div className="nudge-actions">
            <button className="btn primary big" onClick={save}>Save form</button>
            <button type="button" className="link-btn" onClick={() => { setEditing(null); setError('') }}>Cancel</button>
          </div>
        </div>
      )}
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
      <b>{scan.pose ? scan.pose[0].toUpperCase() + scan.pose.slice(1) : 'Scan'} · {(scan.created_at || '').slice(0, 10)}</b>
      {url ? <div className="shot"><img src={url} alt="Progress scan" /></div> : <p className="muted-note">Loading photo…</p>}
      {scan.summary && <p>{scan.summary}</p>}
    </div>
  )
}

// Expandable session card so Kim can review the full workout a client built or
// that she assigned — every exercise, sets × reps, weight and cue.
function CoachSessionCard({ plan, trainerId, onUpdated }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
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
      {open && !editing && (
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
          {mine && <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>Edit workout</button>}
        </ol>
      )}
      {open && editing && (
        <WorkoutEditForm
          initial={{ title: plan.title, focus: plan.focus, exercises: exs }}
          onCancel={() => setEditing(false)}
          onSave={async ({ title, focus, exercises }) => {
            const { data, error } = await supabase.from('workout_plans')
              .update({ title: title || 'Assigned session', focus: focus || 'Coach plan', exercises })
              .eq('id', plan.id).select().single()
            if (error) throw error
            onUpdated(data); setEditing(false)
          }}
        />
      )}
    </div>
  )
}

// Coach-published recipes. Clients browse them and can log one straight to their
// day. Macros are per serving. Mirrors the templates RLS pattern.
function CoachRecipes({ coachId }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', description: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fibre_g: '', serving_label: '', tags: '' })
  const [imgFile, setImgFile] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('recipes').select('*').eq('coach_id', coachId).order('created_at', { ascending: false })
    setItems(data || [])
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  // Upload a recipe photo to the public content-images bucket, return its path.
  async function uploadRecipeImage(file) {
    const blob = await scaleImageToBlob(file, 1000)
    const path = `recipes/${coachId}/${crypto.randomUUID()}.jpg`
    const up = await supabase.storage.from('content-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    return up.error ? null : path
  }
  const imgUrl = (p) => p ? supabase.storage.from('content-images').getPublicUrl(p).data.publicUrl : null
  // Add / change a photo on an existing recipe (covers AI-generated ones too).
  async function setPhoto(id, file) {
    const path = await uploadRecipeImage(file)
    if (!path) return
    const { data } = await supabase.from('recipes').update({ image_path: path }).eq('id', id).select().single()
    if (data) setItems((i) => i.map((x) => (x.id === id ? data : x)))
  }

  async function save() {
    if (!f.title.trim()) { setError('Give the recipe a name.'); return }
    const image_path = imgFile ? await uploadRecipeImage(imgFile) : null
    const row = {
      coach_id: coachId, title: f.title.trim(), description: f.description.trim() || null,
      calories: Number(f.calories) || null, protein_g: Number(f.protein_g) || null,
      carbs_g: Number(f.carbs_g) || null, fat_g: Number(f.fat_g) || null, fibre_g: Number(f.fibre_g) || null,
      serving_label: f.serving_label.trim() || 'per serving',
      tags: f.tags.trim() ? f.tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
      image_path,
    }
    const { data, error: err } = await supabase.from('recipes').insert(row).select().single()
    if (err) { setError(err.message); return }
    setItems((i) => [data, ...i])
    setF({ title: '', description: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fibre_g: '', serving_label: '', tags: '' })
    setImgFile(null); setOpen(false); setError('')
  }
  async function del(id) {
    await supabase.from('recipes').delete().eq('id', id)
    setItems((i) => i.filter((x) => x.id !== id))
  }

  // AI batch generator — draft a library fast, keep the ones you like.
  const [genCat, setGenCat] = useState('High-protein breakfasts')
  const [genCount, setGenCount] = useState(6)
  const [genBusy, setGenBusy] = useState(false)
  const [gen, setGen] = useState(null) // { recipes, sel:Set }
  const [genErr, setGenErr] = useState('')
  async function generate() {
    setGenBusy(true); setGenErr('')
    try {
      const res = await fetch('/.netlify/functions/recipe-generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: genCat, count: genCount }) })
      const j = await res.json()
      if (!j.recipes?.length) { setGenErr(j.error || 'Nothing came back — try again.') }
      else setGen({ recipes: j.recipes, sel: new Set(j.recipes.map((_, i) => i)) })
    } catch (e) { setGenErr(String(e.message || e)) }
    setGenBusy(false)
  }
  const toggleSel = (i) => setGen((g) => { const s = new Set(g.sel); s.has(i) ? s.delete(i) : s.add(i); return { ...g, sel: s } })
  async function saveSelected() {
    const chosen = gen.recipes.filter((_, i) => gen.sel.has(i))
    const rows = chosen.map((r) => ({
      coach_id: coachId, title: r.title, description: r.method || null, ingredients: r.ingredients || [],
      servings: r.servings, calories: r.calories, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, fibre_g: r.fibre_g,
      serving_label: 'per serving',
      // AI-suggested filter tags (high-protein, lunch, …) plus the category, deduped.
      tags: Array.from(new Set([...(Array.isArray(r.tags) ? r.tags : []), genCat.toLowerCase()].map((t) => String(t).toLowerCase().trim()).filter(Boolean))),
    }))
    const { data } = await supabase.from('recipes').insert(rows).select()
    setItems((i) => [...(data || []), ...i]); setGen(null)
  }

  return (
    <div className="card">
      <p className="eyebrow">Recipe library</p>
      <p className="muted-note">Save go-to meals with their macros — clients browse them and log one straight to their day.</p>

      {items.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {items.map((r) => (
            <div className="card" key={r.id} style={{ background: 'var(--surface-2)' }}>
              {r.image_path && <div className="shot" style={{ marginBottom: 8 }}><img src={imgUrl(r.image_path)} alt={r.title} /></div>}
              <div className="session-title">{r.title}</div>
              <div className="session-sub">{[r.calories ? r.calories + ' kcal' : null, r.protein_g ? r.protein_g + 'g P' : null, r.serving_label].filter(Boolean).join(' · ')}</div>
              {r.description && <p className="muted-note" style={{ marginTop: 6 }}>{r.description}</p>}
              <div className="nudge-actions" style={{ marginTop: 8 }}>
                <label className="btn ghost sm" style={{ cursor: 'pointer' }}>{r.image_path ? 'Change photo' : 'Add photo'}
                  <input type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) setPhoto(r.id, file) }} />
                </label>
                <button type="button" className="btn ghost sm" onClick={() => del(r.id)}>Delete</button>
              </div>
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
          <label className="field">Photo (optional)<input type="file" accept="image/*" onChange={(e) => setImgFile(e.target.files?.[0] || null)} />{imgFile && <span className="muted-note">{imgFile.name}</span>}</label>
          <div className="grid-2">
            <label className="field">Calories<input type="number" value={f.calories} onChange={set('calories')} placeholder="kcal" /></label>
            <label className="field">Protein (g)<input type="number" value={f.protein_g} onChange={set('protein_g')} /></label>
            <label className="field">Carbs (g)<input type="number" value={f.carbs_g} onChange={set('carbs_g')} /></label>
            <label className="field">Fat (g)<input type="number" value={f.fat_g} onChange={set('fat_g')} /></label>
            <label className="field">Fibre (g)<input type="number" value={f.fibre_g} onChange={set('fibre_g')} /></label>
          </div>
          <div className="grid-2">
            <label className="field">Serving<input value={f.serving_label} onChange={set('serving_label')} placeholder="per serving" /></label>
            <label className="field">Tags<input value={f.tags} onChange={set('tags')} placeholder="breakfast, high-protein" /></label>
          </div>
          <button className="btn primary big" onClick={save}>Save recipe</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}

      <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <p className="eyebrow accent">Generate with AI</p>
        <p className="muted-note">Build a recipe library fast — the AI drafts a batch with macros; keep the ones you like. They're yours.</p>
        {!gen ? (
          <div className="stack" style={{ marginTop: 8 }}>
            <label className="field">Category<input value={genCat} onChange={(e) => setGenCat(e.target.value)} placeholder="e.g. High-protein breakfasts" /></label>
            <div className="serving-chips">
              {['High-protein breakfasts', 'Quick lunches', 'Low-carb dinners', 'Post-workout meals', 'Healthy snacks', 'Vegetarian mains'].map((c) => (
                <button type="button" key={c} className={genCat === c ? 'on' : ''} onClick={() => setGenCat(c)}>{c}</button>
              ))}
            </div>
            <label className="field">How many (max 8)<input type="number" inputMode="numeric" value={genCount} onChange={(e) => setGenCount(e.target.value)} /></label>
            {genErr && <p className="error">{genErr}</p>}
            <button className="btn primary" disabled={genBusy} onClick={generate}>{genBusy ? 'Generating…' : 'Generate recipes'}</button>
          </div>
        ) : (
          <div className="stack" style={{ marginTop: 8 }}>
            <p className="muted-note">{gen.sel.size} of {gen.recipes.length} selected</p>
            {gen.recipes.map((r, i) => (
              <label className="card" key={i} style={{ background: 'var(--surface-2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={gen.sel.has(i)} onChange={() => toggleSel(i)} style={{ marginTop: 4 }} />
                <div><div className="session-title">{r.title}</div><div className="session-sub">{r.calories} kcal · {r.protein_g}g P · {r.carbs_g}g C · {r.fat_g}g F · {r.servings} serving{r.servings === 1 ? '' : 's'}</div></div>
              </label>
            ))}
            <button className="btn primary big" disabled={!gen.sel.size} onClick={saveSelected}>Save {gen.sel.size} to library</button>
            <button type="button" className="link-btn" onClick={() => setGen(null)}>Discard</button>
          </div>
        )}
      </div>
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
  const [f, setF] = useState({ kind: 'supplement', label: '', url: '', note: '', image_url: '' })
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
      coach_id: coachId, kind: f.kind, label: f.label.trim(), url: f.url.trim(), note: f.note.trim() || null, image_url: f.image_url.trim() || null,
    }).select().single()
    if (err) { setError(err.message); return }
    setItems((i) => [...i, data])
    setF({ kind: f.kind, label: '', url: '', note: '', image_url: '' }); setOpen(false); setError('')
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
          <label className="field">Image URL (optional)<input value={f.image_url} onChange={set('image_url')} placeholder="Paste a product image link to show a thumbnail" /></label>
          <button className="btn primary big" onClick={save}>Save link</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// Custom per-client reminders — the coach writes the message and the time; the
// client gets a phone notification at that time and a task on their daily plan.
const REMINDER_KINDS = [
  { key: 'nudge', label: 'Just a reminder' },
  { key: 'reply', label: 'Reply to me' },
  { key: 'evidence', label: 'Send me evidence' },
]
function ClientReminders({ clientId, coachId }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ message: '', at_time: '20:00', kind: 'nudge' })
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('client_reminders').select('*').eq('client_id', clientId).order('at_time', { ascending: true })
    setItems(data || [])
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const kindLabel = (k) => (REMINDER_KINDS.find((x) => x.key === k) || {}).label || k

  async function save() {
    if (!f.message.trim()) { setError('Write the reminder message.'); return }
    if (!f.at_time) { setError('Pick a time.'); return }
    const { data, error: err } = await supabase.from('client_reminders').insert({ coach_id: coachId, client_id: clientId, message: f.message.trim(), at_time: f.at_time, kind: f.kind }).select().single()
    if (err) { setError(err.message); return }
    setItems((i) => [...i, data].sort((a, b) => a.at_time.localeCompare(b.at_time)))
    setF({ message: '', at_time: '20:00', kind: 'nudge' }); setOpen(false); setError('')
  }
  async function del(id) {
    await supabase.from('client_reminders').delete().eq('id', id)
    setItems((i) => i.filter((x) => x.id !== id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Reminders</p>
      <p className="muted-note">Personal reminders for {(clientId ? 'this client' : 'them')} — your words, your time. They get a phone notification and it shows on their daily plan.</p>
      {items.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {items.map((r) => (
            <div className="card" key={r.id} style={{ background: 'var(--surface-2)' }}>
              <div className="session-title">{r.message}</div>
              <div className="session-sub">{(r.at_time || '').slice(0, 5)} · {kindLabel(r.kind)}</div>
              <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => del(r.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {!open ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setOpen(true); setError('') }}>Add reminder</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">Message<textarea value={f.message} onChange={set('message')} placeholder="e.g. Message me 3 positives from today" /></label>
          <div className="grid-2">
            <label className="field">Time<input type="time" value={f.at_time} onChange={set('at_time')} /></label>
            <label className="field">Type
              <select value={f.kind} onChange={set('kind')}>
                {REMINDER_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </label>
          </div>
          <button className="btn primary big" onClick={save}>Save reminder</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// Per-client weekly training schedule: assign a session template to each weekday.
// The client's daily agenda names that day's session and starts it. dow uses JS
// getDay() (0=Sun..6=Sat); rendered Mon-first.
const SCHED_DOW = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']]
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Default training days for an N-day week, spread Mon-outwards (0=Sun..6=Sat).
// Used when the AI builder expands a base week across the whole programme; the
// coach can drag any session to a different day per week afterwards (shift work).
const DOW_SPREAD = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] }
const daySpread = (n) => DOW_SPREAD[Math.min(Math.max(n, 1), 6)] || DOW_SPREAD[3]
// Progressive overload applied when a base week is cloned across a programme:
// RPE ramps up through each 4-week block, then every 4th week is a deload
// (a set dropped, RPE eased back). Reps/exercise selection are left untouched.
function progressExercises(list, week, deload) {
  const blockWk = (week - 1) % 4 // 0..3 within the current 4-week block
  return (list || []).map((e) => {
    const sets = e.sets || 3
    const out = { name: e.name, sets, reps: e.reps }
    if (deload) {
      out.sets = Math.max(2, sets - 1)
      if (e.rpe) out.rpe = Math.max(6, e.rpe - 2)
    } else if (e.rpe) {
      out.rpe = Math.min(10, e.rpe + blockWk)
    }
    return out
  })
}
const CLIENT_TASK_KINDS = [
  ['checkin', 'Check-in form'],
  ['measurements', 'Measurements'],
  ['weight', 'Weight'],
  ['photos', 'Progress photos'],
  ['payment', 'Payment due'],
]
const TASK_CADENCES = [['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly']]
const TASK_SHORT = { checkin: 'Check-in', measurements: 'Measurements', weight: 'Weight', photos: 'Photos', payment: 'Payment' }
// Does a recurring task land on this date? Mirrors the client's taskDueToday.
function taskLandsOn(task, date) {
  if (date.getDay() !== task.dow) return false
  if (task.cadence === 'monthly') return date.getDate() <= 7
  if (task.cadence === 'fortnightly') {
    const wk = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2024, 0, 1)) / (7 * 86400000))
    return wk % 2 === 0
  }
  return true
}
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function mondayOf(weekOffset) {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + weekOffset * 7)
  return d
}

// Visual week calendar: what each day holds — the scheduled session, any one-off
// assigned workouts, and the reminders (photos/measurements/payment…) that land
// that day. Read-only overview; Kim edits days in the Weekly schedule below.
function WeekPlanner({ clientId, coachId }) {
  const [offset, setOffset] = useState(0)
  const [templates, setTemplates] = useState({})   // id -> title
  const [schedule, setSchedule] = useState({})      // dow -> template_id
  const [tasks, setTasks] = useState([])
  const [plans, setPlans] = useState([])            // one-off assigned workouts in the week

  const monday = mondayOf(offset)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  const weekStart = ymdLocal(days[0]); const weekEnd = ymdLocal(days[6])

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: s }, { data: ct }, { data: wp }] = await Promise.all([
        supabase.from('workout_templates').select('id, title').eq('coach_id', coachId),
        supabase.from('client_schedule').select('dow, template_id').eq('client_id', clientId),
        supabase.from('client_tasks').select('kind, dow, cadence').eq('client_id', clientId),
        supabase.from('workout_plans').select('title, scheduled_for').eq('client_id', clientId).gte('scheduled_for', weekStart).lte('scheduled_for', weekEnd),
      ])
      const tm = {}; (t || []).forEach((r) => { tm[r.id] = r.title }); setTemplates(tm)
      const sm = {}; (s || []).forEach((r) => { sm[r.dow] = r.template_id }); setSchedule(sm)
      setTasks(ct || []); setPlans(wp || [])
    })()
  }, [clientId, coachId, offset]) // eslint-disable-line

  const monthLabel = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  const todayIso = ymdLocal(new Date())

  return (
    <div className="card">
      <div className="nudge-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="eyebrow" style={{ margin: 0 }}>Week planner</p>
        <div className="nudge-actions" style={{ gap: 6 }}>
          <button type="button" className="btn ghost sm" onClick={() => setOffset((o) => o - 1)}>‹</button>
          <button type="button" className="btn ghost sm" onClick={() => setOffset(0)}>{offset === 0 ? 'This week' : monthLabel}</button>
          <button type="button" className="btn ghost sm" onClick={() => setOffset((o) => o + 1)}>›</button>
        </div>
      </div>
      <p className="muted-note" style={{ marginBottom: 8 }}>Their week at a glance — sessions and reminders. Set days in the Weekly schedule below.</p>
      <div className="stack" style={{ marginTop: 6 }}>
        {days.map((d) => {
          const iso = ymdLocal(d)
          const sessTitle = schedule[d.getDay()] ? templates[schedule[d.getDay()]] : null
          const oneOffs = plans.filter((p) => p.scheduled_for === iso).map((p) => p.title)
          const reminders = tasks.filter((t) => taskLandsOn(t, d)).map((t) => TASK_SHORT[t.kind] || t.kind)
          const isToday = iso === todayIso
          const empty = !sessTitle && oneOffs.length === 0 && reminders.length === 0
          return (
            <div key={iso} className="card" style={{ background: isToday ? 'var(--surface-2)' : 'transparent', borderColor: isToday ? 'var(--accent)' : 'var(--line)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <b>{d.toLocaleDateString(undefined, { weekday: 'short' })}</b>
                <span className="muted-note">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              </div>
              {sessTitle && <div className="session-sub" style={{ marginTop: 4 }}><b style={{ color: 'var(--accent)' }}>Session:</b> {sessTitle}</div>}
              {oneOffs.map((t, i) => <div key={i} className="session-sub" style={{ marginTop: 4 }}>{t}</div>)}
              {reminders.length > 0 && (
                <div className="tag-row" style={{ marginTop: 6 }}>
                  {reminders.map((r, i) => <span key={i} className="tag-pill">{r}</span>)}
                </div>
              )}
              {empty && <div className="muted-note" style={{ marginTop: 4 }}>Rest day</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
function WeeklySchedule({ clientId, coachId }) {
  const [templates, setTemplates] = useState([])
  const [sched, setSched] = useState({})
  const [tasks, setTasks] = useState({})   // kind -> { dow, cadence }
  const [saved, setSaved] = useState(false)

  async function load() {
    const [{ data: t }, { data: s }, { data: ct }] = await Promise.all([
      supabase.from('workout_templates').select('id, title').eq('coach_id', coachId).order('created_at', { ascending: false }),
      supabase.from('client_schedule').select('dow, template_id').eq('client_id', clientId),
      supabase.from('client_tasks').select('kind, dow, cadence').eq('client_id', clientId),
    ])
    setTemplates(t || [])
    const map = {}; (s || []).forEach((r) => { map[r.dow] = r.template_id || '' }); setSched(map)
    const tm = {}; (ct || []).forEach((r) => { tm[r.kind] = { dow: r.dow, cadence: r.cadence } }); setTasks(tm)
  }
  useEffect(() => { load() }, [])

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1000) }

  async function setDay(dow, template_id) {
    setSched((m) => ({ ...m, [dow]: template_id }))
    await supabase.from('client_schedule').upsert({ coach_id: coachId, client_id: clientId, dow, template_id: template_id || null, updated_at: new Date().toISOString() }, { onConflict: 'client_id,dow' })
    flash()
  }

  async function setTask(kind, dow, cadence) {
    if (dow === '') {   // "Off" — remove the task
      setTasks((m) => { const n = { ...m }; delete n[kind]; return n })
      await supabase.from('client_tasks').delete().eq('client_id', clientId).eq('kind', kind)
    } else {
      setTasks((m) => ({ ...m, [kind]: { dow: Number(dow), cadence } }))
      await supabase.from('client_tasks').upsert({ coach_id: coachId, client_id: clientId, kind, dow: Number(dow), cadence, updated_at: new Date().toISOString() }, { onConflict: 'client_id,kind' })
    }
    flash()
  }

  return (
    <div className="card">
      <p className="eyebrow">Weekly schedule</p>
      <p className="muted-note">Set which session runs each day — it shows on their daily plan, ready to start.</p>
      {templates.length === 0 && <p className="muted-note" style={{ marginTop: 8 }}>Build a session template first (on your dashboard) to schedule it.</p>}
      <div className="stack" style={{ marginTop: 8 }}>
        {SCHED_DOW.map(([dow, label]) => (
          <label className="field" key={dow}>{label}
            <select className="ex-select" value={sched[dow] || ''} onChange={(e) => setDay(dow, e.target.value)}>
              <option value="">Rest day</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
        ))}
      </div>

      <p className="eyebrow" style={{ marginTop: 16 }}>Check-ins &amp; recurring tasks</p>
      <p className="muted-note">Pick a day and how often for each. These sit alongside the day's session — a day can have both.</p>
      <div className="stack" style={{ marginTop: 8 }}>
        {CLIENT_TASK_KINDS.map(([kind, label]) => {
          const cur = tasks[kind]
          return (
            <div className="task-row" key={kind}>
              <span className="task-label">{label}</span>
              <select className="ex-select task-day" value={cur ? cur.dow : ''} onChange={(e) => setTask(kind, e.target.value, cur?.cadence || 'weekly')}>
                <option value="">Off</option>
                {SCHED_DOW.map(([dow, l]) => <option key={dow} value={dow}>{l}</option>)}
              </select>
              <select className="ex-select task-cad" value={cur?.cadence || 'weekly'} disabled={!cur} onChange={(e) => setTask(kind, cur.dow, e.target.value)}>
                {TASK_CADENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )
        })}
      </div>
      {saved && <p className="logged-ok">Saved ✓</p>}
    </div>
  )
}

/* ---------- Injury / rehab / return-to-play (PPH performance layer) ---------- */
function RehabCoach({ clientId, coachId }) {
  const [injuries, setInjuries] = useState([])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ body_region: BODY_REGIONS[0], side: 'N/A', tissue_type: TISSUES[0], severity: SEVERITIES[0], mechanism: '', onset_date: '' })
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('injuries').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setInjuries(data || [])
  }
  useEffect(() => { load() }, [])
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function add() {
    const { data, error: err } = await supabase.from('injuries').insert({
      client_id: clientId, coach_id: coachId, author_id: coachId,
      body_region: f.body_region, side: f.side, tissue_type: f.tissue_type, severity: f.severity,
      mechanism: f.mechanism.trim() || null, onset_date: f.onset_date || null, status: 'active', availability: 'unavailable',
    }).select().single()
    if (err) { setError(err.message); return }
    setInjuries((i) => [data, ...i]); setOpen(false); setError('')
    setF({ body_region: BODY_REGIONS[0], side: 'N/A', tissue_type: TISSUES[0], severity: SEVERITIES[0], mechanism: '', onset_date: '' })
  }

  const activeCount = injuries.filter((i) => i.status !== 'resolved').length
  return (
    <div className="card">
      <p className="eyebrow">Medical / rehab{activeCount ? ` · ${activeCount} active` : ''}</p>
      <p className="muted-note">Injury record, rehab protocols and return-to-play. The athlete sees their plan but can’t edit the record.</p>
      <div className="stack" style={{ marginTop: 12 }}>
        {injuries.map((inj) => <InjuryCard key={inj.id} injury={inj} clientId={clientId} coachId={coachId} onChange={(u) => setInjuries((xs) => xs.map((x) => x.id === u.id ? u : x))} onDelete={(id) => setInjuries((xs) => xs.filter((x) => x.id !== id))} />)}
      </div>
      {error && <p className="error">{error}</p>}
      {!open ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setOpen(true); setError('') }}>Log injury</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="grid-2">
            <label className="field">Region<select value={f.body_region} onChange={set('body_region')}>{BODY_REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="field">Side<select value={f.side} onChange={set('side')}>{SIDES.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="field">Tissue<select value={f.tissue_type} onChange={set('tissue_type')}>{TISSUES.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="field">Severity<select value={f.severity} onChange={set('severity')}>{SEVERITIES.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="field">Onset<input type="date" value={f.onset_date} onChange={set('onset_date')} /></label>
          </div>
          <label className="field">Mechanism / notes<input value={f.mechanism} onChange={set('mechanism')} placeholder="e.g. sprint — felt a pull" /></label>
          <button className="btn primary big" onClick={add}>Save injury</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function InjuryCard({ injury, clientId, coachId, onChange, onDelete }) {
  const [inj, setInj] = useState(injury)
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(null)
  const [note, setNote] = useState('')
  const [noteType, setNoteType] = useState('progress')
  const [protocols, setProtocols] = useState(null)
  const av = availabilityOf(inj.availability)

  async function loadDetail() {
    if (notes !== null) return
    const [{ data: ns }, { data: ps }] = await Promise.all([
      supabase.from('injury_notes').select('*').eq('injury_id', inj.id).order('created_at', { ascending: false }),
      supabase.from('rehab_protocols').select('*').eq('injury_id', inj.id).order('created_at', { ascending: false }),
    ])
    setNotes(ns || []); setProtocols(ps || [])
  }
  function toggle() { const willOpen = !open; setOpen(willOpen); if (willOpen) loadDetail() }

  async function patch(fields) {
    const { data } = await supabase.from('injuries').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', inj.id).select().single()
    if (data) { setInj(data); onChange && onChange(data) }
  }
  async function addNote() {
    if (!note.trim()) return
    const { data } = await supabase.from('injury_notes').insert({ injury_id: inj.id, client_id: clientId, author_id: coachId, note_type: noteType, body: note.trim() }).select().single()
    if (data) { setNotes((n) => [data, ...(n || [])]); setNote('') }
  }
  async function del() { await supabase.from('injuries').delete().eq('id', inj.id); onDelete && onDelete(inj.id) }
  const advance = (dir) => {
    const next = Math.max(0, Math.min(RTP_LADDER.length, inj.current_rtp_stage + dir))
    patch({ current_rtp_stage: next, status: next >= RTP_LADDER.length ? 'rtp' : (next > 0 ? 'rehab' : inj.status) })
  }
  const clear = () => patch({ status: 'resolved', availability: 'full', current_rtp_stage: RTP_LADDER.length, cleared_by: coachId, cleared_at: new Date().toISOString() })

  return (
    <div className="card" style={{ background: 'var(--surface-2)' }}>
      <button type="button" className="session-head" onClick={toggle}>
        <div>
          <div className="session-title">{inj.body_region}{inj.side && inj.side !== 'N/A' ? ` (${inj.side})` : ''}</div>
          <div className="session-sub">{[inj.severity, inj.tissue_type, statusLabel(inj.status)].filter(Boolean).join(' · ')}</div>
        </div>
        <span className={'avail-badge ' + av.color}>{av.label}</span>
      </button>
      {open && (
        <div className="stack" style={{ marginTop: 10 }}>
          <div className="grid-2">
            <label className="field">Status<select value={inj.status} onChange={(e) => patch({ status: e.target.value })}>{INJURY_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
            <label className="field">Availability<select value={inj.availability} onChange={(e) => patch({ availability: e.target.value })}>{AVAILABILITY.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
          </div>
          <div>
            <p className="eyebrow accent">Return to play</p>
            <div className="rtp-ladder">
              {RTP_LADDER.map((s, i) => (
                <div key={i} className={'rtp-step' + (i < inj.current_rtp_stage ? ' done' : '') + (i === inj.current_rtp_stage ? ' current' : '')}>
                  <span className="rtp-n">{i + 1}</span><span>{s}</span>
                </div>
              ))}
            </div>
            <div className="nudge-actions" style={{ marginTop: 8 }}>
              <button className="btn ghost sm" onClick={() => advance(-1)} disabled={inj.current_rtp_stage <= 0}>Back</button>
              <button className="btn ghost sm" onClick={() => advance(1)} disabled={inj.current_rtp_stage >= RTP_LADDER.length}>Advance stage</button>
              {inj.status !== 'resolved' && <button className="btn primary sm" onClick={clear}>Clear for play</button>}
            </div>
            {inj.cleared_at && <p className="logged-ok">Cleared {(inj.cleared_at || '').slice(0, 10)} ✓</p>}
          </div>
          <RehabProtocols injuryId={inj.id} clientId={clientId} coachId={coachId} protocols={protocols} setProtocols={setProtocols} />
          <div>
            <p className="eyebrow accent">Clinical notes</p>
            {(notes || []).map((n) => <div className="fc-block" key={n.id}><b>{noteTypeLabel(n.note_type)} · {(n.created_at || '').slice(0, 10)}</b><p>{n.body}</p></div>)}
            <div className="stack" style={{ marginTop: 6 }}>
              <select className="ex-select" value={noteType} onChange={(e) => setNoteType(e.target.value)}>{NOTE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Assessment, treatment, progress…" />
              <button className="btn ghost sm" onClick={addNote}>Add note</button>
            </div>
          </div>
          <button type="button" className="link-btn" onClick={del}>Delete injury</button>
        </div>
      )}
    </div>
  )
}

function RehabProtocols({ injuryId, clientId, coachId, protocols, setProtocols }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [items, setItems] = useState({})
  async function addProtocol() {
    if (!title.trim()) return
    const { data } = await supabase.from('rehab_protocols').insert({ injury_id: injuryId, client_id: clientId, coach_id: coachId, title: title.trim() }).select().single()
    if (data) { setProtocols((p) => [data, ...(p || [])]); setTitle(''); setOpen(false) }
  }
  async function loadItems(pid) {
    if (items[pid]) return
    const { data } = await supabase.from('rehab_protocol_items').select('*').eq('protocol_id', pid).order('position', { ascending: true })
    setItems((s) => ({ ...s, [pid]: data || [] }))
  }
  async function addItem(pid, name, detail) {
    const pos = (items[pid] || []).length
    const { data } = await supabase.from('rehab_protocol_items').insert({ protocol_id: pid, client_id: clientId, name, detail: detail || null, position: pos }).select().single()
    if (data) setItems((s) => ({ ...s, [pid]: [...(s[pid] || []), data] }))
  }
  return (
    <div>
      <p className="eyebrow accent">Rehab protocol</p>
      {(protocols || []).map((pr) => <ProtocolRow key={pr.id} pr={pr} items={items[pr.id]} onOpen={() => loadItems(pr.id)} onAdd={(n, d) => addItem(pr.id, n, d)} />)}
      {!open ? <button className="btn ghost sm" onClick={() => setOpen(true)}>Add protocol</button> : (
        <div className="stack" style={{ marginTop: 6 }}>
          <input className="ex-name-in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Phase 1 — isometrics" />
          <button className="btn ghost sm" onClick={addProtocol}>Save protocol</button>
        </div>
      )}
    </div>
  )
}

function ProtocolRow({ pr, items, onOpen, onAdd }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(''); const [detail, setDetail] = useState('')
  function toggle() { const willOpen = !open; setOpen(willOpen); if (willOpen) onOpen() }
  return (
    <div className="card" style={{ background: 'var(--surface)', marginBottom: 6 }}>
      <button type="button" className="session-head" onClick={toggle}><div className="session-title">{pr.title}</div><span className="chev">{open ? '−' : '+'}</span></button>
      {open && (
        <div className="stack" style={{ marginTop: 6 }}>
          {(items || []).map((it) => <div key={it.id} className="checkin-line"><b>{it.name}</b>{it.detail ? ` — ${it.detail}` : ''}</div>)}
          <div className="grid-2">
            <input className="ex-name-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Drill" />
            <input className="ex-name-in" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="3×30s / notes" />
          </div>
          <button className="btn ghost sm" disabled={!name.trim()} onClick={() => { onAdd(name.trim(), detail.trim()); setName(''); setDetail('') }}>Add drill</button>
        </div>
      )}
    </div>
  )
}

// Coach uploads shared PDFs/guides to a public bucket; every client sees them
// in their Files section. coach_files mirrors the videos RLS pattern.
// audienceTag scopes this to one group's Files tab instead of the general
// library — general (audienceTag omitted) only ever shows untagged files, and
// a group's Files only shows files tagged for that group.
function CoachFiles({ coachId, audienceTag }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  async function load() {
    let q = supabase.from('coach_files').select('*').eq('coach_id', coachId)
    q = audienceTag ? q.eq('audience_tag', audienceTag) : q.is('audience_tag', null)
    const { data } = await q.order('created_at', { ascending: false })
    setItems(data || [])
  }
  useEffect(() => { load() }, [audienceTag])

  async function save() {
    if (!title.trim()) { setError('Give the file a title.'); return }
    if (!file) { setError('Choose a file to upload.'); return }
    setBusy(true); setError('')
    try {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
      const path = `${coachId}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('coach-files').upload(path, file, { contentType: file.type || 'application/pdf' })
      if (up.error) throw new Error(up.error.message)
      const { data, error: err } = await supabase.from('coach_files').insert({ coach_id: coachId, title: title.trim(), path, note: note.trim() || null, audience_tag: audienceTag || null }).select().single()
      if (err) throw new Error(err.message)
      setItems((i) => [data, ...i]); setTitle(''); setNote(''); setFile(null); setOpen(false); if (ref.current) ref.current.value = ''
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function del(f) {
    await supabase.storage.from('coach-files').remove([f.path])
    await supabase.from('coach_files').delete().eq('id', f.id)
    setItems((i) => i.filter((x) => x.id !== f.id))
  }

  return (
    <div className="card">
      <p className="eyebrow">Files</p>
      <p className="muted-note">{audienceTag ? 'Files just for this group — members see these plus your general Files.' : 'Upload PDFs and guides — every client can open them from their Files section.'}</p>
      {items.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {items.map((f) => (
            <div className="card" key={f.id} style={{ background: 'var(--surface-2)' }}>
              <div className="session-title">{f.title}</div>
              <div className="session-sub">{f.note || 'File'}</div>
              <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => del(f)}>Delete</button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {!open ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setOpen(true); setError('') }}>Add file</button>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="field">Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nutrition guide" /></label>
          <label className="field">Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line" /></label>
          <input ref={ref} type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="btn primary big" disabled={busy} onClick={save}>{busy ? 'Uploading…' : 'Upload file'}</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

const GROUP_ICONS = ['👥', '🦁', '🐺', '🔥', '⭐', '💪', '🎯', '🌟', '🚀', '🏆']
const slugTag = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// Groups: a named/iconed cohort (Kim's Trainerize-style ask). Wraps the
// existing client_tags mechanism — membership is a client_tags row matching
// the group's tag, which is exactly what already drives audience-targeted
// community posts and programme visibility, so a group's feed/files/
// programme are the same proven tag-gated primitives, just given a proper
// front door (name, icon, members list, settings) instead of free-typed tags.
function GroupsPanel({ groups, coachId, onOpen, onCreated }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(GROUP_ICONS[0])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function create() {
    const n = name.trim()
    if (!n) return
    const tag = slugTag(n)
    if (!tag) { setError('Give the group a name.'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('groups').insert({ coach_id: coachId, tag, name: n, icon }).select().single()
    setSaving(false)
    if (err) { setError(err.code === '23505' ? 'You already have a group with that name.' : err.message); return }
    if (data) { onCreated(data); setName(''); setIcon(GROUP_ICONS[0]); setOpen(false) }
  }
  return (
    <div className="card">
      <p className="eyebrow">Groups</p>
      <p className="muted-note">Cohorts with their own feed, files and a shared programme — perfect for a group launch or an online community.</p>
      {groups.length === 0 && <p className="muted-note">No groups yet.</p>}
      <div className="stack">
        {groups.map((g) => (
          <button className="tile" key={g.id} onClick={() => onOpen(g)}>
            <span className="avatar">{g.icon}</span>
            <div><b>{g.name}</b><span>Group</span></div>
          </button>
        ))}
      </div>
      {!open && <button className="btn ghost" onClick={() => setOpen(true)}>New group</button>}
      {open && (
        <div className="stack">
          <label className="field">Group name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. September Launch" /></label>
          <div className="seg small">
            {GROUP_ICONS.map((i) => (
              <button type="button" key={i} className={icon === i ? 'on' : ''} onClick={() => setIcon(i)}>{i}</button>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={saving} onClick={create}>{saving ? 'Creating…' : 'Create group'}</button>
        </div>
      )}
    </div>
  )
}

function GroupDetail({ group, coachId, coachName, clients, onBack, onUpdated, onDeleted }) {
  const [members, setMembers] = useState([])
  const [addId, setAddId] = useState('')
  const [tab, setTab] = useState('feed')
  const [name, setName] = useState(group.name)
  const [icon, setIcon] = useState(group.icon)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [programs, setPrograms] = useState([])
  const [subscribeId, setSubscribeId] = useState('')
  const [subscribed, setSubscribed] = useState(null)
  const [subBusy, setSubBusy] = useState(false)

  async function loadMembers() {
    const { data } = await supabase.from('client_tags').select('*').eq('coach_id', coachId).eq('tag', group.tag)
    setMembers(data || [])
  }
  useEffect(() => { loadMembers() }, [group.tag])

  useEffect(() => {
    supabase.from('workout_programs').select('id, title, audience_tag').eq('coach_id', coachId).is('client_id', null).order('created_at', { ascending: false })
      .then(({ data }) => {
        setPrograms(data || [])
        const sub = (data || []).find((p) => p.audience_tag === group.tag)
        setSubscribed(sub || null)
      })
  }, [group.tag])

  const memberIds = members.map((m) => m.client_id)
  const nameOf = (cid) => clients.find((c) => c.id === cid)?.full_name || 'Client'
  const available = clients.filter((c) => !memberIds.includes(c.id))

  async function addMember() {
    if (!addId) return
    const { data } = await supabase.from('client_tags').insert({ coach_id: coachId, client_id: addId, tag: group.tag }).select().single()
    if (data) { setMembers((m) => [...m, data]); setAddId('') }
  }
  async function removeMember(id) {
    await supabase.from('client_tags').delete().eq('id', id)
    setMembers((m) => m.filter((x) => x.id !== id))
  }
  async function saveSettings() {
    const n = name.trim(); if (!n) return
    setSaving(true)
    const { data, error: err } = await supabase.from('groups').update({ name: n, icon }).eq('id', group.id).select().single()
    setSaving(false)
    if (!err && data) { onUpdated(data); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  }
  async function subscribeProgram() {
    if (!subscribeId) return
    setSubBusy(true)
    // Only one master programme per group at a time — clear any previous one.
    if (subscribed) await supabase.from('workout_programs').update({ audience_tag: null }).eq('id', subscribed.id)
    const { data } = await supabase.from('workout_programs').update({ audience_tag: group.tag }).eq('id', subscribeId).select().single()
    setSubBusy(false)
    if (data) { setSubscribed(data); setSubscribeId('') }
  }
  async function unsubscribeProgram() {
    if (!subscribed) return
    setSubBusy(true)
    await supabase.from('workout_programs').update({ audience_tag: null }).eq('id', subscribed.id)
    setSubBusy(false)
    setSubscribed(null)
  }
  async function del() {
    await supabase.from('groups').delete().eq('id', group.id)
    onDeleted(group.id)
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="link-btn" onClick={onBack}>‹ Groups</button>
        <span className="brand-name">{group.icon} {group.name}</span>
        <span style={{ width: 40 }} />
      </header>
      <main className="screen">
        <div className="stack">
          <div className="seg">
            <button type="button" className={tab === 'feed' ? 'on' : ''} onClick={() => setTab('feed')}>Feed</button>
            <button type="button" className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>Members ({members.length})</button>
            <button type="button" className={tab === 'files' ? 'on' : ''} onClick={() => setTab('files')}>Files</button>
            <button type="button" className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>Settings</button>
          </div>

          {tab === 'feed' && (
            <CommunityFeed communityCoachId={coachId} me={coachId} myName={coachName} isCoach={true} filterTag={group.tag} />
          )}

          {tab === 'members' && (
            <div className="card">
              <p className="eyebrow">Roster</p>
              {members.length === 0 && <p className="muted-note">No members yet — add someone below.</p>}
              {members.map((m) => (
                <div className="logrow" key={m.id}>
                  <span className="logname">{nameOf(m.client_id)}</span>
                  <span className="logmac"><button className="thumb-del" onClick={() => removeMember(m.id)}>×</button></span>
                </div>
              ))}
              {available.length > 0 && (
                <div className="nudge-actions" style={{ marginTop: 10 }}>
                  <select className="ex-select" value={addId} onChange={(e) => setAddId(e.target.value)}>
                    <option value="">Add a client…</option>
                    {available.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                  <button className="btn primary sm" disabled={!addId} onClick={addMember}>Add</button>
                </div>
              )}
            </div>
          )}

          {tab === 'files' && <CoachFiles coachId={coachId} audienceTag={group.tag} />}

          {tab === 'settings' && (
            <div className="stack">
              <div className="card">
                <p className="eyebrow">Group settings</p>
                <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
                <div className="seg small" style={{ marginTop: 8 }}>
                  {GROUP_ICONS.map((i) => (
                    <button type="button" key={i} className={icon === i ? 'on' : ''} onClick={() => setIcon(i)}>{i}</button>
                  ))}
                </div>
                <button className="btn primary" style={{ marginTop: 10 }} disabled={saving} onClick={saveSettings}>{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}</button>
              </div>
              <div className="card">
                <p className="eyebrow">Master programme</p>
                <p className="muted-note">Subscribe the whole group to one shared programme — every member sees it in their Program library.</p>
                {subscribed ? (
                  <>
                    <div className="card" style={{ background: 'var(--surface-2)', marginTop: 8 }}>
                      <div className="session-title">{subscribed.title}</div>
                    </div>
                    <button className="btn ghost sm" style={{ marginTop: 8 }} disabled={subBusy} onClick={unsubscribeProgram}>Unsubscribe</button>
                  </>
                ) : programs.length > 0 ? (
                  <div className="nudge-actions" style={{ marginTop: 8 }}>
                    <select className="ex-select" value={subscribeId} onChange={(e) => setSubscribeId(e.target.value)}>
                      <option value="">Choose a programme…</option>
                      {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                    <button className="btn primary sm" disabled={!subscribeId || subBusy} onClick={subscribeProgram}>Subscribe</button>
                  </div>
                ) : (
                  <p className="muted-note">No programmes in your library yet.</p>
                )}
              </div>
              <button className="btn ghost" onClick={del}>Delete group</button>
            </div>
          )}
        </div>
      </main>
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

// The accountability a programme dictates — check-in / measurements / weight / photos,
// each on a day + cadence. Stored on the programme (schedule_tasks). Applying the
// programme to a client seeds these into their client_tasks so they show on the
// client's daily plan automatically. Reuses the same kinds/days/cadences as the
// per-client Weekly schedule.
// Edit a saved programme's details + visibility (level, weeks, the library filter
// dimensions and the "only show to tag"). Paul's ask: he couldn't add/change tags
// after creating a programme. Mirrors the create form's fields.
function AssignProgram({ clientId, coachId, clientName }) {
  const [programs, setPrograms] = useState([])
  const [current, setCurrent] = useState(null)
  const [pick, setPick] = useState('')
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10))
  const [repeat, setRepeat] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  async function load() {
    const [{ data: progs }, { data: cur }] = await Promise.all([
      supabase.from('workout_programs').select('id, title, weeks, client_id').eq('coach_id', coachId).or(`client_id.is.null,client_id.eq.${clientId}`).order('created_at', { ascending: false }),
      supabase.from('client_programs').select('id, program_id, start_date, repeat, workout_programs(title)').eq('client_id', clientId).eq('active', true).order('created_at', { ascending: false }).limit(1),
    ])
    setPrograms(progs || [])
    setCurrent(cur?.[0] || null)
  }
  useEffect(() => { load() }, [])
  async function assign() {
    if (!pick) return
    setBusy(true); setMsg('')
    await supabase.from('client_programs').update({ active: false }).eq('client_id', clientId).eq('active', true)
    const { data, error } = await supabase.from('client_programs')
      .insert({ client_id: clientId, coach_id: coachId, program_id: pick, start_date: start, repeat, active: true })
      .select('id, program_id, start_date, repeat, workout_programs(title)').single()
    setBusy(false)
    if (error) { setMsg('Could not assign: ' + error.message); return }
    setCurrent(data); setPick(''); setMsg('Program assigned ✓')
  }
  async function stop() {
    setBusy(true)
    await supabase.from('client_programs').update({ active: false }).eq('client_id', clientId).eq('active', true)
    setBusy(false); setCurrent(null); setMsg('Program stopped.')
  }
  if (!programs.length) return null
  return (
    <div className="card">
      <p className="eyebrow">Assign a program</p>
      <p className="muted-note">Put this client on a multi-week program from a start date — their daily plan follows it automatically, week to week.</p>
      {current && (
        <div className="card" style={{ background: 'var(--surface-2)', marginTop: 8 }}>
          <div className="session-title">On: {current.workout_programs?.title || 'Program'}</div>
          <div className="session-sub">From {current.start_date}{current.repeat ? ' · repeats' : ''}</div>
          <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} disabled={busy} onClick={stop}>Stop program</button>
        </div>
      )}
      <label className="field" style={{ marginTop: 10 }}>Program
        <select className="ex-select" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choose a program…</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.title}{p.weeks ? ` · ${p.weeks}wk` : ''}{p.client_id ? ' · 1-2-1' : ''}</option>)}
        </select>
      </label>
      <div className="grid-2">
        <label className="field">Start date<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}><input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} style={{ width: 'auto' }} /> Repeat when it ends</label>
      </div>
      <button type="button" className="btn primary" disabled={!pick || busy} onClick={assign}>{busy ? '…' : (current ? 'Replace with this' : 'Assign program')}</button>
      {msg && <p className="logged-ok">{msg}</p>}
    </div>
  )
}

function ProgramMetaEditor({ program, onSaved }) {
  const [meta, setMeta] = useState({
    level: program.level || 'Beginner', weeks: program.weeks != null ? String(program.weeks) : '',
    location: program.location || '', equipment: program.equipment || '',
    audience: program.audience || '', goal: program.goal || '', audience_tag: program.audience_tag || '',
  })
  const [saved, setSaved] = useState(false)
  const set = (k, v) => setMeta((m) => ({ ...m, [k]: v }))
  async function save() {
    const patch = {
      level: meta.level || null, weeks: Number(meta.weeks) || null,
      location: meta.location || null, equipment: meta.equipment || null,
      audience: meta.audience || null, goal: meta.goal || null,
      audience_tag: (meta.audience_tag || '').trim().toLowerCase() || null,
    }
    const { data, error } = await supabase.from('workout_programs').update(patch).eq('id', program.id).select().single()
    if (!error && data) { setSaved(true); setTimeout(() => setSaved(false), 1200); onSaved?.(data) }
  }
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      <p className="eyebrow">Details &amp; visibility</p>
      <div className="grid-2">
        <label className="field">Level
          <select className="ex-select" value={meta.level} onChange={(e) => set('level', e.target.value)}>
            {PROGRAM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="field">Weeks<input type="number" inputMode="numeric" value={meta.weeks} onChange={(e) => set('weeks', e.target.value)} /></label>
        {PROGRAM_DIMS.map((d) => (
          <label className="field" key={d.key}>{d.label}
            <select className="ex-select" value={meta[d.key] || ''} onChange={(e) => set(d.key, e.target.value)}>
              <option value="">Any</option>
              {d.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        ))}
      </div>
      <label className="field">Only show to tag (optional)<input value={meta.audience_tag} onChange={(e) => set('audience_tag', e.target.value)} placeholder="e.g. standard — blank shows to everyone" /></label>
      <button type="button" className="btn ghost sm" onClick={save}>{saved ? 'Saved ✓' : 'Save details'}</button>
    </div>
  )
}

function ProgramSchedule({ program, onSaved }) {
  const seed = {}; (program.schedule_tasks || []).forEach((t) => { seed[t.kind] = { dow: t.dow, cadence: t.cadence } })
  const [tasks, setTasks] = useState(seed)
  const [saved, setSaved] = useState(false)
  const setTask = (kind, dow, cadence) => setTasks((m) => {
    const n = { ...m }
    if (dow === '') delete n[kind]
    else n[kind] = { dow: Number(dow), cadence }
    return n
  })
  async function save() {
    const arr = Object.entries(tasks).map(([kind, v]) => ({ kind, dow: v.dow, cadence: v.cadence }))
    const { data, error } = await supabase.from('workout_programs').update({ schedule_tasks: arr }).eq('id', program.id).select().single()
    if (!error && data) { setSaved(true); setTimeout(() => setSaved(false), 1200); onSaved?.(data) }
  }
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      <p className="eyebrow">Built-in check-ins &amp; measurements</p>
      <p className="muted-note">Set the accountability this plan dictates. Apply it to a client from their page and it drops onto their daily plan automatically.</p>
      <div className="stack" style={{ marginTop: 8 }}>
        {CLIENT_TASK_KINDS.map(([kind, label]) => {
          const cur = tasks[kind]
          return (
            <div className="task-row" key={kind}>
              <span className="task-label">{label}</span>
              <select className="ex-select task-day" value={cur ? cur.dow : ''} onChange={(e) => setTask(kind, e.target.value, cur?.cadence || 'weekly')}>
                <option value="">Off</option>
                {SCHED_DOW.map(([dow, l]) => <option key={dow} value={dow}>{l}</option>)}
              </select>
              {cur && (
                <select className="ex-select task-cadence" value={cur.cadence} onChange={(e) => setTask(kind, cur.dow, e.target.value)}>
                  {TASK_CADENCES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                </select>
              )}
            </div>
          )
        })}
      </div>
      <button type="button" className="btn ghost sm" style={{ marginTop: 10 }} onClick={save}>{saved ? 'Saved ✓' : 'Save schedule'}</button>
    </div>
  )
}

// On a client's page: drop a programme's built-in check-ins & measurements straight
// onto this client's daily plan (seeds client_tasks, upsert per kind). Only shows
// programmes that actually carry a schedule.
function ApplyProgramSchedule({ clientId, coachId }) {
  const [programs, setPrograms] = useState([])
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('workout_programs').select('id, title, schedule_tasks').eq('coach_id', coachId).order('created_at', { ascending: false })
      setPrograms((data || []).filter((p) => (p.schedule_tasks || []).length))
    })()
  }, [])
  async function apply() {
    const prog = programs.find((p) => p.id === pick)
    if (!prog) return
    setBusy(true); setDone('')
    const rows = (prog.schedule_tasks || []).map((t) => ({ coach_id: coachId, client_id: clientId, kind: t.kind, dow: t.dow, cadence: t.cadence, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('client_tasks').upsert(rows, { onConflict: 'client_id,kind' })
    setBusy(false)
    setDone(error ? ('Could not apply: ' + error.message) : `Applied ${rows.length} to their daily plan ✓`)
  }
  if (programs.length === 0) return null
  return (
    <div className="card">
      <p className="eyebrow">Copy check-in reminders from a program</p>
      <p className="muted-note">Different from “Assign a program” above (which sets their workouts). This only copies a program’s built-in check-in &amp; measurement reminders onto this client — leave it alone if you don’t use those.</p>
      <label className="field" style={{ marginTop: 8 }}>Program
        <select className="ex-select" value={pick} onChange={(e) => { setPick(e.target.value); setDone('') }}>
          <option value="">Choose a program…</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </label>
      <button type="button" className="btn ghost" disabled={!pick || busy} onClick={apply}>{busy ? 'Applying…' : 'Apply to this client'}</button>
      {done && <p className="logged-ok">{done}</p>}
    </div>
  )
}

// Multi-session programmes built from the coach's templates. Each programme session
// snapshots a template (title/focus/exercises/finisher) so later template edits
// don't rewrite a published programme. Clients browse these in "Program library".
function CoachPrograms({ coachId, clientId = null, clientName }) {
  const personal = !!clientId // scoped to one client's private 1-2-1 programmes
  const clientFirst = (clientName || 'this client').split(' ')[0]
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
  const [pickTpl, setPickTpl] = useState('') // template id, or '__custom__' to build from scratch
  const [dayLabel, setDayLabel] = useState('')
  const [pickWeek, setPickWeek] = useState(1)
  const [pickDow, setPickDow] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [customFocus, setCustomFocus] = useState('')
  const [customRows, setCustomRows] = useState([newExerciseRow()])
  const [addError, setAddError] = useState('') // scoped to the add-session flow, so it doesn't get lost below a long programme card
  const [editSess, setEditSess] = useState(null) // program_session id being edited
  // AI whole-programme edit: one instruction rewrites all sessions.
  const [aiEditFor, setAiEditFor] = useState(null) // programme id in AI-edit mode
  const [aiInstr, setAiInstr] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState('')
  const [aiDraft, setAiDraft] = useState(null) // { programId, sessions: revised[] }
  const [buildingOut, setBuildingOut] = useState(null) // programme id being expanded to all weeks

  async function load() {
    // Library view shows only shared programmes (client_id null); the client-page
    // view shows only that client's private 1-2-1 programmes.
    let pq = supabase.from('workout_programs').select('*').eq('coach_id', coachId)
    pq = personal ? pq.eq('client_id', clientId) : pq.is('client_id', null)
    const [p, t] = await Promise.all([
      pq.order('created_at', { ascending: false }),
      supabase.from('workout_templates').select('*').eq('coach_id', coachId).order('created_at', { ascending: false }),
    ])
    setPrograms(p.data || [])
    setTemplates(t.data || [])
  }
  useEffect(() => { load() }, [clientId])

  async function loadSessions(programId) {
    const { data } = await supabase.from('program_sessions').select('*').eq('program_id', programId)
      .order('week', { ascending: true }).order('dow', { ascending: true, nullsFirst: false }).order('position', { ascending: true })
    setSessions((s) => ({ ...s, [programId]: data || [] }))
  }
  function toggle(programId) {
    setOpenId((o) => (o === programId ? null : programId))
    if (!sessions[programId]) loadSessions(programId)
  }

  async function createProgram() {
    if (!title.trim()) { setError('Give the program a name.'); return }
    const { data, error: err } = await supabase.from('workout_programs').insert({
      coach_id: coachId, client_id: clientId, title: title.trim(), description: desc.trim() || null,
      weeks: Number(weeks) || null, level,
      location: meta.location || null, equipment: meta.equipment || null,
      audience: meta.audience || null, goal: meta.goal || null,
      audience_tag: personal ? null : (meta.audience_tag?.trim().toLowerCase() || null),
    }).select().single()
    if (err) { setError(err.message); return }
    setPrograms((p) => [data, ...p])
    setTitle(''); setDesc(''); setWeeks(''); setLevel('Beginner'); setMeta({}); setCreating(false); setError('')
    setOpenId(data.id); setSessions((s) => ({ ...s, [data.id]: [] })); setAddFor(data.id)
  }

  async function addSession(programId) {
    let title, focus, exercises, finisher
    if (pickTpl === '__custom__') {
      exercises = rowsToExercises(customRows, 'Coach plan')
      if (exercises.length === 0) { setAddError('Add at least one exercise with a set.'); return }
      title = customTitle.trim() || 'Custom session'; focus = customFocus.trim() || null; finisher = null
    } else {
      const tpl = templates.find((t) => t.id === pickTpl)
      if (!tpl) { setAddError('Pick a template, or build a custom session.'); return }
      title = tpl.title; focus = tpl.focus; exercises = tpl.exercises || []; finisher = tpl.finisher || null
    }
    const pos = (sessions[programId] || []).length
    const { data, error: err } = await supabase.from('program_sessions').insert({
      program_id: programId, position: pos, label: dayLabel.trim() || null,
      week: Number(pickWeek) || 1, dow: pickDow === '' ? null : Number(pickDow),
      title, focus, exercises, finisher,
    }).select().single()
    if (err) { setAddError(err.message); return }
    setSessions((s) => {
      const next = [...(s[programId] || []), data]
      next.sort((a, b) => (a.week - b.week) || ((a.dow ?? 9) - (b.dow ?? 9)) || (a.position - b.position))
      return { ...s, [programId]: next }
    })
    setPickTpl(''); setDayLabel(''); setPickDow(''); setAddError('')
    setCustomTitle(''); setCustomFocus(''); setCustomRows([newExerciseRow()])
  }

  async function delSession(programId, id) {
    await supabase.from('program_sessions').delete().eq('id', id)
    setSessions((s) => ({ ...s, [programId]: (s[programId] || []).filter((x) => x.id !== id) }))
  }
  async function delProgram(id) {
    await supabase.from('workout_programs').delete().eq('id', id)
    setPrograms((p) => p.filter((x) => x.id !== id))
  }

  // AI programme generator — prompt -> draft -> publish.
  const [genOn, setGenOn] = useState(false)
  const [g, setG] = useState({ goal: '', days: 3, equipment: 'Full gym', level: 'Intermediate', weeks: 4 })
  const [genBusy, setGenBusy] = useState(false)
  const [genDraft, setGenDraft] = useState(null)
  const [genErr, setGenErr] = useState('')
  const gset = (k) => (e) => setG((s) => ({ ...s, [k]: e.target.value }))
  async function genProgram() {
    setGenBusy(true); setGenErr('')
    try {
      const res = await fetch('/.netlify/functions/program-generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(g) })
      const j = await res.json()
      if (!j.sessions?.length) setGenErr(j.error || 'Nothing came back — try again.')
      else setGenDraft(j)
    } catch (e) { setGenErr(String(e.message || e)) }
    setGenBusy(false)
  }
  async function saveGenerated() {
    const d = genDraft
    const weeksN = Math.min(Math.max(Number(d.weeks) || 4, 1), 16)
    const { data: prog, error: err } = await supabase.from('workout_programs').insert({ coach_id: coachId, client_id: clientId, title: d.title, description: d.description || null, weeks: weeksN, level: g.level, audience_tag: personal ? null : (g.audience_tag?.trim().toLowerCase() || null) }).select().single()
    if (err || !prog) { setGenErr(err?.message || 'Save failed.'); return }
    // Clone the AI's base week across every week of the programme, tagging each
    // session with its week + a default training day, and progressing the load
    // week to week (with a deload every 4th). No more empty weeks 2..N.
    const base = d.sessions || []
    const dow = daySpread(base.length)
    const rows = []
    let pos = 0
    for (let wk = 1; wk <= weeksN; wk++) {
      const deload = weeksN >= 4 && wk % 4 === 0
      base.forEach((s, i) => {
        rows.push({
          program_id: prog.id, position: pos++, week: wk, dow: dow[i] ?? null,
          label: `Week ${wk}`,
          title: s.title,
          focus: deload ? `Deload — ${s.focus || 'recovery'}` : s.focus,
          exercises: progressExercises(s.exercises, wk, deload),
          finisher: deload ? null : (s.finisher || null),
        })
      })
    }
    await supabase.from('program_sessions').insert(rows)
    setPrograms((p) => [prog, ...p]); setGenDraft(null); setGenOn(false)
  }

  // AI whole-programme edit: send all sessions + one instruction, preview the
  // revised set, then replace the programme's sessions on apply.
  async function runProgramEdit(pr) {
    const cur = sessions[pr.id] || []
    if (!cur.length || !aiInstr.trim()) { setAiErr('Add some sessions and an instruction first.'); return }
    setAiBusy(true); setAiErr('')
    try {
      const res = await fetch('/.netlify/functions/program-edit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instruction: aiInstr.trim(), title: pr.title, level: pr.level, weeks: pr.weeks, sessions: cur }),
      })
      const j = await res.json()
      if (!j.sessions?.length) setAiErr(j.error || 'Nothing came back — try again.')
      else setAiDraft({ programId: pr.id, sessions: j.sessions })
    } catch (e) { setAiErr(String(e.message || e)) }
    setAiBusy(false)
  }
  async function applyAiEdit() {
    const { programId, sessions: revised } = aiDraft
    await supabase.from('program_sessions').delete().eq('program_id', programId)
    const rows = revised.map((s, i) => ({ program_id: programId, position: s.position ?? i, week: s.week ?? 1, dow: s.dow ?? null, label: s.label || null, title: s.title, focus: s.focus, exercises: s.exercises, finisher: s.finisher }))
    await supabase.from('program_sessions').insert(rows)
    await loadSessions(programId)
    setAiDraft(null); setAiEditFor(null); setAiInstr('')
  }

  // Expand an older single-week programme across its full week count, cloning
  // week 1 with progressive overload (deload every 4th) and keeping each
  // session's training day. For programmes built before the multi-week feature.
  async function buildOutWeeks(pr) {
    const base = (sessions[pr.id] || []).filter((s) => (s.week || 1) === 1)
    const weeksN = Number(pr.weeks) || 0
    if (!base.length || weeksN < 2) return
    setBuildingOut(pr.id)
    const fallback = daySpread(base.length)
    const rows = []
    let pos = 0
    for (let wk = 1; wk <= weeksN; wk++) {
      const deload = weeksN >= 4 && wk % 4 === 0
      base.forEach((s, i) => {
        rows.push({
          program_id: pr.id, position: pos++, week: wk, dow: s.dow ?? fallback[i] ?? null,
          label: `Week ${wk}`,
          title: s.title,
          focus: deload ? `Deload — ${s.focus || 'recovery'}` : s.focus,
          exercises: progressExercises(s.exercises, wk, deload),
          finisher: deload ? null : (s.finisher || null),
        })
      })
    }
    await supabase.from('program_sessions').delete().eq('program_id', pr.id)
    await supabase.from('program_sessions').insert(rows)
    await loadSessions(pr.id)
    setBuildingOut(null)
  }

  return (
    <div className="card">
      <p className="eyebrow">{personal ? `${clientFirst}’s programs` : 'Program library'}</p>
      <p className="muted-note">{personal
        ? `Private 1-2-1 programs, built just for ${clientFirst}. Only they see these — never the shared library other members browse. Assign one below to put it on their plan.`
        : 'Bundle your templates into a plan clients can follow — they’ll browse these in “Program library”.'}</p>

      <div style={{ margin: '10px 0 14px', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
        {!genOn && !genDraft && <button type="button" className="btn ghost" onClick={() => setGenOn(true)}>Generate a programme with AI</button>}
        {genOn && !genDraft && (
          <div className="stack">
            <p className="eyebrow accent">Generate with AI</p>
            <label className="field">Goal<input value={g.goal} onChange={gset('goal')} placeholder="e.g. Build muscle / fat loss / strength" /></label>
            <div className="grid-2">
              <label className="field">Sessions / week<input type="number" inputMode="numeric" value={g.days} onChange={gset('days')} /></label>
              <label className="field">Weeks<input type="number" inputMode="numeric" value={g.weeks} onChange={gset('weeks')} /></label>
            </div>
            <label className="field">Level
              <select value={g.level} onChange={gset('level')}>{PROGRAM_LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
            </label>
            <label className="field">Equipment<input value={g.equipment} onChange={gset('equipment')} placeholder="e.g. Barbell, dumbbells, machines" /></label>
            {!personal && <label className="field">Only show to tag (optional)<input value={g.audience_tag || ''} onChange={gset('audience_tag')} placeholder="e.g. standard — blank = everyone" /></label>}
            {genErr && <p className="error">{genErr}</p>}
            <div className="nudge-actions">
              <button className="btn primary sm" disabled={genBusy} onClick={genProgram}>{genBusy ? 'Drafting…' : 'Draft it'}</button>
              <button type="button" className="btn ghost sm" onClick={() => setGenOn(false)}>Cancel</button>
            </div>
          </div>
        )}
        {genDraft && (
          <div className="stack">
            <p className="eyebrow accent">Draft — review &amp; publish</p>
            <div className="session-title">{genDraft.title}</div>
            <p className="muted-note">{genDraft.description} · {genDraft.weeks} weeks</p>
            <p className="muted-note" style={{ marginTop: 2 }}>Below is week 1. Publishing builds all {genDraft.weeks} weeks — progressive overload each week, a deload every 4th — on {(daySpread((genDraft.sessions || []).length)).map((n) => DOW_SHORT[n]).join('/')}. Edit any week or move sessions to other days after publishing.</p>
            {genDraft.sessions.map((s, i) => (
              <div className="card" key={i} style={{ background: 'var(--surface-2)' }}>
                <div className="session-title">{s.label} · {s.title}</div>
                <div className="session-sub">{s.focus}</div>
                {s.exercises.map((e, n) => <div className="checkin-line" key={n}>{e.name} — {e.sets}×{e.reps}{e.rpe ? ` @ RPE ${e.rpe}` : ''}</div>)}
                {s.finisher && <p className="muted-note" style={{ marginTop: 6 }}>Finisher: {s.finisher}</p>}
              </div>
            ))}
            {genErr && <p className="error">{genErr}</p>}
            <button className="btn primary big" onClick={saveGenerated}>Publish this programme</button>
            <button type="button" className="link-btn" onClick={() => setGenDraft(null)}>Discard &amp; redo</button>
          </div>
        )}
      </div>

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

                  {/* AI whole-programme edit */}
                  {aiEditFor !== pr.id && !aiDraft && (
                    <button type="button" className="btn ghost sm" onClick={() => { setAiEditFor(pr.id); setAiInstr(''); setAiErr('') }}>Edit with AI</button>
                  )}
                  {/* Older single-week programmes: expand to the full week count */}
                  {aiEditFor !== pr.id && !aiDraft && Number(pr.weeks) > 1 && (sessions[pr.id] || []).length > 0 && (sessions[pr.id] || []).every((s) => (s.week || 1) === 1) && (
                    <div className="card" style={{ background: 'var(--surface-2)' }}>
                      <p className="muted-note" style={{ marginBottom: 8 }}>This program is set to {pr.weeks} weeks but only week 1 is built. Build out all {pr.weeks} weeks from week 1, with progressive overload and a deload every 4th week (you can edit any week after).</p>
                      <button type="button" className="btn primary sm" disabled={buildingOut === pr.id} onClick={() => buildOutWeeks(pr)}>{buildingOut === pr.id ? 'Building…' : `Build out all ${pr.weeks} weeks`}</button>
                    </div>
                  )}
                  {aiEditFor === pr.id && !aiDraft && (
                    <div className="card" style={{ background: 'var(--surface-2)' }}>
                      <p className="eyebrow accent">Edit the whole program with AI</p>
                      <p className="muted-note" style={{ marginBottom: 8 }}>Describe the change and the AI rewrites every session — keeping the weeks &amp; days.</p>
                      <label className="field"><textarea rows={2} value={aiInstr} onChange={(e) => setAiInstr(e.target.value)} placeholder="e.g. more hypertrophy focus · swap dumbbell work to barbell · make weeks 5-8 harder" /></label>
                      {aiErr && <p className="error">{aiErr}</p>}
                      <div className="nudge-actions">
                        <button type="button" className="btn primary sm" disabled={aiBusy || !aiInstr.trim()} onClick={() => runProgramEdit(pr)}>{aiBusy ? 'Rewriting…' : 'Rewrite it'}</button>
                        <button type="button" className="btn ghost sm" onClick={() => { setAiEditFor(null); setAiErr('') }}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {aiDraft?.programId === pr.id && (
                    <div className="card" style={{ background: 'var(--surface-2)', borderColor: 'var(--accent)' }}>
                      <p className="eyebrow accent">Revised — review &amp; apply</p>
                      <p className="muted-note" style={{ marginBottom: 8 }}>Applying replaces this program’s {aiDraft.sessions.length} sessions. Weeks &amp; days are kept.</p>
                      {aiDraft.sessions.slice(0, 8).map((s, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div className="session-title" style={{ fontSize: 14 }}><span style={{ color: 'var(--accent)' }}>Wk{s.week || 1}{s.dow != null ? ' · ' + DOW_SHORT[s.dow] : ''}</span> · {s.title}</div>
                          {(s.exercises || []).map((e, n) => <div className="checkin-line" key={n}>{e.name} — {e.sets}×{e.reps}{e.rpe ? ` @ RPE ${e.rpe}` : ''}</div>)}
                        </div>
                      ))}
                      {aiDraft.sessions.length > 8 && <p className="muted-note">…and {aiDraft.sessions.length - 8} more.</p>}
                      <div className="nudge-actions" style={{ marginTop: 6 }}>
                        <button type="button" className="btn primary sm" onClick={applyAiEdit}>Apply changes</button>
                        <button type="button" className="btn ghost sm" onClick={() => setAiDraft(null)}>Discard</button>
                      </div>
                    </div>
                  )}

                  {(sessions[pr.id] || []).map((ps) => (
                    <div className="card" key={ps.id} style={{ background: 'var(--surface-2)' }}>
                      <div className="session-title"><span style={{ color: 'var(--accent)' }}>Wk{ps.week || 1}{ps.dow != null ? ' · ' + DOW_SHORT[ps.dow] : ''}</span>{ps.label ? ' · ' + ps.label : ''} · {ps.title}</div>
                      {editSess === ps.id ? (
                        <WorkoutEditForm
                          initial={{ title: ps.title, focus: ps.focus, exercises: ps.exercises }}
                          saveLabel="Save session"
                          onCancel={() => setEditSess(null)}
                          onSave={async ({ title, focus, exercises }) => {
                            const { data, error: err } = await supabase.from('program_sessions')
                              .update({ title: title || ps.title, focus: focus || ps.focus, exercises })
                              .eq('id', ps.id).select().single()
                            if (err) throw err
                            setSessions((s) => ({ ...s, [pr.id]: (s[pr.id] || []).map((x) => (x.id === data.id ? data : x)) }))
                            setEditSess(null)
                          }}
                        />
                      ) : (
                        <>
                          <ol className="ex-list" style={{ marginTop: 6 }}>
                            {(ps.exercises || []).map((ex, i) => (
                              <li className="ex" key={i}>
                                <span className="ex-n">{i + 1}</span>
                                <div className="ex-body"><div className="ex-name">{ex.name}</div><ExSets ex={ex} /></div>
                              </li>
                            ))}
                          </ol>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn ghost sm" onClick={() => setEditSess(ps.id)}>Edit</button>
                            <button type="button" className="btn ghost sm" onClick={() => delSession(pr.id, ps.id)}>Remove</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {(sessions[pr.id] || []).length === 0 && <p className="muted-note">No sessions yet — add one below.</p>}

                  <div className="grid-2">
                    <label className="field">Add session
                      <select className="ex-select" value={addFor === pr.id ? pickTpl : ''} onChange={(e) => { setPickTpl(e.target.value); setAddFor(pr.id) }}>
                        <option value="">Choose a template…</option>
                        <option value="__custom__">+ Build a custom session</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </select>
                    </label>
                    <label className="field">Week<input type="number" min="1" inputMode="numeric" value={addFor === pr.id ? pickWeek : 1} onChange={(e) => { setPickWeek(e.target.value); setAddFor(pr.id) }} /></label>
                  </div>
                  <div className="grid-2">
                    <label className="field">Day
                      <select className="ex-select" value={addFor === pr.id ? pickDow : ''} onChange={(e) => { setPickDow(e.target.value); setAddFor(pr.id) }}>
                        <option value="">Any day</option>
                        {SCHED_DOW.map(([d, l]) => <option key={d} value={d}>{l}</option>)}
                      </select>
                    </label>
                    <label className="field">Label (optional)<input value={addFor === pr.id ? dayLabel : ''} onChange={(e) => { setDayLabel(e.target.value); setAddFor(pr.id) }} placeholder="e.g. Push A" /></label>
                  </div>

                  {addFor === pr.id && pickTpl === '__custom__' && (
                    <div className="stack" style={{ marginTop: 4 }}>
                      <div className="grid-2">
                        <label className="field">Session name<input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="e.g. Upper Push A" /></label>
                        <label className="field">Focus<input value={customFocus} onChange={(e) => setCustomFocus(e.target.value)} placeholder="e.g. Push" /></label>
                      </div>
                      <ExerciseRowsEditor rows={customRows} setRows={setCustomRows} />
                    </div>
                  )}

                  {addFor === pr.id && addError && <p className="error">{addError}</p>}
                  <button type="button" className="btn ghost" onClick={() => addSession(pr.id)}>Add to program</button>
                  <ProgramMetaEditor program={pr} onSaved={(up) => setPrograms((ps) => ps.map((x) => (x.id === up.id ? up : x)))} />
                  <ProgramSchedule program={pr} onSaved={(up) => setPrograms((ps) => ps.map((x) => (x.id === up.id ? up : x)))} />
                  <button type="button" className="link-btn" onClick={() => delProgram(pr.id)}>Delete program</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!creating ? (
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => { setCreating(true); setError('') }}>{personal ? `Create a program for ${clientFirst}` : 'New program'}</button>
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
          {!personal && <label className="field">Only show to tag (optional)<input value={meta.audience_tag || ''} onChange={(e) => setMeta((m) => ({ ...m, audience_tag: e.target.value }))} placeholder="e.g. standard — blank shows to everyone" /></label>}
          <button className="btn primary big" onClick={createProgram}>{personal ? `Create for ${clientFirst}` : 'Create program'}</button>
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
  const { title, focus, rows, setTitle, setFocus, setRows, clear, hasDraft } = useWorkoutDraft('tpl:' + coachId)
  const [open, setOpen] = useState(hasDraft)
  const [audienceTag, setAudienceTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [tagEditId, setTagEditId] = useState(null)
  const [tagDraft, setTagDraft] = useState('')
  const [tagSaving, setTagSaving] = useState(false)

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
      audience_tag: audienceTag.trim().toLowerCase() || null,
    }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) {
      setItems((i) => [data, ...i])
      clear(); setAudienceTag(''); setOpen(false)
    }
  }

  function startTagEdit(t) { setTagEditId(t.id); setTagDraft(t.audience_tag || '') }
  async function saveTag(id) {
    setTagSaving(true)
    const audience_tag = tagDraft.trim().toLowerCase() || null
    const { data, error: err } = await supabase.from('workout_templates').update({ audience_tag }).eq('id', id).select().single()
    setTagSaving(false)
    if (!err && data) { setItems((i) => i.map((x) => (x.id === data.id ? data : x))); setTagEditId(null) }
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
                  <div className="session-sub">{t.focus ? t.focus + ' · ' : ''}{(t.exercises || []).length} exercise{(t.exercises || []).length === 1 ? '' : 's'}{t.audience_tag ? ` · only "${t.audience_tag}"` : ' · shows to everyone'}</div>
                </div>
                <span className="chev">{openId === t.id ? '−' : '+'}</span>
              </button>
              {openId === t.id && (tagEditId === t.id ? (
                <div className="stack" style={{ marginTop: 10 }}>
                  <label className="field">Only show to tag (optional)<input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="e.g. standard — blank shows to everyone" /></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn primary sm" disabled={tagSaving} onClick={() => saveTag(t.id)}>{tagSaving ? 'Saving…' : 'Save visibility'}</button>
                    <button type="button" className="link-btn" onClick={() => setTagEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : editId === t.id ? (
                <WorkoutEditForm
                  initial={{ title: t.title, focus: t.focus, exercises: t.exercises }}
                  titleLabel="Template name" saveLabel="Save template"
                  onCancel={() => setEditId(null)}
                  onSave={async ({ title, focus, exercises }) => {
                    const { data, error: err } = await supabase.from('workout_templates')
                      .update({ title: title || 'Session template', focus: focus || null, exercises })
                      .eq('id', t.id).select().single()
                    if (err) throw err
                    setItems((i) => i.map((x) => (x.id === data.id ? data : x))); setEditId(null)
                  }}
                />
              ) : (
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn ghost sm" onClick={() => setEditId(t.id)}>Edit template</button>
                    <button type="button" className="btn ghost sm" onClick={() => startTagEdit(t)}>Edit visibility</button>
                    <button type="button" className="btn ghost sm" onClick={() => del(t.id)}>Delete template</button>
                  </div>
                </>
              ))}
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
          <label className="field">Only show to tag (optional)<input value={audienceTag} onChange={(e) => setAudienceTag(e.target.value)} placeholder="e.g. standard — blank shows to everyone" /></label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary big" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save template'}</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError('') }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function AssignWorkout({ clientId, trainerId, onAssigned }) {
  const { title, focus, rows, setTitle, setFocus, setRows, clear, hasDraft } = useWorkoutDraft('assign:' + clientId)
  const [open, setOpen] = useState(hasDraft)
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
      clear()
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

