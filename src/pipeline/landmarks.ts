import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export type Landmark = { x: number; y: number }

let landmarker: Promise<FaceLandmarker> | undefined

function getLandmarker(): Promise<FaceLandmarker> {
  landmarker ??= FilesetResolver.forVisionTasks('/mediapipe').then((fileset) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
      runningMode: 'IMAGE',
      // ask for two so a second person in the photo can be reported
      numFaces: 2,
    }),
  )
  return landmarker
}

/** Step 2a: one array of 478 normalised landmarks per face found. */
export async function detectFaces(image: ImageBitmap): Promise<Landmark[][]> {
  const result = (await getLandmarker()).detect(image)
  return result.faceLandmarks
}
