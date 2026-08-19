export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '20MB';

export const MAX_BATCH_FILES = 20;
export const MAX_BATCH_BYTES = MAX_FILE_SIZE;
export const MAX_BATCH_SIZE_LABEL = MAX_FILE_SIZE_LABEL;

export const BATCH_CHUNK_SIZE = 5;

export const DIMENSION_LIMITS = { min: 1, max: 10000 } as const;
export const QUALITY_LIMITS = { min: 1, max: 100 } as const;
export const DEFAULT_QUALITY = 80;

export const MAX_INPUT_PIXELS = DIMENSION_LIMITS.max * DIMENSION_LIMITS.max;

export const FORMAT_KEYS = ['jpeg', 'png', 'webp', 'avif'] as const;

export type ImageFormat = (typeof FORMAT_KEYS)[number];

export const COMPARE_FORMAT_KEYS = ['jpeg', 'png', 'webp', 'avif'] as const;

export const CONVERT_SOURCE_KEYS = [...FORMAT_KEYS, 'gif', 'svg'] as const;

export type ConvertSource = (typeof CONVERT_SOURCE_KEYS)[number];

export const CONVERT_TARGET_KEYS = [...FORMAT_KEYS, 'gif', 'tiff', 'svg', 'ico', 'base64'] as const;

export type ConvertTarget = (typeof CONVERT_TARGET_KEYS)[number];

export const IMAGE_FORMATS: Record<ConvertTarget, { mimeType: string; extension: string }> = {
    jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
    png: { mimeType: 'image/png', extension: 'png' },
    webp: { mimeType: 'image/webp', extension: 'webp' },
    avif: { mimeType: 'image/avif', extension: 'avif' },
    gif: { mimeType: 'image/gif', extension: 'gif' },
    tiff: { mimeType: 'image/tiff', extension: 'tiff' },
    svg: { mimeType: 'image/svg+xml', extension: 'svg' },
    ico: { mimeType: 'image/x-icon', extension: 'ico' },
    base64: { mimeType: 'text/plain', extension: 'txt' },
};

export const STRIP_QUALITY: Record<ImageFormat, number> = {
    jpeg: 95,
    webp: 95,
    avif: 80,
    png: 100,
};

const SHARP_FORMAT_ALIASES: Record<string, ConvertSource> = {
    jpeg: 'jpeg',
    jpg: 'jpeg',
    png: 'png',
    webp: 'webp',
    avif: 'avif',
    heif: 'avif',
    gif: 'gif',
    svg: 'svg',
};

export function convertSourceFromSharpFormat(format: string | undefined): ConvertSource | null {
    return SHARP_FORMAT_ALIASES[format ?? ''] ?? null;
}

export const ICO_SIZE_OPTIONS = [16, 32, 48, 64, 128, 256] as const;

export const DEFAULT_ICO_SIZES = [16, 32, 48] as const;

export const ZIP_MIME_TYPE = 'application/zip';

export const FAVICON_PACK = {
    appleTouch: 180,
    manifestSizes: [192, 512],
} as const;

export const BASE64_OUTPUT_KEYS = ['uri', 'img', 'css'] as const;

export type Base64Output = (typeof BASE64_OUTPUT_KEYS)[number];

export const BASE64_OUTPUTS: Record<Base64Output, { extension: string }> = {
    uri: { extension: 'txt' },
    img: { extension: 'html' },
    css: { extension: 'css' },
};

export function formatBase64Output(kind: Base64Output, dataUri: string, alt: string): string {
    switch (kind) {
        case 'uri':
            return dataUri;
        case 'img':
            return `<img src="${dataUri}" alt="${alt}" />`;
        case 'css':
            return `.image {\n    background-image: url('${dataUri}');\n}`;
    }
}

export const ROTATION_KEYS = ['0', '90', '180', '270'] as const;

export type Rotation = (typeof ROTATION_KEYS)[number];

export function rotationSwapsDimensions(rotation: Rotation): boolean {
    return rotation === '90' || rotation === '270';
}

export const ROTATE_ANGLE_LIMITS = { min: 0, max: 359 } as const;

export const ROTATE_ANGLE_PRESETS = [90, 180, 270] as const;

export const ROTATE_DEFAULTS = { angle: '0', background: '#ffffff' } as const;

