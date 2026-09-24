import { File, Paths } from 'expo-file-system';

/**
 * Device-local drafts, the phone counterpart of the web's offline mark
 * entry (`src/lib/offline-marks.ts`): what a teacher types is kept on the
 * device until the server confirms it, so a dropped connection or a closed
 * app never loses a class's marks.
 */

interface Draft<T> {
    savedAt: number;
    value: T;
}

function draftFile(key: string): File {
    return new File(Paths.document, `draft-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

export async function loadDraft<T>(key: string): Promise<Draft<T> | null> {
    try {
        const file = draftFile(key);
        if (!file.exists) return null;
        return JSON.parse(await file.text()) as Draft<T>;
    } catch {
        return null;
    }
}

export function saveDraft<T>(key: string, value: T): number | null {
    try {
        const file = draftFile(key);
        const savedAt = Date.now();
        if (!file.exists) file.create();
        file.write(JSON.stringify({ savedAt, value } satisfies Draft<T>));
        return savedAt;
    } catch {
        return null;
    }
}

export function clearDraft(key: string): void {
    try {
        const file = draftFile(key);
        if (file.exists) file.delete();
    } catch {
        // Nothing to clear.
    }
}
