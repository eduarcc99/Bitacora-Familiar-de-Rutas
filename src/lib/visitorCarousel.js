import { useMemo } from 'react'
import { getDepartmentPlace, slugToDepartmentName } from '../data/departmentPlaces'
import { groupEntriesBySlug } from '../data/regions'
import { resolveCatalogPlace } from '../lib/placeCatalog'
import {
  collectPhotoSlugsForDepartment,
  collectPhotoSlugsForDistrict,
  collectPhotoSlugsForProvince,
} from '../lib/photoHierarchy'

/**
 * Slugs con fotos para el carrusel.
 * Amazonas (distrito / provincia con province_id en places.js) se resuelve
 * igual que antes; el resto de Perú usa el mismo colector con prov-{id}.
 */
export function carouselScopeSlugs(places, entries, slug) {
  if (!slug) return []

  const grouped = groupEntriesBySlug(entries)
  const place = resolveCatalogPlace(places, slug)

  // Distrito (Amazonas y resto): sin cambios
  if (place?.level === 'district' || String(slug).startsWith('dist-')) {
    return collectPhotoSlugsForDistrict(slug, places, grouped)
  }

  // Provincia catálogo resto del Perú (prov-2208, …)
  if (place?.level === 'province' && place.province_id) {
    return collectPhotoSlugsForProvince(place.province_id, places, grouped)
  }

  // Provincia Amazonas (level poi + province_id en places.js): sin cambios
  if (place?.province_id) {
    return collectPhotoSlugsForProvince(place.province_id, places, grouped)
  }

  // Departamento (Amazonas, San Martín, …): mismas fotos del depto
  const dept =
    getDepartmentPlace(slug) ||
    (place?.level === 'region' ? place : null)
  if (dept) {
    const deptName = slugToDepartmentName(dept.slug)
    if (deptName) {
      return collectPhotoSlugsForDepartment(deptName, places, grouped)
    }
  }

  if (!place) {
    return entries.some((e) => e.place_slug === slug && e.photo_path)
      ? [slug]
      : []
  }

  return []
}

export function entriesForCarousel(places, entries, slug) {
  const slugs = new Set(carouselScopeSlugs(places, entries, slug))
  return (entries ?? [])
    .filter((e) => e.photo_path && slugs.has(e.place_slug))
    .sort((a, b) =>
      (b.visit_date || b.created_at || '').localeCompare(
        a.visit_date || a.created_at || '',
      ),
    )
}

export function carouselTitle(places, slug) {
  const place = resolveCatalogPlace(places, slug)
  return place?.name ?? slug
}

export function useCarouselPhotos(places, entries, slug) {
  return useMemo(
    () => entriesForCarousel(places, entries, slug),
    [places, entries, slug],
  )
}
