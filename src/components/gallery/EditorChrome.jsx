function IconBtn({ label, onClick, variant = 'ghost', children }) {
  const styles = {
    ghost:
      'bg-white/[0.04] text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.08] hover:text-white active:scale-95',
    danger:
      'bg-white/[0.04] text-zinc-400 ring-1 ring-white/[0.08] hover:bg-red-500/15 hover:text-red-300 hover:ring-red-500/30 active:scale-95',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={[
        'editor-icon-btn relative inline-flex size-10 items-center justify-center rounded-xl transition-all duration-200',
        styles[variant],
      ].join(' ')}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

export default function EditorChrome({
  onViewMap,
  onSignOut,
  photoCount,
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-white/[0.06] bg-[#111113] px-3 sm:h-14 sm:gap-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="editor-brand-mark flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-[11px] font-bold tracking-wide text-zinc-950 shadow-lg shadow-amber-500/25">
          EYL
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-50">
            Gestión
          </h1>
          <p className="truncate text-[11px] text-zinc-500">
            {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <IconBtn label="Ver mapa" onClick={onViewMap} variant="ghost">
          <svg className="editor-icon-globe size-[1.35rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M3 12h18" />
            <path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9s1.2-6.4 3.6-9Z" />
          </svg>
        </IconBtn>

        <IconBtn label="Salir" onClick={onSignOut} variant="danger">
          <svg className="editor-icon-exit size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 16l4-4-4-4M4 12h10" />
          </svg>
        </IconBtn>
      </div>
    </header>
  )
}
