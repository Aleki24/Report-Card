"use client";

import React, { useState, useEffect } from 'react';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface ExamOption {
    id: string;
    name: string;
    exam_type: string;
    max_score: number;
    subjects: { name: string } | null;
    grades: { name_display: string } | null;
}

export default function MarksPage() {
    const supabase = createSupabaseBrowserClient();

    const [mode, setMode] = useState<'bulk' | 'manual'>('bulk');
    const [exams, setExams] = useState<ExamOption[]>([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchExams = async () => {
            const { data, error } = await supabase
                .from('exams')
                .select('id, name, exam_type, max_score, subjects:subject_id(name), grades:grade_id(name_display)')
                .order('exam_date', { ascending: false });

            if (error) console.error('Error fetching exams:', error);

            if (data && data.length > 0) {
                setExams(data as unknown as ExamOption[]);
                setSelectedExamId(data[0].id);
            }
            setLoading(false);
        };
        fetchExams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedExam = exams.find(e => e.id === selectedExamId);

    return (
        <div className="w-full max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Mark Entry</h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                    Upload marks in bulk or enter them manually for each exam
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

                {/* Exam Selector */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <label className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">Exam:</label>
                    <select
                        className="input-field flex-1 md:w-64"
                        value={selectedExamId}
                        onChange={(e) => setSelectedExamId(e.target.value)}
                        disabled={loading || exams.length === 0}
                    >
                        {loading ? (
                            <option value="">Loading...</option>
                        ) : exams.length === 0 ? (
                            <option value="">No exams found</option>
                        ) : (
                            exams.map(exam => (
                                <option key={exam.id} value={exam.id}>
                                    {exam.name} — {exam.subjects?.name || 'N/A'} ({exam.grades?.name_display || 'N/A'})
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            {/* Selected Exam Info */}
            {selectedExam && (
                <div className="mb-6 p-3 rounded-md text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                    <strong>Selected:</strong> {selectedExam.name} · <strong>Subject:</strong> {selectedExam.subjects?.name || 'N/A'} · <strong>Grade:</strong> {selectedExam.grades?.name_display || 'N/A'} · <strong>Max Score:</strong> {selectedExam.max_score}
                </div>
            )}

            {/* Content */}
            <div className="w-full">
                {mode === 'bulk'
                    ? <BulkUpload examId={selectedExamId} />
                    : <ManualEntryGrid examId={selectedExamId} maxScore={selectedExam?.max_score || 100} />
                }
            </div>
        </div>
    );
}
