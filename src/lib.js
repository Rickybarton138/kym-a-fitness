// Shared helpers.

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      const [, meta, data] = url.match(/^data:(.*?);base64,(.*)$/) || []
      if (!data) return reject(new Error('Could not read that image.'))
      resolve({ mediaType: meta || 'image/jpeg', data })
    }
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
}

// The active coach persona (set once after login) is attached to every AI call
// so answers speak in the client's own coach's voice.
let activePersona = null
export function setPersona(p) { activePersona = p }
export function getPersona() { return activePersona }

// The client's chosen nutrition detail level (lifestyle | performance), injected
// into every AI call so nutrition answers match their preference.
let activeNutritionStyle = null
export function setNutritionStyle(s) { activeNutritionStyle = s || null }

// Recovery-aware nutrition mode (set from the client's profile after login). When
// on, it's attached to every AI call so nutrition guidance is gentle and never
// pushes restriction/deficit. { on, note } — note = what they find hard.
let activeRecovery = null
export function setRecovery(r) { activeRecovery = r && r.on ? { on: true, note: r.note || '' } : null }
export function getRecovery() { return activeRecovery }

// Client-shared health conditions (PCOS, menopause, thyroid, PoTS etc — free
// text, client or coach set) + life circumstances (kids/single parent/shift
// work), set from the profile after login and attached to every AI call so
// tone and practical suggestions account for it. Informational only — never
// changes calorie/macro maths.
let activeHealthContext = null
export function setHealthContext(h) {
  activeHealthContext = h && (h.conditions || h.hasKids || h.singleParent || h.shiftWorker || h.note) ? h : null
}
export function getHealthContext() { return activeHealthContext }

// Call the serverless Claude proxy.
export async function analyze(payload) {
  let body = payload
  if (activePersona && !body.persona) body = { ...body, persona: activePersona }
  if (activeNutritionStyle && !body.nutritionStyle) body = { ...body, nutritionStyle: activeNutritionStyle }
  if (activeRecovery && !body.recovery) body = { ...body, recovery: activeRecovery }
  if (activeHealthContext && !body.healthContext) body = { ...body, healthContext: activeHealthContext }
  const res = await fetch(apiUrl('/.netlify/functions/analyze'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Something went wrong.')
  return json
}

// Start of today (local) as an ISO string, for filtering "today's" logs.
export function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// Monday of the current week as a YYYY-MM-DD date (for date columns).
export function startOfWeekISO() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// Extract a few still frames from a video File as base64 JPEGs (downscaled),
// so Claude vision can assess form without server-side video processing.
export async function extractFrames(file, count = 3) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    const url = URL.createObjectURL(file)
    video.src = url
    const frames = []
    let times = []
    let i = 0
    const done = () => { URL.revokeObjectURL(url); resolve(frames) }
    const seekNext = () => {
      if (i >= times.length) return done()
      try { video.currentTime = Math.min(times[i], (video.duration || 1) - 0.05) } catch { done() }
    }
    video.onloadedmetadata = () => {
      const dur = video.duration && isFinite(video.duration) ? video.duration : 1
      times = [0.2, 0.5, 0.8].slice(0, count).map((p) => dur * p)
      seekNext()
    }
    video.onseeked = () => {
      const w = video.videoWidth || 640
      const h = video.videoHeight || 360
      const scale = Math.min(1, 640 / w)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
      const b64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
      if (b64) frames.push(b64)
      i++
      seekNext()
    }
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the video.')) }
  })
}

// Downscale an image File/Blob to a base64 JPEG (no data: prefix) for vision.
export async function scaleImageToBase64(file, max = 800) {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close?.() // free the decoded full-res bitmap immediately (iOS memory)
    const b64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1]
    canvas.width = canvas.height = 0 // release the canvas buffer too
    if (b64) return b64
  } catch { /* fall through to raw read */ }
  const { data } = await fileToBase64(file)
  return data
}

// Downscale a picked image to a JPEG Blob for upload to Storage (keeps files
// small + converts iOS HEIC to JPEG so every browser can render it).
export async function scaleImageToBlob(file, max = 1000) {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close?.()
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
    canvas.width = canvas.height = 0
    if (blob) return blob
  } catch { /* fall through */ }
  return file // last resort: upload the raw file
}

// Fetch an image URL (e.g. a signed Storage URL) and return scaled base64 JPEG.
export async function urlToBase64(url, max = 800) {
  const res = await fetch(url)
  const blob = await res.blob()
  return scaleImageToBase64(blob, max)
}

// The meals a food entry can belong to, and a sensible default from the clock.
export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

