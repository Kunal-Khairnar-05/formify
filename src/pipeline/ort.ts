import * as ort from 'onnxruntime-web/wasm'

// Step 3a: the runtime's .wasm file is served from /ort (see scripts/copy-wasm.mjs).
// Only the .wasm is overridden: its JS loader is already inside the imported bundle,
// and Vite will not serve a module import out of public/.
ort.env.wasm.wasmPaths = { wasm: '/ort/ort-wasm-simd-threaded.wasm' }

const sessions = new Map<string, Promise<ort.InferenceSession>>()

// each model is loaded once and reused
function getSession(url: string): Promise<ort.InferenceSession> {
  let session = sessions.get(url)
  if (!session) {
    session = ort.InferenceSession.create(url, { executionProviders: ['wasm'] })
    sessions.set(url, session)
  }
  return session
}

/** U²-Net (small): finds the main subject. Decides who is in the photo. */
export function getSegmentationSession(): Promise<ort.InferenceSession> {
  return getSession('/models/u2netp.onnx')
}

/** MODNet: portrait matting. Draws the soft edge, hair included, for every person it sees. */
export function getMatteSession(): Promise<ort.InferenceSession> {
  return getSession('/models/modnet.onnx')
}

export { ort }
