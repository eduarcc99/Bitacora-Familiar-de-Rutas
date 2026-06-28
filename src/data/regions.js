import rawPeruDepartments from './peru-departments.json'
import rawPeruProvinces from './peru-provinces.json'
import { getPlaceBySlug } from './places'
import { getPhotoPublicUrl } from '../lib/supabase'

/** NOMBDEP (GeoJSON INEI) → slug en nuestra app */
export const DEPARTMENT_TO_SLUG = {
  AMAZONAS: 'amazonas',
  AREQUIPA: 'arequipa',
  AYACUCHO: 'ayacucho',
  CUSCO: 'cusco',
  LIMA: 'lima',
  PUNO: 'puno',
}

export function getRawPeruDepartments() {
  return rawPeruDepartments
}

export function getRawPeruProvinces() {
  return rawPeruProvinces
}

export function departmentToSlug(name) {
  return DEPARTMENT_TO_SLUG[name?.toUpperCase?.()] ?? null
}

export function filterByProvinceId(features, provinceId) {
  if (!provinceId) return features
  return features.filter((feature) => {
    const id = feature.properties.IDDIST || feature.properties.FIRST_IDPR
    const idProv = feature.properties.IDPROV
    return (
      idProv === provinceId ||
      feature.properties.FIRST_IDPR === provinceId ||
      String(id ?? '').startsWith(provinceId)
    )
  })
}

export function filterByDepartmentName(features, departmentName) {
  if (!departmentName) return features
  return features.filter((feature) => {
    const dept = feature.properties.FIRST_NOMB || feature.properties.NOMBDEP
    return dept?.toUpperCase?.() === departmentName.toUpperCase()
  })
}

export const CHACHAPOYAS_PROVINCE_ID = '0101'

/** Las 7 provincias de Amazonas (distritos detallados disponibles) */
export const AMAZONAS_PROVINCE_IDS = [
  '0101', // Chachapoyas
  '0102', // Bagua
  '0103', // Bongará
  '0104', // Condorcanqui
  '0105', // Luya
  '0106', // Rodríguez de Mendoza
  '0107', // Utcubamba
]

export function isAmazonasProvinceId(provinceId) {
  return AMAZONAS_PROVINCE_IDS.includes(provinceId)
}

/** Provincia Amazonas (ID INEI) → slug principal en places */
export const AMAZONAS_PROVINCE_TO_SLUG = {
  '0101': 'chachapoyas',
  '0102': 'bagua',
  '0103': 'jumbilla',
  '0104': 'nieva',
  '0105': 'lamud',
  '0106': 'mendoza-amazonas',
  '0107': 'bagua-grande',
}

export function buildMapInfoTargets(places, regionsGeoJSON, provincesGeoJSON) {
  const bySlug = new Map()

  const add = (target) => {
    if (!target?.slug) return
    if (!bySlug.has(target.slug)) bySlug.set(target.slug, target)
  }

  for (const place of places) {
    const minZoom = place.level === 'country' ? 5 : place.level === 'region' ? 7.5 : 8
    add({
      slug: place.slug,
      name: place.name,
      lng: place.lng,
      lat: place.lat,
      minZoom,
      maxZoom: 18,
      offsetX: place.level === 'poi' ? 34 : 40,
      offsetY: place.level === 'poi' ? 8 : 0,
    })
  }

  for (const feature of geoJSONToLabelPoints(regionsGeoJSON).features) {
    if (!feature.properties.slug) continue
    add({
      slug: feature.properties.slug,
      name: feature.properties.name,
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      minZoom: 4.2,
      maxZoom: 6.95,
      offsetX: 44,
      offsetY: -4,
    })
  }

  for (const feature of geoJSONToLabelPoints(provincesGeoJSON).features) {
    const provId = feature.properties.province_id || feature.properties.FIRST_IDPR
    const slug = AMAZONAS_PROVINCE_TO_SLUG[provId]
    if (!slug) continue
    add({
      slug,
      name: feature.properties.name,
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      minZoom: 6.9,
      maxZoom: 9.95,
      offsetX: 44,
      offsetY: -4,
    })
  }

  return [...bySlug.values()]
}

function pointInRing([lng, lat], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInGeometry(point, geometry) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') {
    return pointInRing(point, geometry.coordinates[0])
  }
  return geometry.coordinates.some((poly) => pointInRing(point, poly[0]))
}

