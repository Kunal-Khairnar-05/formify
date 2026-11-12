import type { Measurement, Spec } from './types'

/** Step 7c (you type): read width, height and size back from the encoded bytes. */
export function measure(_bytes: Uint8Array): Measurement {
  throw new Error('measure: not implemented')
}

/** Step 7c (you type): list every way the file breaks the spec; empty means it passes. */
export function validate(_bytes: Uint8Array, _spec: Spec): string[] {
  throw new Error('validate: not implemented')
}
