import { useEffect, useRef, useState } from 'react'
import { CropBox } from './CropBox'
import { fitRegion, fractionAspect, FULL, isFull, type Region } from './crop/region'
import {
  AlertIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  DownloadIcon,
  LockIcon,
  MoonIcon,
  PhotoIcon,
  RotateIcon,
  SidebarIcon,
  SignatureIcon,
  SparkIcon,
  SunIcon,
  UploadIcon,
} from './icons'
import type { Exported } from './pipeline/export'
import { processPhoto, type Quality } from './pipeline/process'
import type { Rect, Spec } from './pipeline/types'
import { processSignature } from './signature/process'
import { DEFAULT_FIELDS, parseFields, SIGNATURE_FIELDS, type SpecFields } from './spec/fields'
import { measurePicture, type Measured } from './spec/estimate'
import { cropCaution, resolveChecked, suggest } from './spec/feasibility'
import { SpecForm } from './SpecForm'
import { guessTurns, rotateFile } from './upright'

/** What is being made. Each kind has its own pipeline and its own form details. */
type Kind = 'photo' | 'signature'

const KINDS = [
  {
    value: 'photo',
    label: 'Photo',
    Icon: PhotoIcon,
    title: 'Passport-style photo',
    lead: 'Turn a selfie into a photo that fits the form: right size, plain background, under the KB limit.',
  },
  {
    value: 'signature',
    label: 'Signature',
    Icon: SignatureIcon,
    title: 'Signature',
    lead: 'Photograph your signature on paper and get clean ink on a plain background, at the size the form asks for.',
  },
] as const

type Theme = 'light' | 'dark'

/** The theme the page started with: set on <html> by the script in index.html. */
const startTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

// from this width up the sidebar sits beside the page; below it, it slides over the page
const WIDE = '(min-width: 1024px)'

/** One line of the result's checklist: something the form asks for, and what the file has. */
interface Check {
  label: string
  /** What the file measures. */
  value: string
  /** What the form asks for. */
  wanted: string
  ok: boolean
}

/** What the finished file measures, for the result card. */
interface Summary {
  /** True when the file meets everything the form asks for. */
  valid: boolean
  checks: Check[]
  /** Used in the name of the downloaded file. */
  widthPx: number
  heightPx: number
  extension: string
  /** Extra notes about how the file was made. */
  notes: string[]
}

const STORE = 'formify-fields'

const isFields = (value: unknown): value is SpecFields =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(DEFAULT_FIELDS).every((key) => typeof (value as Record<string, unknown>)[key] === 'string')

/** The form details from the last visit, so a returning user does not type them again. */
function savedFields(): Record<Kind, SpecFields> {
  const fresh = { photo: DEFAULT_FIELDS, signature: SIGNATURE_FIELDS }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORE) ?? 'null')
    if (typeof saved !== 'object' || saved === null) return fresh
    const { photo, signature } = saved as Record<string, unknown>
    return {
      photo: isFields(photo) ? photo : fresh.photo,
      signature: isFields(signature) ? signature : fresh.signature,
    }
  } catch {
    // storage refused, or what was saved is not readable: start from the usual details
    return fresh
  }
}

const QUESTIONS = [
  {
    ask: 'Is my photo uploaded anywhere?',
    answer:
      'No. Everything runs in your browser on this device. The page downloads the models it needs, and your photo and the result never leave your device.',
  },
  {
    ask: 'Will the portal accept the result?',
    answer:
      'Formify matches the dimensions, file size and format you enter, and warns about common reasons for rejection such as blur, a leaning head or uneven light. Each portal has its own rules, so check the result against its instructions.',
  },
  {
    ask: 'Why is the first photo slower?',
    answer:
      'The first photo downloads about 13 MB of models. Your browser keeps them, so later photos start at once. Signatures need no models.',
  },
  {
    ask: 'What kind of photo works best?',
    answer:
      'A recent front-facing photo in even light, with your whole head and the top of your shoulders in view and nobody else close to you. For a signature, dark ink on light paper.',
  },
]

