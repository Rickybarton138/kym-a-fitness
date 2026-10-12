import { useState } from 'react'
import { supabase } from './supabaseClient.js'
import { scaleImageToBase64, apiUrl } from './lib.js'
import { THEME } from './themes.js'
import { FoodSearch } from './FoodSearch.jsx'
import { BarcodeScan } from './FoodCapture.jsx'

// Create a recipe three ways: import from a link, build your own (ingredients +
// servings -> per-portion macros), or paste text / snap a screenshot (great for
// migrating recipes from another app). Saves as the client's own recipe.

const cleanIngredients = (list) => (list || []).map((i) => String(i).trim()).filter(Boolean)

// The review form, shared by the create flow and by editing a saved recipe.
// Ingredients and the method are EDITABLE here, not just displayed: an imported
// recipe is a first draft — the AI mis-reads a quantity or drops a line, and
// until now the only way to correct it was to start again.
function Preview({ draft, setDraft, onSave, saving, saveLabel = 'Save recipe' }) {
  const [recalcing, setRecalcing] = useState(false)
  const [recalcMsg, setRecalcMsg] = useState('')
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  // Paul, 8 Oct: "one of my clients is editing one of her recipes she's added
  // but it's not updated the macros etc when she's saves with the new
  // quantities." It never did. The ingredients are free text and the macros are
  // separate numbers, so changing "100g oats" to "150g oats" changed nothing
  // but the text — and recipes built from the ingredient picker throw the
  // per-item macros away at save, so there is nothing stored to recompute from.
  //
  // So ask the same model that estimates macros on import. That works for every
  // recipe whatever its origin, which the stored-items approach would not:
  // most of these come from a URL or a paste and would have no items to total.
  //
  // Explicit button, never on save: the screen invites hand-tuning ("tweak the
  // numbers if you know better"), and silently overwriting that would be a
  // worse bug than the one being fixed.
  async function recalc() {
    const list = (draft.ingredients || []).map((i) => String(i).trim()).filter(Boolean)
    if (!list.length) { setRecalcMsg('Add some ingredients first.'); return }
    const servings = Math.max(1, Number(draft.servings) || 1)
    setRecalcing(true); setRecalcMsg('')
    try {
      const res = await fetch(apiUrl('/.netlify/functions/recipe-ai'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ingredients: list, servings }),
      })
      const j = await res.json()
      if (j.error || j.calories == null) { setRecalcMsg('Could not work those out — enter them by hand.'); return }
      // Macros only. The same endpoint's import mode would also hand back a
      // title, a method and a tidied ingredient list; taking those would
      // rewrite her recipe behind a button that says it updates the macros.
      setDraft((d) => ({
        ...d,
        calories: j.calories, protein_g: j.protein_g,
        carbs_g: j.carbs_g, fat_g: j.fat_g,
        fibre_g: j.fibre_g == null ? d.fibre_g : j.fibre_g,
      }))
      setRecalcMsg(`Updated from the ingredients, per serving (serves ${servings}). Check them before you save.`)
    } catch {
      setRecalcMsg('Could not work those out — enter them by hand.')
    } finally {
      setRecalcing(false)
    }
  }
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
      <p className="muted-note">Macros are per serving. Change the ingredients or the servings above and work them out again, or tweak the numbers yourself if you know better.</p>
      <button type="button" className="btn ghost sm" disabled={recalcing} onClick={recalc}>
        {recalcing ? 'Working them out…' : 'Update macros from ingredients'}
      </button>
      {recalcMsg && <p className="muted-note">{recalcMsg}</p>}
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
export function RecipeEditor({ recipe, onSaved, onClose, onDeleted }) {
  const [draft, setDraft] = useState({
    ...recipe,
    servings: recipe.servings || 1,
    ingredients: recipe.ingredients || [],
    method: recipe.method || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  // Paul, 12 Oct: "Could we also add in a delete recipe button too?"
  // Two taps, because there is no undo. Diary entries logged from this recipe
  // survive it - nutrition_logs.recipe_id is ON DELETE SET NULL, so a month of
  // history does not vanish with the recipe; those entries simply stop offering
  // to refresh themselves from it.
  async function remove() {
    setSaving(true); setError('')
    const { error: err } = await supabase.from('recipes').delete().eq('id', recipe.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onDeleted && onDeleted(recipe.id); onClose()
  }

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
        {onDeleted && (confirming ? (
          <div className="nudge-actions" style={{ marginTop: 12 }}>
            <button className="btn danger sm" disabled={saving} onClick={remove}>{saving ? 'Deleting…' : 'Yes, delete it'}</button>
            <button className="btn ghost sm" onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        ) : (
          <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => setConfirming(true)}>Delete this recipe</button>
        ))}
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
  // Which ingredient row is being filled from the food database, and how.
  const [picking, setPicking] = useState(null)

  // A chosen food lands in the row with its macros already worked out for the
  // portion they picked, and closes the picker — the next thing they want is the
  // next ingredient, not to admire this one.
  function fillRow(i, f) {
    setRows((rs) => rs.map((row, j) => (j !== i ? row : {
      name: f.name || row.name,
      calories: String(Math.round(Number(f.calories) || 0)),
      protein_g: String(Math.round(Number(f.protein_g) || 0)),
      carbs_g: String(Math.round(Number(f.carbs_g) || 0)),
      fat_g: String(Math.round(Number(f.fat_g) || 0)),
      fibre_g: String(Math.round(Number(f.fibre_g) || 0)),
    })))
    setPicking(null)
  }

  async function callAI(payload) {
    setBusy(true); setError('')
    try {
      const res = await fetch(apiUrl('/.netlify/functions/recipe-ai'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
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
    // Fibre is summed too now. Typed by hand nobody filled it in, so it was not
    // worth a column in the row; picked from the food database it arrives for
    // free, and dropping it here would quietly lose it on the way to the recipe.
    const tot = rows.reduce((a, r) => ({
      calories: a.calories + (Number(r.calories) || 0), protein_g: a.protein_g + (Number(r.protein_g) || 0),
      carbs_g: a.carbs_g + (Number(r.carbs_g) || 0), fat_g: a.fat_g + (Number(r.fat_g) || 0),
      fibre_g: a.fibre_g + (Number(r.fibre_g) || 0),
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0 })
    setDraft({
      title: bTitle.trim() || 'My recipe', servings: n,
      ingredients: rows.map((r) => r.name.trim()).filter(Boolean),
      method: '', image_url: null, source_url: null,
      calories: Math.round(tot.calories / n), protein_g: Math.round(tot.protein_g / n),
      carbs_g: Math.round(tot.carbs_g / n), fat_g: Math.round(tot.fat_g / n),
      fibre_g: Math.round(tot.fibre_g / n),
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
                    {/* Paul, 8 Oct: "when manually creating recipes can we add the
                        option for either searching and barcode scanning for the
                        individual items?" Typing the macros of every ingredient by
                        hand is the slowest thing in the app; the food database and
                        the scanner already know them. */}
                    <div className="nudge-actions" style={{ marginTop: 6 }}>
                      <button type="button" className="btn ghost sm" onClick={() => setPicking(picking?.row === i && picking.how === 'search' ? null : { row: i, how: 'search' })}>
                        {picking?.row === i && picking.how === 'search' ? 'Close' : 'Search foods'}
                      </button>
                      {THEME.features?.barcode && (
                        <button type="button" className="btn ghost sm" onClick={() => setPicking(picking?.row === i && picking.how === 'scan' ? null : { row: i, how: 'scan' })}>
                          {picking?.row === i && picking.how === 'scan' ? 'Close' : 'Scan a barcode'}
                        </button>
                      )}
                    </div>
                    {picking?.row === i && (
                      <div className="card" style={{ background: 'var(--surface)', marginTop: 8 }}>
                        {picking.how === 'search'
                          ? <FoodSearch pick clientId={clientId} contributorId={clientId} onLog={(f) => { fillRow(i, f); return true }} />
                          : <BarcodeScan pick onLog={(f) => { fillRow(i, f); return true }} />}
                      </div>
                    )}
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
