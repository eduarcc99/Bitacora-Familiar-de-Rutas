import { getPhotoPublicUrl } from './supabase'

const COLLAGE_COUNT = 4

/** Posiciones fijas para 4 fotos desvanecidas (estables por carga) */
const COLLAGE_SLOTS = [
  { top: '8%', left: '5%', width: '42%', rotate: -4 },
  { top: '12%', right: '4%', width: '38%', rotate: 3 },
  { bottom: '18%', left: '8%', width: '36%', rotate: 2 },
  { bottom: '10%', right: '6%', width: '40%', rotate: -2 },
]

function shuffle(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function pickCollagePhotoUrls(entries, count = COLLAGE_COUNT) {
  const urls = (entries ?? [])
    .filter((e) => e.photo_path && e.status === 'visited')
    .map((e) => getPhotoPublicUrl(e.photo_path))
    .filter(Boolean)

  const unique = [...new Set(urls)]
  if (!unique.length) return []

  return shuffle(unique).slice(0, Math.min(count, unique.length))
}

export function buildCollageItems(urls) {
  return urls.map((url, i) => ({
    url,
    slot: COLLAGE_SLOTS[i % COLLAGE_SLOTS.length],
  }))
}

export { COLLAGE_COUNT }
