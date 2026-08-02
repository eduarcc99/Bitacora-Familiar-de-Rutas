import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  enrichPeruDepartments,
  enrichPeruDistricts,
  enrichPeruProvinces,
  findDepartmentAtPoint,
  findProvinceAtPoint,
  geoJSONToLabelPoints,
  getActiveProvincesGeoJSON,
  getRawPeruDepartments,
  groupEntriesBySlug,
  isAmazonasProvinceId,
  loadDetailedProvinces,
  loadDistrictGeoJSON,
  buildCountryShellPhotoState,
} from "../data/regions";
import worldCountries from "../data/world-countries.json";
import { syncGeoJSONPhotoPatterns } from "../lib/mapPhotoPatterns";
import { visitorPhotoLevel } from "../lib/photoHierarchy";
import {
  getDistrictSlug,
  registerDistrictGeoJSON,
} from "../data/districtPlaces";
import { departmentToSlug } from "../data/departmentPlaces";
import { EMPTY_FILTER, filterFromSlug } from "../lib/placeCatalog";
import {
  expandBoundsForMax,
  filterFromProvinceFeature,
  filterKey,
  filterToAdminRefs,
  fitMapToScopedBounds,
  getBoundsForFilter,
  getDistrictBoundsBySlug,
  getMapFitPadding,
  GLOBE_VIEW,
  isValidBounds,
  normalizeBounds,
  SCOPED_MAX_ZOOM,
  SCOPED_MIN_ZOOM,
} from "../lib/mapNavigation";
import {
  CHACHAPOYAS_CENTER,
  CHACHAPOYAS_PROVINCE_ID,
  CHACHAPOYAS_ZOOM,
  clampFilterToChachapoyas,
  isChachapoyasScope,
  isVisitorV2Scope,
} from "../lib/mapScope";
import { getPeruCountryFeatureCollection } from "../lib/peruCountryShell";

function buildMapStyle(transparentBackground = false) {
  return {
    version: 8,
    glyphs:
      "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": transparentBackground
            ? "rgba(0,0,0,0)"
            : "#060810",
        },
      },
    ],
  };
}

const GLOBE_ZOOM = GLOBE_VIEW.zoom;
const GLOBE_CENTER = GLOBE_VIEW.center;

const PERU_COUNTRY_FILTER = {
  ...EMPTY_FILTER,
  country: "peru",
};

function isPeruWorldFeature(feature) {
  if (!feature?.properties) return false;
  const admin = feature.properties.ADMIN || feature.properties.NAME;
  const iso = feature.properties.ISO_A3 || feature.properties.ADM0_A3;
  return admin === "Peru" || iso === "PER";
}

const DISTRICT_MIN_ZOOM = 10;
/** Chachapoyas: distritos visibles antes (solo esa provincia) */
const PROVINCE_FOCUS_MIN_ZOOM = 7.5;
const AMAZONAS_PROVINCE_AUTO_ZOOM = 7.5;
const PROVINCE_FOCUS_MAX_ZOOM = 13;
/** Por debajo de este zoom ÔåÆ globo; por encima ÔåÆ plano (fronteras precisas) */
const GLOBE_MAX_ZOOM = 3.9;

const districtFillColor = [
  "case",
  ["==", ["get", "visited"], true],
  "#1a6b3c",
  ["==", ["get", "tracked"], true],
  "#3a3a3a",
  "#2a3038",
];

const districtBorderPaint = {
  default: {
    "line-color": "rgba(255, 230, 160, 0.95)",
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      1.2,
      13,
      1.6,
      16,
      2,
    ],
  },
  focus: {
    "line-color": "#ffffff",
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      7.5,
      1.6,
      10,
      2,
      13,
      2.4,
    ],
  },
};

const provinceBorderPaint = {
  "line-color": "#ffffff",
  "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.8, 9, 2.2, 10, 2.6],
  "line-opacity": 1,
};

/** Líneas finas blancas — vista país visitante (igual que provincias en Amazonas) */
const visitorThinWhiteBorderPaint = {
  "line-color": "#ffffff",
  "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 6, 1.5, 8, 1.8],
  "line-opacity": 1,
};

/** Opacidad tipo marca de agua: aparece y desaparece seg├║n zoom */
function watermarkOpacity(inStart, inEnd, outStart, outEnd, peak = 0.92) {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    inStart,
    0,
    inEnd,
    peak,
    outStart,
    peak,
    outEnd,
    0,
  ];
}

const labelLayoutBase = {
  "text-font": ["Noto Sans Regular"],
  "text-allow-overlap": true,
  "text-ignore-placement": true,
  "text-anchor": "center",
  "text-max-width": 12,
};

const watermarkLabels = {
  dept: {
    opacity: watermarkOpacity(4.2, 4.8, 6.3, 6.95),
    size: ["interpolate", ["linear"], ["zoom"], 4.8, 11, 6.5, 14],
    color: "#eef2ff",
    halo: "#060810",
  },
  prov: {
    opacity: watermarkOpacity(6.9, 7.5, 9.2, 9.95),
    size: ["interpolate", ["linear"], ["zoom"], 7.2, 10, 9.5, 13],
    color: "#ffffff",
    halo: "#060810",
  },
  dist: {
    opacity: watermarkOpacity(9.8, 10.5, 14.5, 16.5),
    size: ["interpolate", ["linear"], ["zoom"], 10, 9, 13, 12],
    color: "#ffe8b0",
    halo: "#060810",
  },
  distFocus: {
    opacity: watermarkOpacity(7.3, 7.8, 12.2, 13),
    size: ["interpolate", ["linear"], ["zoom"], 7.5, 10, 11, 12],
    color: "#ffffff",
    halo: "#060810",
  },
  place: {
    opacity: watermarkOpacity(7.5, 8.2, 12.5, 13.5),
    size: ["interpolate", ["linear"], ["zoom"], 8, 11, 11, 13],
    color: "#ffffff",
    halo: "#060810",
  },
};

function applyWatermarkToLayer(map, layerId, style) {
  if (!map.getLayer(layerId)) return;
  map.setPaintProperty(layerId, "text-opacity", style.opacity);
  map.setPaintProperty(layerId, "text-color", style.color);
  map.setPaintProperty(layerId, "text-halo-color", style.halo);
  map.setPaintProperty(layerId, "text-halo-width", 1.4);
  map.setLayoutProperty(layerId, "text-size", style.size);
}

function addLabelLayer(map, layerId, sourceId, style, beforeId) {
  if (map.getLayer(layerId)) return;

  map.addLayer(
    {
      id: layerId,
      type: "symbol",
      source: sourceId,
      layout: {
        ...labelLayoutBase,
        "text-field": ["get", "name"],
        "text-size": style.size,
        "text-transform": "uppercase",
      },
      paint: {
        "text-color": style.color,
        "text-halo-color": style.halo,
        "text-halo-width": 1.4,
        "text-opacity": style.opacity,
      },
    },
    beforeId,
  );
}

function syncLabelSource(map, sourceId, polygonGeoJSON) {
  if (!map.getSource(sourceId)) return;
  map.getSource(sourceId).setData(geoJSONToLabelPoints(polygonGeoJSON));
}

function fillWithHover(baseCase, hoverColor = "#6b8299") {
  return [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    hoverColor,
    ...(Array.isArray(baseCase) && baseCase[0] === "case"
      ? baseCase.slice(1)
      : [baseCase]),
  ];
}

const districtFocusFillColor = [
  "interpolate",
  ["linear"],
  ["%", ["id"], 7],
  0,
  "#2a3038",
  1,
  "#2e343e",
  2,
  "#323840",
  3,
  "#363c46",
  4,
  "#3a404a",
  5,
  "#343a44",
  6,
  "#383e48",
];

const districtFillPaint = {
  default: {
    "fill-color": fillWithHover(districtFillColor, "#4a5568"),
    "fill-opacity": 0.75,
  },
  focus: {
    "fill-color": fillWithHover(districtFocusFillColor, "#5a6878"),
    "fill-opacity": 0.88,
  },
};

/** Solo un nivel admin visible a la vez ÔÇö evita l├¡neas superpuestas */
const ZOOM_BAND = {
  deptMin: 4,
  deptMax: 7.5,
  provMin: 7.5,
  provMax: 10,
  distMin: 10,
};

const regionFillColor = [
  "case",
  ["==", ["get", "visited"], true],
  "#2ecc71",
  ["==", ["get", "tracked"], true],
  "#4a5058",
  "#2e3440",
];

const provinceFillColor = [
  "case",
  ["==", ["get", "visited"], true],
  "#24854a",
  ["==", ["get", "tracked"], true],
  "#40454e",
  "#2a3038",
];

