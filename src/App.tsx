import { useRef, useState } from 'react'
import { CropBox } from './CropBox'
import { fitRegion, fractionAspect, FULL, isFull, type Region } from './crop/region'
import type { Exported } from './pipeline/exportJpeg'
import { processPhoto, type Quality } from './pipeline/process'
import type { Rect, Spec } from './pipeline/types'
import { processSignature } from './signature/process'
import { DEFAULT_FIELDS, parseFields, SIGNATURE_FIELDS, type SpecFields } from './spec/fields'
import { resolveSpec } from './spec/units'
import { SpecForm } from './SpecForm'

/** What is being made. Each kind has its own pipeline and its own form details. */
type Kind = 'photo' | 'signature'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'signature', label: 'Signature' },
]

/** The size limits as text, e.g. "20 to 50 KB". */
function limitText(spec: Spec): string {
  if (spec.minKb !== undefined && spec.maxKb !== undefined) return `${spec.minKb} to ${spec.maxKb} KB`
  if (spec.maxKb !== undefined) return `max ${spec.maxKb} KB`
  if (spec.minKb !== undefined) return `min ${spec.minKb} KB`
  return 'none'
}

const timingText = (timingsMs: Record<string, number>) =>
  Object.entries(timingsMs)
    .map(([name, ms]) => `${name} ${ms} ms`)
    .join(', ')

type Theme = 'light' | 'dark'

/** The theme the page started with: set on <html> by the script in index.html. */
const startTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

const icon = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" strokeWidth="2" {...icon}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" strokeWidth="2" {...icon}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
)

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" className="h-8 w-8" strokeWidth="1.75" {...icon}>
    <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" />
  </svg>
)

