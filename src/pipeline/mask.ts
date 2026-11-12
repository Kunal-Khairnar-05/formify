import type { FaceGeometry, Point } from './types'

/** Push faint mask values to 0 and strong ones to 1, with a smooth ramp between. */
export function sharpenMask(mask: Float32Array, low = 0.4, high = 0.8): Float32Array {
  const out = new Float32Array(mask.length)
  for (let i = 0; i < mask.length; i++) {
    // where the value sits between low and high, clamped to 0..1
    const t = Math.min(1, Math.max(0, (mask[i] - low) / (high - low)))
    // smoothstep: an S-curve, so edges stay soft instead of turning jagged
    out[i] = t * t * (3 - 2 * t)
  }
  return out
}

/** Keep only the mask region connected to `seed`; everything else becomes 0. */
export function keepConnected(
  mask: Float32Array,
  width: number,
  height: number,
  seed: Point,
): Float32Array {
  const start = Math.round(seed.y) * width + Math.round(seed.x)
  // a seed on the background means we cannot tell which region is the person
  if (!(mask[start] > 0)) return mask

  // flood fill from the seed over 4-connected neighbours
  const keep = new Uint8Array(mask.length)
  const stack = [start]
  keep[start] = 1
  while (stack.length > 0) {
    const p = stack.pop()!
    const x = p % width
    const y = (p - x) / width
    const neighbours = [
      x > 0 ? p - 1 : -1,
      x < width - 1 ? p + 1 : -1,
      y > 0 ? p - width : -1,
      y < height - 1 ? p + width : -1,
    ]
    for (const q of neighbours) {
      if (q >= 0 && keep[q] === 0 && mask[q] > 0) {
        keep[q] = 1
        stack.push(q)
      }
    }
  }

  const out = new Float32Array(mask.length)
  for (let i = 0; i < mask.length; i++) if (keep[i] === 1) out[i] = mask[i]
  return out
}

/** Highest row above the face where the mask says "person": the real top of the hair. */
export function hairTop(mask: Float32Array, width: number, face: FaceGeometry): number {
  const crownRow = Math.round(face.crown.y)
  const firstCol = Math.round(face.box.x)
  const lastCol = Math.round(face.box.x + face.box.width)

  for (let y = 0; y < crownRow; y++) {
    for (let x = firstCol; x < lastCol; x++) {
      if (mask[y * width + x] > 0.5) return y
    }
  }
  // nothing above the mesh-based estimate: keep it
  return crownRow
}