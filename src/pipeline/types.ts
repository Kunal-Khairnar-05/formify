export type OutputFormat = 'jpg'

/** What the form asks for, already resolved to pixels and bytes. */
export interface Spec {
  widthPx: number
  heightPx: number
  minKb?: number
  maxKb?: number
  format: OutputFormat
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