function App() {
  const sourceRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const finalRef = useRef<HTMLCanvasElement>(null)
  const [kind, setKind] = useState<Kind>('photo')
  const [theme, setTheme] = useState<Theme>(startTheme)
  const [info, setInfo] = useState('Choose a photo.')
  const [resultLine, setResultLine] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [download, setDownload] = useState<string | null>(null)
  const [quality, setQuality] = useState<Quality>('fast')
  // each kind keeps its own details, so switching back and forth loses nothing
  const [allFields, setAllFields] = useState<Record<Kind, SpecFields>>({
    photo: DEFAULT_FIELDS,
    signature: SIGNATURE_FIELDS,
  })
  const fields = allFields[kind]
  const setFields = (next: SpecFields) => setAllFields({ ...allFields, [kind]: next })
  const [preview, setPreview] = useState<string | null>(null)
  // the user's own crop, with the shape it was made for; null means the starting crop
  const [custom, setCustom] = useState<{ aspect?: number; region: Region } | null>(null)
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | null>(null)
  const [lockShape, setLockShape] = useState(true)
  // quarter turns used for the last signature, so Rotate can go one further; null before any
  const [signatureTurns, setSignatureTurns] = useState<number | null>(null)
  const lastFile = useRef<File | undefined>(undefined)
  const resolved = resolveSpec(parseFields(fields))

  // the crop is held to the output's shape unless the user switches that off
  // a signature is cut to its ink afterwards, so its crop box is always free-form
  const aspect =
    kind === 'photo' && lockShape && photoSize && resolved.ok
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

  function switchTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('formify-theme', next)
    } catch {
      // private windows may refuse storage; the theme then lasts until the page is closed
    }
    setTheme(next)
  }

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
    setSignatureTurns(null)
    clearResult()
    setInfo(`Move the box or drag its corners to crop, then press Create ${kind}.`)
  }

  function onKind(next: Kind) {
    setKind(next)
    setSignatureTurns(null)
    clearResult()
  }

  /** Draw the loaded image and hand back its context for the overlays. */
  function drawSource(image: ImageBitmap): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
    const source = sourceRef.current!
    source.width = image.width
    source.height = image.height
    const ctx = source.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    return ctx
  }

  /** Mask as a picture: kept pixels white, dropped pixels black. */
  function drawMask(mask: Float32Array, width: number, height: number) {
    const maskCanvas = maskRef.current!
    maskCanvas.width = width
    maskCanvas.height = height
    const maskImage = new ImageData(width, height)
    for (let i = 0; i < mask.length; i++) {
      const v = Math.round(mask[i] * 255)
      maskImage.data[i * 4] = v
      maskImage.data[i * 4 + 1] = v
      maskImage.data[i * 4 + 2] = v
      maskImage.data[i * 4 + 3] = 255
    }
    maskCanvas.getContext('2d')!.putImageData(maskImage, 0, 0)
  }

  /** Show the finished picture, its measurements, and the download when it is valid. */
  function showResult(final: ImageData, exported: Exported | null, spec: Spec) {
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
  }

  const strokeRect = (ctx: ReturnType<typeof drawSource>, rect: Rect, colour: string) => {
    ctx.lineWidth = 4
    ctx.strokeStyle = colour
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  }

  /** `turns` overrides the guess of which way up a signature is. */
  async function onCreate(forcedTurns?: number) {
    const file = lastFile.current
    if (!file || !resolved.ok) return
    const spec = resolved.spec
    const chosen = isFull(region) ? undefined : region
    const loaded = `${file.name}: ${(file.size / 1000).toFixed(0)} KB`
    setInfo('Working...')
    clearResult()

    try {
      if (kind === 'signature') {
        const result = await processSignature(file, spec, chosen, forcedTurns)
        const { image, stages, timingsMs } = result
        setSignatureTurns(result.turns)
        const ctx = drawSource(image)
        const turned = result.turns === 0 ? '' : `, turned ${result.turns * 90} degrees`
        setInfo(
          `${loaded} -> ${image.width} x ${image.height} px${turned}. ${timingText(timingsMs)}`,
        )
        if (!stages) {
          setResultLine('No signature found. Use a photo of dark ink on plain, light paper.')
          return
        }
        setWarnings(stages.warnings)
        // the ink alone, then the box that is cut out
        strokeRect(ctx, stages.ink, '#f59e0b')
        strokeRect(ctx, stages.box, '#2563eb')
        drawMask(stages.mask, image.width, image.height)
        showResult(stages.final, stages.exported, spec)
        return
      }

      const { image, turns, faceCount, stages, timingsMs } = await processPhoto(
        file,
        spec,
        quality,
        chosen,
      )
      const ctx = drawSource(image)
      const turned = turns === 0 ? '' : `, turned ${turns * 90} degrees`
      setInfo(
        `${loaded} -> ${image.width} x ${image.height} px${turned}, ` +
          `${faceCount} face(s). ${timingText(timingsMs)}`,
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
      strokeRect(ctx, box, '#ffffff')
      ctx.strokeStyle = '#f59e0b'
      ctx.beginPath()
      ctx.moveTo(face.leftEye.x, face.leftEye.y)
      ctx.lineTo(face.rightEye.x, face.rightEye.y)
      ctx.moveTo(face.crown.x, face.crown.y)
      ctx.lineTo(face.chin.x, face.chin.y)
      ctx.stroke()

      drawMask(mask, image.width, image.height)
      showResult(final, exported, spec)
    } catch (error) {
      setInfo(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const checkbox = 'flex items-center gap-2 text-sm'

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-xl font-semibold">
          <span className="nm-raised flex h-10 w-10 items-center justify-center !rounded-xl">
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
          </span>
          Formify
        </h1>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="nm-inset flex flex-1 gap-1 p-1 sm:w-64 sm:flex-none">
            {KINDS.map(({ value, label }) => (
              <label key={value} className="nm-segment">
                <input
                  id={`kind-${value}`}
                  className="sr-only"
                  type="radio"
                  name="kind"
                  checked={kind === value}
                  onChange={() => onKind(value)}
                />
                {label}
              </label>
            ))}
          </div>
          <button
            id="theme"
            className="nm-btn !px-2.5"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={switchTheme}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* on a phone: picture, form, result, in that order; on a wide screen the form sits on the right */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Picture" className="flex min-w-0 flex-col gap-4">
          <div
            className="nm-inset nm-drop p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onPick(e.dataTransfer.files[0])
            }}
          >
            {preview ? (
              <CropBox
                src={preview}
                region={region}
                aspect={aspect}
                onChange={setRegion}
                onSize={(width, height) => setPhotoSize({ width, height })}
              />
            ) : (
              <label
                htmlFor="photo"
                className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 text-center sm:min-h-80"
              >
                <UploadIcon />
                <span className="font-semibold">
                  {kind === 'photo' ? 'Choose a photo' : 'Choose a photo of your signature'}
                </span>
                <span className="text-sm">or drop it here, then drag the corners to crop</span>
              </label>
            )}
            <input
              id="photo"
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(e) => onPick(e.target.files?.[0])}
            />
          </div>
          {preview && (
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="photo" className="nm-btn">
                Change photo
              </label>
              <button id="crop-reset" className="nm-btn" onClick={() => setCustom(null)}>
                Reset crop
              </button>
              {kind === 'photo' && (
                <label className={checkbox}>
                  <input
                    id="crop-lock"
                    className="nm-check"
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
            </div>
          )}
        </section>

        <aside className="nm-raised flex flex-col gap-4 p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <SpecForm fields={fields} resolved={resolved} onChange={setFields} />
          {kind === 'photo' && (
            <label className={checkbox}>
              <input
                id="fine-edges"
                className="nm-check"
                type="checkbox"
                checked={quality === 'fine'}
                onChange={(e) => setQuality(e.target.checked ? 'fine' : 'fast')}
              />
              Finer hair edges (downloads a 26 MB model, slower)
            </label>
          )}
          <button
            id="create"
            className="nm-btn nm-btn-primary w-full"
            disabled={!preview || !resolved.ok}
            onClick={() => onCreate()}
          >
            Create {kind}
          </button>
        </aside>

        <section aria-label="Result" className="nm-raised flex min-w-0 flex-col gap-3 p-4">
          <h2 className="font-semibold">Result</h2>
          <p id="info" className="text-sm">
            {info}
          </p>
          <canvas
            ref={finalRef}
            className={resultLine ? 'h-auto max-w-full self-start rounded-lg' : 'hidden'}
          />
          {resultLine && <p className="text-sm font-medium">{resultLine}</p>}
          {warnings.map((warning) => (
            <p key={warning} className="nm-note px-3 py-2 text-sm">
              {warning}
            </p>
          ))}
          <div className="flex flex-wrap gap-3 empty:hidden">
            {download && (
              <a
                className="nm-btn nm-btn-primary"
                href={download}
                download={`formify-${kind}.jpg`}
              >
                Download
              </a>
            )}
            {kind === 'signature' && signatureTurns !== null && (
              <button
                id="rotate"
                className="nm-btn"
                onClick={() => onCreate((signatureTurns + 1) % 4)}
              >
                Rotate
              </button>
            )}
          </div>
          {/* how the result was reached: what was found in the photo, and the cut-out */}
          <details className={resultLine ? 'text-sm' : 'hidden'}>
            <summary className="cursor-pointer font-medium">Show details</summary>
            <canvas ref={sourceRef} className="mt-3 h-auto max-w-full rounded-lg" />
            <canvas ref={maskRef} className="mt-3 h-auto max-w-full rounded-lg" />
          </details>
        </section>
      </div>
    </main>
  )
}

export default App