function addPeruProvinceLayers(
  map,
  places,
  entriesGrouped,
  onProvinceClick,
  provinceFilterId = null,
  departmentFilterName = null,
) {
  const provincesGeoJSON = enrichPeruProvinces(
    getActiveProvincesGeoJSON(),
    places,
    entriesGrouped,
    provinceFilterId,
    departmentFilterName,
  );

  if (!map.getSource("peru-provinces")) {
    map.addSource("peru-provinces", {
      type: "geojson",
      data: provincesGeoJSON,
      generateId: true,
    });

    map.addLayer({
      id: "peru-provinces-fill",
      type: "fill",
      source: "peru-provinces",
      paint: {
        "fill-color": fillWithHover(provinceFillColor, "#5c6a7e"),
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.88,
          0.72,
        ],
      },
    });

    map.addLayer({
      id: "peru-provinces-border",
      type: "line",
      source: "peru-provinces",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: provinceBorderPaint,
    });

    map.addSource("peru-provinces-label-pts", {
      type: "geojson",
      data: geoJSONToLabelPoints(provincesGeoJSON),
    });
    addLabelLayer(
      map,
      "peru-provinces-labels",
      "peru-provinces-label-pts",
      watermarkLabels.prov,
    );

    wireHoverHighlight(map, "peru-provinces", "peru-provinces-fill");
    map.on("click", "peru-provinces-fill", onProvinceClick);
  } else {
    map.getSource("peru-provinces").setData(provincesGeoJSON);
    syncLabelSource(map, "peru-provinces-label-pts", provincesGeoJSON);
  }
}

function addPeruDistrictLayers(
  map,
  places,
  entriesGrouped,
  onDistrictClick,
  rawDistricts,
  provinceFilterId = null,
) {
  const districtsGeoJSON = enrichPeruDistricts(
    rawDistricts,
    places,
    entriesGrouped,
    provinceFilterId,
  );
  const beforePlaces = map.getLayer("places-glow") ? "places-glow" : undefined;

  if (!map.getSource("peru-districts")) {
    map.addSource("peru-districts", {
      type: "geojson",
      data: districtsGeoJSON,
      generateId: true,
    });

    map.addLayer(
      {
        id: "peru-districts-fill",
        type: "fill",
        source: "peru-districts",
        paint: {
          "fill-color": districtFillPaint.default["fill-color"],
          "fill-opacity": 0.75,
        },
      },
      beforePlaces,
    );

    map.addLayer(
      {
        id: "peru-districts-border",
        type: "line",
        source: "peru-districts",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "rgba(255, 230, 160, 0.95)",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            1.2,
            13,
            1.6,
            16,
            2,
          ],
          "line-opacity": 1,
        },
      },
      beforePlaces,
    );

    map.addSource("peru-districts-label-pts", {
      type: "geojson",
      data: geoJSONToLabelPoints(districtsGeoJSON),
    });
    addLabelLayer(
      map,
      "peru-districts-labels",
      "peru-districts-label-pts",
      watermarkLabels.dist,
      beforePlaces,
    );

    wireHoverHighlight(map, "peru-districts", "peru-districts-fill");
    map.on("click", "peru-districts-fill", onDistrictClick);
  } else {
    map.getSource("peru-districts").setData(districtsGeoJSON);
    syncLabelSource(map, "peru-districts-label-pts", districtsGeoJSON);
  }
}

function setLayerVisibility(map, layerIds, visible) {
  const value = visible ? "visible" : "none";
  layerIds.forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
  });
}

function applyGlobeAtmosphere(map, options = {}) {
  if (typeof map.setFog !== "function") return;
  // Visitante 2.0: espacio transparente para ver el starfield CSS detrás
  const revealBackdropStars = Boolean(options.revealBackdropStars);
  map.setFog({
    color: revealBackdropStars ? "rgba(8, 12, 28, 0.2)" : "#060810",
    "high-color": revealBackdropStars ? "rgba(50, 70, 130, 0.45)" : "#141a30",
    "horizon-blend": revealBackdropStars ? 0.045 : 0.07,
    "space-color": revealBackdropStars ? "rgba(0, 0, 0, 0)" : "#000005",
    "star-intensity": revealBackdropStars ? 0.2 : 0.72,
  });
}

function clearGlobeAtmosphere(map) {
  if (typeof map.setFog !== "function") return;
  map.setFog(null);
}

/** Globo alejado ┬À plano Mercator al acercar (fronteras legibles) */
function syncProjection(map, provinceFilterId, options = {}) {
  if (!map?.isStyleLoaded()) return;

  const { visitorCountryFocus = false } = options;
  const useGlobe =
    map.getZoom() <= GLOBE_MAX_ZOOM &&
    !provinceFilterId &&
    !visitorCountryFocus;

  const current = map.getProjection()?.type;
  const next = useGlobe ? "globe" : "mercator";
  if (current === next) return;

  map.setProjection({ type: next });
  if (useGlobe) {
    applyGlobeAtmosphere(map, {
      revealBackdropStars: Boolean(options.revealBackdropStars),
    });
    map.setPitch(0);
  } else {
    clearGlobeAtmosphere(map);
    map.setPitch(0);
  }
}

function getDistrictBoundsFilter(map, provinceFilterId) {
  if (provinceFilterId) return null;
  const zoom = map.getZoom();
  if (zoom < DISTRICT_MIN_ZOOM) return null;
  const bounds = map.getBounds();
  return [
    [bounds.getWest(), bounds.getSouth()],
    [bounds.getEast(), bounds.getNorth()],
  ];
}

const PERU_COUNTRY_SHELL_LAYERS = [
  "peru-country-fill",
  "peru-country-border-outer",
  "peru-country-border-inner",
];

const COUNTRY_DEPT_BORDER_LAYERS = [
  "peru-regions-dept-glow",
  "peru-regions-dept-line",
];

function addPeruCountryShellLayers(map, onCountryClick) {
  if (map.getSource("peru-country-shell")) return;

  const before = map.getLayer("peru-regions-fill")
    ? "peru-regions-fill"
    : undefined;

  map.addSource("peru-country-shell", {
    type: "geojson",
    data: getPeruCountryFeatureCollection(),
    generateId: true,
  });

  map.addLayer(
    {
      id: "peru-country-fill",
      type: "fill",
      source: "peru-country-shell",
      layout: { visibility: "none" },
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "focused"], false],
          "rgba(72, 130, 200, 0.32)",
          "rgba(72, 130, 200, 0.1)",
        ],
        "fill-opacity": 1,
      },
    },
    before,
  );

  map.addLayer(
    {
      id: "peru-country-border-outer",
      type: "line",
      source: "peru-country-shell",
      layout: {
        visibility: "none",
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": visitorThinWhiteBorderPaint["line-color"],
        "line-width": visitorThinWhiteBorderPaint["line-width"],
        "line-opacity": visitorThinWhiteBorderPaint["line-opacity"],
      },
    },
    before,
  );

  map.addLayer(
    {
      id: "peru-country-border-inner",
      type: "line",
      source: "peru-country-shell",
      layout: {
        visibility: "none",
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": visitorThinWhiteBorderPaint["line-color"],
        "line-width": visitorThinWhiteBorderPaint["line-width"],
        "line-opacity": visitorThinWhiteBorderPaint["line-opacity"],
      },
    },
    before,
  );

  wireHoverHighlight(map, "peru-country-shell", "peru-country-fill");
  if (onCountryClick) {
    map.on("click", "peru-country-fill", onCountryClick);
  }
}

function clearAdminFeatureSelection(map, selectionRef) {
  selectionRef.current.forEach(({ source, id }) => {
    map.setFeatureState({ source, id }, { selected: false });
  });
  selectionRef.current = [];
}

function selectAdminFeatureBySlug(map, sourceId, slug, selectionRef) {
  if (!slug || !map.getSource(sourceId)) return;
  const matches = map.querySourceFeatures(sourceId, {
    filter: ["==", ["get", "slug"], slug],
  });
  matches.forEach((feature) => {
    if (feature.id == null) return;
    map.setFeatureState(
      { source: sourceId, id: feature.id },
      { selected: true },
    );
    selectionRef.current.push({ source: sourceId, id: feature.id });
  });
}

function setPeruCountryShellFocused(map, focused) {
  if (!map.getSource("peru-country-shell")) return;
  map.querySourceFeatures("peru-country-shell").forEach((feature) => {
    if (feature.id == null) return;
    map.setFeatureState(
      { source: "peru-country-shell", id: feature.id },
      { focused },
    );
  });
}

