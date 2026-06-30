import rawPeruDepartments from './peru-departments.json'

/** NOMBDEP INEI → slug estable (24 departamentos + Callao) */
export const DEPARTMENT_TO_SLUG = {
  AMAZONAS: 'amazonas',
  ANCASH: 'ancash',
  APURIMAC: 'apurimac',
  AREQUIPA: 'arequipa',
  AYACUCHO: 'ayacucho',
  CAJAMARCA: 'cajamarca',
  CALLAO: 'callao',
  CUSCO: 'cusco',
  HUANCAVELICA: 'huancavelica',
  HUANUCO: 'huanuco',
  ICA: 'ica',
  JUNIN: 'junin',
  'LA LIBERTAD': 'la-libertad',
  LAMBAYEQUE: 'lambayeque',
  LIMA: 'lima',
  LORETO: 'loreto',
  'MADRE DE DIOS': 'madre-de-dios',
  MOQUEGUA: 'moquegua',
  PASCO: 'pasco',
  PIURA: 'piura',
  PUNO: 'puno',
  'SAN MARTIN': 'san-martin',
  TACNA: 'tacna',
  TUMBES: 'tumbes',
  UCAYALI: 'ucayali',
}

const SLUG_TO_DEPARTMENT = Object.fromEntries(
  Object.entries(DEPARTMENT_TO_SLUG).map(([name, slug]) => [slug, name]),
)

const departmentPlaceBySlug = new Map()

function formatDepartmentName(nombdep) {
  const lower = nombdep.toLowerCase()
  const small = new Set(['de', 'del', 'la', 'las', 'y'])
  return lower
    .split(' ')
    .map((word, i) =>
      i > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
}

function departmentFromProperties(props = {}) {
  const nombdep = props.NOMBDEP || props.FIRST_NOMB || props.name
  if (!nombdep) return null

  const slug = DEPARTMENT_TO_SLUG[nombdep.toUpperCase()]
  if (!slug) return null

  return {
    slug,
    name: formatDepartmentName(nombdep),
    parent_slug: 'peru',
    level: 'region',
    department_code: props.FIRST_IDDP ?? props.IDDEP ?? null,
    sort_order: parseInt(props.FIRST_IDDP ?? '99', 10),
  }
}

function registerDepartments() {
  departmentPlaceBySlug.clear()
  const list = []
  for (const feature of rawPeruDepartments.features ?? []) {
    const place = departmentFromProperties(feature.properties)
    if (!place) continue
    departmentPlaceBySlug.set(place.slug, place)
    list.push(place)
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Catálogo de los 24 departamentos (sin Callao) para filtros de región */
export function getAllDepartmentPlaces() {
  if (!departmentPlaceBySlug.size) registerDepartments()
  return [...departmentPlaceBySlug.values()].filter((d) => d.slug !== 'callao')
}

export function getDepartmentPlace(slug) {
  if (!departmentPlaceBySlug.size) registerDepartments()
  return departmentPlaceBySlug.get(slug) ?? null
}

export function departmentToSlug(name) {
  return DEPARTMENT_TO_SLUG[name?.toUpperCase?.()] ?? null
}

export function slugToDepartmentName(slug) {
  const key = SLUG_TO_DEPARTMENT[slug]
  return key ? formatDepartmentName(key) : null
}

registerDepartments()
