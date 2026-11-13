import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export type Landmark = { x: number; y: number }

let landmarker: Promise<FaceLandmarker> | undefined

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
