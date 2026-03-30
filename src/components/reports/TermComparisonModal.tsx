"use client";

import React, { useState } from 'react';
interface TermComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    academicYears: any[];
    terms: any[];
    gradeStreams: any[];
}

export function TermComparisonModal({ isOpen, onClose, academicYears, terms, gradeStreams }: TermComparisonModalProps) {
    const [loading, setLoading] = useState(false);
    const [selectedStream, setSelectedStream] = useState('');

    const [term1Year, setTerm1Year] = useState('');
    const [term1Term, setTerm1Term] = useState('');

    const [term2Year, setTerm2Year] = useState('');
    const [term2Term, setTerm2Term] = useState('');

    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCompare = async () => {
        if (!selectedStream || !term1Year || !term1Term || !term2Year || !term2Term) {
            setError("Please select all fields.");
            return;
        }
        setError(null);
        setLoading(true);

        try {
            // Fetch exams for both terms
            const exRes = await fetch('/api/school/exams');
            if (!exRes.ok) throw new Error('Failed to fetch exams');
            const { data: exams } = await exRes.json();

            // The API returns grades_id and term_id inside exams. 
            // Wait, does GET /api/school/exams return term_id? Let's check. 
            // Actually GET /api/school/exams does return them? No, looking at it, it explicitly DOES NOT select term_id! It selects id, name, exam_type, max_score, grade_stream_id, grade_id, subjects, grades.
            // But wait, my `/api/school/exam-marks/stream` endpoint returns the marks along with their nested exam term_id and academic_year_id!
            // Let's just fetch the marks!
            
            // Fetch marks
            const mRes = await fetch(`/api/school/exam-marks/stream?stream_id=${selectedStream}`);
            if (!mRes.ok) throw new Error('Failed to fetch marks');
            const { data: marks } = await mRes.json();

            if (!marks || marks.length === 0) {
                setError("No marks found for the selected grade stream.");
                setLoading(false);
                return;
            }

            // Aggregate averages
            let t1Sum = 0, t1Count = 0;
            let t2Sum = 0, t2Count = 0;

            marks.forEach((m: any) => {
                const exam = m.exams;
                if (!exam) return;
                
                if (exam.term_id === term1Term && exam.academic_year_id === term1Year) {
                    t1Sum += Number(m.percentage);
                    t1Count++;
                } else if (exam.term_id === term2Term && exam.academic_year_id === term2Year) {
                    t2Sum += Number(m.percentage);
                    t2Count++;
                }
            });

            if (t1Count === 0 || t2Count === 0) {
                setError("Could not find marks for one or both of the selected terms.");
                setLoading(false);
                return;
            }

            const t1Avg = t1Count > 0 ? (t1Sum / t1Count) : 0;
            const t2Avg = t2Count > 0 ? (t2Sum / t2Count) : 0;
            const delta = t2Avg - t1Avg;

            setResults({
                term1Avg: String(Math.round(t1Avg)),
                term2Avg: String(Math.round(t2Avg)),
                delta: String(Math.round(delta)),
                improved: delta > 0,
                decreased: delta < 0
            });

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred during comparison.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-raised)]">
                    <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">Compare Terms</h2>
                    <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                        Close ✕
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-1">Grade Stream</label>
                        <select className="input-field w-full" value={selectedStream} onChange={e => setSelectedStream(e.target.value)}>
                            <option value="">Select Stream...</option>
                            {gradeStreams.map((gs: any) => (
                                <option key={gs.id} value={gs.id}>{gs.full_name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 border border-[var(--color-border)] rounded-md bg-[var(--color-surface-raised)]">
                            <h4 className="font-semibold mb-3 text-sm">Base Term (Term 1)</h4>
                            <select className="input-field w-full mb-3 text-sm" value={term1Year} onChange={e => setTerm1Year(e.target.value)}>
                                <option value="">Academic Year...</option>
                                {academicYears.map((ay: any) => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
                            </select>
                            <select className="input-field w-full text-sm" value={term1Term} onChange={e => setTerm1Term(e.target.value)}>
                                <option value="">Term...</option>
                                {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>

                        <div className="p-4 border border-[var(--color-border)] rounded-md bg-[var(--color-surface-raised)]">
                            <h4 className="font-semibold mb-3 text-sm">Comparison Term (Term 2)</h4>
                            <select className="input-field w-full mb-3 text-sm" value={term2Year} onChange={e => setTerm2Year(e.target.value)}>
                                <option value="">Academic Year...</option>
                                {academicYears.map((ay: any) => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
                            </select>
                            <select className="input-field w-full text-sm" value={term2Term} onChange={e => setTerm2Term(e.target.value)}>
                                <option value="">Term...</option>
                                {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleCompare}
                        disabled={loading}
                        className="btn-primary w-full justify-center"
                    >
                        {loading ? 'Analyzing...' : 'Generate Comparison'}
                    </button>

                    {results && (
                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Results Overview</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="stat-card p-4">
                                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Base Term</div>
                                    <div className="text-xl font-bold">{results.term1Avg}%</div>
                                </div>
                                <div className="stat-card p-4">
                                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Comparison</div>
                                    <div className="text-xl font-bold">{results.term2Avg}%</div>
                                </div>
                                <div className={`stat-card p-4 border ${results.improved ? 'border-green-200 bg-green-50 text-green-700' : results.decreased ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200'}`}>
                                    <div className="text-xs opacity-80 mb-1">Shift (Delta)</div>
                                    <div className="text-xl font-bold">
                                        {results.improved ? '+' : ''}{results.delta}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
