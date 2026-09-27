export type Shareable = { data: Uint8Array; name: string; mimeType: string };

export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

export type ShareSupport = { all: boolean; each: boolean[] };

const NONE: ShareSupport = { all: false, each: [] };

function toFile({ data, name, mimeType }: Shareable): File {
    return new File([data as BlobPart], name, { type: mimeType });
}

function canShare(entries: readonly Pick<Shareable, 'name' | 'mimeType'>[]): boolean {
    try {
        return navigator.canShare({
            files: entries.map(({ name, mimeType }) => new File([], name, { type: mimeType })),
        });
    } catch {
        return false;
    }
}

export function shareSupport(
    entries: readonly Pick<Shareable, 'name' | 'mimeType'>[]
): ShareSupport {
    if (
        typeof navigator === 'undefined' ||
        typeof navigator.share !== 'function' ||
        typeof navigator.canShare !== 'function' ||
        entries.length === 0
    ) {
        return NONE;
    }

    return {
        all: canShare(entries),
        each: entries.map(entry => canShare([entry])),
    };
}

export async function shareFiles(entries: readonly Shareable[]): Promise<ShareOutcome> {
    try {
        await navigator.share({ files: entries.map(toFile) });

        return 'shared';
    } catch (error) {
        return error instanceof DOMException &&
            (error.name === 'AbortError' || error.name === 'InvalidStateError')
            ? 'cancelled'
            : 'failed';
    }
}
