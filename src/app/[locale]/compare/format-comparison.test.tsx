import { screen, within } from '@testing-library/react';

import { render } from '@/test/intl';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ActionFile } from '@/lib/actions';

import { FormatComparison } from './format-comparison';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function file(filename: string, size: number, originalSize = 1000): ActionFile {
    return {
        data: new Uint8Array(size),
        filename,
        mimeType: `image/${filename.split('.').pop()}`,
        originalSize,
    };
}

const FILES = [
    file('shot.jpg', 400),
    file('shot.png', 900),
    file('shot.webp', 250),
    file('shot.avif', 150),
];

function setup(files = FILES) {
    const onDismiss = vi.fn();
    const view = render(<FormatComparison files={files} quality={80} onDismiss={onDismiss} />);

    return { ...view, onDismiss, user: userEvent.setup() };
}

function rowLabels(): string[] {
    return screen
        .getAllByRole('listitem')
        .map(row => within(row).getByText(/^(JPEG|PNG|WEBP|AVIF)$/).textContent ?? '');
}

describe('FormatComparison', () => {
    it('ranks the formats smallest first, whatever order they arrive in', () => {
        setup();

        expect(rowLabels()).toEqual(['AVIF', 'WEBP', 'JPEG', 'PNG']);
    });

    it('names the winner and its size up front', () => {
        setup();

        expect(screen.getByText(/AVIF is smallest — 150 B/)).toBeInTheDocument();
    });

    it('reports the quality and the original size it compared against', () => {
        setup();

        expect(
            screen.getByText(/Encoded at quality 80 from a 1,000 B original/)
        ).toBeInTheDocument();
    });

    it('shows each format against the original', () => {
        setup();

        const winner = screen.getAllByRole('listitem')[0];

        expect(within(winner).getByText('150 B')).toBeInTheDocument();
        expect(within(winner).getByText(/−85% vs original/)).toBeInTheDocument();
    });

    it('flags the row that grew', () => {
        setup([file('shot.jpg', 400), file('shot.png', 1500)]);

        const largest = screen.getAllByRole('listitem')[1];

        expect(within(largest).getByText(/\+50% vs original/)).toBeInTheDocument();
    });

    it('calls a .jpg row JPEG', () => {
        setup([file('shot.jpg', 400)]);

        expect(screen.getByText('JPEG')).toBeInTheDocument();
    });

    it('offers a download per format', async () => {
        setup();

        for (const name of ['shot.avif', 'shot.webp', 'shot.jpg', 'shot.png']) {
            expect(screen.getByRole('button', { name: `Download ${name}` })).toBeInTheDocument();
        }
    });

    it('says plainly that smallest is not always the right answer', () => {
        setup();

        expect(screen.getByText(/Smaller is not automatically better/)).toBeInTheDocument();
    });

    it('discards on request', async () => {
        const { onDismiss, user } = setup();

        await user.click(screen.getByRole('button', { name: 'Discard' }));

        expect(onDismiss).toHaveBeenCalled();
    });

    it('renders nothing when there is nothing to compare', () => {
        const { container } = setup([]);

        expect(container).toBeEmptyDOMElement();
    });

    it('releases every preview url when it goes away', () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        const { unmount } = setup();

        revoke.mockClear();
        unmount();

        expect(revoke).toHaveBeenCalledTimes(FILES.length);
    });
});