// Paul, 10 Oct: "can we have the ability for people to tick if they're taking
// GLP-1 meds and if so which one?"
//
// Mounjaro and Wegovy are what UK weight-management clients are actually
// prescribed; the rest turn up because they are diabetes drugs someone is
// already on. "Other / not sure" is not padding — people often know they are
// "on the jab" without knowing the brand, and a list that cannot record that
// pushes them into picking something wrong.
//
// Tirzepatide is strictly a dual GIP/GLP-1 agonist rather than a pure GLP-1,
// but everyone including Paul means it when they say GLP-1, so it leads.
export const GLP1_MEDS = [
  'Mounjaro (tirzepatide)',
  'Wegovy (semaglutide)',
  'Ozempic (semaglutide)',
  'Saxenda (liraglutide)',
  'Rybelsus (oral semaglutide)',
  'Victoza (liraglutide)',
  'Trulicity (dulaglutide)',
  'Other / not sure',
]
export function mealByHour(d = new Date()) {
  const h = d.getHours()
  if (h < 11) return 'Breakfast'
  if (h < 16) return 'Lunch'
  if (h < 21) return 'Dinner'
  return 'Snacks'
}

export function sumMacros(logs) {
  return (logs || []).reduce(
    (a, l) => ({
      protein_g: a.protein_g + (l.protein_g || 0),
      carbs_g: a.carbs_g + (l.carbs_g || 0),
      fat_g: a.fat_g + (l.fat_g || 0),
      fibre_g: a.fibre_g + (l.fibre_g || 0),
      calories: a.calories + (l.calories || 0),
    }),
    { protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, calories: 0 },
  )
}

export function remainingMacros(target, consumed) {
  return {
    protein_g: Math.max((target?.protein_g || 0) - consumed.protein_g, 0),
    carbs_g: Math.max((target?.carbs_g || 0) - consumed.carbs_g, 0),
    fat_g: Math.max((target?.fat_g || 0) - consumed.fat_g, 0),
    calories: Math.max((target?.calories || 0) - consumed.calories, 0),
  }
}

// The training week runs Monday to Sunday. JS getDay() puts Sunday at 0, so a
// plain numeric sort of weekday numbers lists Sunday FIRST — Paul: "her week 1
// is Monday, Thursday, Saturday and Sunday. But in the app it lists it as
// Sunday, Monday, Thursday, Saturday." Everything that sorts or displays a
// weekday goes through here.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const dowRank = (dow) => (dow == null ? 99 : dow === 0 ? 7 : dow)
export const byDow = (a, b) => dowRank(a) - dowRank(b)
export const sortDays = (days) => [...(days || [])].sort(byDow)

// A failure a client can read. "TypeError: Failed to fetch" is what a dropped
// connection actually throws, and putting that in front of someone mid-workout
// tells them nothing and looks broken.
export function friendlyError(e) {
  const raw = String((e && e.message) || e || '')
  if (!raw || /failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return 'No connection just then — check your signal and try again.'
  }
  if (/timeout|timed out/i.test(raw)) return 'That took too long — try again.'
  if (/jwt|token|not authenticated|expired/i.test(raw)) return 'Your session expired — sign in again and it will still be here.'
  return raw
}

// Paul, 23 Sept: "when you manually change the calorie target it doesn't then
// adjust the macros accordingly to ensure they add up to the new target. Can we
// have it adjust the macros as well automatically when manually adjusting the
// calorie target and potentially trying to keep the protein target the same but
// just adjust the carbs and fats to meet the new target?"
//
// Exactly that: protein is held, and the remaining energy is split between carbs
// and fat. The split KEPT is whatever the client is already on rather than a
// house default — someone deliberately running low-carb should not be quietly
// moved back to the middle because they dropped their calories by 100. Only when
// there is no existing split to read (a brand-new row) does it fall back, to
// 35% of the non-protein energy, which lands fat at about a quarter of the total
// and matches the rule the coach card applies.
export function rebalanceMacros(prev, calories) {
  const cal = Math.max(0, Math.round(Number(calories) || 0))
  const protein_g = Math.max(0, Math.round(Number(prev?.protein_g) || 0))
  // Protein alone can exceed a very low calorie target. Hold it anyway — it is
  // the number the client asked to keep — and leave carbs and fat at zero
  // rather than inventing negative food.
  const rest = Math.max(0, cal - protein_g * 4)
  const prevFatCal = (Number(prev?.fat_g) || 0) * 9
  const prevCarbCal = (Number(prev?.carbs_g) || 0) * 4
  const prevRest = prevFatCal + prevCarbCal
  const fatShare = prevRest > 0 ? prevFatCal / prevRest : 0.35
  const fat_g = Math.round((rest * fatShare) / 9)
  const carbs_g = Math.max(0, Math.round((rest - fat_g * 9) / 4))
  return { ...prev, calories: cal, protein_g, carbs_g, fat_g }
}

