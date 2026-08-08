'use client';

import { Toaster } from 'sonner';

import { useTheme } from '@/components/theme-provider';

export function AppToaster() {
    const { theme } = useTheme();

    return <Toaster position="top-right" richColors theme={theme} />;
}
