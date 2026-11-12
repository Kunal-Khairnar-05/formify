# Formify

Turns a selfie and a signature photo into files that meet an application form's exact photo rules.
Everything runs in the browser; the photo never leaves the device.

Status: Day 1, pipeline under construction.

## Run

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```

## Layout

| Path | What lives here |
| --- | --- |
| `src/pipeline/` | Image pipeline: load, landmarks, segmentation, composite, crop, encode, validate |
| `public/models/` | Model files and `models.json` |
| `MODELS.md` | Source, license and checksum of every model |
