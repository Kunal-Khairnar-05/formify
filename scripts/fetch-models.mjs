// Downloads the model files that are too large to keep in git, and checks each one
// against its SHA-256 so a changed or corrupted download never reaches the app.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const models = [
  {
    file: 'public/models/modnet.onnx',
    url: 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx',
    sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9',
  },
]

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

for (const { file, url, sha256: expected } of models) {
  if (existsSync(file) && sha256(readFileSync(file)) === expected) continue

  console.log(`Downloading ${file} ...`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())

  const actual = sha256(bytes)
  if (actual !== expected) {
    throw new Error(`${file}: checksum mismatch, expected ${expected} but got ${actual}`)
  }
  mkdirSync('public/models', { recursive: true })
  writeFileSync(file, bytes)
}
