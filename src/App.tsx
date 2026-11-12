import { useRef, useState } from 'react'
import { faceGeometry } from './pipeline/faceGeometry'
import { detectFaces } from './pipeline/landmarks'
import { loadImage } from './pipeline/loadImage'

// Day 1 debug page: shows each pipeline stage as it is built. Replaced by the real UI later.
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [info, setInfo] = useState('Choose a photo.')

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      const started = performance.now()
      const image = await loadImage(file)
      const canvas = canvasRef.current!
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(image, 0, 0)
      const loadedMs = Math.round(performance.now() - started)

      const faces = await detectFaces(image)
      ctx.fillStyle = '#22c55e'
      for (const face of faces) {
        for (const p of face) ctx.fillRect(p.x * image.width - 1, p.y * image.height - 1, 2, 2)

        const { box, leftEye, rightEye, chin, crown } = faceGeometry(face, image.width, image.height)
        ctx.lineWidth = 3
        ctx.strokeStyle = '#2563eb'
        ctx.strokeRect(box.x, box.y, box.width, box.height)
        // eye line, then crown-to-chin line
        ctx.strokeStyle = '#f59e0b'
        ctx.beginPath()
        ctx.moveTo(leftEye.x, leftEye.y)
        ctx.lineTo(rightEye.x, rightEye.y)
        ctx.moveTo(crown.x, crown.y)
        ctx.lineTo(chin.x, chin.y)
        ctx.stroke()
        ctx.fillStyle = '#dc2626'
        for (const p of [leftEye, rightEye, chin, crown]) ctx.fillRect(p.x - 5, p.y - 5, 10, 10)
        ctx.fillStyle = '#22c55e'
      }
      setInfo(
        `${file.name}: ${(file.size / 1000).toFixed(0)} KB file -> ${image.width} x ${image.height} px ` +
          `in ${loadedMs} ms, ${faces.length} face(s) found`,
      )
    } catch (error) {
      setInfo(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Formify</h1>
      <input
        id="photo"
        className="mt-4 block"
        type="file"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <p className="mt-3 text-sm text-neutral-600">{info}</p>
      <canvas ref={canvasRef} className="mt-3 h-auto max-w-full border border-neutral-300" />
    </main>
  )
}

export default App
