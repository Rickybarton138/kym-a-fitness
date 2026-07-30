// VALD Hub sync: pulls ForceDecks (force plates) + SmartSpeed (sprint gates) test
// results into vald_tests, mapped to our athletes via vald_profile_links.
//
// Built to VALD's documented external API (OAuth2 client-credentials via Auth0;
// GET /tests?tenantId=&modifiedFromUtc=). Base URLs + credentials are per-coach,
// stored on vald_integrations. Exact token audience + response field names are
// confirmed against VALD's Swagger once a real tenant's credentials are in — the
// raw test object is stored in metrics so nothing is lost meanwhile. Marked TODO.

const SUPABASE_URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const SUPABASE_KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'
const SECRET = process.env.NUDGE_CRON_SECRET
const VALD_AUDIENCE = process.env.VALD_AUDIENCE || 'https://prd-use-api-externaltenants.valdperformance.com'

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status} ${await res.text()}`)
  return res.json()
}

// Auth0 client-credentials grant. VALD issues client_id/client_secret; the audience
// is VALD's external-API identifier (region-specific; override via VALD_AUDIENCE).
async function getToken(intg) {
  const res = await fetch(intg.token_url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: intg.client_id, client_secret: intg.client_secret, audience: VALD_AUDIENCE }),
  })
  if (!res.ok) throw new Error(`token ${res.status} ${await res.text()}`)
  const j = await res.json()
  return j.access_token
}

// Defensive field extraction — VALD field names are confirmed against Swagger when
// live; until then we read the common variants and keep the whole object in metrics.
const pick = (o, keys) => { for (const k of keys) if (o?.[k] != null) return o[k]; return null }

async function pullSystem(system, baseUrl, token, intg, sinceIso) {
  if (!baseUrl) return 0
  const url = `${baseUrl.replace(/\/$/, '')}/tests?tenantId=${encodeURIComponent(intg.tenant_id)}&modifiedFromUtc=${encodeURIComponent(sinceIso)}`
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`${system} tests ${res.status} ${await res.text()}`)
  const body = await res.json()
  const tests = Array.isArray(body) ? body : (body.tests || body.items || body.data || [])
  let n = 0
  for (const t of tests) {
    const profileId = pick(t, ['profileId', 'athleteId', 'profileID'])
    const testId = pick(t, ['testId', 'id', 'testGuid'])
    if (!profileId || !testId) continue
    await rpc('vald_upsert_test', {
      p_secret: SECRET,
      p_coach: intg.coach_id,
      p_vald_profile_id: String(profileId),
      p_system: system,
      p_test_type: pick(t, ['testType', 'type', 'name']),
      p_recorded_at: pick(t, ['recordedUtc', 'testDateUtc', 'modifiedDateUtc', 'recordedDateUtc']),
      p_vald_test_id: String(testId),
      p_metrics: t,
    }).catch(() => {})
    n++
  }
  return n
}

export async function runValdSync() {
  if (!SECRET) return { error: 'NUDGE_CRON_SECRET not set' }
  const integrations = await rpc('vald_integrations_due', { p_secret: SECRET })
  let synced = 0, failed = 0, tests = 0
  for (const intg of integrations) {
    // Only pull what's changed since last sync (fall back to 90 days on first run).
    const since = intg.last_sync || new Date(Date.now() - 90 * 86400000).toISOString()
    try {
      const token = await getToken(intg)
      tests += await pullSystem('forcedecks', intg.forcedecks_url, token, intg, since)
      tests += await pullSystem('smartspeed', intg.smartspeed_url, token, intg, since)
      await rpc('vald_mark_synced', { p_secret: SECRET, p_coach: intg.coach_id, p_error: null }).catch(() => {})
      synced++
    } catch (e) {
      await rpc('vald_mark_synced', { p_secret: SECRET, p_coach: intg.coach_id, p_error: String(e.message || e).slice(0, 300) }).catch(() => {})
      failed++
    }
  }
  return { integrations: integrations.length, synced, failed, tests }
}