function isVisitorCountryFocus(options = {}) {
  return Boolean(
    options.visitorV2 &&
      options.filter?.country &&
      !options.filter?.region,
  );
}

function ensureRegionScopeBordersOnTop(map) {
  const beforeProvinces = map.getLayer("peru-provinces-fill")
    ? "peru-provinces-fill"
    : undefined;

  ["peru-regions-border-outer", "peru-regions-border"].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId, beforeProvinces);
    }
  });
}

function ensureRegionLayersOnTop(map) {
  const beforeLabels = map.getLayer("peru-regions-labels")
    ? "peru-regions-labels"
    : undefined;

  [
    "peru-regions-dept-glow",
    "peru-regions-dept-line",
    "peru-regions-border-outer",
    "peru-regions-border",
  ].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId, beforeLabels);
    }
  });
}

function addCountryDepartmentOutlineLayers(map) {
  if (map.getLayer("peru-regions-dept-line")) return;

  const before = map.getLayer("peru-regions-labels")
    ? "peru-regions-labels"
    : undefined;

  map.addLayer(
    {
      id: "peru-regions-dept-glow",
      type: "line",
      source: "peru-regions",
      layout: {
        visibility: "none",
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "rgba(255, 200, 120, 0.5)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 4.2, 6, 5.5, 8, 6],
        "line-blur": 0.35,
      },
    },
    before,
  );

  map.addLayer(
    {
      id: "peru-regions-dept-line",
      type: "line",
      source: "peru-regions",
      layout: {
        visibility: "none",
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": visitorThinWhiteBorderPaint["line-color"],
        "line-width": visitorThinWhiteBorderPaint["line-width"],
        "line-opacity": visitorThinWhiteBorderPaint["line-opacity"],
      },
    },
    before,
  );
}

function applyVisitorCountryFillStyle(map) {
  if (!map.getLayer("peru-regions-fill")) return;

  map.setPaintProperty("peru-regions-fill", "fill-color", [
    "case",
    ["==", ["get", "has_photo"], true],
    "#ffffff",
    "rgba(255, 255, 255, 0.02)",
  ]);
  map.setPaintProperty("peru-regions-fill", "fill-opacity", [
    "case",
    ["==", ["get", "has_photo"], true],
    1,
    0.12,
  ]);

  if (map.getLayer("peru-country-fill") && map.getLayer("peru-regions-fill")) {
    map.moveLayer("peru-country-fill", "peru-regions-fill");
  }
  if (map.getLayer("peru-regions-fill") && map.getLayer("peru-regions-dept-line")) {
    map.moveLayer("peru-regions-fill", "peru-regions-dept-line");
  }
}

function applyVisitorCountryLineStyle(map) {
  applyVisitorThinWhiteLine(map, "peru-country-border-inner");
  applyVisitorThinWhiteLine(map, "peru-regions-dept-line");
  setLayerVisibility(map, ["peru-country-border-outer"], false);
  setLayerVisibility(map, ["peru-regions-dept-glow"], false);
  setLayerVisibility(
    map,
    ["peru-regions-border", "peru-regions-border-outer"],
    false,
  );
  setLayerVisibility(map, ["peru-regions-dept-line", "peru-country-border-inner"], true);
}

function applyVisitorThinWhiteLine(map, layerId) {
  if (!map.getLayer(layerId)) return;
  map.setPaintProperty(
    layerId,
    "line-color",
    visitorThinWhiteBorderPaint["line-color"],
  );
  map.setPaintProperty(
    layerId,
    "line-width",
    visitorThinWhiteBorderPaint["line-width"],
  );
  map.setPaintProperty(
    layerId,
    "line-opacity",
    visitorThinWhiteBorderPaint["line-opacity"],
  );
  if (map.getPaintProperty(layerId, "line-blur") != null) {
    map.setPaintProperty(layerId, "line-blur", 0);
  }
}

function setCountryDepartmentOutlinesVisible(map, visible) {
  setLayerVisibility(map, COUNTRY_DEPT_BORDER_LAYERS, visible);
}

function clearPeruRegionsScopeFilter(map) {
  if (map.getLayer("peru-regions-border")) {
    map.setFilter("peru-regions-border", null);
  }
  if (map.getLayer("peru-regions-border-outer")) {
    map.setFilter("peru-regions-border-outer", [
      "boolean",
      ["feature-state", "selected"],
      false,
    ]);
  }
}

function applyPeruRegionsScopeFilter(map, regionSlug) {
  if (!regionSlug) {
    clearPeruRegionsScopeFilter(map);
    return;
  }
  const slugFilter = ["==", ["get", "slug"], regionSlug];
  if (map.getLayer("peru-regions-border")) {
    map.setFilter("peru-regions-border", slugFilter);
  }
  if (map.getLayer("peru-regions-border-outer")) {
    map.setFilter("peru-regions-border-outer", slugFilter);
  }
}

function hideCountryOnlyRegionLayers(map) {
  setCountryDepartmentOutlinesVisible(map, false);
  setLayerVisibility(
    map,
    ["peru-regions-dept-glow", "peru-regions-dept-line"],
    false,
  );
}

function ensureDistrictLayersOnTop(map) {
  [
    "peru-districts-fill",
    "peru-districts-border",
    "peru-districts-labels",
  ].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  });
}

function applyVisitorV2RegionEmphasis(map, emphasized, options = {}) {
  if (!map.getLayer("peru-regions-border")) return;

  if (emphasized) {
    setCountryDepartmentOutlinesVisible(map, true);
    applyVisitorCountryLineStyle(map);
    applyVisitorCountryFillStyle(map);
  } else if (options.filter?.region && !options.filter?.province) {
    setCountryDepartmentOutlinesVisible(map, false);
    map.setPaintProperty("peru-regions-border", "line-color", "#fff8e8");
    map.setPaintProperty(
      "peru-regions-border",
      "line-width",
      ["interpolate", ["linear"], ["zoom"], 5, 2.4, 8, 3.2],
    );
    map.setPaintProperty("peru-regions-border", "line-opacity", 1);
  } else {
    setCountryDepartmentOutlinesVisible(map, false);
    map.setPaintProperty("peru-regions-border", "line-color", [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      "#fff8e8",
      "#ffffff",
    ]);
    map.setPaintProperty("peru-regions-border", "line-width", [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      ["interpolate", ["linear"], ["zoom"], 4, 2.2, 8, 3],
      ["interpolate", ["linear"], ["zoom"], 4, 1.6, 6.5, 2.2],
    ]);
    map.setPaintProperty("peru-regions-border", "line-opacity", 1);
    if (map.getLayer("peru-regions-fill")) {
      map.setPaintProperty("peru-regions-fill", "fill-opacity", [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        0.9,
        ["boolean", ["feature-state", "hover"], false],
        0.92,
        0.78,
      ]);
    }
  }
}

function isVisitorRegionFocus(options = {}) {
  return Boolean(
    options.visitorV2 &&
      options.filter?.region &&
      !options.filter?.province,
  );
}

function syncVisitorV2Presentation(map, provinceFilterId, options = {}) {
  syncAdminLevelVisibility(map, provinceFilterId, options);
  if (!options.visitorV2) return;

  if (isVisitorCountryFocus(options)) {
    ensureRegionLayersOnTop(map);
    applyVisitorV2RegionEmphasis(map, true, options);
    return;
  }

  if (isVisitorRegionFocus(options)) {
    ensureRegionScopeBordersOnTop(map);
    applyVisitorV2RegionEmphasis(map, false, options);
    if (map.getLayer("peru-regions-border-outer")) {
      map.setPaintProperty(
        "peru-regions-border-outer",
        "line-width",
        ["interpolate", ["linear"], ["zoom"], 5, 3.2, 8, 4.5],
      );
    }
    return;
  }

  applyVisitorV2RegionEmphasis(map, false, options);
}

function applyVisitorV2Selection(map, filter, selectionRef) {
  clearAdminFeatureSelection(map, selectionRef);
  setPeruCountryShellFocused(map, false);
  if (!filter?.country) return;

  if (!filter.region) {
    setPeruCountryShellFocused(map, true);
    return;
  }

  if (filter.region && !filter.province) {
    selectAdminFeatureBySlug(
      map,
      "peru-regions",
      filter.region,
      selectionRef,
    );
    return;
  }

  if (filter.province && !filter.district) {
    selectAdminFeatureBySlug(
      map,
      "peru-provinces",
      filter.province,
      selectionRef,
    );
  }
}

