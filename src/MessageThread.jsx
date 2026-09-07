import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

// Client <-> coach message thread. `me` is 'client' or 'coach' — my messages
// sit on the right, theirs on the left. Every message is logged and (for the
// client) feeds the Kim Brain's answers.
export function MessageThread({ clientId, me, placeholder }) {
  const [msgs, setMsgs] = useState([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase
      .from('messages').select('*').eq('client_id', clientId).order('created_at', { ascending: true })
    setMsgs(data || [])
  }
  useEffect(() => { load() }, [clientId])

  async function send() {
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setErr('')
    try {
      const { data, error } = await supabase.from('messages')
        .insert({ client_id: clientId, sender: me, body: text }).select().single()
      if (error) throw new Error(error.message)
      // Only clear the box once it is actually sent. Wiping it on a failed send
      // loses what they wrote, which is worse than the failure.
      if (data) { setMsgs((m) => [...m, data]); setBody('') }
    } catch (e) {
      setErr((e && e.message) || 'Message did not send — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="chat">
        {msgs.length === 0 && <p className="muted-note">No messages yet. Say hello.</p>}
        {msgs.map((m) => (
          <div className={'bubble ' + (m.sender === me ? 'q' : 'a')} key={m.id}>{m.body}</div>
        ))}
      </div>
      <div className="ask-bar">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder || 'Type a message…'}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
        />
        <button className="btn primary" disabled={busy || !body.trim()} onClick={send}>{busy ? 'Sending…' : 'Send'}</button>
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  )
}
