import { useEffect, useMemo, useState } from 'react'
import { getPhotoPublicUrl } from '../lib/supabase'
import { carouselTitle, entriesForCarousel } from '../lib/visitorCarousel'

export default function VisitorPhotoCarousel({ slug, places, entries, onClose }) {
  const photos = useMemo(
    () => entriesForCarousel(places, entries, slug),
    [places, entries, slug],
  )
  const [index, setIndex] = useState(0)
  const placeName = carouselTitle(places, slug)

  useEffect(() => {
    setIndex(0)
  }, [slug])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(photos.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, photos.length])

  const photo = photos[index]

  return (
    <div
      className="visitor-carousel"
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${placeName}`}
    >
      <button
        type="button"
        className="visitor-carousel__backdrop"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div className="visitor-carousel__sheet">
        <header className="visitor-carousel__header">
          <div>
            <p className="visitor-carousel__eyebrow">Recuerdos</p>
            <h2 className="visitor-carousel__title">{placeName}</h2>
            {photos.length > 1 ? (
              <p className="visitor-carousel__count">
                {index + 1} de {photos.length}
              </p>
            ) : photos.length === 1 ? (
              <p className="visitor-carousel__count">1 foto</p>
            ) : (
              <p className="visitor-carousel__count">Sin fotos aún</p>
            )}
          </div>
          <button
            type="button"
            className="visitor-carousel__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="visitor-carousel__stage">
          {!photos.length ? (
            <p className="visitor-carousel__empty">
              Todavía no hay recuerdos en este lugar.
            </p>
          ) : (
            <>
              {photos.length > 1 ? (
                <button
                  type="button"
                  className="visitor-carousel__nav visitor-carousel__nav--prev"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  aria-label="Anterior"
                >
                  ‹
                </button>
              ) : null}

              <img
                src={getPhotoPublicUrl(photo.photo_path)}
                alt={`Foto en ${placeName}`}
                className="visitor-carousel__photo"
              />

              {photos.length > 1 ? (
                <button
                  type="button"
                  className="visitor-carousel__nav visitor-carousel__nav--next"
                  onClick={() =>
                    setIndex((i) => Math.min(photos.length - 1, i + 1))
                  }
                  disabled={index === photos.length - 1}
                  aria-label="Siguiente"
                >
                  ›
                </button>
              ) : null}
            </>
          )}
        </div>

        {photo?.note ? (
          <p className="visitor-carousel__note">{photo.note}</p>
        ) : null}
      </div>
    </div>
  )
}
