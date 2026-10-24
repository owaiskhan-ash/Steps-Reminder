import { useEffect, useRef, useState } from 'react'

type Props = {
  inset?: number
  radius?: number
  dash?: string
  width?: number
  opacity?: number
  color?: string
  /** Draws a second, finer line just inside — like a double saddle stitch. */
  double?: boolean
}

/**
 * Saddle-stitch seam drawn as a real SVG path so the dashes stay even on every
 * card size. A ResizeObserver keeps it in pixel space (no stretched threads).
 */
export function Stitch({
  inset = 6,
  radius = 16,
  dash = '6 6',
  width = 1.4,
  opacity = 0.5,
  color = 'var(--thread)',
  double = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setSize({ w: box.width, h: box.height })
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size

  return (
    <div className="stitch" ref={ref} aria-hidden="true">
      {w > 0 && h > 0 && (
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
          <rect
            x={inset}
            y={inset}
            width={Math.max(0, w - inset * 2)}
            height={Math.max(0, h - inset * 2)}
            rx={radius}
            fill="none"
            stroke={color}
            strokeOpacity={opacity}
            strokeWidth={width}
            strokeDasharray={dash}
            strokeLinecap="round"
          />
          {double && (
            <rect
              x={inset + 4.5}
              y={inset + 4.5}
              width={Math.max(0, w - (inset + 4.5) * 2)}
              height={Math.max(0, h - (inset + 4.5) * 2)}
              rx={Math.max(2, radius - 4)}
              fill="none"
              stroke={color}
              strokeOpacity={opacity * 0.5}
              strokeWidth={width * 0.8}
              strokeDasharray="3 7"
              strokeLinecap="round"
            />
          )}
        </svg>
      )}
    </div>
  )
}