export type RotateOptions = { angle: number; flipHorizontal: boolean; flipVertical: boolean };

export function rotateFillsCorners(angle: number): boolean {
    return angle % 90 !== 0;
}

export function rotateSuffix({ angle, flipHorizontal, flipVertical }: RotateOptions): string {
    const parts = [
        ...(angle ? [`${angle}deg`] : []),
        ...(flipHorizontal ? ['mirrored'] : []),
        ...(flipVertical ? ['flipped'] : []),
    ];

    return parts.length ? parts.join('-') : 'rotated';
}

export const FILTER_EFFECT_KEYS = ['none', 'grayscale', 'sepia', 'invert'] as const;

export type FilterEffect = (typeof FILTER_EFFECT_KEYS)[number];

export const BRIGHTNESS_LIMITS = { min: 10, max: 300 } as const;
export const SATURATION_LIMITS = { min: 0, max: 300 } as const;
export const HUE_LIMITS = { min: 0, max: 360 } as const;

export const BLUR_LIMITS = { min: 0, max: 20 } as const;

export const FILTER_DEFAULTS = {
    effect: 'none',
    brightness: '100',
    saturation: '100',
    hue: '0',
    blur: '0',
} as const;

export type FilterOptions = {
    effect: FilterEffect;
    brightness: number;
    saturation: number;
    hue: number;
    blur: number;
    sharpen: boolean;
};

export const FILTER_PRESET_KEYS = ['bw', 'vintage', 'vivid', 'cool', 'soft'] as const;

export type FilterPresetKey = (typeof FILTER_PRESET_KEYS)[number];

export const FILTER_PRESETS: Record<FilterPresetKey, FilterOptions> = {
    bw: { effect: 'grayscale', brightness: 105, saturation: 100, hue: 0, blur: 0, sharpen: true },
    vintage: { effect: 'sepia', brightness: 105, saturation: 90, hue: 0, blur: 0, sharpen: false },
    vivid: { effect: 'none', brightness: 105, saturation: 160, hue: 0, blur: 0, sharpen: true },
    cool: { effect: 'none', brightness: 100, saturation: 110, hue: 200, blur: 0, sharpen: false },
    soft: { effect: 'none', brightness: 105, saturation: 95, hue: 0, blur: 3, sharpen: false },
};

export function filtersChangeNothing(options: FilterOptions): boolean {
    return (
        options.effect === 'none' &&
        options.brightness === 100 &&
        options.saturation === 100 &&
        options.hue === 0 &&
        options.blur === 0 &&
        !options.sharpen
    );
}

export function filterSuffix(options: FilterOptions): string {
    return options.effect === 'none' ? 'filtered' : options.effect;
}

export function filterCss({ effect, brightness, saturation, hue, blur }: FilterOptions): string {
    const parts = [
        ...(effect === 'grayscale' ? ['grayscale(1)'] : []),
        ...(effect === 'sepia' ? ['sepia(1)'] : []),
        ...(effect === 'invert' ? ['invert(1)'] : []),
        ...(brightness === 100 ? [] : [`brightness(${brightness / 100})`]),
        ...(saturation === 100 ? [] : [`saturate(${saturation / 100})`]),
        ...(hue === 0 ? [] : [`hue-rotate(${hue}deg)`]),
        ...(blur === 0 ? [] : [`blur(${blur}px)`]),
    ];

    return parts.length ? parts.join(' ') : 'none';
}

export const RESIZE_FIT_KEYS = ['contain', 'cover', 'fill', 'inside'] as const;

export type ResizeFit = (typeof RESIZE_FIT_KEYS)[number];

export function fitPads(fit: ResizeFit): boolean {
    return fit === 'contain';
}

export const COMPRESS_MODES = ['quality', 'size'] as const;

export type CompressMode = (typeof COMPRESS_MODES)[number];

export const TARGET_SIZE_LIMITS = { min: 1, max: 20480 } as const; // KB
export const DEFAULT_TARGET_KB = 500;

export const TARGET_SIZE_PRESETS = [
    { label: '100 KB', kb: 100 },
    { label: '250 KB', kb: 250 },
    { label: '500 KB', kb: 500 },
    { label: '1 MB', kb: 1024 },
    { label: '1.5 MB', kb: 1536 },
    { label: '2 MB', kb: 2048 },
] as const;

