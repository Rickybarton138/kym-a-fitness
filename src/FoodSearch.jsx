import React, { useState, useEffect, useRef } from 'react'
import { searchFoods } from './foods.js'

// Type-search a food/drink (built-in list + live database), pick a portion, log
// the macros. Or add anything manually if it isn't found.
export function FoodSearch({ onLog }) {
  const [q, setQ] = useState('')
  const [api, setApi] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [grams, setGrams] = useState('')
  const [logged, setLogged] = useState('')
  const [manual, setManual] = useState(false)
  const timer = useRef(null)

  const local = searchFoods(q)

  useEffect(() => {
    if (q.trim().length < 2) { setApi([]); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch('/.netlify/functions/food-search?q=' + encodeURIComponent(q.trim()))
        const j = await res.json()
        setApi(j.results || [])
      } catch { setApi([]) }
      setSearching(false)
    }, 450)
    return () => clearTimeout(timer.current)
  }, [q])

  const seen = new Set(local.map((f) => f.n.toLowerCase()))
  const results = [...local, ...api.filter((r) => r.n && !seen.has(r.n.toLowerCase()))].slice(0, 20)

  function pick(f) { setSelected(f); setGrams(String(f.s || 100)) }
  function logSelected() {
    const g = Number(grams) || 0
    if (!g || !selected) return
    const factor = g / 100
    onLog({
      name: `${selected.n} (${g}g)`,
      calories: Math.round(selected.k * factor),
      protein_g: Math.round((selected.p || 0) * factor),
      carbs_g: Math.round((selected.c || 0) * factor),
      fat_g: Math.round((selected.f || 0) * factor),
    })
    setLogged(selected.n); setSelected(null); setQ(''); setApi([]); setGrams('')
    setTimeout(() => setLogged(''), 2200)
  }

  if (selected) {
    const g = Number(grams) || 0, factor = g / 100
    return (
      <div className="card">
        <button type="button" className="link-btn" onClick={() => setSelected(null)}>‹ Back to search</button>
        <p className="eyebrow accent">{selected.n}</p>
        <label className="field">Portion (g / ml)<input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} /></label>
        {selected.s ? (
          <div className="serving-chips">
            <button type="button" className={grams === String(selected.s) ? 'on' : ''} onClick={() => setGrams(String(selected.s))}>Standard serving · {selected.s}g</button>
            <button type="button" className={grams === '100' ? 'on' : ''} onClick={() => setGrams('100')}>100g</button>
          </div>
        ) : (
          <p className="muted-note" style={{ marginTop: -4 }}>Weigh it for accuracy — enter the grams.</p>
        )}
        <div className="macro-row">
          <span><b>{Math.round((selected.p || 0) * factor)}g</b> protein</span>
          <span><b>{Math.round((selected.c || 0) * factor)}g</b> carbs</span>
          <span><b>{Math.round((selected.f || 0) * factor)}g</b> fat</span>
          <span className="kcal"><b>{Math.round(selected.k * factor)}</b> kcal</span>
        </div>
        <button className="btn primary" disabled={!g} onClick={logSelected}>Add to today</button>
      </div>
    )
  }

  return (
    <div className="stack">
      <input className="food-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a food or drink…" autoFocus />
      {logged && <p className="logged-ok">Added {logged} ✓</p>}

      {q.trim().length >= 1 && (
        <div className="card food-results">
          {results.map((f, i) => (
            <button type="button" className="food-row" key={f.n + i} onClick={() => pick(f)}>
              <span className="food-name">{f.n}</span>
              <span className="food-kcal">{f.k} kcal<span className="muted-note"> /100g</span></span>
            </button>
          ))}
          {searching && <p className="muted-note">Searching…</p>}
          {!searching && results.length === 0 && <p className="muted-note">No matches — add it manually below.</p>}
        </div>
      )}

      {!manual
        ? <button className="btn ghost" onClick={() => setManual(true)}>Can’t find it? Add manually</button>
        : <ManualFood onLog={(m) => { onLog(m); setLogged(m.name); setManual(false); setTimeout(() => setLogged(''), 2200) }} onCancel={() => setManual(false)} />}
    </div>
  )
}

function ManualFood({ onLog, onCancel }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  function add() {
    if (!name.trim() || !kcal) return
    onLog({ name: name.trim(), calories: Math.round(Number(kcal)) || 0, protein_g: Math.round(Number(p)) || 0, carbs_g: Math.round(Number(c)) || 0, fat_g: Math.round(Number(f)) || 0 })
  }
  return (
    <div className="card">
      <p className="eyebrow">Add manually</p>
      <label className="field">Food or drink<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mum’s lasagne" /></label>
      <div className="grid-2">
        <label className="field">Calories<input type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} /></label>
        <label className="field">Protein (g)<input type="number" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></label>
        <label className="field">Carbs (g)<input type="number" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} /></label>
        <label className="field">Fat (g)<input type="number" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} /></label>
      </div>
      <div className="nudge-actions">
        <button className="btn primary sm" disabled={!name.trim() || !kcal} onClick={add}>Add to today</button>
        <button className="btn ghost sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
