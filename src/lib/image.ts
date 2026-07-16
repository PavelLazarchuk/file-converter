export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '20MB';

export const DIMENSION_LIMITS = { min: 1, max: 10000 } as const;
export const QUALITY_LIMITS = { min: 1, max: 100 } as const;
export const DEFAULT_QUALITY = 80;

export const MAX_INPUT_PIXELS = DIMENSION_LIMITS.max * DIMENSION_LIMITS.max;

export const FORMAT_KEYS = ['jpeg', 'png', 'webp', 'avif'] as const;

export type ImageFormat = (typeof FORMAT_KEYS)[number];

export const CONVERT_SOURCE_KEYS = [...FORMAT_KEYS, 'gif', 'svg'] as const;

export type ConvertSource = (typeof CONVERT_SOURCE_KEYS)[number];

export const CONVERT_TARGET_KEYS = [...FORMAT_KEYS, 'gif', 'tiff', 'svg', 'ico', 'base64'] as const;

export type ConvertTarget = (typeof CONVERT_TARGET_KEYS)[number];

export const IMAGE_FORMATS: Record<
    ConvertTarget,
    { label: string; mimeType: string; extension: string }
> = {
    jpeg: { label: 'JPEG', mimeType: 'image/jpeg', extension: 'jpg' },
    png: { label: 'PNG', mimeType: 'image/png', extension: 'png' },
    webp: { label: 'WEBP', mimeType: 'image/webp', extension: 'webp' },
    avif: { label: 'AVIF', mimeType: 'image/avif', extension: 'avif' },
    gif: { label: 'GIF', mimeType: 'image/gif', extension: 'gif' },
    tiff: { label: 'TIFF', mimeType: 'image/tiff', extension: 'tiff' },
    svg: { label: 'SVG', mimeType: 'image/svg+xml', extension: 'svg' },
    ico: { label: 'ICO (favicon)', mimeType: 'image/x-icon', extension: 'ico' },
    base64: { label: 'Base64 data URI', mimeType: 'text/plain', extension: 'txt' },
};

export const ICO_SIZES = [16, 32, 48] as const;

export const ROTATION_KEYS = ['0', '90', '180', '270'] as const;

export type Rotation = (typeof ROTATION_KEYS)[number];

export const ROTATIONS: Record<Rotation, { label: string }> = {
    '0': { label: 'No rotation' },
    '90': { label: '90° clockwise' },
    '180': { label: '180°' },
    '270': { label: '90° counter-clockwise' },
};

export function rotationSwapsDimensions(rotation: Rotation): boolean {
    return rotation === '90' || rotation === '270';
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
    { label: '1.5 MB', kb: 1526 },
    { label: '2 MB', kb: 2048 },
] as const;

export const ASPECT_RATIO_KEYS = ['1:1', '4:3', '3:2', '16:9', '3:4', '2:3', '9:16'] as const;

export type AspectRatio = (typeof ASPECT_RATIO_KEYS)[number];

export const ASPECT_RATIOS: Record<AspectRatio, { label: string; width: number; height: number }> =
    {
        '1:1': { label: 'Square (1:1)', width: 1, height: 1 },
        '4:3': { label: 'Landscape (4:3)', width: 4, height: 3 },
        '3:2': { label: 'Landscape (3:2)', width: 3, height: 2 },
        '16:9': { label: 'Widescreen (16:9)', width: 16, height: 9 },
        '3:4': { label: 'Portrait (3:4)', width: 3, height: 4 },
        '2:3': { label: 'Portrait (2:3)', width: 2, height: 3 },
        '9:16': { label: 'Vertical (9:16)', width: 9, height: 16 },
    };

export const CROP_SHAPE_KEYS = ['rectangle', 'circle'] as const;

export type CropShape = (typeof CROP_SHAPE_KEYS)[number];

export const CROP_SHAPES: Record<CropShape, { label: string }> = {
    rectangle: { label: 'Rectangle' },
    circle: { label: 'Circle / ellipse (transparent corners)' },
};

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

export function formatFromMimeType(mimeType: string): ImageFormat | null {
    const key = FORMAT_KEYS.find(format => IMAGE_FORMATS[format].mimeType === mimeType);

    return key ?? null;
}

export function convertSourceFromMimeType(mimeType: string): ConvertSource | null {
    const key = CONVERT_SOURCE_KEYS.find(format => IMAGE_FORMATS[format].mimeType === mimeType);

    return key ?? null;
}

export function conversionTargets(sourceMimeType: string): ConvertTarget[] {
    const source = convertSourceFromMimeType(sourceMimeType);

    return CONVERT_TARGET_KEYS.filter(format => format !== source);
}

export function acceptedFormatsLabel(formats: readonly ConvertSource[]): string {
    const labels = formats.map(format => IMAGE_FORMATS[format].label);
    return labels.length > 1
        ? `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
        : (labels[0] ?? '');
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

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
