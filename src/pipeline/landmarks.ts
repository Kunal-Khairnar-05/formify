import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export type Landmark = { x: number; y: number }

let landmarker: Promise<FaceLandmarker> | undefined

/**
 * The drawing surface the face model works on, when it runs in a worker.
 *
 * Left to itself the library decides whether a worker can have one from the browser's name:
 * anything calling itself Safari without a version of 17 or more gets "no", and it then
 * asks the page's `document` for a canvas. A worker has no `document`, so the photo fails
 * with "Can't find variable: document". Chrome, Firefox and in-app browsers on an iPhone
 * all call themselves Safari with no version at all, so every one of them hit this, whatever
 * the iPhone could really do. Handing the library a surface made here takes the decision
 * away from it.
 */
function workerCanvas(): OffscreenCanvas {
  // asked of a spare surface: asking the real one would fix its settings before the library sets them
  const usable = typeof OffscreenCanvas !== 'undefined' && new OffscreenCanvas(1, 1).getContext('webgl2')
  if (!usable) {
    throw new Error(
      'This browser cannot make photos: it is too old to draw in the background. ' +
        'On an iPhone or iPad, update to iOS 17 or later. Signatures still work.',
    )
  }
  return new OffscreenCanvas(1, 1)
}

function getLandmarker(): Promise<FaceLandmarker> {
  // In a worker the runtime's loader is imported as a module; on a page it is added as a
  // script. MediaPipe ships one file for each and has to be told which to use.
  const inWorker = typeof document === 'undefined'
  landmarker ??= FilesetResolver.forVisionTasks('/mediapipe', inWorker).then((fileset) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
      runningMode: 'IMAGE',
      // ask for two so a second person in the photo can be reported
      numFaces: 2,
      ...(inWorker ? { canvas: workerCanvas() } : {}),
    }),
  )
  return landmarker
}

/** Load the face model ahead of the first photo. */
export async function warmLandmarker(): Promise<void> {
  await getLandmarker()
}

/** Step 2a: one array of 478 normalised landmarks per face found. */
export async function detectFaces(image: ImageBitmap): Promise<Landmark[][]> {
  const result = (await getLandmarker()).detect(image)
  return result.faceLandmarks
}
