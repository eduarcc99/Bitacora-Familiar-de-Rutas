import { buildCollageImageData } from './photoCollage'

const patternCache = new Map()

export async function syncGeoJSONPhotoPatterns(map, geojson, sourceId, layerIds) {
  if (!map?.getSource(sourceId) || !geojson?.features) return geojson

  for (const feature of geojson.features) {
    feature.properties.pattern_id = ''
    if (!feature.properties.photo_urls) continue

    let urls = []
    try {
      urls = JSON.parse(feature.properties.photo_urls)
    } catch {
      continue
    }
    if (!urls.length) continue

    const patternId = `pat-${sourceId}-${feature.id}`
    feature.properties.pattern_id = patternId

    if (map.hasImage(patternId)) continue

    try {
      let imageData = patternCache.get(patternId)
      if (!imageData) {
        imageData = await buildCollageImageData(urls)
        patternCache.set(patternId, imageData)
      }
      if (!map.hasImage(patternId)) {
        map.addImage(patternId, imageData, { pixelRatio: 1 })
      }
    } catch (err) {
      console.warn('No se pudo crear patrón de foto:', patternId, err.message)
      feature.properties.pattern_id = ''
    }
  }

  map.getSource(sourceId).setData(geojson)

  const patternExpr = [
    'case',
    ['!=', ['get', 'pattern_id'], ''],
    ['get', 'pattern_id'],
    '',
  ]

  for (const layerId of layerIds) {
    if (!map.getLayer(layerId)) continue
    map.setPaintProperty(layerId, 'fill-pattern', patternExpr)
  }

  return geojson
}

export function clearPatternCache() {
  patternCache.clear()
}
