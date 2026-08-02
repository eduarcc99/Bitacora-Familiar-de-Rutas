import { departmentToSlug } from "../data/departmentPlaces";
import {
  getDistrictFeature,
  getDistrictPlace,
} from "../data/districtPlaces";
import { pointInGeometry } from "../data/regions";

const UBIGEO_DEPT_CODES = {
  "01": "AMAZONAS",
  "02": "ANCASH",
  "03": "APURIMAC",
  "04": "AREQUIPA",
  "05": "AYACUCHO",
  "06": "CAJAMARCA",
  "07": "CALLAO",
  "08": "CUSCO",
  "09": "HUANCAVELICA",
  "10": "HUANUCO",
  "11": "ICA",
  "12": "JUNIN",
  "13": "LA LIBERTAD",
  "14": "LAMBAYEQUE",
  "15": "LIMA",
  "16": "LORETO",
  "17": "MADRE DE DIOS",
  "18": "MOQUEGUA",
  "19": "PASCO",
  "20": "PIURA",
  "21": "PUNO",
  "22": "SAN MARTIN",
  "23": "TACNA",
  "24": "TUMBES",
  "25": "UCAYALI",
};

function hasVisitedPhotos(entriesGrouped, slug) {
  return (entriesGrouped[slug] ?? []).some(
    (e) => e.status === "visited" && e.photo_path,
  );
}

function provinceIdFromDistrictSlug(slug) {
  const match = String(slug).match(/^dist-(\d{4,6})/);
  if (!match) return null;
  return match[1].slice(0, 4);
}

function departmentSlugFromDistrictSlug(slug) {
  const match = String(slug).match(/^dist-(\d{2})/);
  if (!match) return null;
  const deptName = UBIGEO_DEPT_CODES[match[1]];
  return deptName ? departmentToSlug(deptName) : null;
}

function slugUnderDepartment(slug, deptSlug, places) {
  const fromDist = departmentSlugFromDistrictSlug(slug);
  if (fromDist) return fromDist === deptSlug;

  const district = getDistrictPlace(slug);
  if (district) {
    let parentSlug = district.parent_slug;
    while (parentSlug) {
      if (parentSlug === deptSlug) return true;
      const parent = places.find((p) => p.slug === parentSlug);
      parentSlug = parent?.parent_slug ?? null;
    }
  }

  let place = places.find((p) => p.slug === slug);
  while (place) {
    if (place.slug === deptSlug) return true;
    if (!place.parent_slug) break;
    place = places.find((p) => p.slug === place.parent_slug);
  }
  return false;
}

function slugUnderProvince(slug, provinceId, places) {
  const provNorm = String(provinceId).padStart(4, "0");
  const fromDist = provinceIdFromDistrictSlug(slug);
  if (fromDist === provNorm) return true;

  const place = places.find((p) => p.slug === slug);
  return place?.province_id === provNorm;
}

export function collectPhotoSlugsForCountry(places, entriesGrouped) {
  return Object.keys(entriesGrouped).filter((slug) =>
    hasVisitedPhotos(entriesGrouped, slug),
  );
}

export function collectPhotoSlugsForDepartment(
  deptName,
  places,
  entriesGrouped,
) {
  const deptSlug = departmentToSlug(deptName);
  if (!deptSlug) return [];

  return Object.keys(entriesGrouped).filter(
    (slug) =>
      hasVisitedPhotos(entriesGrouped, slug) &&
      slugUnderDepartment(slug, deptSlug, places),
  );
}

export function collectPhotoSlugsForProvince(
  provinceId,
  places,
  entriesGrouped,
) {
  if (!provinceId) return [];
  return Object.keys(entriesGrouped).filter(
    (slug) =>
      hasVisitedPhotos(entriesGrouped, slug) &&
      slugUnderProvince(slug, provinceId, places),
  );
}

function normalizeAdminName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function ubigeoFromDistrictSlug(slug) {
  const match = String(slug).match(/^dist-(\d{4,6})/);
  return match ? match[1] : null;
}

function slugUnderDistrict(slug, districtSlug, places) {
  if (slug === districtSlug) return true;

  const targetUbigeo = ubigeoFromDistrictSlug(districtSlug);
  const slugUbigeo = ubigeoFromDistrictSlug(slug);
  if (targetUbigeo && slugUbigeo && targetUbigeo === slugUbigeo) return true;

  const district = getDistrictPlace(districtSlug);
  const feature = getDistrictFeature(districtSlug);

  let place = places.find((p) => p.slug === slug) || getDistrictPlace(slug);
  const visited = new Set();
  while (place && !visited.has(place.slug)) {
    visited.add(place.slug);
    if (place.slug === districtSlug) return true;
    if (place.parent_slug === districtSlug) return true;
    if (!place.parent_slug) break;
    place =
      places.find((p) => p.slug === place.parent_slug) ||
      getDistrictPlace(place.parent_slug);
  }

  if (!district || !feature) return false;

  const poi = places.find((p) => p.slug === slug);
  if (!poi) return false;

  if (poi.lng != null && poi.lat != null) {
    if (pointInGeometry([poi.lng, poi.lat], feature.geometry)) return true;
  }

  if (poi.province_id === district.province_id) {
    const distNorm = normalizeAdminName(district.name);
    const poiNorm = normalizeAdminName(poi.name.split("(")[0]);
    if (
      distNorm === poiNorm ||
      distNorm.startsWith(poiNorm) ||
      poiNorm.startsWith(distNorm.split(" ")[0])
    ) {
      return true;
    }
  }

  return false;
}

export function collectPhotoSlugsForDistrict(
  districtSlug,
  places,
  entriesGrouped,
) {
  if (!districtSlug) return [];
  return Object.keys(entriesGrouped).filter(
    (slug) =>
      hasVisitedPhotos(entriesGrouped, slug) &&
      slugUnderDistrict(slug, districtSlug, places),
  );
}

export function photoUrlsFromSlugs(slugs, entriesGrouped) {
  const urls = [];
  for (const slug of slugs) {
    for (const entry of entriesGrouped[slug] ?? []) {
      if (entry.status === "visited" && entry.photo_path) {
        urls.push(entry.photo_path);
      }
    }
  }
  return [...new Set(urls)];
}

/** Nivel activo para decidir dónde pintar collage según zoom/filtro visitante */
export function visitorPhotoLevel(filter = {}) {
  if (!filter?.country) return "globe";
  if (!filter?.region) return "country";
  if (!filter?.province) return "region";
  if (!filter?.district) return "province";
  return "district";
}
