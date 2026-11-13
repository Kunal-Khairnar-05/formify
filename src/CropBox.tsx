import { useRef, type PointerEvent } from 'react'
import { dragRegion, type Handle, type Region } from './crop/region'

const CORNERS: { handle: Handle; className: string }[] = [
  { handle: 'nw', className: '-left-2 -top-2 cursor-nwse-resize' },
  { handle: 'ne', className: '-right-2 -top-2 cursor-nesw-resize' },
  { handle: 'sw', className: '-bottom-2 -left-2 cursor-nesw-resize' },
  { handle: 'se', className: '-bottom-2 -right-2 cursor-nwse-resize' },
]

interface Props {
  /** URL of the photo to show. */
  src: string
  region: Region
  /** Shape to hold the region to (see fractionAspect); free-form when left out. */
  aspect?: number
  onChange: (region: Region) => void
  /** Called with the photo's own pixel size once it has loaded. */
  onSize: (width: number, height: number) => void
}

/** The photo with a crop rectangle that can be moved and resized by its corners. */
export function CropBox({ src, region, aspect, onChange, onSize }: Props) {
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Region } | null>(null)

  const begin = (handle: Handle) => (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    // capture, so the drag continues when the pointer leaves the handle
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { handle, x: event.clientX, y: event.clientY, start: region }
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    const bounds = frame.current?.getBoundingClientRect()
    if (!current || !bounds) return
    const dx = (event.clientX - current.x) / bounds.width
    const dy = (event.clientY - current.y) / bounds.height
    onChange(dragRegion(current.start, current.handle, dx, dy, aspect))
  }

  const end = () => {
    drag.current = null
  }

  const pointer = (handle: Handle) => ({
    onPointerDown: begin(handle),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  })

  return (
    <div ref={frame} className="relative mt-3 touch-none overflow-hidden select-none">
      <img
        id="crop-photo"
        src={src}
        alt="Your photo"
        className="block h-auto w-full"
        draggable={false}
        onLoad={(event) => onSize(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
      />
      <div
        id="crop-region"
        className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
        style={{
          left: `${region.x * 100}%`,
          top: `${region.y * 100}%`,
          width: `${region.width * 100}%`,
          height: `${region.height * 100}%`,
        }}
        {...pointer('move')}
      >
        {CORNERS.map(({ handle, className }) => (
          <div
            key={handle}
            id={`crop-${handle}`}
            className={`absolute h-6 w-6 rounded-full border-2 border-neutral-800 bg-white ${className}`}
            {...pointer(handle)}
          />
        ))}
      </div>
    </div>
  )
}
