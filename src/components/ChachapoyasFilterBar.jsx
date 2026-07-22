import { useEffect, useState } from 'react'
import {
  getDistrictOptions,
  getFilterSummary,
  initDistrictCatalog,
} from '../lib/placeCatalog'
import {
  clampFilterToChachapoyas,
  VISITOR_INITIAL_FILTER,
} from '../lib/mapScope'

export default function ChachapoyasFilterBar({ places, filter, onChange }) {
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

  const safeFilter = clampFilterToChachapoyas(filter)
  const districts = catalogReady
    ? getDistrictOptions(places, safeFilter.province)
    : []
  const summary = getFilterSummary(places, safeFilter)

  function setDistrict(slug) {
    onChange({
      ...safeFilter,
      district: slug || null,
    })
  }

  return (
    <footer className="map-filter-bar" aria-label="Explorar Chachapoyas">
      <div className="map-filter-bar__summary">
        <span className="map-filter-bar__label">Chachapoyas</span>
        <span className="map-filter-bar__value">{summary}</span>
      </div>

      <div className="map-filter-bar__controls">
        <label className="map-filter-bar__field">
          <span className="sr-only">Distrito</span>
          <select
            className="map-filter-bar__select"
            value={safeFilter.district ?? ''}
            onChange={(e) => setDistrict(e.target.value || null)}
            disabled={!districts.length}
          >
            <option value="">Toda la provincia</option>
            {districts.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        {safeFilter.district && (
          <button
            type="button"
            className="btn btn--ghost btn--sm map-filter-bar__clear"
            onClick={() => onChange({ ...VISITOR_INITIAL_FILTER })}
          >
            Ver toda la provincia
          </button>
        )}
      </div>

      <p className="map-filter-bar__hint">
        Ajuste automático a pantalla · Pellizca o usa +/− · Cambia el filtro para
        otro distrito
      </p>
    </footer>
  )
}
