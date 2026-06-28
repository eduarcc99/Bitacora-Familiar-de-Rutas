/**
 * Lugares demo de Perú con coordenadas aproximadas.
 * Se sincronizan con la tabla `places` de Supabase cuando hay conexión.
 */
export const DEFAULT_PLACES = [
  {
    slug: "peru",
    name: "Perú",
    parent_slug: null,
    level: "country",
    sort_order: 1,
    lng: -75.0152,
    lat: -9.19,
    zoom: 6,
  },
  {
    slug: "cusco",
    name: "Cusco",
    parent_slug: "peru",
    level: "region",
    sort_order: 1,
    lng: -71.9675,
    lat: -13.5319,
    zoom: 6.5,
  },
  {
    slug: "machu-picchu",
    name: "Machu Picchu",
    parent_slug: "cusco",
    level: "poi",
    sort_order: 1,
    lng: -72.545,
    lat: -13.1631,
    zoom: 12,
  },
  {
    slug: "arequipa",
    name: "Arequipa",
    parent_slug: "peru",
    level: "region",
    sort_order: 2,
    lng: -71.5375,
    lat: -16.409,
    zoom: 6.5,
  },
  {
    slug: "colca",
    name: "Cañón del Colca",
    parent_slug: "arequipa",
    level: "poi",
    sort_order: 1,
    lng: -71.9333,
    lat: -15.5833,
    zoom: 10,
  },
  {
    slug: "lima",
    name: "Lima",
    parent_slug: "peru",
    level: "region",
    sort_order: 3,
    lng: -77.0428,
    lat: -12.0464,
    zoom: 8,
  },
  {
    slug: "lima-centro",
    name: "Centro Histórico",
    parent_slug: "lima",
    level: "poi",
    sort_order: 1,
    lng: -77.0302,
    lat: -12.0464,
    zoom: 13,
  },
  {
    slug: "puno",
    name: "Puno",
    parent_slug: "peru",
    level: "region",
    sort_order: 4,
    lng: -70.0199,
    lat: -15.8402,
    zoom: 6.5,
  },
  {
    slug: "titicaca",
    name: "Lago Titicaca",
    parent_slug: "puno",
    level: "poi",
    sort_order: 1,
    lng: -69.7933,
    lat: -15.9254,
    zoom: 10,
  },
  {
    slug: "amazonas",
    name: "Amazonas",
    parent_slug: "peru",
    level: "region",
    sort_order: 5,
    lng: -77.8711,
    lat: -6.2317,
    zoom: 7,
  },
  {
    slug: "chachapoyas",
    name: "Chachapoyas",
    parent_slug: "amazonas",
    level: "poi",
    sort_order: 1,
    province_id: "0101",
    lng: -77.8515,
    lat: -6.2491,
    zoom: 11,
  },
  {
    slug: "bagua",
    name: "Bagua",
    parent_slug: "amazonas",
    level: "poi",
    sort_order: 2,
    province_id: "0102",
    lng: -78.5173,
    lat: -5.5876,
    zoom: 11,
  },
  {
    slug: "jumbilla",
    name: "Jumbilla (Bongará)",
    parent_slug: "amazonas",
    level: "poi",
    sort_order: 3,
    province_id: "0103",
    lng: -77.8235,
    lat: -5.9717,
    zoom: 11,
  },
  {
    slug: "nieva",
    name: "Santa María de Nieva",
    parent_slug: "amazonas",
    level: "poi",
    sort_order: 4,
    province_id: "0104",
    lng: -77.9418,
    lat: -4.8669,
    zoom: 11,
  },
  {
    slug: "lamud",
    name: "Lámud (Luya)",
    parent_slug: "amazonas",
    level: "poi",
    sort_order: 5,
    province_id: "0105",
    lng: -77.9424,
    lat: -6.1193,
    zoom: 11,
  },
  {
    slug: "mendoza-amazonas",
    name: "Mendoza (Rodríguez de Mendoza)",
    parent_slug: "amazonas",
    level: "poi",
    sort_order: 6,
    province_id: "0106",
    lng: -77.4405,
    lat: -6.3653,
    zoom: 11,
  },
  {
    slug: "bagua-grande",
    name: "Bagua Grande (Utcubamba)",
    parent_slug: "amazonas",
    level: "poi",
    sort_order: 7,
    province_id: "0107",
    lng: -78.4477,
    lat: -5.8196,
    zoom: 11,
  },
  {
    slug: "kuelap",
    name: "Kuélap",
    parent_slug: "chachapoyas",
    level: "poi",
    sort_order: 1,
    lng: -77.923,
    lat: -6.417,
    zoom: 13,
  },
  {
    slug: "gocta",
    name: "Catarata de Gocta",
    parent_slug: "amazonas",
    level: "poi",
    sort_order: 2,
    lng: -77.8872,
    lat: -6.0172,
    zoom: 11,
  },
];

export const LEVEL_RADIUS_KM = {
  country: 280,
  region: 55,
  poi: 8,
};

export const LEVEL_COLOR = {
  country: "#c9a227",
  region: "#4a90d9",
  poi: "#6bcb77",
};

export function buildPlacesGeoJSON(places, entriesBySlug) {
  const features = places
    .filter((p) => p.level !== "country")
    .map((place) => {
      const entry = entriesBySlug[place.slug];
      const visited = entry?.status === "visited";
      return {
        type: "Feature",
        properties: {
          slug: place.slug,
          name: place.name,
          level: place.level,
          parent_slug: place.parent_slug,
          visited,
          status: visited ? "visited" : "pending",
        },
        geometry: {
          type: "Point",
          coordinates: [place.lng, place.lat],
        },
      };
    });

  return { type: "FeatureCollection", features };
}

export function getChildren(places, parentSlug) {
  return places
    .filter((p) => p.parent_slug === parentSlug)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function getPlaceBySlug(places, slug) {
  return places.find((p) => p.slug === slug);
}

export function getBreadcrumb(places, slug) {
  const trail = [];
  let current = getPlaceBySlug(places, slug);
  while (current) {
    trail.unshift(current);
    current = current.parent_slug
      ? getPlaceBySlug(places, current.parent_slug)
      : null;
  }
  return trail;
}
