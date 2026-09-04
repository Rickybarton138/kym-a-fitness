import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { ACHIEVEMENTS, AWARD_GROUPS, BY_KEY, nextUp } from './achievements.js'

// Paul: "Can we have the app recognise milestones with progress, sessions, new
// pbs etc ... little awards for consecutive sessions hit."
//
// On open, sync_achievements() recomputes from real activity and returns ONLY
// what is newly earned, so anything new can be celebrated exactly once. It is
// idempotent, so re-opening the screen never re-announces an old award.
//
// `own` distinguishes the client seeing their own board ("You") from the coach
// looking at theirs ("Katie") — same component, same data, right words.
export function Awards({ clientId, own = true, name }) {
  const [earned, setEarned] = useState(null)
  const [fresh, setFresh] = useState([])

  useEffect(() => {
    let alive = true
    async function go() {
      // Sync first so the board is up to date the moment it is opened.
      const { data: added } = await supabase.rpc('sync_achievements', { p_client: clientId })
      const { data: all } = await supabase.from('client_achievements')
        .select('key, earned_on, value').eq('client_id', clientId).order('earned_on', { ascending: false })
      if (!alive) return
      setFresh((added || []).map((r) => r.key))
      setEarned(all || [])
    }
    go()
    return () => { alive = false }
  }, [clientId])

  if (earned === null) return null

  const who = own ? 'You have' : `${(name || 'They').split(' ')[0]} has`
  const have = earned.map((e) => e.key)
  const coming = nextUp(have)

  if (!earned.length) {
    return (
      <div className="card">
        <p className="eyebrow">Awards</p>
        <p className="muted-note">
          {own
            ? 'Log a session and your first award lands here. They are all for showing up and staying consistent — never for what you weigh.'
            : `No awards yet. They arrive automatically as ${(name || 'they').split(' ')[0]} trains and logs.`}
        </p>
        {coming.length > 0 && (
          <div className="award-grid" style={{ marginTop: 10 }}>
            {coming.slice(0, 3).map((a) => <AwardBadge key={a.key} award={a} locked />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <p className="eyebrow">Awards</p>
      {fresh.length > 0 && own && (
        <div className="award-new">
          <b>{fresh.length === 1 ? 'New award' : `${fresh.length} new awards`}</b>
          <span>{fresh.map((k) => BY_KEY[k]?.title).filter(Boolean).join(' · ')}</span>
        </div>
      )}
      <p className="muted-note">{who} earned {earned.length} of {ACHIEVEMENTS.length}. All for showing up and staying consistent.</p>

      {AWARD_GROUPS.map((g) => {
        const mine = earned
          .map((e) => ({ ...e, meta: BY_KEY[e.key] }))
          .filter((e) => e.meta && e.meta.group === g.id)
        if (!mine.length) return null
        return (
          <div key={g.id} style={{ marginTop: 12 }}>
            <p className="award-group">{g.label}</p>
            <div className="award-grid">
              {mine.map((e) => <AwardBadge key={e.key} award={e.meta} on={e.earned_on} isNew={fresh.includes(e.key)} />)}
            </div>
          </div>
        )
      })}

      {coming.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="award-group">Next up</p>
          <div className="award-grid">
            {coming.map((a) => <AwardBadge key={a.key} award={a} locked />)}
          </div>
        </div>
      )}
    </div>
  )
}

function AwardBadge({ award, on, locked, isNew }) {
  return (
    <div className={'award' + (locked ? ' locked' : '') + (isNew ? ' is-new' : '')} title={award.blurb}>
      <span className="award-glyph">{award.glyph}</span>
      <span className="award-title">{award.title}</span>
      <span className="award-sub">{locked ? award.blurb : on}</span>
    </div>
  )
}
