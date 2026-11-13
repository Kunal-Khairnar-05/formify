/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // onnxruntime-web and jSquash ship their own .wasm files; pre-bundling breaks their loaders
  optimizeDeps: { exclude: ['onnxruntime-web', '@jsquash/jpeg'] },
  // cross-origin isolation lets the WebAssembly runtimes use threads (SharedArrayBuffer)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // the pipeline runs in a worker (src/worker), built as a module like the rest
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'] },
})
