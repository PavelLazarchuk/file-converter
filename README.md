# Image Toolbox

**Live app:** https://file-converter-mu-seven.vercel.app

A web app for editing images. Nine independent tools:

Every tool except crop takes up to 20 images at once (20MB for the whole batch, since it travels in a single Server Action request); crop stays single-image because the frame is drawn on one photo.

- **Resize** (`/resize`) — set exact pixel dimensions (1–10000px) with an optional locked aspect ratio and optional rotation (90°/180°/270°, applied before resizing). Four fit modes (`contain` pads, `cover` crops, `fill` stretches, `inside` shrinks) plus a "don't enlarge" switch that maps to sharp's `withoutEnlargement`; the filename records the pixels that actually came out, which can be smaller than the numbers entered. One-click social presets (Instagram post/story, X post and header, Facebook cover, LinkedIn banner, YouTube thumbnail, a 1200×630 OG image, avatar) fill the box and switch the fit to `cover`.
- **Crop** (`/crop`) — trim to a preset aspect ratio (1:1, 4:3, 3:2, 16:9 plus portrait variants) or free-form at any size, as a rectangle or a circle/ellipse with transparent corners (JPEG sources export as PNG to keep the transparency). A preset starts from the largest matching region, centered; the frame can then be dragged, resized by its corners (plus edge handles in free mode) or typed in exactly with the left/top/width/height boxes, which stay linked to the ratio while one is locked. The same social presets lock the frame to that ratio and scale the crop to the exact pixels the platform expects (`cover`, so drift is trimmed rather than stretched).
- **Rotate & Flip** (`/rotate`) — quick 90°/180°/270° buttons or any angle from 0 to 359, plus horizontal mirror and vertical flip, applied after the rotation. A free angle grows the canvas and exposes corners, which are filled with a chosen color or left transparent (JPEG has no alpha, so it always takes the color). A CSS preview shows the result before the upload.
- **Compress** (`/compress`) — reduce file size with an adjustable output quality (1–100, default 80), or aim for a target file size in KB (binary search over quality, capped at 6 encodes and stopping early within 6% of the target; dimensions are never changed). When the target is out of reach the smallest achievable version comes back with a warning and a "download it anyway" button instead of an error. PNG output is palette-quantized, which the UI calls out. All metadata (EXIF, GPS, ICC profile, XMP) is always stripped.
- **Convert** (`/convert`) — convert between JPEG, PNG, WEBP, AVIF, GIF and TIFF, build an ICO favicon from any of 16/32/48/64/128/256px (or a full favicon pack `.zip` with `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` and the `<link>` snippet), or encode the image as a Base64 `data:` URI, copyable as a plain URI, an `<img>` tag or a CSS `background-image`; the target list excludes the source format. GIF is accepted as a source but only its first frame is read (no animation support). SVG is supported both ways, convert-only: as input it is rasterized at its intrinsic size, and as target the image is re-encoded to PNG and embedded in an SVG wrapper as a base64 data URI (no vector tracing).
- **Watermark** (`/watermark`) — stamp text (any color, up to 60 characters) or an uploaded logo onto a batch. Nine anchor positions, a margin in pixels, an opacity applied by multiplying the overlay's alpha channel, and a size given as a share of each image's width — so the same settings hold on a thumbnail and on a 24MP shot. The overlay is never allowed to grow past the photo it lands on, and a live preview runs the same layout helpers the action does. The logo counts against the same 20MB the batch does, since both travel in one request.
- **Metadata** (`/metadata`) — read what a file carries: dimensions, color space, bit depth, DPI, chroma subsampling, the orientation tag, and the EXIF underneath it (camera, lens, exposure, aperture, ISO, focal length, date) including GPS coordinates, which get their own warning. The EXIF block is parsed by a hand-written TIFF reader (`src/lib/exif.ts`) rather than a dependency, and the report comes back as JSON — one file per image, rendered by the form and downloadable. A second action re-encodes clean copies with EXIF, GPS, ICC and XMP dropped and the orientation baked into the pixels.
- **Placeholder** (`/placeholder`) — generate a solid-color placeholder image with custom dimensions, background/text colors and an optional label (defaults to `W × H`); rendered as SVG server-side and rasterized to any supported format. No upload involved.
- **Image to PDF** (`/pdf`) — wrap images into a PDF via [pdf-lib](https://pdf-lib.js.org/), one page each, sized to the image or centered on an A4/Letter page with a 36pt margin. Pages follow the upload order, which the list lets you rearrange.

Every tool ends on the same result card: a preview of the actual output, its dimensions and file size, and how that compares to the upload (`2.4 MB → 480 KB, −80%`), with the download as a deliberate click. A batch lists one row per result plus a single **Download all (.zip)** — the archive is built in the browser by the same store-only writer the favicon pack uses. Turning on "Download automatically" saves the result (or the zip) as soon as it is ready and remembers the choice on that device; nothing is auto-saved when a result carries a warning or part of the batch failed.

A file that cannot be read does not sink the rest of the batch: the readable ones come back as results and the others are listed underneath with the reason.

Images can be dropped, browsed for, or pasted straight from the clipboard with Ctrl/⌘ + V — several at a time on the batch tools.

All processing happens server-side in Server Actions via [sharp](https://sharp.pixelplumbing.com/). Files up to 20MB are accepted and nothing is written to disk (see `/privacy`). A batch is processed sequentially inside the one request so twenty pipelines never run at once on a serverless function. EXIF orientation is baked into the pixels (`autoOrient`), and metadata is stripped by default — resize, crop, rotate, watermark and convert offer a switch to keep it instead. Each client IP gets 40 images per minute — a batch is charged per image, so batching cannot be used to sidestep the budget (reading metadata is the exception, charged as one, since it re-encodes nothing); the counter lives in the server process, so on serverless every instance limits independently — it curbs a single abusive client rather than replacing an edge WAF. The IP comes from `x-forwarded-for`/`x-real-ip`/`cf-connecting-ip`, and when none of them is present the limiter fails open rather than bucketing every visitor together, so a standalone deployment served without a proxy needs a limit at its ingress.

The uploaded format is detected from the file's own bytes (`sharp.metadata()`), not from the browser-supplied MIME type, so a mislabelled or type-less upload gets a real error message instead of a generic failure.

## Languages

The UI ships in English and is fully translated through [next-intl](https://next-intl.dev). Every user-facing string — form labels, dropzone copy, error messages, page titles and the JSON-LD — lives in `messages/en.json`; no component holds prose of its own. The default locale is served unprefixed (`/compress`), any other one is prefixed (`/de/compress`), and `src/proxy.ts` rewrites between the two.

Adding a language is two edits:

1. copy `messages/en.json` to `messages/<locale>.json` and translate it;
2. add the locale to `routing.locales` in `src/i18n/routing.ts`.

Keys are never collected by hand after that: `npm run i18n:sync` copies every key English has into the other catalogs, prefixing untranslated values with `TODO: ` and dropping stray ones (`npm run i18n:check` does the same as a CI gate). Nothing can drift silently either — `messages/en.json` types the message shape, so an unknown key fails `npm run typecheck`, and `src/lib/messages.test.ts` fails on any key mismatch between catalogs.

Routing, `hreflang`, the sitemap, `<html lang>`, number formatting and plural rules follow automatically. A language switcher is not built yet; `usePathname`/`useRouter` from `src/i18n/navigation.ts` are already in place for one.

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

## SEO and PWA files

`src/app/` generates them from `src/lib/site.ts`, which is also the single source of truth for the tool list shown on the landing page and in the footer:

| Route                   | Source                         |
| ----------------------- | ------------------------------ |
| `/sitemap.xml`          | `sitemap.ts`                   |
| `/robots.txt`           | `robots.ts`                    |
| `/manifest.webmanifest` | `manifest.ts`                  |
| `/opengraph-image`      | `[locale]/opengraph-image.tsx` |
| `/icon.svg`             | `icon.svg`                     |
| `/apple-icon.png`       | `apple-icon.png`               |

PWA icons live in `public/` (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) and are generated from `src/app/icon.svg`.
