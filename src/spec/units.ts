import type { Extension, Spec } from '../pipeline/types'

export type Unit = 'px' | 'cm' | 'mm' | 'in'

/** What the user types into the form, before it is turned into pixels. */
export interface SpecInput {
  width: number
  height: number
  unit: Unit
  /** Dots per inch. Only used when the unit is not px. */
  dpi: number
  minKb?: number
  maxKb?: number
  /** The file type the form asks for; JPG when left out. */
  format?: Extension
  /** CSS colour for the new background, e.g. '#ffffff'. */
  background: string
}

export type Resolved = { ok: true; spec: Spec } | { ok: false; errors: string[] }

// how many of each unit make one inch
const PER_INCH = { cm: 2.54, mm: 25.4, in: 1 }

// smallest and largest side the app will produce, in pixels
const MIN_SIDE = 20
const MAX_SIDE = 4000

/** Convert a length to whole pixels. */
export function toPixels(value: number, unit: Unit, dpi: number): number {
  if (unit === 'px') return Math.round(value)
  // length -> inches -> dots
  return Math.round((value / PER_INCH[unit]) * dpi)
}

/** Check what the user typed and turn it into a Spec, or say what is wrong. */
export function resolveSpec(input: SpecInput): Resolved {
  const errors: string[] = []
  const positive = (n: number) => Number.isFinite(n) && n > 0

  if (!positive(input.width)) errors.push('Width must be a number above 0.')
  if (!positive(input.height)) errors.push('Height must be a number above 0.')
  if (input.unit !== 'px' && !positive(input.dpi)) {
    errors.push('DPI is needed to convert cm, mm or inches to pixels.')
  }

  const { minKb, maxKb } = input
  if (minKb !== undefined && !positive(minKb)) errors.push('Minimum size must be above 0 KB.')
  if (maxKb !== undefined && !positive(maxKb)) errors.push('Maximum size must be above 0 KB.')
  if (minKb !== undefined && maxKb !== undefined && positive(minKb) && positive(maxKb) && minKb >= maxKb) {
    errors.push('Minimum size must be below the maximum size.')
  }

  if (errors.length > 0) return { ok: false, errors }

  const widthPx = toPixels(input.width, input.unit, input.dpi)
  const heightPx = toPixels(input.height, input.unit, input.dpi)
  const inRange = (side: number) => side >= MIN_SIDE && side <= MAX_SIDE
  if (!inRange(widthPx) || !inRange(heightPx)) {
    return {
      ok: false,
      errors: [
        `That comes to ${widthPx} x ${heightPx} px. Each side must be between ${MIN_SIDE} and ${MAX_SIDE} px.`,
      ],
    }
  }

  return {
    ok: true,
    spec: {
      widthPx,
      heightPx,
      minKb,
      maxKb,
      format: input.format === 'png' || input.format === 'svg' ? input.format : 'jpg',
      extension: input.format,
      background: input.background,
    },
  }
}