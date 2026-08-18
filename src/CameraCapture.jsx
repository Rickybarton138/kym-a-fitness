import { useEffect, useRef, useState } from 'react'

// In-page camera capture — replaces handing off to the OS camera app.
// The native <input capture="environment"> flow backgrounds the browser tab
// while the OS camera app is open; on memory-constrained Android phones the
// OS can evict the backgrounded tab before the photo is handed back, which
// reloads the whole PWA mid-scan ("Unable to complete previous operation due
// to low memory"). Staying in-page means the tab is never backgrounded, so
// there's nothing for the OS to evict.
export function CameraCapture({ onCapture, onClose, maxDim = 1600 }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const galleryRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [shot, setShot] = useState(null) // captured frame, awaiting retake/use

  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) { setError('no-camera'); return }
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: maxDim }, height: { ideal: maxDim } },
    }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      setReady(true)
    }).catch(() => { if (!cancelled) setError('denied') })
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [maxDim])

  function stopStream() { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null }

  function capture() {
    const video = videoRef.current; if (!video) return
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight))
    const canvas = canvasRef.current
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    setShot(canvas.toDataURL('image/jpeg', 0.85))
  }

  function usePhoto() {
    canvasRef.current.toBlob((blob) => {
      if (!blob) return
      stopStream()
      onCapture(new File([blob], 'capture.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.85)
  }

  function onGalleryPick(e) {
    const file = e.target.files?.[0]
    if (file) { stopStream(); onCapture(file) }
  }

  function close() { stopStream(); onClose() }

  return (
    <div className="camera-overlay">
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onGalleryPick} />
      <div className="camera-top">
        <button type="button" className="camera-x" onClick={close} aria-label="Close">✕</button>
      </div>

      {!shot && !error && (
        <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
      )}
      {shot && <img className="camera-video" src={shot} alt="Captured" />}
      {error && (
        <div className="camera-fallback">
          <p>{error === 'denied' ? "Couldn't access your camera — check camera permission for this site, or pick a photo instead." : "Camera isn't available on this browser — pick a photo instead."}</p>
          <button type="button" className="btn primary" onClick={() => galleryRef.current?.click()}>Choose from gallery</button>
        </div>
      )}
      <canvas ref={canvasRef} hidden />

      {!error && (
        <div className="camera-controls">
          {!shot ? (
            <>
              <button type="button" className="link-btn camera-alt" onClick={() => galleryRef.current?.click()}>Gallery</button>
              <button type="button" className="camera-shutter" disabled={!ready} onClick={capture} aria-label="Take photo" />
              <span className="camera-alt" />
            </>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={() => setShot(null)}>Retake</button>
              <button type="button" className="btn primary" onClick={usePhoto}>Use photo</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
