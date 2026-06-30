import { getBreadcrumb, getChildren, getPlaceBySlug } from '../data/places'
import {
  getAllDepartmentPlaces,
  getDepartmentPlace,
} from '../data/departmentPlaces'
import {
  getAllDistrictPlaces,
  getDistrictPlace,
  registerDistrictGeoJSON,
} from '../data/districtPlaces'
import { loadAmazonasDistricts } from '../data/regions'
import { getPhotoPublicUrl } from './supabase'

let districtsReady = false

export const EMPTY_FILTER = {
  country: null,
  region: null,
  province: null,
  district: null,
}

/** Filtro inicial del editor (por ahora Perú › Amazonas) */
export const DEFAULT_FILTER = {
  country: 'peru',
  region: 'amazonas',
  province: null,
  district: null,
}

export function resolveInitialFilter(places, initialSlug) {
  if (initialSlug) return filterFromSlug(places, initialSlug)
  return { ...DEFAULT_FILTER }
}

export async function initDistrictCatalog() {
  if (districtsReady) return getAllDistrictPlaces()
  const geo = await loadAmazonasDistricts()
  const list = registerDistrictGeoJSON(geo)
  districtsReady = true
  return list
}

export function resolveCatalogPlace(places, slug) {
  if (!slug) return null
  return (
    getPlaceBySlug(places, slug) ||
    getDepartmentPlace(slug) ||
    getDistrictPlace(slug)
  )
}

export function getCatalogChildren(places, parentSlug) {
  if (parentSlug === 'peru') {
    return getAllDepartmentPlaces()
  }

  const staticChildren = getChildren(places, parentSlug)
  const districtChildren = getAllDistrictPlaces()
    .filter((d) => d.parent_slug === parentSlug)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return [...staticChildren, ...districtChildren]
}

export function getCatalogBreadcrumb(places, slug) {
  return getBreadcrumb(places, slug, (s) => getDistrictPlace(s) || getDepartmentPlace(s))
}

/** Departamento al que pertenece un place_slug (foto, distrito, POI…) */
export function getDepartmentSlugForPlace(places, slug) {
  if (!slug) return null

  const dept = getDepartmentPlace(slug)
  if (dept) return dept.slug

  const place = getPlaceBySlug(places, slug) || getDistrictPlace(slug)
  if (!place) return null

  if (place.level === 'region') return place.slug

  const trail = getCatalogBreadcrumb(places, slug)
  const regionInTrail = trail.find((p) => p.level === 'region')
  if (regionInTrail) return regionInTrail.slug

  if (place.parent_slug) {
    return getDepartmentSlugForPlace(places, place.parent_slug)
  }

  return null
}

function placeUnderProvince(places, placeSlug, provinceSlug) {
  if (placeSlug === provinceSlug) return true
  const place = resolveCatalogPlace(places, placeSlug)
  if (!place) return false
  if (place.parent_slug === provinceSlug) return true
  if (place.parent_slug) {
    return placeUnderProvince(places, place.parent_slug, provinceSlug)
  }
  return false
}

function entryMatchesFilter(places, placeSlug, filter) {
  if (!filter.country) return true

  const dept = getDepartmentSlugForPlace(places, placeSlug)
  const inPeru = filter.country === 'peru' && Boolean(dept)

  if (!inPeru) return false
  if (!filter.region) return true
  if (dept !== filter.region) return false
  if (!filter.province) return true
  if (!placeUnderProvince(places, placeSlug, filter.province)) return false
  if (!filter.district) return true
  return placeSlug === filter.district
}

export function collectDescendantSlugs(places, rootSlug) {
  const slugs = new Set()
  if (!rootSlug) return slugs

  function walk(slug) {
    if (!slug || slugs.has(slug)) return
    slugs.add(slug)
    for (const child of getCatalogChildren(places, slug)) {
      walk(child.slug)
    }
  }

  walk(rootSlug)
  return slugs
}

export function getActiveFilterSlug(filter = EMPTY_FILTER) {
  if (filter.district) return filter.district
  if (filter.province) return filter.province
  if (filter.region) return filter.region
  if (filter.country) return filter.country
  return null
}

