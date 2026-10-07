/** One paper to release, as named in a failure message. */
interface Releasable { id: string; subject_name: string }

/**
 * Releases papers one by one (the status route takes one exam at a time),
 * confirmed, so unmarked learners are left out rather than asked about.
 */
export async function releasePapers(papers: readonly Releasable[]): Promise<{ ok: number; failures: string[] }> {
    let ok = 0;
    const failures: string[] = [];
    for (const p of papers) {
        try {
            const res = await fetch(`/api/school/exams/${p.id}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'publish', confirm: true }),
            });
            if (res.ok) { ok++; continue; }
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            failures.push(`${p.subject_name}: ${data.error ?? `error ${res.status}`}`);
        } catch {
            failures.push(`${p.subject_name}: network error`);
        }
    }
    return { ok, failures };
}
