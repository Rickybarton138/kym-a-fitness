import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient.js'

// VALD integration UI (gated behind features.vald). CoachVald = connect + link
// athletes; ValdTests = show synced ForceDecks / SmartSpeed results for a client.

const SYSTEM_LABEL = { forcedecks: 'ForceDecks (force plates)', smartspeed: 'SmartSpeed (sprint)' }

// Prettify a metric key: jumpHeight -> Jump height, asymmetryPct -> Asymmetry.
function prettyKey(k) {
  return k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
    .replace(/\bpct\b/i, '').replace(/\bn\b/i, '').trim()
    .replace(/^./, (c) => c.toUpperCase())
}
const isAsym = (k) => /asym/i.test(k)
const unitFor = (k) => (/height/i.test(k) ? ' cm' : /pct|asym/i.test(k) ? '%' : /force|\bn\b/i.test(k) ? ' N' : /time|split/i.test(k) ? ' s' : '')

// Render a test's metrics generically — works for any VALD field shape.
function Metrics({ metrics }) {
  const entries = Object.entries(metrics || {}).filter(([, v]) => typeof v === 'number' || (typeof v === 'string' && v.length < 16))
  if (!entries.length) return null
  return (
    <div className="vald-metrics">
      {entries.slice(0, 8).map(([k, v]) => {
        const flag = isAsym(k) && Number(v) > 10
        return (
          <div className="vald-metric" key={k}>
            <span className="vald-mk">{prettyKey(k)}</span>
            <span className={'vald-mv' + (flag ? ' flag' : '')}>{v}{unitFor(k)}{flag ? ' ⚠' : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ValdTests({ clientId, title = 'Force & speed testing' }) {
  const [tests, setTests] = useState(null)
  useEffect(() => {
    supabase.from('vald_tests').select('*').eq('client_id', clientId).order('recorded_at', { ascending: false }).limit(20)
      .then(({ data }) => setTests(data || []))
  }, [clientId])
  if (tests === null) return null
  if (tests.length === 0) return null // hide until data syncs
  // Latest per system.
  const bySystem = {}
  for (const t of tests) { (bySystem[t.system] = bySystem[t.system] || []).push(t) }
  return (
    <div className="card">
      <p className="eyebrow accent">{title}</p>
      <p className="muted-note">Synced automatically from your VALD hardware.</p>
      {Object.entries(bySystem).map(([sys, list]) => {
        const latest = list[0]
        return (
          <div className="vald-sys" key={sys}>
            <div className="vald-sys-head">{SYSTEM_LABEL[sys] || sys}</div>
            <div className="vald-test-latest">
              <div className="vald-test-title">{latest.test_type || 'Test'}<span className="vald-when">{latest.recorded_at ? new Date(latest.recorded_at).toLocaleDateString('en-GB') : ''}</span></div>
              <Metrics metrics={latest.metrics} />
            </div>
            {list.length > 1 && <p className="muted-note">{list.length} tests on record</p>}
          </div>
        )
      })}
    </div>
  )
}

export function CoachVald({ coachId, clients }) {
  const [status, setStatus] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ region: '', token_url: '', forcedecks_url: '', smartspeed_url: '', client_id: '', client_secret: '', tenant_id: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [links, setLinks] = useState({})

  async function loadStatus() {
    const { data } = await supabase.rpc('vald_status')
    setStatus((data && data[0]) || { connected: false })
  }
  async function loadLinks() {
    const { data } = await supabase.from('vald_profile_links').select('client_id, vald_profile_id')
    const m = {}; (data || []).forEach((l) => { m[l.client_id] = l.vald_profile_id })
    setLinks(m)
  }
  useEffect(() => { loadStatus(); loadLinks() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function connect() {
    if (!form.client_id || !form.client_secret || !form.tenant_id || !form.token_url) { setMsg('Fill in the token URL, client ID, secret and tenant ID.'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('vald_connect', {
      p_region: form.region || null, p_token_url: form.token_url, p_forcedecks_url: form.forcedecks_url || null,
      p_smartspeed_url: form.smartspeed_url || null, p_client_id: form.client_id, p_client_secret: form.client_secret, p_tenant_id: form.tenant_id,
    })
    setBusy(false)
    if (error) { setMsg(error.message); return }
    setForm((f) => ({ ...f, client_secret: '' })); setOpen(false); setMsg('Connected — VALD data will sync automatically.')
    loadStatus()
  }
  async function disconnect() {
    await supabase.rpc('vald_disconnect'); loadStatus()
  }
  async function saveLink(clientId, valdProfileId) {
    await supabase.from('vald_profile_links').delete().eq('client_id', clientId)
    if (valdProfileId.trim()) {
      await supabase.from('vald_profile_links').insert({ coach_id: coachId, client_id: clientId, vald_profile_id: valdProfileId.trim() })
    }
    setLinks((m) => ({ ...m, [clientId]: valdProfileId.trim() }))
  }

  if (!status) return null
  return (
    <div className="card">
      <div className="nudge-head"><b>VALD integration</b>
        <span className={'vald-dot ' + (status.connected ? 'on' : 'off')}>{status.connected ? 'Connected' : 'Not connected'}</span>
      </div>
      <p className="muted-note">Sync ForceDecks and SmartSpeed tests straight into each athlete's profile. Get your API credentials from VALD Support (support@vald.com) and the base URLs from your region's API docs.</p>

      {status.connected && (
        <div className="vald-status">
          <div className="logrow"><span className="logname">Tenant</span><span className="logmac">{status.tenant_id || '—'}</span></div>
          <div className="logrow"><span className="logname">Last sync</span><span className="logmac">{status.last_sync ? new Date(status.last_sync).toLocaleString('en-GB') : 'not yet'}</span></div>
          {status.last_error && <p className="error">Last sync error: {status.last_error}</p>}
          <button className="btn ghost sm" onClick={disconnect}>Disconnect</button>
        </div>
      )}

      {!open && <button className="btn ghost" onClick={() => setOpen(true)}>{status.connected ? 'Update credentials' : 'Connect VALD'}</button>}
      {open && (
        <div className="stack" style={{ marginTop: 8 }}>
          <label className="field">Region<input value={form.region} onChange={set('region')} placeholder="e.g. Europe / US / Australia" /></label>
          <label className="field">Auth token URL<input value={form.token_url} onChange={set('token_url')} placeholder="Auth0 token endpoint from VALD" /></label>
          <label className="field">ForceDecks API base URL<input value={form.forcedecks_url} onChange={set('forcedecks_url')} placeholder="from VALD region docs" /></label>
          <label className="field">SmartSpeed API base URL<input value={form.smartspeed_url} onChange={set('smartspeed_url')} placeholder="from VALD region docs" /></label>
          <label className="field">Client ID<input value={form.client_id} onChange={set('client_id')} /></label>
          <label className="field">Client secret<input type="password" value={form.client_secret} onChange={set('client_secret')} placeholder="stored securely, never shown again" /></label>
          <label className="field">Tenant ID<input value={form.tenant_id} onChange={set('tenant_id')} placeholder="from the VALD Tenants API" /></label>
          <div className="nudge-actions">
            <button className="btn primary sm" disabled={busy} onClick={connect}>{busy ? 'Connecting…' : 'Save & connect'}</button>
            <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <p className="muted-note" style={{ marginTop: 8 }}>{msg}</p>}

      {status.connected && (clients || []).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="eyebrow">Match athletes to VALD profiles</p>
          <p className="muted-note">Paste each athlete's VALD profile ID so their tests land on the right profile.</p>
          {clients.map((c) => (
            <div className="add-row" key={c.id}>
              <span className="logname" style={{ flex: 1 }}>{c.full_name}</span>
              <input className="vald-link-in" defaultValue={links[c.id] || ''} placeholder="VALD profile ID"
                onBlur={(e) => saveLink(c.id, e.target.value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
