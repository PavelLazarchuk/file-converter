import { describe, expect, it } from 'vitest';

import {
    COLOR_SCHEME_INIT_SCRIPT,
    COLOR_SCHEME_KEYS,
    COLOR_SCHEME_STORAGE_KEY,
    DEFAULT_COLOR_SCHEME,
    isColorScheme,
} from './color-scheme';

describe('color-scheme', () => {
    it('recognises only the four schemes', () => {
        expect(isColorScheme('violet')).toBe(true);
        expect(isColorScheme('blue')).toBe(true);
        expect(isColorScheme('green')).toBe(true);
        expect(isColorScheme('rose')).toBe(true);
        expect(isColorScheme('amber')).toBe(false);
        expect(isColorScheme(null)).toBe(false);
        expect(isColorScheme(DEFAULT_COLOR_SCHEME)).toBe(true);
    });

    it('paints before hydration using the same key and the valid scheme set', () => {
        expect(COLOR_SCHEME_INIT_SCRIPT).toContain(COLOR_SCHEME_STORAGE_KEY);
        for (const key of COLOR_SCHEME_KEYS) expect(COLOR_SCHEME_INIT_SCRIPT).toContain(key);
        expect(COLOR_SCHEME_INIT_SCRIPT).toContain('try{');
        expect(COLOR_SCHEME_INIT_SCRIPT).toContain('catch');
    });
});
