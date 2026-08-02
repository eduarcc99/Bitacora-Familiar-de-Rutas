import { useCallback, useEffect, useRef, useState } from 'react'
import GlobeMap from '../components/GlobeMap'
import {
  entriesBySlug as mapEntriesBySlug,
  fetchEntries,
  fetchPlaces,
} from '../lib/supabase'
import { DEFAULT_PLACES } from '../data/places'
import { EMPTY_FILTER, initDistrictCatalog } from '../lib/placeCatalog'
import { MAP_SCOPE_VISITOR_V2 } from '../lib/mapScope'
import {
  createVisitorNavHistory,
  getCurrentVisitorFilter,
  goBackInVisitorHistory,
  goForwardInVisitorHistory,
  pushVisitorNavHistory,
} from '../lib/visitorMapNav'
import StarfieldBackground from './StarfieldBackground'
import PhotoFadeCollage from './PhotoFadeCollage'
import VisitorNavControls from './VisitorNavControls'
import VisitorPhotoCarousel from './VisitorPhotoCarousel'
import './visitor.css'

/** Vista inicial 2.0: globo; primer toque en país encuadra y muestra departamentos */
const VISITOR_V2_INITIAL_FILTER = {
  ...EMPTY_FILTER,
}

export default function VisitorApp() {
  const [places, setPlaces] = useState(DEFAULT_PLACES)
  const [entries, setEntries] = useState([])
  const [mapFilter, setMapFilter] = useState(VISITOR_V2_INITIAL_FILTER)
  const [navHistory, setNavHistory] = useState(() =>
    createVisitorNavHistory(VISITOR_V2_INITIAL_FILTER),
  )
  const [loading, setLoading] = useState(true)
  const [carouselSlug, setCarouselSlug] = useState(null)
  const skipHistoryRef = useRef(false)

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
    reloadData().then(() => {
      if (mounted) setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [reloadData])

  const handleMapFilterChange = useCallback((nextFilter) => {
    setMapFilter(nextFilter)
    setCarouselSlug(null)

    if (skipHistoryRef.current) {
      skipHistoryRef.current = false
      return
    }

    setNavHistory((prev) => pushVisitorNavHistory(prev, nextFilter))
  }, [])

  const goBack = useCallback(() => {
    setNavHistory((prev) => {
      if (prev.index <= 0) return prev
      const nextHistory = goBackInVisitorHistory(prev)
      skipHistoryRef.current = true
      setMapFilter(getCurrentVisitorFilter(nextHistory))
      return nextHistory
    })
  }, [])

  const goForward = useCallback(() => {
    setNavHistory((prev) => {
      if (prev.index >= prev.stack.length - 1) return prev
      const nextHistory = goForwardInVisitorHistory(prev)
      skipHistoryRef.current = true
      setMapFilter(getCurrentVisitorFilter(nextHistory))
      return nextHistory
    })
  }, [])

  const goHome = useCallback(() => {
    setCarouselSlug(null)
    setMapFilter(VISITOR_V2_INITIAL_FILTER)
    setNavHistory((prev) =>
      pushVisitorNavHistory(prev, VISITOR_V2_INITIAL_FILTER),
    )
  }, [])

  function goToEditor() {
    window.location.href = '/editar'
  }

  if (loading) {
    return (
      <div className="visitor-loading" aria-busy="true">
        <span className="visitor-loading__pulse" aria-hidden="true" />
      </div>
    )
  }

  const entriesMap = mapEntriesBySlug(entries)
  const canBack = navHistory.index > 0
  const canForward = navHistory.index < navHistory.stack.length - 1
  const atWorld = !mapFilter.country
  const canHome = !atWorld
  const showNav = canBack || canForward || canHome
  const showBgCollage = atWorld

  return (
    <div className="visitor-app visitor-app--clean-map">
      <div className="visitor-app__stage">
        <StarfieldBackground />
        {showBgCollage ? <PhotoFadeCollage entries={entries} /> : null}
      </div>

      <div className="visitor-app__map-layer">
        <GlobeMap
          places={places}
          entries={entries}
          entriesBySlug={entriesMap}
          selectedSlug={carouselSlug}
          mapFilter={mapFilter}
          onMapFilterChange={handleMapFilterChange}
          onOpenPanel={setCarouselSlug}
          scope={MAP_SCOPE_VISITOR_V2}
          hideMapControls
        />
      </div>

      {carouselSlug ? (
        <VisitorPhotoCarousel
          slug={carouselSlug}
          places={places}
          entries={entries}
          onClose={() => setCarouselSlug(null)}
        />
      ) : null}

      {showNav ? (
        <VisitorNavControls
          canBack={canBack}
          canForward={canForward}
          canHome={canHome}
          onBack={goBack}
          onForward={goForward}
          onHome={goHome}
        />
      ) : null}

      <button
        type="button"
        className="visitor-app__edit-gate"
        onClick={goToEditor}
        aria-label="Gestión de fotos"
        title="Gestión de fotos"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="5" width="7" height="7" rx="1.5" />
          <rect x="14" y="5" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </button>
    </div>
  )
}
