# Models

Every model file shipped with Formify, where it came from, and its checksum.
`public/models/models.json` carries the same data for the app.

| File | Job | Source | License | Size | SHA-256 | Downloaded |
| --- | --- | --- | --- | --- | --- | --- |
| `face_landmarker.task` | 478 face landmarks | [MediaPipe Face Landmarker, float16, version 1](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task) | Apache-2.0 | 3,758,596 bytes | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` | 2026-11-13 |
| `u2netp.onnx` | Foreground mask (Day 1 stand-in) | [U²-Net small, ONNX build from the rembg release](https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx); original model: [xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net) | Apache-2.0 | 4,574,861 bytes | `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8` | 2026-11-13 |

## Notes

- `u2netp.onnx` is float32, unmodified. It is the Day 1 model because it is small and downloads directly.
  The comparison against MODNet and the MediaPipe Selfie Segmenter, and any quantized build, are still to do.
- Input for `u2netp.onnx`: 1 x 3 x 320 x 320, RGB, scaled to [0, 1] then normalised with
  mean (0.485, 0.456, 0.406) and std (0.229, 0.224, 0.225). Output 0 is the mask, 1 x 1 x 320 x 320.
  Confirm these against the model's own input and output metadata when writing `segment.ts`.
