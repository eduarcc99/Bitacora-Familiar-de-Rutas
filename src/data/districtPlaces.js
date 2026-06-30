/** Slug estable por distrito INEI (UBIGEO o IDDIST) */
import { departmentToSlug } from './departmentPlaces'

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
  const parentSlug =
    AMAZONAS_PROVINCE_TO_SLUG[provId] ||
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

export function registerDistrictGeoJSON(geojson) {
  districtPlaceBySlug.clear()
  if (!geojson?.features) return []
  const list = []
  for (const feature of geojson.features) {
    const place = districtPlaceFromProperties(feature.properties)
    if (!place) continue
    districtPlaceBySlug.set(place.slug, place)
    list.push(place)
  }
  return list
}

export function getDistrictPlace(slug) {
  return districtPlaceBySlug.get(slug) ?? null
}

export function getAllDistrictPlaces() {
  return [...districtPlaceBySlug.values()]
}
