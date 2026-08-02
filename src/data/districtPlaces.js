/** Slug estable por distrito INEI (UBIGEO o IDDIST) */
import { departmentToSlug } from './departmentPlaces'
import { getProvinceSlugById } from './provincePlaces'

const AMAZONAS_PROVINCE_TO_SLUG = {
  '0101': 'chachapoyas',
  '0102': 'bagua',
  '0103': 'jumbilla',
  '0104': 'nieva',
  '0105': 'lamud',
  '0106': 'mendoza-amazonas',
  '0107': 'bagua-grande',
}

const districtPlaceBySlug = new Map()
const districtFeatureBySlug = new Map()

function isAmazonasDistrictProps(props = {}) {
  const dep = String(props.NOMBDEP || props.department || '').toUpperCase()
  if (dep === 'AMAZONAS') return true
  const provId = props.IDPROV || props.province_id || props.FIRST_IDPR || ''
  const distId = props.IDDIST || props.UBIGEO || ''
  return String(provId).startsWith('01') || String(distId).startsWith('01')
}

export function getDistrictSlug(props = {}) {
  const ubigeo = props.UBIGEO || props.ubigeo || props.CODIGO
  if (ubigeo) return `dist-${String(ubigeo).replace(/\D/g, '')}`
  const id = props.IDDIST || props.district_id
  if (id) return `dist-${id}`
  return null
}

export function districtPlaceFromProperties(props = {}) {
  const slug = getDistrictSlug(props)
  if (!slug) return null

  const provId = props.IDPROV || props.province_id || props.FIRST_IDPR
  const deptName = props.NOMBDEP || props.department
  // Amazonas: slugs de places.js (sin cambiar). Resto: prov-{IDPROV}.
  const parentSlug =
    AMAZONAS_PROVINCE_TO_SLUG[provId] ||
    getProvinceSlugById(provId) ||
    departmentToSlug(deptName) ||
    'amazonas'

  return {
    slug,
    name: props.NOMBDIST || props.name || slug,
    parent_slug: parentSlug,
    level: 'district',
    province_id: provId ?? null,
    sort_order: 0,
  }
}

/** Reemplaza el catálogo (usado por Amazonas / init actual). */
export function registerDistrictGeoJSON(geojson) {
  districtPlaceBySlug.clear()
  districtFeatureBySlug.clear()
  if (!geojson?.features) return []
  const list = []
  for (const feature of geojson.features) {
    const place = districtPlaceFromProperties(feature.properties)
    if (!place) continue
    districtPlaceBySlug.set(place.slug, place)
    districtFeatureBySlug.set(place.slug, feature)
    list.push(place)
  }
  return list
}

/**
 * Añade distritos sin borrar los ya cargados (p. ej. Amazonas).
 * Por defecto omite Amazonas para no pisar el GeoJSON detallado.
 */
export function mergeDistrictGeoJSON(geojson, { skipAmazonas = true } = {}) {
  if (!geojson?.features) return []
  const list = []
  for (const feature of geojson.features) {
    const props = feature.properties || {}
    if (skipAmazonas && isAmazonasDistrictProps(props)) continue
    const place = districtPlaceFromProperties(props)
    if (!place) continue
    if (districtPlaceBySlug.has(place.slug)) continue
    districtPlaceBySlug.set(place.slug, place)
    districtFeatureBySlug.set(place.slug, feature)
    list.push(place)
  }
  return list
}

export function getDistrictPlace(slug) {
  return districtPlaceBySlug.get(slug) ?? null
}

export function getDistrictFeature(slug) {
  return districtFeatureBySlug.get(slug) ?? null
}

export function getAllDistrictPlaces() {
  return [...districtPlaceBySlug.values()]
}