// What those macros actually come to, for showing the client the sum they asked
// to be made correct.
export const macroCalories = (t) =>
  Math.round((Number(t?.protein_g) || 0) * 4 + (Number(t?.carbs_g) || 0) * 4 + (Number(t?.fat_g) || 0) * 9)

// The target that was in force on a given day. Rows are {effective_from, ...},
// newest first; the answer is the most recent one that had already started.
//
// Paul: looking back at a previous week used to re-score it against today's
// target. A day is judged by what it was aiming at, not what the client is
// aiming at now.
export function targetOn(history, date, fallback = null) {
  if (!history || !history.length) return fallback
  const d = typeof date === 'string' ? date : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  // Rows arrive newest-first, so the first one that started on or before the day
  // in question is the one that applied.
  const row = history.find((h) => h.effective_from <= d)
  // Before the earliest row we know nothing, so the oldest target we DO have is
  // the closest honest answer — better than silently using today's.
  return row || history[history.length - 1] || fallback
}

// Paul, 4 Oct: "have we been able to add dates to the previous sessions for
// clients and coaches to be able to see when past sessions were completed?"
// Not until now — the session cards showed the focus and an exercise count and
// nothing to place them in time, so a list of past sessions all looked alike.
//
// workout_completions records that a client trained on a DAY, not which session
// it was, so there is no completion timestamp to show per session. What there
// is: the day it was scheduled for, and the day it was made. For a session the
// client started themselves those are the same day they did it; for one the
// coach assigned, `scheduled_for` is the day it is meant for. Labelled so it
// never claims more than it knows.
export function sessionDateLabel(plan, now = new Date()) {
  // A real completion beats a scheduled or created date, and is labelled so a
  // coach can tell "they did this" from "this is pencilled in".
  const done = plan?.completed_at
  const raw = done || plan?.scheduled_for || plan?.created_at
  if (!raw) return null
  const d = new Date(String(raw).length <= 10 ? raw + 'T12:00:00' : raw)
  if (Number.isNaN(d.getTime())) return null
  const day = new Date(d); day.setHours(0, 0, 0, 0)
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const diff = Math.round((day - today) / 86400000)
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  if (done) return diff === 0 ? 'Done today' : diff === -1 ? 'Done yesterday' : `Done ${date}`
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff > 0) return `For ${date}`
  return date
}

// Where the Netlify functions live. Empty on the web, so every call stays
// relative and nothing about the web app changes.
//
// A native shell has no origin to be relative TO — Capacitor serves the bundle
// from capacitor://localhost, where "/.netlify/functions/..." is nowhere. The
// native builds set VITE_API_BASE to the deployed site and every call goes there
// instead. Phase 1 of the native app plan; harmless until then.
const API_BASE = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '')
export const apiUrl = (path) => API_BASE + path

// Paul, 13 Oct: "if I put a youtube link in the message box will they be able
// to click that link?" He could not. A hold-screen note is rendered as a plain
// text node and no browser auto-links a bare URL in page text — checked in
// Chromium against the exact markup App.jsx produced: 0 anchors. The client
// saw the address written out and tapping it did nothing.
//
// This splits a note into text and link runs so the caller can build real
// anchors out of React children. It never produces HTML, so nothing a coach
// types into the note can inject markup.
//
// Only http(s) is linked. A bare "youtube.com/watch?v=..." stays as text
// rather than guessing a scheme for someone, and javascript: or data: can
// never become a link because the pattern does not match them at all.
export function linkParts(text) {
  const s = String(text ?? '')
  if (!s) return []
  const out = []
  const push = (type, value, href) => {
    if (!value) return
    out.push(href ? { type, value, href } : { type, value })
  }
  // Walked with matchAll rather than split: a run of text can itself begin
  // "https://" without being an address ("https:// is a prefix"), and deciding
  // from the text rather than from the match turned that whole sentence into
  // one link. Quotes and angle brackets are excluded from an address because
  // they cannot appear in one unencoded, which also keeps a pasted <a href>
  // from swallowing its own markup into the link.
  const re = /https?:\/\/[^\s<>"'`]+/gi
  let last = 0
  for (const m of s.matchAll(re)) {
    push('text', s.slice(last, m.index))
    const run = m[0]
    // A full stop or bracket at the end of a sentence belongs to the sentence,
    // not to the address. Costs us an address that genuinely ends in one,
    // which is much the rarer case.
    const tail = (run.match(/[).,!?;:'"\]}>]+$/) || [''])[0]
    const href = tail ? run.slice(0, -tail.length) : run
    // Needs something after the slashes to be an address at all.
    if (/^https?:\/\/[^/]/i.test(href)) push('link', href, href)
    else push('text', href)
    push('text', tail)
    last = m.index + run.length
  }
  push('text', s.slice(last))
  return out
}
