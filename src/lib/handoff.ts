import { TOOLS, type Tool } from './site';

export type Handoff = {
    id: number;
    from: string;
    files: File[];
};

let pending: Handoff | null = null;
let counter = 0;

export function setHandoff(from: string, files: File[]): Handoff {
    counter += 1;
    pending = { id: counter, from, files };

    return pending;
}

export function takeHandoff(): Handoff | null {
    const handoff = pending;

    pending = null;

    return handoff;
}

export function peekHandoff(): Handoff | null {
    return pending;
}

export function clearHandoff(): void {
    pending = null;
}

export function handoffTargets(mimeTypes: readonly string[], from?: string | null): Tool[] {
    if (!mimeTypes.length) return [];

    return TOOLS.filter(
        tool =>
            tool.href !== from &&
            tool.intake &&
            mimeTypes.every(mimeType => tool.intake?.mimeTypes.includes(mimeType))
    );
}

export type HandoffSource = { data: Uint8Array; filename: string; mimeType: string };

export function handoffFile({ data, filename, mimeType }: HandoffSource): File {
    return new File([data as BlobPart], filename, { type: mimeType });
}
