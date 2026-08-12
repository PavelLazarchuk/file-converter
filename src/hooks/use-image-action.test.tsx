import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoadedImage } from '@/components/image-dropzone';
import { useImageAction } from '@/hooks/use-image-action';
import type { ActionFile, ActionResult } from '@/lib/actions';
import { downloadFile } from '@/lib/download';
import { AUTO_DOWNLOAD_STORAGE_KEY } from '@/lib/preferences';

vi.mock('@/lib/download', () => ({ downloadFile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { toast } = await import('sonner');
const downloaded = vi.mocked(downloadFile);

function upload(name = 'photo.png'): LoadedImage {
    return {
        file: new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' }),
        previewUrl: 'blob:source',
        width: 10,
        height: 10,
    };
}

function resultFile(overrides: Partial<ActionFile> = {}): ActionFile {
    return {
        data: new Uint8Array([137, 80, 78, 71]),
        filename: 'photo.png',
        mimeType: 'image/png',
        originalSize: 3,
        ...overrides,
    };
}

function actionReturning(result: ActionResult) {
    return vi.fn<(formData: FormData) => Promise<ActionResult>>(async () => result);
}

beforeEach(() => {
    localStorage.clear();
    downloaded.mockClear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
});

describe('running an action', () => {
    it('sends every image under the same field name, plus the parameters', async () => {
        const action = actionReturning({ success: true, files: [resultFile()] });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload('a.png'), upload('b.png')], { quality: '80' }));
        await waitFor(() => expect(action).toHaveBeenCalled());

        const formData = action.mock.calls[0][0];

        expect(formData.getAll('file')).toHaveLength(2);
        expect(formData.get('quality')).toBe('80');
    });

    it('describes each result and previews the ones that are images', async () => {
        const action = actionReturning({
            success: true,
            files: [
                resultFile({ filename: 'a.png' }),
                resultFile({ filename: 'b.txt', mimeType: 'text/plain' }),
            ],
        });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(result.current.outcome).not.toBeNull());

        const files = result.current.outcome?.files ?? [];

        expect(files.map(entry => entry.file.filename)).toEqual(['a.png', 'b.txt']);
        expect(files[0]).toMatchObject({ width: 800, height: 600 });
        expect(files[0].previewUrl).toContain('blob:');
        expect(files[1].previewUrl).toBeNull();
    });

    it('toasts the error and keeps the previous result cleared when the action fails', async () => {
        const action = actionReturning({ success: false, error: 'Too many requests' });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many requests'));

        expect(result.current.outcome).toBeNull();
    });

    it('surfaces partial failures on the outcome and in a toast', async () => {
        const action = actionReturning({
            success: true,
            files: [resultFile()],
            failures: [{ filename: 'broken.png', error: 'not a readable image' }],
        });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(result.current.outcome).not.toBeNull());

        expect(result.current.outcome?.failures).toHaveLength(1);
        expect(toast.error).toHaveBeenCalledWith('broken.png: not a readable image');
    });

    it('hands the raw files to onResult and skips the result card when handled', async () => {
        const action = actionReturning({ success: true, files: [resultFile()] });
        const { result } = renderHook(() => useImageAction(action));
        const onResult = vi.fn(() => 'handled' as const);

        act(() => result.current.run([upload()], {}, { onResult }));
        await waitFor(() => expect(onResult).toHaveBeenCalled());

        expect(result.current.outcome).toBeNull();
        expect(downloaded).not.toHaveBeenCalled();
    });
});

