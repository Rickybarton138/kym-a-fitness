import { useState } from 'react'
import { supabase } from './supabaseClient.js'
import { scaleImageToBase64 } from './lib.js'

// Create a recipe three ways: import from a link, build your own (ingredients +
// servings -> per-portion macros), or paste text / snap a screenshot (great for
// migrating recipes from another app). Saves as the client's own recipe.

const cleanIngredients = (list) => (list || []).map((i) => String(i).trim()).filter(Boolean)

// The review form, shared by the create flow and by editing a saved recipe.
// Ingredients and the method are EDITABLE here, not just displayed: an imported
// recipe is a first draft — the AI mis-reads a quantity or drops a line, and
// until now the only way to correct it was to start again.
function Preview({ draft, setDraft, onSave, saving, saveLabel = 'Save recipe' }) {
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  // One ingredient per line. Blank lines are kept while typing and dropped on
  // save, so pressing Enter for the next line does not delete the one above.
  const setIngredients = (e) => setDraft((d) => ({ ...d, ingredients: e.target.value.split('\n') }))
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      {draft.image_url && <img className="link-img" src={draft.image_url} alt={draft.title} />}
      <label className="field">Name<input value={draft.title} onChange={set('title')} /></label>
      <div className="grid-2">
        <label className="field">Servings<input type="number" inputMode="numeric" value={draft.servings} onChange={set('servings')} /></label>
        <div />
      </div>
      <p className="muted-note">Per serving: <b>{draft.calories} kcal</b> · {draft.protein_g}g P · {draft.carbs_g}g C · {draft.fat_g}g F{draft.fibre_g ? ` · ${draft.fibre_g}g fibre` : ''}</p>
      <label className="field">Ingredients — one per line
        <textarea className="food-input" style={{ minHeight: 110 }} value={(draft.ingredients || []).join('\n')} onChange={setIngredients} placeholder="500g beef mince&#10;1 tin chopped tomatoes" />
      </label>
      <label className="field">Method
        <textarea className="food-input" style={{ minHeight: 110 }} value={draft.method || ''} onChange={set('method')} placeholder="How you make it — optional" />
      </label>
      <p className="muted-note">Macros are an estimate — tweak the numbers if you know better.</p>
      <div className="grid-2">
        <label className="field">Calories<input type="number" value={draft.calories} onChange={set('calories')} /></label>
        <label className="field">Protein (g)<input type="number" value={draft.protein_g} onChange={set('protein_g')} /></label>
        <label className="field">Carbs (g)<input type="number" value={draft.carbs_g} onChange={set('carbs_g')} /></label>
        <label className="field">Fat (g)<input type="number" value={draft.fat_g} onChange={set('fat_g')} /></label>
        <label className="field">Fibre (g)<input type="number" value={draft.fibre_g || ''} onChange={set('fibre_g')} /></label>
      </div>
      <button className="btn primary big" disabled={saving || !draft.title} onClick={onSave}>{saving ? 'Saving…' : saveLabel}</button>
    </div>
  )
}

