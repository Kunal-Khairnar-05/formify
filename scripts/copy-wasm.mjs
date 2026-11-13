// Copies the WebAssembly runtimes out of node_modules so the app can serve them itself.
import { cpSync, mkdirSync } from 'node:fs'

const runtimes = [
  {
    from: 'node_modules/@mediapipe/tasks-vision/wasm',
    to: 'public/mediapipe',
    // the "module" pair: the pipeline runs in a worker, which loads the runtime as a module
    files: ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm'],
  },
  {
    from: 'node_modules/onnxruntime-web/dist',
    to: 'public/ort',
    // the runtime as one file, which a build loads as it is (see src/pipeline/ort.ts)
    files: ['ort-wasm-simd-threaded.wasm', 'ort.wasm.bundle.min.mjs'],
  },
]

for (const { from, to, files } of runtimes) {
  mkdirSync(to, { recursive: true })
  for (const file of files) cpSync(`${from}/${file}`, `${to}/${file}`)
}
