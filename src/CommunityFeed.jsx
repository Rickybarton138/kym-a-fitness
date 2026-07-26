import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient.js'

// One feed per coach — the coach and all their clients share it. `me` is the
// viewer's profile id, `communityCoachId` is the coach whose community this is
// (a client's trainer_id, or the coach's own id).
export function CommunityFeed({ communityCoachId, me, myName, isCoach }) {
  const [posts, setPosts] = useState([])
  const [cheers, setCheers] = useState({})
  const [body, setBody] = useState('')
  const [imgFile, setImgFile] = useState(null)
  const [imgPreview, setImgPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tags, setTags] = useState([])       // coach's tag vocabulary (for targeting)
  const [audience, setAudience] = useState('') // '' = everyone
  const [link, setLink] = useState('')
  const fileRef = useRef(null)

  const pubUrl = (path) => supabase.storage.from('content-images').getPublicUrl(path).data.publicUrl

  async function load() {
    if (!communityCoachId) return
    const { data: ps } = await supabase.from('community_posts').select('*').eq('coach_id', communityCoachId).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50)
    setPosts(ps || [])
    const ids = (ps || []).map((p) => p.id)
    if (ids.length) {
      const { data: cs } = await supabase.from('community_cheers').select('post_id, user_id').in('post_id', ids)
      const map = {}
      ;(cs || []).forEach((c) => {
        map[c.post_id] = map[c.post_id] || { count: 0, mine: false }
        map[c.post_id].count++
        if (c.user_id === me) map[c.post_id].mine = true
      })
      setCheers(map)
    } else setCheers({})
  }
  useEffect(() => { load() }, [communityCoachId])

  // Coach only: load the tags they've assigned, to target posts by audience.
  useEffect(() => {
    if (!isCoach || !communityCoachId) return
    supabase.from('client_tags').select('tag').eq('coach_id', communityCoachId)
      .then(({ data }) => setTags([...new Set((data || []).map((r) => r.tag))].sort()))
  }, [isCoach, communityCoachId])

  const linkText = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }

  function pickImg(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setImgFile(f); setImgPreview(URL.createObjectURL(f))
  }

  async function post() {
    const text = body.trim()
    if (!text && !imgFile) return
    if (!communityCoachId) { setError('Join a coach first to post.'); return }
    setBusy(true); setError('')
    try {
      let image_path = null
      if (imgFile) {
        const ext = (imgFile.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${me}/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from('content-images').upload(path, imgFile, { contentType: imgFile.type || 'image/jpeg' })
        if (up.error) throw new Error(up.error.message)
        image_path = path
      }
      const linkOk = /^https?:\/\/\S+$/.test(link.trim())
      const { data } = await supabase.from('community_posts').insert({
        coach_id: communityCoachId, author_id: me, author_name: myName, body: text, image_path,
        audience_tag: isCoach && audience ? audience : null,
        link_url: linkOk ? link.trim() : null,
      }).select().single()
      if (data) { setPosts((p) => [data, ...p]); setBody(''); setImgFile(null); setImgPreview(null); setLink(''); setAudience(''); if (fileRef.current) fileRef.current.value = '' }
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function toggleCheer(postId) {
    const cur = cheers[postId] || { count: 0, mine: false }
    setCheers((m) => ({ ...m, [postId]: { count: Math.max(cur.count + (cur.mine ? -1 : 1), 0), mine: !cur.mine } }))
    if (cur.mine) await supabase.from('community_cheers').delete().eq('post_id', postId).eq('user_id', me)
    else await supabase.from('community_cheers').insert({ post_id: postId, user_id: me })
  }

  async function del(id) {
    await supabase.from('community_posts').delete().eq('id', id)
    setPosts((p) => p.filter((x) => x.id !== id))
  }

  // Coach only: pin/unpin a post. Pinned posts sort to the top (query order).
  async function togglePin(post) {
    const next = !post.pinned
    setPosts((ps) => {
      const updated = ps.map((x) => x.id === post.id ? { ...x, pinned: next } : x)
      return [...updated].sort((a, b) => (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1))
    })
    await supabase.from('community_posts').update({ pinned: next }).eq('id', post.id)
  }

  return (
    <div className="stack">
      <div className="card">
        <textarea className="community-input" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share a win, a PR, a milestone…" />
        {imgPreview && <img className="content-img" src={imgPreview} alt="" style={{ marginTop: 10 }} />}
        <input className="community-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Add a link (optional)" />
        {isCoach && tags.length > 0 && (
          <div className="community-audience">
            <span className="muted-note">Show to</span>
            <select className="ex-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="">Everyone</option>
              {tags.map((t) => <option key={t} value={t}>Only: {t}</option>)}
            </select>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImg} />
        <div className="community-actions">
          <button type="button" className="btn ghost small" onClick={() => fileRef.current?.click()}>{imgFile ? 'Change photo' : 'Add photo'}</button>
          <button type="button" className="btn primary" disabled={busy || (!body.trim() && !imgFile)} onClick={post}>{busy ? 'Posting…' : 'Post'}</button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {posts.length === 0 && <p className="muted-note">No posts yet — be the first to share a win.</p>}
      {posts.map((p) => {
        const c = cheers[p.id] || { count: 0, mine: false }
        return (
          <div className="card post" key={p.id}>
            <div className="post-head">
              <span className="avatar sm">{(p.author_name || '?').charAt(0).toUpperCase()}</span>
              <div className="post-author">{p.author_name || 'Member'}</div>
              {p.pinned && <span className="aud-chip pinned">Pinned</span>}
              {isCoach && p.audience_tag && <span className="aud-chip">Only: {p.audience_tag}</span>}
              {isCoach && <button type="button" className="link-btn inline" onClick={() => togglePin(p)}>{p.pinned ? 'Unpin' : 'Pin'}</button>}
              {(p.author_id === me || isCoach) && <button type="button" className="row-del" onClick={() => del(p.id)} aria-label="Delete">×</button>}
            </div>
            {p.body && <p className="post-body">{p.body}</p>}
            {p.link_url && <a className="post-link" href={p.link_url} target="_blank" rel="noopener noreferrer">{linkText(p.link_url)} ↗</a>}
            {p.image_path && <img className="content-img" src={pubUrl(p.image_path)} alt="" />}
            <button type="button" className={'cheer' + (c.mine ? ' on' : '')} onClick={() => toggleCheer(p.id)}>Cheer{c.count > 0 ? ' · ' + c.count : ''}</button>
          </div>
        )
      })}
    </div>
  )
}
