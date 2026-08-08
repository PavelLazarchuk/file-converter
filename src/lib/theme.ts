export const THEME_KEYS = ['light', 'dark', 'system'] as const;

export type Theme = (typeof THEME_KEYS)[number];

export const DEFAULT_THEME: Theme = 'system';

export const THEME_STORAGE_KEY = 'theme';

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function isTheme(value: unknown): value is Theme {
    return THEME_KEYS.includes(value as Theme);
}

export function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
    if (theme === 'system') return prefersDark ? 'dark' : 'light';

    return theme;
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia('${DARK_MEDIA_QUERY}').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
