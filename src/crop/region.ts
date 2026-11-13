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
 * The shape to hold a region to, in the region's own units: fraction of the photo's width
 * over fraction of its height. A 3:4 output on a 4:3 photo gives (3/4) / (4/3).
 */
export function fractionAspect(outputRatio: number, photoWidth: number, photoHeight: number): number {
  return (outputRatio * photoHeight) / photoWidth
}

/** The largest region of the given shape that fits in the photo, centred. */
export function fitRegion(aspect: number): Region {
  const width = Math.min(1, aspect)
  const height = width / aspect
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height }
}

/** A corner drag that keeps the region's shape: the opposite corner stays where it is. */
function resizeLocked(start: Region, handle: Handle, dx: number, dy: number, aspect: number): Region {
  const west = handle === 'nw' || handle === 'sw'
  const north = handle === 'nw' || handle === 'ne'
  const anchorX = west ? start.x + start.width : start.x
  const anchorY = north ? start.y + start.height : start.y
  const roomX = west ? anchorX : 1 - anchorX
  const roomY = north ? anchorY : 1 - anchorY

  // follow whichever direction the pointer has gone further in
  const byWidth = start.width + (west ? -dx : dx)
  const byHeight = (start.height + (north ? -dy : dy)) * aspect
  const largest = Math.min(roomX, roomY * aspect)
  const smallest = Math.min(largest, Math.max(MIN_SIZE, MIN_SIZE * aspect))
  const width = clamp(Math.max(byWidth, byHeight), smallest, largest)
  const height = width / aspect

  return {
    x: west ? anchorX - width : anchorX,
    y: north ? anchorY - height : anchorY,
    width,
    height,
  }
}

/**
 * Where the region ends up after dragging `handle` by (dx, dy), both fractions of the photo.
 * `start` is the region when the drag began, so the result never drifts.
 * With `aspect` (see fractionAspect) a resize keeps that shape.
 */
export function dragRegion(
  start: Region,
  handle: Handle,
  dx: number,
  dy: number,
  aspect?: number,
): Region {
  if (handle === 'move') {
    return {
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    }
  }

  if (aspect !== undefined) return resizeLocked(start, handle, dx, dy, aspect)

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
