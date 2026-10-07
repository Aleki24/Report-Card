import { useCallback, useState } from 'react';
import { useApi } from '@/lib/api';
import { errorMessage, pluralize } from '@/lib/format';

export interface ReleaseOutcome { tone: 'success' | 'warning'; text: string }

/**
 * Releases papers one by one (the status route takes one exam at a time) and
 * sums up how it went: "Released 9 papers." or which ones failed and why.
 */
export function useReleasePapers() {
    const api = useApi();
    const [busy, setBusy] = useState(false);
    const release = useCallback(async (papers: readonly { id: string; subject_name: string }[], noun = 'subject'): Promise<ReleaseOutcome> => {
        setBusy(true);
        const failures: string[] = [];
        for (const p of papers) {
            try {
                await api.post(`/api/school/exams/${p.id}/status`, { action: 'publish', confirm: true });
            } catch (err) {
                failures.push(`${p.subject_name}: ${errorMessage(err, 'failed')}`);
            }
        }
        setBusy(false);
        const ok = papers.length - failures.length;
        return failures.length === 0
            ? { tone: 'success', text: `Released ${pluralize(ok, noun)}.` }
            : { tone: 'warning', text: `Released ${ok}; ${failures.length} failed — ${failures.join('; ')}` };
    }, [api]);
    return { release, busy };
}
