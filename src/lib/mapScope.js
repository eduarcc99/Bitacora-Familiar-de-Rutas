/** Fase 1 del mapa visitante: solo provincia de Chachapoyas (ciudad + distritos) */
export const MAP_SCOPE_CHACHAPOYAS = "chachapoyas";

/** EYL 2.0 — visitante: globo, Perú completo, UI limpia */
export const MAP_SCOPE_VISITOR_V2 = "visitor-v2";

export const CHACHAPOYAS_PROVINCE_SLUG = "chachapoyas";
export const CHACHAPOYAS_PROVINCE_ID = "0101";

export const CHACHAPOYAS_CENTER = [-77.8515, -6.2491];
export const CHACHAPOYAS_ZOOM = 10.5;

/** Filtro inicial del mapa visitante 1.0 */
export const VISITOR_INITIAL_FILTER = {
  country: "peru",
  region: "amazonas",
  province: CHACHAPOYAS_PROVINCE_SLUG,
  district: null,
};

export function isChachapoyasScope(scope) {
  return scope === MAP_SCOPE_CHACHAPOYAS;
}

export function isVisitorV2Scope(scope) {
  return scope === MAP_SCOPE_VISITOR_V2;
}

/** Mantiene el filtro dentro de Chachapoyas (fase 1) */
export function clampFilterToChachapoyas(filter) {
  return {
    country: "peru",
    region: "amazonas",
    province: CHACHAPOYAS_PROVINCE_SLUG,
    district: filter?.district ?? null,
  };
}
