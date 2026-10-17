// Profile pictures.
//
// The `avatars` bucket is PRIVATE (see tasks/migration_account_avatar.sql), so
// every render needs a signed URL. That is the same trade body-photos makes: a
// public bucket would mean a guessable address for the photograph of every
// client in every gym on the platform.
//
// profiles.avatar_path holds the object key, never a URL. The column is
// client-writable because it is their own picture, and a client-writable URL
// would let them point their "photo" at an external address that the coach's
// browser then fetches on every client-list render.
import { supabase } from './supabaseClient.js'
import { scaleImageToBlob } from './lib.js'

const BUCKET = 'avatars'
const TTL = 3600

// 320px: it is only ever drawn at 32-40px, or ~96px on the account screen, so
// this is already generous on a 3x display and keeps a 12MB phone photo down to
// a few tens of KB. scaleImageToBlob also converts iOS HEIC to JPEG, without
// which a picture taken on an iPhone renders nowhere.
const MAX_PX = 320

export async function signedAvatarUrl(path, ttl = TTL) {
  if (!path) return null
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl)
  return data?.signedUrl || null
}

// One request for a whole list. The coach's client list would otherwise make a
// round trip per client, which is what made the old photo screens feel slow.
// Returns a plain object keyed by path so a caller can look up per row.
export async function signedAvatarUrls(paths, ttl = TTL) {
  const wanted = [...new Set((paths || []).filter(Boolean))]
  if (!wanted.length) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(wanted, ttl)
  if (error || !data) return {}
  const out = {}
  data.forEach((d, i) => {
    // createSignedUrls returns results in request order, and sets `error` per
    // item rather than failing the batch — one deleted file must not blank the
    // other twenty faces.
    const url = d?.signedUrl
    if (url) out[d.path || wanted[i]] = url
  })
  return out
}

// Upload, then point the profile at it, then bin the old one.
//
// The object key carries a timestamp instead of being a fixed `avatar.jpg`
// upserted in place. A stable key would be served from the browser's cache
// under the same signed URL, so a client who changed their picture would keep
// seeing the old one and reasonably conclude it had not saved.
//
// Order matters. The old file is removed LAST, after the column is safely
// repointed: if removal fails we leak one small object, whereas deleting first
// and failing the update would leave a profile pointing at nothing.
export async function uploadAvatar({ clientId, file, previousPath }) {
  const blob = await scaleImageToBlob(file, MAX_PX)
  const path = `${clientId}/${Date.now()}.jpg`

  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (up.error) throw up.error

  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', clientId)
  if (error) {
    // Do not leave an orphan behind if the column write was refused (which is
    // what a missing column-level GRANT looks like from here).
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    throw error
  }

  if (previousPath && previousPath !== path) {
    await supabase.storage.from(BUCKET).remove([previousPath]).catch(() => {})
  }
  return path
}

export async function removeAvatar({ clientId, path }) {
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', clientId)
  if (error) throw error
  if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
}

export const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?'
