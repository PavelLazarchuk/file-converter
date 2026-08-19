export const COLOR_SCHEME_KEYS = ['violet', 'blue', 'green', 'rose'] as const;

export type ColorScheme = (typeof COLOR_SCHEME_KEYS)[number];

export const DEFAULT_COLOR_SCHEME: ColorScheme = 'violet';

export const COLOR_SCHEME_STORAGE_KEY = 'color-scheme';

export const COLOR_SCHEME_SWATCH: Record<ColorScheme, string> = {
    violet: 'oklch(0.54 0.22 277)',
    blue: 'oklch(0.54 0.22 235)',
    green: 'oklch(0.54 0.2 150)',
    rose: 'oklch(0.54 0.22 350)',
};

export function isColorScheme(value: unknown): value is ColorScheme {
    return COLOR_SCHEME_KEYS.includes(value as ColorScheme);
}

export const COLOR_SCHEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${COLOR_SCHEME_STORAGE_KEY}');var k=${JSON.stringify(COLOR_SCHEME_KEYS)};if(k.indexOf(s)>-1)document.documentElement.setAttribute('data-scheme',s);}catch(e){}})();`;