/** Un solo nivel admin visible — evita líneas superpuestas al hacer zoom */
function syncAdminLevelVisibility(map, provinceFilterId, options = {}) {
  const {
    pinned = false,
    hideWorld = false,
    visitorV2 = false,
    filter = null,
  } = options;
  const focus = Boolean(provinceFilterId);
  const zoom = map.getZoom();

  if (visitorV2 && filter?.country && !filter?.region) {
    clearPeruRegionsScopeFilter(map);
    setLayerVisibility(map, ["peru-country-border-inner"], true);
    setLayerVisibility(
      map,
      ["peru-country-fill", "peru-country-border-outer"],
      false,
    );
    setLayerVisibility(
      map,
      [
        "peru-regions-fill",
        "peru-regions-dept-line",
        "peru-regions-labels",
      ],
      true,
    );
    setLayerVisibility(
      map,
      [
        "peru-regions-border",
        "peru-regions-border-outer",
        "peru-regions-dept-glow",
        "peru-country-border-outer",
      ],
      false,
    );
    setLayerVisibility(
      map,
      [
        "peru-provinces-fill",
        "peru-provinces-border",
        "peru-provinces-labels",
      ],
      false,
    );
    setLayerVisibility(
      map,
      ["peru-districts-fill", "peru-districts-border", "peru-districts-labels"],
      false,
    );
    setLayerVisibility(map, ["world-countries-fill", "world-countries-border"], false);
    return;
  }

  if (visitorV2 && !filter?.country) {
    setLayerVisibility(map, PERU_COUNTRY_SHELL_LAYERS, false);
    setCountryDepartmentOutlinesVisible(map, false);
    setLayerVisibility(
      map,
      [
        "peru-regions-fill",
        "peru-regions-border",
        "peru-regions-border-outer",
        "peru-regions-dept-glow",
        "peru-regions-dept-line",
        "peru-regions-labels",
        "peru-provinces-fill",
        "peru-provinces-border",
        "peru-provinces-labels",
        "peru-districts-fill",
        "peru-districts-border",
        "peru-districts-labels",
      ],
      false,
    );
    setLayerVisibility(
      map,
      ["world-countries-fill", "world-countries-border"],
      true,
    );
    return;
  }

  if (visitorV2 && filter?.region && !filter?.province) {
    setLayerVisibility(map, PERU_COUNTRY_SHELL_LAYERS, false);
    hideCountryOnlyRegionLayers(map);
    setLayerVisibility(
      map,
      ["peru-regions-fill", "peru-regions-labels"],
      false,
    );
    applyPeruRegionsScopeFilter(map, filter.region);
    setLayerVisibility(
      map,
      ["peru-regions-border", "peru-regions-border-outer"],
      true,
    );
    setLayerVisibility(
      map,
      [
        "peru-provinces-fill",
        "peru-provinces-border",
        "peru-provinces-labels",
      ],
      true,
    );
    setLayerVisibility(
      map,
      ["peru-districts-fill", "peru-districts-border", "peru-districts-labels"],
      false,
    );
    setLayerVisibility(
      map,
      ["world-countries-fill", "world-countries-border"],
      false,
    );
    return;
  }

  if (visitorV2 && filter?.province && !filter?.district) {
    setLayerVisibility(map, PERU_COUNTRY_SHELL_LAYERS, false);
    hideCountryOnlyRegionLayers(map);
    clearPeruRegionsScopeFilter(map);
    setLayerVisibility(
      map,
      [
        "peru-regions-fill",
        "peru-regions-border",
        "peru-regions-border-outer",
        "peru-regions-labels",
      ],
      false,
    );
    setLayerVisibility(
      map,
      [
        "peru-provinces-fill",
        "peru-provinces-border",
        "peru-provinces-labels",
      ],
      true,
    );
    const showDistricts = pinned || zoom >= PROVINCE_FOCUS_MIN_ZOOM - 1.2;
    setLayerVisibility(
      map,
      ["peru-districts-fill", "peru-districts-border"],
      showDistricts,
    );
    setLayerVisibility(map, ["peru-districts-labels"], showDistricts);
    setLayerVisibility(
      map,
      ["world-countries-fill", "world-countries-border"],
      false,
    );
    return;
  }

  if (visitorV2 && filter?.district) {
    setLayerVisibility(map, PERU_COUNTRY_SHELL_LAYERS, false);
    hideCountryOnlyRegionLayers(map);
    clearPeruRegionsScopeFilter(map);
    setLayerVisibility(
      map,
      [
        "peru-regions-fill",
        "peru-regions-border",
        "peru-regions-border-outer",
        "peru-regions-labels",
      ],
      false,
    );
    setLayerVisibility(
      map,
      [
        "peru-provinces-fill",
        "peru-provinces-border",
        "peru-provinces-labels",
      ],
      false,
    );
    setLayerVisibility(
      map,
      ["peru-districts-fill", "peru-districts-border", "peru-districts-labels"],
      true,
    );
    setLayerVisibility(
      map,
      ["world-countries-fill", "world-countries-border"],
      false,
    );
    return;
  }

  if (hideWorld) {
    setLayerVisibility(
      map,
      ["world-countries-fill", "world-countries-border"],
      false,
    );
  }

  if (focus) {
    setLayerVisibility(
      map,
      [
        "peru-regions-fill",
        "peru-regions-border",
        "peru-regions-border-outer",
        "peru-regions-labels",
        "peru-provinces-fill",
        "peru-provinces-border",
        "peru-provinces-labels",
      ],
      false,
    );

    const showDistricts = pinned || zoom >= PROVINCE_FOCUS_MIN_ZOOM;
    setLayerVisibility(
      map,
      ["peru-districts-fill", "peru-districts-border"],
      showDistricts,
    );
    setLayerVisibility(map, ["peru-districts-labels"], showDistricts);

    if (map.getLayer("peru-districts-fill")) {
      map.setPaintProperty(
        "peru-districts-fill",
        "fill-color",
        districtFillPaint.focus["fill-color"],
      );
      map.setPaintProperty(
        "peru-districts-fill",
        "fill-opacity",
        districtFillPaint.focus["fill-opacity"],
      );
    }

    if (map.getLayer("peru-districts-border")) {
      map.setPaintProperty(
        "peru-districts-border",
        "line-color",
        districtBorderPaint.focus["line-color"],
      );
      map.setPaintProperty(
        "peru-districts-border",
        "line-width",
        districtBorderPaint.focus["line-width"],
      );
    }

    if (map.getLayer("peru-districts-labels")) {
      applyWatermarkToLayer(
        map,
        "peru-districts-labels",
        watermarkLabels.distFocus,
      );
    }

    if (!pinned) {
      map.setMaxZoom(PROVINCE_FOCUS_MAX_ZOOM);
    } else {
      map.setMaxZoom(SCOPED_MAX_ZOOM);
      map.setMinZoom(SCOPED_MIN_ZOOM);
    }
    return;
  }

  map.setMaxZoom(18);

  const showDept = zoom >= ZOOM_BAND.deptMin && zoom < ZOOM_BAND.deptMax;
  const showProv = zoom >= ZOOM_BAND.provMin && zoom < ZOOM_BAND.provMax;
  const showDist = zoom >= ZOOM_BAND.distMin;

  setLayerVisibility(
    map,
    ["peru-regions-fill", "peru-regions-border", "peru-regions-border-outer"],
    showDept,
  );
  setLayerVisibility(map, ["peru-regions-labels"], showDept);
  setLayerVisibility(
    map,
    ["peru-provinces-fill", "peru-provinces-border"],
    showProv,
  );
  setLayerVisibility(map, ["peru-provinces-labels"], showProv);

  if (map.getLayer("peru-provinces-border") && showProv) {
    map.setPaintProperty(
      "peru-provinces-border",
      "line-color",
      provinceBorderPaint["line-color"],
    );
    map.setPaintProperty(
      "peru-provinces-border",
      "line-width",
      provinceBorderPaint["line-width"],
    );
    map.setPaintProperty(
      "peru-provinces-border",
      "line-opacity",
      provinceBorderPaint["line-opacity"],
    );
  }
  setLayerVisibility(
    map,
    ["peru-districts-fill", "peru-districts-border"],
    showDist,
  );
  setLayerVisibility(map, ["peru-districts-labels"], showDist);

  if (map.getLayer("peru-districts-fill")) {
    map.setPaintProperty(
      "peru-districts-fill",
      "fill-color",
      districtFillPaint.default["fill-color"],
    );
    map.setPaintProperty(
      "peru-districts-fill",
      "fill-opacity",
      districtFillPaint.default["fill-opacity"],
    );
  }

  if (map.getLayer("peru-districts-border")) {
    map.setPaintProperty(
      "peru-districts-border",
      "line-color",
      districtBorderPaint.default["line-color"],
    );
    map.setPaintProperty(
      "peru-districts-border",
      "line-width",
      districtBorderPaint.default["line-width"],
    );
  }

  if (map.getLayer("peru-districts-labels")) {
    applyWatermarkToLayer(map, "peru-districts-labels", watermarkLabels.dist);
  }

  applyWatermarkToLayer(map, "peru-regions-labels", watermarkLabels.dept);
  applyWatermarkToLayer(map, "peru-provinces-labels", watermarkLabels.prov);
}

