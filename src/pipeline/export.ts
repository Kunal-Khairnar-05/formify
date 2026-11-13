import { exportJpeg, minTarget, type Exported } from './exportJpeg'
import { encodePng, padPng } from './png'
import type { Spec } from './types'
import { measure, validate } from './validate'

/**
 * PNG keeps every pixel exactly, so there is no quality to lower: the file is the size it
 * is. It can only be made larger, by padding, to reach a minimum.
 */
async function exportPng(pixels: ImageData, spec: Spec): Promise<Exported | null> {
  const { minKb, maxKb } = spec
  let bytes = await encodePng(pixels)
  // counting 1 KB as 1000 bytes, the stricter reading of a maximum
  if (maxKb !== undefined && bytes.length > maxKb * 1000) return null

  let paddedBytes = 0
  if (minKb !== undefined) {
    const padded = padPng(bytes, minTarget(minKb, maxKb))
    paddedBytes = padded.length - bytes.length
    bytes = padded
  }
  // 100: nothing is lost
  return { bytes, quality: 100, paddedBytes, measured: measure(bytes), problems: validate(bytes, spec) }
}

/** Step 8: store the picture in the format the form asks for, within its size limits. */
export function exportImage(pixels: ImageData, spec: Spec): Promise<Exported | null> {
  // an SVG is drawn from the outline of the ink, not from pixels: see exportSvg
  if (spec.format === 'svg') return Promise.resolve(null)
  return spec.format === 'png' ? exportPng(pixels, spec) : exportJpeg(pixels, spec)
}

/** Finish an SVG that has already been drawn: pad it to a minimum and measure it. */
export function exportSvg(svg: Uint8Array, spec: Spec, pad: (bytes: Uint8Array, size: number) => Uint8Array): Exported {
  let bytes = svg
  let paddedBytes = 0
  if (spec.minKb !== undefined) {
    const padded = pad(bytes, minTarget(spec.minKb, spec.maxKb))
    paddedBytes = padded.length - bytes.length
    bytes = padded
  }
  return { bytes, quality: 100, paddedBytes, measured: measure(bytes), problems: validate(bytes, spec) }
}

export type { Exported }
