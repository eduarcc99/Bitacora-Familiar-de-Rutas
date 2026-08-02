import { EMPTY_FILTER } from "./placeCatalog";
import { filterKey } from "./mapNavigation";

export function filtersEqual(a, b) {
  return filterKey(a ?? EMPTY_FILTER) === filterKey(b ?? EMPTY_FILTER);
}

/** Un nivel hacia arriba: distrito → prov → depto → país → globo */
export function getParentFilter(filter = EMPTY_FILTER) {
  if (filter?.district) {
    return { ...filter, district: null };
  }
  if (filter?.province) {
    return { ...filter, province: null };
  }
  if (filter?.region) {
    return { ...filter, region: null };
  }
  if (filter?.country) {
    return { ...EMPTY_FILTER };
  }
  return { ...EMPTY_FILTER };
}

export function createVisitorNavHistory(initialFilter = EMPTY_FILTER) {
  return {
    stack: [{ ...initialFilter }],
    index: 0,
  };
}

export function pushVisitorNavHistory(history, nextFilter) {
  const next = { ...nextFilter };
  const current = history.stack[history.index];
  if (filtersEqual(current, next)) {
    return history;
  }

  const stack = history.stack.slice(0, history.index + 1);
  stack.push(next);
  return { stack, index: stack.length - 1 };
}

export function goBackInVisitorHistory(history) {
  if (history.index <= 0) return history;
  return { ...history, index: history.index - 1 };
}

export function goForwardInVisitorHistory(history) {
  if (history.index >= history.stack.length - 1) return history;
  return { ...history, index: history.index + 1 };
}

export function getCurrentVisitorFilter(history) {
  return history.stack[history.index] ?? { ...EMPTY_FILTER };
}