function featureBounds(geometry) {
  const bounds = new maplibregl.LngLatBounds();
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  polygons.forEach((poly) => {
    poly[0].forEach((c) => bounds.extend(c));
  });
  return bounds;
}

function wireHoverHighlight(map, sourceId, layerId) {
  let hoveredId = null;

  const clearHover = () => {
    if (hoveredId != null) {
      map.setFeatureState(
        { source: sourceId, id: hoveredId },
        { hover: false },
      );
      hoveredId = null;
    }
    map.getCanvas().style.cursor = "";
  };

  map.on("mousemove", layerId, (e) => {
    if (!e.features?.length) return;
    const id = e.features[0].id;
    if (id == null) return;
    if (hoveredId !== null && hoveredId !== id) {
      map.setFeatureState(
        { source: sourceId, id: hoveredId },
        { hover: false },
      );
    }
    hoveredId = id;
    map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: true });
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", layerId, clearHover);
}

function addWorldCountryLayers(map, onWorldClick, options = {}) {
  if (map.getSource("world-countries")) return;

  const worldLayerOpts =
    options.clickableAtAllZooms === true ? {} : { maxzoom: 6 };

  map.addSource("world-countries", {
    type: "geojson",
    data: worldCountries,
    generateId: true,
  });

  map.addLayer({
    id: "world-countries-fill",
    type: "fill",
    source: "world-countries",
    ...worldLayerOpts,
    paint: {
      "fill-color": [
        "case",
        ["==", ["get", "ADMIN"], "Peru"],
        "rgba(100, 160, 220, 0.26)",
        ["boolean", ["feature-state", "hover"], false],
        "rgba(120, 160, 220, 0.35)",
        "rgba(255, 255, 255, 0.02)",
      ],
      "fill-opacity": 1,
    },
  });

  map.addLayer({
    id: "world-countries-border",
    type: "line",
    source: "world-countries",
    ...worldLayerOpts,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(255,255,255,0.22)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 4, 1],
    },
  });

  wireHoverHighlight(map, "world-countries", "world-countries-fill");
  map.on("click", "world-countries-fill", onWorldClick);
}

function applyProvinceFocusMode(map, provinceFilterId, options = {}) {
  syncVisitorV2Presentation(map, provinceFilterId, options);
}

function syncProjectionForScope(map, provinceFilterId, visOpts = {}) {
  syncProjection(map, provinceFilterId, {
    visitorCountryFocus: isVisitorCountryFocus(visOpts),
    revealBackdropStars: Boolean(visOpts.visitorV2),
  });
}

function addPeruRegionLayers(map, places, entriesGrouped, onRegionClick) {
  const regionsGeoJSON = enrichPeruDepartments(
    getRawPeruDepartments(),
    places,
    entriesGrouped,
  );

  if (!map.getSource("peru-regions")) {
    map.addSource("peru-regions", {
      type: "geojson",
      data: regionsGeoJSON,
      generateId: true,
    });

    map.addLayer({
      id: "peru-regions-fill",
      type: "fill",
      source: "peru-regions",
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#3a5268",
          fillWithHover(regionFillColor, "#5a6878"),
        ],
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.9,
          ["boolean", ["feature-state", "hover"], false],
          0.92,
          0.78,
        ],
      },
    });

    map.addLayer({
      id: "peru-regions-border-outer",
      type: "line",
      source: "peru-regions",
      layout: { "line-join": "round", "line-cap": "round", visibility: "none" },
      filter: ["boolean", ["feature-state", "selected"], false],
      paint: {
        "line-color": "rgba(255, 200, 120, 0.88)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 3.8, 8, 5.2],
      },
    });

    map.addLayer({
      id: "peru-regions-border",
      type: "line",
      source: "peru-regions",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#fff8e8",
          "#ffffff",
        ],
        "line-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          ["interpolate", ["linear"], ["zoom"], 4, 2.2, 8, 3],
          ["interpolate", ["linear"], ["zoom"], 4, 1.6, 6.5, 2.2],
        ],
        "line-opacity": 1,
      },
    });

    map.addSource("peru-regions-label-pts", {
      type: "geojson",
      data: geoJSONToLabelPoints(regionsGeoJSON),
    });
    addLabelLayer(
      map,
      "peru-regions-labels",
      "peru-regions-label-pts",
      watermarkLabels.dept,
    );

    wireHoverHighlight(map, "peru-regions", "peru-regions-fill");
    map.on("click", "peru-regions-fill", onRegionClick);
    addCountryDepartmentOutlineLayers(map);
  } else {
    map.getSource("peru-regions").setData(regionsGeoJSON);
    syncLabelSource(map, "peru-regions-label-pts", regionsGeoJSON);
  }
}

function addPlaceLayers(map) {
  if (map.getSource("places")) return;
  map.addSource("places", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
}

async function applyPhotoPatterns(
  map,
  places,
  grouped,
  provinceFilter,
  departmentFilter,
  districtGeoJSON = null,
  scopedFilter = null,
) {
  if (!map?.isStyleLoaded()) return;

  const level = visitorPhotoLevel(scopedFilter ?? {});
  const clearPattern = (layerId) => {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "fill-pattern", "");
    }
  };

  if (level === "globe") {
    if (map.getSource("world-countries")) {
      const shell = getPeruCountryFeatureCollection();
      const photoState = buildCountryShellPhotoState(places, grouped);
      const peruFeature = shell.features[0]
        ? {
            ...shell.features[0],
            properties: {
              ...shell.features[0].properties,
              ...photoState,
              pattern_id: "",
            },
          }
        : null;
      const globeGeo = {
        ...worldCountries,
        features: worldCountries.features.map((feature) => {
          const admin = feature.properties.ADMIN || feature.properties.NAME;
          const iso = feature.properties.ISO_A3 || feature.properties.ADM0_A3;
          if ((admin === "Peru" || iso === "PER") && peruFeature) {
            return {
              ...peruFeature,
              id: feature.id,
              properties: {
                ...peruFeature.properties,
                ADMIN: admin,
              },
            };
          }
          return {
            ...feature,
            properties: { ...feature.properties, pattern_id: "", photo_urls: "" },
          };
        }),
      };
      await syncGeoJSONPhotoPatterns(map, globeGeo, "world-countries", [
        "world-countries-fill",
      ]);
    }
    clearPattern("peru-regions-fill");
    clearPattern("peru-provinces-fill");
    clearPattern("peru-country-fill");
    clearPattern("peru-districts-fill");
    return;
  }

  clearPattern("world-countries-fill");
  if (map.getSource("world-countries")) {
    map.getSource("world-countries").setData(worldCountries);
  }

  if (level === "country" || level === "region") {
    if (map.getSource("peru-regions")) {
      const geo = enrichPeruDepartments(
        getRawPeruDepartments(),
        places,
        grouped,
      );
      if (level === "country") {
        await syncGeoJSONPhotoPatterns(map, geo, "peru-regions", [
          "peru-regions-fill",
        ]);
      } else {
        map.getSource("peru-regions").setData(geo);
        clearPattern("peru-regions-fill");
      }
    }
    clearPattern("peru-country-fill");
  } else {
    clearPattern("peru-regions-fill");
    clearPattern("peru-country-fill");
  }

  if (level === "region") {
    if (map.getSource("peru-provinces")) {
      const geo = enrichPeruProvinces(
        getActiveProvincesGeoJSON(),
        places,
        grouped,
        provinceFilter,
        departmentFilter,
      );
      await syncGeoJSONPhotoPatterns(map, geo, "peru-provinces", [
        "peru-provinces-fill",
      ]);
    }
    clearPattern("peru-districts-fill");
  } else {
    clearPattern("peru-provinces-fill");
    if (map.getSource("peru-provinces")) {
      const geo = enrichPeruProvinces(
        getActiveProvincesGeoJSON(),
        places,
        grouped,
        provinceFilter,
        departmentFilter,
      );
      map.getSource("peru-provinces").setData(geo);
    }
  }

  if (level === "province" || level === "district") {
    if (map.getSource("peru-districts") && districtGeoJSON) {
      await syncGeoJSONPhotoPatterns(map, districtGeoJSON, "peru-districts", [
        "peru-districts-fill",
      ]);
    } else {
      clearPattern("peru-districts-fill");
    }
  } else {
    clearPattern("peru-districts-fill");
  }
}

