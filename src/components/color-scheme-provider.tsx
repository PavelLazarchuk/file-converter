'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
    COLOR_SCHEME_STORAGE_KEY,
    DEFAULT_COLOR_SCHEME,
    isColorScheme,
    type ColorScheme,
} from '@/lib/color-scheme';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    window.addEventListener('storage', onChange);

    return () => {
        listeners.delete(onChange);
        window.removeEventListener('storage', onChange);
    };
}

function getSnapshot(): ColorScheme {
    const stored = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);

    return isColorScheme(stored) ? stored : DEFAULT_COLOR_SCHEME;
}

function getServerSnapshot(): ColorScheme {
    return DEFAULT_COLOR_SCHEME;
}

export function useColorScheme(): {
    colorScheme: ColorScheme;
    setColorScheme: (scheme: ColorScheme) => void;
} {
    const colorScheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setColorScheme = useCallback((next: ColorScheme) => {
        try {
            localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
        } catch {
            // empty
        }

        for (const listener of listeners) listener();
    }, []);

    return { colorScheme, setColorScheme };
}

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
    const { colorScheme } = useColorScheme();

    useEffect(() => {
        document.documentElement.setAttribute('data-scheme', colorScheme);
    }, [colorScheme]);

    return children;
}
