/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// onnxruntime-web's bundle refers to its .wasm file, so the build copies it into assets/.
// The app loads the runtime from /ort instead (see src/pipeline/ort.ts), so that copy is
// 15 MB that nothing ever requests.
const dropUnusedOrtWasm: Plugin = {
  name: 'drop-unused-ort-wasm',
  generateBundle(_options, bundle) {
    for (const name of Object.keys(bundle)) {
      if (/ort-wasm[^/]*\.wasm$/.test(name)) delete bundle[name]
    }
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dropUnusedOrtWasm],
  // onnxruntime-web and jSquash ship their own .wasm files; pre-bundling breaks their loaders
  optimizeDeps: { exclude: ['onnxruntime-web', '@jsquash/jpeg'] },
  // cross-origin isolation lets the WebAssembly runtimes use threads (SharedArrayBuffer)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // onnxruntime-web starts its worker threads from its own file. Left in the main
        // bundle, every thread would load the whole app and fail on `document`, which a
        // worker does not have; in a chunk of its own, a thread loads the runtime alone.
        advancedChunks: { groups: [{ name: 'ort', test: /node_modules\/onnxruntime-/ }] },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})
