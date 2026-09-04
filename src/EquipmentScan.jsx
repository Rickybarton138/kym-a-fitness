import React, { useRef, useState } from 'react'
import { scaleImageToBase64 } from './lib.js'

// Photos of a space in, a corrected list of kit out.
//
// The review step is the point of this component, not decoration. What comes
// back from the photos is a first draft: anything the AI invented gets removed
// and anything it missed gets typed in, BEFORE a programme is built from it.
// Twelve weeks of training built around a machine that is not in the room is a
// failure nobody would trace back to a photo.
//
// Used by the coach (kit at a 1-2-1 client's home) and by the client
// themselves (their own home gym), so the two can never drift apart.
const MAX = 4

export function EquipmentScan({ items, setItems, label = 'Photos of your kit', hint }) {
  const [shots, setShots] = useState([])   // { data, preview }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [typed, setTyped] = useState('')
  const [scanned, setScanned] = useState(false)
  const fileRef = useRef(null)

  async function add(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setErr('')
    const room = MAX - shots.length
    if (room <= 0) { setErr(`Four photos is plenty — remove one first.`); return }
    try {
      const next = []
      for (const f of files.slice(0, room)) {
        next.push({ data: await scaleImageToBase64(f, 1000), preview: URL.createObjectURL(f) })
      }
      setShots((s) => [...s, ...next])
    } catch {
      setErr('Could not read one of those photos — try another.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function scan() {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/.netlify/functions/equipment-scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images: shots.map((s) => ({ data: s.data, mediaType: 'image/jpeg' })) }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Could not read the photos.')
      // Merged, not replaced: anything already added by hand survives a re-scan.
      setItems([...new Set([...(items || []), ...(j.items || [])])])
      setNote(j.note || '')
      setScanned(true)
      if (!(j.items || []).length) setErr('Nothing recognisable in those photos — add your kit below by hand.')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const addTyped = () => {
    const v = typed.trim()
    if (!v) return
    setItems([...new Set([...(items || []), v])])
    setTyped('')
  }

  return (
    <div className="stack">
      <p className="eyebrow">{label}</p>
      {hint && <p className="muted-note">{hint}</p>}

      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" onChange={add} />
      {shots.length > 0 && (
        <div className="equip-shots">
          {shots.map((s, i) => (
            <div className="equip-shot" key={i}>
              <img src={s.preview} alt={`Kit ${i + 1}`} />
              <button type="button" className="row-del" onClick={() => setShots((x) => x.filter((_, j) => j !== i))} aria-label="Remove photo">×</button>
            </div>
          ))}
        </div>
      )}
      {shots.length > 0 && (
        <button type="button" className="btn ghost" disabled={busy} onClick={scan}>
          {busy ? 'Looking at the photos…' : scanned ? 'Scan again' : `Find the kit in ${shots.length === 1 ? 'this photo' : `these ${shots.length} photos`}`}
        </button>
      )}
      {note && <p className="muted-note">{note}</p>}
      {err && <p className="error">{err}</p>}

      <p className="muted-note" style={{ marginTop: 4 }}>
        {scanned
          ? 'Check this list before building anything — remove what is not there, add what was missed.'
          : 'Or just list the kit yourself.'}
      </p>
      {(items || []).length > 0 && (
        <div className="chips">
          {items.map((it) => (
            <button type="button" className="chip" key={it} onClick={() => setItems(items.filter((x) => x !== it))} title="Remove">
              {it} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="ex-name-in" style={{ flex: 1 }} value={typed} placeholder="Add a piece of kit"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped() } }}
        />
        <button type="button" className="btn ghost sm" onClick={addTyped}>Add</button>
      </div>
    </div>
  )
}
