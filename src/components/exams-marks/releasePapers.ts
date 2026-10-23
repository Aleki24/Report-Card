import { RELEASE_BATCH, type ReleaseResponse } from '@/lib/release-ready';

/** One paper to release, as named in a failure message. */
interface Releasable { id: string; subject_name: string }

/**
 * Releases papers through the bulk route, up to RELEASE_BATCH per request,
 * so a whole term goes in a request or two instead of one per paper.
 * Unmarked papers are left hidden and reported, not asked about.
 */
export async function releasePapers(papers: readonly Releasable[]): Promise<{ ok: number; failures: string[] }> {
    const nameOf = new Map(papers.map(p => [p.id, p.subject_name]));
    let ok = 0;
    const failures: string[] = [];
    for (let i = 0; i < papers.length; i += RELEASE_BATCH) {
        const batch = papers.slice(i, i + RELEASE_BATCH);
        try {
            const res = await fetch('/api/school/exams/release', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examIds: batch.map(p => p.id) }),
            });
            const data = (await res.json().catch(() => null)) as (ReleaseResponse & { error?: string }) | null;
            if (!res.ok || !data) {
                for (const p of batch) failures.push(`${p.subject_name}: ${data?.error ?? `error ${res.status}`}`);
                continue;
            }
            ok += data.released.length;
            for (const f of data.failures) failures.push(`${nameOf.get(f.id) ?? 'A paper'}: ${f.reason}`);
        } catch {
            for (const p of batch) failures.push(`${p.subject_name}: network error`);
        }
    }
    return { ok, failures };
}
