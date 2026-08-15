import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_BATCH_FILES, MAX_FILE_SIZE } from '@/lib/image';

import { PdfDropzone, useLoadedPdfs, type LoadedPdf } from './pdf-dropzone';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { toast } = await import('sonner');

function pdf(name: string, size = 8, type = 'application/pdf'): File {
    const file = new File([new Uint8Array(1)], name, { type });

    Object.defineProperty(file, 'size', { value: size });

    return file;
}

function loaded(name: string, size = 8): LoadedPdf {
    return { file: pdf(name, size), id: `id-${name}` };
}

function setup(props: Partial<React.ComponentProps<typeof PdfDropzone>> = {}) {
    const handlers = {
        onAdd: vi.fn(),
        onRemove: vi.fn(),
        onMove: vi.fn(),
        onClear: vi.fn(),
    };
    const view = render(
        <PdfDropzone documents={[]} max={MAX_BATCH_FILES} {...handlers} {...props} />
    );
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;

    return { ...handlers, ...view, input, user: userEvent.setup() };
}

beforeEach(() => {
    vi.mocked(toast.error).mockClear();
});

describe('the empty dropzone', () => {
    it('states the format and the batch limits', () => {
        setup();

        expect(screen.getByText(/drag & drop pdfs/i)).toBeInTheDocument();
        expect(
            screen.getByText(new RegExp(`PDF · up to ${MAX_BATCH_FILES} at a time, 20MB in total`))
        ).toBeInTheDocument();
    });

    it('always takes several files, since merging one is meaningless', () => {
        expect(setup().input.multiple).toBe(true);
    });
});

describe('adding files', () => {
    it('reports the accepted files in one call, each with a stable id', async () => {
        const { input, onAdd, user } = setup();

        await user.upload(input, [pdf('a.pdf'), pdf('b.pdf')]);
        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        const added: LoadedPdf[] = onAdd.mock.calls[0][0];

        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(added.map(entry => entry.file.name)).toEqual(['a.pdf', 'b.pdf']);
        expect(new Set(added.map(entry => entry.id)).size).toBe(2);
    });

    it('accepts a PDF the browser gave no MIME type for', async () => {
        const { input, onAdd, user } = setup();

        await user.upload(input, [pdf('scan.PDF', 8, '')]);
        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        expect(onAdd.mock.calls[0][0][0].file.name).toBe('scan.PDF');
    });

    it('rejects a file that is not a PDF', async () => {
        const { input, onAdd } = setup();

        fireEvent.change(input, { target: { files: [pdf('photo.png', 8, 'image/png')] } });

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('photo.png: not a PDF');
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('rejects a file over the per-file limit', async () => {
        const { input, onAdd, user } = setup();

        await user.upload(input, [pdf('huge.pdf', MAX_FILE_SIZE + 1)]);

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('larger than 20MB');
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('keeps the batch under the total budget', async () => {
        const { input, onAdd, user } = setup();
        const twelveMb = Math.round(MAX_FILE_SIZE * 0.6);

        await user.upload(input, [pdf('a.pdf', twelveMb), pdf('b.pdf', twelveMb)]);
        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        expect(onAdd.mock.calls[0][0]).toHaveLength(1);
        expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('under 20MB in total');
    });

    it('refuses everything once the list is full', async () => {
        const { input, onAdd, user } = setup({
            max: 2,
            documents: [loaded('a.pdf'), loaded('b.pdf')],
        });

        await user.upload(input, [pdf('c.pdf')]);

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('up to 2 PDFs at a time');
        expect(onAdd).not.toHaveBeenCalled();
    });
});

describe('the loaded list', () => {
    it('numbers the rows, because the order is the page order', () => {
        setup({ documents: [loaded('first.pdf'), loaded('second.pdf')] });

        expect(screen.getByText('2 PDFs · 16 B')).toBeInTheDocument();
        expect(screen.getByText('1 of 2 · 8 B')).toBeInTheDocument();
        expect(screen.getByText('2 of 2 · 8 B')).toBeInTheDocument();
    });

    it('always offers reordering, with the ends disabled', async () => {
        const { onMove, user } = setup({ documents: [loaded('one.pdf'), loaded('two.pdf')] });

        expect(screen.getByRole('button', { name: 'Move one.pdf up' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Move two.pdf down' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Move two.pdf up' }));

        expect(onMove).toHaveBeenCalledWith(1, 0);
    });

    it('removes by index', async () => {
        const { onRemove, user } = setup({ documents: [loaded('a.pdf'), loaded('b.pdf')] });

        await user.click(screen.getByRole('button', { name: 'Remove b.pdf' }));

        expect(onRemove).toHaveBeenCalledWith(1);
    });

    it('stops offering "Add more" at the limit', () => {
        setup({ max: 2, documents: [loaded('a.pdf'), loaded('b.pdf')] });

        expect(screen.getByRole('button', { name: 'Add more' })).toBeDisabled();
    });

    it('disables every control while an action is running', () => {
        setup({ documents: [loaded('a.pdf')], disabled: true });

        expect(screen.getByRole('button', { name: 'Add more' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Remove all' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Remove a.pdf' })).toBeDisabled();
    });
});

describe('useLoadedPdfs', () => {
    it('appends rather than replacing, up to the maximum', () => {
        const { result } = renderHook(() => useLoadedPdfs(2));

        act(() => result.current.addPdfs([loaded('a.pdf')]));
        act(() => result.current.addPdfs([loaded('b.pdf'), loaded('c.pdf')]));

        expect(result.current.documents.map(entry => entry.file.name)).toEqual(['a.pdf', 'b.pdf']);
    });

    it('reorders and removes without touching the rest', () => {
        const { result } = renderHook(() => useLoadedPdfs(3));

        act(() => result.current.addPdfs([loaded('a.pdf'), loaded('b.pdf'), loaded('c.pdf')]));
        act(() => result.current.movePdf(2, 0));

        expect(result.current.documents.map(entry => entry.file.name)).toEqual([
            'c.pdf',
            'a.pdf',
            'b.pdf',
        ]);

        act(() => result.current.removePdf(1));

        expect(result.current.documents.map(entry => entry.file.name)).toEqual(['c.pdf', 'b.pdf']);
    });

    it('clears the list', () => {
        const { result } = renderHook(() => useLoadedPdfs(3));

        act(() => result.current.addPdfs([loaded('a.pdf')]));
        act(() => result.current.clearPdfs());

        expect(result.current.documents).toEqual([]);
    });
});
