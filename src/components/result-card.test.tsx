import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultCard } from '@/components/result-card';
import type { ActionFile } from '@/lib/actions';
import { downloadFile } from '@/lib/download';
import type { ActionOutcome, OutcomeFile } from '@/hooks/use-image-action';

vi.mock('@/lib/download', () => ({ downloadFile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
            outcome([entry({ warning: "Couldn't reach 100 KB at these dimensions" })])
        );

        expect(screen.getByText(/Couldn't reach 100 KB/)).toBeInTheDocument();

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
                entry({ filename: 'b.png', warning: 'too big' }),
            ])
        );

        expect(screen.getByText('too big')).toBeInTheDocument();
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
                        code: 'unreadable_image' as const,
                        error: 'not a readable image',
                    },
                    {
                        filename: 'huge.png',
                        code: 'file_too_large' as const,
                        error: 'File is too large.',
                    },
                ]
            )
        );

        expect(screen.getByText('2 files could not be processed')).toBeInTheDocument();
        expect(screen.getByText(/not a readable image/)).toBeInTheDocument();
        expect(screen.getByText(/File is too large/)).toBeInTheDocument();
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
