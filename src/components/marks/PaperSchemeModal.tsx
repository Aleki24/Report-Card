"use client";

import React, { useState, useEffect } from 'react';
import {
    PaperSchemeEditor,
    DEFAULT_SCHEME_DRAFT,
    validateSchemeDraft,
    schemeDraftToPayload,
    type PaperSchemeDraft,
} from './PaperSchemeEditor';
import { getSubjectPresetForPapers } from '@/lib/multi-paper';
import type { ExamSubjectComponent } from '@/types';

interface Props {
    examId: string;
    subjectName?: string;
    onClose: () => void;
    /** Called after a successful save so callers can refresh mark-entry UIs */
    onSaved: () => void;
}

/**
 * Configure the paper structure (P1/P2/P3 + aggregation method) for an
 * existing exam subject. Leaving multi-paper off keeps the exam on the
 * normal single-mark flow.
 */
export function PaperSchemeModal({ examId, subjectName, onClose, onSaved }: Props) {
    const [draft, setDraft] = useState<PaperSchemeDraft>(DEFAULT_SCHEME_DRAFT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/school/exams/${examId}/components`, { cache: 'no-store' });
                const json = await res.json();
                const scheme = json.data;
                if (scheme && (scheme.components?.length || 0) > 0) {
                    setDraft({
                        enabled: scheme.is_enabled && scheme.assessment_mode === 'multi_paper',
                        aggregation_method: scheme.aggregation_method,
                        components: scheme.components.map((c: ExamSubjectComponent) => ({
                            component_code: c.component_code,
                            component_name: c.component_name,
                            max_score: String(c.max_score),
                        })),
                    });
                } else {
                    // No scheme yet — pre-fill from the subject preset when one applies
                    const preset = subjectName ? getSubjectPresetForPapers(subjectName) : null;
                    if (preset) {
                        setDraft({
                            enabled: false,
                            aggregation_method: preset.aggregation_method,
                            components: preset.components.map(c => ({
                                component_code: c.component_code,
                                component_name: c.component_name,
                                max_score: String(c.max_score),
                            })),
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to load paper scheme:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [examId, subjectName]);

    const handleSave = async () => {
        const validationError = validateSchemeDraft(draft);
        if (validationError) {
            setMessage({ type: 'error', text: validationError });
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/school/exams/${examId}/components`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(schemeDraftToPayload(draft)),
            });
            const json = await res.json();
            if (!res.ok) {
                setMessage({ type: 'error', text: json.error || 'Failed to save' });
            } else {
                setMessage({ type: 'success', text: '✅ Paper configuration saved!' });
                setTimeout(() => { onSaved(); onClose(); }, 900);
            }
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
                style={{ animation: 'fadeIn .2s ease' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">📑 Papers Configuration</h2>
                        {subjectName && (
                            <p className="text-sm text-muted-foreground mt-1">{subjectName}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-[var(--color-text)] text-xl leading-none cursor-pointer"
                        title="Close"
                    >
                        ×
                    </button>
                </div>

                {loading ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">Loading configuration…</div>
                ) : (
                    <>
                        <div className="mb-4">
                            <PaperSchemeEditor value={draft} onChange={setDraft} subjectName={subjectName} />
                        </div>

                        {draft.enabled && (
                            <p className="text-[11px] mb-4 p-2 rounded-md bg-muted" style={{ color: 'var(--color-text-muted)' }}>
                                Teachers will enter one mark per paper. Marks entered before a paper change may need re-entry for the final score to be recalculated.
                            </p>
                        )}

                        {message && (
                            <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'success'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
                            <button className="btn-primary disabled:opacity-50" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving…' : 'Save Configuration'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
