import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient.js'

// Tap an exercise name -> how-to. Shows the coach's own video if they set one, else
// a correct-form demo (start/end images) matched from the free exercise library,
// plus an AI-written description + coaching cues (cached in exercise_guides).

const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function videoEmbed(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' && u.searchParams.get('v')) return 'https://www.youtube.com/embed/' + u.searchParams.get('v')
    if (host === 'youtu.be') return 'https://www.youtube.com/embed/' + u.pathname.slice(1)
    if (host === 'vimeo.com') { const id = u.pathname.split('/').filter(Boolean)[0]; if (/^\d+$/.test(id)) return 'https://player.vimeo.com/video/' + id }
  } catch { /* not a URL */ }
  return null
}

export function ExerciseGuide({ ex, onClose }) {
  const [guide, setGuide] = useState(undefined) // undefined = loading

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const key = nameKey(ex.name)
      const { data } = await supabase.from('exercise_guides').select('how_to, cues, image_urls').eq('name_key', key).maybeSingle()
      if (data && data.how_to) { if (!cancelled) setGuide(data); return }
      try {
        const res = await fetch('/.netlify/functions/exercise-guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: ex.name }) })
        const j = await res.json()
        if (!cancelled) setGuide(j)
      } catch { if (!cancelled) setGuide({ how_to: '', cues: [], image_urls: [] }) }
    })()
    return () => { cancelled = true }
  }, [ex.name])

  const embed = ex.video ? videoEmbed(ex.video) : null
  const images = guide?.image_urls || []

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><b>{ex.name}</b><button className="link-btn" onClick={onClose}>Close</button></div>

        {embed ? (
          <div className="video-embed"><iframe src={embed} title={ex.name} allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
        ) : ex.video ? (
          <a className="btn ghost sm" href={ex.video} target="_blank" rel="noopener noreferrer">Watch the how-to video</a>
        ) : images.length > 0 ? (
          <div className="eg-images">{images.map((u, i) => <img key={i} src={u} alt={`${ex.name} demo ${i + 1}`} loading="lazy" />)}</div>
        ) : null}

        {guide === undefined && <p className="muted-note" style={{ marginTop: 10 }}>Loading how-to…</p>}
        {guide && guide.how_to && <p className="eg-howto">{guide.how_to}</p>}
        {guide && (guide.cues || []).length > 0 && (
          <ul className="eg-cues">{guide.cues.map((c, i) => <li key={i}>{c}</li>)}</ul>
        )}
        {ex.cue && <p className="muted-note" style={{ marginTop: 8 }}><b>Coach note:</b> {ex.cue}</p>}
        {guide && !guide.how_to && images.length === 0 && !ex.video && <p className="muted-note" style={{ marginTop: 10 }}>No how-to available for this one yet.</p>}
      </div>
    </div>
  )
}
