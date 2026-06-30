import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  buildMapInfoTargets,
  enrichPeruDepartments,
  enrichPeruDistricts,
  enrichPeruProvinces,
  findDepartmentAtPoint,
  findProvinceAtPoint,
  geoJSONToLabelPoints,
  getActiveProvincesGeoJSON,
  getProvinceBounds,
  getRawPeruDepartments,
  groupEntriesBySlug,
  isAmazonasProvinceId,
  loadDetailedProvinces,
  loadDistrictGeoJSON,
} from "../data/regions";
import worldCountries from "../data/world-countries.json";
import MapInfoOverlay from "./MapInfoOverlay";
import { syncGeoJSONPhotoPatterns } from "../lib/mapPhotoPatterns";
import {
  getDistrictSlug,
  registerDistrictGeoJSON,
} from "../data/districtPlaces";

/** Fondo oscuro sin calles ni r├¡os ÔÇö solo nuestras capas encima */
const MAP_STYLE = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#060810" },
    },
  ],
};

const PERU_ZOOM = 5.5;
const PERU_CENTER = [-75.5, -9.2];
const AMAZONAS_CENTER = [-77.87, -6.23];
const GLOBE_ZOOM = 1.8;
const GLOBE_CENTER = [-75, -15];
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
  "text-font": ["Open Sans Regular"],
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
  deptMax: 7,
  provMin: 7,
  provMax: 10,
  distMin: 10,
};

const regionFillColor = [
  "case",
  ["==", ["get", "visited"], true],
  "#2ecc71",
  ["==", ["get", "tracked"], true],
  "#5a5a5a",
  "#3a4255",
];

