// Copies the WebAssembly runtimes out of node_modules so the app can serve them itself.
import { cpSync, mkdirSync } from 'node:fs'

const runtimes = [
  {
    from: 'node_modules/@mediapipe/tasks-vision/wasm',
    to: 'public/mediapipe',
    files: ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'],
  },
  {
    from: 'node_modules/onnxruntime-web/dist',
    to: 'public/ort',
    files: ['ort-wasm-simd-threaded.wasm'],
  },
]

for (const { from, to, files } of runtimes) {
  mkdirSync(to, { recursive: true })
  for (const file of files) cpSync(`${from}/${file}`, `${to}/${file}`)
}
