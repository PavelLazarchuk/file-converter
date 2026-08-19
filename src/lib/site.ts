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

import { routing, type AppLocale } from '@/i18n/routing';
import {
    CONVERT_SOURCE_KEYS,
    FORMAT_KEYS,
    IMAGE_FORMATS,
    MAX_BATCH_FILES,
    PDF_MIME_TYPE,
    type ConvertSource,
} from './image';

export const SITE = {
    name: 'Image Toolbox',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://file-converter-mu-seven.vercel.app',
} as const;

export function localeUrl(locale: AppLocale, path = '/'): string {
    const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
    const suffix = path === '/' ? '' : path;

    return `${SITE.url}${prefix}${suffix}` || SITE.url;
}

export function languageAlternates(path = '/'): Record<string, string> {
    return Object.fromEntries(routing.locales.map(locale => [locale, localeUrl(locale, path)]));
}

export type ToolIntake = { mimeTypes: readonly string[]; max: number };

export type ToolKey =
    | 'resize'
    | 'crop'
    | 'rotate'
    | 'compare'
    | 'compress'
    | 'convert'
    | 'watermark'
    | 'metadata'
    | 'placeholder'
    | 'mergePdf'
    | 'imagesToPdf';

export type Tool = {
    key: ToolKey;
    href: string;
    icon: LucideIcon;
    gradient: string;
    intake?: ToolIntake;
};

export type ToolCopy = { title: string; description: string };

function mimeTypesOf(formats: readonly ConvertSource[]): readonly string[] {
    return formats.map(format => IMAGE_FORMATS[format].mimeType);
}

const RASTER_INTAKE: ToolIntake = {
    mimeTypes: mimeTypesOf(FORMAT_KEYS),
    max: MAX_BATCH_FILES,
};

const CONVERT_INTAKE: ToolIntake = {
    mimeTypes: mimeTypesOf(CONVERT_SOURCE_KEYS),
    max: MAX_BATCH_FILES,
};

const SINGLE_RASTER_INTAKE: ToolIntake = { mimeTypes: RASTER_INTAKE.mimeTypes, max: 1 };

const PDF_INTAKE: ToolIntake = { mimeTypes: [PDF_MIME_TYPE], max: MAX_BATCH_FILES };

export function toolTransitionName(part: 'icon' | 'title', href: string): string {
    return `tool-${part}-${href.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`;
}

export const TOOLS: readonly Tool[] = [
    {
        key: 'resize',
        href: '/resize',
        icon: Scaling,
        gradient: 'from-sky-500 to-blue-600',
        intake: RASTER_INTAKE,
    },
    {
        key: 'crop',
        href: '/crop',
        icon: Crop,
        gradient: 'from-amber-500 to-orange-600',
        intake: SINGLE_RASTER_INTAKE,
    },
    {
        key: 'rotate',
        href: '/rotate',
        icon: RotateCw,
        gradient: 'from-lime-500 to-green-600',
        intake: RASTER_INTAKE,
    },
    {
        key: 'compare',
        href: '/compare',
        icon: Scale,
        gradient: 'from-fuchsia-500 to-purple-600',
        intake: SINGLE_RASTER_INTAKE,
    },
    {
        key: 'compress',
        href: '/compress',
        icon: Gauge,
        gradient: 'from-violet-500 to-purple-600',
        intake: RASTER_INTAKE,
    },
    {
        key: 'convert',
        href: '/convert',
        icon: RefreshCw,
        gradient: 'from-emerald-500 to-teal-600',
        intake: CONVERT_INTAKE,
    },
    {
        key: 'watermark',
        href: '/watermark',
        icon: Stamp,
        gradient: 'from-cyan-500 to-sky-600',
        intake: RASTER_INTAKE,
    },
    {
        key: 'metadata',
        href: '/metadata',
        icon: ScanSearch,
        gradient: 'from-indigo-500 to-blue-700',
        intake: RASTER_INTAKE,
    },
    {
        key: 'placeholder',
        href: '/placeholder',
        icon: ImagePlus,
        gradient: 'from-pink-500 to-rose-600',
    },
    {
        key: 'mergePdf',
        href: '/merge-pdf',
        icon: Combine,
        gradient: 'from-slate-500 to-slate-700',
        intake: PDF_INTAKE,
    },
    {
        key: 'imagesToPdf',
        href: '/pdf',
        icon: FileText,
        gradient: 'from-red-500 to-rose-600',
        intake: CONVERT_INTAKE,
    },
] as const;

export function toolByHref(href: string): Tool | undefined {
    return TOOLS.find(tool => tool.href === href);
}

export type JsonLd = Record<string, unknown>;

const SCHEMA_CONTEXT = 'https://schema.org';

export function jsonLdScript(data: JsonLd): string {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function toolJsonLd(tool: Tool, copy: ToolCopy, locale: AppLocale): JsonLd {
    return {
        '@context': SCHEMA_CONTEXT,
        '@type': 'WebApplication',
        name: `${copy.title} — ${SITE.name}`,
        url: localeUrl(locale, tool.href),
        description: copy.description,
        inLanguage: locale,
        applicationCategory: 'MultimediaApplication',
        browserRequirements: 'Requires JavaScript.',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isPartOf: { '@type': 'WebSite', name: SITE.name, url: localeUrl(locale) },
    };
}

export function breadcrumbJsonLd(
    tool: Tool,
    copy: ToolCopy & { root: string },
    locale: AppLocale
): JsonLd {
    return {
        '@context': SCHEMA_CONTEXT,
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: copy.root, item: localeUrl(locale) },
            {
                '@type': 'ListItem',
                position: 2,
                name: copy.title,
                item: localeUrl(locale, tool.href),
            },
        ],
    };
}

export type SiteJsonLdCopy = {
    tagline: string;
    description: string;
    toolList: string;
    tool: (tool: Tool) => ToolCopy;
};

export function siteJsonLd(copy: SiteJsonLdCopy, locale: AppLocale): JsonLd[] {
    return [
        {
            '@context': SCHEMA_CONTEXT,
            '@type': 'WebSite',
            name: SITE.name,
            alternateName: copy.tagline,
            url: localeUrl(locale),
            description: copy.description,
            inLanguage: locale,
        },
        {
            '@context': SCHEMA_CONTEXT,
            '@type': 'ItemList',
            name: copy.toolList,
            numberOfItems: TOOLS.length,
            itemListElement: TOOLS.map((tool, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: copy.tool(tool).title,
                description: copy.tool(tool).description,
                url: localeUrl(locale, tool.href),
            })),
        },
    ];
}