describe('automatic downloads', () => {
    it('stays off by default', async () => {
        const action = actionReturning({ success: true, files: [resultFile()] });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(result.current.outcome).not.toBeNull());

        expect(downloaded).not.toHaveBeenCalled();
    });

    it('saves a single result when the preference is on', async () => {
        localStorage.setItem(AUTO_DOWNLOAD_STORAGE_KEY, 'true');

        const action = actionReturning({ success: true, files: [resultFile()] });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(downloaded).toHaveBeenCalled());

        expect(downloaded).toHaveBeenCalledWith(expect.any(Uint8Array), 'photo.png', 'image/png');
    });

    it('bundles several results into one zip instead of firing many downloads', async () => {
        localStorage.setItem(AUTO_DOWNLOAD_STORAGE_KEY, 'true');

        const action = actionReturning({
            success: true,
            files: [resultFile({ filename: 'a.png' }), resultFile({ filename: 'b.png' })],
        });
        const { result } = renderHook(() => useImageAction(action, 'compressed-images.zip'));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(downloaded).toHaveBeenCalled());

        expect(downloaded).toHaveBeenCalledTimes(1);

        const [data, filename, mimeType] = downloaded.mock.calls[0];

        expect(filename).toBe('compressed-images.zip');
        expect(mimeType).toBe('application/zip');
        expect(new TextDecoder().decode(data.subarray(0, 2))).toBe('PK');
    });

    it('waits for confirmation when a result carries a warning', async () => {
        localStorage.setItem(AUTO_DOWNLOAD_STORAGE_KEY, 'true');

        const action = actionReturning({
            success: true,
            files: [resultFile({ warning: "Couldn't reach 100 KB" })],
        });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(result.current.outcome).not.toBeNull());

        expect(downloaded).not.toHaveBeenCalled();
    });

    it('waits for confirmation when part of the batch failed', async () => {
        localStorage.setItem(AUTO_DOWNLOAD_STORAGE_KEY, 'true');

        const action = actionReturning({
            success: true,
            files: [resultFile()],
            failures: [{ filename: 'broken.png', error: 'not a readable image' }],
        });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(result.current.outcome).not.toBeNull());

        expect(downloaded).not.toHaveBeenCalled();
    });
});

describe('downloadAll', () => {
    it('downloads a lone result as itself, not as a zip', async () => {
        const action = actionReturning({ success: true, files: [resultFile()] });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(result.current.outcome).not.toBeNull());
        act(() => result.current.downloadAll());

        expect(downloaded).toHaveBeenCalledWith(expect.any(Uint8Array), 'photo.png', 'image/png');
    });

    it('does nothing when there is no result', () => {
        const action = actionReturning({ success: true, files: [resultFile()] });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.downloadAll());

        expect(downloaded).not.toHaveBeenCalled();
    });
});

describe('object URL bookkeeping', () => {
    it('revokes the previews once the card has finished animating out', async () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        const action = actionReturning({
            success: true,
            files: [resultFile({ filename: 'a.png' }), resultFile({ filename: 'b.png' })],
        });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(result.current.outcome).not.toBeNull());

        const urls = result.current.outcome?.files.map(entry => entry.previewUrl);

        act(() => result.current.clearResult());

        expect(result.current.isLeaving).toBe(true);
        expect(result.current.outcome).not.toBeNull();

        await waitFor(() => expect(result.current.outcome).toBeNull());

        expect(result.current.isLeaving).toBe(false);
        for (const url of urls ?? []) expect(revoke).toHaveBeenCalledWith(url);
    });

    it('drops the result straight away when a new run starts mid-exit', async () => {
        const action = actionReturning({ success: true, files: [resultFile()] });
        const { result } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(result.current.outcome).not.toBeNull());

        act(() => result.current.clearResult());
        act(() => result.current.run([upload()], {}));

        expect(result.current.isLeaving).toBe(false);
        await waitFor(() => expect(result.current.outcome).not.toBeNull());
    });

    it('revokes the previews when the component unmounts', async () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        const action = actionReturning({ success: true, files: [resultFile()] });
        const { result, unmount } = renderHook(() => useImageAction(action));

        act(() => result.current.run([upload()], {}));
        await waitFor(() => expect(result.current.outcome).not.toBeNull());

        const url = result.current.outcome?.files[0].previewUrl;

        unmount();

        expect(revoke).toHaveBeenCalledWith(url);
    });
});
