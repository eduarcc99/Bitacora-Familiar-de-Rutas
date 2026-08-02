import { useEffect, useState } from 'react'
import {
  EMPTY_FILTER,
  getCountryOptions,
  getDistrictOptions,
  getFilterSummary,
  getProvinceOptions,
  getRegionOptions,
  initDistrictCatalog,
} from '../lib/placeCatalog'

export default function MapFilterBar({ places, filter, onChange }) {
  const [catalogReady, setCatalogReady] = useState(false)

  useEffect(() => {
    let mounted = true
    initDistrictCatalog().then(() => {
      if (mounted) setCatalogReady(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  const countries = getCountryOptions(places)
  const regions = getRegionOptions(places, filter.country)
  const provinces = getProvinceOptions(places, filter.region)
  const districts = catalogReady
    ? getDistrictOptions(places, filter.province)
    : []

  const hasFilter =
    filter.country || filter.region || filter.province || filter.district
  const summary = getFilterSummary(places, filter)

  function setCountry(slug) {
    if (!slug) onChange({ ...EMPTY_FILTER })
    else onChange({ ...EMPTY_FILTER, country: slug })
  }

  function setRegion(slug) {
    onChange({ ...filter, region: slug || null, province: null, district: null })
  }

  function setProvince(slug) {
    onChange({ ...filter, province: slug || null, district: null })
  }

  function setDistrict(slug) {
    onChange({ ...filter, district: slug || null })
  }

  return (
    <footer className="map-filter-bar" aria-label="Filtrar mapa">
      <div className="map-filter-bar__summary">
        <span className="map-filter-bar__label">Explorar</span>
        <span className="map-filter-bar__value">{summary}</span>
      </div>

      <div className="map-filter-bar__controls">
        <label className="map-filter-bar__field">
          <span className="sr-only">País</span>
          <select
            className="map-filter-bar__select"
            value={filter.country ?? ''}
            onChange={(e) => setCountry(e.target.value || null)}
          >
            <option value="">Todos · Tierra</option>
            {countries.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {filter.country && (
          <label className="map-filter-bar__field">
            <span className="sr-only">Región</span>
            <select
              className="map-filter-bar__select"
              value={filter.region ?? ''}
              onChange={(e) => setRegion(e.target.value || null)}
            >
              <option value="">Todas las regiones</option>
              {regions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {filter.region && (
          <label className="map-filter-bar__field">
            <span className="sr-only">Provincia</span>
            <select
              className="map-filter-bar__select"
              value={filter.province ?? ''}
              onChange={(e) => setProvince(e.target.value || null)}
              disabled={!provinces.length}
            >
              <option value="">Todas las provincias</option>
              {provinces.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {filter.province && (
          <label className="map-filter-bar__field">
            <span className="sr-only">Distrito</span>
            <select
              className="map-filter-bar__select"
              value={filter.district ?? ''}
              onChange={(e) => setDistrict(e.target.value || null)}
              disabled={!districts.length}
            >
              <option value="">Todos los distritos</option>
              {districts.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {hasFilter && (
          <button
            type="button"
            className="btn btn--ghost btn--sm map-filter-bar__clear"
            onClick={() => onChange({ ...EMPTY_FILTER })}
          >
            Limpiar · Globo
          </button>
        )}
      </div>

      {!filter.country && (
        <p className="map-filter-bar__hint">
          Vista global · Elige un país o región y el mapa irá ahí
        </p>
      )}
    </footer>
  )
}
