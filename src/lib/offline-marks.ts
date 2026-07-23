/**
 * offline-marks.ts
 * Google-Docs-style resilience for mark entry.
 *
 * Two things live here, both backed by localStorage so nothing typed is
 * ever lost when the network drops or the tab is closed mid-entry:
 *
 *  1. DRAFTS  — the in-progress rows for an exam (per-paper P1/P2/P3 scores
 *     included). Autosaved as the teacher types and restored on reload, so
 *     entry can continue exactly where it left off whenever the network
 *     comes back.
 *
 *  2. SYNC QUEUE — batches of marks that were confirmed with "Save All" but
 *     could not reach the server (offline / request failed). They wait in the
 *     queue and are flushed automatically once the browser is back online.
 *
 * Everything is namespaced by exam so multiple exams can be entered
 * side by side without clobbering each other.
 */

const DRAFT_PREFIX = 'skulbase:mark-draft:v1:';
const QUEUE_KEY = 'skulbase:mark-sync-queue:v1';

/** True only in a browser with a usable localStorage (SSR-safe). */
function hasStorage(): boolean {
    try {
        return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
        return false;
    }
}

/* ── Drafts (in-progress rows) ──────────────────────────── */

export interface MarkDraft<TRow = unknown> {
    examId: string;
    rows: TRow[];
    /** ms epoch of last local save */
    savedAt: number;
}

function draftKey(examId: string): string {
    return `${DRAFT_PREFIX}${examId}`;
}

/**
 * Persist the current rows for an exam. Rows the teacher hasn't touched are
 * fine to include — restoration just replays them. Never throws.
 */
export function saveDraft<TRow>(examId: string, rows: TRow[]): number | null {
    if (!hasStorage() || !examId) return null;
    const savedAt = Date.now();
    try {
        window.localStorage.setItem(draftKey(examId), JSON.stringify({ examId, rows, savedAt }));
        return savedAt;
    } catch (err) {
        // Quota / private-mode failures shouldn't break typing.
        console.warn('[offline-marks] saveDraft failed:', err);
        return null;
    }
}

export function loadDraft<TRow>(examId: string): MarkDraft<TRow> | null {
    if (!hasStorage() || !examId) return null;
    try {
        const raw = window.localStorage.getItem(draftKey(examId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as MarkDraft<TRow>;
        if (!parsed || !Array.isArray(parsed.rows)) return null;
        return parsed;
    } catch (err) {
        console.warn('[offline-marks] loadDraft failed:', err);
        return null;
    }
}

export function clearDraft(examId: string): void {
    if (!hasStorage() || !examId) return;
    try {
        window.localStorage.removeItem(draftKey(examId));
    } catch (err) {
        console.warn('[offline-marks] clearDraft failed:', err);
    }
}

/* ── Sync queue (confirmed but unsent batches) ──────────── */

export interface QueuedMarkBatch {
    /** Stable id so a batch is only ever sent once. */
    id: string;
    examId: string;
    /** Exact JSON body previously handed to POST /api/school/exam-marks. */
    payload: { exam_id: string; marks: unknown[] };
    queuedAt: number;
    /** Human label for the toast/indicator (e.g. exam or subject name). */
    label?: string;
}

export function loadQueue(): QueuedMarkBatch[] {
    if (!hasStorage()) return [];
    try {
        const raw = window.localStorage.getItem(QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as QueuedMarkBatch[]) : [];
    } catch (err) {
        console.warn('[offline-marks] loadQueue failed:', err);
        return [];
    }
}

function writeQueue(batches: QueuedMarkBatch[]): void {
    if (!hasStorage()) return;
    try {
        window.localStorage.setItem(QUEUE_KEY, JSON.stringify(batches));
    } catch (err) {
        console.warn('[offline-marks] writeQueue failed:', err);
    }
}

export function enqueueBatch(batch: Omit<QueuedMarkBatch, 'id' | 'queuedAt'>): QueuedMarkBatch {
    const full: QueuedMarkBatch = {
        ...batch,
        id: `${batch.examId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        queuedAt: Date.now(),
    };
    const queue = loadQueue();
    queue.push(full);
    writeQueue(queue);
    return full;
}

export function removeBatch(id: string): void {
    writeQueue(loadQueue().filter(b => b.id !== id));
}

export function pendingCountForExam(examId: string): number {
    return loadQueue().filter(b => b.examId === examId).length;
}

export interface FlushResult {
    sent: number;
    remaining: number;
}

/**
 * Try to POST every queued batch. Each success is removed from the queue;
 * failures stay put for the next attempt. Safe to call repeatedly (e.g. on
 * every `online` event) — nothing is sent twice because sent batches are
 * dropped immediately.
 */
export async function flushQueue(): Promise<FlushResult> {
    const queue = loadQueue();
    let sent = 0;

    for (const batch of queue) {
        try {
            const res = await fetch('/api/school/exam-marks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch.payload),
            });
            if (res.ok) {
                removeBatch(batch.id);
                sent += 1;
            } else {
                // A 4xx means the server rejected the data itself; retrying
                // won't help, so drop it rather than looping forever. Network
                // errors throw and are caught below (kept for retry).
                if (res.status >= 400 && res.status < 500) {
                    removeBatch(batch.id);
                }
                // 5xx: leave queued for a later attempt.
            }
        } catch {
            // Still offline / unreachable — stop early, keep the rest queued.
            break;
        }
    }

    return { sent, remaining: loadQueue().length };
}

export function isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
}
