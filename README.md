# Image Toolbox

**Live app:** https://file-converter-mu-seven.vercel.app

A web app for editing images. Six independent tools:

Resize, compress, convert and PDF take up to 20 images at once (20MB for the whole batch, since it travels in a single Server Action request); crop stays single-image because the frame is drawn on one photo.

- **Resize** (`/resize`) — set exact pixel dimensions (1–10000px) with an optional locked aspect ratio and optional rotation (90°/180°/270°, applied before resizing). Four fit modes (`contain` pads, `cover` crops, `fill` stretches, `inside` shrinks) plus a "don't enlarge" switch that maps to sharp's `withoutEnlargement`; the filename records the pixels that actually came out, which can be smaller than the numbers entered.
- **Crop** (`/crop`) — trim to a preset aspect ratio (1:1, 4:3, 3:2, 16:9 plus portrait variants) or free-form at any size, as a rectangle or a circle/ellipse with transparent corners (JPEG sources export as PNG to keep the transparency). A preset starts from the largest matching region, centered; the frame can then be dragged, resized by its corners (plus edge handles in free mode) or typed in exactly with the left/top/width/height boxes, which stay linked to the ratio while one is locked.
- **Compress** (`/compress`) — reduce file size with an adjustable output quality (1–100, default 80), or aim for a target file size in KB (binary search over quality, capped at 6 encodes and stopping early within 6% of the target; dimensions are never changed). When the target is out of reach the smallest achievable version comes back with a warning and a "download it anyway" button instead of an error. PNG output is palette-quantized, which the UI calls out. All metadata (EXIF, GPS, ICC profile, XMP) is always stripped.
- **Convert** (`/convert`) — convert between JPEG, PNG, WEBP, AVIF, GIF and TIFF, build an ICO favicon from any of 16/32/48/64/128/256px (or a full favicon pack `.zip` with `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` and the `<link>` snippet), or encode the image as a Base64 `data:` URI, copyable as a plain URI, an `<img>` tag or a CSS `background-image`; the target list excludes the source format. GIF is accepted as a source but only its first frame is read (no animation support). SVG is supported both ways, convert-only: as input it is rasterized at its intrinsic size, and as target the image is re-encoded to PNG and embedded in an SVG wrapper as a base64 data URI (no vector tracing).
- **Placeholder** (`/placeholder`) — generate a solid-color placeholder image with custom dimensions, background/text colors and an optional label (defaults to `W × H`); rendered as SVG server-side and rasterized to any supported format. No upload involved.
- **Image to PDF** (`/pdf`) — wrap images into a PDF via [pdf-lib](https://pdf-lib.js.org/), one page each, sized to the image or centered on an A4/Letter page with a 36pt margin. Pages follow the upload order, which the list lets you rearrange.

Every tool ends on the same result card: a preview of the actual output, its dimensions and file size, and how that compares to the upload (`2.4 MB → 480 KB, −80%`), with the download as a deliberate click. A batch lists one row per result plus a single **Download all (.zip)** — the archive is built in the browser by the same store-only writer the favicon pack uses. Turning on "Download automatically" saves the result (or the zip) as soon as it is ready and remembers the choice on that device; nothing is auto-saved when a result carries a warning or part of the batch failed.

A file that cannot be read does not sink the rest of the batch: the readable ones come back as results and the others are listed underneath with the reason.

Images can be dropped, browsed for, or pasted straight from the clipboard with Ctrl/⌘ + V — several at a time on the batch tools.

All processing happens server-side in Server Actions via [sharp](https://sharp.pixelplumbing.com/). Files up to 20MB are accepted and nothing is written to disk (see `/privacy`). A batch is processed sequentially inside the one request so twenty pipelines never run at once on a serverless function. EXIF orientation is baked into the pixels (`autoOrient`), and metadata is stripped by default — resize, crop and convert offer a switch to keep it instead. Each client IP gets 40 images per minute — a batch is charged per image, so batching cannot be used to sidestep the budget; the counter lives in the server process, so on serverless every instance limits independently — it curbs a single abusive client rather than replacing an edge WAF. The IP comes from `x-forwarded-for`/`x-real-ip`/`cf-connecting-ip`, and when none of them is present the limiter fails open rather than bucketing every visitor together, so a standalone deployment served without a proxy needs a limit at its ingress.

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
| `npm test`             | Vitest, single run         |
| `npm run test:watch`   | Vitest, watch mode         |
| `npm run format`       | Prettier write             |
| `npm run format:check` | Prettier check             |

## Tests

[Vitest](https://vitest.dev) runs two projects out of one config (`vitest.config.mts`):

- **node** — `src/**/*.test.ts`. Covers the pure helpers, the zod schemas, the rate limiter and the Server Actions themselves, which are called directly with a `FormData` built from images generated by sharp. `headers()` throws outside a request scope, the limiter fails open on that, and that is what makes the direct calls possible. The hand-written ICO and ZIP writers are checked byte by byte, and the archive is also handed to `unzip -t`.
- **dom** — `src/**/*.test.tsx` plus `src/**/*.dom.test.ts` for browser-only modules without JSX. jsdom has no object URLs and no image decoder, so `vitest.setup.ts` stubs both.

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
