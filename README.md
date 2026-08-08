# Image Toolbox

**Live app:** https://file-converter-mu-seven.vercel.app

A web app for editing images. Six independent tools:

- **Resize** (`/resize`) — set exact pixel dimensions (1–10000px) with an optional locked aspect ratio and optional rotation (90°/180°/270°, applied before resizing). Four fit modes (`contain` pads, `cover` crops, `fill` stretches, `inside` shrinks) plus a "don't enlarge" switch that maps to sharp's `withoutEnlargement`; the filename records the pixels that actually came out, which can be smaller than the numbers entered.
- **Crop** (`/crop`) — trim to a preset aspect ratio (1:1, 4:3, 3:2, 16:9 plus portrait variants), as a rectangle or a circle/ellipse with transparent corners (JPEG sources export as PNG to keep the transparency); the largest matching region is kept, centered.
- **Compress** (`/compress`) — reduce file size with an adjustable output quality (1–100, default 80), or aim for a target file size in KB (binary search over quality, capped at 6 encodes and stopping early within 6% of the target; dimensions are never changed). When the target is out of reach the smallest achievable version comes back with a warning and a "download it anyway" button instead of an error. PNG output is palette-quantized, which the UI calls out. All metadata (EXIF, GPS, ICC profile, XMP) is always stripped.
- **Convert** (`/convert`) — convert between JPEG, PNG, WEBP, AVIF, GIF and TIFF, build an ICO favicon from any of 16/32/48/64/128/256px (or a full favicon pack `.zip` with `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` and the `<link>` snippet), or encode the image as a Base64 `data:` URI, copyable as a plain URI, an `<img>` tag or a CSS `background-image`; the target list excludes the source format. GIF is accepted as a source but only its first frame is read (no animation support). SVG is supported both ways, convert-only: as input it is rasterized at its intrinsic size, and as target the image is re-encoded to PNG and embedded in an SVG wrapper as a base64 data URI (no vector tracing).
- **Placeholder** (`/placeholder`) — generate a solid-color placeholder image with custom dimensions, background/text colors and an optional label (defaults to `W × H`); rendered as SVG server-side and rasterized to any supported format. No upload involved.
- **Image to PDF** (`/pdf`) — wrap a single image into a one-page PDF via [pdf-lib](https://pdf-lib.js.org/), sized to the image or centered on an A4/Letter page with a 36pt margin.

All processing happens server-side in Server Actions via [sharp](https://sharp.pixelplumbing.com/). Files up to 20MB are accepted; the processed file downloads immediately, and nothing is written to disk (see `/privacy`). EXIF orientation is baked into the pixels (`autoOrient`), and metadata is stripped by default — resize, crop and convert offer a switch to keep it instead.

The uploaded format is detected from the file's own bytes (`sharp.metadata()`), not from the browser-supplied MIME type, so a mislabelled or type-less upload gets a real error message instead of a generic failure.

The theme follows the OS by default and can be pinned to light or dark from the header; the choice lives in `localStorage` and is applied before first paint by a small inline script (`src/lib/theme.ts`).

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set `NEXT_PUBLIC_SITE_URL` to override the canonical origin used by the sitemap, `robots.txt` and Open Graph tags (defaults to the production URL in `src/lib/site.ts`).

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

## SEO and PWA files

`src/app/` generates them from `src/lib/site.ts`, which is also the single source of truth for the tool list shown on the landing page and in the footer:

| Route                   | Source                |
| ----------------------- | --------------------- |
| `/sitemap.xml`          | `sitemap.ts`          |
| `/robots.txt`           | `robots.ts`           |
| `/manifest.webmanifest` | `manifest.ts`         |
| `/opengraph-image`      | `opengraph-image.tsx` |
| `/icon.svg`             | `icon.svg`            |
| `/apple-icon.png`       | `apple-icon.png`      |

PWA icons live in `public/` (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) and are generated from `src/app/icon.svg`.
