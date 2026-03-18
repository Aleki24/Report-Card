"use client";

import React, { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface MarkRow {
    studentName: string;
    admissionNumber: string;
    score: string;
    remarks: string;
    error: string;
}

interface Props {
    examId: string;
    maxScore?: number;
}

export function ManualEntryGrid({ examId, maxScore = 100 }: Props) {
    const supabase = createSupabaseBrowserClient();

    const [rows, setRows] = useState<MarkRow[]>([
        { studentName: '', admissionNumber: '', score: '', remarks: '', error: '' },
        { studentName: '', admissionNumber: '', score: '', remarks: '', error: '' },
        { studentName: '', admissionNumber: '', score: '', remarks: '', error: '' },
    ]);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const updateRow = (index: number, field: keyof MarkRow, value: string) => {
        setRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value, error: '' };

            if (field === 'score') {
                const num = parseFloat(value);
                if (value && isNaN(num)) {
                    updated[index].error = 'Score must be a number';
                } else if (num < 0 || num > maxScore) {
                    updated[index].error = `Score must be between 0 and ${maxScore}`;
                }
            }

            if (field === 'admissionNumber' && value) {
                const duplicates = updated.filter((r, i) => i !== index && r.admissionNumber === value);
                if (duplicates.length > 0) {
                    updated[index].error = 'Duplicate admission number';
                }
            }

            return updated;
        });
    };

    const addRow = () => {
        setRows(prev => [...prev, { studentName: '', admissionNumber: '', score: '', remarks: '', error: '' }]);
    };

    const removeRow = (index: number) => {
        if (rows.length <= 1) return;
        setRows(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!examId) {
            setSaveMessage({ type: 'error', text: 'Please select an exam first.' });
            return;
        }

        const hasErrors = rows.some(r => r.error !== '');
        const hasEmpty = rows.some(r => !r.admissionNumber || !r.score);
        if (hasErrors) {
            setSaveMessage({ type: 'error', text: 'Please fix all errors before submitting.' });
            return;
        }
        if (hasEmpty) {
            setSaveMessage({ type: 'error', text: 'Please fill in admission number and score for all rows.' });
            return;
        }

        setSaving(true);
        setSaveMessage(null);

        try {
            // Lookup student IDs from admission_number
            const admissionNumbers = rows.map(r => r.admissionNumber);
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('id, admission_number')
                .in('admission_number', admissionNumbers);

            if (studentsError) throw studentsError;

            const studentMap = new Map(studentsData?.map(s => [s.admission_number, s.id]));

            const insertRows: any[] = [];
            let validationFailed = false;

            const validatedRows = rows.map(r => {
                const student_id = studentMap.get(r.admissionNumber);
                if (!student_id) {
                    validationFailed = true;
                    return { ...r, error: `Student not found with admission number: ${r.admissionNumber}` };
                }

                insertRows.push({
                    student_id,
                    raw_score: parseFloat(r.score),
                    remarks: r.remarks || null,
                    exam_id: examId,
                    percentage: 0, // Trigger will calculate
                });

                return r; // Return unmodified row if successful
            });

            if (validationFailed) {
                setRows(validatedRows);
                setSaveMessage({ type: 'error', text: 'Some students could not be found. Please check their admission numbers.' });
                setSaving(false);
                return;
            }

            const { error } = await supabase.from('exam_marks').insert(insertRows);

            if (error) {
                setSaveMessage({ type: 'error', text: `Database error: ${error.message}` });
            } else {
                setSaveMessage({ type: 'success', text: `✅ Successfully saved ${rows.length} marks!` });
                setTimeout(() => {
                    setRows([
                        { studentName: '', admissionNumber: '', score: '', remarks: '', error: '' },
                        { studentName: '', admissionNumber: '', score: '', remarks: '', error: '' },
                        { studentName: '', admissionNumber: '', score: '', remarks: '', error: '' },
                    ]);
                    setSaveMessage(null);
                }, 2500);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown';
            setSaveMessage({ type: 'error', text: `Unexpected error: ${message}` });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-1">Manual Entry</h3>
                    <p className="text-[var(--color-text-muted)] text-sm">Enter marks row by row · Max score: {maxScore}</p>
                </div>
            </div>

            {saveMessage && (
                <div className={`mb-6 p-3 rounded-md text-sm mx-6 sm:mx-0 ${saveMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}>
                    {saveMessage.text}
                </div>
            )}

            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                <table className="data-table whitespace-nowrap min-w-[700px]">
                    <thead>
                        <tr>
                            <th className="w-10">#</th>
                            <th>Student Name</th>
                            <th>Admission # *</th>
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
                                        placeholder="e.g. ADM-001"
                                        value={row.admissionNumber}
                                        onChange={e => updateRow(i, 'admissionNumber', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        className={`input-field text-sm ${row.error ? 'border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]' : ''}`}
                                        placeholder={`0-${maxScore}`}
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

            {rows.some(r => r.error) && (
                <div className="mt-4 p-3 bg-red-500/10 rounded-md">
                    {rows.filter(r => r.error).map((r, i) => (
                        <div key={i} className="text-xs text-[var(--color-danger)] mb-1">
                            • Row {rows.indexOf(r) + 1}: {r.error}
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4">
                <button className="btn-secondary w-full sm:w-auto justify-center" onClick={addRow}>+ Add Row</button>
                <button
                    className="btn-primary w-full sm:w-auto justify-center shrink-0 disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={saving}
                >
                    {saving ? '⏳ Saving...' : 'Save All'}
                </button>
            </div>
        </div>
    );
}
