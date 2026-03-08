"use client";

import React, { useState } from 'react';

export default function ReportsPage() {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [generating, setGenerating] = useState(false);

    const handleBulkDownload = async () => {
        if (!selectedClass || !selectedExam) {
            alert('Please select both a class and an exam.');
            return;
        }
        setGenerating(true);
        try {
            const res = await fetch(`/api/reports/class/${selectedClass}?examId=${selectedExam}`);
            if (!res.ok) throw new Error('Generation failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'class_reports.zip';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to generate reports. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Reports</h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                    Generate and download professional PDF report cards
                </p>
            </div>

            {/* Report Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* Individual Report */}
                <div className="card text-center p-8 flex flex-col h-full">
                    <div className="text-4xl mb-4">📋</div>
                    <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Individual Report</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">
                        Generate a single student report card with grades, ranking, and feedback.
                    </p>
                    <button className="btn-secondary w-full justify-center">Select Student →</button>
                </div>

                {/* Class Report */}
                <div className="card text-center p-8 flex flex-col h-full">
                    <div className="text-4xl mb-4">📦</div>
                    <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Bulk Class Reports</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">
                        One-click download all report cards for a class as a ZIP file.
                    </p>
                    <button
                        className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleBulkDownload}
                        disabled={generating}
                    >
                        {generating ? 'Generating...' : 'Generate ZIP →'}
                    </button>
                </div>

                {/* Comparative Report */}
                <div className="card text-center p-8 flex flex-col h-full">
                    <div className="text-4xl mb-4">📊</div>
                    <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Term Comparison</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">
                        Compare student or class performance across multiple exams.
                    </p>
                    <button className="btn-secondary w-full justify-center">Compare Terms →</button>
                </div>
            </div>

            {/* Bulk Generation Controls */}
            <div className="card">
                <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-4">Bulk Generation Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                            Select Class
                        </label>
                        <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            <option value="">-- Choose Class --</option>
                            <option value="cls-10a">Grade 10A</option>
                            <option value="cls-10b">Grade 10B</option>
                            <option value="cls-9a">Grade 9A</option>
                            <option value="cls-9b">Grade 9B</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                            Select Exam
                        </label>
                        <select className="input-field" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
                            <option value="">-- Choose Exam --</option>
                            <option value="exam-mt1">Mid-Term 1 2026</option>
                            <option value="exam-et1">End-Term 1 2026</option>
                            <option value="exam-annual">Annual 2026</option>
                        </select>
                    </div>
                    <button
                        className="btn-primary w-full justify-center h-[42px] mt-4 md:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleBulkDownload}
                        disabled={generating || !selectedClass || !selectedExam}
                    >
                        {generating ? '⏳ Generating...' : '📥 Download All'}
                    </button>
                </div>
            </div>
        </div>
    );
}
