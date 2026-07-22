import { useCallback, useEffect, useRef, useState } from "react";
import GlobeMap from "./components/GlobeMap";
import PlacePanel from "./components/PlacePanel";
import ChachapoyasFilterBar from "./components/ChachapoyasFilterBar";
import GalleryEditor from "./components/gallery/GalleryEditor";
import LoginModal from "./components/LoginModal";
import {
  entriesBySlug as mapEntriesBySlug,
  fetchEntries,
  fetchPlaces,
  getSessionUser,
  isSupabaseConfigured,
  onAuthChange,
  signOut,
} from "./lib/supabase";
import { DEFAULT_PLACES } from "./data/places";
import { filterFromSlug } from "./lib/placeCatalog";
import {
  clampFilterToChachapoyas,
  MAP_SCOPE_CHACHAPOYAS,
  VISITOR_INITIAL_FILTER,
} from "./lib/mapScope";
import "./App.css";

export default function App() {
  const [places, setPlaces] = useState(DEFAULT_PLACES);
  const [entries, setEntries] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [mapFilter, setMapFilter] = useState({ ...VISITOR_INITIAL_FILTER });
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [gallerySlug, setGallerySlug] = useState(null);
  const [loading, setLoading] = useState(true);
  const placesRef = useRef(places);

  placesRef.current = places;

  const entriesMap = mapEntriesBySlug(entries);
  const selectedEntry = selectedSlug ? entriesMap[selectedSlug] : null;
  const isEditing = Boolean(user) && galleryOpen;

  const reloadData = useCallback(async () => {
    const [placesData, entriesData] = await Promise.all([
      fetchPlaces(),
      fetchEntries(),
    ]);
    setPlaces(placesData);
    setEntries(entriesData);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      await reloadData();
      const sessionUser = await getSessionUser();
      if (mounted) setUser(sessionUser);
      if (mounted) setLoading(false);
    }

    init();
    const unsub = onAuthChange((u) => {
      setUser(u);
      if (!u) setGalleryOpen(false);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [reloadData]);

  const handleMapFilterChange = useCallback((nextFilter) => {
    setMapFilter(clampFilterToChachapoyas(nextFilter));
  }, []);

  function handleOpenPanel(slug) {
    if (isEditing) return;
    setSelectedSlug(slug);
    setMapFilter(clampFilterToChachapoyas(filterFromSlug(placesRef.current, slug)));
  }

  function handleNavigate(slug) {
    setSelectedSlug(slug);
    setMapFilter(clampFilterToChachapoyas(filterFromSlug(placesRef.current, slug)));
  }

  async function handleSignOut() {
    setSelectedSlug(null);
    await signOut();
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Cargando…</p>
      </div>
    );
  }

  return (
    <div className="app">
      {!isEditing && (
      <header className="top-bar">
        <div className="brand">
          <span className="brand__logo">EYL</span>
          <div>
            <h1>Mapa de recuerdos</h1>
            <p className="brand__tag">
              Chachapoyas · Gris = por visitar · Foto = recuerdo ·{" "}
              <strong>Editar</strong> para subir fotos
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
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setGalleryOpen(true)}
              >
                Mi galería
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleSignOut}
              >
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
      )}

      <main className="main-stage">
        {isEditing ? (
          <GalleryEditor
            places={places}
            entries={entries}
            user={user}
            initialSlug={gallerySlug}
            onSaved={reloadData}
            onViewMap={() => setGalleryOpen(false)}
            onSignOut={handleSignOut}
          />
        ) : (
          <>
            <GlobeMap
              places={places}
              entries={entries}
              entriesBySlug={entriesMap}
              selectedSlug={selectedSlug}
              mapFilter={mapFilter}
              onMapFilterChange={handleMapFilterChange}
              onOpenPanel={handleOpenPanel}
              scope={MAP_SCOPE_CHACHAPOYAS}
            />

            {selectedSlug && (
              <PlacePanel
                places={places}
                selectedSlug={selectedSlug}
                entry={selectedEntry}
                allEntries={entries.filter(
                  (e) => e.place_slug === selectedSlug,
                )}
                user={user}
                onClose={() => setSelectedSlug(null)}
                onNavigate={handleNavigate}
                onOpenGallery={(slug) => {
                  setGallerySlug(slug);
                  setGalleryOpen(true);
                  setSelectedSlug(null);
                }}
              />
            )}
          </>
        )}
      </main>

      {!isEditing && (
        <ChachapoyasFilterBar
          places={places}
          filter={mapFilter}
          onChange={handleMapFilterChange}
        />
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={reloadData}
      />
    </div>
  );
}