export const ASPECT_RATIO_KEYS = ['1:1', '4:3', '3:2', '16:9', '3:4', '2:3', '9:16'] as const;

export type AspectRatio = (typeof ASPECT_RATIO_KEYS)[number];

export const ASPECT_RATIOS: Record<AspectRatio, { width: number; height: number }> = {
    '1:1': { width: 1, height: 1 },
    '4:3': { width: 4, height: 3 },
    '3:2': { width: 3, height: 2 },
    '16:9': { width: 16, height: 9 },
    '3:4': { width: 3, height: 4 },
    '2:3': { width: 2, height: 3 },
    '9:16': { width: 9, height: 16 },
};

export const CROP_RATIO_KEYS = ['free', ...ASPECT_RATIO_KEYS] as const;

export type CropRatio = (typeof CROP_RATIO_KEYS)[number];

export function cropRatioSize(ratio: CropRatio): { width: number; height: number } | null {
    return ratio === 'free' ? null : ASPECT_RATIOS[ratio];
}

const RATIO_TOLERANCE = 0.001;

export function cropRatioForSize({ width, height }: { width: number; height: number }): CropRatio {
    const target = width / height;

    return (
        ASPECT_RATIO_KEYS.find(
            key =>
                Math.abs(ASPECT_RATIOS[key].width / ASPECT_RATIOS[key].height - target) <
                RATIO_TOLERANCE
        ) ?? 'free'
    );
}

export const CROP_SHAPE_KEYS = ['rectangle', 'circle'] as const;

export type CropShape = (typeof CROP_SHAPE_KEYS)[number];

export function circleOutputFormat(format: ImageFormat): ImageFormat {
    return format === 'jpeg' ? 'png' : format;
}

export type CropBox = { left: number; top: number; width: number; height: number };

export function clampCropBox(box: CropBox, srcWidth: number, srcHeight: number): CropBox {
    const width = Math.max(1, Math.min(Math.round(box.width), srcWidth));
    const height = Math.max(1, Math.min(Math.round(box.height), srcHeight));

    return {
        left: Math.max(0, Math.min(Math.round(box.left), srcWidth - width)),
        top: Math.max(0, Math.min(Math.round(box.top), srcHeight - height)),
        width,
        height,
    };
}

export function centeredCrop(
    srcWidth: number,
    srcHeight: number,
    ratioWidth: number,
    ratioHeight: number
): { left: number; top: number; width: number; height: number } {
    let width = srcWidth;
    let height = Math.round((srcWidth * ratioHeight) / ratioWidth);

    if (height > srcHeight) {
        height = srcHeight;
        width = Math.round((srcHeight * ratioWidth) / ratioHeight);
    }

    width = Math.max(1, Math.min(width, srcWidth));
    height = Math.max(1, Math.min(height, srcHeight));

    return {
        left: Math.floor((srcWidth - width) / 2),
        top: Math.floor((srcHeight - height) / 2),
        width,
        height,
    };
}

const FREE_CROP_SCALE = 0.8;

export function defaultFreeCrop(srcWidth: number, srcHeight: number): CropBox {
    const width = Math.max(1, Math.round(srcWidth * FREE_CROP_SCALE));
    const height = Math.max(1, Math.round(srcHeight * FREE_CROP_SCALE));

    return clampCropBox(
        {
            left: Math.floor((srcWidth - width) / 2),
            top: Math.floor((srcHeight - height) / 2),
            width,
            height,
        },
        srcWidth,
        srcHeight
    );
}

export const SIZE_PRESET_KEYS = [
    'instagram-post',
    'instagram-portrait',
    'instagram-story',
    'x-post',
    'x-header',
    'facebook-cover',
    'linkedin-banner',
    'youtube-thumbnail',
    'og-image',
    'avatar',
] as const;

export type SizePresetKey = (typeof SIZE_PRESET_KEYS)[number];

export type SizePreset = { key: SizePresetKey; width: number; height: number };

