import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoDownload } from '@/hooks/use-auto-download';
import { AUTO_DOWNLOAD_STORAGE_KEY } from '@/lib/preferences';

beforeEach(() => {
    localStorage.clear();
});

describe('useAutoDownload', () => {
    it('starts from the stored preference', () => {
        localStorage.setItem(AUTO_DOWNLOAD_STORAGE_KEY, 'true');

        expect(renderHook(() => useAutoDownload()).result.current.autoDownload).toBe(true);
    });

    it('defaults to off when nothing is stored', () => {
        expect(renderHook(() => useAutoDownload()).result.current.autoDownload).toBe(false);
    });

    it('persists the choice', () => {
        const { result } = renderHook(() => useAutoDownload());

        act(() => result.current.setAutoDownload(true));

        expect(result.current.autoDownload).toBe(true);
        expect(localStorage.getItem(AUTO_DOWNLOAD_STORAGE_KEY)).toBe('true');
    });

    it('keeps every subscriber in step — the point of the external store', () => {
        const first = renderHook(() => useAutoDownload());
        const second = renderHook(() => useAutoDownload());

        act(() => first.result.current.setAutoDownload(true));

        expect(second.result.current.autoDownload).toBe(true);
    });

    it('falls back to the default when storage is unavailable', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });

        expect(renderHook(() => useAutoDownload()).result.current.autoDownload).toBe(false);
    });
});
