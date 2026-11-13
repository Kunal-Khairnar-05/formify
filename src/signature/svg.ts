import { boxBlur } from '../pipeline/edge'
import type { Rect, Spec } from '../pipeline/types'
import { area, outlines, pathData, simplify, type Point } from './trace'

// outlines enclosing less than this many square pixels of the photo are specks
const MIN_AREA = 3
// How far, in pixels of the photo, the drawing may stray from the traced edge. Half a pixel
// is finer than the photo itself can show. Tried from the finest; a coarser one is used only
// when the file would otherwise be over the maximum.
const TOLERANCES = [0.5, 0.8, 1.2, 1.8, 2.5, 3.5]
// The edge of photographed ink wobbles by a pixel or so from the grain of the paper and the
// camera's noise. Enlarged, a faithful tracing of that looks ragged, so the mask is blurred
// this far, twice, before it is traced: the wobble goes and the stroke's shape stays.
const SMOOTH = 1

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** True when the bytes are an SVG file as this app writes it. */
export function isSvg(bytes: Uint8Array): boolean {
  return decoder.decode(bytes.subarray(0, 5)) === '<svg '
}

/** The width and height written on the SVG's opening tag, in pixels. */
export function svgSize(bytes: Uint8Array): { widthPx: number; heightPx: number } | null {
  const head = decoder.decode(bytes.subarray(0, 300))
  const width = /\swidth="(\d+)"/.exec(head)
  const height = /\sheight="(\d+)"/.exec(head)
  return width && height ? { widthPx: Number(width[1]), heightPx: Number(height[1]) } : null
}

/**
 * Grow an SVG to at least `size` bytes with a comment of spaces before the closing tag.
 * A comment is not drawn, so the picture is unchanged.
 */
export function padSvg(bytes: Uint8Array, size: number): Uint8Array {
  if (!isSvg(bytes) || bytes.length >= size) return bytes
  const svg = decoder.decode(bytes)
  const end = svg.lastIndexOf('</svg>')
  // "<!--" and "-->" take 7 bytes; a comment cannot be shorter than that
  const spaces = Math.max(0, size - bytes.length - 7)
  return encoder.encode(`${svg.slice(0, end)}<!--${' '.repeat(spaces)}-->${svg.slice(end)}`)
}

/**
 * The signature as an SVG drawing: the edge of the ink traced into smooth curves, in one
 * colour, on the background colour, at the size the form asks for.
 *
 * Returns the finest drawing that fits under `maxBytes`, or null when even the coarsest
 * does not.
 */
export function signatureSvg(
  mask: Float32Array,
  width: number,
  height: number,
  /** The part of the photo that becomes the picture. */
  box: Rect,
  spec: Spec,
  /** The ink's colour as CSS, e.g. "rgb(20,30,90)". */
  ink: string,
  maxBytes = Infinity,
): Uint8Array | null {
  // from photo pixels to output pixels
  const scale = spec.widthPx / box.width
  const smooth = boxBlur(boxBlur(mask, width, height, SMOOTH), width, height, SMOOTH)
  const loops = outlines(smooth, width, height).filter((loop) => area(loop) >= MIN_AREA)

  for (const tolerance of TOLERANCES) {
    const d = loops
      .map((loop) => simplify(loop, tolerance))
      .filter((loop) => loop.length >= 3)
      // only now to output pixels, so the tolerance above is in pixels of the photo
      .map((loop) => loop.map(([x, y]): Point => [(x - box.x) * scale, (y - box.y) * scale]))
      .map(pathData)
      .join('')
    const { widthPx, heightPx, background } = spec
    // evenodd: an outline inside another is a hole, like the inside of an "o"
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">` +
      `<rect width="100%" height="100%" fill="${background}"/>` +
      `<path fill="${ink}" fill-rule="evenodd" d="${d}"/>` +
      `</svg>`
    const bytes = encoder.encode(svg)
    if (bytes.length <= maxBytes) return bytes
  }
  return null
}
