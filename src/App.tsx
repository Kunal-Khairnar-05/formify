import { useRef, useState } from 'react'
import { CropBox } from './CropBox'
import { fitRegion, fractionAspect, FULL, isFull, type Region } from './crop/region'
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
  const [preview, setPreview] = useState<string | null>(null)
  // the user's own crop, with the shape it was made for; null means the starting crop
  const [custom, setCustom] = useState<{ aspect?: number; region: Region } | null>(null)
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | null>(null)
  const [lockShape, setLockShape] = useState(true)
  const lastFile = useRef<File | undefined>(undefined)
  const resolved = resolveSpec(parseFields(fields))

  // the crop is held to the output's shape unless the user switches that off
  const aspect =
    lockShape && photoSize && resolved.ok
      ? fractionAspect(
          resolved.spec.widthPx / resolved.spec.heightPx,
          photoSize.width,
          photoSize.height,
        )
      : undefined
  const startRegion = aspect === undefined ? FULL : fitRegion(aspect)
  // a new output shape, or switching the lock, starts the crop again
  const region = custom && custom.aspect === aspect ? custom.region : startRegion
  const setRegion = (next: Region) => setCustom({ aspect, region: next })

  function clearResult() {
    setResultLine('')
    setWarnings([])
    setDownload((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
    for (const ref of [sourceRef, maskRef, finalRef]) {
      ref.current!.width = 0
      ref.current!.height = 0
    }
  }

  // choosing a photo only shows it for cropping; nothing is processed until Create is pressed
  function onPick(file: File | undefined) {
    if (!file) return
    lastFile.current = file
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return URL.createObjectURL(file)
    })
    setPhotoSize(null)
    setCustom(null)
    clearResult()
    setInfo('Move the box or drag its corners to crop, then press Create photo.')
  }

  async function onCreate() {
    const file = lastFile.current
    if (!file || !resolved.ok) return
    const spec = resolved.spec
    const mode = quality
    setInfo('Working...')
    clearResult()

    try {
      const { image, turns, faceCount, stages, timingsMs } = await processPhoto(
        file,
        spec,
        mode,
        isFull(region) ? undefined : region,
      )

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
      const { bytes, quality, paddedBytes, measured, problems } = exported
      const line =
        `${(measured.bytes / 1000).toFixed(1)} KB (limit: ${limitText(spec)}) | ` +
        `${measured.widthPx} x ${measured.heightPx} px | JPG | quality ${quality}` +
        (paddedBytes > 0 ? ` | padded by ${(paddedBytes / 1000).toFixed(1)} KB to reach the minimum` : '')
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
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          id="fine-edges"
          type="checkbox"
          checked={quality === 'fine'}
          onChange={(e) => setQuality(e.target.checked ? 'fine' : 'fast')}
        />
        Finer hair edges (downloads a 26 MB model, slower)
      </label>
      <button
        id="create"
        className="mt-3 rounded bg-neutral-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        disabled={!preview || !resolved.ok}
        onClick={onCreate}
      >
        Create photo
      </button>
      {preview && (
        <button
          id="crop-reset"
          className="mt-3 ml-3 text-sm underline"
          onClick={() => setCustom(null)}
        >
          Reset crop
        </button>
      )}
      {preview && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            id="crop-lock"
            type="checkbox"
            checked={lockShape}
            onChange={(e) => {
              setLockShape(e.target.checked)
              // switching to free-form keeps the box where it is
              if (!e.target.checked) setCustom({ aspect: undefined, region })
            }}
          />
          Keep the crop in the shape of the output
        </label>
      )}
      {preview && (
        <CropBox
          src={preview}
          region={region}
          aspect={aspect}
          onChange={setRegion}
          onSize={(width, height) => setPhotoSize({ width, height })}
        />
      )}
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
