// Member CRM: turn raw activity signals into a churn-risk segment per member.
// "Last active" = the most recent of any engagement signal we hold.

export const SEGMENTS = {
  active:  { key: 'active',  label: 'Active',  color: 'green', order: 3, needs: false },
  new:     { key: 'new',     label: 'New',     color: 'grey',  order: 2, needs: false },
  atrisk:  { key: 'atrisk',  label: 'At risk', color: 'amber', order: 1, needs: true },
  dormant: { key: 'dormant', label: 'Dormant', color: 'red',   order: 0, needs: true },
}

const DAY = 86400000

export function memberSegment({ lastActiveMs, joinedMs, now = Date.now() }) {
  const sinceJoin = joinedMs ? (now - joinedMs) / DAY : 9999
  if (lastActiveMs == null) return sinceJoin <= 14 ? SEGMENTS.new : SEGMENTS.dormant
  const sinceActive = (now - lastActiveMs) / DAY
  if (sinceActive <= 7) return SEGMENTS.active
  if (sinceActive <= 20) return SEGMENTS.atrisk
  return SEGMENTS.dormant
}

export function daysSince(ms, now = Date.now()) {
  if (!ms) return null
  return Math.floor((now - ms) / DAY)
}

export function lastSeenLabel(lastActiveMs, now = Date.now()) {
  const d = daysSince(lastActiveMs, now)
  if (d == null) return 'Never active'
  if (d <= 0) return 'Seen today'
  if (d === 1) return 'Seen yesterday'
  if (d < 7) return `Seen ${d} days ago`
  if (d < 14) return 'Seen last week'
  if (d < 28) return `Seen ${Math.floor(d / 7)} weeks ago`
  return `Seen ${Math.floor(d / 30)} month${d < 60 ? '' : 's'} ago`
}

const ms = (v) => (v ? new Date(v).getTime() : 0)

// Fetch every engagement signal for the coach's members and reduce to the most
// recent activity per member, then attach a churn-risk segment. Returns members
// sorted most-urgent first (dormant, then at-risk, then new, then active).
export async function loadMemberActivity(supabase, clients, now = Date.now()) {
  const [nut, wc, cb, ci, bm] = await Promise.all([
    supabase.from('nutrition_logs').select('client_id, logged_at'),
    supabase.from('workout_completions').select('client_id, completed_on'),
    supabase.from('class_bookings').select('client_id, session_date, status'),
    supabase.from('weekly_checkins').select('client_id, created_at'),
    supabase.from('body_measurements').select('client_id, measured_at'),
  ])
  const last = {}
  const bump = (id, t) => { if (id && t && t > (last[id] || 0)) last[id] = t }
  ;(nut.data || []).forEach((r) => bump(r.client_id, ms(r.logged_at)))
  ;(wc.data || []).forEach((r) => bump(r.client_id, ms(r.completed_on)))
  ;(cb.data || []).forEach((r) => { if (r.status === 'attended') bump(r.client_id, ms(r.session_date)) })
  ;(ci.data || []).forEach((r) => bump(r.client_id, ms(r.created_at)))
  ;(bm.data || []).forEach((r) => bump(r.client_id, ms(r.measured_at)))

  const rows = (clients || []).map((c) => {
    const lastActiveMs = last[c.id] || null
    const seg = memberSegment({ lastActiveMs, joinedMs: ms(c.created_at), now })
    return { ...c, lastActiveMs, seg }
  })
  rows.sort((a, b) => a.seg.order - b.seg.order || (a.lastActiveMs || 0) - (b.lastActiveMs || 0))
  return rows
}

export function segmentCounts(rows) {
  const c = { active: 0, new: 0, atrisk: 0, dormant: 0 }
  rows.forEach((r) => { c[r.seg.key]++ })
  return c
}
