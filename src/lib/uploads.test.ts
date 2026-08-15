import { describe, expect, it } from 'vitest';

import { MAX_BATCH_BYTES, MAX_FILE_SIZE } from './image';
import { acceptUploads, totalUploadBytes, uploadProblemSummary, type UploadCopy } from './uploads';

const COPY: UploadCopy = {
    full: max => `full:${max}`,
    noRoom: room => `noRoom:${room}`,
    unsupported: name => `unsupported:${name}`,
    tooLarge: name => `tooLarge:${name}`,
    overBudget: name => `overBudget:${name}`,
};

function file(name: string, size = 8, type = 'image/png'): File {
    const created = new File([new Uint8Array(1)], name, { type });

    Object.defineProperty(created, 'size', { value: size });

    return created;
}

function decide(incoming: File[], overrides: Partial<Parameters<typeof acceptUploads>[1]> = {}) {
    return acceptUploads(incoming, {
        max: 20,
        currentCount: 0,
        currentBytes: 0,
        accepts: candidate => candidate.type === 'image/png',
        copy: COPY,
        ...overrides,
    });
}

function names(result: ReturnType<typeof acceptUploads>): string[] {
    return result.accepted.map(entry => entry.name);
}

describe('acceptUploads', () => {
    it('takes everything that fits', () => {
        const result = decide([file('a.png'), file('b.png')]);

        expect(names(result)).toEqual(['a.png', 'b.png']);
        expect(result.problems).toEqual([]);
    });

    it('refuses the whole drop once the list is full', () => {
        const result = decide([file('a.png')], { max: 2, currentCount: 2 });

        expect(result.accepted).toEqual([]);
        expect(result.problems).toEqual(['full:2']);
    });

    it('fills the remaining room and reports the rest once', () => {
        const result = decide([file('a.png'), file('b.png'), file('c.png')], {
            max: 3,
            currentCount: 2,
        });

        expect(names(result)).toEqual(['a.png']);
        expect(result.problems).toEqual(['noRoom:1']);
    });

    it('skips an unsupported type but keeps going', () => {
        const result = decide([file('doc.pdf', 8, 'application/pdf'), file('b.png')]);

        expect(names(result)).toEqual(['b.png']);
        expect(result.problems).toEqual(['unsupported:doc.pdf']);
    });

    it('skips a file over the per-file limit', () => {
        const result = decide([file('huge.png', MAX_FILE_SIZE + 1), file('ok.png')]);

        expect(names(result)).toEqual(['ok.png']);
        expect(result.problems).toEqual(['tooLarge:huge.png']);
    });

    it('spends the batch budget in order and refuses what no longer fits', () => {
        const half = Math.round(MAX_BATCH_BYTES * 0.6);
        const result = decide([file('a.png', half), file('b.png', half), file('c.png', 8)]);

        expect(names(result)).toEqual(['a.png', 'c.png']);
        expect(result.problems).toEqual(['overBudget:b.png']);
    });

    it('counts what is already loaded against the budget', () => {
        const result = decide([file('a.png', Math.round(MAX_BATCH_BYTES * 0.5))], {
            currentBytes: Math.round(MAX_BATCH_BYTES * 0.8),
            currentCount: 1,
        });

        expect(result.accepted).toEqual([]);
        expect(result.problems).toEqual(['overBudget:a.png']);
    });

    describe('single-file tools', () => {
        it('accepts a replacement even when one is already loaded', () => {
            const result = decide([file('new.png')], { max: 1, single: true, currentCount: 1 });

            expect(names(result)).toEqual(['new.png']);
        });

        it('takes only the first of several', () => {
            const result = decide([file('a.png'), file('b.png')], { max: 1, single: true });

            expect(names(result)).toEqual(['a.png']);
            expect(result.problems).toEqual(['noRoom:1']);
        });

        it('reports an oversized file as too large, not as over budget', () => {
            const result = decide([file('huge.png', MAX_FILE_SIZE + 1)], {
                max: 1,
                single: true,
            });

            expect(result.problems).toEqual(['tooLarge:huge.png']);
        });

        it('ignores what is already loaded when sizing the budget', () => {
            const result = decide([file('a.png', MAX_FILE_SIZE)], {
                max: 1,
                single: true,
                currentCount: 1,
                currentBytes: MAX_FILE_SIZE,
            });

            expect(names(result)).toEqual(['a.png']);
        });
    });
});

describe('uploadProblemSummary', () => {
    it('is null when nothing was rejected', () => {
        expect(uploadProblemSummary([])).toBeNull();
    });

    it('passes a lone problem through', () => {
        expect(uploadProblemSummary(['just this'])).toBe('just this');
    });

    it('collapses several into one line', () => {
        expect(uploadProblemSummary(['first', 'second', 'third'])).toBe('first (+2 more)');
    });
});

describe('totalUploadBytes', () => {
    it('sums the underlying files', () => {
        expect(totalUploadBytes([{ file: file('a', 10) }, { file: file('b', 32) }])).toBe(42);
    });

    it('is zero for an empty list', () => {
        expect(totalUploadBytes([])).toBe(0);
    });
});
