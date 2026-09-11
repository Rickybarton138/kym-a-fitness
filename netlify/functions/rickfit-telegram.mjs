// Rick.Fit accountability nudges, over Telegram.
//
// Deliberately NOT built on the shared nudge machinery. `nudges_due` and
// `daily_reminders_due` take only `p_secret` — no brand, no coach — so they
// return every client across all five brands, and they are paired with
// `*_mark_sent`. Calling them from here would mean either marking Kim's and
// Paul's clients as nudged without nudging them, or double-sending. Ricky asked
// twice for this session's work to stay on Rick.Fit, so this reads ONE client's
// own rows and touches nothing shared. `src/accountability.js` is untouched for
// the same reason: its copy is in Kim's voice and ships to Paul.
//
// Telegram rather than WhatsApp on purpose: no 24-hour window, no Meta template
// approval, no per-message cost, and it is two-way. A business-initiated
// WhatsApp message needs a pre-approved template unless Ricky messaged first
// within 24h, which is backwards for a nudge that exists to reach him when he
// has gone quiet.
//
// De-duplication is structural, not stored: each nudge fires on exactly one
// hour of the London clock, so the hourly schedule can only deliver it once a
// day. No state table, nothing to keep in sync.
//
// Env (Netlify, rick-fit site only):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// Both currently borrowed from Astra's alert-peace service, so these land in the
// same chat as Astra's operational alerts. Point TELEGRAM_CHAT_ID at a different
// chat, or a new bot, to separate them.

const SUPABASE_URL = 'https://ezwmfbuuopsnpanebtal.supabase.co'
const SUPABASE_KEY = 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT = process.env.TELEGRAM_CHAT_ID
const SECRET = process.env.NUDGE_CRON_SECRET

// RLS blocks the publishable key from reading macro_targets, nutrition_logs and
// body_measurements, so this goes through a SECURITY DEFINER RPC gated by the
// same NUDGE_CRON_SECRET the existing push functions use. The RPC hardcodes
// Ricky's client_id, so it cannot return another brand's client whoever calls it.
async function state() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rickfit_daily_state`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_secret: SECRET }),
  })
  if (!res.ok) throw new Error(`rickfit_daily_state ${res.status} ${await res.text()}`)
  const rows = await res.json()
  // An empty array means the secret was rejected. That is a configuration fault,
  // not a quiet day, and must not be reported as "nothing due".
  if (!rows.length) throw new Error('rickfit_daily_state returned no rows - NUDGE_CRON_SECRET wrong?')
  return rows[0]
}

async function send(text) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  const j = await res.json()
  if (!j.ok) throw new Error(`telegram ${j.error_code} ${j.description}`)
  return j
}

// The London hour, so nudges land at the time Ricky experiences rather than
// drifting an hour every March and October.
function londonHour(now = new Date()) {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false }).format(now)
  return Number(h) % 24
}

// One nudge per hour-of-day. Returning null means nothing is due, which is the
// normal outcome for 20 of the 24 hourly runs.
function compose(hour, s) {
  const proteinLeft = Math.max(0, s.target_protein - s.protein)
  const kcalLeft = Math.max(0, s.target_calories - s.kcal)

  if (hour === 8) {
    return `<b>Morning.</b>\nTarget today: ${s.target_calories} kcal, ${s.target_protein}g protein.\n\n${s.trained ? 'Already trained today.' : 'Not trained yet today.'}\nLog as you go — it only works if the numbers are real.`
  }

  if (hour === 14 && s.meals === 0) {
    return `<b>Nothing logged yet today.</b>\nIt is 2pm. Put breakfast and lunch in now while you can still remember them, not at 10pm when you are guessing.`
  }

  if (hour === 19) {
    if (proteinLeft > 60) {
      return `<b>Protein check: ${s.protein}g of ${s.target_protein}g.</b>\n${proteinLeft}g still to go, ${kcalLeft} kcal left to play with.\n\nThis is the number that decides whether the weight you lose is fat or muscle. Skyr, cottage cheese or a shake closes most of that gap in one go.`
    }
    if (proteinLeft > 0) {
      return `<b>${s.protein}g protein down, ${proteinLeft}g to go.</b> Close. One snack finishes it.`
    }
    return null
  }

  if (hour === 21 && !s.trained && s.meals === 0) {
    return `<b>No food logged and no session today.</b>\nOne quiet day is nothing. Two in a row is how the last stone crept back. Tomorrow: log breakfast before you do anything else.`
  }

  return null
}

export const handler = async (event) => {
  if (!TOKEN || !CHAT || !SECRET) {
    return { statusCode: 200, body: JSON.stringify({ skipped: 'TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID or NUDGE_CRON_SECRET not set' }) }
  }
  try {
    // ?hour=19 previews a specific nudge without waiting for the clock. Behind the
    // cron secret, because otherwise anyone who finds the URL can make the phone
    // buzz. Twenty of the twenty-four hourly runs send nothing, so without this
    // there is no way to tell "working" from "quietly broken" until 8am tomorrow.
    const q = event?.queryStringParameters || {}
    const forced = q.secret === SECRET && q.hour !== undefined ? Number(q.hour) : null
    const hour = Number.isInteger(forced) ? forced : londonHour()
    const s = await state()
    const text = compose(hour, s)
    if (!text) return { statusCode: 200, body: JSON.stringify({ hour, sent: false, state: s }) }
    await send(text)
    return { statusCode: 200, body: JSON.stringify({ hour, sent: true, state: s }) }
  } catch (e) {
    // Surfaced, not swallowed: a nudge that never arrives is indistinguishable
    // from a nudge that was not due.
    return { statusCode: 500, body: JSON.stringify({ error: String(e.message || e) }) }
  }
}

export const config = { schedule: '5 * * * *' }
