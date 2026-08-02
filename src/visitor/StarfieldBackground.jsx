import { useMemo } from 'react'

function makeStars(count = 160) {
  const stars = []
  for (let i = 0; i < count; i++) {
    const bright = Math.random() > 0.88
    const mid = !bright && Math.random() > 0.65
    stars.push({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: bright ? 2.8 + Math.random() * 1.4 : mid ? 1.8 + Math.random() * 0.6 : 1.1 + Math.random() * 0.5,
      delay: `${Math.random() * 6}s`,
      duration: `${1.6 + Math.random() * 3.2}s`,
      bright,
      mid,
    })
  }
  return stars
}

export default function StarfieldBackground() {
  const stars = useMemo(() => makeStars(), [])

  return (
    <div className="visitor-starfield" aria-hidden="true">
      <div className="visitor-starfield__nebula" />
      {stars.map((s) => (
        <span
          key={s.id}
          className={[
            'visitor-starfield__star',
            s.bright ? 'visitor-starfield__star--bright' : '',
            s.mid ? 'visitor-starfield__star--mid' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  )
}
