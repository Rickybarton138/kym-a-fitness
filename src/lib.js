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

// The client's chosen nutrition detail level (lifestyle | performance), injected
// into every AI call so nutrition answers match their preference.
let activeNutritionStyle = null
export function setNutritionStyle(s) { activeNutritionStyle = s || null }

// Call the serverless Claude proxy.
export async function analyze(payload) {
  let body = payload
  if (activePersona && !body.persona) body = { ...body, persona: activePersona }
  if (activeNutritionStyle && !body.nutritionStyle) body = { ...body, nutritionStyle: activeNutritionStyle }
  const res = await fetch('/.netlify/functions/analyze', {
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
    const b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
    if (b64) return b64
  } catch { /* fall through to raw read */ }
  const { data } = await fileToBase64(file)
  return data
}

// Fetch an image URL (e.g. a signed Storage URL) and return scaled base64 JPEG.
export async function urlToBase64(url, max = 800) {
  const res = await fetch(url)
  const blob = await res.blob()
  return scaleImageToBase64(blob, max)
}

// The meals a food entry can belong to, and a sensible default from the clock.
export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
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