export function filterFromSlug(places, slug) {
  if (!slug || slug === 'peru') {
    return slug === 'peru'
      ? { ...EMPTY_FILTER, country: 'peru' }
      : { ...EMPTY_FILTER }
  }

  const place = resolveCatalogPlace(places, slug)
  if (!place) return { ...EMPTY_FILTER }

  const filter = { country: 'peru', region: null, province: null, district: null }

  if (place.level === 'region') {
    filter.region = place.slug
    return filter
  }

  const trail = getCatalogBreadcrumb(places, slug)

  for (const item of trail) {
    if (item.level === 'region') filter.region = item.slug
    if (item.level === 'district') filter.district = item.slug
    if (item.province_id && item.parent_slug === 'amazonas') {
      filter.province = item.slug
    }
  }

  if (place.level === 'district') filter.district = place.slug
  if (place.province_id && place.parent_slug === 'amazonas') {
    filter.province = place.slug
    filter.region = 'amazonas'
  }
  if (place.level === 'poi' && place.parent_slug === 'amazonas' && !place.province_id) {
    filter.region = 'amazonas'
  }
  if (place.level === 'poi' && place.parent_slug !== 'amazonas') {
    const parent = resolveCatalogPlace(places, place.parent_slug)
    if (parent?.level === 'region') filter.region = parent.slug
    if (parent?.province_id) {
      filter.province = parent.slug
      filter.region = 'amazonas'
    }
  }

  return filter
}

export function getCountryOptions(places) {
  return places.filter((p) => p.level === 'country')
}

/** 24 departamentos del Perú (GeoJSON INEI) */
export function getRegionOptions(_places, countrySlug) {
  if (countrySlug !== 'peru') return []
  return getAllDepartmentPlaces()
}

export function getProvinceOptions(places, regionSlug) {
  if (regionSlug !== 'amazonas') return []
  return getChildren(places, 'amazonas')
    .filter((p) => p.province_id)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function getDistrictOptions(_places, provinceSlug) {
  if (!provinceSlug) return []
  return getAllDistrictPlaces()
    .filter((d) => d.parent_slug === provinceSlug)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function isAmazonasRegion(regionSlug) {
  return regionSlug === 'amazonas'
}

export function getFilteredPhotoEntries(places, entries, filter = EMPTY_FILTER) {
  const withPhotos = (entries ?? []).filter((e) => e.photo_path)

  if (!filter.country) {
    return withPhotos.map((entry) => enrichEntry(places, entry)).sort(byDateDesc)
  }

  return withPhotos
    .filter((e) => entryMatchesFilter(places, e.place_slug, filter))
    .map((entry) => enrichEntry(places, entry))
    .sort(byDateDesc)
}

function enrichEntry(places, entry) {
  const place = resolveCatalogPlace(places, entry.place_slug)
  return {
    ...entry,
    placeName: place?.name ?? entry.place_slug,
    placeSlug: entry.place_slug,
  }
}

function byDateDesc(a, b) {
  const da = a.visit_date || a.created_at || ''
  const db = b.visit_date || b.created_at || ''
  return db.localeCompare(da)
}

export function getFilterSummary(places, filter = EMPTY_FILTER) {
  if (!filter.country) return 'Todos los lugares'
  const parts = []
  const country = resolveCatalogPlace(places, filter.country)
  if (country) parts.push(country.name)
  if (filter.region) {
    parts.push(
      resolveCatalogPlace(places, filter.region)?.name ?? filter.region,
    )
  }
  if (filter.province) {
    parts.push(
      resolveCatalogPlace(places, filter.province)?.name ?? filter.province,
    )
  }
  if (filter.district) {
    parts.push(
      resolveCatalogPlace(places, filter.district)?.name ?? filter.district,
    )
  }
  return parts.join(' › ')
}

export function photosForSlug(entries, slug) {
  return (entries ?? []).filter((e) => e.place_slug === slug && e.photo_path)
}

export function coverPhotoForSlug(entries, slug) {
  const first = photosForSlug(entries, slug)[0]
  return first ? getPhotoPublicUrl(first.photo_path) : null
}

export function searchCatalog(places, query, limit = 24) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const seen = new Set()
  const results = []

  for (const place of [
    ...places,
    ...getAllDepartmentPlaces(),
    ...getAllDistrictPlaces(),
  ]) {
    if (seen.has(place.slug)) continue
    const name = place.name?.toLowerCase() ?? ''
    if (name.includes(q) || place.slug.includes(q)) {
      seen.add(place.slug)
      results.push(place)
    }
  }

  return results
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}
