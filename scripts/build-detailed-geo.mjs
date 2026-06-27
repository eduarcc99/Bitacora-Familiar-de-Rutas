import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function normalizeProvince(feature) {
  const p = feature.properties
  return {
    ...feature,
    properties: {
      ...p,
      FIRST_IDPR: p.IDPROV ?? p.FIRST_IDPR,
      NOMBPROV: p.NOMBPROV,
      FIRST_NOMB: p.NOMBDEP ?? p.FIRST_NOMB,
    },
  }
}

function normalizeDistrict(feature) {
  const p = feature.properties
  return {
    ...feature,
    properties: {
      ...p,
      IDDIST: p.IDDIST,
      IDPROV: p.IDPROV,
      NOMBDIST: p.NOMBDIST,
      NOMBPROV: p.NOMBPROV,
      NOMBDEP: p.NOMBDEP,
    },
  }
}

const provRaw = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/peru-provinces-detailed-temp.json'), 'utf8')
)
const distRaw = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/peru-districts-detailed-temp.json'), 'utf8')
)

const provinces = {
  type: 'FeatureCollection',
  features: provRaw.features.map(normalizeProvince),
}

const amazonasDistricts = {
  type: 'FeatureCollection',
  features: distRaw.features
    .filter((f) => f.properties.NOMBDEP === 'AMAZONAS')
    .map(normalizeDistrict),
}

const chachapoyas = {
  type: 'FeatureCollection',
  features: amazonasDistricts.features.filter((f) => f.properties.IDPROV === '0101'),
}

fs.writeFileSync(
  path.join(root, 'public/data/peru-provinces-detailed.json'),
  JSON.stringify(provinces)
)
fs.writeFileSync(
  path.join(root, 'public/data/amazonas-districts.json'),
  JSON.stringify(amazonasDistricts)
)
fs.writeFileSync(
  path.join(root, 'public/data/chachapoyas-districts.json'),
  JSON.stringify(chachapoyas)
)

const byProv = {}
for (const f of amazonasDistricts.features) {
  byProv[f.properties.IDPROV] = (byProv[f.properties.IDPROV] ?? 0) + 1
}

console.log(`Provincias detalladas: ${provinces.features.length}`)
console.log(`Distritos Amazonas: ${amazonasDistricts.features.length}`)
console.log('Por provincia:', byProv)
