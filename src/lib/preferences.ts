export const AUTO_DOWNLOAD_STORAGE_KEY = 'auto-download';

export const DEFAULT_AUTO_DOWNLOAD = false;

export function isAutoDownload(value: unknown): boolean {
    return value === 'true';
}