const provinceFillColor = [
  "case",
  ["==", ["get", "visited"], true],
  "#24854a",
  ["==", ["get", "tracked"], true],
  "#454545",
  "#323848",
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
        "fill-color": fillWithHover(provinceFillColor, "#4d5668"),
        "fill-opacity": 0.72,
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

function applyGlobeAtmosphere(map) {
  if (typeof map.setFog !== "function") return;
  map.setFog({
    color: "#060810",
    "high-color": "#141a30",
    "horizon-blend": 0.07,
    "space-color": "#000005",
    "star-intensity": 0.55,
  });
}

function clearGlobeAtmosphere(map) {
  if (typeof map.setFog !== "function") return;
  map.setFog(null);
}

/** Globo alejado ┬À plano Mercator al acercar (fronteras legibles) */
function syncProjection(map, provinceFilterId) {
  if (!map?.isStyleLoaded()) return;

  const useGlobe = map.getZoom() <= GLOBE_MAX_ZOOM && !provinceFilterId;

  const current = map.getProjection()?.type;
  const next = useGlobe ? "globe" : "mercator";
  if (current === next) return;

  map.setProjection({ type: next });
  if (useGlobe) {
    applyGlobeAtmosphere(map);
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

/** Un solo nivel admin visible ÔÇö evita l├¡neas superpuestas al hacer zoom */
function syncAdminLevelVisibility(map, provinceFilterId) {
  const focus = Boolean(provinceFilterId);
  const zoom = map.getZoom();

  if (focus) {
    setLayerVisibility(
      map,
      [
        "peru-regions-fill",
        "peru-regions-border",
        "peru-regions-labels",
        "peru-provinces-fill",
        "peru-provinces-border",
        "peru-provinces-labels",
      ],
      false,
    );

    const showDistricts = zoom >= PROVINCE_FOCUS_MIN_ZOOM;
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

    map.setMaxZoom(PROVINCE_FOCUS_MAX_ZOOM);
    return;
  }

  map.setMaxZoom(18);

  const showDept = zoom >= ZOOM_BAND.deptMin && zoom < ZOOM_BAND.deptMax;
  const showProv = zoom >= ZOOM_BAND.provMin && zoom < ZOOM_BAND.provMax;
  const showDist = zoom >= ZOOM_BAND.distMin;

  setLayerVisibility(
    map,
    ["peru-regions-fill", "peru-regions-border"],
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

function addWorldCountryLayers(map, onWorldClick) {
  if (map.getSource("world-countries")) return;

  map.addSource("world-countries", {
    type: "geojson",
    data: worldCountries,
    generateId: true,
  });

  map.addLayer({
    id: "world-countries-fill",
    type: "fill",
    source: "world-countries",
    maxzoom: 6,
    paint: {
      "fill-color": [
        "case",
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
    maxzoom: 6,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "rgba(255,255,255,0.22)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 4, 1],
    },
  });

  wireHoverHighlight(map, "world-countries", "world-countries-fill");
  map.on("click", "world-countries-fill", onWorldClick);
}

function applyProvinceFocusMode(map, provinceFilterId) {
  syncAdminLevelVisibility(map, provinceFilterId);
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
        "fill-color": fillWithHover(regionFillColor, "#5a6880"),
        "fill-opacity": 0.78,
      },
    });

    map.addLayer({
      id: "peru-regions-border",
      type: "line",
      source: "peru-regions",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 6.5, 2.2],
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
) {
  if (!map?.isStyleLoaded()) return;

  if (map.getSource("peru-regions")) {
    const geo = enrichPeruDepartments(getRawPeruDepartments(), places, grouped);
    await syncGeoJSONPhotoPatterns(map, geo, "peru-regions", [
      "peru-regions-fill",
    ]);
  }
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
  if (map.getSource("peru-districts") && districtGeoJSON) {
    await syncGeoJSONPhotoPatterns(map, districtGeoJSON, "peru-districts", [
      "peru-districts-fill",
    ]);
  }
}

export default function GlobeMap({
  places,
  entries,
  entriesBySlug,
  selectedSlug,
  onOpenPanel,
  focusPlace,
  mapNavRef,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [infoTargets, setInfoTargets] = useState([]);
  const [districtInfoGeo, setDistrictInfoGeo] = useState(null);
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
  const lastDistrictGeoRef = useRef(null);
  placesRef.current = places;
  entriesGroupedRef.current = groupEntriesBySlug(entries);
  onOpenPanelRef.current = onOpenPanel;

  const runPhotoPatterns = useCallback(async (map, districtGeoJSON = null) => {
    await applyPhotoPatterns(
      map,
      placesRef.current,
      entriesGroupedRef.current,
      provinceFilterRef.current,
      departmentFilterRef.current,
      districtGeoJSON ?? lastDistrictGeoRef.current,
    );
  }, []);

  const afterClickNav = useCallback((map) => {
    map.once("moveend", () => refreshAfterNavRef.current(map));
  }, []);

  const handleWorldClick = useCallback(
    (e) => {
      const map = mapRef.current;
      const feature = e.features?.[0];
      if (!map || !feature) return;

      const admin = feature.properties.ADMIN || feature.properties.NAME;
      const iso = feature.properties.ISO_A3 || feature.properties.ADM0_A3;
      if (admin !== "Peru" && iso !== "PER") return;

      pinnedFocusRef.current = false;
      provinceFilterRef.current = null;
      departmentFilterRef.current = null;

      map.flyTo({
        center: PERU_CENTER,
        zoom: PERU_ZOOM,
        duration: 1400,
        essential: true,
      });
      afterClickNav(map);
    },
    [afterClickNav],
  );

  const handleRegionClick = useCallback(
    (e) => {
      const map = mapRef.current;
      const feature = e.features?.[0];
      if (!map || !feature) return;

      const { slug } = feature.properties;
      if (slug) {
        if (slug === "amazonas") {
          pinnedFocusRef.current = false;
          provinceFilterRef.current = null;
          departmentFilterRef.current = "AMAZONAS";
        }
        const place = placesRef.current.find((p) => p.slug === slug);
        if (place) {
          map.flyTo({
            center: [place.lng, place.lat],
            zoom: place.zoom ?? 7,
            duration: 1400,
            essential: true,
          });
          afterClickNav(map);
          return;
        }
      }

      map.fitBounds(featureBounds(feature.geometry), {
        padding: 60,
        duration: 1400,
      });
      afterClickNav(map);
    },
    [afterClickNav],
  );

  const handleProvinceClick = useCallback(
    (e) => {
      const map = mapRef.current;
      const feature = e.features?.[0];
      if (!map || !feature) return;

      const provId =
        feature.properties.province_id ||
        feature.properties.FIRST_IDPR ||
        feature.properties.IDPROV;

      if (provId && isAmazonasProvinceId(provId)) {
        pinnedFocusRef.current = false;
        provinceFilterRef.current = provId;
        departmentFilterRef.current = "AMAZONAS";
      }

      map.fitBounds(featureBounds(feature.geometry), {
        padding: 50,
        duration: 1200,
        maxZoom: isAmazonasProvinceId(provId) ? 11 : 9.5,
      });
      afterClickNav(map);
    },
    [afterClickNav],
  );

  const handleDistrictClick = useCallback(
    (e) => {
      const map = mapRef.current;
      const feature = e.features?.[0];
      if (!map || !feature) return;

      const slug =
        feature.properties.slug || getDistrictSlug(feature.properties);
      if (slug) {
        onOpenPanelRef.current?.(slug);
      }

      map.fitBounds(featureBounds(feature.geometry), {
        padding: 40,
        duration: 1000,
        maxZoom: 13,
      });
      afterClickNav(map);
    },
    [afterClickNav],
  );

  const clickNavZoomOut = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const filter = provinceFilterRef.current;
    pinnedFocusRef.current = false;

    if (filter && isAmazonasProvinceId(filter)) {
      provinceFilterRef.current = null;
      departmentFilterRef.current = "AMAZONAS";
      adminCtxCacheRef.current.districtFilter = null;
      adminCtxCacheRef.current.boundsKey = null;
      map.flyTo({
        center: AMAZONAS_CENTER,
        zoom: 7.5,
        duration: 1200,
        essential: true,
      });
    } else if (
      departmentFilterRef.current === "AMAZONAS" ||
      map.getZoom() >= ZOOM_BAND.provMin
    ) {
      provinceFilterRef.current = null;
      departmentFilterRef.current = null;
      adminCtxCacheRef.current.districtFilter = null;
      adminCtxCacheRef.current.boundsKey = null;
      map.flyTo({
        center: PERU_CENTER,
        zoom: PERU_ZOOM,
        duration: 1200,
        essential: true,
      });
    } else if (map.getZoom() >= ZOOM_BAND.deptMin) {
      provinceFilterRef.current = null;
      departmentFilterRef.current = null;
      map.flyTo({
        center: GLOBE_CENTER,
        zoom: GLOBE_ZOOM,
        duration: 1400,
        essential: true,
      });
    } else {
      map.flyTo({
        center: GLOBE_CENTER,
        zoom: GLOBE_ZOOM,
        duration: 1000,
        essential: true,
      });
    }

    afterClickNav(map);
  }, [afterClickNav]);

  const refreshDistrictSource = useCallback(
    async (map) => {
      if (!map.getSource("peru-districts")) return;
      const zoom = map.getZoom();
      const filter = provinceFilterRef.current;

      if (!isAmazonasProvinceId(filter) && zoom < DISTRICT_MIN_ZOOM) {
        return;
      }

      const boundsFilter = getDistrictBoundsFilter(map, filter);
      if (!filter && !boundsFilter) {
        return;
      }

      const boundsKey = boundsFilter
        ? `${boundsFilter[0][0].toFixed(3)},${boundsFilter[0][1].toFixed(3)},${boundsFilter[1][0].toFixed(3)},${boundsFilter[1][1].toFixed(3)}`
        : filter;
      const cache = adminCtxCacheRef.current;
      if (
        cache.districtFilter === filter &&
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
      );
    map.getSource("peru-districts").setData(data);
    syncLabelSource(map, "peru-districts-label-pts", data);
    registerDistrictGeoJSON(data);
    setDistrictInfoGeo(data);
    cache.districtFilter = filter;
      cache.boundsKey = boundsKey;
      cache.districtFeatureCount = data.features.length;
      lastDistrictGeoRef.current = data;
      await runPhotoPatterns(map, data);
    },
    [runPhotoPatterns],
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

      if (districtsReadyRef.current) {
        if (!map.getSource("peru-districts")) return;
        const zoom = map.getZoom();
        if (!isAmazonasProvinceId(filter) && zoom < DISTRICT_MIN_ZOOM) return;
        await refreshDistrictSource(map);
        return;
      }
      if (!force && map.getZoom() < DISTRICT_MIN_ZOOM - 0.5) return;
      try {
        const raw = await loadDistrictGeoJSON(filter);
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
    applyProvinceFocusMode(map, provinceFilterRef.current);
  }, []);

  const updateDistrictData = useCallback(
    async (map) => {
      await refreshDistrictSource(map);
    },
    [refreshDistrictSource],
  );

  const refreshAdminContext = useCallback(
    async (map) => {
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
        syncAdminLevelVisibility(map, provinceFilterRef.current);
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

  useEffect(() => {
    if (mapNavRef) {
      mapNavRef.current = { zoomOut: clickNavZoomOut };
    }
  }, [clickNavZoomOut, mapNavRef]);

  const syncLayers = useCallback(
    (map) => {
      addWorldCountryLayers(map, handleWorldClick);
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
      applyProvinceFocusMode(map, provinceFilterRef.current);
    },
    [
      handleWorldClick,
      handleRegionClick,
      handleProvinceClick,
      ensureDistrictLayers,
    ],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: GLOBE_CENTER,
      zoom: GLOBE_ZOOM,
      pitch: 0,
      bearing: 0,
      projection: "globe",
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.GlobeControl(), "top-right");

    map.on("load", async () => {
      applyGlobeAtmosphere(map);
      syncLayers(map);
      await ensureDistrictLayers(map);
      syncAdminLevelVisibility(map, provinceFilterRef.current);
      syncProjection(map, provinceFilterRef.current);
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
      syncProjection(map, provinceFilterRef.current);
      const zoom = map.getZoom();
      const focus = Boolean(provinceFilterRef.current);
      const band = focus
        ? zoom >= PROVINCE_FOCUS_MIN_ZOOM
          ? "focus-dist"
          : "focus-wait"
        : zoom < ZOOM_BAND.deptMax
          ? "dept"
          : zoom < ZOOM_BAND.provMax
            ? "prov"
            : "dist";
      if (adminCtxCacheRef.current.zoomBand !== band) {
        adminCtxCacheRef.current.zoomBand = band;
        syncAdminLevelVisibility(map, provinceFilterRef.current);
      }
    });

    map.on("moveend", () => {
      clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        scheduleAdminRefresh(map);
      }, 200);
    });

    map.on("zoomend", () => {
      syncProjection(map, provinceFilterRef.current);
      syncAdminLevelVisibility(map, provinceFilterRef.current);
      scheduleAdminRefresh(map);
    });

    mapRef.current = map;

    return () => {
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [syncLayers, ensureDistrictLayers, refreshAdminContext]);

  useEffect(() => {
    const grouped = groupEntriesBySlug(entries);
    const regionsGeoJSON = enrichPeruDepartments(
      getRawPeruDepartments(),
      places,
      grouped,
    );
    const provincesGeoJSON = enrichPeruProvinces(
      getActiveProvincesGeoJSON(),
      places,
      grouped,
      provinceFilterRef.current,
      departmentFilterRef.current,
    );
    setInfoTargets(
      buildMapInfoTargets(
        places,
        regionsGeoJSON,
        provincesGeoJSON,
        districtInfoGeo,
      ),
    );
  }, [places, entries, districtInfoGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncLayers(map);
    runPhotoPatterns(map);
  }, [places, entries, syncLayers, runPhotoPatterns]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPlace) return;

    const fly = async () => {
      const isPinned = Boolean(focusPlace.province_id);
      pinnedFocusRef.current = isPinned;
      provinceFilterRef.current = focusPlace.province_id || null;
      if (isPinned && isAmazonasProvinceId(focusPlace.province_id)) {
        departmentFilterRef.current = "AMAZONAS";
      } else {
        departmentFilterRef.current = null;
      }

      adminCtxCacheRef.current.districtFilter = null;
      adminCtxCacheRef.current.boundsKey = null;
      adminCtxCacheRef.current.zoomBand = null;

      await ensureDetailedProvinces(map);
      updateProvinceData(map);
      await ensureDistrictLayers(map, Boolean(focusPlace.province_id));
      await updateDistrictData(map);
      await runPhotoPatterns(map);

      applyProvinceFocusMode(map, provinceFilterRef.current);
      syncProjection(map, provinceFilterRef.current);

      if (focusPlace.province_id) {
        const box = getProvinceBounds(focusPlace.province_id);
        if (box) {
          map.fitBounds(box, {
            padding: 48,
            minZoom: PROVINCE_FOCUS_MIN_ZOOM,
            maxZoom: 11,
            duration: 1600,
          });
          return;
        }
      }

      map.flyTo({
        center: [focusPlace.lng, focusPlace.lat],
        zoom: focusPlace.zoom ?? PERU_ZOOM,
        duration: 1600,
        essential: true,
      });
    };

    if (map.isStyleLoaded()) fly();
    else map.once("load", fly);
  }, [
    focusPlace,
    ensureDistrictLayers,
    updateDistrictData,
    updateProvinceData,
    ensureDetailedProvinces,
    runPhotoPatterns,
  ]);

  return (
    <div className="globe-map-wrap">
      <div ref={containerRef} className="globe-map" aria-label="Mapa" />
      {mapReady && mapRef.current && (
        <MapInfoOverlay
          map={mapRef.current}
          targets={infoTargets}
          onOpenPanel={(slug) => onOpenPanelRef.current?.(slug)}
        />
      )}
    </div>
  );
}
