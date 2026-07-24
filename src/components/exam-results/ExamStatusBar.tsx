"use client";

import React, { useState, useEffect, useCallback } from 'react';

type ExamStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';

interface StudentGap { name: string; admission_number: string; missing?: string[] }
interface PublishReadiness {
    isMultiPaper: boolean;
    papers: { code: string; name: string }[];
    rosterCount: number;
    markedCount: number;
    fullyMarkedCount: number;
    unmarked: StudentGap[];
    partiallyMarked: StudentGap[];
    hasIssues: boolean;
}

interface Props {
    examId: string;
    status: ExamStatus;
    isAdmin: boolean;
    onChanged: () => void;
}

const STATUS_LABEL: Record<ExamStatus, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved',
};

const STATUS_COLOR: Record<ExamStatus, string> = {
    DRAFT: 'var(--color-text-muted)',
    PENDING_APPROVAL: '#F59E0B',
    APPROVED: '#10B981',
};

/**
 * Publish → Approve → (download-ready) workflow controls for a single exam's
 * results. A subject/class teacher publishes what they entered, an admin
 * approves it, and either side can unpublish to send it back for correction
 * (undoing an approval is admin-only).
 *
 * Publishing is a two-step confirm: the teacher first sees a readiness report
 * (who is fully marked, who is missing papers, who has no marks and will be
 * excluded) and only then commits — so partial results are never published
 * by surprise.
 */
export function ExamStatusBar({ examId, status, isAdmin, onChanged }: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [readiness, setReadiness] = useState<PublishReadiness | null>(null);
    const [confirming, setConfirming] = useState(false);

    const loadReadiness = useCallback(async () => {
        try {
            const res = await fetch(`/api/school/exams/${examId}/status`);
            if (!res.ok) return;
            const data = await res.json();
            setReadiness(data.readiness || null);
        } catch { /* progress line is best-effort */ }
    }, [examId]);

    useEffect(() => { loadReadiness(); }, [loadReadiness, status]);

    const runAction = async (action: 'approve' | 'unpublish') => {
        setBusy(true); setError('');
        try {
            const res = await fetch(`/api/school/exams/${examId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Action failed.'); return; }
            onChanged();
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    // Step 1 — ask the server for the readiness report (no publish yet).
    const startPublish = async () => {
        setBusy(true); setError('');
        try {
            const res = await fetch(`/api/school/exams/${examId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'publish' }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Action failed.'); return; }
            if (data.requiresConfirmation) {
                setReadiness(data.readiness || null);
                setConfirming(true);
            } else {
                onChanged();
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    // Step 2 — commit the publish now that the teacher has seen the report.
    const confirmPublish = async () => {
        setBusy(true); setError('');
        try {
            const res = await fetch(`/api/school/exams/${examId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'publish', confirm: true }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Action failed.'); return; }
            setConfirming(false);
            onChanged();
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const progressLine = readiness && (
        <span className="text-xs text-muted-foreground">
            {readiness.markedCount}/{readiness.rosterCount || readiness.markedCount} students marked
            {readiness.isMultiPaper && readiness.partiallyMarked.length > 0 && ` · ${readiness.partiallyMarked.length} missing some papers`}
            {readiness.unmarked.length > 0 && ` · ${readiness.unmarked.length} with no marks`}
        </span>
    );

    return (
        <div className="mb-4 rounded-md bg-muted border border-border">
            <div className="p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Results status:</span>
                    <span
                        style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-full)',
                            fontSize: 12, fontWeight: 700,
                            background: `${STATUS_COLOR[status]}20`, color: STATUS_COLOR[status],
                            border: `1px solid ${STATUS_COLOR[status]}40`,
                        }}
                    >
                        {STATUS_LABEL[status]}
                    </span>
                    {progressLine}
                    {error && <span className="text-xs text-red-400">{error}</span>}
                </div>
                <div className="flex items-center gap-2">
                    {status === 'DRAFT' && (
                        <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: 'var(--space-1) var(--space-3)' }} onClick={startPublish} disabled={busy}>
                            {busy ? 'Checking…' : '📤 Publish for review'}
                        </button>
                    )}
                    {status === 'PENDING_APPROVAL' && isAdmin && (
                        <button type="button" className="btn-primary" style={{ fontSize: 12, padding: 'var(--space-1) var(--space-3)' }} onClick={() => runAction('approve')} disabled={busy}>
                            {busy ? 'Approving…' : '✅ Approve'}
                        </button>
                    )}
                    {(status === 'PENDING_APPROVAL' || (status === 'APPROVED' && isAdmin)) && (
                        <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: 'var(--space-1) var(--space-3)' }} onClick={() => runAction('unpublish')} disabled={busy}>
                            {busy ? 'Unpublishing…' : '↩️ Unpublish'}
                        </button>
                    )}
                </div>
            </div>

            {confirming && readiness && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => !busy && setConfirming(false)}>
                    <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-base font-bold font-display mb-1">Publish these results?</h2>
                        <p className="text-xs text-muted-foreground mb-4">
                            Once published, an admin reviews and approves before report cards can be downloaded.
                        </p>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="p-3 rounded-lg bg-surface-raised text-center">
                                <div className="text-lg font-bold text-emerald-400">{readiness.fullyMarkedCount}</div>
                                <div className="text-[11px] text-muted-foreground">Fully marked</div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-raised text-center">
                                <div className="text-lg font-bold text-amber-400">{readiness.partiallyMarked.length}</div>
                                <div className="text-[11px] text-muted-foreground">Missing papers</div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-raised text-center">
                                <div className="text-lg font-bold text-muted-foreground">{readiness.unmarked.length}</div>
                                <div className="text-[11px] text-muted-foreground">No marks</div>
                            </div>
                        </div>

                        {readiness.partiallyMarked.length > 0 && (
                            <div className="mb-3">
                                <p className="text-xs font-semibold text-amber-500 mb-1">
                                    ⚠️ Missing some papers — will be scored on the papers they have:
                                </p>
                                <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto pl-1">
                                    {readiness.partiallyMarked.slice(0, 50).map((s, i) => (
                                        <li key={i}>
                                            <strong className="text-foreground">{s.name || s.admission_number}</strong>
                                            {s.missing && s.missing.length > 0 && <span> — missing {s.missing.join(', ')}</span>}
                                        </li>
                                    ))}
                                    {readiness.partiallyMarked.length > 50 && <li>…and {readiness.partiallyMarked.length - 50} more</li>}
                                </ul>
                            </div>
                        )}

                        {readiness.unmarked.length > 0 && (
                            <div className="mb-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">
                                    These students have no marks and will not be included:
                                </p>
                                <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto pl-1">
                                    {readiness.unmarked.slice(0, 50).map((s, i) => (
                                        <li key={i}>{s.name || s.admission_number}</li>
                                    ))}
                                    {readiness.unmarked.length > 50 && <li>…and {readiness.unmarked.length - 50} more</li>}
                                </ul>
                            </div>
                        )}

                        {!readiness.hasIssues && (
                            <p className="text-xs text-emerald-400 mb-3">✅ Every student in this class is fully marked.</p>
                        )}

                        {error && <div className="mb-3 text-xs text-red-400">{error}</div>}

                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                            <button type="button" className="btn-secondary text-xs" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
                            <button type="button" className="btn-primary text-xs disabled:opacity-50" onClick={confirmPublish} disabled={busy}>
                                {busy ? 'Publishing…' : readiness.hasIssues ? 'Publish anyway' : 'Publish for review'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
