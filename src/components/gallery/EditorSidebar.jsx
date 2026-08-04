import { useEffect, useState } from 'react'
import {
  EMPTY_FILTER,
  getCountryOptions,
  getDistrictOptions,
  getFilterSummary,
  getProvinceOptions,
  getRegionOptions,
} from '../../lib/placeCatalog'
import Button from '../ui/Button'

function pickerStep(filter) {
  if (!filter.country) return 'country'
  if (!filter.region) return 'region'
  if (!filter.province) return 'province'
  return 'district'
}

export default function EditorSidebar({
  places,
  filter,
  onChange,
  catalogReady,
  uploadPlace,
  uploadLoading,
  onUploadClick,
}) {
  const [open, setOpen] = useState(!filter.district)

  const countries = getCountryOptions(places)
  const regions = getRegionOptions(places, filter.country)
  const provinces = getProvinceOptions(places, filter.region)
  const districts = catalogReady
    ? getDistrictOptions(places, filter.province)
    : []

  const step = pickerStep(filter)
  const summary = getFilterSummary(places, filter)
  const ready = Boolean(uploadPlace)

  // Al elegir distrito, cerrar el desplegable
  useEffect(() => {
    if (filter.district) setOpen(false)
  }, [filter.district])

  // Si aún no hay distrito, abrir para elegir
  useEffect(() => {
    if (!filter.district) setOpen(true)
  }, [filter.country, filter.region, filter.province])

  function pickCountry(slug) {
    onChange({ ...EMPTY_FILTER, country: slug })
  }

  function pickRegion(slug) {
    onChange({
      country: filter.country || 'peru',
      region: slug,
      province: null,
      district: null,
    })
  }

  function pickProvince(slug) {
    onChange({ ...filter, province: slug, district: null })
  }

  function pickDistrict(slug) {
    onChange({ ...filter, district: slug })
  }

  function handleBack() {
    if (step === 'district') {
      onChange({ ...filter, province: null, district: null })
    } else if (step === 'province') {
      onChange({
        country: filter.country || 'peru',
        region: null,
        province: null,
        district: null,
      })
    } else if (step === 'region') {
      onChange({ ...EMPTY_FILTER })
    }
  }

  let title = 'Elige país'
  let options = countries.map((c) => ({
    slug: c.slug,
    name: c.name,
    onClick: () => pickCountry(c.slug),
  }))

  if (step === 'region') {
    title = 'Departamento'
    options = regions.map((r) => ({
      slug: r.slug,
      name: r.name,
      onClick: () => pickRegion(r.slug),
    }))
  } else if (step === 'province') {
    title = 'Provincia'
    options = provinces.map((p) => ({
      slug: p.slug,
      name: p.name,
      onClick: () => pickProvince(p.slug),
    }))
  } else if (step === 'district') {
    title = 'Distrito'
    options = districts.map((d) => ({
      slug: d.slug,
      name: d.name,
      selected: d.slug === filter.district,
      onClick: () => pickDistrict(d.slug),
    }))
  }

  const triggerLabel = ready
    ? uploadPlace.name
    : filter.province || filter.region || filter.country
      ? summary
      : 'Elegir lugar'

  const triggerHint = ready
    ? summary
    : step === 'district'
      ? 'Elige un distrito'
      : step === 'province'
        ? 'Elige una provincia'
        : step === 'region'
          ? 'Elige un departamento'
          : 'Toca para elegir'

  return (
    <aside className="w-full shrink-0 border-b border-white/[0.06] bg-[#111113] lg:flex lg:h-full lg:w-80 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="relative px-3 py-2.5 lg:px-4 lg:py-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Dónde subir
        </p>

        {/* Trigger compacto */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={[
            'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition',
            'ring-1 active:scale-[0.99]',
            ready
              ? 'bg-emerald-400/10 ring-emerald-400/30'
              : 'bg-white/[0.04] ring-white/10',
            open ? 'ring-amber-400/40' : '',
          ].join(' ')}
        >
          <span className="min-w-0 flex-1">
            <span
              className={[
                'block truncate text-sm font-semibold',
                ready ? 'text-emerald-100' : 'text-zinc-100',
              ].join(' ')}
            >
              {triggerLabel}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
              {triggerHint}
            </span>
          </span>
          <svg
            className={[
              'size-5 shrink-0 text-zinc-400 transition-transform',
              open ? 'rotate-180' : '',
            ].join(' ')}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Panel desplegable */}
        {open ? (
          <div className="absolute left-3 right-3 z-30 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#16161a] shadow-2xl shadow-black/50 lg:static lg:mt-3 lg:shadow-none">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-2.5 py-2">
              {step !== 'country' ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex size-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/[0.06]"
                  aria-label="Volver"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
                  </svg>
                </button>
              ) : null}
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {title}
              </span>
              {step === 'district' && !catalogReady ? (
                <span className="ml-auto text-[11px] text-zinc-500">Cargando…</span>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 lg:hidden"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="editor-scroll max-h-[42dvh] overflow-y-auto overscroll-contain p-1.5 lg:max-h-none lg:flex-1">
              {options.map((opt) => (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={opt.onClick}
                  className={[
                    'flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition',
                    opt.selected
                      ? 'bg-amber-400/15 font-medium text-amber-100'
                      : 'text-zinc-200 hover:bg-white/[0.05]',
                  ].join(' ')}
                >
                  <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                  {opt.selected ? (
                    <span className="ml-2 text-amber-400">✓</span>
                  ) : (
                    <svg className="ml-2 size-4 shrink-0 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                    </svg>
                  )}
                </button>
              ))}
              {!options.length ? (
                <p className="px-3 py-4 text-center text-xs text-zinc-500">
                  {step === 'district' && !catalogReady
                    ? 'Cargando distritos…'
                    : 'Sin opciones'}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 border-t border-white/[0.06] p-2">
              <button
                type="button"
                onClick={() => {
                  onChange({ ...EMPTY_FILTER, country: 'peru' })
                  setOpen(true)
                }}
                className="flex-1 rounded-lg px-2 py-2 text-xs font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        ) : null}

        {/* Acciones compactas bajo el trigger */}
        <div className="mt-2 flex gap-2">
          {ready ? (
            <Button
              variant="primary"
              size="md"
              className="min-w-0 flex-1"
              onClick={onUploadClick}
              disabled={uploadLoading}
            >
              {uploadLoading ? 'Subiendo…' : `Subir a ${uploadPlace.name}`}
            </Button>
          ) : (
            <p className="px-0.5 text-xs text-zinc-500">
              Abre el menú y elige hasta el distrito.
            </p>
          )}
        </div>
      </div>

      {/* Desktop: lista fija si está abierto (ya renderizada arriba); spacer */}
      <div className="hidden flex-1 lg:block" />
    </aside>
  )
}
