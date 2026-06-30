import { useEffect, useState } from 'react'
import { getPhotoPublicUrl } from '../../lib/supabase'
import Button from '../ui/Button'

export default function PhotoLightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
  onDelete,
  onSaveNote,
}) {
  const photo = photos[index]
  const [note, setNote] = useState(photo?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [noteError, setNoteError] = useState('')

  useEffect(() => {
    setNote(photo?.note ?? '')
    setNoteError('')
  }, [photo?.id, photo?.note])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  if (!photo) return null

  const imageAlt = `Foto ampliada de ${photo.placeName}`

  async function handleSaveNote() {
    const trimmed = note.trim()
    if (trimmed.length > 500) {
      setNoteError('Máximo 500 caracteres.')
      return
    }
    setNoteError('')
    setSaving(true)
    try {
      await onSaveNote(photo.id, trimmed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex bg-[#09090b]/95 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={`Visor: ${photo.placeName}`}
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        {/* Imagen */}
        <div className="relative flex min-h-[45vh] flex-1 items-center justify-center p-4 lg:min-h-0 lg:p-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-lg bg-white/5 text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            ✕
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={onPrev}
                aria-label="Anterior"
                className="absolute left-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-xl text-white ring-1 ring-white/10 backdrop-blur-md transition hover:bg-black/60 lg:left-6"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label="Siguiente"
                className="absolute right-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-xl text-white ring-1 ring-white/10 backdrop-blur-md transition hover:bg-black/60 lg:right-6"
              >
                ›
              </button>
            </>
          )}

          <img
            src={getPhotoPublicUrl(photo.photo_path)}
            alt={imageAlt}
            className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-[var(--shadow-editor-lg)] lg:max-h-full"
          />
        </div>

        {/* Panel lateral */}
        <aside className="flex w-full shrink-0 flex-col border-t border-white/[0.06] bg-[#111113] lg:w-[340px] lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0 pr-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Lugar
              </p>
              <h2 className="mt-1 truncate text-base font-semibold text-zinc-50">
                {photo.placeName}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {index + 1} de {photos.length}
                {photo.visit_date ? ` · ${photo.visit_date}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 lg:flex"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-1 flex-col px-5 py-4">
            <label className="flex flex-1 flex-col gap-2 text-xs font-medium text-zinc-400">
              Nota del recuerdo
              <textarea
                rows={5}
                value={note}
                maxLength={500}
                onChange={(e) => {
                  setNote(e.target.value)
                  if (noteError) setNoteError('')
                }}
                placeholder="¿Qué recuerdas de este momento?"
                className="min-h-[120px] flex-1 resize-none rounded-xl border border-white/10 bg-zinc-900/60 px-3.5 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400/30 focus:outline-none focus:ring-2 focus:ring-amber-400/15"
              />
            </label>
            <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
              <span>{noteError && <span className="text-red-400">{noteError}</span>}</span>
              <span>{note.length}/500</span>
            </div>
          </div>

          <div className="flex gap-2 border-t border-white/[0.06] p-4">
            <Button
              variant="danger"
              size="md"
              className="flex-1"
              onClick={() => onDelete(photo.id)}
            >
              Eliminar
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={handleSaveNote}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
