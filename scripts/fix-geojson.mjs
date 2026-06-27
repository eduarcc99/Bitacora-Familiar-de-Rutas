import fs from 'fs'

const inputPath = new URL('../public/data/peru-departments.geojson', import.meta.url)
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
const json = JSON.stringify(out)

fs.writeFileSync(new URL('./peru-departments.geojson', import.meta.url), json)
fs.writeFileSync(inputPath, json)
console.log(`Fixed ${features.length} department features`)
