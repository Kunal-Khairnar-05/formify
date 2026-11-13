/**
 * How the picture is stored. JPG and JPEG are one format with two spellings. SVG is a
 * drawing made of curves, not pixels, and is only made for a signature.
 */
export type OutputFormat = 'jpg' | 'png' | 'svg'

/** The ending of the file's name: what the portal sees before it looks inside. */
export type Extension = 'jpg' | 'jpeg' | 'png' | 'svg'

/** What the form asks for, already resolved to pixels and bytes. */
export interface Spec {
  widthPx: number
  heightPx: number
  minKb?: number
  maxKb?: number
  format: OutputFormat
  /** The file name's ending; the format's usual one when left out. */
  extension?: Extension
  /** CSS colour for the new background, e.g. '#ffffff'. */
  background: string
}

/** A point in image pixel coordinates. */
export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Face geometry in image pixels, derived from the landmark model. */
export interface FaceGeometry {
  box: Rect
  leftEye: Point
  rightEye: Point
  chin: Point
  /** Estimated top of the head (above the hairline, not a landmark). */
  crown: Point
}

/** Result of measuring an encoded file. */
export interface Measurement {
  widthPx: number
  heightPx: number
  bytes: number
  format: OutputFormat | 'unknown'
}

export interface FitResult {
  bytes: Uint8Array
  quality: number
}
