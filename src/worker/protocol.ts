import type { Region } from '../crop/region'
import type { Processed, Quality } from '../pipeline/process'
import type { Spec } from '../pipeline/types'
import type { ProcessedSignature } from '../signature/process'
import type { Measured } from '../spec/estimate'

/** What is being made. */
export type Kind = 'photo' | 'signature'

/**
 * Everything the page can ask the worker to do: the arguments each job takes and what it
 * gives back. The page and the worker both read this one list, so they cannot disagree.
 */
export interface Jobs {
  processPhoto: { args: [file: Blob, spec: Spec, quality: Quality, region?: Region]; result: Processed }
  processSignature: {
    args: [file: Blob, spec: Spec, region?: Region, turns?: number]
    result: ProcessedSignature
  }
  guessTurns: { args: [file: Blob, kind: Kind]; result: number }
  rotateFile: { args: [file: Blob, turns: number]; result: Blob }
  measurePicture: { args: [file: Blob, region: Region, spec: Spec]; result: Measured }
  /** Load what this kind of picture needs, so the first Create does not wait for it. */
  warm: { args: [kind: Kind, quality: Quality]; result: void }
}

export type JobName = keyof Jobs

/** Page to worker: do this job. */
export interface Request<N extends JobName = JobName> {
  id: number
  job: N
  args: Jobs[N]['args']
}

/**
 * The name given to a worker that must not use threads. A worker cannot be told this in a
 * message, because the runtime decides about threads while it loads; a worker's name is
 * there from its first line.
 */
export const SINGLE_THREAD = 'formify-single-thread'

/** Worker to page: a job's progress, its result, why it failed, or that threads do not work here. */
export type Reply =
  | { type: 'threads-failed' }
  | { id: number; type: 'stage'; stage: string }
  | { id: number; type: 'done'; result: unknown }
  | { id: number; type: 'failed'; message: string }

/**
 * The buffers and bitmaps inside a result that can be handed over, not copied. A mask or
 * a photo is megabytes; handing it over moves ownership to the other thread at once,
 * where copying would take time and hold two copies in memory.
 */
export function transferables(value: unknown, found = new Set<Transferable>()): Transferable[] {
  if (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) {
    found.add(value)
  } else if (value instanceof ArrayBuffer) {
    found.add(value)
  } else if (ArrayBuffer.isView(value)) {
    // a buffer shared between threads is not handed over: both sides already see it
    if (value.buffer instanceof ArrayBuffer) found.add(value.buffer)
  } else if (typeof ImageData !== 'undefined' && value instanceof ImageData) {
    if (value.data.buffer instanceof ArrayBuffer) found.add(value.data.buffer)
  } else if (Array.isArray(value)) {
    for (const item of value) transferables(item, found)
  } else if (typeof value === 'object' && value !== null && !(value instanceof Blob)) {
    for (const item of Object.values(value)) transferables(item, found)
  }
  return [...found]
}
