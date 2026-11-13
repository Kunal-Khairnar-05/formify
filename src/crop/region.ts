import type { Rect } from '../pipeline/types'

/** A crop rectangle as fractions of the photo, 0 to 1, so it does not depend on display size. */
export type Region = Rect

export type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

export const FULL: Region = { x: 0, y: 0, width: 1, height: 1 }

// the crop cannot be made smaller than this fraction of the photo on either side
const MIN_SIZE = 0.1

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function isFull(region: Region): boolean {
  return region.x === 0 && region.y === 0 && region.width === 1 && region.height === 1
}

/**
 * Where the region ends up after dragging `handle` by (dx, dy), both fractions of the photo.
 * `start` is the region when the drag began, so the result never drifts.
 */
export function dragRegion(start: Region, handle: Handle, dx: number, dy: number): Region {
  if (handle === 'move') {
    return {
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    }
  }

  let left = start.x
  let top = start.y
  let right = start.x + start.width
  let bottom = start.y + start.height

  if (handle === 'nw' || handle === 'sw') left = clamp(left + dx, 0, right - MIN_SIZE)
  else right = clamp(right + dx, left + MIN_SIZE, 1)

  if (handle === 'nw' || handle === 'ne') top = clamp(top + dy, 0, bottom - MIN_SIZE)
  else bottom = clamp(bottom + dy, top + MIN_SIZE, 1)

  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** The region in whole pixels of a photo, always inside it and at least 1 px on each side. */
export function regionToPixels(region: Region, width: number, height: number): Rect {
  const x = clamp(Math.round(region.x * width), 0, width - 1)
  const y = clamp(Math.round(region.y * height), 0, height - 1)
  return {
    x,
    y,
    width: clamp(Math.round(region.width * width), 1, width - x),
    height: clamp(Math.round(region.height * height), 1, height - y),
  }
}