export function findProvinceAtPoint(lng, lat, rawGeoJSON) {
  for (const feature of rawGeoJSON.features) {
    if (pointInGeometry([lng, lat], feature.geometry)) {
      return feature.properties.FIRST_IDPR || feature.properties.IDPROV
    }
  }
  return null
}

export function findDepartmentAtPoint(lng, lat) {
  for (const feature of rawPeruDepartments.features) {
    if (pointInGeometry([lng, lat], feature.geometry)) {
      return feature.properties.NOMBDEP
    }
  }
  return null
}

function featureIntersectsBBox(feature, west, south, east, north) {
  const geometry = feature.geometry
  if (!geometry) return false

  const polys =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.coordinates ?? []

  for (const poly of polys) {
    for (const ring of poly) {
      for (const [lng, lat] of ring) {
        if (lng >= west && lng <= east && lat >= south && lat <= north) {
          return true
        }
      }
    }
  }
  return false
}

/** Solo distritos visibles en pantalla — evita 1800+ polígonos al hacer zoom local */
export function filterFeaturesByBounds(features, bounds, paddingRatio = 0.15) {
  if (!bounds || !features.length) return features

  const [[west, south], [east, north]] = bounds
  const lngPad = (east - west) * paddingRatio
  const latPad = (north - south) * paddingRatio

  return features.filter((feature) =>
    featureIntersectsBBox(
      feature,
      west - lngPad,
      south - latPad,
      east + lngPad,
      north + latPad
    )
  )
}

export function boundsFromGeoJSON(geojson) {
  const bounds = new maplibreglBounds()
  for (const feature of geojson.features) {
    extendBoundsWithGeometry(bounds, feature.geometry)
  }
  return bounds
}

function maplibreglBounds() {
  return { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity, valid: false }
}

function extendBoundsWithGeometry(bounds, geometry) {
  if (!geometry) return
  const rings =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.coordinates ?? []

  rings.forEach((poly) => {
    poly[0]?.forEach(([lng, lat]) => {
      bounds.minLng = Math.min(bounds.minLng, lng)
      bounds.maxLng = Math.max(bounds.maxLng, lng)
      bounds.minLat = Math.min(bounds.minLat, lat)
      bounds.maxLat = Math.max(bounds.maxLat, lat)
      bounds.valid = true
    })
  })
}

export function boundsToLngLatBounds(bounds) {
  if (!bounds.valid) return null
  return [
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
  ]
}

function ringCentroid(ring) {
  if (!ring?.length) return null
  let area = 0
  let cx = 0
  let cy = 0
  const n = ring.length - 1

  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    const cross = x1 * y2 - x2 * y1
    area += cross
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }

  area *= 0.5
  if (Math.abs(area) < 1e-12) {
    let lng = 0
    let lat = 0
    for (let i = 0; i < n; i++) {
      lng += ring[i][0]
      lat += ring[i][1]
    }
    return [lng / n, lat / n]
  }

  return [cx / (6 * area), cy / (6 * area)]
}

function geometryCentroid(geometry) {
  if (!geometry) return null
  if (geometry.type === 'Polygon') {
    return ringCentroid(geometry.coordinates[0])
  }
  if (geometry.type === 'MultiPolygon') {
    let largest = geometry.coordinates[0][0]
    let maxLen = largest.length
    for (const poly of geometry.coordinates) {
      if (poly[0].length > maxLen) {
        maxLen = poly[0].length
        largest = poly[0]
      }
    }
    return ringCentroid(largest)
  }
  return null
}

/** Puntos en el centro de cada polígono — etiquetas fiables en MapLibre */
export function geoJSONToLabelPoints(geojson) {
  const features = []

  for (const feature of geojson.features) {
    const coordinates = geometryCentroid(feature.geometry)
    if (!coordinates) continue
    features.push({
      type: 'Feature',
      properties: feature.properties,
      geometry: { type: 'Point', coordinates },
    })
  }

  return { type: 'FeatureCollection', features }
}

export function getProvinceBounds(provinceId) {
  const source = detailedProvincesCache ?? rawPeruProvinces
  const feature = source.features.find(
    (f) =>
      f.properties.FIRST_IDPR === provinceId ||
      f.properties.IDPROV === provinceId
  )
  if (!feature) return null
  const b = maplibreglBounds()
  extendBoundsWithGeometry(b, feature.geometry)
  return boundsToLngLatBounds(b)
}