// Paul, 9 Sept: "can we have an edit button on recipes so clients can go into
// their own created recipes and edit them?" Only their own — the RLS policy
// rc_client_own is scoped to client_id = auth.uid(), so an update against a
// coach's recipe matches no row and silently changes nothing. The Edit button
// is therefore shown only on the client's own recipes, which is also what Paul
// asked for.
export function RecipeEditor({ recipe, onSaved, onClose }) {
  const [draft, setDraft] = useState({
    ...recipe,
    servings: recipe.servings || 1,
    ingredients: recipe.ingredients || [],
    method: recipe.method || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    const d = draft
    const { data, error: err } = await supabase.from('recipes').update({
      title: d.title, servings: Number(d.servings) || 1,
      ingredients: cleanIngredients(d.ingredients), method: d.method || null,
      calories: Number(d.calories) || 0, protein_g: Number(d.protein_g) || 0,
      carbs_g: Number(d.carbs_g) || 0, fat_g: Number(d.fat_g) || 0, fibre_g: Number(d.fibre_g) || 0,
    }).eq('id', recipe.id).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved && onSaved(data); onClose()
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><b>Edit recipe</b><button className="link-btn" onClick={onClose}>Close</button></div>
        <Preview draft={draft} setDraft={setDraft} onSave={save} saving={saving} saveLabel="Save changes" />
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}

export function RecipeCreator({ clientId, onSaved, onClose }) {
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  // Build-your-own state
  const [bTitle, setBTitle] = useState('')
  const [bServings, setBServings] = useState('1')
  const [rows, setRows] = useState([{ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' }])

  async function callAI(payload) {
    setBusy(true); setError('')
    try {
      const res = await fetch('/.netlify/functions/recipe-ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json()
      if (j.error || !j.title) { setError(j.error || 'Could not read that recipe.'); return }
      setDraft({ ...j, servings: j.servings || 1 })
    } catch (e) { setError(String(e.message || e)) }
    setBusy(false)
  }
  const importUrl = () => url.trim() && callAI({ url: url.trim() })
  const importPaste = () => paste.trim() && callAI({ text: paste.trim() })
  async function importPhoto(e) {
    const file = e.target.files?.[0]; if (!file) return
    const data = await scaleImageToBase64(file, 900)
    callAI({ image: data, mediaType: 'image/jpeg' })
  }

  function buildDraft() {
    const n = Math.max(1, Number(bServings) || 1)
    const tot = rows.reduce((a, r) => ({
      calories: a.calories + (Number(r.calories) || 0), protein_g: a.protein_g + (Number(r.protein_g) || 0),
      carbs_g: a.carbs_g + (Number(r.carbs_g) || 0), fat_g: a.fat_g + (Number(r.fat_g) || 0),
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
    setDraft({
      title: bTitle.trim() || 'My recipe', servings: n,
      ingredients: rows.map((r) => r.name.trim()).filter(Boolean),
      method: '', image_url: null, source_url: null,
      calories: Math.round(tot.calories / n), protein_g: Math.round(tot.protein_g / n),
      carbs_g: Math.round(tot.carbs_g / n), fat_g: Math.round(tot.fat_g / n),
    })
  }
  const setRow = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)))

  async function save() {
    setSaving(true)
    const d = draft
    const { data, error: err } = await supabase.from('recipes').insert({
      client_id: clientId, coach_id: null, title: d.title, servings: Number(d.servings) || 1,
      ingredients: cleanIngredients(d.ingredients), method: d.method || null, image_url: d.image_url || null, source_url: d.source_url || null,
      serving_label: 'per serving',
      calories: Number(d.calories) || 0, protein_g: Number(d.protein_g) || 0, carbs_g: Number(d.carbs_g) || 0, fat_g: Number(d.fat_g) || 0, fibre_g: Number(d.fibre_g) || 0,
    }).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved && onSaved(data); onClose()
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><b>Create a recipe</b><button className="link-btn" onClick={onClose}>Close</button></div>

        {!draft && (
          <>
            <div className="seg three">
              <button type="button" className={tab === 'url' ? 'on' : ''} onClick={() => setTab('url')}>From a link</button>
              <button type="button" className={tab === 'build' ? 'on' : ''} onClick={() => setTab('build')}>Build my own</button>
              <button type="button" className={tab === 'paste' ? 'on' : ''} onClick={() => setTab('paste')}>Paste / photo</button>
            </div>

            {tab === 'url' && (
              <div className="stack">
                <p className="muted-note">Paste a recipe link and we'll pull the ingredients, image and macros.</p>
                <input className="food-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
                <button className="btn primary big" disabled={busy || !url.trim()} onClick={importUrl}>{busy ? 'Reading…' : 'Import recipe'}</button>
              </div>
            )}

            {tab === 'build' && (
              <div className="stack">
                <p className="muted-note">Add your ingredients and how many servings it makes — we'll work out one portion. Great for batch cooking.</p>
                <label className="field">Recipe name<input value={bTitle} onChange={(e) => setBTitle(e.target.value)} placeholder="e.g. Big batch chilli" /></label>
                {rows.map((r, i) => (
                  <div className="card" key={i} style={{ background: 'var(--surface-2)' }}>
                    <input className="ex-name-in" value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder="Ingredient (e.g. 500g beef mince)" />
                    <div className="grid-2" style={{ marginTop: 6 }}>
                      <label className="field">kcal<input type="number" value={r.calories} onChange={(e) => setRow(i, 'calories', e.target.value)} /></label>
                      <label className="field">Protein<input type="number" value={r.protein_g} onChange={(e) => setRow(i, 'protein_g', e.target.value)} /></label>
                      <label className="field">Carbs<input type="number" value={r.carbs_g} onChange={(e) => setRow(i, 'carbs_g', e.target.value)} /></label>
                      <label className="field">Fat<input type="number" value={r.fat_g} onChange={(e) => setRow(i, 'fat_g', e.target.value)} /></label>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn ghost" onClick={() => setRows((r) => [...r, { name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' }])}>+ Add ingredient</button>
                <label className="field">Makes how many servings?<input type="number" inputMode="numeric" value={bServings} onChange={(e) => setBServings(e.target.value)} /></label>
                <button className="btn primary big" onClick={buildDraft}>Work out a portion</button>
              </div>
            )}

            {tab === 'paste' && (
              <div className="stack">
                <p className="muted-note">Paste a recipe, or snap a photo of one — we'll turn it into a recipe with macros. Handy for moving recipes across from another app.</p>
                <textarea className="food-input" style={{ minHeight: 120 }} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the recipe here…" />
                <button className="btn primary big" disabled={busy || !paste.trim()} onClick={importPaste}>{busy ? 'Reading…' : 'Create from text'}</button>
                <label className="btn ghost" style={{ textAlign: 'center' }}>
                  {busy ? 'Reading…' : 'Or upload a photo'}
                  <input type="file" accept="image/*" hidden onChange={importPhoto} />
                </label>
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </>
        )}

        {draft && <><Preview draft={draft} setDraft={setDraft} onSave={save} saving={saving} />{error && <p className="error">{error}</p>}<button className="link-btn" onClick={() => setDraft(null)}>‹ Start over</button></>}
      </div>
    </div>
  )
}
