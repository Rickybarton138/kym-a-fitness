import React, { useEffect, useRef, useState } from 'react'
import { MEALS, mealByHour, analyze, scaleImageToBase64 } from './lib.js'
import { Loader, MacroRow } from './ui.jsx'
import { CameraCapture } from './CameraCapture.jsx'

// Scanning a barcode and photographing a plate.
//
// Lifted out of ClientApp so the food diary can offer them too — Paul: "if
// people are adding a mixture of foods that they would search out and foods
// they would scan the barcode they can do it all in one place." ClientApp
// imports FoodDiary, so FoodDiary importing them back from ClientApp would be a
// cycle; they belong in their own module either way.
//
// Both take onLog(macros) and nothing else, which is why they drop straight
// into the diary sheet as well as their own screens.

export function BarcodeScan({ onLog, onBack }) {
  const [code, setCode] = useState('')
  const [state, setState] = useState('idle') // idle | loading | found | notfound | error
  const [product, setProduct] = useState(null)
  const [grams, setGrams] = useState('100')
  const [meal, setMeal] = useState(mealByHour())
  const [error, setError] = useState('')
  const [logged, setLogged] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const [showShot, setShowShot] = useState(false) // photo-a-barcode path (iOS and anything without BarcodeDetector)
  const videoRef = useRef(null)
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window

  // Reading the number off a photo. BarcodeDetector is Chromium-only, so on an
  // iPhone the screen said "scan the barcode" with no way to scan one — this is
  // the path that works everywhere.
  async function lookupPhoto(file) {
    setShowShot(false)
    setState('loading'); setError(''); setProduct(null); setLogged(false)
    try {
      const image = await scaleImageToBase64(file, 1200)
      const res = await fetch('/.netlify/functions/barcode', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, mediaType: 'image/jpeg' }),
      })
      const j = await res.json()
      if (j.status === 'unreadable') {
        setState('idle')
        setError('Couldn’t read that barcode — try again with the number in shot, or type it below.')
        return
      }
      if (j.barcode) setCode(String(j.barcode))
      applyLookup(j)
    } catch {
      setState('idle'); setError('Couldn’t read that photo — type the number instead.')
    }
  }

  function applyLookup(j) {
    if (j.status === 'found') { setProduct(j.product); setState('found') }
    else if (j.status === 'not_found') setState('notfound')
    else { setError(j.error || 'Lookup failed.'); setState('error') }
  }

  async function lookup(barcode) {
    setState('loading'); setError(''); setProduct(null); setLogged(false)
    try {
      const res = await fetch('/.netlify/functions/barcode', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ barcode }),
      })
      const json = await res.json()
      if (!res.ok || json.status === 'not_found' || !json.product) { setState('notfound'); return }
      setProduct(json.product); setState('found')
    } catch { setState('error'); setError('Couldn’t look that up. Try again, or use Log food.') }
  }

  function stopCam() {
    const v = videoRef.current
    if (v && v.srcObject) { v.srcObject.getTracks().forEach((t) => t.stop()); v.srcObject = null }
    setCamOn(false)
  }
  async function startCam() {
    if (!canScan) return
    setError(''); setCamOn(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const v = videoRef.current
      v.srcObject = stream; await v.play()
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
      const tick = async () => {
        const el = videoRef.current
        if (!el || !el.srcObject) return
        try {
          const codes = await detector.detect(el)
          if (codes && codes.length && codes[0].rawValue) { const bc = codes[0].rawValue; stopCam(); setCode(bc); lookup(bc); return }
        } catch { /* keep trying */ }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    } catch { setError('Couldn’t open the camera — type the barcode instead.'); setCamOn(false) }
  }
  useEffect(() => () => stopCam(), [])

  function submitManual(e) { e.preventDefault(); const c = code.replace(/\D/g, ''); if (c) lookup(c) }

  const per = product?.per100
  const g = Number(grams) || 0
  const scale = g / 100
  const scaled = per ? {
    name: product.name,
    protein_g: Math.round((per.protein_g || 0) * scale),
    carbs_g: Math.round((per.carbs_g || 0) * scale),
    fat_g: Math.round((per.fat_g || 0) * scale),
    fibre_g: Math.round((per.fibre_g || 0) * scale),
    calories: Math.round((per.calories || 0) * scale),
  } : null

  return (
    <div>
      {/* No Back inside the food diary's add sheet — there is nowhere to go
          back TO from a tab, and a button that does nothing is worse than none. */}
      {onBack && <button className="link-btn" onClick={onBack}>‹ Back</button>}
      <p className="eyebrow accent">Barcode scan</p>
      <h1 className="h1">Scan a product.</h1>
      <p className="muted-note">Scan the barcode or type the number — we’ll pull the nutrition and you set the portion.</p>

      {canScan && (
        camOn ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <video ref={videoRef} className="barcode-cam" muted playsInline />
            <button className="btn ghost" onClick={stopCam}>Stop camera</button>
          </div>
        ) : (
          <button className="btn primary big" style={{ marginTop: 12 }} onClick={startCam}>Scan with camera</button>
        )
      )}
      {!camOn && (
        <button className={'btn ' + (canScan ? 'ghost' : 'primary big')} style={{ marginTop: canScan ? 8 : 12 }} onClick={() => setShowShot(true)}>
          {canScan ? 'Or take a photo of the barcode' : 'Take a photo of the barcode'}
        </button>
      )}
      {showShot && <CameraCapture onCapture={lookupPhoto} onClose={() => setShowShot(false)} />}

      <form className="auth-form" onSubmit={submitManual} style={{ marginTop: 14 }}>
        <label>Barcode number
          <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 5000159484695" />
        </label>
        <button className="btn ghost" type="submit" disabled={!code.replace(/\D/g, '')}>Look up</button>
      </form>

      {state === 'loading' && <Loader text="Looking it up…" />}
      {state === 'notfound' && <p className="muted-note" style={{ marginTop: 14 }}>Couldn’t find that product. Use “Log food” to add it by name instead.</p>}
      {error && <p className="error">{error}</p>}

      {state === 'found' && product && per && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="session-title">{product.name}</div>
          <div className="session-sub">Per 100{product.unit || 'g'}: {per.calories ?? '—'} kcal · {per.protein_g ?? 0}g P · {per.carbs_g ?? 0}g C · {per.fat_g ?? 0}g F</div>
          <label className="field" style={{ marginTop: 12 }}>Portion (grams)<input type="number" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)} /></label>
          {product.serving && (
            <div className="serving-chips">
              <button type="button" className={grams === String(product.serving) ? 'on' : ''} onClick={() => setGrams(String(product.serving))}>Standard serving · {product.serving}g</button>
              <button type="button" className={grams === '100' ? 'on' : ''} onClick={() => setGrams('100')}>100g</button>
            </div>
          )}
          {scaled && <p className="muted-note">This portion: {scaled.calories} kcal · {scaled.protein_g}g P · {scaled.carbs_g}g C · {scaled.fat_g}g F</p>}
          <label className="field" style={{ marginTop: 8 }}>Meal<select value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></label>
          <button className="btn primary" style={{ marginTop: 10 }} disabled={!scaled || g <= 0} onClick={async () => { if (scaled) { const ok = (await onLog({ ...scaled, meal_type: meal })) !== false; setLogged(ok ? 'ok' : 'device') } }}>
            {logged === 'ok' ? 'Added to today ✓' : logged === 'device' ? 'Saved on this phone' : 'Add to today'}
          </button>
        </div>
      )}
    </div>
  )
}

