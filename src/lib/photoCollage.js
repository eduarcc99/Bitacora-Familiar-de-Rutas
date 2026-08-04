/**
 * Collage fijo 2×2 para fill-pattern de MapLibre.
 * Así el mosaico se lee igual con 1 o muchas fotos (el tile no es una sola foto gigante).
 */

export const MAP_COLLAGE_COLS = 2
export const MAP_COLLAGE_ROWS = 2
export const MAP_COLLAGE_SLOTS = MAP_COLLAGE_COLS * MAP_COLLAGE_ROWS

export async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar: ${url}`))
    img.src = url
  })
}

/** Hasta 4 URLs; si hay menos, se ciclan para llenar el 2×2. */
export function urlsForMapCollage(urls) {
  const list = [...new Set((urls ?? []).filter(Boolean))]
  if (!list.length) return []

  const taken = list.slice(0, MAP_COLLAGE_SLOTS)
  const slots = []
  for (let i = 0; i < MAP_COLLAGE_SLOTS; i++) {
    slots.push(taken[i % taken.length])
  }
  return slots
}

function drawCoverInCell(ctx, img, x, y, cellW, cellH, pad = 1.5) {
  const left = x + pad
  const top = y + pad
  const iw = cellW - pad * 2
  const ih = cellH - pad * 2
  if (iw <= 0 || ih <= 0) return

  // Cover centrado: llena la celda sin dejar huecos
  const scale = Math.max(iw / img.width, ih / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(left, top, iw, ih)
  ctx.clip()
  ctx.drawImage(img, left + (iw - w) / 2, top + (ih - h) / 2, w, h)
  ctx.restore()
}

/**
 * Genera ImageData 2×2. Siempre 4 celdas para que el patrón tileado
 * se vea como mosaico a cualquier zoom (no una sola foto a pantalla completa).
 */
export async function buildCollageImageData(urls, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1a1f28'
  ctx.fillRect(0, 0, size, size)

  const slots = urlsForMapCollage(urls)
  if (!slots.length) return ctx.getImageData(0, 0, size, size)

  const uniqueToLoad = [...new Set(slots)]
  const loaded = await Promise.all(
    uniqueToLoad.map(async (url) => {
      const img = await loadImage(url).catch(() => null)
      return [url, img]
    }),
  )
  const byUrl = new Map(loaded)

  const cellW = size / MAP_COLLAGE_COLS
  const cellH = size / MAP_COLLAGE_ROWS

  slots.forEach((url, i) => {
    const img = byUrl.get(url)
    if (!img) return
    const col = i % MAP_COLLAGE_COLS
    const row = Math.floor(i / MAP_COLLAGE_COLS)
    drawCoverInCell(ctx, img, col * cellW, row * cellH, cellW, cellH)
  })

  // Separadores sutiles entre celdas (mosaico más claro)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cellW, 0)
  ctx.lineTo(cellW, size)
  ctx.moveTo(0, cellH)
  ctx.lineTo(size, cellH)
  ctx.stroke()

  return ctx.getImageData(0, 0, size, size)
}
