import { describe, expect, it } from 'vitest';

import { DEFAULT_AUTO_DOWNLOAD, isAutoDownload } from './preferences';
import {
    DARK_MEDIA_QUERY,
    DEFAULT_THEME,
    THEME_INIT_SCRIPT,
    THEME_STORAGE_KEY,
    isTheme,
    resolveTheme,
} from './theme';

describe('theme', () => {
    it('recognises only the three themes', () => {
        expect(isTheme('dark')).toBe(true);
        expect(isTheme('system')).toBe(true);
        expect(isTheme('sepia')).toBe(false);
        expect(isTheme(null)).toBe(false);
        expect(isTheme(DEFAULT_THEME)).toBe(true);
    });

    it('resolves system against the media query', () => {
        expect(resolveTheme('system', true)).toBe('dark');
        expect(resolveTheme('system', false)).toBe('light');
        expect(resolveTheme('light', true)).toBe('light');
        expect(resolveTheme('dark', false)).toBe('dark');
    });

    it('paints before hydration using the same key and query', () => {
        expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
        expect(THEME_INIT_SCRIPT).toContain(DARK_MEDIA_QUERY);
        expect(THEME_INIT_SCRIPT).toContain('try{');
        expect(THEME_INIT_SCRIPT).toContain('catch');
    });
});

describe('preferences', () => {
    it('treats only the literal "true" as opted in', () => {
        expect(isAutoDownload('true')).toBe(true);
        expect(isAutoDownload('false')).toBe(false);
        expect(isAutoDownload(null)).toBe(false);
        expect(isAutoDownload('1')).toBe(false);
        expect(DEFAULT_AUTO_DOWNLOAD).toBe(false);
    });
});
