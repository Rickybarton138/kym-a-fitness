import React from 'react'

// Coach-side cashflow view — the "Monday-morning money picture" for a gym owner.
// Demo data only: it illustrates what a GoCardless-backed collection layer would
// surface (money in & when, arrears, auto-recovery) so an owner can feel more in
// control than their current provider. Numbers are indicative, not live.

const GBP = (n) => '£' + Math.round(n).toLocaleString('en-GB')

const NEXT_RUNS = [
  { date: '1 Aug',  members: 96, amount: 3690 },
  { date: '8 Aug',  members: 41, amount: 1520 },
  { date: '15 Aug', members: 58, amount: 2210 },
  { date: '22 Aug', members: 20, amount: 760 },
]
const NEXT_30 = NEXT_RUNS.reduce((s, r) => s + r.amount, 0)
const MEMBERS = NEXT_RUNS.reduce((s, r) => s + r.members, 0)

const MONTHS = [
  { m: 'May', v: 7610, kind: 'actual' },
  { m: 'Jun', v: 7880, kind: 'actual' },
  { m: 'Jul', v: 8230, kind: 'actual' },
  { m: 'Aug', v: 8180, kind: 'forecast' },
  { m: 'Sep', v: 8340, kind: 'forecast' },
  { m: 'Oct', v: 8520, kind: 'forecast' },
]
const MONTH_MAX = Math.max(...MONTHS.map((x) => x.v))

const ARREARS = [
  { name: 'Danny Fisher',  amount: 42, status: 'Retry scheduled · 18 Jul', tone: 'warn' },
  { name: 'Sophie Niles',  amount: 38, status: '2nd reminder sent',         tone: 'warn' },
  { name: 'Aaron Webb',    amount: 45, status: 'Flag at desk · 3 misses',   tone: 'bad'  },
  { name: 'Priya Shah',    amount: 32, status: 'Retry scheduled · 19 Jul',  tone: 'warn' },
  { name: 'Leon Carter',   amount: 55, status: 'Recovered today',           tone: 'good' },
]
const ARREARS_TOTAL = 340
const ARREARS_COUNT = 9

const TONE = { good: '#3fa66a', warn: '#d9a441', bad: '#d1595c' }

export function CashflowDashboard() {
  const runMax = Math.max(...NEXT_RUNS.map((r) => r.amount))
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <p className="eyebrow accent">Cashflow</p>
      <p className="muted-note" style={{ marginTop: 0 }}>
        Your money picture at a glance — what's coming in, when, and what needs chasing. Chasing runs itself.
      </p>

      {/* Hero — expected next 30 days */}
      <div style={{
        marginTop: 12, padding: '16px 18px', borderRadius: 'var(--radius)',
        background: 'var(--surface-2)', border: '1px solid var(--line)',
      }}>
        <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
          Expected in the next 30 days
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: 'var(--accent)', letterSpacing: '-.02em' }}>
            {GBP(NEXT_30)}
          </div>
          <span className="delta good">+{GBP(240)} vs last month</span>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
          across {MEMBERS} active direct debits · 4 collection runs
        </div>
      </div>

      {/* Status strip */}
      <div className="metrics-2" style={{ marginTop: 12 }}>
        <Stat k="Collected this month" v={GBP(7410)} tone="good" />
        <Stat k="Still due" v={GBP(820)} tone="text" />
        <Stat k="In arrears" v={`${GBP(ARREARS_TOTAL)} · ${ARREARS_COUNT}`} tone="bad" />
        <Stat k="Auto-recovered" v={GBP(470)} tone="good" />
      </div>

      {/* Collection schedule */}
      <div style={{ marginTop: 18 }}>
        <p className="eyebrow">Collection schedule</p>
        <div className="stack" style={{ gap: 10 }}>
          {NEXT_RUNS.map((r) => (
            <div key={r.date}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{r.date}</span>
                <span style={{ color: 'var(--muted)' }}>{r.members} members · <b style={{ color: 'var(--text)' }}>{GBP(r.amount)}</b></span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: 'var(--ring-track)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (r.amount / runMax * 100) + '%', background: 'var(--accent)', borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6-month forecast */}
      <div style={{ marginTop: 18 }}>
        <p className="eyebrow">Money in — 6 month view</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, marginTop: 4 }}>
          {MONTHS.map((mo) => (
            <div key={mo.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>{(mo.v / 1000).toFixed(1)}k</div>
              <div style={{
                width: '100%', height: (mo.v / MONTH_MAX * 84) + 'px', borderRadius: 6,
                background: mo.kind === 'forecast' ? 'transparent' : 'var(--accent)',
                border: mo.kind === 'forecast' ? '1.5px dashed var(--accent)' : 'none',
              }} />
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{mo.m}</div>
            </div>
          ))}
        </div>
        <p className="muted-note" style={{ marginTop: 4 }}>Solid = collected · dashed = forecast from active memberships</p>
      </div>

      {/* Arrears & recovery */}
      <div style={{ marginTop: 18 }}>
        <p className="eyebrow">Arrears &amp; recovery</p>
        <p className="muted-note" style={{ marginTop: 0 }}>
          Failed payments are retried automatically. Anyone still owing is flagged red at the desk.
        </p>
        <div className="stack" style={{ gap: 8 }}>
          {ARREARS.map((a) => (
            <div key={a.name} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 'var(--radius)', background: 'var(--surface-2)', border: '1px solid var(--line)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TONE[a.tone], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>{a.status}</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: a.tone === 'good' ? TONE.good : 'var(--text)' }}>{GBP(a.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="muted-note" style={{ marginTop: 16, fontSize: 11.5, opacity: 0.8 }}>
        Demo figures. Collection &amp; auto-retry run on GoCardless (FCA-regulated BACS direct debit); this is the view you'd see on top.
      </p>
    </div>
  )
}

function Stat({ k, v, tone }) {
  const color = tone === 'good' ? TONE.good : tone === 'bad' ? TONE.bad : 'var(--text)'
  return (
    <div className="metric">
      <div className="metric-k">{k}</div>
      <div className="metric-v" style={{ color }}>{v}</div>
    </div>
  )
}