export const SIZE_PRESETS: readonly SizePreset[] = [
    { key: 'instagram-post', width: 1080, height: 1080 },
    { key: 'instagram-portrait', width: 1080, height: 1350 },
    { key: 'instagram-story', width: 1080, height: 1920 },
    { key: 'x-post', width: 1600, height: 900 },
    { key: 'x-header', width: 1500, height: 500 },
    { key: 'facebook-cover', width: 820, height: 312 },
    { key: 'linkedin-banner', width: 1584, height: 396 },
    { key: 'youtube-thumbnail', width: 1280, height: 720 },
    { key: 'og-image', width: 1200, height: 630 },
    { key: 'avatar', width: 400, height: 400 },
] as const;

export function sizePreset(key: string | null): SizePreset | null {
    return SIZE_PRESETS.find(preset => preset.key === key) ?? null;
}

export function outputSizeLabel({ width, height }: { width: number; height: number }): string {
    return `${width}×${height}`;
}

export const WATERMARK_MODE_KEYS = ['text', 'image'] as const;

export type WatermarkMode = (typeof WATERMARK_MODE_KEYS)[number];

export const WATERMARK_POSITION_KEYS = [
    'top-left',
    'top',
    'top-right',
    'left',
    'center',
    'right',
    'bottom-left',
    'bottom',
    'bottom-right',
] as const;

export type WatermarkPosition = (typeof WATERMARK_POSITION_KEYS)[number];

export const WATERMARK_POSITIONS: Record<WatermarkPosition, { x: number; y: number }> = {
    'top-left': { x: 0, y: 0 },
    top: { x: 0.5, y: 0 },
    'top-right': { x: 1, y: 0 },
    left: { x: 0, y: 0.5 },
    center: { x: 0.5, y: 0.5 },
    right: { x: 1, y: 0.5 },
    'bottom-left': { x: 0, y: 1 },
    bottom: { x: 0.5, y: 1 },
    'bottom-right': { x: 1, y: 1 },
};

export const WATERMARK_OPACITY_LIMITS = { min: 1, max: 100 } as const;
export const WATERMARK_SCALE_LIMITS = { min: 1, max: 100 } as const;
export const WATERMARK_MARGIN_LIMITS = { min: 0, max: 500 } as const;
export const WATERMARK_TEXT_MAX_LENGTH = 60;

export const WATERMARK_DEFAULTS = {
    mode: 'text',
    text: '',
    color: '#ffffff',
    opacity: '55',
    scale: '30',
    margin: '24',
    position: 'bottom-right',
} as const;

export type Size = { width: number; height: number };

const TEXT_GLYPH_WIDTH = 0.58;
const TEXT_LINE_HEIGHT = 1.32;

export function watermarkTextLayout(
    image: Size,
    scale: number,
    text: string
): Size & { fontSize: number } {
    const label = text.trim() || ' ';
    const perFontSize = label.length * TEXT_GLYPH_WIDTH;
    const fontSize = Math.max(
        4,
        Math.floor(
            Math.min(
                (image.width * scale) / 100 / perFontSize,
                image.width / perFontSize,
                image.height / TEXT_LINE_HEIGHT
            )
        )
    );

    return {
        fontSize,
        width: Math.max(1, Math.min(Math.round(fontSize * perFontSize), image.width)),
        height: Math.max(1, Math.min(Math.round(fontSize * TEXT_LINE_HEIGHT), image.height)),
    };
}

export function watermarkLogoLayout(image: Size, scale: number, logo: Size): Size {
    const factor = Math.min(
        (image.width * scale) / 100 / logo.width,
        image.width / logo.width,
        image.height / logo.height
    );

    return {
        width: Math.max(1, Math.min(Math.round(logo.width * factor), image.width)),
        height: Math.max(1, Math.min(Math.round(logo.height * factor), image.height)),
    };
}

export function watermarkOffset(
    position: WatermarkPosition,
    image: Size,
    overlay: Size,
    margin: number
): { left: number; top: number } {
    const anchor = WATERMARK_POSITIONS[position];
    const place = (span: number, size: number, at: number) => {
        const free = Math.max(0, span - size);
        const raw = at === 0 ? margin : at === 1 ? free - margin : free / 2;

        return Math.max(0, Math.min(Math.round(raw), free));
    };

    return {
        left: place(image.width, overlay.width, anchor.x),
        top: place(image.height, overlay.height, anchor.y),
    };
}

