import { useEffect, useRef, useState } from 'react'

export function RickFitExerciseVideo({ clips, name }) {
  const [view, setView] = useState('A')
  const [failed, setFailed] = useState(false)
  const player = useRef(null)
  const clip = clips.find(c => c.view === view) || clips[0]
  useEffect(() => { setView('A'); setFailed(false) }, [name])
  useEffect(() => {
    setFailed(false)
    const video = player.current
    if (!video) return
    const pause = () => { if (document.hidden) video.pause() }
    document.addEventListener('visibilitychange', pause)
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) video.pause()
    })
    observer.observe(video)
    return () => { video.pause(); observer.disconnect(); document.removeEventListener('visibilitychange', pause) }
  }, [clip.id])
  return <div className="rick-exercise-demo">
    <div className="rick-exercise-views" role="group" aria-label="Exercise demonstration perspective">
      {clips.map(c => <button type="button" key={c.id} className="btn ghost sm" aria-pressed={c.view === clip.view} onClick={() => { player.current?.pause(); setView(c.view) }}>View {c.view}</button>)}
    </div>
    <p className="muted-note">{clip.camera}</p>
    <video key={clip.id} ref={player} className="rick-exercise-player" src={clip.src} poster={clip.poster} controls muted loop playsInline preload="none" aria-label={`${name} demonstration view ${clip.view}`} onError={() => setFailed(true)}>
      Your browser does not support inline video.
    </video>
    {failed && <p role="status" className="muted-note">Video could not load. <a href={clip.src} target="_blank" rel="noopener noreferrer">Open video</a></p>}
  </div>
}
