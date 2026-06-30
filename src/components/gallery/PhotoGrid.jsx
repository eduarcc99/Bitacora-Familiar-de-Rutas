import { getPhotoPublicUrl } from '../../lib/supabase'
import { cn } from '../../lib/cn'

export default function PhotoGrid({ photos, showPlaceLabel, onPhotoClick }) {
  if (!photos.length) return null

  return (
    <div className="columns-2 gap-3 sm:columns-3 xl:columns-4 2xl:columns-5 [column-gap:12px]">
      {photos.map((entry, index) => {
        const alt = showPlaceLabel
          ? `Foto de ${entry.placeName}`
          : `Recuerdo ${index + 1} de ${photos.length}`

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onPhotoClick(index)}
            className={cn(
              'group relative mb-3 w-full break-inside-avoid overflow-hidden rounded-xl',
              'bg-zinc-800 ring-1 ring-white/[0.06]',
              'transition-all duration-300 hover:ring-amber-400/30 hover:shadow-[var(--shadow-editor-md)]',
              'focus-visible:ring-2 focus-visible:ring-amber-400/50',
            )}
          >
            <img
              src={getPhotoPublicUrl(entry.photo_path)}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="block w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm ring-1 ring-white/20">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              </span>
            </div>
            {showPlaceLabel && (
              <span className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-10 text-left text-[11px] font-medium text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {entry.placeName}
              </span>
            )}
            {!showPlaceLabel && entry.visit_date && (
              <span className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                {entry.visit_date}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
