import Button from '../ui/Button'

export default function EditorChrome({
  userEmail,
  onViewMap,
  onSignOut,
  photoCount,
  uploadLoading,
  canUpload,
  onUploadClick,
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.06] bg-[#111113] px-4 lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-zinc-950 shadow-lg shadow-amber-500/20">
          EYL
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-50">
            Studio
          </h1>
          <p className="hidden text-[11px] text-zinc-500 sm:block">
            Editor de recuerdos
          </p>
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center sm:flex">
        <span className="rounded-full bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-400 ring-1 ring-white/[0.06]">
          {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {canUpload && (
          <Button
            variant="primary"
            size="md"
            onClick={onUploadClick}
            disabled={uploadLoading}
            className="hidden sm:inline-flex"
          >
            {uploadLoading ? 'Subiendo…' : 'Subir fotos'}
          </Button>
        )}
        {userEmail && (
          <span
            className="hidden max-w-[140px] truncate text-xs text-zinc-500 lg:inline"
            title={userEmail}
          >
            {userEmail}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={onViewMap}>
          Mapa
        </Button>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          Salir
        </Button>
      </div>
    </header>
  )
}
