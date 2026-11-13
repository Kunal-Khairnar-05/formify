import type { Extension } from '../pipeline/types'
import type { SpecInput, Unit } from './units'

/** The spec form's raw text, exactly as typed. */
export interface SpecFields {
  width: string
  height: string
  unit: Unit
  dpi: string
  minKb: string
  maxKb: string
  format: Extension
  background: string
}

/** 3.5 x 4.5 cm at 300 DPI, at most 50 KB, white background. */
export const DEFAULT_FIELDS: SpecFields = {
  width: '3.5',
  height: '4.5',
  unit: 'cm',
  dpi: '300',
  minKb: '',
  maxKb: '50',
  format: 'jpg',
  background: '#ffffff',
}

/** 140 x 60 px, 10 to 20 KB, white background: a common signature requirement. */
export const SIGNATURE_FIELDS: SpecFields = {
  width: '140',
  height: '60',
  unit: 'px',
  dpi: '200',
  minKb: '10',
  maxKb: '20',
  format: 'jpg',
  background: '#ffffff',
}

// an empty or non-numeric box becomes NaN, which resolveSpec reports as a problem
const required = (text: string) => (text.trim() === '' ? Number.NaN : Number(text))

// an empty box means "no limit"
const optional = (text: string) => (text.trim() === '' ? undefined : Number(text))

/** Turn the form's text into numbers. Checking them is resolveSpec's job. */
export function parseFields(fields: SpecFields): SpecInput {
  return {
    width: required(fields.width),
    height: required(fields.height),
    unit: fields.unit,
    dpi: required(fields.dpi),
    minKb: optional(fields.minKb),
    maxKb: optional(fields.maxKb),
    format: fields.format,
    background: fields.background,
  }
}
