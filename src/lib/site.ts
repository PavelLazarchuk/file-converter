import {
    Combine,
    Crop,
    Scale,
    FileText,
    Gauge,
    ImagePlus,
    RefreshCw,
    RotateCw,
    Scaling,
    ScanSearch,
    Stamp,
    type LucideIcon,
} from 'lucide-react';

export const SITE = {
    name: 'Image Toolbox',
    tagline: 'Resize, Crop, Compress & Convert',
    description:
        'Free browser tools for images, in batches of up to 20: resize with locked aspect ratio or a social preset, crop to preset ratios or a circle, rotate and flip, compress by quality or target size, convert between JPEG, PNG, WEBP, AVIF, GIF, TIFF, SVG and ICO favicons, stamp a text or logo watermark, inspect EXIF and GPS metadata, combine images into a multi-page PDF, and merge several PDFs into one.',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://file-converter-mu-seven.vercel.app',
} as const;

export type Tool = {
    href: string;
    title: string;
    description: string;
    icon: LucideIcon;
    gradient: string;
};

export function toolTransitionName(part: 'icon' | 'title', href: string): string {
    return `tool-${part}-${href.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`;
}

export const TOOLS: readonly Tool[] = [
    {
        href: '/resize',
        title: 'Resize',
        description:
            'Set exact pixel dimensions with a locked aspect ratio, up to 10,000px — with optional rotation. Up to 20 images at once.',
        icon: Scaling,
        gradient: 'from-sky-500 to-blue-600',
    },
    {
        href: '/crop',
        title: 'Crop',
        description:
            'Trim to a preset aspect ratio — square, 16:9, 4:3 and more — or a circle, and drag to frame it.',
        icon: Crop,
        gradient: 'from-amber-500 to-orange-600',
    },
    {
        href: '/rotate',
        title: 'Rotate & Flip',
        description:
            'Turn photos by 90°, 180° or any angle you type, mirror them horizontally or vertically — 20 at a time.',
        icon: RotateCw,
        gradient: 'from-lime-500 to-green-600',
    },
    {
        href: '/compare',
        title: 'Compare formats',
        description:
            'Encode one image to JPEG, PNG, WEBP and AVIF at the same quality and see which comes out smallest.',
        icon: Scale,
        gradient: 'from-fuchsia-500 to-purple-600',
    },
    {
        href: '/compress',
        title: 'Compress',
        description:
            'Shrink file size by quality or down to a target size like 500 KB — one image or a batch of 20.',
        icon: Gauge,
        gradient: 'from-violet-500 to-purple-600',
    },
    {
        href: '/convert',
        title: 'Convert',
        description:
            'Switch between JPEG, PNG, WEBP, AVIF, GIF, TIFF and SVG in bulk, build an ICO favicon, or get a Base64 data URI.',
        icon: RefreshCw,
        gradient: 'from-emerald-500 to-teal-600',
    },
    {
        href: '/watermark',
        title: 'Watermark',
        description:
            'Stamp text or a logo onto a batch — nine positions, adjustable size, margin and opacity.',
        icon: Stamp,
        gradient: 'from-cyan-500 to-sky-600',
    },
    {
        href: '/metadata',
        title: 'Metadata',
        description:
            'See the EXIF, camera, GPS location and color profile hiding in a photo — and download a clean copy without it.',
        icon: ScanSearch,
        gradient: 'from-indigo-500 to-blue-700',
    },
    {
        href: '/placeholder',
        title: 'Placeholder',
        description: 'Generate a placeholder image with custom dimensions, colors and text.',
        icon: ImagePlus,
        gradient: 'from-pink-500 to-rose-600',
    },
    {
        href: '/merge-pdf',
        title: 'Merge PDFs',
        description:
            'Combine several PDF files into one document, in the order you arrange them — up to 20 files at a time.',
        icon: Combine,
        gradient: 'from-slate-500 to-slate-700',
    },
    {
        href: '/pdf',
        title: 'Images to PDF',
        description:
            'Combine JPEG, PNG, WEBP, AVIF, GIF or SVG images into one PDF, a page each, fit to the image or a standard A4/Letter page.',
        icon: FileText,
        gradient: 'from-red-500 to-rose-600',
    },
] as const;

export type JsonLd = Record<string, unknown>;

const SCHEMA_CONTEXT = 'https://schema.org';

export function jsonLdScript(data: JsonLd): string {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function toolJsonLd(tool: Tool): JsonLd {
    return {
        '@context': SCHEMA_CONTEXT,
        '@type': 'WebApplication',
        name: `${tool.title} — ${SITE.name}`,
        url: `${SITE.url}${tool.href}`,
        description: tool.description,
        applicationCategory: 'MultimediaApplication',
        browserRequirements: 'Requires JavaScript.',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
    };
}

export function breadcrumbJsonLd(tool: Tool): JsonLd {
    return {
        '@context': SCHEMA_CONTEXT,
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'All tools', item: SITE.url },
            {
                '@type': 'ListItem',
                position: 2,
                name: tool.title,
                item: `${SITE.url}${tool.href}`,
            },
        ],
    };
}

export function siteJsonLd(): JsonLd[] {
    return [
        {
            '@context': SCHEMA_CONTEXT,
            '@type': 'WebSite',
            name: SITE.name,
            alternateName: SITE.tagline,
            url: SITE.url,
            description: SITE.description,
        },
        {
            '@context': SCHEMA_CONTEXT,
            '@type': 'ItemList',
            name: `${SITE.name} tools`,
            numberOfItems: TOOLS.length,
            itemListElement: TOOLS.map((tool, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: tool.title,
                description: tool.description,
                url: `${SITE.url}${tool.href}`,
            })),
        },
    ];
}
