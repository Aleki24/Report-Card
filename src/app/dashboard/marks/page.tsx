"use client";

import React, { useState } from 'react';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';

export default function MarksPage() {
    const [mode, setMode] = useState<'bulk' | 'manual'>('bulk');
    const [selectedTerm, setSelectedTerm] = useState('mid_term');

    return (
        <div className="w-full max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Mark Entry</h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                    Upload marks in bulk or enter them manually for each subject
                </p>
            </div>

            {/* Controls Bar */}
            <div
                className="flex flex-col md:flex-row md:justify-between md:items-center gap-4"
                style={{ marginTop: 'var(--space-8)', marginBottom: 'var(--space-10)' }}
            >
                {/* Mode Toggle */}
                <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md overflow-hidden w-full md:w-auto basis-full md:basis-auto">
                    <button
                        onClick={() => setMode('bulk')}
                        className={`flex-1 md:flex-none font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${mode === 'bulk'
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'
                            }`}
                        style={{ padding: 'var(--space-4) var(--space-6)' }}
                    >
                        📄 Bulk Upload
                    </button>
                    <button
                        onClick={() => setMode('manual')}
                        className={`flex-1 md:flex-none font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${mode === 'manual'
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'
                            }`}
                        style={{ padding: 'var(--space-4) var(--space-6)' }}
                    >
                        ✏️ Manual Entry
                    </button>
                </div>

                {/* Term Selector */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <label className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">Term:</label>
                    <select
                        className="input-field flex-1 md:w-48"
                        value={selectedTerm}
                        onChange={(e) => setSelectedTerm(e.target.value)}
                    >
                        <option value="mid_term">Mid-Term Exam</option>
                        <option value="end_term">End-Term Exam</option>
                        <option value="annual">Annual Exam</option>
                    </select>
                </div>
            </div>

            {/* Content */}
            <div className="w-full">
                {mode === 'bulk' ? <BulkUpload /> : <ManualEntryGrid />}
            </div>
        </div>
    );
}
