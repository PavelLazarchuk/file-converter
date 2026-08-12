import { describe, expect, it, vi } from 'vitest';

import { downloadFile } from './download';

describe('downloadFile', () => {
    it('clicks a named anchor and cleans it up again', () => {
        const clicks: { download: string; href: string; inDocument: boolean }[] = [];

        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement
        ) {
            clicks.push({
                download: this.download,
                href: this.href,
                inDocument: document.body.contains(this),
            });
        });

        downloadFile(new TextEncoder().encode('hello'), 'photo-100x100.png', 'image/png');

        expect(clicks).toHaveLength(1);
        expect(clicks[0].download).toBe('photo-100x100.png');
        expect(clicks[0].href).toContain('blob:');
        expect(clicks[0].inDocument).toBe(true);
        expect(document.querySelector('a')).toBeNull();
    });

    it('revokes the object URL after a delay', () => {
        vi.useFakeTimers();

        const revoke = vi.spyOn(URL, 'revokeObjectURL');

        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        downloadFile(new Uint8Array([1, 2, 3]), 'a.bin', 'application/octet-stream');

        expect(revoke).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(revoke).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });
});
