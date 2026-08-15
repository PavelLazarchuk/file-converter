import { fileExtension, stripExtension, uniqueFilenames } from './image';

export const FILENAME_TOKENS = ['name', 'index', 'width', 'height'] as const;

export type FilenameToken = (typeof FILENAME_TOKENS)[number];

export const DEFAULT_FILENAME_TEMPLATE = '{name}';

export const FILENAME_TEMPLATE_MAX_LENGTH = 120;

export type TemplateFields = {
    name: string;
    index: number;
    width: number | null;
    height: number | null;
};

const ILLEGAL_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g;
const TOKEN_PATTERN = /\{(\w+)\}/g;

const RESERVED_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

export function sanitizeFilename(name: string): string {
    const cleaned = name
        .replace(ILLEGAL_CHARACTERS, '-')
        .replace(/\s+/g, ' ')
        .slice(0, FILENAME_TEMPLATE_MAX_LENGTH)
        .replace(/^[.\s]+|[.\s]+$/g, '');

    return !cleaned || RESERVED_NAMES.test(cleaned) ? 'file' : cleaned;
}

export function applyFilenameTemplate(template: string, fields: TemplateFields): string {
    return template.replace(TOKEN_PATTERN, (whole, token: string) => {
        switch (token) {
            case 'name':
                return fields.name;
            case 'index':
                return String(fields.index);
            case 'width':
                return fields.width === null ? '' : String(fields.width);
            case 'height':
                return fields.height === null ? '' : String(fields.height);
            default:
                return whole;
        }
    });
}

export type RenameTarget = { filename: string; width: number | null; height: number | null };

export function renameAll(targets: readonly RenameTarget[], template: string): string[] {
    const trimmed = template.trim();

    if (!trimmed || trimmed === DEFAULT_FILENAME_TEMPLATE) {
        return targets.map(target => target.filename);
    }

    const rendered = targets.map((target, position) => {
        const extension = fileExtension(target.filename);
        const base = applyFilenameTemplate(trimmed, {
            name: stripExtension(target.filename),
            index: position + 1,
            width: target.width,
            height: target.height,
        });

        return extension ? `${sanitizeFilename(base)}.${extension}` : sanitizeFilename(base);
    });

    return uniqueFilenames(rendered);
}
