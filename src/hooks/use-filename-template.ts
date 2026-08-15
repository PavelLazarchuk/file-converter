'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
    DEFAULT_FILENAME_TEMPLATE_PREFERENCE,
    FILENAME_TEMPLATE_STORAGE_KEY,
    readFilenameTemplate,
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

function getSnapshot(): string {
    try {
        return readFilenameTemplate(localStorage.getItem(FILENAME_TEMPLATE_STORAGE_KEY));
    } catch {
        return DEFAULT_FILENAME_TEMPLATE_PREFERENCE;
    }
}

function getServerSnapshot(): string {
    return DEFAULT_FILENAME_TEMPLATE_PREFERENCE;
}

export function useFilenameTemplate(): {
    template: string;
    setTemplate: (next: string) => void;
} {
    const template = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setTemplate = useCallback((next: string) => {
        try {
            localStorage.setItem(FILENAME_TEMPLATE_STORAGE_KEY, next);
        } catch {
            // empty
        }

        for (const listener of listeners) listener();
    }, []);

    return { template, setTemplate };
}
