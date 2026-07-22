import { DEPARTMENT_TO_SLUG, departmentToSlug } from '../data/departmentPlaces'
import {
  boundsFromGeoJSON,
  boundsToLngLatBounds,
  getProvinceBounds,
  getRawPeruDepartments,
  loadChachapoyasDistricts,
  loadDistrictGeoJSON,
} from '../data/regions'
import { getDistrictSlug } from '../data/districtPlaces'
import {
  EMPTY_FILTER,
  filterFromSlug,
  resolveCatalogPlace,
} from './placeCatalog'

export const GLOBE_VIEW = {
  center: [-75, -15],
  zoom: 1.8,
}

/** Zoom mínimo/máximo en modo Chachapoyas (libre dentro del área) */
export const SCOPED_MIN_ZOOM = 4
export const SCOPED_MAX_ZOOM = 18

function regionSlugToDepartmentName(regionSlug) {
  for (const [name, slug] of Object.entries(DEPARTMENT_TO_SLUG)) {
    if (slug === regionSlug) return name
  }
  return null
}

export function getPeruBounds() {
  return boundsToLngLatBounds(boundsFromGeoJSON(getRawPeruDepartments()))
}

export function getDepartmentBounds(regionSlug) {
  if (!regionSlug) return null
  const deptName = regionSlugToDepartmentName(regionSlug)
  if (!deptName) return null

  const features = getRawPeruDepartments().features.filter(
    (f) => (f.properties.NOMBDEP || '').toUpperCase() === deptName,
  )
  if (!features.length) return null
  return boundsToLngLatBounds(
    boundsFromGeoJSON({ type: 'FeatureCollection', features }),
  )
}

export function boundsFromFeature(feature) {
  if (!feature?.geometry) return null
  return boundsToLngLatBounds(
    boundsFromGeoJSON({ type: 'FeatureCollection', features: [feature] }),
  )
}

/** Acepta [[w,s],[e,n]] o LngLatBounds de MapLibre */
export function normalizeBounds(bounds) {
  if (!bounds) return null
  if (Array.isArray(bounds) && bounds.length === 2) {
    return bounds
  }
  if (typeof bounds.getWest === 'function') {
    return [
      [bounds.getWest(), bounds.getSouth()],
      [bounds.getEast(), bounds.getNorth()],
    ]
  }
  return null
}

export function isValidBounds(bounds) {
  const n = normalizeBounds(bounds)
  if (!n) return false
  const [[west, south], [east, north]] = n
  return (
    Number.isFinite(west) &&
    Number.isFinite(south) &&
    Number.isFinite(east) &&
    Number.isFinite(north) &&
    west < east &&
    south < north
  )
}

/** Margen extra para setMaxBounds — evita salir del polígono filtrado */
export function expandBoundsForMax(bounds, ratio = 0.12) {
  const normalized = normalizeBounds(bounds)
  if (!normalized) return null
  const [[west, south], [east, north]] = normalized
  const lngPad = (east - west) * ratio
  const latPad = (north - south) * ratio
  return [
    [west - lngPad, south - latPad],
    [east + lngPad, north + latPad],
  ]
}

/** Padding responsive para fitBounds (móvil y escritorio) */
export function getMapFitPadding(map) {
  const container = map?.getContainer?.()
  const w = container?.clientWidth ?? window.innerWidth
  const h = container?.clientHeight ?? window.innerHeight
  const shortSide = Math.min(w, h)
  const uniform = Math.round(Math.max(28, Math.min(72, shortSide * 0.1)))

  return {
    top: uniform + 16,
    bottom: uniform,
    left: uniform,
    right: uniform,
  }
}

/** Solo limita el pan; zoom libre entre SCOPED_MIN_ZOOM y SCOPED_MAX_ZOOM */
export function applyScopedMapLimits(map, bounds, options = {}) {
  const normalized = normalizeBounds(bounds)
  if (!map || !isValidBounds(normalized)) return null

  const ratio = options.maxBoundsRatio ?? 0.18
  map.setMaxBounds(expandBoundsForMax(normalized, ratio))
  map.setMinZoom(options.minZoom ?? SCOPED_MIN_ZOOM)
  map.setMaxZoom(options.maxZoom ?? SCOPED_MAX_ZOOM)

  return { normalized }
}

/**
 * Encuadra el área filtrada en pantalla (móvil/PC).
 * Usa cameraForBounds + jumpTo para un encuadre fiable.
 */
