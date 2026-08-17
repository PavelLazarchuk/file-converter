import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageDropzone, useLoadedImages, type LoadedImage } from '@/components/image-dropzone';
import { clearHandoff, peekHandoff, setHandoff } from '@/lib/handoff';
import { CONVERT_SOURCE_KEYS, MAX_BATCH_FILES, MAX_FILE_SIZE } from '@/lib/image';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { toast } = await import('sonner');

function png(name: string, bytes = 8): File {
    return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

function sized(name: string, size: number): File {
    const file = png(name);

    Object.defineProperty(file, 'size', { value: size });

    return file;
}

function loaded(name: string, size = 8): LoadedImage {
    return { file: png(name, size), previewUrl: `blob:${name}`, width: 100, height: 80 };
}

function setup(props: Partial<React.ComponentProps<typeof ImageDropzone>> = {}) {
    const handlers = {
        onAdd: vi.fn(),
        onRemove: vi.fn(),
        onClear: vi.fn(),
    };
    const view = render(<ImageDropzone images={[]} {...handlers} {...props} />);
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;

    return { ...handlers, ...view, input, user: userEvent.setup() };
}

beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.info).mockClear();
    clearHandoff();
});

describe('a result handed over by another tool', () => {
    it('loads it on mount, without a drop', async () => {
        setHandoff('Compress', [png('shrunk.png')]);

        const { onAdd } = setup({ max: MAX_BATCH_FILES });

        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        expect(onAdd.mock.calls[0][0].map((image: LoadedImage) => image.file.name)).toEqual([
            'shrunk.png',
        ]);
        expect(toast.info).toHaveBeenCalledWith('1 file from Compress');
        expect(peekHandoff()).toBeNull();
    });

    it('puts the files through the same rules a drop obeys', async () => {
        setHandoff('Convert', [png('fine.png'), sized('huge.png', MAX_FILE_SIZE + 1)]);

        const { onAdd } = setup({ max: MAX_BATCH_FILES });

        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        expect(onAdd.mock.calls[0][0].map((image: LoadedImage) => image.file.name)).toEqual([
            'fine.png',
        ]);
        expect(toast.error).toHaveBeenCalledWith('huge.png: larger than 20MB.');
    });

    it('keeps only the first image when the tool takes one', async () => {
        setHandoff('Compare formats', [png('a.png'), png('b.png')]);

        const { onAdd } = setup();

        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        expect(onAdd.mock.calls[0][0].map((image: LoadedImage) => image.file.name)).toEqual([
            'a.png',
        ]);
        expect(toast.error).toHaveBeenCalledWith(
            'There is room for 1 more image — skipped the rest.'
        );
    });

    it('leaves the handoff alone when the dropzone has opted out', () => {
        setHandoff('Compress', [png('shrunk.png')]);

        const { onAdd } = setup({ receivesHandoff: false });

        expect(onAdd).not.toHaveBeenCalled();
        expect(peekHandoff()).not.toBeNull();
    });
});

describe('the empty dropzone', () => {
    it('spells out the accepted formats and the single-file limit', () => {
        setup();

        expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
        expect(screen.getByText(/JPEG, PNG, WEBP or AVIF · up to 20MB/)).toBeInTheDocument();
    });

    it('advertises the batch limits when the tool takes many', () => {
        setup({ max: MAX_BATCH_FILES, formats: CONVERT_SOURCE_KEYS });

        expect(screen.getByText(/drag & drop images/i)).toBeInTheDocument();
        expect(
            screen.getByText(new RegExp(`up to ${MAX_BATCH_FILES} at a time, 20MB in total`))
        ).toBeInTheDocument();
    });

    it('only accepts multiple files when the tool takes a batch', () => {
        expect(setup().input.multiple).toBe(false);
        expect(setup({ max: 5 }).input.multiple).toBe(true);
    });
});

