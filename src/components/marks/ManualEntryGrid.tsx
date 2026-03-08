"use client";

import React, { useState } from 'react';

interface MarkRow {
    studentName: string;
    enrollmentNumber: string;
    score: string;
    remarks: string;
    error: string;
}

interface Props {
    subjectName?: string;
}

export function ManualEntryGrid({ subjectName = 'Mathematics' }: Props) {
    const [rows, setRows] = useState<MarkRow[]>([
        { studentName: '', enrollmentNumber: '', score: '', remarks: '', error: '' },
        { studentName: '', enrollmentNumber: '', score: '', remarks: '', error: '' },
        { studentName: '', enrollmentNumber: '', score: '', remarks: '', error: '' },
    ]);

    const updateRow = (index: number, field: keyof MarkRow, value: string) => {
        setRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value, error: '' };

            // Real-time validation
            if (field === 'score') {
                const num = parseFloat(value);
                if (value && isNaN(num)) {
                    updated[index].error = 'Score must be a number';
                } else if (num < 0 || num > 100) {
                    updated[index].error = 'Score must be between 0 and 100';
                }
            }

            // Check for duplicate enrollment numbers
            if (field === 'enrollmentNumber' && value) {
                const duplicates = updated.filter((r, i) => i !== index && r.enrollmentNumber === value);
                if (duplicates.length > 0) {
                    updated[index].error = 'Duplicate enrollment number';
                }
            }

            return updated;
        });
    };

    const addRow = () => {
        setRows(prev => [...prev, { studentName: '', enrollmentNumber: '', score: '', remarks: '', error: '' }]);
    };

    const removeRow = (index: number) => {
        if (rows.length <= 1) return;
        setRows(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        const hasErrors = rows.some(r => r.error !== '');
        const hasEmpty = rows.some(r => !r.studentName || !r.enrollmentNumber || !r.score);
        if (hasErrors) {
            alert('Please fix all errors before submitting.');
            return;
        }
        if (hasEmpty) {
            alert('Please fill in all required fields.');
            return;
        }
        alert(`Submitting ${rows.length} marks for ${subjectName}`);
    };

    return (
        <div className="card overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-1">Manual Entry — {subjectName}</h3>
                    <p className="text-[var(--color-text-muted)] text-sm">Enter marks row by row with real-time validation</p>
                </div>
                <button className="btn-primary w-full sm:w-auto justify-center shrink-0" onClick={handleSubmit}>
                    Save All
                </button>
            </div>

            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                <table className="data-table whitespace-nowrap min-w-[800px]">
                    <thead>
                        <tr>
                            <th className="w-10">#</th>
                            <th>Student Name *</th>
                            <th>Enrollment # *</th>
                            <th className="w-24">Score *</th>
                            <th>Remarks</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className={row.error ? 'bg-red-500/5' : ''}>
                                <td className="text-[var(--color-text-muted)] text-xs">{i + 1}</td>
                                <td>
                                    <input
                                        className="input-field text-sm"
                                        placeholder="e.g. Alice Moraa"
                                        value={row.studentName}
                                        onChange={e => updateRow(i, 'studentName', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="input-field text-sm"
                                        placeholder="e.g. STU-001"
                                        value={row.enrollmentNumber}
                                        onChange={e => updateRow(i, 'enrollmentNumber', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        className={`input-field text-sm ${row.error ? 'border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]' : ''}`}
                                        placeholder="0-100"
                                        value={row.score}
                                        onChange={e => updateRow(i, 'score', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="input-field text-sm"
                                        placeholder="Optional"
                                        value={row.remarks}
                                        onChange={e => updateRow(i, 'remarks', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <button
                                        onClick={() => removeRow(i)}
                                        className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] p-2 text-lg transition-colors cursor-pointer"
                                        title="Remove row"
                                    >
                                        ×
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Error Messages */}
            {rows.some(r => r.error) && (
                <div className="mt-4 p-3 bg-red-500/10 rounded-md">
                    {rows.filter(r => r.error).map((r, i) => (
                        <div key={i} className="text-xs text-[var(--color-danger)] mb-1">
                            • Row {rows.indexOf(r) + 1}: {r.error}
                        </div>
                    ))}
                </div>
            )}

            <button
                className="btn-secondary w-full justify-center mt-6"
                onClick={addRow}
            >
                + Add Row
            </button>
        </div>
    );
}
