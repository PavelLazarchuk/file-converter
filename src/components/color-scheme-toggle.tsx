'use client';

import { useColorScheme } from '@/components/color-scheme-provider';
import { COLOR_SCHEME_KEYS, COLOR_SCHEME_LABELS, COLOR_SCHEME_SWATCH } from '@/lib/color-scheme';
import { cn } from '@/lib/utils';

export function ColorSchemeToggle() {
    const { colorScheme, setColorScheme } = useColorScheme();

    return (
        <div
            role="group"
            aria-label="Color scheme"
            className="flex items-center gap-0.5 rounded-full border bg-card p-0.5"
        >
            {COLOR_SCHEME_KEYS.map(key => {
                const active = colorScheme === key;

                return (
                    <button
                        key={key}
                        type="button"
                        title={COLOR_SCHEME_LABELS[key]}
                        aria-label={COLOR_SCHEME_LABELS[key]}
                        aria-pressed={active}
                        onClick={() => setColorScheme(key)}
                        className={cn(
                            'flex size-6 items-center justify-center rounded-full transition-colors',
                            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                            active && 'ring-foreground/50 ring-1 ring-offset-1 ring-offset-card'
                        )}
                    >
                        <span
                            aria-hidden
                            className="size-3.5 rounded-full"
                            style={{ backgroundColor: COLOR_SCHEME_SWATCH[key] }}
                        />
                    </button>
                );
            })}
        </div>
    );
}
