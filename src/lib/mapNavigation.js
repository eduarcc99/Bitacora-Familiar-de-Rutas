import { DEPARTMENT_TO_SLUG, departmentToSlug } from '../data/departmentPlaces'
import {
  boundsFromGeoJSON,
  boundsToLngLatBounds,
  getProvinceBounds,
  getRawPeruDepartments,
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

export function filterToAdminRefs(filter = EMPTY_FILTER, places = []) {
  /** Evita que autoDetect pise el filtro activo (Perú, región, etc.) */
  const pinned = Boolean(
    filter.country || filter.region || filter.province || filter.district,
  )
  let provinceFilterRef = null
  let departmentFilterRef = null

  if (filter.district) {
    const district = resolveCatalogPlace(places, filter.district)
    provinceFilterRef = district?.province_id ?? null
    if (filter.region === 'amazonas' || district?.province_id) {
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
    const district = resolveCatalogPlace(places, filter.district)
    const provId = district?.province_id
    const raw = await loadDistrictGeoJSON(provId)
    const feature = raw.features.find((f) => {
      const slug =
        f.properties.slug || getDistrictSlug(f.properties)
      return slug === filter.district
    })
    if (feature) return boundsFromFeature(feature)
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
