'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
    DARK_MEDIA_QUERY,
    DEFAULT_THEME,
    THEME_STORAGE_KEY,
    isTheme,
    resolveTheme,
    type Theme,
} from '@/lib/theme';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    window.addEventListener('storage', onChange);

    return () => {
        listeners.delete(onChange);
        window.removeEventListener('storage', onChange);
    };
}

function getSnapshot(): Theme {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);

    return isTheme(stored) ? stored : DEFAULT_THEME;
}

function getServerSnapshot(): Theme {
    return DEFAULT_THEME;
}

function apply(theme: Theme): void {
    const resolved = resolveTheme(theme, window.matchMedia(DARK_MEDIA_QUERY).matches);
    const root = document.documentElement;

    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setTheme = useCallback((next: Theme) => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // empty
        }

        for (const listener of listeners) listener();
    }, []);

    return { theme, setTheme };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme } = useTheme();

    useEffect(() => {
        apply(theme);

        if (theme !== 'system') return;

        const media = window.matchMedia(DARK_MEDIA_QUERY);
        const onChange = () => apply('system');

        media.addEventListener('change', onChange);

        return () => media.removeEventListener('change', onChange);
    }, [theme]);

    return children;
}
