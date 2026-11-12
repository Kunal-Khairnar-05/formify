import * as ort from 'onnxruntime-web/wasm'

// Step 3a: the runtime's .wasm file is served from /ort (see scripts/copy-wasm.mjs).
// Only the .wasm is overridden: its JS loader is already inside the imported bundle,
// and Vite will not serve a module import out of public/.
ort.env.wasm.wasmPaths = { wasm: '/ort/ort-wasm-simd-threaded.wasm' }

const MODEL_URL = '/models/u2netp.onnx'

let session: Promise<ort.InferenceSession> | undefined

/** The segmentation model, loaded once and reused. */
export function getSegmentationSession(): Promise<ort.InferenceSession> {
  session ??= ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] })
  return session
}

export { ort }
