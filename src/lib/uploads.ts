import { MAX_BATCH_BYTES, MAX_FILE_SIZE } from './image';

export type UploadCopy = {
    full: (max: number) => string;
    noRoom: (room: number) => string;
    unsupported: (name: string) => string;
    tooLarge: (name: string) => string;
    overBudget: (name: string) => string;
};

export type UploadRules = {
    max: number;
    single?: boolean;
    currentCount: number;
    currentBytes: number;
    accepts: (file: File) => boolean;
    copy: UploadCopy;
};

export type UploadDecision = {
    accepted: File[];
    problems: string[];
};

export function acceptUploads(incoming: readonly File[], rules: UploadRules): UploadDecision {
    const { max, single = false, currentCount, currentBytes, accepts, copy } = rules;
    const room = single ? 1 : max - currentCount;

    if (room <= 0) return { accepted: [], problems: [copy.full(max)] };

    const accepted: File[] = [];
    const problems: string[] = [];
    let budget = single ? MAX_FILE_SIZE : MAX_BATCH_BYTES - currentBytes;

    for (const file of incoming) {
        if (accepted.length >= room) {
            problems.push(copy.noRoom(room));

            break;
        }
        if (!accepts(file)) {
            problems.push(copy.unsupported(file.name));

            continue;
        }
        if (file.size > MAX_FILE_SIZE) {
            problems.push(copy.tooLarge(file.name));

            continue;
        }
        if (file.size > budget) {
            problems.push(single ? copy.tooLarge(file.name) : copy.overBudget(file.name));

            continue;
        }

        budget -= file.size;
        accepted.push(file);
    }

    return { accepted, problems };
}

export function uploadProblemSummary(
    problems: readonly string[],
    more: (first: string, extra: number) => string
): string | null {
    if (!problems.length) return null;

    return problems.length === 1 ? problems[0] : more(problems[0], problems.length - 1);
}

export function totalUploadBytes(files: readonly { file: File }[]): number {
    return files.reduce((sum, entry) => sum + entry.file.size, 0);
}