export function fitMapToScopedBounds(map, bounds, options = {}) {
  if (!map) return null

  map.resize()

  const normalized = normalizeBounds(bounds)
  if (!isValidBounds(normalized)) return null

  const padding = options.padding ?? getMapFitPadding(map)
  const [[west, south], [east, north]] = normalized
  const boundsW = east - west
  const boundsH = north - south
  const container = map.getContainer?.()
  const viewW = container?.clientWidth || 800
  const viewH = container?.clientHeight || 600
  const boundsAspect = boundsW / Math.max(boundsH, 1e-9)
  const viewAspect = viewW / Math.max(viewH, 1e-9)

  let zoomOutBias =
    options.zoomOutBias ?? (options.district ? 0.85 : 1.15)
  if (boundsAspect > viewAspect * 1.35) zoomOutBias += 0.45
  if (boundsH > boundsW * 1.35) zoomOutBias += 0.35

  const camera = map.cameraForBounds(normalized, {
    padding,
    maxZoom: SCOPED_MAX_ZOOM,
  })

  if (!camera?.center || camera.zoom == null) return null

  const targetZoom = Math.max(
    SCOPED_MIN_ZOOM,
    camera.zoom - zoomOutBias,
  )

  if (options.duration && options.duration > 0) {
    map.easeTo({
      center: camera.center,
      zoom: targetZoom,
      bearing: 0,
      pitch: 0,
      duration: options.duration,
      essential: true,
    })
  } else {
    map.jumpTo({
      center: camera.center,
      zoom: targetZoom,
      bearing: 0,
      pitch: 0,
    })
  }

  applyScopedMapLimits(map, normalized, options)

  return { normalized, fitZoom: targetZoom, center: camera.center }
}

async function findDistrictFeature(filter, places) {
  const district = resolveCatalogPlace(places, filter.district)
  const provId =
    district?.province_id ??
    (filter.province === 'chachapoyas' ? '0101' : null)

  const raw =
    provId === '0101'
      ? await loadChachapoyasDistricts()
      : await loadDistrictGeoJSON(provId)

  if (!raw?.features?.length) return null

  let feature = raw.features.find((f) => {
    const slug = f.properties.slug || getDistrictSlug(f.properties)
    return slug === filter.district
  })

  if (!feature && district?.name) {
    const name = district.name.toUpperCase()
    feature = raw.features.find(
      (f) => (f.properties.NOMBDIST || '').toUpperCase() === name,
    )
  }

  return feature ?? null
}

/** Bounds de un distrito por slug (dist-UBIGEO) */
export async function getDistrictBoundsBySlug(districtSlug) {
  if (!districtSlug) return null
  const raw = await loadChachapoyasDistricts()
  const feature = raw.features.find(
    (f) => getDistrictSlug(f.properties) === districtSlug,
  )
  return feature ? boundsFromFeature(feature) : null
}

/** Bounds de todos los distritos de Chachapoyas (más fiable que provincia INEI) */
export async function getChachapoyasProvinceBounds() {
  const raw = await loadChachapoyasDistricts()
  return boundsToLngLatBounds(boundsFromGeoJSON(raw))
}

export function filterToAdminRefs(filter = EMPTY_FILTER, places = []) {
  const pinned = Boolean(
    filter.country || filter.region || filter.province || filter.district,
  )
  let provinceFilterRef = null
  let departmentFilterRef = null

  if (filter.district) {
    const district = resolveCatalogPlace(places, filter.district)
    provinceFilterRef = district?.province_id ?? '0101'
    if (filter.region === 'amazonas' || provinceFilterRef) {
      departmentFilterRef = 'AMAZONAS'
    }
  } else if (filter.province) {
    const province = resolveCatalogPlace(places, filter.province)
    provinceFilterRef = province?.province_id ?? null
    if (filter.region === 'amazonas') {
      departmentFilterRef = 'AMAZONAS'
    }
  } else if (filter.region) {
    departmentFilterRef = regionSlugToDepartmentName(filter.region)
  }

  return { pinned, provinceFilterRef, departmentFilterRef }
}

export async function getBoundsForFilter(places, filter = EMPTY_FILTER) {
  if (!filter?.country) return null

  if (filter.district) {
    const feature = await findDistrictFeature(filter, places)
    if (feature) return boundsFromFeature(feature)
    const bySlug = await getDistrictBoundsBySlug(filter.district)
    if (bySlug) return bySlug
    console.warn('[EYL nav] distrito sin bounds:', filter.district)
    return null
  }

  if (filter.province === 'chachapoyas') {
    return getChachapoyasProvinceBounds()
  }

  if (filter.province) {
    const province = resolveCatalogPlace(places, filter.province)
    if (province?.province_id) {
      const box = getProvinceBounds(province.province_id)
      if (box) return box
    }
  }

  if (filter.region) {
    return getDepartmentBounds(filter.region)
  }

  if (filter.country === 'peru') {
    return getPeruBounds()
  }

  return null
}

export function filterFromProvinceFeature(places, feature) {
  const provId =
    feature.properties.province_id ||
    feature.properties.FIRST_IDPR ||
    feature.properties.IDPROV

  const place = places.find((p) => p.province_id === provId)
  if (place) return filterFromSlug(places, place.slug)

  const deptName =
    feature.properties.FIRST_NOMB || feature.properties.NOMBDEP
  const regionSlug = departmentToSlug(deptName)

  if (regionSlug) {
    return {
      ...EMPTY_FILTER,
      country: 'peru',
      region: regionSlug,
      province: null,
      district: null,
    }
  }

  return { ...EMPTY_FILTER, country: 'peru' }
}

export function filterKey(filter = EMPTY_FILTER) {
  return [filter.country, filter.region, filter.province, filter.district].join(
    '|',
  )
}