function isPlaceUnderRegion(place, regionSlug, places) {
  let current = place
  while (current) {
    if (current.slug === regionSlug) return true
    current = current.parent_slug
      ? getPlaceBySlug(places, current.parent_slug)
      : null
  }
  return false
}

function normalizeAdminName(name) {
  return (
    name
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? ''
  )
}

/** Agrupa todas las entradas por slug (varias fotos = collage) */
export function groupEntriesBySlug(entries) {
  const map = {}
  for (const entry of entries ?? []) {
    if (!map[entry.place_slug]) map[entry.place_slug] = []
    map[entry.place_slug].push(entry)
  }
  return map
}

function photoUrlsFromEntries(entryList) {
  return (entryList ?? [])
    .filter((e) => e.status === 'visited' && e.photo_path)
    .map((e) => getPhotoPublicUrl(e.photo_path))
    .filter(Boolean)
}

function slugsForDepartment(deptName, places) {
  const slug = departmentToSlug(deptName)
  return slug ? [slug] : []
}

function slugsForProvince(feature, places) {
  const provId =
    feature.properties.province_id ||
    feature.properties.FIRST_IDPR ||
    feature.properties.IDPROV
  const mapped = AMAZONAS_PROVINCE_TO_SLUG[provId]
  if (mapped) return [mapped]
  return places.filter((p) => p.province_id === provId).map((p) => p.slug)
}

function slugsForDistrict(feature, places) {
  const provId =
    feature.properties.province_id ||
    feature.properties.FIRST_IDPR ||
    feature.properties.IDPROV
  const distNorm = normalizeAdminName(
    feature.properties.NOMBDIST || feature.properties.name
  )
  const matched = new Set()

  for (const place of places) {
    if (place.level !== 'poi' && place.level !== 'region') continue

    if (place.province_id === provId) {
      const placeNorm = normalizeAdminName(place.name.split('(')[0])
      if (
        distNorm === placeNorm ||
        distNorm.startsWith(placeNorm) ||
        placeNorm.startsWith(distNorm.split(' ')[0])
      ) {
        matched.add(place.slug)
      }
    }

    if (place.lng != null && place.lat != null) {
      if (pointInGeometry([place.lng, place.lat], feature.geometry)) {
        matched.add(place.slug)
      }
    }
  }

  return [...matched]
}

/** Fotos solo en el polígono que corresponde — sin propagar al padre */
export function featurePhotoState(feature, places, entriesGrouped, level) {
  let slugs = []
  if (level === 'department') {
    slugs = slugsForDepartment(feature.properties.NOMBDEP, places)
  } else if (level === 'province') {
    slugs = slugsForProvince(feature, places)
  } else if (level === 'district') {
    slugs = slugsForDistrict(feature, places)
  }

  const photoUrls = []
  for (const slug of slugs) {
    photoUrls.push(...photoUrlsFromEntries(entriesGrouped[slug]))
  }

  const uniqueUrls = [...new Set(photoUrls)]
  return {
    place_slugs: slugs.join(','),
    photo_urls: uniqueUrls.length ? JSON.stringify(uniqueUrls) : '',
    has_photo: uniqueUrls.length > 0,
    visited: uniqueUrls.length > 0,
    status: uniqueUrls.length > 0 ? 'visited' : 'pending',
  }
}

export function isRegionVisited(places, entriesBySlug, regionSlug) {
  if (!regionSlug) return false
  if (entriesBySlug[regionSlug]?.status === 'visited') return true

  return places.some((place) => {
    if (place.level === 'country') return false
    if (entriesBySlug[place.slug]?.status !== 'visited') return false
    return isPlaceUnderRegion(place, regionSlug, places)
  })
}

export function enrichPeruDepartments(rawGeoJSON, places, entriesGrouped) {
  const features = rawGeoJSON.features.map((feature) => {
    const name = feature.properties.NOMBDEP
    const slug = departmentToSlug(name)
    const tracked = Boolean(slug)
    const photoState = featurePhotoState(feature, places, entriesGrouped, 'department')

    return {
      ...feature,
      id: feature.properties.FIRST_IDDP ?? name,
      properties: {
        ...feature.properties,
        name,
        slug: slug ?? '',
        region_id: feature.properties.FIRST_IDDP ?? name,
        tracked,
        ...photoState,
      },
    }
  })

  return { type: 'FeatureCollection', features }
}

