/**
 * Combina N URLs de foto en una cuadrícula para fill-pattern de MapLibre.
 */
export async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar: ${url}`))
    img.src = url
  })
}

function gridForCount(count) {
  if (count <= 1) return { cols: 1, rows: 1 }
  if (count <= 4) return { cols: 2, rows: 2 }
  if (count <= 6) return { cols: 3, rows: 2 }
  if (count <= 9) return { cols: 3, rows: 3 }
  if (count <= 12) return { cols: 4, rows: 3 }
  const cols = 4
  return { cols, rows: Math.ceil(count / cols) }
}

export async function buildCollageImageData(urls, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#2a3038'
  ctx.fillRect(0, 0, size, size)

  const list = urls.filter(Boolean)
  if (!list.length) return ctx.getImageData(0, 0, size, size)

  const { cols, rows } = gridForCount(list.length)
  const images = await Promise.all(
    list.map((url) => loadImage(url).catch(() => null)),
  )
  const cellW = size / cols
  const cellH = size / rows

  images.forEach((img, i) => {
    if (!img) return
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * cellW
    const y = row * cellH
    const scale = Math.max(cellW / img.width, cellH / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, x + (cellW - w) / 2, y + (cellH - h) / 2, w, h)
  })

  return ctx.getImageData(0, 0, size, size)
}
