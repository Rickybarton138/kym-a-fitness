import React, { useEffect, useState } from 'react'
import { PARQ_QUESTIONS, anyYes, parqComplete, saveParq, latestParq, flaggedQuestions } from './parq.js'

// Shared PAR-Q UI. Three surfaces, one question set:
//   ParqQuestions — controlled form, used inside onboarding and the profile screen
//   ParqSection   — client's profile block: status + update
//   ParqReview    — coach's read-only view on a client (ClientDetail)

const dateLabel = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function ParqQuestions({ answers, setAnswers, medications, setMedications, injuries, setInjuries }) {
  const set = (key, patch) => setAnswers({ ...answers, [key]: { ...(answers[key] || {}), ...patch } })
  return (
    <>
      {PARQ_QUESTIONS.map((q, i) => {
        const a = answers[q.key] || {}
        return (
          <div className="card" key={q.key} style={{ marginTop: i === 0 ? 0 : 10 }}>
            <p style={{ margin: 0 }}>{q.text}</p>
            <div className="seg small" style={{ marginTop: 10 }}>
              <button type="button" className={a.yes === true ? 'on' : ''} onClick={() => set(q.key, { yes: true })}>Yes</button>
              <button type="button" className={a.yes === false ? 'on' : ''} onClick={() => set(q.key, { yes: false, detail: '' })}>No</button>
            </div>
            {a.yes === true && (
              <label className="field" style={{ marginTop: 8 }}>Tell us a bit more
                <input value={a.detail || ''} onChange={(e) => set(q.key, { detail: e.target.value })} placeholder="What happened, and when?" />
              </label>
            )}
          </div>
        )
      })}
      <div className="card" style={{ marginTop: 10 }}>
        <label className="field">Any medication you’re currently taking? (optional)
          <input value={medications} onChange={(e) => setMedications(e.target.value)} placeholder="e.g. inhaler, beta blockers" />
        </label>
        <label className="field" style={{ marginTop: 8 }}>Any injuries or surgery we should train around? (optional)
          <input value={injuries} onChange={(e) => setInjuries(e.target.value)} placeholder="e.g. left knee ACL repair 2024" />
        </label>
      </div>
    </>
  )
}

// Shown as soon as a client answers yes to anything. Advisory, never a lock — a
// "yes" is very often a managed condition, and stranding a paying client out of
// their own app helps nobody. The coach sees the same flag on their side.
export function ParqAdvice({ coachName }) {
  return (
    <div className="card" style={{ marginTop: 10, borderColor: 'var(--accent)' }}>
      <p style={{ margin: 0 }}>
        <b>Worth a word with your GP.</b> Based on your answers, we’d recommend speaking to your doctor
        before you start or step up your training. {coachName ? `${coachName} will see this too` : 'Your coach will see this too'} and
        can plan around it — you can carry on using the app in the meantime.
      </p>
    </div>
  )
}

export function ParqDeclaration({ value, onChange, agreed, setAgreed }) {
  return (
    <div className="card" style={{ marginTop: 10 }}>
      <label className="field" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 'auto', marginTop: 3 }} />
        <span>I confirm these answers are true and complete to the best of my knowledge, and I’ll tell my coach if anything changes.</span>
      </label>
      <label className="field" style={{ marginTop: 8 }}>Your full name
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type your name to sign" />
      </label>
    </div>
  )
}

