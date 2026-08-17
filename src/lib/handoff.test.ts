import { beforeEach, describe, expect, it } from 'vitest';

import { clearHandoff, handoffTargets, peekHandoff, setHandoff, takeHandoff } from './handoff';
import { IMAGE_FORMATS, PDF_MIME_TYPE } from './image';
import { TOOLS } from './site';

const PNG = IMAGE_FORMATS.png.mimeType;
const SVG = IMAGE_FORMATS.svg.mimeType;
const ICO = IMAGE_FORMATS.ico.mimeType;

function file(name: string): File {
    return new File([new Uint8Array(4)], name, { type: PNG });
}

beforeEach(clearHandoff);

describe('the pending handoff', () => {
    it('hands the files to the first caller and to nobody after that', () => {
        setHandoff('Compress', [file('a.png')]);

        expect(takeHandoff()?.files).toHaveLength(1);
        expect(takeHandoff()).toBeNull();
    });

    it('replaces a handoff nobody claimed rather than queueing behind it', () => {
        setHandoff('Compress', [file('a.png')]);
        setHandoff('Rotate & Flip', [file('b.png'), file('c.png')]);

        const handoff = takeHandoff();

        expect(handoff?.from).toBe('Rotate & Flip');
        expect(handoff?.files).toHaveLength(2);
    });

    it('gives each handoff its own id', () => {
        const first = setHandoff('Compress', [file('a.png')]);
        const second = setHandoff('Compress', [file('a.png')]);

        expect(second.id).not.toBe(first.id);
    });

    it('leaves the store untouched on a peek', () => {
        setHandoff('Compress', [file('a.png')]);

        expect(peekHandoff()?.from).toBe('Compress');
        expect(peekHandoff()?.from).toBe('Compress');
    });
});

describe('choosing the tools worth offering', () => {
    it('lists every tool that takes the format, minus the one that produced it', () => {
        const hrefs = handoffTargets([PNG], '/compress').map(tool => tool.href);

        expect(hrefs).toContain('/resize');
        expect(hrefs).toContain('/crop');
        expect(hrefs).toContain('/convert');
        expect(hrefs).not.toContain('/compress');
    });

    it('skips the tools that take no upload at all', () => {
        expect(handoffTargets([PNG]).map(tool => tool.href)).not.toContain('/placeholder');
    });

    it('demands every file fit, so nothing is silently dropped', () => {
        expect(handoffTargets([PNG, SVG]).map(tool => tool.href)).toEqual(['/convert', '/pdf']);
    });

    it('offers nothing for a format no tool reads back', () => {
        expect(handoffTargets([ICO])).toEqual([]);
        expect(handoffTargets(['application/zip'])).toEqual([]);
    });

    it('offers nothing for an empty result', () => {
        expect(handoffTargets([])).toEqual([]);
    });

    it('keeps PDFs on the PDF path', () => {
        expect(handoffTargets([PDF_MIME_TYPE], '/pdf').map(tool => tool.href)).toEqual([
            '/merge-pdf',
        ]);
    });
});

describe('the intake registry', () => {
    it('never lets a tool advertise an intake it cannot honour', () => {
        for (const tool of TOOLS) {
            if (!tool.intake) continue;

            expect(tool.intake.mimeTypes.length).toBeGreaterThan(0);
            expect(tool.intake.max).toBeGreaterThan(0);
        }
    });
});
