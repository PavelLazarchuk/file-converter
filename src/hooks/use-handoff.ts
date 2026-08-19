'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useRouter } from '@/i18n/navigation';
import { handoffFile, setHandoff, takeHandoff, type HandoffSource } from '@/lib/handoff';
import type { Tool } from '@/lib/site';

export function useSendToTool() {
    const router = useRouter();

    return function sendToTool(tool: Tool, from: string, files: readonly HandoffSource[]) {
        setHandoff(from, files.map(handoffFile));
        router.push(tool.href);
    };
}

export function useHandoffIntake(onFiles: (files: File[]) => void, enabled = true) {
    const t = useTranslations('Uploads');
    const count = useTranslations('Common');
    const onFilesRef = useRef(onFiles);
    const labelRef = useRef({ t, count });

    useEffect(() => {
        labelRef.current = { t, count };
    });

    useEffect(() => {
        onFilesRef.current = onFiles;
    });

    useEffect(() => {
        if (!enabled) return;

        const handoff = takeHandoff();

        if (!handoff?.files.length) return;

        toast.info(
            labelRef.current.t('handoff', {
                files: labelRef.current.count('files', { count: handoff.files.length }),
                from: handoff.from,
            })
        );
        onFilesRef.current(handoff.files);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
