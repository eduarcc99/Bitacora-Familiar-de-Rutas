import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import Button from '../ui/Button'

export default function UploadModal({
  open,
  onClose,
  placeName,
  loading,
  onUpload,
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  if (!open) return null

  function handleFiles(fileList) {
    onUpload?.(fileList)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Subir fotos"
      onClick={onClose}
    >
      <div
        className="animate-editor-in w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#18181b] shadow-[var(--shadow-editor-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-50">Subir fotos</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{placeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            'mx-5 my-5 flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all',
            dragOver
              ? 'border-amber-400/60 bg-amber-400/5'
              : 'border-white/10 bg-white/[0.02] hover:border-white/15',
          )}
        >
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/20">
            <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-7.5-7.5 7.5-7.5m-7.5 7.5L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-200">
            Arrastra tus imágenes aquí
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            JPG, PNG, WebP · se recomienda menos de 10 MB por foto
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={loading}
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <Button
            variant="primary"
            size="md"
            className="mt-5"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? 'Subiendo…' : 'Seleccionar archivos'}
          </Button>
        </div>
      </div>
    </div>
  )
}
