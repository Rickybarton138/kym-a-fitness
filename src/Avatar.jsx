import React, { useEffect, useRef, useState } from 'react'
import { signedAvatarUrl, signedAvatarUrls, uploadAvatar, removeAvatar, initialOf } from './avatar.js'

// Signed URLs for a whole list in ONE request. Returns an object keyed by
// avatar_path; a path that is missing from it just falls back to the initial.
//
// The dependency is the joined list of paths rather than the array itself, so a
// parent that rebuilds its rows array on every render (which the coach
// dashboard does, it filters in place) does not re-sign every face each time.
export function useAvatarUrls(rows) {
  const paths = (rows || []).map((r) => r?.avatar_path).filter(Boolean)
  const key = paths.join(',')
  const [urls, setUrls] = useState({})
  useEffect(() => {
    if (!key) { setUrls({}); return }
    let live = true
    signedAvatarUrls(key.split(',')).then((m) => { if (live) setUrls(m) })
    return () => { live = false }
  }, [key])
  return urls
}

// A client's picture wherever one is shown, falling back to the initial that
// used to be there. Every existing call site rendered `<span className="avatar">`
// with a letter in it, so this keeps the same class and the same shape and the
// fallback is identical to the old behaviour -- a brand that never uploads a
// single picture looks exactly as it does today.
//
// Pass `url` when the caller already has a signed URL (a list that batched
// them); pass `path` to let this resolve its own.
export function Avatar({ path, url, name, className = '' }) {
  const [src, setSrc] = useState(url || null)

  useEffect(() => {
    if (url) { setSrc(url); return }
    if (!path) { setSrc(null); return }
    let live = true
    signedAvatarUrl(path).then((u) => { if (live) setSrc(u) })
    return () => { live = false }
  }, [path, url])

  return (
    <span className={'avatar' + (className ? ' ' + className : '')}>
      {/* alt is empty on purpose: the name is always rendered next to it, and a
          screen reader announcing it twice is noise. */}
      {src ? <img src={src} alt="" /> : initialOf(name)}
    </span>
  )
}

// The account screen's picture + "Change photo" / "Remove". Hands the new path
// back up so the parent's cached profile stays in step without a reload.
export function AvatarPicker({ profile, onChanged }) {
  const [path, setPath] = useState(profile.avatar_path || null)
  const [src, setSrc] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    let live = true
    if (!path) { setSrc(null); return }
    signedAvatarUrl(path).then((u) => { if (live) setSrc(u) })
    return () => { live = false }
  }, [path])

  async function pick(e) {
    const file = e.target.files?.[0]
    // Clear the input straight away, or picking the same file twice in a row
    // fires no change event and looks like a dead button.
    e.target.value = ''
    if (!file) return
    setBusy('Uploading…'); setError('')
    try {
      const next = await uploadAvatar({ clientId: profile.id, file, previousPath: path })
      setPath(next)
      onChanged?.(next)
    } catch (err) {
      setError(err.message || 'That did not upload.')
    }
    setBusy('')
  }

  async function clear() {
    setBusy('Removing…'); setError('')
    try {
      await removeAvatar({ clientId: profile.id, path })
      setPath(null)
      onChanged?.(null)
    } catch (err) {
      setError(err.message || 'That did not save.')
    }
    setBusy('')
  }

  return (
    <div className="avatar-picker">
      <Avatar path={path} url={src} name={profile.full_name} className="lg" />
      <div className="avatar-picker-actions">
        <input
          ref={fileRef} type="file" accept="image/*" onChange={pick}
          style={{ display: 'none' }}
        />
        <button className="btn ghost sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {busy || (path ? 'Change photo' : 'Add a photo')}
        </button>
        {path && !busy && (
          <button className="link-btn" onClick={clear}>Remove</button>
        )}
        {error && <p className="error" style={{ margin: '6px 0 0' }}>{error}</p>}
      </div>
    </div>
  )
}