export function MealScan({ onLog }) {
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [logged, setLogged] = useState(false)
  const [cooking, setCooking] = useState('')
  const [meal, setMeal] = useState(mealByHour())
  const [showCam, setShowCam] = useState(false)

  async function handleFile(file) {
    if (!file) return
    setLogged(false); setPreview(URL.createObjectURL(file)); setState('loading'); setError('')
    try {
      const data = await scaleImageToBase64(file, 900)
      const json = await analyze({ mode: 'meal', image: data, mediaType: 'image/jpeg', extras: cooking.trim() || undefined })
      setResult(json); setState('done')
    } catch (err) { setError(err.message); setState('error') }
  }

  return (
    <div className="stack">
      <p className="eyebrow">Meal scan</p>
      <h1 className="h1">Snap your plate.</h1>
      <p className="lead">Photograph any meal and the AI logs the calories and macros — no manual food diary.</p>
      {state === 'idle' && (
        <label className="field">Cooked with any oil, butter, dressing or sauce? (optional — improves accuracy)
          <input value={cooking} onChange={(e) => setCooking(e.target.value)} placeholder="e.g. 1 tbsp olive oil, a spoon of mayo" />
        </label>
      )}
      {preview && <div className="shot"><img src={preview} alt="Your meal" /></div>}
      {state === 'idle' && <button className="btn primary big" onClick={() => setShowCam(true)}>Scan my meal</button>}
      {state === 'loading' && <Loader text="Identifying your meal…" />}
      {state === 'error' && <div className="stack"><p className="error">{error}</p><button className="btn ghost" onClick={() => setShowCam(true)}>Try another photo</button></div>}
      {state === 'done' && result && (
        <div className="stack">
          <div className="card meal-card">
            <p className="eyebrow accent">Detected · {result.confidence} confidence</p>
            <h2 className="meal-name">{result.food_name}</h2>
            <div className="chips">{result.items?.map((it, i) => <span className="chip" key={i}>{it}</span>)}</div>
            <MacroRow m={result} />
            <label className="field" style={{ marginTop: 8 }}>Meal<select value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></label>
            {logged
              ? <p className={logged === 'ok' ? 'logged-ok' : 'muted-note'}>{logged === 'ok' ? 'Added to today ✓' : 'Saved on this phone — it goes in when you are back online'}</p>
              : <button className="btn primary" onClick={async () => { const ok = (await onLog({ ...result, name: result.food_name, meal_type: meal })) !== false; setLogged(ok ? 'ok' : 'device') }}>Add to today</button>}
          </div>
          <button className="btn ghost" onClick={() => setShowCam(true)}>Scan again</button>
        </div>
      )}
      {showCam && <CameraCapture onCapture={(file) => { setShowCam(false); handleFile(file) }} onClose={() => setShowCam(false)} />}
    </div>
  )
}
