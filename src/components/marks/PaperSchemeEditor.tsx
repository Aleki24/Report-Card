"use client";

import React from 'react';
import type { AggregationMethod } from '@/types';
import { AGGREGATION_METHODS, getSubjectPresetForPapers } from '@/lib/multi-paper';

export interface PaperDraft {
    component_code: string;
    component_name: string;
    max_score: string;
}

export interface PaperSchemeDraft {
    enabled: boolean;
    aggregation_method: AggregationMethod;
    components: PaperDraft[];
}

export const DEFAULT_SCHEME_DRAFT: PaperSchemeDraft = {
    enabled: false,
    aggregation_method: 'sum_then_percentage',
    components: [
        { component_code: 'P1', component_name: 'Paper 1', max_score: '100' },
        { component_code: 'P2', component_name: 'Paper 2', max_score: '100' },
    ],
};

interface Props {
    value: PaperSchemeDraft;
    onChange: (next: PaperSchemeDraft) => void;
    /** Used to suggest a preset (Maths, English, Kiswahili, Sciences) */
    subjectName?: string;
    disabled?: boolean;
}

const MAX_PAPERS = 6;

/**
 * Controlled editor for an exam subject's paper structure.
 * Used in exam creation and in the per-exam papers config modal.
 */
export function PaperSchemeEditor({ value, onChange, subjectName, disabled }: Props) {
    const preset = subjectName ? getSubjectPresetForPapers(subjectName) : null;
    const methodInfo = AGGREGATION_METHODS.find(m => m.value === value.aggregation_method);

    const applyPreset = () => {
        if (!preset) return;
        onChange({
            enabled: true,
            aggregation_method: preset.aggregation_method,
            components: preset.components.map(c => ({
                component_code: c.component_code,
                component_name: c.component_name,
                max_score: String(c.max_score),
            })),
        });
    };

    const updatePaper = (index: number, field: keyof PaperDraft, val: string) => {
        const components = value.components.map((c, i) =>
            i === index ? { ...c, [field]: field === 'component_code' ? val.toUpperCase() : val } : c
        );
        onChange({ ...value, components });
    };

    const addPaper = () => {
        if (value.components.length >= MAX_PAPERS) return;
        const n = value.components.length + 1;
        onChange({
            ...value,
            components: [
                ...value.components,
                { component_code: `P${n}`, component_name: `Paper ${n}`, max_score: '100' },
            ],
        });
    };

    const removePaper = (index: number) => {
        if (value.components.length <= 2) return;
        onChange({ ...value, components: value.components.filter((_, i) => i !== index) });
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Enable toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={value.enabled}
                    disabled={disabled}
                    onChange={e => onChange({ ...value, enabled: e.target.checked })}
                />
                <span className="text-sm font-medium">Multi-paper subject</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    (enter marks per paper — P1/P2/P3 — resolved into one final score)
                </span>
            </label>

            {value.enabled && (
                <>
                    {/* Preset suggestion */}
                    {preset && (
                        <button
                            type="button"
                            className="text-xs text-left px-3 py-2 rounded-md transition-all hover:opacity-80"
                            style={{ background: 'rgba(99,102,241,0.1)', border: '1px dashed rgba(99,102,241,0.4)', color: 'var(--color-accent)', cursor: 'pointer' }}
                            onClick={applyPreset}
                            disabled={disabled}
                        >
                            ✨ Apply preset: <strong>{preset.label}</strong> (editable after applying)
                        </button>
                    )}

                    {/* Aggregation method */}
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">Final score calculation *</label>
                        <select
                            className="input-field w-full text-sm"
                            value={value.aggregation_method}
                            disabled={disabled}
                            onChange={e => onChange({ ...value, aggregation_method: e.target.value as AggregationMethod })}
                        >
                            {AGGREGATION_METHODS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        {methodInfo && (
                            <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{methodInfo.description}</p>
                        )}
                    </div>

                    {/* Papers */}
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">Papers ({value.components.length})</label>
                        <div className="flex flex-col gap-2">
                            {value.components.map((c, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <input
                                        className="input-field w-16 text-xs font-mono uppercase"
                                        style={{ padding: '6px 8px' }}
                                        placeholder="P1"
                                        value={c.component_code}
                                        disabled={disabled}
                                        onChange={e => updatePaper(i, 'component_code', e.target.value)}
                                    />
                                    <input
                                        className="input-field flex-1 text-xs"
                                        style={{ padding: '6px 8px' }}
                                        placeholder={`Paper ${i + 1}`}
                                        value={c.component_name}
                                        disabled={disabled}
                                        onChange={e => updatePaper(i, 'component_name', e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        className="input-field w-20 text-xs"
                                        style={{ padding: '6px 8px' }}
                                        placeholder="Max"
                                        min={1}
                                        value={c.max_score}
                                        disabled={disabled}
                                        onChange={e => updatePaper(i, 'max_score', e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-destructive px-1 text-lg cursor-pointer disabled:opacity-30"
                                        onClick={() => removePaper(i)}
                                        disabled={disabled || value.components.length <= 2}
                                        title="Remove paper"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <button
                                type="button"
                                className="text-xs text-primary hover:underline disabled:opacity-40 cursor-pointer"
                                onClick={addPaper}
                                disabled={disabled || value.components.length >= MAX_PAPERS}
                            >
                                + Add paper
                            </button>
                            {value.aggregation_method === 'science_70_plus_practical' && (
                                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                    Last paper = practical (30%)
                                </span>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/** Validate a draft before saving; returns an error message or null. */
export function validateSchemeDraft(draft: PaperSchemeDraft): string | null {
    if (!draft.enabled) return null;
    if (draft.components.length < 2) return 'Multi-paper subjects need at least 2 papers.';
    const codes = new Set<string>();
    for (const c of draft.components) {
        const code = c.component_code.trim().toUpperCase();
        if (!code) return 'Every paper needs a code (e.g. P1).';
        if (codes.has(code)) return `Duplicate paper code: ${code}.`;
        codes.add(code);
        const max = parseFloat(c.max_score);
        if (isNaN(max) || max <= 0) return `Paper ${code} needs a max score greater than 0.`;
    }
    return null;
}

/** Build the PUT payload for /api/school/exams/[examId]/components */
export function schemeDraftToPayload(draft: PaperSchemeDraft) {
    return {
        assessment_mode: draft.enabled ? 'multi_paper' : 'single_paper',
        aggregation_method: draft.aggregation_method,
        is_enabled: draft.enabled,
        components: draft.components.map(c => ({
            component_code: c.component_code.trim().toUpperCase(),
            component_name: c.component_name.trim() || c.component_code.trim().toUpperCase(),
            max_score: parseFloat(c.max_score),
        })),
    };
}
