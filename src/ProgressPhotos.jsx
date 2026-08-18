import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

// Progress photos with side-by-side compare. Shared by the client's Progress hub
// and the coach's client detail — both just pass a clientId; RLS scopes access
// (client sees own body_scans; coach sees their clients'). Signed URLs come from
// the private body-photos bucket.
const POSE_FILTERS = [['front', 'Front'], ['side', 'Side'], ['back', 'Back'], ['', 'All']]
export function ProgressPhotos({ clientId }) {
  const [scans, setScans] = useState(null)
  const [urls, setUrls] = useState({})   // scan id -> signed url
  const [sel, setSel] = useState([])     // up to 2 selected ids to compare
  const [poseF, setPoseF] = useState('front') // filter so front compares to front

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

  // Keep at most two selected; a third tap drops the oldest.
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : (s.length >= 2 ? [s[1], id] : [...s, id])))

  if (scans === null) return <p className="muted-note">Loading photos…</p>
  if (scans.length === 0) return <p className="muted-note">No progress photos yet — add one from the Body scan tab.</p>

  const scanById = (id) => scans.find((s) => s.id === id)
  // Filter by pose (older no-pose scans count as "front"); comparing within one
  // angle is the point — front vs front, not front vs side.
  const shown = scans.filter((s) => poseF === '' || (s.pose || 'front') === poseF)
  return (
    <div className="stack">
      <div className="seg four">
        {POSE_FILTERS.map(([v, l]) => <button type="button" key={v || 'all'} className={poseF === v ? 'on' : ''} onClick={() => { setPoseF(v); setSel([]) }}>{l}</button>)}
      </div>
      {sel.length === 2 && (
        <div className="card">
          <p className="eyebrow accent">Side by side</p>
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
      )}
      <p className="muted-note">{sel.length === 2 ? 'Comparing two — tap another photo to swap.' : 'Tap two photos to compare them side by side.'}</p>
      {shown.length === 0 && <p className="muted-note">No {(POSE_FILTERS.find((p) => p[0] === poseF) || [])[1]?.toLowerCase()} photos yet.</p>}
      <div className="photo-grid">
        {shown.map((s) => (
          <button type="button" key={s.id} className={'photo-cell' + (sel.includes(s.id) ? ' on' : '')} onClick={() => toggle(s.id)}>
            {urls[s.id] ? <img src={urls[s.id]} alt="Progress" /> : <span className="muted-note">…</span>}
            <span className="photo-date">{(s.created_at || '').slice(0, 10)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
