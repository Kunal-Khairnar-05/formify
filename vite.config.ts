/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

// the version is written once, in package.json, and the page reads it from there
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

/*
 * On Vercel the count is kept by the function in api/count.ts. The dev server has no
 * functions, so it answers /api/count itself, from a number held in memory that starts
 * again with the server: enough to see the counter work while developing.
 */
const devCounter: Plugin = {
  name: 'dev-counter',
  configureServer(server) {
    const made = { photo: 128, signature: 61 }
    server.middlewares.use('/api/count', (request, response) => {
      const answer = () => {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ ...made, total: made.photo + made.signature }))
      }
      if (request.method !== 'POST') return answer()
      let body = ''
      request.on('data', (chunk) => (body += chunk))
      request.on('end', () => {
        try {
          const { kind } = JSON.parse(body) as { kind?: string }
          if (kind === 'photo' || kind === 'signature') made[kind]++
        } catch {
          // not JSON: nothing is counted
        }
        answer()
      })
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devCounter],
  define: { __APP_VERSION__: JSON.stringify(version) },
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
