'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
    AUTO_DOWNLOAD_STORAGE_KEY,
    DEFAULT_AUTO_DOWNLOAD,
    isAutoDownload,
} from '@/lib/preferences';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    window.addEventListener('storage', onChange);

    return () => {
        listeners.delete(onChange);
        window.removeEventListener('storage', onChange);
    };
}

function getSnapshot(): boolean {
    try {
        return isAutoDownload(localStorage.getItem(AUTO_DOWNLOAD_STORAGE_KEY));
    } catch {
        return DEFAULT_AUTO_DOWNLOAD;
    }
}

function getServerSnapshot(): boolean {
    return DEFAULT_AUTO_DOWNLOAD;
}

export function useAutoDownload(): {
    autoDownload: boolean;
    setAutoDownload: (next: boolean) => void;
} {
    const autoDownload = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setAutoDownload = useCallback((next: boolean) => {
        try {
            localStorage.setItem(AUTO_DOWNLOAD_STORAGE_KEY, String(next));
        } catch {
            // empty
        }

        for (const listener of listeners) listener();
    }, []);

    return { autoDownload, setAutoDownload };
}
