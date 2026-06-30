import { useEffect, useMemo, useState } from 'react'
import { EMPTY_FILTER,
  getActiveFilterSlug,
  getFilteredPhotoEntries,
  getFilterSummary,
  initDistrictCatalog,
  resolveCatalogPlace,
  resolveInitialFilter,
} from '../../lib/placeCatalog'
import {
  deletePlaceEntry,
  savePlaceEntry,
  updatePlaceEntry,
  uploadPhoto,
} from '../../lib/supabase'
import { validateImageFiles } from '../../lib/validateImages'
import EditorChrome from './EditorChrome'
import EditorSidebar from './EditorSidebar'
import PhotoGrid from './PhotoGrid'
import PhotoLightbox from './PhotoLightbox'
import UploadModal from './UploadModal'

function EmptyState({ hasFilter, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center animate-editor-in">
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08]">
        <svg className="size-8 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 15.75M4.5 19.5h15a1.5 1.5 0 0 0 1.5-1.5V6.75a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 6.75v11.25a1.5 1.5 0 0 0 1.5 1.5Z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-zinc-200">Sin fotos</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
        {hasFilter
          ? 'No hay recuerdos con este filtro. Sube la primera foto o prueba otra ubicación.'
          : 'Selecciona Perú en el panel lateral para empezar a subir fotos a tus lugares.'}
      </p>
      {hasFilter && (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 text-sm font-medium text-amber-400 transition hover:text-amber-300"
        >
          Ver todas las fotos
        </button>
      )}
    </div>
  )
}

export default function GalleryEditor({
  places,
  entries,
  user,
  initialSlug = null,
  onSaved,
  onViewMap,
  onSignOut,
}) {
  const [filter, setFilter] = useState(() => resolveInitialFilter(places, initialSlug))
  const [catalogReady, setCatalogReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [catalogError, setCatalogError] = useState('')

  useEffect(() => {
    initDistrictCatalog()
      .then(() => setCatalogReady(true))
      .catch((err) =>
        setCatalogError(err.message || 'No se pudieron cargar los distritos'),
      )
  }, [])

  useEffect(() => {
    setFilter(resolveInitialFilter(places, initialSlug))
    setLightboxIndex(null)
  }, [initialSlug, places])

  const filteredPhotos = useMemo(
    () => getFilteredPhotoEntries(places, entries, filter),
    [places, entries, filter],
  )

  const uploadSlug = getActiveFilterSlug(filter)
  const uploadPlace = uploadSlug ? resolveCatalogPlace(places, uploadSlug) : null
  const summary = getFilterSummary(places, filter)
  const showPlaceLabel = !filter.district && filteredPhotos.length > 0
  const hasAnyFilter = Boolean(
    filter.country || filter.region || filter.province || filter.district,
  )

  async function handleUpload(fileList) {
    if (!uploadPlace || !user) {
      setError('Selecciona al menos Perú para subir fotos.')
      return
    }

    const { valid, errors, warnings } = validateImageFiles(fileList)
    if (errors.length) {
      setError(errors.join(' '))
      setWarning('')
      return
    }
    if (!valid.length) return

    setError('')
    setWarning(warnings.length ? warnings.join(' ') : '')
    setLoading(true)
    try {
      for (const file of valid) {
        const photoPath = await uploadPhoto(file, uploadPlace.slug, user.id)
        await savePlaceEntry({
          place: uploadPlace,
          placeSlug: uploadPlace.slug,
          photoPath,
          visitDate: new Date().toISOString().slice(0, 10),
          note: '',
          status: 'visited',
          targetDate: null,
          userId: user.id,
        })
      }
      setUploadOpen(false)
      onSaved()
    } catch (err) {
      setError(err.message || 'Error al subir las fotos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeletePhoto(id) {
    if (!window.confirm('¿Eliminar esta foto permanentemente?')) return
    setLoading(true)
    try {
      await deletePlaceEntry(id)
      setLightboxIndex(null)
      onSaved()
    } catch (err) {
      setError(err.message || 'Error al eliminar.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveNote(id, note) {
    await updatePlaceEntry(id, { note })
    onSaved()
  }

  function handleFilterChange(next) {
    setFilter(next)
    setLightboxIndex(null)
    setError('')
    setWarning('')
  }

  const alertMessage = catalogError || error

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#09090b] text-zinc-100">
      <EditorChrome
        userEmail={user?.email}
        photoCount={filteredPhotos.length}
        uploadLoading={loading}
        canUpload={Boolean(uploadPlace)}
        onUploadClick={() => setUploadOpen(true)}
        onViewMap={onViewMap}
        onSignOut={onSignOut}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <EditorSidebar
          places={places}
          filter={filter}
          onChange={handleFilterChange}
          catalogReady={catalogReady}
          uploadPlace={uploadPlace}
          uploadLoading={loading}
          onUploadClick={() => setUploadOpen(true)}
        />

        <main className="editor-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-white/[0.06] px-5 py-4 lg:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Vista actual
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-200">{summary}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {filteredPhotos.length} {filteredPhotos.length === 1 ? 'foto' : 'fotos'}
            </p>
          </div>

          {alertMessage && (
            <div
              role="alert"
              className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              <span>{alertMessage}</span>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  if (catalogError) setCatalogError('')
                }}
                className="shrink-0 text-red-400 hover:text-red-200"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          )}

          {warning && !alertMessage && (
            <div
              role="status"
              className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90"
            >
              <span>{warning}</span>
              <button
                type="button"
                onClick={() => setWarning('')}
                className="shrink-0 text-amber-400 hover:text-amber-200"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          )}

          <div className="px-5 py-6 lg:px-8 lg:py-8">
            {filteredPhotos.length === 0 ? (
              <EmptyState
                hasFilter={hasAnyFilter}
                onClear={() => handleFilterChange({ ...EMPTY_FILTER })}
              />
            ) : (
              <PhotoGrid
                photos={filteredPhotos}
                showPlaceLabel={showPlaceLabel}
                onPhotoClick={setLightboxIndex}
              />
            )}
          </div>
        </main>
      </div>

      <UploadModal
        open={uploadOpen && Boolean(uploadPlace)}
        onClose={() => setUploadOpen(false)}
        placeName={uploadPlace?.name ?? ''}
        loading={loading}
        onUpload={handleUpload}
      />

      {lightboxIndex !== null && filteredPhotos.length > 0 && (
        <PhotoLightbox
          photos={filteredPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((i) =>
              i <= 0 ? filteredPhotos.length - 1 : i - 1,
            )
          }
          onNext={() =>
            setLightboxIndex((i) =>
              i >= filteredPhotos.length - 1 ? 0 : i + 1,
            )
          }
          onDelete={handleDeletePhoto}
          onSaveNote={handleSaveNote}
        />
      )}
    </div>
  )
}
