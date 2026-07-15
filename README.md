# Image Toolbox

A web app for editing images. Five independent tools:

- **Resize** (`/resize`) — set exact pixel dimensions (1–10000px) with an optional locked aspect ratio and optional rotation (90°/180°/270°, applied before resizing); processed with sharp using `fit: contain`.
- **Crop** (`/crop`) — trim to a preset aspect ratio (1:1, 4:3, 3:2, 16:9 plus portrait variants); the largest matching region is kept, centered.
- **Compress** (`/compress`) — reduce file size with an adjustable output quality (1–100, default 80), or aim for a target file size in KB (binary search over quality; dimensions are never changed); all metadata (EXIF, GPS, ICC profile, XMP) is always stripped.
- **Convert** (`/convert`) — convert between JPEG, PNG, WEBP and AVIF, build a multi-size ICO favicon (16/32/48px PNG entries), or encode the uploaded file as a Base64 `data:` URI (shown for copying, embedded byte-for-byte); the target list excludes the source format. SVG is supported both ways, convert-only: as input it is rasterized at its intrinsic size, and as target the image is re-encoded to PNG and embedded in an SVG wrapper as a base64 data URI (no vector tracing).
- **Placeholder** (`/placeholder`) — generate a solid-color placeholder image with custom dimensions, background/text colors and an optional label (defaults to `W × H`); rendered as SVG server-side and rasterized to any supported format. No upload involved.

All processing happens server-side in Server Actions via [sharp](https://sharp.pixelplumbing.com/). Files up to 20MB are accepted; the processed file downloads immediately. EXIF orientation is baked into the pixels (`autoOrient`), and metadata is stripped by default — resize, crop and convert offer a switch to keep it instead.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                 | Purpose                    |
| ---------------------- | -------------------------- |
| `npm run dev`          | Start the dev server       |
| `npm run build`        | Production build           |
| `npm run start`        | Serve the production build |
| `npm run lint`         | ESLint                     |
| `npm run typecheck`    | TypeScript `tsc --noEmit`  |
| `npm run format`       | Prettier write             |
| `npm run format:check` | Prettier check             |
