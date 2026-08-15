export const AUTO_DOWNLOAD_STORAGE_KEY = 'auto-download';

export const DEFAULT_AUTO_DOWNLOAD = false;

export function isAutoDownload(value: unknown): boolean {
    return value === 'true';
}

export const FILENAME_TEMPLATE_STORAGE_KEY = 'filename-template';

export const DEFAULT_FILENAME_TEMPLATE_PREFERENCE = '';

export function readFilenameTemplate(value: unknown): string {
    return typeof value === 'string' ? value : DEFAULT_FILENAME_TEMPLATE_PREFERENCE;
}