export function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

export const SVG_FONT_STACK = 'Helvetica, Arial, DejaVu Sans, Liberation Sans, sans-serif';

export function watermarkSvg(
    layout: Size & { fontSize: number },
    text: string,
    color: string
): string {
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">` +
        `<text x="50%" y="50%" fill="${color}" font-family="${SVG_FONT_STACK}" ` +
        `font-size="${layout.fontSize}" font-weight="600" text-anchor="middle" ` +
        `dominant-baseline="central">${escapeXml(text)}</text>` +
        `</svg>`
    );
}

export function stripExtension(filename: string): string {
    return filename.replace(/\.[^.]+$/, '');
}

export function fileExtension(filename: string): string {
    const match = /\.([^.]+)$/.exec(filename);

    return match ? match[1] : '';
}

export function uniqueFilenames(filenames: readonly string[]): string[] {
    const taken = new Set<string>();

    return filenames.map(filename => {
        if (!taken.has(filename)) {
            taken.add(filename);

            return filename;
        }

        const base = stripExtension(filename);
        const extension = fileExtension(filename);
        const suffix = extension ? `.${extension}` : '';

        for (let index = 2; ; index += 1) {
            const candidate = `${base}-${index}${suffix}`;

            if (!taken.has(candidate)) {
                taken.add(candidate);

                return candidate;
            }
        }
    });
}

export function formatFromMimeType(mimeType: string): ImageFormat | null {
    const key = FORMAT_KEYS.find(format => IMAGE_FORMATS[format].mimeType === mimeType);

    return key ?? null;
}

export function convertSourceFromMimeType(mimeType: string): ConvertSource | null {
    const key = CONVERT_SOURCE_KEYS.find(format => IMAGE_FORMATS[format].mimeType === mimeType);

    return key ?? null;
}

export function conversionTargets(sourceMimeTypes: readonly string[]): ConvertTarget[] {
    const sources = sourceMimeTypes.map(convertSourceFromMimeType);

    return CONVERT_TARGET_KEYS.filter(format => sources.some(source => format !== source));
}

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const PLACEHOLDER_TEXT_MAX_LENGTH = 60;

export const PLACEHOLDER_DEFAULTS = {
    width: '600',
    height: '400',
    bgColor: '#e2e8f0',
    textColor: '#64748b',
} as const;

export function placeholderLabel(text: string, width: number, height: number): string {
    return text || `${width} × ${height}`;
}

export function placeholderFontSize(width: number, height: number, label: string): number {
    const fitWidth = (width * 0.9) / (label.length * 0.6);

    return Math.max(4, Math.round(Math.min(height * 0.25, fitWidth)));
}

export const PDF_PAGE_SIZE_KEYS = ['fit', 'a4', 'letter'] as const;

export type PdfPageSize = (typeof PDF_PAGE_SIZE_KEYS)[number];

// Points (1/72in), portrait orientation.
export const PDF_PAGE_DIMENSIONS: Record<Exclude<PdfPageSize, 'fit'>, [number, number]> = {
    a4: [595.28, 841.89],
    letter: [612, 792],
};

export const PDF_PAGE_MARGIN = 36;

export const PDF_MIME_TYPE = 'application/pdf';

export const MAX_PDF_PAGES = 500;

export function formatFileSize(bytes: number, locale = 'en'): string {
    const format = (value: number, digits: number) =>
        new Intl.NumberFormat(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        }).format(value);

    if (bytes < 1024) return `${format(bytes, 0)} B`;
    if (bytes < 1024 * 1024) return `${format(bytes / 1024, 1)} KB`;

    return `${format(bytes / (1024 * 1024), 1)} MB`;
}

export type SizeChange = { direction: 'smaller' | 'larger' | 'same'; percent: number };

export function sizeChange(before: number, after: number): SizeChange {
    if (before <= 0 || before === after) return { direction: 'same', percent: 0 };

    const percent = (Math.abs(after - before) / before) * 100;
    const rounded = percent < 1 ? Math.round(percent * 10) / 10 : Math.round(percent);

    if (rounded === 0) return { direction: 'same', percent: 0 };

    return after < before
        ? { direction: 'smaller', percent: rounded }
        : { direction: 'larger', percent: rounded };
}
