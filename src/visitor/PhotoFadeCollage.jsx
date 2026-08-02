import { useMemo } from 'react'
import { buildCollageItems, pickCollagePhotoUrls } from '../lib/visitorPhotos'

export default function PhotoFadeCollage({ entries }) {
  const items = useMemo(() => {
    const urls = pickCollagePhotoUrls(entries)
    return buildCollageItems(urls)
  }, [entries])

  if (!items.length) return null

  return (
    <div className="visitor-collage" aria-hidden="true">
      {items.map(({ url, slot }, i) => (
        <img
          key={`${url}-${i}`}
          className="visitor-collage__photo"
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            top: slot.top,
            left: slot.left,
            right: slot.right,
            bottom: slot.bottom,
            width: slot.width,
            transform: `rotate(${slot.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}
