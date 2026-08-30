import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

// Progress photos with side-by-side compare. Shared by the client's Progress hub
// and the coach's client detail — both just pass a clientId; RLS scopes access
// (client sees own body_scans; coach sees their clients'). Signed URLs come from
// the private body-photos bucket.
//
// `canEdit` turns on fixing a photo that went in wrong — the wrong date, or the
// wrong photo entirely. Only passed where the viewer owns the photos.
const POSE_FILTERS = [['front', 'Front'], ['side', 'Side'], ['back', 'Back'], ['', 'All']]

export function ProgressPhotos({ clientId, canEdit = false }) {
  const [scans, setScans] = useState(null)
  const [urls, setUrls] = useState({})   // scan id -> signed url
  const [sel, setSel] = useState([])     // up to 2 selected ids to compare
  const [poseF, setPoseF] = useState('front') // filter so front compares to front
  const [showCompare, setShowCompare] = useState(false)
  const [editId, setEditId] = useState(null) // scan being corrected
  const [dateDraft, setDateDraft] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    supabase.from('body_scans').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(40)
      .then(async ({ data }) => {
        if (!alive) return
        setScans(data || [])
        const entries = await Promise.all((data || []).map(async (s) => {
          const { data: signed } = await supabase.storage.from('body-photos').createSignedUrl(s.photo_path, 3600)
          return [s.id, signed?.signedUrl || null]
        }))
        if (alive) setUrls(Object.fromEntries(entries))
      })
    return () => { alive = false }
  }, [clientId])

  // Keep at most two selected; a third tap drops the oldest. Two selected opens
  // the comparison full-screen — side by side inside a card was too small to
  // read any real change off.
  const toggle = (id) => setSel((s) => {
    const next = s.includes(id) ? s.filter((x) => x !== id) : (s.length >= 2 ? [s[1], id] : [...s, id])
    if (next.length === 2) setShowCompare(true)
    return next
  })

  function openEdit(s) {
    setEditId(s.id)
    setDateDraft((s.created_at || '').slice(0, 10))
    setConfirmDel(false)
    setErr('')
  }

  async function saveDate() {
    setBusy(true); setErr('')
    // keep the time-of-day so same-day photos stay in the order they were taken
    const time = (scans.find((s) => s.id === editId)?.created_at || '').slice(10) || 'T12:00:00Z'
    const { data, error } = await supabase.from('body_scans')
      .update({ created_at: dateDraft + time }).eq('id', editId).select().single()
    setBusy(false)
    if (error) { setErr(error.message); return }
    setScans((cur) => cur.map((s) => (s.id === data.id ? data : s))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')))
    setEditId(null)
  }

  async function remove() {
    const s = scans.find((x) => x.id === editId)
    setBusy(true); setErr('')
    const { error } = await supabase.from('body_scans').delete().eq('id', editId)
    if (error) { setBusy(false); setErr(error.message); return }
    // the row is what the app reads; a stranded object is harmless if this fails
    if (s?.photo_path) await supabase.storage.from('body-photos').remove([s.photo_path]).catch(() => {})
    setBusy(false)
    setScans((cur) => cur.filter((x) => x.id !== editId))
    setSel((cur) => cur.filter((x) => x !== editId))
    setEditId(null)
  }

  if (scans === null) return <p className="muted-note">Loading photos…</p>
  if (scans.length === 0) return <p className="muted-note">No progress photos yet — add one from the Body scan tab.</p>

  const scanById = (id) => scans.find((s) => s.id === id)
  // Filter by pose (older no-pose scans count as "front"); comparing within one
  // angle is the point — front vs front, not front vs side.
  const shown = scans.filter((s) => poseF === '' || (s.pose || 'front') === poseF)
  const editing = editId ? scanById(editId) : null

  return (
    <div className="stack">
      <div className="seg four">
        {POSE_FILTERS.map(([v, l]) => <button type="button" key={v || 'all'} className={poseF === v ? 'on' : ''} onClick={() => { setPoseF(v); setSel([]) }}>{l}</button>)}
      </div>

      {sel.length === 2 && !showCompare && (
        <button type="button" className="btn ghost sm" onClick={() => setShowCompare(true)}>Compare these two</button>
      )}
      <p className="muted-note">{sel.length === 2 ? 'Comparing two — tap another photo to swap.' : 'Tap two photos to compare them side by side.'}</p>
      {shown.length === 0 && <p className="muted-note">No {(POSE_FILTERS.find((p) => p[0] === poseF) || [])[1]?.toLowerCase()} photos yet.</p>}

      <div className="photo-grid">
        {shown.map((s) => (
          <div className="photo-wrap" key={s.id}>
            <button type="button" className={'photo-cell' + (sel.includes(s.id) ? ' on' : '')} onClick={() => toggle(s.id)}>
              {urls[s.id] ? <img src={urls[s.id]} alt="Progress" /> : <span className="muted-note">…</span>}
              <span className="photo-date">{(s.created_at || '').slice(0, 10)}</span>
            </button>
            {canEdit && (
              <button type="button" className="photo-edit" onClick={() => openEdit(s)} aria-label="Fix this photo's date, or delete it">Edit</button>
            )}
          </div>
        ))}
      </div>

      {/* Full-screen compare — Paul's coaching view needs these big enough to
          actually read change off, not thumbnails inside a card. */}
      {showCompare && sel.length === 2 && (
        <div className="sheet-overlay" onClick={() => setShowCompare(false)}>
          <div className="compare-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compare-modal-top">
              <p className="eyebrow accent">Side by side</p>
              <button type="button" className="link-btn" onClick={() => setShowCompare(false)}>Close</button>
            </div>
            <div className="compare-2">
              {sel.map((id) => {
                const sc = scanById(id)
                return (
                  <div className="compare-col" key={id}>
                    <div className="shot">{urls[id] ? <img src={urls[id]} alt="Progress" /> : <p className="muted-note">…</p>}</div>
                    <p className="muted-note">{(sc?.created_at || '').slice(0, 10)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fix a photo that went in wrong */}
      {editing && (
        <div className="sheet-overlay" onClick={() => setEditId(null)}>
          <div className="card sheet" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow accent">Fix this photo</p>
            <div className="shot" style={{ maxHeight: 220, marginBottom: 10 }}>
              {urls[editing.id] ? <img src={urls[editing.id]} alt="Progress" /> : null}
            </div>
            <label className="field">Date taken
              <input type="date" value={dateDraft} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDateDraft(e.target.value)} />
            </label>
            {err && <p className="error">{err}</p>}
            <div className="nudge-actions" style={{ marginTop: 10 }}>
              <button type="button" className="btn primary sm" disabled={busy || !dateDraft} onClick={saveDate}>{busy ? 'Saving…' : 'Save date'}</button>
              <button type="button" className="btn ghost sm" onClick={() => setEditId(null)}>Cancel</button>
            </div>
            <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              {confirmDel ? (
                <>
                  <p className="muted-note" style={{ marginBottom: 8 }}>Delete this photo for good? It can’t be undone.</p>
                  <div className="nudge-actions">
                    <button type="button" className="btn primary sm" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Yes, delete it'}</button>
                    <button type="button" className="btn ghost sm" onClick={() => setConfirmDel(false)}>Keep it</button>
                  </div>
                </>
              ) : (
                <button type="button" className="link-btn" onClick={() => setConfirmDel(true)}>Delete this photo</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
