'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useTheme } from '@/components/theme-provider';
import { THEME_KEYS, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const ICONS: Record<Theme, LucideIcon> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
};

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const t = useTranslations('Theme');

    return (
        <div
            role="group"
            aria-label={t('group')}
            className="flex items-center gap-0.5 rounded-full border bg-card p-0.5"
        >
            {THEME_KEYS.map(key => {
                const Icon = ICONS[key];
                const active = theme === key;

                return (
                    <button
                        key={key}
                        type="button"
                        title={t(key)}
                        aria-label={t(key)}
                        aria-pressed={active}
                        onClick={() => setTheme(key)}
                        className={cn(
                            'flex size-7 items-center justify-center rounded-full transition-colors',
                            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                            active
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Icon className="size-3.5" />
                    </button>
                );
            })}
        </div>
    );
}
