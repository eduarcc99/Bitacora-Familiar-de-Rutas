import { createClient } from '@supabase/supabase-js'
import { DEFAULT_PLACES } from '../data/places'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('TU_PROYECTO') &&
    !supabaseAnonKey.includes('tu_anon')
)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export async function fetchPlaces() {
  if (!supabase) return DEFAULT_PLACES

  const { data, error } = await supabase
    .from('places')
    .select('slug, name, parent_slug, level, sort_order')
    .order('sort_order')

  if (error || !data?.length) {
    console.warn('Usando lugares locales:', error?.message)
    return DEFAULT_PLACES
  }

  return data.map((row) => {
    const local = DEFAULT_PLACES.find((p) => p.slug === row.slug)
    return local ? { ...local, ...row } : row
  })
}

export async function fetchEntries() {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('place_entries')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('No se pudieron cargar entradas:', error.message)
    return []
  }

  return data ?? []
}

export function entriesBySlug(entries) {
  const map = {}
  for (const entry of entries) {
    if (!map[entry.place_slug]) {
      map[entry.place_slug] = entry
    }
  }
  return map
}

export function getPhotoPublicUrl(path) {
  if (!path || !supabase) return null
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadPhoto(file, placeSlug, userId) {
  if (!supabase) throw new Error('Supabase no configurado')

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filePath = `${placeSlug}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(filePath, file, { upsert: false, cacheControl: '3600' })

  if (uploadError) throw uploadError

  return filePath
}

export async function savePlaceEntry({
  placeSlug,
  photoPath,
  visitDate,
  note,
  status,
  targetDate,
  userId,
  existingId,
}) {
  if (!supabase) throw new Error('Supabase no configurado')

  const payload = {
    place_slug: placeSlug,
    photo_path: photoPath ?? null,
    visit_date: visitDate || null,
    note: note || null,
    status,
    target_date: targetDate || null,
    created_by: userId,
  }

  if (existingId) {
    const { data, error } = await supabase
      .from('place_entries')
      .update(payload)
      .eq('id', existingId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('place_entries')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePlaceEntry(id) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { error } = await supabase.from('place_entries').delete().eq('id', id)
  if (error) throw error
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export function onAuthChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => data.subscription.unsubscribe()
}

export async function getSessionUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}