/** Provincias heredan visitado/pendiente del departamento padre */
export function enrichPeruProvinces(
  rawGeoJSON,
  places,
  entriesGrouped,
  provinceFilterId = null,
  departmentFilterName = null
) {
  let baseFeatures = rawGeoJSON.features
  if (provinceFilterId) {
    baseFeatures = filterByProvinceId(baseFeatures, provinceFilterId)
  } else if (departmentFilterName) {
    baseFeatures = filterByDepartmentName(baseFeatures, departmentFilterName)
  }

  const features = baseFeatures.map((feature) => {
    const deptName = feature.properties.FIRST_NOMB
    const provName = feature.properties.NOMBPROV
    const deptSlug = departmentToSlug(deptName)
    const tracked = Boolean(deptSlug)
    const photoState = featurePhotoState(feature, places, entriesGrouped, 'province')

    return {
      ...feature,
      id: feature.properties.FIRST_IDPR ?? provName,
      properties: {
        ...feature.properties,
        name: provName,
        department: deptName,
        dept_slug: deptSlug ?? '',
        province_id: feature.properties.FIRST_IDPR,
        tracked,
        ...photoState,
      },
    }
  })

  return { type: 'FeatureCollection', features }
}

let rawDistrictsCache = null
let detailedProvincesCache = null
let amazonasDistrictsCache = null
let chachapoyasDistrictsCache = null

export function getActiveProvincesGeoJSON() {
  return detailedProvincesCache ?? rawPeruProvinces
}

export async function loadDetailedProvinces() {
  if (detailedProvincesCache) return detailedProvincesCache
  const res = await fetch('/data/peru-provinces-detailed.json')
  if (!res.ok) throw new Error('No se pudieron cargar provincias detalladas')
  detailedProvincesCache = await res.json()
  return detailedProvincesCache
}

export async function loadAmazonasDistricts() {
  if (amazonasDistrictsCache) return amazonasDistrictsCache
  const res = await fetch('/data/amazonas-districts.json')
  if (!res.ok) throw new Error('No se pudieron cargar distritos de Amazonas')
  amazonasDistrictsCache = await res.json()
  return amazonasDistrictsCache
}

export async function loadChachapoyasDistricts() {
  if (chachapoyasDistrictsCache) return chachapoyasDistrictsCache
  const res = await fetch('/data/chachapoyas-districts.json')
  if (!res.ok) throw new Error('No se pudieron cargar distritos de Chachapoyas')
  chachapoyasDistrictsCache = await res.json()
  return chachapoyasDistrictsCache
}

export async function loadDistrictGeoJSON(provinceFilterId = null) {
  if (isAmazonasProvinceId(provinceFilterId)) {
    return loadAmazonasDistricts()
  }
  return loadPeruDistricts()
}

export async function loadPeruDistricts() {
  if (rawDistrictsCache) return rawDistrictsCache
  const res = await fetch('/data/peru-districts.json')
  if (!res.ok) throw new Error('No se pudieron cargar distritos')
  rawDistrictsCache = await res.json()
  return rawDistrictsCache
}

export function enrichPeruDistricts(
  rawGeoJSON,
  places,
  entriesGrouped,
  provinceFilterId = null,
  boundsFilter = null
) {
  let baseFeatures = provinceFilterId
    ? filterByProvinceId(rawGeoJSON.features, provinceFilterId)
    : rawGeoJSON.features

  if (!provinceFilterId && boundsFilter) {
    baseFeatures = filterFeaturesByBounds(baseFeatures, boundsFilter)
  }

  const features = baseFeatures.map((feature) => {
    const deptName = feature.properties.NOMBDEP
    const distName = feature.properties.NOMBDIST
    const provName = feature.properties.NOMBPROV
    const deptSlug = departmentToSlug(deptName)
    const tracked = Boolean(deptSlug)
    const photoState = featurePhotoState(feature, places, entriesGrouped, 'district')

    return {
      ...feature,
      id: feature.properties.IDDIST ?? distName,
      properties: {
        ...feature.properties,
        name: distName,
        province: provName,
        department: deptName,
        dept_slug: deptSlug ?? '',
        district_id: feature.properties.IDDIST,
        tracked,
        ...photoState,
      },
    }
  })

  return { type: 'FeatureCollection', features }
}
