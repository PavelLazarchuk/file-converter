'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { countLabel } from '@/lib/image';
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
    const onFilesRef = useRef(onFiles);

    useEffect(() => {
        onFilesRef.current = onFiles;
    });

    useEffect(() => {
        if (!enabled) return;

        const handoff = takeHandoff();

        if (!handoff?.files.length) return;

        toast.info(`${countLabel(handoff.files.length, 'file')} from ${handoff.from}`);
        onFilesRef.current(handoff.files);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
