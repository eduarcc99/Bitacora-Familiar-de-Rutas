import { useCallback, useEffect, useState } from 'react'
import GalleryEditor from '../components/gallery/GalleryEditor'
import LoginModal from '../components/LoginModal'
import {
  fetchEntries,
  fetchPlaces,
  getSessionUser,
  isSupabaseConfigured,
  onAuthChange,
  signOut,
} from '../lib/supabase'
import { DEFAULT_PLACES } from '../data/places'
import { initDistrictCatalog } from '../lib/placeCatalog'

/**
 * EYL 2.0 — gestión de fotos (catálogo).
 * Sin mapa: el globo vive solo en `/` (visitante).
 */
export default function EditorApp() {
  const [places, setPlaces] = useState(DEFAULT_PLACES)
  const [entries, setEntries] = useState([])
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const reloadData = useCallback(async () => {
    await initDistrictCatalog()
    const [placesData, entriesData] = await Promise.all([
      fetchPlaces(),
      fetchEntries(),
    ])
    setPlaces(placesData)
    setEntries(entriesData)
  }, [])

  useEffect(() => {
    let mounted = true

    async function init() {
      await reloadData()
      const sessionUser = await getSessionUser()
      if (mounted) {
        setUser(sessionUser)
        setLoading(false)
      }
    }

    init()
    const unsub = onAuthChange((u) => {
      if (mounted) setUser(u)
    })
    return () => {
      mounted = false
      unsub()
    }
  }, [reloadData])

  async function handleSignOut() {
    await signOut()
  }

  function goToVisitorMap() {
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#09090b] text-zinc-500">
        <div className="flex flex-col items-center gap-3">
          <span className="size-2 animate-pulse rounded-full bg-amber-400/70" />
          <p className="text-xs uppercase tracking-[0.2em]">Cargando…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-[#09090b] px-6 text-zinc-100">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/25">
            EYL
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Gestión de fotos</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
            Catálogo familiar · Inicia sesión para subir y organizar recuerdos por distrito.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <p className="mb-4 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200/90 ring-1 ring-amber-400/20">
            Demo local sin Supabase · configura `.env`
          </p>
        )}

        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-40"
            onClick={() => setLoginOpen(true)}
            disabled={!isSupabaseConfigured}
          >
            Entrar
          </button>
          <a
            href="/"
            className="rounded-xl px-4 py-3 text-center text-sm font-medium text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/[0.04] hover:text-zinc-200"
          >
            Volver al mapa
          </a>
        </div>

        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={reloadData}
        />
      </div>
    )
  }

  return (
    <div className="h-dvh overflow-hidden">
      <GalleryEditor
        places={places}
        entries={entries}
        user={user}
        initialSlug={null}
        onSaved={reloadData}
        onViewMap={goToVisitorMap}
        onSignOut={handleSignOut}
      />
    </div>
  )
}
