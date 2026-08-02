/**
 * Provincias INEI fuera de Amazonas (catálogo para editor / filtros).
 * Amazonas sigue usando los slugs de places.js (chachapoyas, bagua, …).
 */
import rawPeruProvinces from './peru-provinces.json'
import { departmentToSlug } from './departmentPlaces'

const provincePlaceBySlug = new Map()
const provinceSlugById = new Map()

function formatProvinceName(nombprov) {
  const lower = String(nombprov || '').toLowerCase()
  const small = new Set(['de', 'del', 'la', 'las', 'y', 'el', 'los'])
  return lower
    .split(/\s+/)
    .map((word, i) =>
      i > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
}

function isAmazonasProvinceId(id) {
  return String(id || '').startsWith('01')
}

function provinceFromProperties(props = {}) {
  const id = props.FIRST_IDPR || props.IDPROV
  if (!id || isAmazonasProvinceId(id)) return null

  const deptName = props.FIRST_NOMB || props.NOMBDEP
  const parentSlug = departmentToSlug(deptName)
  if (!parentSlug) return null

  const slug = `prov-${id}`
  return {
    slug,
    name: formatProvinceName(props.NOMBPROV || props.name || id),
    parent_slug: parentSlug,
    level: 'province',
    province_id: String(id),
    sort_order: parseInt(String(id), 10) || 0,
  }
}

function registerProvinces() {
  provincePlaceBySlug.clear()
  provinceSlugById.clear()
  for (const feature of rawPeruProvinces.features ?? []) {
    const place = provinceFromProperties(feature.properties)
    if (!place) continue
    provincePlaceBySlug.set(place.slug, place)
    provinceSlugById.set(place.province_id, place.slug)
  }
}

function ensureRegistered() {
  if (!provincePlaceBySlug.size) registerProvinces()
}

export function getProvincePlace(slug) {
  ensureRegistered()
  return provincePlaceBySlug.get(slug) ?? null
}

export function getProvinceSlugById(provinceId) {
  if (!provinceId) return null
  ensureRegistered()
  return provinceSlugById.get(String(provinceId)) ?? null
}

export function getProvincesForDepartment(departmentSlug) {
  if (!departmentSlug || departmentSlug === 'amazonas') return []
  ensureRegistered()
  return [...provincePlaceBySlug.values()]
    .filter((p) => p.parent_slug === departmentSlug)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function getAllProvincePlaces() {
  ensureRegistered()
  return [...provincePlaceBySlug.values()]
}

registerProvinces()
