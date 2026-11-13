/// <reference lib="webworker" />
// Runs every heavy job off the page's own thread: finding the face, removing the
// background, tracing ink, encoding files. The page stays free to scroll, animate and
// respond while a photo is being made.

import { encodeJpeg } from '../pipeline/encode'
import { warmLandmarker } from '../pipeline/landmarks'
import { getMatteSession, getSegmentationSession } from '../pipeline/ort'
import { processPhoto } from '../pipeline/process'
import { processSignature } from '../signature/process'
import { measurePicture } from '../spec/estimate'
import { guessTurns, rotateFile } from '../upright'
import { SINGLE_THREAD, transferables, type JobName, type Jobs, type Reply, type Request } from './protocol'

declare const self: DedicatedWorkerGlobalScope

// In a module worker MediaPipe loads its runtime with `import(url)`, and looks for a
// `self.import` to use first. Supplying one here keeps the build tool's hands off that
// import: the dev server rewrites every import it can see, and refuses the rewritten
// address because the file is served as it is from public/, not built.
// The import is built from text so that no build step can see it to rewrite it.
;(self as unknown as { import: (url: string) => Promise<unknown> }).import = new Function(
  'url',
  'return import(url)',
) as (url: string) => Promise<unknown>

// The same library looks for `importScripts` to tell a worker from a page, and reaches for
// `document` when there is none. A module worker need not have one, so it is given one
// that fails the way a module worker's does, which sends the library on to `self.import`.
const globals = self as unknown as { importScripts?: (...urls: string[]) => void }
if (typeof globals.importScripts !== 'function') {
  globals.importScripts = () => {
    throw new TypeError('importScripts is not available in a module worker')
  }
}

/*
 * The model runtime speeds itself up with threads, which are workers it starts from inside
 * this one. Where one of those will not start (some hosts and some browsers do not allow
 * it), the runtime gives no error: it waits for the thread for ever, and so does the user.
 *
 * So every worker started from here is watched. If one fails, the page is told, and it
 * replaces this worker with one that uses no threads: slower, but it finishes.
 */
interface Spawned {
  addEventListener(type: 'error', listener: () => void): void
}
type Spawn = new (url: string | URL, options?: WorkerOptions) => Spawned
// the worker scope's own typings leave out that a worker can start workers
const scope = self as unknown as { Worker: Spawn }

if (self.name !== SINGLE_THREAD) {
  const Native = scope.Worker
  scope.Worker = class extends Native {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options)
      this.addEventListener('error', () => self.postMessage({ type: 'threads-failed' } satisfies Reply))
    }
  }
}

type Stage = (stage: string) => void

// one function per job; `stage` reports progress back to the page
const jobs: { [N in JobName]: (args: Jobs[N]['args'], stage: Stage) => Promise<Jobs[N]['result']> } = {
  processPhoto: ([file, spec, quality, region], stage) => processPhoto(file, spec, quality, region, stage),
  processSignature: ([file, spec, region, turns], stage) => processSignature(file, spec, region, turns, stage),
  guessTurns: ([file, kind]) => guessTurns(file, kind),
  rotateFile: ([file, turns]) => rotateFile(file, turns),
  measurePicture: ([file, region, spec]) => measurePicture(file, region, spec),
  warm: async ([kind, quality]) => {
    // the encoder is needed by both kinds; one pixel is enough to load it
    const encoder = encodeJpeg(new ImageData(1, 1), 80)
    if (kind === 'photo') {
      await Promise.all([
        warmLandmarker(),
        getSegmentationSession(),
        quality === 'fine' ? getMatteSession() : undefined,
      ])
    }
    await encoder
  },
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, job, args } = event.data
  const send = (reply: Reply, transfer: Transferable[] = []) => self.postMessage(reply, transfer)
  try {
    const run = jobs[job] as (args: unknown, stage: Stage) => Promise<unknown>
    const result = await run(args, (stage) => send({ id, type: 'stage', stage }))
    send({ id, type: 'done', result }, transferables(result))
  } catch (error) {
    send({ id, type: 'failed', message: error instanceof Error ? error.message : String(error) })
  }
}
