"use client";

import React, { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface StudentOption {
    id: string;
    first_name: string;
    last_name: string;
    enrollment_number: string;
}

export default function ReportsPage() {
    const supabase = createSupabaseBrowserClient();

    /* ── State ────────────────────────────────────── */
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [generating, setGenerating] = useState(false);

    // Student picker modal
    const [showStudentPicker, setShowStudentPicker] = useState(false);
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [studentSearch, setStudentSearch] = useState('');
    const [loadingStudents, setLoadingStudents] = useState(false);

    // Toast
    const [toast, setToast] = useState<string | null>(null);

    /* ── Fetch students for picker ────────────────── */
    const fetchStudents = async () => {
        setLoadingStudents(true);
        const { data, error } = await supabase
            .from('students')
            .select('id, first_name, last_name, enrollment_number')
            .order('first_name', { ascending: true });

        if (error) console.error(error);
        setStudents((data as StudentOption[]) || []);
        setLoadingStudents(false);
    };

    useEffect(() => {
        if (showStudentPicker && students.length === 0) {
            fetchStudents();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showStudentPicker]);

    /* ── Filtered students ────────────────────────── */
    const filteredStudents = studentSearch.trim()
        ? students.filter(s =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
            s.enrollment_number.toLowerCase().includes(studentSearch.toLowerCase())
        )
        : students;

    /* ── Download individual student report ────────── */
    const handleStudentSelect = (studentId: string) => {
        setShowStudentPicker(false);
        setStudentSearch('');
        // Open the report PDF in a new tab
        window.open(`/api/reports/student/${studentId}`, '_blank');
    };

    /* ── Bulk download handler ────────────────────── */
    const handleBulkDownload = async () => {
        if (!selectedClass || !selectedExam) {
            showToast('Please select both a class and an exam.');
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
        } catch {
            showToast('Failed to generate reports. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    /* ── Toast helper ─────────────────────────────── */
    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3500);
    };

    return (
        <div className="w-full max-w-7xl mx-auto">
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Reports</h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                    Generate and download professional PDF report cards
                </p>
            </div>

            {/* Report Types */}
            <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}
            >
                {/* Individual Report */}
                <div className="card text-center p-8 flex flex-col h-full">
                    <div className="text-4xl mb-4">📋</div>
                    <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Individual Report</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">
                        Generate a single student report card with grades, ranking, and feedback.
                    </p>
                    <button
                        className="btn-secondary w-full justify-center"
                        onClick={() => setShowStudentPicker(true)}
                    >
                        Select Student →
                    </button>
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
                    <button
                        className="btn-secondary w-full justify-center"
                        onClick={() => showToast('🚧 Term comparison is coming soon!')}
                    >
                        Compare Terms →
                    </button>
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

            {/* ── Student Picker Modal ──────────────────── */}
            {showStudentPicker && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => { setShowStudentPicker(false); setStudentSearch(''); }}
                >
                    <div
                        className="card w-full max-w-lg"
                        style={{ animation: 'fadeIn .2s ease', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-4">Select a Student</h2>

                        <input
                            className="input-field w-full mb-4"
                            placeholder="Search by name or enrollment number..."
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                            autoFocus
                        />

                        <div className="overflow-y-auto flex-1" style={{ maxHeight: '50vh' }}>
                            {loadingStudents ? (
                                <p className="text-center text-[var(--color-text-muted)] py-6 text-sm">Loading students...</p>
                            ) : filteredStudents.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    {filteredStudents.map(s => (
                                        <button
                                            key={s.id}
                                            className="w-full text-left px-4 py-3 rounded-md hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
                                            style={{ border: 'none', background: 'transparent', color: 'inherit' }}
                                            onClick={() => handleStudentSelect(s.id)}
                                        >
                                            <div className="font-medium text-sm">{s.first_name} {s.last_name}</div>
                                            <div className="text-xs text-[var(--color-text-muted)] font-mono">{s.enrollment_number}</div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-[var(--color-text-muted)] py-6 text-sm">
                                    {studentSearch ? 'No students match your search.' : 'No students found. Add students first.'}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end mt-4 pt-4 border-t border-[var(--color-border)]">
                            <button
                                className="btn-secondary"
                                onClick={() => { setShowStudentPicker(false); setStudentSearch(''); }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast Notification ───────────────────── */}
            {toast && (
                <div
                    className="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-lg text-sm font-medium shadow-lg"
                    style={{
                        background: 'var(--color-surface-raised)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        animation: 'fadeIn .25s ease',
                    }}
                >
                    {toast}
                </div>
            )}
        </div>
    );
}