// Client's own PAR-Q block inside the profile / health-details screen.
// onEditingChange lets the host screen (HealthDetails) hide everything else
// while the questionnaire is open — otherwise its own cards and Save button
// sit underneath the form, and "‹ Back" silently bins a part-filled PAR-Q.
export function ParqSection({ profile, coachName, onEditingChange }) {
  const [row, setRow] = useState(undefined) // undefined = loading, null = never completed
  const [editing, setEditing] = useState(false)
  const [answers, setAnswers] = useState({})
  const [medications, setMedications] = useState('')
  const [injuries, setInjuries] = useState('')
  const [name, setName] = useState(profile.full_name || '')
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { latestParq(profile.id).then(setRow) }, [profile.id])
  useEffect(() => { onEditingChange?.(editing) }, [editing])

  function startEdit() {
    setAnswers(row?.answers || {})
    setMedications(row?.medications || '')
    setInjuries(row?.injuries || '')
    setName(profile.full_name || '')
    setAgreed(false)
    setError('')
    setEditing(true)
  }

  async function submit() {
    setSaving(true); setError('')
    try {
      await saveParq({ clientId: profile.id, answers, medications, injuries, declaredName: name })
      setRow(await latestParq(profile.id))
      setEditing(false)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (row === undefined) return null
  const ready = parqComplete(answers) && agreed && name.trim().length > 1

  if (editing) {
    return (
      <div className="stack">
        <p className="eyebrow">Health questionnaire</p>
        <p className="muted-note">Answer every question. It goes straight to your coach.</p>
        <ParqQuestions
          answers={answers} setAnswers={setAnswers}
          medications={medications} setMedications={setMedications}
          injuries={injuries} setInjuries={setInjuries}
        />
        {anyYes(answers) && <ParqAdvice coachName={coachName} />}
        <ParqDeclaration value={name} onChange={setName} agreed={agreed} setAgreed={setAgreed} />
        {error && <p className="error">{error}</p>}
        <div className="seg" style={{ marginTop: 8 }}>
          <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          <button type="button" className="on" disabled={!ready || saving} onClick={submit}>{saving ? 'Saving…' : 'Submit'}</button>
        </div>
      </div>
    )
  }

  const flagged = row ? flaggedQuestions(row) : []
  return (
    <div className="card">
      <p className="eyebrow">Health questionnaire (PAR-Q)</p>
      {row ? (
        <>
          <p style={{ margin: '6px 0' }}>
            Completed <b>{dateLabel(row.created_at)}</b>
            {flagged.length > 0 ? ` · ${flagged.length} answer${flagged.length > 1 ? 's' : ''} flagged for your coach` : ' · nothing flagged'}
          </p>
          <p className="muted-note">Keep this up to date — redo it any time something changes.</p>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={startEdit}>Update questionnaire</button>
        </>
      ) : (
        <>
          <p style={{ margin: '6px 0' }}>You haven’t completed your health questionnaire yet.</p>
          <p className="muted-note">A few quick yes/no questions so your coach can train you safely.</p>
          <button className="btn primary" style={{ marginTop: 8 }} onClick={startEdit}>Complete it now</button>
        </>
      )}
    </div>
  )
}

// Coach-side read-only view of a client's latest PAR-Q.
export function ParqReview({ clientId }) {
  const [row, setRow] = useState(undefined)
  const [open, setOpen] = useState(false)
  useEffect(() => { latestParq(clientId).then(setRow) }, [clientId])
  if (row === undefined) return null

  if (!row) {
    return (
      <div className="card">
        <p className="eyebrow">PAR-Q</p>
        <p style={{ margin: '6px 0' }}>Not completed yet.</p>
        <p className="muted-note">They’ll be prompted on their plan for today until it’s done.</p>
      </div>
    )
  }

  const qs = row.questions?.length ? row.questions : PARQ_QUESTIONS
  const flagged = flaggedQuestions(row)
  return (
    <div className="card">
      <p className="eyebrow">PAR-Q</p>
      <p style={{ margin: '6px 0' }}>
        Completed <b>{dateLabel(row.created_at)}</b>
        {row.declared_name ? ` · signed ${row.declared_name}` : ''}
      </p>
      {flagged.length > 0 ? (
        <div className="card" style={{ borderColor: 'var(--accent)', marginTop: 8 }}>
          <b>{flagged.length} flagged</b>
          {flagged.map((q) => (
            <p key={q.key} style={{ margin: '8px 0 0' }}>
              {q.text}
              {row.answers[q.key]?.detail ? <span className="muted" style={{ display: 'block', fontSize: 13 }}>{row.answers[q.key].detail}</span> : null}
            </p>
          ))}
          <p className="muted-note" style={{ marginTop: 8 }}>GP clearance advised before starting or progressing.</p>
        </div>
      ) : <p className="muted-note">Nothing flagged.</p>}
      {(row.medications || row.injuries) && (
        <div style={{ marginTop: 8 }}>
          {row.medications && <p style={{ margin: '4px 0' }}><span className="muted">Medication:</span> {row.medications}</p>}
          {row.injuries && <p style={{ margin: '4px 0' }}><span className="muted">Injuries:</span> {row.injuries}</p>}
        </div>
      )}
      <button className="link-btn inline" style={{ marginTop: 8 }} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide all answers' : 'See all answers'}
      </button>
      {open && qs.map((q) => (
        <p key={q.key} style={{ margin: '8px 0 0' }}>
          <b>{row.answers[q.key]?.yes ? 'Yes' : 'No'}</b> — {q.text}
          {row.answers[q.key]?.detail ? <span className="muted" style={{ display: 'block', fontSize: 13 }}>{row.answers[q.key].detail}</span> : null}
        </p>
      ))}
    </div>
  )
}