describe('adding files', () => {
    it('probes each upload and reports them in one call', async () => {
        const { input, onAdd, user } = setup({ max: 5 });

        await user.upload(input, [png('a.png'), png('b.png')]);
        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onAdd.mock.calls[0][0].map((image: LoadedImage) => image.file.name)).toEqual([
            'a.png',
            'b.png',
        ]);
        expect(onAdd.mock.calls[0][0][0]).toMatchObject({ width: 800, height: 600 });
    });

    it('rejects an unsupported type', async () => {
        const { input, onAdd } = setup({ max: 5 });

        fireEvent.change(input, {
            target: {
                files: [new File([new Uint8Array(4)], 'sheet.pdf', { type: 'application/pdf' })],
            },
        });

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('unsupported file type');
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('rejects a file over the per-file limit', async () => {
        const { input, onAdd, user } = setup({ max: 5 });

        await user.upload(input, [sized('huge.png', MAX_FILE_SIZE + 1)]);

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('larger than 20MB');
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('keeps the batch under the total budget', async () => {
        const { input, onAdd, user } = setup({ max: 5 });
        const twelveMb = Math.round(MAX_FILE_SIZE * 0.6);

        await user.upload(input, [sized('a.png', twelveMb), sized('b.png', twelveMb)]);
        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        expect(onAdd.mock.calls[0][0]).toHaveLength(1);
        expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('under 20MB in total');
    });

    it('takes only as many as there is room for', async () => {
        const { input, onAdd, user } = setup({ max: 2, images: [loaded('kept.png')] });

        await user.upload(input, [png('a.png'), png('b.png')]);
        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        expect(onAdd.mock.calls[0][0]).toHaveLength(1);
        expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('There is room for 1 more image');
    });

    it('refuses everything once the batch is full', async () => {
        const { input, onAdd, user } = setup({
            max: 2,
            images: [loaded('a.png'), loaded('b.png')],
        });

        await user.upload(input, [png('c.png')]);

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('up to 2 images at a time');
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('still swaps the file in single-image tools, where the slot is never full', async () => {
        const { input, onAdd, user } = setup({ images: [loaded('old.png')] });

        await user.upload(input, [png('new.png')]);
        await waitFor(() => expect(onAdd).toHaveBeenCalled());

        expect(onAdd.mock.calls[0][0][0].file.name).toBe('new.png');
    });
});

describe('the loaded list', () => {
    it('shows one row per image with its size, and removes by index', async () => {
        const { onRemove, user } = setup({
            max: 5,
            images: [loaded('first.png'), loaded('second.png')],
        });

        expect(screen.getByText('2 images · 16 B')).toBeInTheDocument();
        expect(screen.getByText('first.png')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove second.png' }));

        expect(onRemove).toHaveBeenCalledWith(1);
    });

    it('offers reordering only when the tool cares about order', async () => {
        const onMove = vi.fn();
        const images = [loaded('one.png'), loaded('two.png')];

        const { unmount } = setup({ max: 5, images });

        expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
        unmount();

        const { user } = setup({ max: 5, images, onMove });

        expect(screen.getByRole('button', { name: 'Move one.png up' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Move two.png down' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Move two.png up' }));

        expect(onMove).toHaveBeenCalledWith(1, 0);
    });

    it('stops offering "Add more" at the limit', () => {
        setup({ max: 2, images: [loaded('a.png'), loaded('b.png')] });

        expect(screen.getByRole('button', { name: 'Add more' })).toBeDisabled();
    });

    it('renders the single-image card for single-file tools', async () => {
        const { onClear, user } = setup({ images: [loaded('solo.png')] });

        expect(screen.getByText('100 × 80 · 8 B')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Choose a different file' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove file' }));

        expect(onClear).toHaveBeenCalled();
    });

    it('disables every control while an action is running', () => {
        setup({ max: 5, images: [loaded('a.png')], disabled: true });

        expect(screen.getByRole('button', { name: 'Add more' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Remove all' })).toBeDisabled();
    });
});

describe('useLoadedImages', () => {
    it('replaces the upload at max 1 and revokes the old preview', () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        const { result } = renderHook(() => useLoadedImages());
        const first = loaded('a.png');

        act(() => result.current.addImages([first]));
        act(() => result.current.addImages([loaded('b.png')]));

        expect(result.current.images.map(image => image.file.name)).toEqual(['b.png']);
        expect(revoke).toHaveBeenCalledWith(first.previewUrl);
    });

    it('appends up to the maximum', () => {
        const { result } = renderHook(() => useLoadedImages(2));

        act(() => result.current.addImages([loaded('a.png')]));
        act(() => result.current.addImages([loaded('b.png'), loaded('c.png')]));

        expect(result.current.images.map(image => image.file.name)).toEqual(['a.png', 'b.png']);
    });

    it('removes by index and revokes only that preview', () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        const { result } = renderHook(() => useLoadedImages(3));
        const images = [loaded('a.png'), loaded('b.png'), loaded('c.png')];

        act(() => result.current.addImages(images));
        act(() => result.current.removeImage(1));

        expect(result.current.images.map(image => image.file.name)).toEqual(['a.png', 'c.png']);
        expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:b.png');
    });

    it('reorders without dropping anything', () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        const { result } = renderHook(() => useLoadedImages(3));

        act(() => result.current.addImages([loaded('a.png'), loaded('b.png'), loaded('c.png')]));
        act(() => result.current.moveImage(2, 0));

        expect(result.current.images.map(image => image.file.name)).toEqual([
            'c.png',
            'a.png',
            'b.png',
        ]);
        expect(revoke).not.toHaveBeenCalled();
    });

    it('ignores a move that would fall off the list', () => {
        const { result } = renderHook(() => useLoadedImages(3));

        act(() => result.current.addImages([loaded('a.png'), loaded('b.png')]));
        act(() => result.current.moveImage(0, -1));

        expect(result.current.images.map(image => image.file.name)).toEqual(['a.png', 'b.png']);
    });

    it('revokes everything on clear and on unmount', () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        const { result, unmount } = renderHook(() => useLoadedImages(3));

        act(() => result.current.addImages([loaded('a.png'), loaded('b.png')]));
        act(() => result.current.clearImages());

        expect(result.current.images).toEqual([]);
        expect(revoke).toHaveBeenCalledTimes(2);

        act(() => result.current.addImages([loaded('c.png')]));
        unmount();

        expect(revoke).toHaveBeenCalledWith('blob:c.png');
    });
});
