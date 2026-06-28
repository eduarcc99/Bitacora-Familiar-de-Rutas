import { useCallback, useEffect, useRef, useState } from 'react'
import GlobeMap from './components/GlobeMap'
import PlacePanel from './components/PlacePanel'
import LoginModal from './components/LoginModal'
import {
  entriesBySlug as mapEntriesBySlug,
  fetchEntries,
  fetchPlaces,
  getSessionUser,
  isSupabaseConfigured,
  onAuthChange,
  signOut,
} from './lib/supabase'
import { DEFAULT_PLACES, getPlaceBySlug } from './data/places'
import './App.css'

export default function App() {
  const [places, setPlaces] = useState(DEFAULT_PLACES)
  const [entries, setEntries] = useState([])
  const [selectedSlug, setSelectedSlug] = useState(null)
  const [focusPlace, setFocusPlace] = useState(null)
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const mapNavRef = useRef(null)

  const entriesMap = mapEntriesBySlug(entries)
  const selectedEntry = selectedSlug ? entriesMap[selectedSlug] : null

  const reloadData = useCallback(async () => {
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
      if (mounted) setUser(sessionUser)
      if (mounted) setLoading(false)
    }

    init()
    const unsub = onAuthChange((u) => setUser(u))
    return () => {
      mounted = false
      unsub()
    }
  }, [reloadData])

  function handleOpenPanel(slug) {
    setSelectedSlug(slug)
  }

  function handleFocus(place) {
    setFocusPlace({ ...place, _t: Date.now() })
  }

  function handleNavigate(slug) {
    setSelectedSlug(slug)
  }

  async function handleSignOut() {
    await signOut()
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Cargando mapa…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <span className="brand__logo">EYL</span>
          <div>
            <h1>Mapa de recuerdos</h1>
            <p className="brand__tag">
              Gris = por visitar · Foto = recuerdo en el mapa · Pulsa <strong>ℹ</strong> para editar
            </p>
          </div>
        </div>
        <div className="top-bar__actions">
          {!isSupabaseConfigured && (
            <span className="config-warn" title="Copia .env.example a .env">
              Demo local (sin Supabase)
            </span>
          )}
          {user ? (
            <>
              <span className="user-chip">{user.email}</span>
              <button type="button" className="btn btn--ghost" onClick={handleSignOut}>
                Salir
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setLoginOpen(true)}
              disabled={!isSupabaseConfigured}
            >
              Editar
            </button>
          )}
        </div>
      </header>

      <main className="main-stage">
        <GlobeMap
          places={places}
          entries={entries}
          entriesBySlug={entriesMap}
          selectedSlug={selectedSlug}
          onOpenPanel={handleOpenPanel}
          focusPlace={focusPlace}
          mapNavRef={mapNavRef}
        />

        {selectedSlug && (
          <PlacePanel
            places={places}
            selectedSlug={selectedSlug}
            entry={selectedEntry}
            allEntries={entries.filter((e) => e.place_slug === selectedSlug)}
            user={user}
            onClose={() => setSelectedSlug(null)}
            onSaved={reloadData}
            onNavigate={handleNavigate}
            onFocus={handleFocus}
          />
        )}
      </main>

      <footer className="hint-bar">
        <p>
          <strong>ℹ</strong> info · Scroll/clic zoom · Tras login baja en el panel a <strong>Editar lugar</strong>
        </p>
        <div className="hint-bar__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => mapNavRef.current?.zoomOut()}
          >
            − Alejar
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              const peru = getPlaceBySlug(places, 'peru')
              if (peru) handleFocus({ ...peru, province_id: undefined })
            }}
          >
            Ir a Perú
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              const amazonas = getPlaceBySlug(places, 'amazonas')
              if (amazonas) handleFocus({ ...amazonas, province_id: undefined })
            }}
          >
            Amazonas
          </button>
          <label className="hint-bar__select-wrap">
            <span className="sr-only">Provincia de Amazonas</span>
            <select
              className="hint-bar__select"
              defaultValue=""
              onChange={(e) => {
                const slug = e.target.value
                if (!slug) return
                const place = getPlaceBySlug(places, slug)
                if (place) {
                  handleFocus(place)
                }
                e.target.value = ''
              }}
            >
              <option value="">Provincia…</option>
              <option value="chachapoyas">Chachapoyas</option>
              <option value="bagua">Bagua</option>
              <option value="jumbilla">Bongará (Jumbilla)</option>
              <option value="nieva">Condorcanqui (Nieva)</option>
              <option value="lamud">Luya (Lámud)</option>
              <option value="mendoza-amazonas">Rodríguez de Mendoza</option>
              <option value="bagua-grande">Utcubamba (Bagua Grande)</option>
            </select>
          </label>
        </div>
      </footer>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={reloadData}
      />
    </div>
  )
}
