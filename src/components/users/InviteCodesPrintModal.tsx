"use client";

import React, { useState } from 'react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

type Category = 'all' | 'admin' | 'teacher' | 'student';
type Status = 'active' | 'all';

const CATEGORY_OPTIONS: { value: Category; label: string; hint: string }[] = [
    { value: 'all', label: 'All categories', hint: 'One PDF with Administrators, Teachers & Students, each on its own page' },
    { value: 'teacher', label: 'Teachers only', hint: 'Class & subject teachers' },
    { value: 'student', label: 'Students only', hint: 'All students' },
    { value: 'admin', label: 'Administrators only', hint: 'School admins' },
];

/**
 * Lets an admin download a printable PDF of user invitation codes grouped by
 * category — a combined PDF, or a ZIP with a separate PDF per category — to
 * hand out to users in person.
 */
export function InviteCodesPrintModal({ onClose }: { onClose: () => void }) {
    const [category, setCategory] = useState<Category>('all');
    const [status, setStatus] = useState<Status>('active');
    const [downloading, setDownloading] = useState<'pdf' | 'zip' | null>(null);
    const [error, setError] = useState('');

    const download = async (format: 'pdf' | 'zip') => {
        setError('');
        setDownloading(format);
        try {
            const params = new URLSearchParams({ category, status, format });
            const res = await fetch(`/api/admin/invite-codes/pdf?${params.toString()}`);
            if (!res.ok) {
                let message = 'Failed to generate the file.';
                try { message = (await res.json()).error || message; } catch { /* non-JSON */ }
                setError(message);
                return;
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="?([^"]+)"?/);
            const filename = match?.[1] || (format === 'zip' ? 'invite_codes.zip' : 'invite_codes.pdf');

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            onClose();
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setDownloading(null);
        }
    };

    const busy = downloading !== null;

    return (
        <ModalOverlay onClose={onClose}>
            <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">🖨️ Print Invite Codes</h2>
            <p className="text-xs text-muted-foreground mb-6">
                Generate a printable PDF of invitation codes grouped by category, so you can share each person&apos;s
                code with them in person at your school.
            </p>

            {error && <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">{error}</div>}

            <div className="mb-5">
                <label className="block text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Category</label>
                <div className="space-y-2">
                    {CATEGORY_OPTIONS.map(opt => (
                        <label
                            key={opt.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${category === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}
                        >
                            <input
                                type="radio"
                                name="invite-category"
                                className="mt-0.5"
                                checked={category === opt.value}
                                onChange={() => setCategory(opt.value)}
                            />
                            <span>
                                <span className="block text-sm font-medium">{opt.label}</span>
                                <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <label className="block text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Which codes</label>
                <select className="input-field w-full" value={status} onChange={e => setStatus(e.target.value as Status)}>
                    <option value="active">Active only (unused &amp; not expired)</option>
                    <option value="all">All codes (include used &amp; expired)</option>
                </select>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border">
                <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
                {category === 'all' && (
                    <button type="button" className="btn-secondary disabled:opacity-50" onClick={() => download('zip')} disabled={busy}>
                        {downloading === 'zip' ? '⏳ Building…' : '📦 Separate PDFs (ZIP)'}
                    </button>
                )}
                <button type="button" className="btn-primary disabled:opacity-50" onClick={() => download('pdf')} disabled={busy}>
                    {downloading === 'pdf' ? '⏳ Building…' : '📄 Download PDF'}
                </button>
            </div>
        </ModalOverlay>
    );
}
