import { useRef, useState } from 'react'
import { processPhoto, type Quality } from './pipeline/process'
import type { Spec } from './pipeline/types'
import { DEFAULT_FIELDS, parseFields, type SpecFields } from './spec/fields'
import { resolveSpec } from './spec/units'
import { SpecForm } from './SpecForm'

/** The size limits as text, e.g. "20 to 50 KB". */
function limitText(spec: Spec): string {
  if (spec.minKb !== undefined && spec.maxKb !== undefined) return `${spec.minKb} to ${spec.maxKb} KB`
  if (spec.maxKb !== undefined) return `max ${spec.maxKb} KB`
  if (spec.minKb !== undefined) return `min ${spec.minKb} KB`
  return 'none'
}

// Debug page: shows each pipeline stage as it is built. Replaced by the real UI later.
function App() {
  const sourceRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const finalRef = useRef<HTMLCanvasElement>(null)
  const [info, setInfo] = useState('Choose a photo.')
  const [resultLine, setResultLine] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [download, setDownload] = useState<string | null>(null)
  const [quality, setQuality] = useState<Quality>('fast')
  const [fields, setFields] = useState<SpecFields>(DEFAULT_FIELDS)
  const [hasFile, setHasFile] = useState(false)
  const lastFile = useRef<File | undefined>(undefined)
  const resolved = resolveSpec(parseFields(fields))

  async function onFile(file: File | undefined, mode: Quality) {
    if (!file) return
    lastFile.current = file
    setHasFile(true)
    if (!resolved.ok) {
      setInfo('Fix the form details above first.')
      return
    }
    const spec = resolved.spec
    setResultLine('')
    setWarnings([])
    setDownload((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
    for (const ref of [maskRef, finalRef]) {
      ref.current!.width = 0
      ref.current!.height = 0
    }

    try {
      const { image, turns, faceCount, stages, timingsMs } = await processPhoto(file, spec, mode)

      const source = sourceRef.current!
      source.width = image.width
      source.height = image.height
      const ctx = source.getContext('2d')!
      ctx.drawImage(image, 0, 0)

      const timings = Object.entries(timingsMs)
        .map(([name, ms]) => `${name} ${ms} ms`)
        .join(', ')
      const turned = turns === 0 ? '' : `, turned ${turns * 90} degrees`
      setInfo(
        `${file.name}: ${(file.size / 1000).toFixed(0)} KB -> ${image.width} x ${image.height} px${turned}, ` +
          `${faceCount} face(s). ${timings}`,
      )

      if (!stages) {
        setResultLine(
          faceCount === 0
            ? 'No face found. Use a front-facing photo.'
            : 'More than one face found. Use a photo with one person.',
        )
        return
      }
      const { face, mask, box, final, exported } = stages
      setWarnings(stages.warnings)

      // crop box, eye line, crown-to-chin line
      ctx.lineWidth = 4
      ctx.strokeStyle = '#ffffff'
      ctx.strokeRect(box.x, box.y, box.width, box.height)
      ctx.strokeStyle = '#f59e0b'
      ctx.beginPath()
      ctx.moveTo(face.leftEye.x, face.leftEye.y)
      ctx.lineTo(face.rightEye.x, face.rightEye.y)
      ctx.moveTo(face.crown.x, face.crown.y)
      ctx.lineTo(face.chin.x, face.chin.y)
      ctx.stroke()

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

      const finalCanvas = finalRef.current!
      finalCanvas.width = final.width
      finalCanvas.height = final.height
      finalCanvas.getContext('2d')!.putImageData(final, 0, 0)

      if (!exported) {
        setResultLine(
          `Cannot fit ${spec.widthPx} x ${spec.heightPx} px into ${spec.maxKb} KB at readable quality.`,
        )
        return
      }
      const { bytes, quality, measured, problems } = exported
      const line =
        `${(measured.bytes / 1000).toFixed(1)} KB (limit: ${limitText(spec)}) | ` +
        `${measured.widthPx} x ${measured.heightPx} px | JPG | quality ${quality}`
      if (problems.length > 0) {
        setResultLine(`${line} | NOT VALID: ${problems.join('; ')}`)
      } else {
        setResultLine(line)
        // copy into a fresh buffer: Blob does not accept a view over a shared one
        setDownload(URL.createObjectURL(new Blob([bytes.slice()], { type: 'image/jpeg' })))
      }
    } catch (error) {
      setInfo(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-white p-6 text-neutral-900">
      <h1 className="text-2xl font-semibold">Formify</h1>
      <SpecForm fields={fields} resolved={resolved} onChange={setFields} />
      <input
        id="photo"
        className="mt-4 block"
        type="file"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0], quality)}
      />
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          id="fine-edges"
          type="checkbox"
          checked={quality === 'fine'}
          onChange={(e) => {
            const next: Quality = e.target.checked ? 'fine' : 'fast'
            setQuality(next)
            onFile(lastFile.current, next)
          }}
        />
        Finer hair edges (downloads a 26 MB model, slower)
      </label>
      <button
        id="create"
        className="mt-3 rounded bg-neutral-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        disabled={!hasFile || !resolved.ok}
        onClick={() => onFile(lastFile.current, quality)}
      >
        Create again with these details
      </button>
      <p className="mt-3 text-sm text-neutral-600">{info}</p>
      <canvas ref={finalRef} className="mt-3 border border-neutral-300" />
      {resultLine && <p className="mt-3 font-mono text-sm">{resultLine}</p>}
      {warnings.map((warning) => (
        <p key={warning} className="mt-2 rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {warning}
        </p>
      ))}
      {download && (
        <a
          className="mt-3 inline-block rounded bg-blue-600 px-4 py-2 font-medium text-white"
          href={download}
          download="formify-photo.jpg"
        >
          Download
        </a>
      )}
      <canvas ref={sourceRef} className="mt-6 h-auto max-w-full border border-neutral-300" />
      <canvas ref={maskRef} className="mt-3 h-auto max-w-full border border-neutral-300" />
    </main>
  )
}

export default App
