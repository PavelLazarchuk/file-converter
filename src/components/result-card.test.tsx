import { screen } from '@testing-library/react';

import { render } from '@/test/intl';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultCard } from '@/components/result-card';
import type { ActionFile } from '@/lib/actions';
import { downloadFile } from '@/lib/download';
import { clearHandoff, peekHandoff } from '@/lib/handoff';
import type { ActionOutcome, OutcomeFile } from '@/hooks/use-file-action';

const push = vi.fn();
let pathname = '/compress';

vi.mock('@/i18n/navigation', () => ({
    useRouter: () => ({ push }),
    usePathname: () => pathname,
}));
vi.mock('@/lib/download', () => ({ downloadFile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const downloaded = vi.mocked(downloadFile);

function entry(overrides: Partial<ActionFile> = {}, preview = true): OutcomeFile {
    const file: ActionFile = {
        data: new Uint8Array(1200),
        filename: 'photo.png',
        mimeType: 'image/png',
        originalSize: 2400,
        ...overrides,
    };

    return preview
        ? { file, previewUrl: 'blob:preview', width: 800, height: 600 }
        : { file, previewUrl: null, width: null, height: null };
}

function outcome(files: OutcomeFile[], failures: ActionOutcome['failures'] = []): ActionOutcome {
    return { files, failures };
}

function setup(value: ActionOutcome) {
    const onDismiss = vi.fn();
    const onDownloadAll = vi.fn();

    render(<ResultCard outcome={value} onDismiss={onDismiss} onDownloadAll={onDownloadAll} />);

    return { onDismiss, onDownloadAll, user: userEvent.setup() };
}

beforeEach(() => {
    localStorage.clear();
    downloaded.mockClear();
    push.mockClear();
    clearHandoff();
    pathname = '/compress';
});

describe('a single result', () => {
    it('shows the filename, the dimensions and the saving', () => {
        setup(outcome([entry()]));

        expect(screen.getByText('Result ready')).toBeInTheDocument();
        expect(screen.getByText('photo.png')).toBeInTheDocument();
        expect(screen.getByText(/800 × 600 · 1.2 KB/)).toBeInTheDocument();
        expect(screen.getByText(/was 2.3 KB/)).toBeInTheDocument();
        expect(screen.getByText('−50%')).toBeInTheDocument();
    });

    it('leaves out the comparison when there was no upload to compare against', () => {
        setup(outcome([entry({ originalSize: 0, filename: 'placeholder-320x200.png' })]));

        expect(screen.queryByText(/was /)).toBeNull();
    });

    it('says so when the format has no preview', () => {
        setup(outcome([entry({ filename: 'brand.ico', mimeType: 'image/x-icon' }, false)]));

        expect(screen.getByText('No preview')).toBeInTheDocument();
    });

    it('asks for confirmation when the result carries a warning', async () => {
        const { onDownloadAll, user } = setup(
            outcome([
                entry({
                    warning: {
                        code: 'target_missed',
                        targetBytes: 100_000,
                        smallestBytes: 250_000,
                    },
                }),
            ])
        );

        expect(screen.getByText(/Couldn't reach 97.7 KB/)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /download it anyway/i }));

        expect(onDownloadAll).toHaveBeenCalled();
    });

    it('discards on request', async () => {
        const { onDismiss, user } = setup(outcome([entry()]));

        await user.click(screen.getByRole('button', { name: /discard/i }));

        expect(onDismiss).toHaveBeenCalled();
    });
});

describe('several results', () => {
    const many = outcome([
        entry({ filename: 'a.png' }),
        entry({ filename: 'b.png' }),
        entry({ filename: 'c.png' }),
    ]);

    it('lists every file and offers one zip', async () => {
        const { onDownloadAll, user } = setup(many);

        expect(screen.getByText('3 results ready')).toBeInTheDocument();
        expect(screen.getByText('a.png')).toBeInTheDocument();
        expect(screen.getByText('c.png')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /download all/i }));

        expect(onDownloadAll).toHaveBeenCalled();
    });

    it('downloads one file on its own from the row', async () => {
        const { user } = setup(many);

        await user.click(screen.getByRole('button', { name: 'Download b.png' }));

        expect(downloaded).toHaveBeenCalledWith(expect.any(Uint8Array), 'b.png', 'image/png');
    });

    it('shows a per-file warning next to the file it belongs to', () => {
        setup(
            outcome([
                entry({ filename: 'a.png' }),
                entry({
                    filename: 'b.png',
                    warning: {
                        code: 'target_missed',
                        targetBytes: 100_000,
                        smallestBytes: 250_000,
                    },
                }),
            ])
        );

        expect(screen.getByText(/Couldn't reach 97.7 KB/)).toBeInTheDocument();
    });
});

describe('partial failures', () => {
    it('names each file that could not be processed', () => {
        setup(
            outcome(
                [entry({ filename: 'good.png' })],
                [
                    {
                        filename: 'broken.png',
                        detail: { code: 'unreadable_image' as const, formats: ['png' as const] },
                    },
                    {
                        filename: 'huge.png',
                        detail: { code: 'file_too_large' as const },
                    },
                ]
            )
        );

        expect(screen.getByText('2 files could not be processed')).toBeInTheDocument();
        expect(screen.getByText(/isn't a readable image/)).toBeInTheDocument();
        expect(screen.getByText(/File is too large/)).toBeInTheDocument();
    });
});

describe('handing the result to another tool', () => {
    it('offers the other tools that take this format, never the current one', () => {
        setup(outcome([entry()]));

        expect(screen.getByRole('button', { name: 'Resize' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Crop' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Compress' })).toBeNull();
    });

    it('queues the files and navigates to the tool', async () => {
        const { user } = setup(outcome([entry({ filename: 'photo.png' })]));

        await user.click(screen.getByRole('button', { name: 'Resize' }));

        const handoff = peekHandoff();

        expect(push).toHaveBeenCalledWith('/resize');
        expect(handoff?.from).toBe('Compress');
        expect(handoff?.files.map(file => file.name)).toEqual(['photo.png']);
        expect(handoff?.files[0].type).toBe('image/png');
    });

    it('carries the names the card is showing, not the ones the server sent', async () => {
        localStorage.setItem('filename-template', 'shot-{index}');

        const { user } = setup(
            outcome([entry({ filename: 'a.png' }), entry({ filename: 'b.png' })])
        );

        await user.click(screen.getByRole('button', { name: 'Resize' }));

        expect(peekHandoff()?.files.map(file => file.name)).toEqual(['shot-1.png', 'shot-2.png']);
    });

    it('offers nothing when no tool takes the format', () => {
        setup(outcome([entry({ filename: 'brand.ico', mimeType: 'image/x-icon' }, false)]));

        expect(screen.queryByText('Keep going')).toBeNull();
    });

    it('only offers a tool that takes every file in the batch', () => {
        setup(
            outcome([
                entry({ filename: 'a.png' }),
                entry({ filename: 'b.svg', mimeType: 'image/svg+xml' }),
            ])
        );

        expect(screen.getByRole('button', { name: 'Convert' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Resize' })).toBeNull();
    });

    it('routes a PDF to the PDF tool rather than the image ones', () => {
        pathname = '/pdf';
        setup(outcome([entry({ filename: 'pages.pdf', mimeType: 'application/pdf' }, false)]));

        expect(screen.getByRole('button', { name: 'Merge PDFs' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Resize' })).toBeNull();
    });
});

describe('the auto-download preference', () => {
    it('reflects and stores the choice', async () => {
        const { user } = setup(outcome([entry()]));
        const toggle = screen.getByRole('switch', { name: /download automatically/i });

        expect(toggle).not.toBeChecked();

        await user.click(toggle);

        expect(toggle).toBeChecked();
        expect(localStorage.getItem('auto-download')).toBe('true');
    });
});
