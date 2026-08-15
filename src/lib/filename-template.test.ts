import { describe, expect, it } from 'vitest';

import {
    DEFAULT_FILENAME_TEMPLATE,
    FILENAME_TEMPLATE_MAX_LENGTH,
    applyFilenameTemplate,
    renameAll,
    sanitizeFilename,
    type RenameTarget,
} from './filename-template';

function target(filename: string, width: number | null = null, height: number | null = null) {
    return { filename, width, height } satisfies RenameTarget;
}

describe('applyFilenameTemplate', () => {
    const fields = { name: 'holiday', index: 3, width: 800, height: 600 };

    it('fills every token', () => {
        expect(applyFilenameTemplate('{name}-{width}x{height}-{index}', fields)).toBe(
            'holiday-800x600-3'
        );
    });

    it('leaves an unknown token visible rather than silently dropping it', () => {
        expect(applyFilenameTemplate('{name}-{nope}', fields)).toBe('holiday-{nope}');
    });

    it('renders an unprobed dimension as nothing', () => {
        expect(
            applyFilenameTemplate('{name}-{width}x{height}', {
                ...fields,
                width: null,
                height: null,
            })
        ).toBe('holiday-x');
    });
});

describe('sanitizeFilename', () => {
    it.each([
        ['a/b', 'a-b'],
        ['a\\b', 'a-b'],
        ['a:b', 'a-b'],
        ['what?', 'what-'],
        ['a<b>c', 'a-b-c'],
    ])('replaces the path and reserved characters in %s', (input, expected) => {
        expect(sanitizeFilename(input)).toBe(expected);
    });

    it('keeps spaces, which are legal', () => {
        expect(sanitizeFilename('my holiday photo')).toBe('my holiday photo');
    });

    it.each([
        ['.hidden', 'hidden'],
        ['trailing.', 'trailing'],
        ['  padded  ', 'padded'],
    ])('trims %s, which the OS would rewrite anyway', (input, expected) => {
        expect(sanitizeFilename(input)).toBe(expected);
    });

    it.each(['con', 'NUL', 'com1', 'lpt9'])('refuses the reserved name %s', name => {
        expect(sanitizeFilename(name)).toBe('file');
    });

    it('falls back when the template renders to nothing', () => {
        expect(sanitizeFilename('')).toBe('file');
        expect(sanitizeFilename('...')).toBe('file');
    });

    it('caps the length', () => {
        expect(sanitizeFilename('x'.repeat(400))).toHaveLength(FILENAME_TEMPLATE_MAX_LENGTH);
    });
});

describe('renameAll', () => {
    it('is a no-op for an empty template', () => {
        const targets = [target('a.png'), target('b.png')];

        expect(renameAll(targets, '')).toEqual(['a.png', 'b.png']);
        expect(renameAll(targets, '   ')).toEqual(['a.png', 'b.png']);
        expect(renameAll(targets, DEFAULT_FILENAME_TEMPLATE)).toEqual(['a.png', 'b.png']);
    });

    it('keeps the extension the bytes actually have', () => {
        expect(renameAll([target('photo-800x600.jpg', 800, 600)], '{name}-{width}')).toEqual([
            'photo-800x600-800.jpg',
        ]);
    });

    it('numbers from one, in the order given', () => {
        const targets = [target('a.png'), target('b.png'), target('c.png')];

        expect(renameAll(targets, 'shot-{index}')).toEqual([
            'shot-1.png',
            'shot-2.png',
            'shot-3.png',
        ]);
    });

    it('deduplicates collisions across the set', () => {
        const targets = [target('a.png', 100, 100), target('b.png', 100, 100)];

        expect(renameAll(targets, 'thumb-{width}')).toEqual(['thumb-100.png', 'thumb-100-2.png']);
    });

    it.each(['../../etc/passwd', '..\\..\\windows\\system32', '/absolute/path'])(
        'strips every separator out of %s, so the entry stays at the zip root',
        template => {
            const [renamed] = renameAll([target('a.png')], template);

            expect(renamed).not.toMatch(/[/\\]/);
            expect(renamed.endsWith('.png')).toBe(true);
        }
    );

    it('leaves a file with no extension alone', () => {
        expect(renameAll([target('README')], 'notes-{index}')).toEqual(['notes-1']);
    });

    it('handles a result with no dimensions, such as a merged PDF', () => {
        expect(renameAll([target('report-merged.pdf')], '{name}-{width}')).toEqual([
            'report-merged-.pdf',
        ]);
    });
});
