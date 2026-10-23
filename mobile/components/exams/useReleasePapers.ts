import { useCallback, useState } from 'react';
import { useApi } from '@/lib/api';
import { errorMessage, pluralize } from '@/lib/format';
import { RELEASE_BATCH, type ReleaseResponse } from '@shared/release-ready';

export interface ReleaseOutcome { tone: 'success' | 'warning'; text: string }

/**
 * Releases papers through the bulk route (up to RELEASE_BATCH a request,
 * where it used to be one request per paper) and sums up how it went:
 * "Released 9 papers." or which ones were left and why.
 */
export function useReleasePapers() {
    const api = useApi();
    const [busy, setBusy] = useState(false);
    const release = useCallback(async (papers: readonly { id: string; subject_name: string }[], noun = 'subject'): Promise<ReleaseOutcome> => {
        setBusy(true);
        const nameOf = new Map(papers.map((p) => [p.id, p.subject_name]));
        let ok = 0;
        const failures: string[] = [];
        for (let i = 0; i < papers.length; i += RELEASE_BATCH) {
            const batch = papers.slice(i, i + RELEASE_BATCH);
            try {
                const res = await api.post<ReleaseResponse>('/api/school/exams/release', { examIds: batch.map((p) => p.id) });
                ok += res.released.length;
                for (const f of res.failures) failures.push(`${nameOf.get(f.id) ?? 'A paper'}: ${f.reason}`);
            } catch (err) {
                for (const p of batch) failures.push(`${p.subject_name}: ${errorMessage(err, 'failed')}`);
            }
        }
        setBusy(false);
        return failures.length === 0
            ? { tone: 'success', text: `Released ${pluralize(ok, noun)}.` }
            : { tone: 'warning', text: `Released ${ok}; ${failures.length} not released — ${failures.join('; ')}` };
    }, [api]);
    return { release, busy };
}
