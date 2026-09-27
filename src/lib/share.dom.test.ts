import { afterEach, describe, expect, it, vi } from 'vitest';

import { shareFiles, shareSupport, type Shareable } from './share';

const PNG: Shareable = {
    data: new Uint8Array([1, 2, 3]),
    name: 'photo.png',
    mimeType: 'image/png',
};
const ZIP: Shareable = {
    data: new Uint8Array([4]),
    name: 'icons.zip',
    mimeType: 'application/zip',
};

function stubShare(
    canShare: (data: ShareData) => boolean,
    share = vi.fn<(data: ShareData) => Promise<void>>(() => Promise.resolve())
) {
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });

    return share;
}

afterEach(() => {
    Reflect.deleteProperty(navigator, 'canShare');
    Reflect.deleteProperty(navigator, 'share');
});

describe('shareSupport', () => {
    it('offers nothing where the browser has no share sheet', () => {
        expect(shareSupport([PNG])).toEqual({ all: false, each: [] });
    });

    it('asks about the names and types the button would send', () => {
        const asked: [string, string][][] = [];

        stubShare(({ files = [] }) => {
            asked.push(files.map(file => [file.name, file.type]));

            return true;
        });

        expect(shareSupport([PNG])).toEqual({ all: true, each: [true] });
        expect(asked).toContainEqual([['photo.png', 'image/png']]);
    });

    it('asks about the exact set, so one refused type drops the whole-set button', () => {
        stubShare(({ files = [] }) => files.every(file => file.type !== 'application/zip'));

        expect(shareSupport([PNG, ZIP])).toEqual({ all: false, each: [true, false] });
    });

    it('treats a throwing canShare as a refusal', () => {
        stubShare(() => {
            throw new TypeError('nope');
        });

        expect(shareSupport([PNG]).all).toBe(false);
    });
});

describe('shareFiles', () => {
    it('hands the files to the share sheet', async () => {
        const share = stubShare(() => true);

        await expect(shareFiles([PNG])).resolves.toBe('shared');

        const files = share.mock.calls[0][0].files ?? [];

        expect(files.map(file => [file.name, file.type, file.size])).toEqual([
            ['photo.png', 'image/png', 3],
        ]);
    });

    it('reads a closed share sheet as a cancel, not a failure', async () => {
        stubShare(
            () => true,
            vi.fn(() => Promise.reject(new DOMException('closed', 'AbortError')))
        );

        await expect(shareFiles([PNG])).resolves.toBe('cancelled');
    });

    it('reads a second click on an open sheet as a cancel too', async () => {
        stubShare(
            () => true,
            vi.fn(() => Promise.reject(new DOMException('busy', 'InvalidStateError')))
        );

        await expect(shareFiles([PNG])).resolves.toBe('cancelled');
    });

    it('reports anything else as a failure', async () => {
        stubShare(
            () => true,
            vi.fn(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))
        );

        await expect(shareFiles([PNG])).resolves.toBe('failed');
    });
});
