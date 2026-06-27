import { useEffect, useState } from 'react'

export default function MapInfoOverlay({ map, targets, onOpenPanel }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!map || !targets?.length) {
      setItems([])
      return
    }

    const update = () => {
      const zoom = map.getZoom()
      const { width, height } = map.getCanvas()

      const next = targets
        .filter((t) => zoom >= t.minZoom && zoom <= t.maxZoom)
        .map((t) => {
          const point = map.project([t.lng, t.lat])
          return {
            ...t,
            x: point.x + (t.offsetX ?? 36),
            y: point.y + (t.offsetY ?? 0),
          }
        })
        .filter(
          (t) => t.x >= -12 && t.y >= -12 && t.x <= width + 12 && t.y <= height + 12
        )

      setItems(next)
    }

    update()
    map.on('move', update)
    map.on('zoom', update)
    map.on('resize', update)

    return () => {
      map.off('move', update)
      map.off('zoom', update)
      map.off('resize', update)
    }
  }, [map, targets, onOpenPanel])

  if (!items.length) return null

  return (
    <div className="map-info-overlay" aria-hidden={false}>
      {items.map((item) => (
        <button
          key={item.slug}
          type="button"
          className="map-info-btn"
          style={{ left: item.x, top: item.y }}
          onClick={(e) => {
            e.stopPropagation()
            onOpenPanel(item.slug)
          }}
          aria-label={`Información: ${item.name}`}
          title={`Info — ${item.name}`}
        >
          i
        </button>
      ))}
    </div>
  )
}
