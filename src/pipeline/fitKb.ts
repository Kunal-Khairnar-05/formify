import type { FitResult } from './types'

export type Encode = (quality: number) => Promise<Uint8Array>

/** Step 7d (you type): highest quality whose output fits under maxKb; null if none does. */
export async function fitKb(_encode: Encode, _maxKb: number): Promise<FitResult | null> {
  throw new Error('fitKb: not implemented')
}
