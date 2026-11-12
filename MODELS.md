# Models

Every model file shipped with Formify, where it came from, and its checksum.
`public/models/models.json` carries the same data for the app.

| File | Job | Source | License | Size | SHA-256 | Downloaded |
| --- | --- | --- | --- | --- | --- | --- |
| `face_landmarker.task` | 478 face landmarks | [MediaPipe Face Landmarker, float16, version 1](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task) | Apache-2.0 | 3,758,596 bytes | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` | 2026-11-13 |
| `u2netp.onnx` | Finds the main subject (who is in the photo) | [U²-Net small, ONNX build from the rembg release](https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx); original model: [xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net) | Apache-2.0 | 4,574,861 bytes | `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8` | 2026-11-13 |
| `modnet.onnx` | Portrait matte with hair detail (where the edge is) | [MODNet, ONNX conversion in Xenova/modnet](https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx); original model: [ZHKKKe/MODNet](https://github.com/ZHKKKe/MODNet) | Apache-2.0 | 25,888,640 bytes | `07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9` | 2026-11-13 |

## Notes

- `u2netp.onnx` is float32, unmodified. It is the Day 1 model because it is small and downloads directly.
  The comparison against MODNet and the MediaPipe Selfie Segmenter, and any quantized build, are still to do.
- Input for `u2netp.onnx`: 1 x 3 x 320 x 320, RGB, scaled to [0, 1] then normalised with
  mean (0.485, 0.456, 0.406) and std (0.229, 0.224, 0.225). Output 0 is the mask, 1 x 1 x 320 x 320.
  Confirm these against the model's own input and output metadata when writing `segment.ts`.
- `modnet.onnx` is not kept in git because of its size. `scripts/fetch-models.mjs` downloads it before
  `npm run dev` and `npm run build`, and refuses a file whose SHA-256 differs from the one above.
- Input for `modnet.onnx`: 1 x 3 x H x W, RGB scaled to [-1, 1], with the shorter side at 512 px and both
  sides multiples of 32. Output is the matte, 1 x 1 x H x W, already in [0, 1].
- The MODNet file is a third-party ONNX conversion. Before launch, confirm from the original repository that
  its Apache-2.0 statement covers the pretrained weights.
- The two models are used together: U²-Net decides which person to keep, MODNet supplies the soft edge.
