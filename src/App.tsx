import { useRef, useState } from 'react'
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
      canvas.getContext('2d')!.drawImage(image, 0, 0)
      const loadedMs = Math.round(performance.now() - started)
      setInfo(
        `${file.name}: ${(file.size / 1000).toFixed(0)} KB file -> ${image.width} x ${image.height} px ` +
          `in ${loadedMs} ms`,
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