export default function GlobeMap({
  places,
  entries,
  entriesBySlug,
  selectedSlug,
  mapFilter = EMPTY_FILTER,
  onMapFilterChange,
  onOpenPanel,
  scope = null,
  hideMapControls = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const districtsReadyRef = useRef(false);
  const provincesDetailedReadyRef = useRef(false);
  const provinceFilterRef = useRef(null);
  const departmentFilterRef = useRef(null);
  const pinnedFocusRef = useRef(false);
  const refreshAfterNavRef = useRef(() => {});
  const adminCtxCacheRef = useRef({
    provinceFilter: null,
    departmentFilter: null,
    zoomBand: null,
    boundsKey: null,
  });
  const placesRef = useRef(places);
  const entriesGroupedRef = useRef(groupEntriesBySlug(entries));
  const onOpenPanelRef = useRef(onOpenPanel);
  const onMapFilterChangeRef = useRef(onMapFilterChange);
  const scopeRef = useRef(scope);
  const hideMapControlsRef = useRef(hideMapControls);
  const appliedNavKeyRef = useRef("");
  const navGenerationRef = useRef(0);
  const navBusyRef = useRef(false);
  const lastDistrictGeoRef = useRef(null);
  const scopedBoundsRef = useRef(null);
  const scopedFilterRef = useRef(mapFilter);
  const mapFilterRef = useRef(mapFilter);
  const adminSelectionRef = useRef([]);
  placesRef.current = places;
  entriesGroupedRef.current = groupEntriesBySlug(entries);
  onOpenPanelRef.current = onOpenPanel;
  onMapFilterChangeRef.current = onMapFilterChange;
  scopeRef.current = scope;
  hideMapControlsRef.current = hideMapControls;
  mapFilterRef.current = mapFilter;
  scopedFilterRef.current = mapFilter;

  const getFocusVisOptions = useCallback(
    () => ({
      pinned: pinnedFocusRef.current || isChachapoyasScope(scopeRef.current),
      hideWorld: isChachapoyasScope(scopeRef.current),
      visitorV2: isVisitorV2Scope(scopeRef.current),
      filter: scopedFilterRef.current,
    }),
    [],
  );

  const refitScopedView = useCallback((map) => {
    if (!map?.isStyleLoaded()) return;
    if (!isChachapoyasScope(scopeRef.current)) return;
    const bounds = scopedBoundsRef.current;
    if (!isValidBounds(bounds)) return;
    const filter = scopedFilterRef.current;
    fitMapToScopedBounds(map, bounds, {
      district: Boolean(filter?.district),
      duration: 0,
    });
  }, []);

  const scopedFitNow = useCallback((map, bounds, isDistrictView) => {
    if (!map?.isStyleLoaded() || !isValidBounds(bounds)) return;
    if (!isChachapoyasScope(scopeRef.current)) return;
    scopedBoundsRef.current = bounds;
    fitMapToScopedBounds(map, bounds, {
      district: isDistrictView,
      duration: 0,
    });
  }, []);

  const runPhotoPatterns = useCallback(async (map, districtGeoJSON = null) => {
    await applyPhotoPatterns(
      map,
      placesRef.current,
      entriesGroupedRef.current,
      provinceFilterRef.current,
      departmentFilterRef.current,
      districtGeoJSON ?? lastDistrictGeoRef.current,
      scopedFilterRef.current,
    );
    if (isVisitorV2Scope(scopeRef.current)) {
      const level = visitorPhotoLevel(scopedFilterRef.current ?? {});
      if (level === "country") {
        ensureRegionLayersOnTop(map);
        applyVisitorCountryFillStyle(map);
      }
      if (level === "region") {
        ensureRegionScopeBordersOnTop(map);
      }
      if (level === "province" || level === "district") {
        ensureDistrictLayersOnTop(map);
      }
    }
  }, []);

  const runPhotoPatternsRef = useRef(null);
  runPhotoPatternsRef.current = runPhotoPatterns;

  const applyFilterToMapRef = useRef(null);

  const navigateFromFilter = useCallback((filter, boundsOverride = null) => {
    const map = mapRef.current;
    let safe = filter ?? EMPTY_FILTER;
    if (isChachapoyasScope(scopeRef.current)) {
      safe = clampFilterToChachapoyas(safe);
    }
    if (!safe.country && !boundsOverride) return;
    if (!map) return;
    applyFilterToMapRef.current?.(map, safe, boundsOverride);
    onMapFilterChangeRef.current?.(safe);
  }, []);

  const navigateToPeruCountry = useCallback(() => {
    navigateFromFilter(PERU_COUNTRY_FILTER);
  }, [navigateFromFilter]);

  const handleWorldClick = useCallback(
    (e) => {
      if (isChachapoyasScope(scopeRef.current)) return;
      const map = mapRef.current;
      const feature = e.features?.[0];
      if (!map || !feature || !isPeruWorldFeature(feature)) return;

      navigateToPeruCountry();
    },
    [navigateToPeruCountry],
  );

  const handlePeruCountryClick = useCallback(
    (e) => {
      if (isChachapoyasScope(scopeRef.current)) return;
      if (!isVisitorV2Scope(scopeRef.current)) return;
      navigateToPeruCountry();
    },
    [navigateToPeruCountry],
  );

  const handleRegionClick = useCallback(
    (e) => {
      if (isChachapoyasScope(scopeRef.current)) return;
      const map = mapRef.current;
      const feature = e.features?.[0];
      if (!map || !feature) return;

      const slug =
        feature.properties.slug ||
        departmentToSlug(feature.properties.NOMBDEP);
      if (!slug) return;

      const current = scopedFilterRef.current;
      if (isVisitorV2Scope(scopeRef.current)) {
        if (!current?.country) {
          navigateToPeruCountry();
          return;
        }
        // 2.º toque mismo departamento → carrusel (como provincia/distrito)
        if (current?.region === slug && !current?.province) {
          onOpenPanelRef.current?.(slug);
          return;
        }
        if (
          current?.region &&
          !current?.province &&
          slug !== current.region
        ) {
          return;
        }
      }

      let filter = filterFromSlug(placesRef.current, slug);
      if (!filter.country) {
        filter = {
          country: "peru",
          region: slug,
          province: null,
          district: null,
        };
      }
      navigateFromFilter(filter, featureBounds(feature.geometry));
    },
    [navigateFromFilter, navigateToPeruCountry],
  );

  const handleProvinceClick = useCallback(
    (e) => {
      if (isChachapoyasScope(scopeRef.current)) return;
      const map = mapRef.current;
      const feature = e.features?.[0];
      if (!map || !feature) return;

      const filter = filterFromProvinceFeature(placesRef.current, feature);
      const provSlug = filter.province;

      if (isVisitorV2Scope(scopeRef.current)) {
        const current = scopedFilterRef.current;
        if (current?.province === provSlug && !current?.district) {
          onOpenPanelRef.current?.(provSlug);
          return;
        }
        if (!current?.province || current.province !== provSlug) {
          navigateFromFilter(filter, featureBounds(feature.geometry));
          return;
        }
      }

      navigateFromFilter(filter, featureBounds(feature.geometry));
    },
    [navigateFromFilter],
  );

  const handleDistrictClick = useCallback(
    (e) => {
      const map = mapRef.current;
      const feature = e.features?.[0];
      if (!map || !feature) return;

      const slug =
        feature.properties.slug || getDistrictSlug(feature.properties);
      if (!slug) return;

      const filter = filterFromSlug(placesRef.current, slug);

      if (isVisitorV2Scope(scopeRef.current)) {
        const current = scopedFilterRef.current;
        if (current?.district === slug) {
          onOpenPanelRef.current?.(slug);
          return;
        }
        if (current?.province && !current?.district) {
          onOpenPanelRef.current?.(slug);
          return;
        }
        navigateFromFilter(filter, featureBounds(feature.geometry));
        return;
      }

      navigateFromFilter(filter, featureBounds(feature.geometry));
      onOpenPanelRef.current?.(slug);
    },
    [navigateFromFilter],
  );

  const refreshDistrictSource = useCallback(
    async (map) => {
      if (!map.getSource("peru-districts")) return;
      const zoom = map.getZoom();
      const filter = provinceFilterRef.current;
      const visitorProvincePinned =
        isVisitorV2Scope(scopeRef.current) &&
        Boolean(scopedFilterRef.current?.province) &&
        !scopedFilterRef.current?.district;

      if (
        !isAmazonasProvinceId(filter) &&
        zoom < DISTRICT_MIN_ZOOM &&
        !visitorProvincePinned
      ) {
        return;
      }

      const boundsFilter = getDistrictBoundsFilter(map, filter);
      if (!filter && !boundsFilter) {
        return;
      }

      const boundsKey = boundsFilter
        ? `${boundsFilter[0][0].toFixed(3)},${boundsFilter[0][1].toFixed(3)},${boundsFilter[1][0].toFixed(3)},${boundsFilter[1][1].toFixed(3)}`
        : `${filter}|${scopedFilterRef.current?.district ?? ""}`;
      const cache = adminCtxCacheRef.current;
      if (
        cache.districtFilter === filter &&
        cache.districtSlug === (scopedFilterRef.current?.district ?? "") &&
        cache.boundsKey === boundsKey &&
        cache.districtFeatureCount != null
      ) {
        return;
      }
      const raw = await loadDistrictGeoJSON(filter);
      const data = enrichPeruDistricts(
        raw,
        placesRef.current,
        entriesGroupedRef.current,
        filter,
        boundsFilter,
        scopedFilterRef.current?.district ?? null,
      );
    map.getSource("peru-districts").setData(data);
    syncLabelSource(map, "peru-districts-label-pts", data);
    cache.districtFilter = filter;
      cache.districtSlug = scopedFilterRef.current?.district ?? "";
      cache.boundsKey = boundsKey;
      cache.districtFeatureCount = data.features.length;
      lastDistrictGeoRef.current = data;
      await runPhotoPatterns(map, data);

      if (isChachapoyasScope(scopeRef.current)) {
        refitScopedView(map);
      }
    },
    [runPhotoPatterns, refitScopedView],
  );

  const ensureDetailedProvinces = useCallback(async (map) => {
    if (provincesDetailedReadyRef.current) return;
    if (map.getZoom() < ZOOM_BAND.provMin) return;
    try {
      await loadDetailedProvinces();
      provincesDetailedReadyRef.current = true;
      if (map.getSource("peru-provinces")) {
        const provincesGeoJSON = enrichPeruProvinces(
          getActiveProvincesGeoJSON(),
          placesRef.current,
          entriesGroupedRef.current,
          provinceFilterRef.current,
          departmentFilterRef.current,
        );
        map.getSource("peru-provinces").setData(provincesGeoJSON);
        syncLabelSource(map, "peru-provinces-label-pts", provincesGeoJSON);
      }
    } catch (err) {
      console.warn("Provincias detalladas no disponibles:", err.message);
    }
  }, []);

  const autoDetectAdminContext = useCallback((map) => {
    if (pinnedFocusRef.current) return;
    if (
      isVisitorV2Scope(scopeRef.current) &&
      !scopedFilterRef.current?.country
    ) {
      provinceFilterRef.current = null;
      departmentFilterRef.current = null;
      return;
    }

    const zoom = map.getZoom();
    const { lng, lat } = map.getCenter();
    const provinces = getActiveProvincesGeoJSON();

    if (zoom >= AMAZONAS_PROVINCE_AUTO_ZOOM) {
      const provinceId = findProvinceAtPoint(lng, lat, provinces);
      if (isAmazonasProvinceId(provinceId)) {
        provinceFilterRef.current = provinceId;
        departmentFilterRef.current = "AMAZONAS";
        return;
      }
      const dept = findDepartmentAtPoint(lng, lat);
      if (
        dept === "AMAZONAS" &&
        isAmazonasProvinceId(provinceFilterRef.current)
      ) {
        departmentFilterRef.current = "AMAZONAS";
        return;
      }
      provinceFilterRef.current = null;
      departmentFilterRef.current =
        dept === "AMAZONAS"
          ? "AMAZONAS"
          : zoom >= ZOOM_BAND.provMin
            ? dept
            : null;
      return;
    }

    provinceFilterRef.current = null;
    departmentFilterRef.current =
      zoom >= ZOOM_BAND.provMin ? findDepartmentAtPoint(lng, lat) : null;
  }, []);

  const ensureDistrictLayers = useCallback(
    async (map, force = false) => {
      const filter = provinceFilterRef.current;
      const scopedPinned =
        isChachapoyasScope(scopeRef.current) && pinnedFocusRef.current;

      if (districtsReadyRef.current) {
        if (!map.getSource("peru-districts")) return;
        const zoom = map.getZoom();
        if (!scopedPinned && !isAmazonasProvinceId(filter) && zoom < DISTRICT_MIN_ZOOM) {
          return;
        }
        await refreshDistrictSource(map);
        return;
      }
      if (!force && !scopedPinned && map.getZoom() < DISTRICT_MIN_ZOOM - 0.5) {
        return;
      }
      try {
        const raw = await loadDistrictGeoJSON(filter);
        const catalogGeo = enrichPeruDistricts(
          raw,
          placesRef.current,
          entriesGroupedRef.current,
          filter,
        );
        registerDistrictGeoJSON(catalogGeo);
        addPeruDistrictLayers(
          map,
          placesRef.current,
          entriesGroupedRef.current,
          handleDistrictClick,
          raw,
          filter,
        );
        districtsReadyRef.current = true;
        await refreshDistrictSource(map);
      } catch (err) {
        console.warn("Distritos no disponibles:", err.message);
      }
    },
    [handleDistrictClick, refreshDistrictSource],
  );

  const updateProvinceData = useCallback((map) => {
    if (!map.getSource("peru-provinces")) return;
    const provincesGeoJSON = enrichPeruProvinces(
      getActiveProvincesGeoJSON(),
      placesRef.current,
      entriesGroupedRef.current,
      provinceFilterRef.current,
      departmentFilterRef.current,
    );
    map.getSource("peru-provinces").setData(provincesGeoJSON);
    syncLabelSource(map, "peru-provinces-label-pts", provincesGeoJSON);
    applyProvinceFocusMode(
      map,
      provinceFilterRef.current,
      getFocusVisOptions(),
    );
  }, [getFocusVisOptions]);

  const updateDistrictData = useCallback(
    async (map) => {
      await refreshDistrictSource(map);
    },
    [refreshDistrictSource],
  );

  applyFilterToMapRef.current = async (map, filter, boundsOverride = null) => {
    if (!map?.isStyleLoaded()) return;

    let safeFilter = filter ?? EMPTY_FILTER;
    if (isChachapoyasScope(scopeRef.current)) {
      safeFilter = clampFilterToChachapoyas(safeFilter);
    }

      const navKey = filterKey(safeFilter);
      const gen = ++navGenerationRef.current;
      navBusyRef.current = true;
      const visitorV2 = isVisitorV2Scope(scopeRef.current);

      try {
      scopedFilterRef.current = safeFilter;

      const { pinned, provinceFilterRef: prov, departmentFilterRef: dept } =
        filterToAdminRefs(safeFilter, placesRef.current);

      pinnedFocusRef.current = pinned;
      provinceFilterRef.current = prov;
      departmentFilterRef.current = dept;

      adminCtxCacheRef.current.districtFilter = null;
      adminCtxCacheRef.current.districtSlug = null;
      adminCtxCacheRef.current.boundsKey = null;
      adminCtxCacheRef.current.zoomBand = null;

      const rawBounds =
        boundsOverride ??
        (await getBoundsForFilter(placesRef.current, safeFilter));
      const bounds = normalizeBounds(rawBounds);
      const isScoped = isChachapoyasScope(scopeRef.current);
      const isDistrictView = Boolean(safeFilter.district);

      const visOpts = getFocusVisOptions();

      if (!safeFilter.country) {
        scopedBoundsRef.current = null;
        map.setMaxBounds(null);
        map.setMinZoom(0);
        map.setMaxZoom(18);
        clearAdminFeatureSelection(map, adminSelectionRef);
        setPeruCountryShellFocused(map, false);
        map.flyTo({
          center: GLOBE_CENTER,
          zoom: GLOBE_ZOOM,
          duration: visitorV2 ? 1200 : 1400,
          essential: true,
        });
        appliedNavKeyRef.current = navKey;
      } else if (isValidBounds(bounds)) {
        scopedBoundsRef.current = bounds;
        appliedNavKeyRef.current = navKey;
        if (isScoped) {
          scopedFitNow(map, bounds, isDistrictView);
        } else if (visitorV2) {
          fitMapToScopedBounds(map, bounds, {
            district: isDistrictView,
            duration: 900,
            zoomOutBias: safeFilter.district
              ? 0.85
              : safeFilter.province
                ? 0.95
                : safeFilter.region
                  ? 1.0
                  : 0.45,
            minFitZoom: !safeFilter.region && !safeFilter.province ? 5.15 : undefined,
          });
        }
      } else {
        console.warn("[EYL nav] bounds inválidos, se mantiene la vista", safeFilter);
      }

      if (gen !== navGenerationRef.current) return;

      await ensureDetailedProvinces(map);
      if (gen !== navGenerationRef.current) return;
      updateProvinceData(map);
      await ensureDistrictLayers(map, Boolean(prov));
      if (gen !== navGenerationRef.current) return;
      await updateDistrictData(map);
      if (gen !== navGenerationRef.current) return;
      applyProvinceFocusMode(map, prov, visOpts);
      syncProjectionForScope(map, prov, visOpts);
      if (visitorV2) {
        applyVisitorV2Selection(map, safeFilter, adminSelectionRef);
      }
      if (gen !== navGenerationRef.current) return;
      await runPhotoPatterns(map);

      if (isScoped && isValidBounds(scopedBoundsRef.current)) {
        fitMapToScopedBounds(map, scopedBoundsRef.current, {
          district: isDistrictView,
          duration: 0,
        });
      } else if (
        !visitorV2 &&
        isValidBounds(scopedBoundsRef.current)
      ) {
        const padding = getMapFitPadding(map);
        map.fitBounds(scopedBoundsRef.current, {
          padding,
          duration: 0,
          essential: true,
          maxZoom: isDistrictView ? 14 : 12,
        });
        map.setMaxBounds(expandBoundsForMax(scopedBoundsRef.current));
      }
    } catch (err) {
      console.error("[EYL nav]", err);
    } finally {
      if (gen === navGenerationRef.current) {
        navBusyRef.current = false;
      }
    }
  };

  const refreshAdminContext = useCallback(
    async (map) => {
      if (navBusyRef.current) return;

      const prevProvince = provinceFilterRef.current;
      const prevDept = departmentFilterRef.current;
      autoDetectAdminContext(map);
      const filterChanged =
        prevProvince !== provinceFilterRef.current ||
        prevDept !== departmentFilterRef.current;

      await ensureDetailedProvinces(map);

      if (filterChanged) {
        updateProvinceData(map);
        adminCtxCacheRef.current.districtFilter = null;
        adminCtxCacheRef.current.boundsKey = null;
      } else {
        applyProvinceFocusMode(
          map,
          provinceFilterRef.current,
          getFocusVisOptions(),
        );
      }

      await ensureDistrictLayers(map, Boolean(provinceFilterRef.current));
      await runPhotoPatterns(map);
    },
    [
      autoDetectAdminContext,
      ensureDetailedProvinces,
      updateProvinceData,
      ensureDistrictLayers,
      runPhotoPatterns,
    ],
  );

  useEffect(() => {
    refreshAfterNavRef.current = refreshAdminContext;
  }, [refreshAdminContext]);

  const syncLayers = useCallback(
    (map) => {
      addWorldCountryLayers(map, handleWorldClick, {
        clickableAtAllZooms: isVisitorV2Scope(scopeRef.current),
      });
      addPeruCountryShellLayers(map, handlePeruCountryClick);
      addPeruRegionLayers(
        map,
        placesRef.current,
        entriesGroupedRef.current,
        handleRegionClick,
      );
      addPeruProvinceLayers(
        map,
        placesRef.current,
        entriesGroupedRef.current,
        handleProvinceClick,
        provinceFilterRef.current,
        departmentFilterRef.current,
      );
      addPlaceLayers(map);
      ensureDistrictLayers(map, Boolean(provinceFilterRef.current));
      applyProvinceFocusMode(
        map,
        provinceFilterRef.current,
        getFocusVisOptions(),
      );
    },
    [
      handleWorldClick,
      handlePeruCountryClick,
      handleRegionClick,
      handleProvinceClick,
      ensureDistrictLayers,
      getFocusVisOptions,
    ],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const chachapoyas = isChachapoyasScope(scopeRef.current);
    const visitorV2 = isVisitorV2Scope(scopeRef.current);
    const transparentBg = visitorV2;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(transparentBg),
      center: chachapoyas ? CHACHAPOYAS_CENTER : GLOBE_CENTER,
      zoom: chachapoyas ? CHACHAPOYAS_ZOOM : GLOBE_ZOOM,
      pitch: 0,
      bearing: 0,
      projection: chachapoyas ? "mercator" : "globe",
      touchPitch: false,
      touchZoomRotate: true,
      doubleClickZoom: true,
      scrollZoom: true,
      boxZoom: true,
    });

    if (!hideMapControlsRef.current) {
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      if (!chachapoyas) {
        map.addControl(new maplibregl.GlobeControl(), "top-right");
      }
    }

    const resyncVisitorPresentation = (map) => {
      if (!isVisitorV2Scope(scopeRef.current)) return;
      const visOpts = getFocusVisOptions();
      applyProvinceFocusMode(map, provinceFilterRef.current, visOpts);
      syncProjectionForScope(map, provinceFilterRef.current, visOpts);
      applyVisitorV2Selection(
        map,
        scopedFilterRef.current,
        adminSelectionRef,
      );
      if (isVisitorCountryFocus(visOpts)) {
        void runPhotoPatternsRef.current?.(map);
      }
    };

    map.on("load", async () => {
      if (chachapoyas) {
        provinceFilterRef.current = CHACHAPOYAS_PROVINCE_ID;
        departmentFilterRef.current = "AMAZONAS";
        pinnedFocusRef.current = true;
      } else {
        applyGlobeAtmosphere(map, { revealBackdropStars: visitorV2 });
      }
      syncLayers(map);
      await ensureDistrictLayers(map, chachapoyas);
      applyProvinceFocusMode(
        map,
        provinceFilterRef.current,
        getFocusVisOptions(),
      );
      syncProjectionForScope(
        map,
        provinceFilterRef.current,
        getFocusVisOptions(),
      );
      await runPhotoPatterns(map);
      setMapReady(true);
    });

    let moveTimer = null;
    let adminTimer = null;

    const scheduleAdminRefresh = (map) => {
      clearTimeout(adminTimer);
      adminTimer = setTimeout(() => {
        refreshAdminContext(map);
      }, 280);
    };

    map.on("zoom", () => {
      const visOpts = getFocusVisOptions();
      syncProjectionForScope(map, provinceFilterRef.current, visOpts);
      const zoom = map.getZoom();
      const focus = Boolean(provinceFilterRef.current);
      const band = focus
        ? visOpts.pinned || zoom >= PROVINCE_FOCUS_MIN_ZOOM
          ? "focus-dist"
          : "focus-wait"
        : zoom < ZOOM_BAND.deptMax
          ? "dept"
          : zoom < ZOOM_BAND.provMax
            ? "prov"
            : "dist";
      if (adminCtxCacheRef.current.zoomBand !== band) {
        adminCtxCacheRef.current.zoomBand = band;
        applyProvinceFocusMode(map, provinceFilterRef.current, visOpts);
      }
    });

    map.on("moveend", () => {
      clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        resyncVisitorPresentation(map);
        scheduleAdminRefresh(map);
      }, 200);
    });

    map.on("zoomend", () => {
      const visOpts = getFocusVisOptions();
      syncProjectionForScope(map, provinceFilterRef.current, visOpts);
      applyProvinceFocusMode(map, provinceFilterRef.current, visOpts);
      resyncVisitorPresentation(map);
      scheduleAdminRefresh(map);
    });

    mapRef.current = map;

    let resizeObserver = null;
    let resizeTimer = null;

    const handleViewportChange = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.resize();
        refitScopedView(map);
      }, 120);
    };

    if (containerRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleViewportChange);
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [
    syncLayers,
    ensureDistrictLayers,
    refreshAdminContext,
    getFocusVisOptions,
    refitScopedView,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncLayers(map);
    runPhotoPatterns(map);
  }, [places, entries, syncLayers, runPhotoPatterns]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.isStyleLoaded()) return;

    let filter = mapFilter ?? EMPTY_FILTER;
    if (isChachapoyasScope(scopeRef.current)) {
      filter = clampFilterToChachapoyas(filter);
    }
    const key = filterKey(filter);
    if (appliedNavKeyRef.current === key) return;

    applyFilterToMapRef.current?.(map, filter);
  }, [mapFilter, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.isStyleLoaded()) return;
    if (!isChachapoyasScope(scopeRef.current)) return;
    requestAnimationFrame(() => refitScopedView(map));
  }, [mapReady, refitScopedView]);

  return (
    <div className="globe-map-wrap">
      <div ref={containerRef} className="globe-map" aria-label="Mapa" />
    </div>
  );
}
