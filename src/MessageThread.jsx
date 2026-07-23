import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

// Client <-> coach message thread. `me` is 'client' or 'coach' — my messages
// sit on the right, theirs on the left. Every message is logged and (for the
// client) feeds the Kim Brain's answers.
export function MessageThread({ clientId, me, placeholder }) {
  const [msgs, setMsgs] = useState([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

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
    const { data } = await supabase.from('messages').insert({ client_id: clientId, sender: me, body: text }).select().single()
    if (data) { setMsgs((m) => [...m, data]); setBody('') }
    setBusy(false)
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
        <button className="btn primary" disabled={busy || !body.trim()} onClick={send}>Send</button>
      </div>
    </div>
  )
}
