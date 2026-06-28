/**
 * Combina 1–4 URLs de foto en una sola imagen para fill-pattern de MapLibre.
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

export async function buildCollageImageData(urls, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#2a3038'
  ctx.fillRect(0, 0, size, size)

  const list = urls.slice(0, 4)
  if (!list.length) return ctx.getImageData(0, 0, size, size)

  const images = await Promise.all(list.map((url) => loadImage(url).catch(() => null)))
  const cols = list.length <= 1 ? 1 : 2
  const rows = list.length <= 2 ? 1 : 2
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
