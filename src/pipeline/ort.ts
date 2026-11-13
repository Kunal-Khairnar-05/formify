import type * as Ort from 'onnxruntime-web/wasm'
import { SINGLE_THREAD } from '../worker/protocol'

type Runtime = typeof Ort

// The runtime's files are served from /ort (see scripts/copy-wasm.mjs).
const served = (file: string) => new URL(`/ort/${file}`, self.location.origin).href

// An import the build cannot see, and so cannot rewrite or bundle.
const importAsIs = new Function('url', 'return import(url)') as (url: string) => Promise<Runtime>

/*
 * The runtime is loaded as the one file its authors ship, not bundled into this code.
 *
 * It starts its worker threads from its own file, by that file's address. Bundled, its
 * code ends up in a chunk whose thread start-up never runs when a thread loads it from
 * inside the pipeline's worker: no error, and the first model waits for ever. Loaded as
 * shipped, a thread starts from the same file the runtime itself came from. This is also
 * exactly what the dev server does, so a build now behaves as development does.
 */
let runtime: Promise<Runtime> | undefined

export function loadOrt(): Promise<Runtime> {
  runtime ??= (
    import.meta.env.PROD ? importAsIs(served('ort.wasm.bundle.min.mjs')) : import('onnxruntime-web/wasm')
  ).then((ort) => {
    ort.env.wasm.wasmPaths = { wasm: served('ort-wasm-simd-threaded.wasm') }
    // threads were tried and would not start here (see src/worker/pipeline.worker.ts)
    if (self.name === SINGLE_THREAD) ort.env.wasm.numThreads = 1
    return ort
  })
  return runtime
}

const sessions = new Map<string, Promise<Ort.InferenceSession>>()

// each model is loaded once and reused
function getSession(url: string): Promise<Ort.InferenceSession> {
  let session = sessions.get(url)
  if (!session) {
    session = loadOrt().then((ort) => ort.InferenceSession.create(url, { executionProviders: ['wasm'] }))
    sessions.set(url, session)
  }
  return session
}

/** U²-Net (small): finds the main subject. Decides who is in the photo. */
export function getSegmentationSession(): Promise<Ort.InferenceSession> {
  return getSession('/models/u2netp.onnx')
}

/** MODNet: portrait matting. Draws the soft edge, hair included, for every person it sees. */
export function getMatteSession(): Promise<Ort.InferenceSession> {
  return getSession('/models/modnet.onnx')
}
