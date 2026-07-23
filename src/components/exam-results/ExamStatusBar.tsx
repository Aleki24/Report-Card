"use client";

import React, { useState } from 'react';

type ExamStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';

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
 */
export function ExamStatusBar({ examId, status, isAdmin, onChanged }: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const runAction = async (action: 'publish' | 'approve' | 'unpublish') => {
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

    return (
        <div className="mb-4 p-3 rounded-md text-sm bg-muted border border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
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
                {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
            <div className="flex items-center gap-2">
                {status === 'DRAFT' && (
                    <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: 'var(--space-1) var(--space-3)' }} onClick={() => runAction('publish')} disabled={busy}>
                        {busy ? 'Publishing…' : '📤 Publish for review'}
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
    );
}