/** The size limits as text, e.g. "20 to 50 KB". */
function limitText(spec: Spec): string {
  if (spec.minKb !== undefined && spec.maxKb !== undefined) return `${spec.minKb} to ${spec.maxKb} KB`
  if (spec.maxKb !== undefined) return `max ${spec.maxKb} KB`
  if (spec.minKb !== undefined) return `min ${spec.minKb} KB`
  return 'no limit'
}

const timingText = (timingsMs: Record<string, number>) =>
  Object.entries(timingsMs)
    .map(([name, ms]) => `${name} ${ms} ms`)
    .join(', ')

function Step({ number, title, hint }: { number: number; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="nm-step">{number}</span>
      <div className="min-w-0">
        <h2 className="text-base leading-tight font-bold">{title}</h2>
        {hint && <p className="text-soft text-sm">{hint}</p>}
      </div>
    </div>
  )
}

/** The result's checklist: what the form asks for beside what the file has. */
function Checklist({ checks }: { checks: Check[] }) {
  return (
    <ul className="card divide-y divide-[var(--line)]">
      {checks.map(({ label, value, wanted, ok }) => (
        <li key={label} className="flex items-center gap-3 px-3 py-2.5">
          <span className={ok ? 'nm-good' : 'nm-danger'}>{ok ? <CheckIcon /> : <AlertIcon />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-soft text-xs">{wanted}</p>
          </div>
          <p className="text-sm font-bold whitespace-nowrap tabular-nums">{value}</p>
        </li>
      ))}
    </ul>
  )
}

function App() {
  const sourceRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const finalRef = useRef<HTMLCanvasElement>(null)
  const [kind, setKind] = useState<Kind>('photo')
  const [theme, setTheme] = useState<Theme>(startTheme)
  // open beside the page on a wide screen; closed, as a drawer, on a phone
  const [sidebar, setSidebar] = useState(() => window.matchMedia(WIDE).matches)
  const [busy, setBusy] = useState(false)
  // what the pipeline is doing right now, in words; shown while working
  const [stage, setStage] = useState('')
  // true while a file is held over the drop area
  const [dragging, setDragging] = useState(false)
  // what to do next, or what went wrong
  const [info, setInfo] = useState('')
  // how the last result was reached: sizes and timings, shown under "How this was made"
  const [detail, setDetail] = useState('')
  // set when there is no file to show, with the reason
  const [failure, setFailure] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [download, setDownload] = useState<string | null>(null)
  const [quality, setQuality] = useState<Quality>('fast')
  // each kind keeps its own details, so switching back and forth loses nothing
  const [allFields, setAllFields] = useState<Record<Kind, SpecFields>>(savedFields)
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(allFields))
    } catch {
      // storage refused: the details then last until the page is closed
    }
  }, [allFields])
  const fields = allFields[kind]
  const setFields = (next: SpecFields) => setAllFields({ ...allFields, [kind]: next })
  const [preview, setPreview] = useState<string | null>(null)
  // the user's own crop, with the shape it was made for; null means the starting crop
  const [custom, setCustom] = useState<{ aspect?: number; region: Region } | null>(null)
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | null>(null)
  const [lockShape, setLockShape] = useState(true)
  // quarter turns used for the last signature, so Rotate can go one further; null before any
  const [signatureTurns, setSignatureTurns] = useState<number | null>(null)
  // the picture being worked on: the chosen file, or that file turned upright
  const [picture, setPicture] = useState<{ blob: Blob; name: string; id: number } | null>(null)
  // numbers each picture shown, so work done for an earlier one is not used for this one
  const shown = useRef(0)
  // goes up with every new picture, so slow work on an earlier one can be dropped
  const pickCount = useRef(0)
  // true while a new picture is being checked for which way up it is
  const [orienting, setOrienting] = useState(false)
  // says so when a picture was turned upright after it was chosen
  const [turnNote, setTurnNote] = useState('')
  // what the chosen part of the photo weighs at the output size, and for which request
  // measured is null when the picture could not be weighed
  const [weighed, setWeighed] = useState<{ key: string; measured: Measured | null } | null>(null)

  const input = parseFields(fields)
  // the request on its own decides the output's shape; the photo's weight is added below
  const shape = resolveChecked(input, kind)
  const current = KINDS.find((entry) => entry.value === kind)!
  const hasResult = summary !== null || failure !== ''

  // the crop is held to the output's shape unless the user switches that off
  // a signature is cut to its ink afterwards, so its crop box is always free-form
  const aspect =
    kind === 'photo' && lockShape && photoSize && shape.ok
      ? fractionAspect(shape.spec.widthPx / shape.spec.heightPx, photoSize.width, photoSize.height)
      : undefined
  const startRegion = aspect === undefined ? FULL : fitRegion(aspect)
  // a new output shape, or switching the lock, starts the crop again
  const region = custom && custom.aspect === aspect ? custom.region : startRegion
  const setRegion = (next: Region) => setCustom({ aspect, region: next })

  // Weigh the chosen part of the photo at the output size, so that a limit it cannot meet
  // is refused before anything is made. Only for a photo: a signature's file holds little
  // but ink, and has nothing in common with the weight of the paper it was written on.
  const { x: regionX, y: regionY, width: regionWidth, height: regionHeight } = region
  const widthPx = shape.ok ? shape.spec.widthPx : 0
  const heightPx = shape.ok ? shape.spec.heightPx : 0
  const format = shape.ok ? shape.spec.format : 'jpg'
  const weighKey =
    picture && kind === 'photo' && shape.ok && !orienting
      ? [picture.id, regionX, regionY, regionWidth, regionHeight, widthPx, heightPx, format].join(' ')
      : ''
  useEffect(() => {
    if (!picture || weighKey === '') return
    let cancelled = false
    // wait for the crop box to stop moving before doing the work
    const timer = setTimeout(async () => {
      try {
        const measured = await measurePicture(
          picture.blob,
          { x: regionX, y: regionY, width: regionWidth, height: regionHeight },
          { widthPx, heightPx, format, background: '#ffffff' },
        )
        if (!cancelled) setWeighed({ key: weighKey, measured })
      } catch {
        // a picture that cannot be weighed is not held up for it; Create still reports problems
        if (!cancelled) setWeighed({ key: weighKey, measured: null })
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [picture, weighKey, regionX, regionY, regionWidth, regionHeight, widthPx, heightPx, format])
  const measured = (weighed && weighed.key === weighKey && weighed.measured) || undefined
  // true from the moment the request changes until the photo has been weighed for it:
  // Create waits, so that a request the photo cannot meet is never started
  const weighing = weighKey !== '' && weighed?.key !== weighKey

  const resolved = resolveChecked(input, kind, measured)
  const cropPixels =
    photoSize && kind === 'photo'
      ? { width: region.width * photoSize.width, height: region.height * photoSize.height }
      : undefined
  // known before anything is made: whether the chosen part holds enough pixels
  const tooSmall =
    cropPixels && shape.ok ? cropCaution(cropPixels.width, cropPixels.height, shape.spec) : null
  const suggestions = suggest(kind, input, cropPixels, measured)

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
    setSummary(null)
    setFailure('')
    setDetail('')
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

  /** Make this the picture being worked on, with a fresh crop and no result. */
  function show(blob: Blob, name: string) {
    setPicture({ blob, name, id: ++shown.current })
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return URL.createObjectURL(blob)
    })
    setPhotoSize(null)
    setCustom(null)
    setSignatureTurns(null)
    clearResult()
    setInfo('')
  }

  // Choosing a photo shows it for cropping, turned upright first when it is on its side or
  // upside down. Nothing else is processed until Create is pressed.
  async function onPick(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setInfo(`${file.name} is not a picture. Choose a JPG or PNG file.`)
      return
    }
    const count = ++pickCount.current
    show(file, file.name)
    setTurnNote('')
    setOrienting(true)
    try {
      const turns = await guessTurns(file, kind)
      if (turns !== 0 && count === pickCount.current) {
        const upright = await rotateFile(file, turns)
        // a newer picture may have been chosen while this one was being turned
        if (count !== pickCount.current) return
        show(upright, file.name)
        setTurnNote(
          `This ${kind === 'photo' ? 'photo' : 'signature'} was ${turns === 2 ? 'upside down' : 'on its side'}, ` +
            'so it was turned upright. Use Rotate if that is wrong.',
        )
      }
    } catch {
      // which way up could not be worked out: the picture stays as it was chosen
    } finally {
      if (count === pickCount.current) setOrienting(false)
    }
  }

  /** Turn the picture a quarter turn clockwise, by hand. */
  async function rotatePicture() {
    if (!picture) return
    const count = ++pickCount.current
    const { name } = picture
    const turned = await rotateFile(picture.blob, 1)
    if (count !== pickCount.current) return
    show(turned, name)
    setTurnNote('')
  }

  /** Put the picture and its result away, keeping the form details. */
  function startOver() {
    pickCount.current++
    setPicture(null)
    setOrienting(false)
    setTurnNote('')
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
    setPhotoSize(null)
    setCustom(null)
    setSignatureTurns(null)
    clearResult()
    setInfo('')
  }

  // show the stage, then give the page a moment to paint it before the heavy work starts
  const onStage = (next: string) => {
    setStage(next)
    // a tab in the background is not painted at all, and waiting for a frame there would
    // hold the work up until the user comes back
    if (document.hidden) return
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 0))
      // in case the tab is hidden while waiting
      setTimeout(resolve, 100)
    })
  }

  function onKind(next: Kind) {
    setKind(next)
    setSignatureTurns(null)
    clearResult()
    setInfo('')
    // on a phone the sidebar covers the page, so choosing from it puts it away
    if (!window.matchMedia(WIDE).matches) setSidebar(false)
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

    const extension = spec.extension ?? spec.format
    if (!exported) {
      setFailure(
        spec.format === 'png'
          ? `As a PNG this picture is larger than ${spec.maxKb} KB, and a PNG cannot be made smaller. ` +
              'If the portal allows JPG, choose that; otherwise check the size and the KB limit.'
          : `${spec.widthPx} x ${spec.heightPx} px cannot fit into ${spec.maxKb} KB at a readable quality. ` +
              'Check the size and the KB limit against the portal.',
      )
      return
    }
    const { bytes, quality, paddedBytes, measured, problems } = exported
    // the same readings of 1 KB as the validator: 1000 bytes for a maximum, 1024 for a minimum
    const sizeOk =
      (spec.maxKb === undefined || measured.bytes <= spec.maxKb * 1000) &&
      (spec.minKb === undefined || measured.bytes >= spec.minKb * 1024)
    const notes = [
      spec.format === 'png'
        ? 'Saved as a PNG, which keeps every pixel exactly.'
        : `Saved at JPG quality ${quality}.`,
    ]
    if (paddedBytes > 0) {
      notes.push(`Padded by ${(paddedBytes / 1000).toFixed(1)} KB to reach the minimum size.`)
    }
    setSummary({
      valid: problems.length === 0,
      checks: [
        {
          label: 'Dimensions',
          value: `${measured.widthPx} x ${measured.heightPx} px`,
          wanted: `Form asks for ${spec.widthPx} x ${spec.heightPx} px`,
          ok: measured.widthPx === spec.widthPx && measured.heightPx === spec.heightPx,
        },
        {
          label: 'File size',
          value: `${(measured.bytes / 1000).toFixed(1)} KB`,
          wanted: `Form asks for ${limitText(spec)}`,
          ok: sizeOk,
        },
        {
          label: 'Format',
          value: measured.format === 'unknown' ? 'Unknown' : `${measured.format.toUpperCase()} (.${extension})`,
          wanted: `Form asks for ${extension.toUpperCase()}`,
          ok: measured.format === spec.format,
        },
      ],
      widthPx: measured.widthPx,
      heightPx: measured.heightPx,
      extension,
      notes,
    })
    if (problems.length === 0) {
      // copy into a fresh buffer: Blob does not accept a view over a shared one
      const type = spec.format === 'png' ? 'image/png' : 'image/jpeg'
      setDownload(URL.createObjectURL(new Blob([bytes.slice()], { type })))
    }
  }

  const strokeRect = (ctx: ReturnType<typeof drawSource>, rect: Rect, colour: string) => {
    ctx.lineWidth = 4
    ctx.strokeStyle = colour
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  }

  /** `forcedTurns` overrides the guess of which way up a signature is. */
  async function onCreate(forcedTurns?: number) {
    if (!picture || !resolved.ok) return
    const file = picture.blob
    const spec = resolved.spec
    const chosen = isFull(region) ? undefined : region
    const loaded = `${picture.name}: ${(file.size / 1000).toFixed(0)} KB`
    setBusy(true)
    setInfo('')
    clearResult()

    try {
      if (kind === 'signature') {
        const result = await processSignature(file, spec, chosen, forcedTurns, onStage)
        const { image, stages, timingsMs } = result
        setSignatureTurns(result.turns)
        const ctx = drawSource(image)
        const turned = result.turns === 0 ? '' : `, turned ${result.turns * 90} degrees`
        setDetail(`${loaded} -> ${image.width} x ${image.height} px${turned}. ${timingText(timingsMs)}`)
        if (!stages) {
          setFailure('No signature found. Use a photo of dark ink on plain, light paper.')
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
        onStage,
      )
      const ctx = drawSource(image)
      const turned = turns === 0 ? '' : `, turned ${turns * 90} degrees`
      setDetail(
        `${loaded} -> ${image.width} x ${image.height} px${turned}, ` +
          `${faceCount} face(s). ${timingText(timingsMs)}`,
      )

      if (!stages) {
        setFailure(
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
      setInfo(`Something went wrong: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
      setStage('')
    }
  }

  const toggle = 'flex items-center justify-between gap-3 text-sm font-medium'

  return (
    <div className="flex min-h-screen">
      {/* on a phone the open sidebar covers the page; tapping beside it puts it away */}
      {sidebar && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebar(false)}
        />
      )}

      <aside
        id="sidebar"
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex flex-col gap-6 border-r border-[var(--line)] bg-[var(--bg)] p-4 transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebar ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-[4.75rem]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="card flex h-11 w-11 flex-none items-center justify-center">
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
          </span>
          {sidebar && (
            <div className="min-w-0 flex-1">
              <p className="text-lg leading-tight font-extrabold tracking-tight">Formify</p>
              <p className="text-soft text-xs font-medium">Form-ready in a minute</p>
            </div>
          )}
          <button
            className="nm-btn nm-btn-icon lg:hidden"
            aria-label="Close sidebar"
            onClick={() => setSidebar(false)}
          >
            <CloseIcon />
          </button>
        </div>

        <nav aria-label="What to make" className="flex flex-col gap-2">
          {sidebar && <p className="text-soft px-3 text-xs font-bold tracking-wide">CREATE</p>}
          {KINDS.map(({ value, label, Icon }) => (
            <label
              key={value}
              className={`nm-nav ${sidebar ? '' : 'justify-center !px-0'}`}
              title={sidebar ? undefined : label}
            >
              <input
                id={`kind-${value}`}
                className="sr-only"
                type="radio"
                name="kind"
                checked={kind === value}
                onChange={() => onKind(value)}
              />
              <Icon />
              <span className={sidebar ? '' : 'sr-only'}>{label}</span>
            </label>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          {sidebar && (
            <div className="card flex gap-3 p-3">
              <LockIcon />
              <p className="text-xs leading-relaxed font-medium">
                <span className="font-bold">Private by design.</span> Your photo is processed in this
                browser and is never uploaded.
              </p>
            </div>
          )}
          <button
            id="theme"
            className={`nm-btn ${sidebar ? 'justify-start' : 'nm-btn-icon self-center'}`}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={switchTheme}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            {sidebar && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
          <button
            id="sidebar-toggle"
            className="nm-btn nm-btn-icon"
            aria-label={sidebar ? 'Collapse sidebar' : 'Open sidebar'}
            aria-expanded={sidebar}
            aria-controls="sidebar"
            onClick={() => setSidebar(!sidebar)}
          >
            <SidebarIcon />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">
              {current.title}
            </h1>
            <p className="text-soft hidden text-sm sm:block">{current.lead}</p>
          </div>
          <p className="card ml-auto hidden flex-none items-center gap-2 !rounded-full px-3 py-1.5 text-xs font-bold md:flex">
            <LockIcon size={16} />
            On-device
          </p>
        </header>

        {/* on a phone: picture, form, result, in that order; on a wide screen the form sits on the right */}
        <main className="grid flex-1 content-start gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_23rem] xl:grid-rows-[auto_auto_auto]">
          <section aria-label="Your picture" className="card flex min-w-0 flex-col gap-4 p-5">
            <Step
              number={1}
              title={kind === 'photo' ? 'Add your photo' : 'Add a photo of your signature'}
              hint={
                preview
                  ? 'Drag the box or its corners to choose the part to use.'
                  : kind === 'photo'
                    ? 'A front-facing photo in even light works best.'
                    : 'Dark ink on light paper works best. Ruled paper is fine.'
              }
            />
            <div
              className={`nm-inset nm-drop p-3 ${dragging ? 'outline-2 outline-offset-2 outline-[var(--primary-dark)]' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
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
                  onError={() => {
                    const name = picture?.name ?? 'That file'
                    startOver()
                    setInfo(`${name} could not be opened as a picture. Choose a JPG or PNG file.`)
                  }}
                />
              ) : (
                <label
                  htmlFor="photo"
                  className="flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--shadow-dark)] p-6 text-center"
                >
                  <span className="card flex h-14 w-14 items-center justify-center">
                    <UploadIcon size={26} />
                  </span>
                  <span className="text-base font-bold">
                    {dragging ? 'Drop it to add it' : 'Choose a file or drop it here'}
                  </span>
                  <span className="text-soft text-sm">JPG or PNG, from your phone or computer</span>
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
            {orienting && (
              <p id="orienting" role="status" className="flex items-center gap-2.5 text-sm font-semibold">
                <span className="nm-spinner" />
                Checking which way up it is
              </p>
            )}
            {turnNote && (
              <p id="turn-note" className="nm-note">
                <RotateIcon />
                {turnNote}
              </p>
            )}
            {tooSmall && (
              <p id="crop-caution" className="nm-note">
                <AlertIcon />
                {tooSmall}
              </p>
            )}
            {preview && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <label htmlFor="photo" className="nm-btn">
                  <UploadIcon size={18} />
                  Change photo
                </label>
                <button id="rotate-picture" className="nm-btn" disabled={busy || orienting} onClick={rotatePicture}>
                  <RotateIcon size={18} />
                  Rotate
                </button>
                <button id="crop-reset" className="nm-btn" onClick={() => setCustom(null)}>
                  Reset crop
                </button>
                {kind === 'photo' && (
                  <label className={toggle}>
                    <input
                      id="crop-lock"
                      className="nm-switch"
                      type="checkbox"
                      checked={lockShape}
                      onChange={(e) => {
                        setLockShape(e.target.checked)
                        // switching to free-form keeps the box where it is
                        if (!e.target.checked) setCustom({ aspect: undefined, region })
                      }}
                    />
                    Keep the crop in the output's shape
                  </label>
                )}
              </div>
            )}
          </section>

          <aside
            aria-label="Form requirements"
            className="card flex flex-col gap-5 p-5 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start"
          >
            <Step number={2} title="What the form asks for" hint="Copy these from the portal." />
            <SpecForm
              kind={kind}
              fields={fields}
              resolved={resolved}
              suggestions={suggestions}
              onChange={setFields}
            />
            {kind === 'photo' && (
              <label className={toggle}>
                <span>
                  Finer hair edges
                  <span className="text-soft block text-xs font-medium">
                    Downloads a 26 MB model once; a little slower.
                  </span>
                </span>
                <input
                  id="fine-edges"
                  className="nm-switch"
                  type="checkbox"
                  checked={quality === 'fine'}
                  onChange={(e) => setQuality(e.target.checked ? 'fine' : 'fast')}
                />
              </label>
            )}
            <button
              id="create"
              className="nm-btn nm-btn-primary w-full !min-h-12 !text-base"
              disabled={!preview || !resolved.ok || busy || orienting || weighing}
              onClick={() => onCreate()}
            >
              {busy ? <span className="nm-spinner" /> : <SparkIcon />}
              {busy ? 'Working' : weighing || orienting ? 'Checking your photo' : `Create ${kind}`}
            </button>
            {!resolved.ok ? (
              <p id="create-blocked" className="nm-danger -mt-2 text-center text-xs font-semibold">
                Fix what is marked above to continue.
              </p>
            ) : (
              !preview && <p className="text-soft -mt-2 text-center text-xs">Add a photo first.</p>
            )}
            {info && (
              <p id="info" className="nm-danger -mt-2 text-sm font-medium">
                {info}
              </p>
            )}
          </aside>

          <section aria-label="Result" className="card flex min-w-0 flex-col gap-4 p-5 xl:self-start">
            <Step
              number={3}
              title="Download"
              hint={
                hasResult || busy ? undefined : 'Your finished file appears here, checked against the form.'
              }
            />
            {busy && (
              <div id="progress" role="status" className="flex flex-col gap-3">
                <p className="flex items-center gap-2.5 text-sm font-semibold">
                  <span className="nm-spinner" />
                  {stage || 'Starting'}
                </p>
                <div className="nm-progress" />
              </div>
            )}
            {failure && (
              <p className="nm-note">
                <AlertIcon />
                {failure}
              </p>
            )}
            <div className={summary ? 'flex flex-col gap-5 sm:flex-row sm:items-start' : 'hidden'}>
              <div className="nm-inset flex-none self-start p-2">
                <canvas ref={finalRef} className="block h-auto max-h-80 w-auto max-w-full rounded-lg" />
              </div>
              {summary && (
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <p
                    className={`flex items-center gap-2 text-base font-bold ${summary.valid ? 'nm-good' : 'nm-danger'}`}
                  >
                    {summary.valid ? <CheckIcon /> : <AlertIcon />}
                    {summary.valid ? 'Ready to upload' : 'Does not meet the form yet'}
                  </p>
                  <Checklist checks={summary.checks} />
                  <div className="flex flex-wrap gap-3">
                    {download && (
                      <a
                        className="nm-btn nm-btn-primary"
                        href={download}
                        download={`formify-${kind}-${summary.widthPx}x${summary.heightPx}.${summary.extension}`}
                      >
                        <DownloadIcon />
                        Download
                      </a>
                    )}
                    {kind === 'signature' && signatureTurns !== null && (
                      <button
                        id="rotate"
                        className="nm-btn"
                        disabled={busy}
                        onClick={() => onCreate((signatureTurns + 1) % 4)}
                      >
                        <RotateIcon size={18} />
                        Rotate
                      </button>
                    )}
                    <button id="start-over" className="nm-btn" disabled={busy} onClick={startOver}>
                      Start over
                    </button>
                  </div>
                </div>
              )}
            </div>
            {warnings.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold">Check before you upload</p>
                {warnings.map((warning) => (
                  <p key={warning} className="nm-note">
                    <AlertIcon />
                    {warning}
                  </p>
                ))}
              </div>
            )}
            {/* how the result was reached: what was found in the photo, and the cut-out */}
            <details className={hasResult ? 'text-sm' : 'hidden'}>
              <summary className="flex w-fit items-center gap-1.5 rounded-md font-semibold">
                How this was made
                <span className="chevron">
                  <ChevronIcon size={16} />
                </span>
              </summary>
              {summary?.notes.map((note) => (
                <p key={note} className="text-soft mt-3">
                  {note}
                </p>
              ))}
              <p className="text-soft mt-3">{detail}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <canvas ref={sourceRef} className="h-auto w-full rounded-lg" />
                <canvas ref={maskRef} className="h-auto w-full rounded-lg" />
              </div>
            </details>
          </section>

          <section aria-label="Common questions" className="flex min-w-0 flex-col gap-3 xl:col-span-2">
            <h2 className="text-base font-bold">Common questions</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {QUESTIONS.map(({ ask, answer }) => (
                <details key={ask} className="card self-start px-4 py-3">
                  <summary className="flex items-center justify-between gap-3 rounded-md text-sm font-semibold">
                    {ask}
                    <span className="chevron">
                      <ChevronIcon size={18} />
                    </span>
                  </summary>
                  <p className="text-soft mt-2 text-sm leading-relaxed">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </main>

        <footer className="text-soft flex flex-wrap items-center justify-between gap-2 px-4 pb-6 text-xs sm:px-8">
          <p>Formify. Check the result against your portal's own instructions before you upload.</p>
          <a
            className="font-semibold underline underline-offset-2"
            href="https://github.com/Kunal-Khairnar-05/formify"
            target="_blank"
            rel="noreferrer"
          >
            Source on GitHub
          </a>
        </footer>
      </div>
    </div>
  )
}

export default App
