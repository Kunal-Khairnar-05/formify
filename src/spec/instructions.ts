import type { SpecFields } from './fields'
import type { Unit } from './units'

/** What was recognised in a portal's instructions. */
export interface Parsed {
  /** Only the form fields that were found; everything else is left as the user had it. */
  fields: Partial<SpecFields>
  /** One short line per thing found, to show the user what was read. */
  found: string[]
}

// a whole or decimal number, captured
const NUMBER = String.raw`(\d+(?:\.\d+)?)`
// a length unit, captured. Bare "in" is left out on purpose: "200 x 230 in JPG format"
const UNIT = String.raw`(pixels?|px|cm|mm|inch(?:es)?)`
const BYTES = String.raw`(kb|mb)`

// "3.5 cm x 4.5 cm", "200x230 pixels", "35mm × 45mm", "2 by 2 inches"
const CROSS = new RegExp(String.raw`${NUMBER}\s*${UNIT}?\s*(?:x|×|\*|by)\s*${NUMBER}\s*${UNIT}?`, 'i')
// "width 3.5 cm", "Width: 200 px"
const WIDTH = new RegExp(String.raw`width\D{0,15}${NUMBER}\s*${UNIT}?`, 'i')
const HEIGHT = new RegExp(String.raw`height\D{0,15}${NUMBER}\s*${UNIT}?`, 'i')

// "20 KB to 50 KB", "between 20 and 50 kb", "10kb – 20kb", "20-50 KB"
const KB_RANGE = new RegExp(String.raw`${NUMBER}\s*${BYTES}?\s*(?:to|and|-|–|—)\s*${NUMBER}\s*${BYTES}`, 'i')

// "not more than" and "not be less than" mean the opposite of the words after "not"
const NOT = String.raw`not (?:be )?`
// a lookbehind: matches only where the text before is not "not " or "not be "
const NO_NOT = String.raw`(?<!not |not be )`

// "maximum 50 KB", "not more than 50 KB", "less than 1 MB" but not "not less than"
const KB_MAX = new RegExp(
  String.raw`\b(?:max(?:imum)?|${NOT}more than|${NOT}exceed(?:ing)?|${NO_NOT}less than|up ?to|below|under)\D{0,25}${NUMBER}\s*${BYTES}`,
  'i',
)
// "minimum 10 KB", "at least 20 KB", "not less than 20 KB" but not "not more than"
const KB_MIN = new RegExp(
  String.raw`\b(?:min(?:imum)?|at least|${NOT}less than|${NO_NOT}more than|above)\D{0,25}${NUMBER}\s*${BYTES}`,
  'i',
)

// "200 DPI", "dpi: 300"
const DPI_AFTER = new RegExp(String.raw`${NUMBER}\s*dpi`, 'i')
const DPI_BEFORE = new RegExp(String.raw`dpi\D{0,10}${NUMBER}`, 'i')

function toUnit(word: string): Unit {
  const lower = word.toLowerCase()
  if (lower.startsWith('p')) return 'px'
  if (lower === 'cm' || lower === 'mm') return lower
  return 'in'
}

// the form works in KB
function toKb(value: string, unit: string): string {
  return unit.toLowerCase() === 'mb' ? String(Number(value) * 1024) : value
}

/** The width, height and unit, when the text gives them. */
export function findSize(text: string): { width: string; height: string; unit?: Unit } | null {
  const cross = CROSS.exec(text)
  if (cross) {
    // the unit is often written once, after the second number
    const unit = cross[4] ?? cross[2]
    return { width: cross[1], height: cross[3], unit: unit ? toUnit(unit) : undefined }
  }

  const width = WIDTH.exec(text)
  const height = HEIGHT.exec(text)
  if (width && height) {
    const unit = height[2] ?? width[2]
    return { width: width[1], height: height[1], unit: unit ? toUnit(unit) : undefined }
  }
  return null
}

/** The file size limits in KB, when the text gives them. */
export function findKb(text: string): { minKb?: string; maxKb?: string } {
  const range = KB_RANGE.exec(text)
  if (range) {
    // "20 to 50 KB": the first number takes the second one's unit
    return { minKb: toKb(range[1], range[2] ?? range[4]), maxKb: toKb(range[3], range[4]) }
  }

  const limits: { minKb?: string; maxKb?: string } = {}
  const min = KB_MIN.exec(text)
  const max = KB_MAX.exec(text)
  if (min) limits.minKb = toKb(min[1], min[2])
  if (max) limits.maxKb = toKb(max[1], max[2])
  return limits
}

/** The DPI, when the text gives one. */
export function findDpi(text: string): string | null {
  const match = DPI_AFTER.exec(text) ?? DPI_BEFORE.exec(text)
  return match ? match[1] : null
}

/** Read whatever a portal's pasted instructions say about size, file size and DPI. */
/**
 * The file type the text asks for, when it names exactly one. "JPG or PNG" is left alone:
 * the choice is then the user's.
 */
export function findFormat(text: string): 'jpg' | 'jpeg' | 'png' | null {
  const has = (word: string) => new RegExp(String.raw`(?<![a-z])\.?${word}(?![a-z])`, 'i').test(text)
  const jpg = has('jpg')
  const jpeg = has('jpeg')
  const png = has('png')
  if (png) return jpg || jpeg ? null : 'png'
  // both spellings together means either will do; the shorter one is the more common ending
  if (jpg) return 'jpg'
  return jpeg ? 'jpeg' : null
}

export function parseInstructions(text: string): Parsed {
  const fields: Partial<SpecFields> = {}
  const found: string[] = []

  const size = findSize(text)
  if (size) {
    fields.width = size.width
    fields.height = size.height
    if (size.unit) fields.unit = size.unit
    found.push(`Size ${size.width} x ${size.height}${size.unit ? ` ${size.unit}` : ''}`)
  }

  const { minKb, maxKb } = findKb(text)
  if (minKb !== undefined || maxKb !== undefined) {
    // the two limits go together: a text that gives only a maximum means "no minimum",
    // so a minimum left over in the form from before is cleared
    fields.minKb = minKb ?? ''
    fields.maxKb = maxKb ?? ''
    if (minKb !== undefined) found.push(`Minimum ${minKb} KB`)
    if (maxKb !== undefined) found.push(`Maximum ${maxKb} KB`)
  }

  const dpi = findDpi(text)
  if (dpi !== null) {
    fields.dpi = dpi
    found.push(`${dpi} DPI`)
  }

  const format = findFormat(text)
  if (format) {
    fields.format = format
    found.push(`${format.toUpperCase()} file`)
  }

  return { fields, found }
}
