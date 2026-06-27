import fs from 'fs'

function fixGeojsonLines(inputPath, outputPath) {
  const raw = fs.readFileSync(inputPath, 'utf8')
  const lines = raw.trim().split(/\r?\n/)
  const features = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (i === 0) {
      const marker = '"features":['
      const idx = line.indexOf(marker)
      line = line.slice(idx + marker.length)
    }
    if (i === lines.length - 1) {
      line = line.replace(/\]\}\s*$/, '')
    }
    line = line.replace(/,\s*$/, '')
    features.push(JSON.parse(line))
  }

  const out = { type: 'FeatureCollection', features }
  fs.writeFileSync(outputPath, JSON.stringify(out))
  return features.length
}

const count = fixGeojsonLines(
  new URL('../public/data/peru-districts-raw.geojson', import.meta.url),
  new URL('../public/data/peru-districts.json', import.meta.url)
)

console.log(`Distritos (ciudades): ${count}`)
