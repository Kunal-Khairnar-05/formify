import { useRef, useState } from 'react'
import { composite } from './pipeline/composite'
import { cropBox } from './pipeline/crop'
import { exportJpeg } from './pipeline/exportJpeg'
import { faceGeometry } from './pipeline/faceGeometry'
import { detectFaces } from './pipeline/landmarks'
import { loadImage } from './pipeline/loadImage'
import { cropAndResize } from './pipeline/resize'
import { segment } from './pipeline/segment'
import type { Spec } from './pipeline/types'

// Day 1 spec: 3.5 x 4.5 cm at 300 DPI, at most 50 KB, white background
const SPEC: Spec = { widthPx: 413, heightPx: 531, maxKb: 50, format: 'jpg', background: '#ffffff' }

// Day 1 debug page: shows each pipeline stage as it is built. Replaced by the real UI later.
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const resultRef = useRef<HTMLCanvasElement>(null)
  const finalRef = useRef<HTMLCanvasElement>(null)
  const [info, setInfo] = useState('Choose a photo.')
  const [resultLine, setResultLine] = useState('')
  const [download, setDownload] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setResultLine('')
    setDownload((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
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

      const segmentStarted = performance.now()
      const mask = await segment(image)
      const segmentMs = Math.round(performance.now() - segmentStarted)

      // person white, background black
      const maskCanvas = maskRef.current!
      maskCanvas.width = image.width
      maskCanvas.height = image.height
      const maskImage = new ImageData(image.width, image.height)
      for (let i = 0; i < mask.length; i++) {
        const v = Math.round(mask[i] * 255)
        maskImage.data[i * 4] = v
        maskImage.data[i * 4 + 1] = v
        maskImage.data[i * 4 + 2] = v
        maskImage.data[i * 4 + 3] = 255
      }
      maskCanvas.getContext('2d')!.putImageData(maskImage, 0, 0)

      const result = composite(image, mask, SPEC.background)
      const resultCanvas = resultRef.current!
      resultCanvas.width = result.width
      resultCanvas.height = result.height
      resultCanvas.getContext('2d')!.putImageData(result, 0, 0)

      let cropNote = 'no crop (needs exactly one face)'
      const finalCanvas = finalRef.current!
      if (faces.length === 1) {
        const face = faceGeometry(faces[0], image.width, image.height)
        const box = cropBox(face, image.width, image.height, SPEC.widthPx / SPEC.heightPx)
        ctx.lineWidth = 4
        ctx.strokeStyle = '#ffffff'
        ctx.strokeRect(box.x, box.y, box.width, box.height)

        const final = await cropAndResize(result, box, SPEC.widthPx, SPEC.heightPx)
        finalCanvas.width = final.width
        finalCanvas.height = final.height
        finalCanvas.getContext('2d')!.putImageData(final, 0, 0)
        cropNote = `crop ${box.width} x ${box.height} at (${box.x}, ${box.y}) -> ${final.width} x ${final.height} px`

        const exported = await exportJpeg(final, SPEC)
        if (!exported) {
          setResultLine(`Cannot fit ${SPEC.widthPx} x ${SPEC.heightPx} px into ${SPEC.maxKb} KB at readable quality.`)
        } else {
          const { bytes, quality, measured, problems } = exported
          const line =
            `${(measured.bytes / 1000).toFixed(1)} KB (limit: max ${SPEC.maxKb} KB) | ` +
            `${measured.widthPx} x ${measured.heightPx} px | JPG | quality ${quality}`
          if (problems.length > 0) {
            setResultLine(`${line} | NOT VALID: ${problems.join('; ')}`)
          } else {
            setResultLine(line)
            // copy into a fresh buffer: Blob does not accept a view over a shared one
            setDownload(URL.createObjectURL(new Blob([bytes.slice()], { type: 'image/jpeg' })))
          }
        }
      } else {
        finalCanvas.width = 0
        finalCanvas.height = 0
      }

      setInfo(
        `${file.name}: ${(file.size / 1000).toFixed(0)} KB file -> ${image.width} x ${image.height} px ` +
          `in ${loadedMs} ms, ${faces.length} face(s) found, mask in ${segmentMs} ms, ${cropNote}`,
      )
    } catch (error) {
      setInfo(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-white p-6 text-neutral-900">
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
      <canvas ref={maskRef} className="mt-3 h-auto max-w-full border border-neutral-300" />
      <canvas ref={resultRef} className="mt-3 h-auto max-w-full border border-neutral-300" />
      <canvas ref={finalRef} className="mt-3 border border-neutral-300" />
      {resultLine && <p className="mt-3 font-mono text-sm">{resultLine}</p>}
      {download && (
        <a
          className="mt-3 inline-block rounded bg-blue-600 px-4 py-2 font-medium text-white"
          href={download}
          download="formify-photo.jpg"
        >
          Download
        </a>
      )}
    </main>
  )
}

export default App
