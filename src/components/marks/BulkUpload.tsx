"use client";

import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';

interface ParsedRow {
    [key: string]: string;
}

interface ColumnMapping {
    studentName: string;
    enrollmentNumber: string;
    subject: string;
    score: string;
    totalPossible: string;
}

export function BulkUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<ColumnMapping>({
        studentName: '',
        enrollmentNumber: '',
        subject: '',
        score: '',
        totalPossible: '',
    });
    const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
    const [errors, setErrors] = useState<string[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        setFile(selectedFile);

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as ParsedRow[];
                const cols = results.meta.fields || [];
                setParsedData(data);
                setHeaders(cols);

                // Smart auto-detect column mapping
                const autoMap: Partial<ColumnMapping> = {};
                cols.forEach(col => {
                    const lower = col.toLowerCase();
                    if (lower.includes('name') || lower.includes('student')) autoMap.studentName = col;
                    if (lower.includes('enrollment') || lower.includes('id') || lower.includes('number') || lower.includes('admission')) autoMap.enrollmentNumber = col;
                    if (lower.includes('subject') || lower.includes('course')) autoMap.subject = col;
                    if (lower.includes('score') || lower.includes('mark') || lower.includes('grade')) autoMap.score = col;
                    if (lower.includes('total') || lower.includes('max') || lower.includes('possible') || lower.includes('out of')) autoMap.totalPossible = col;
                });

                setMapping(prev => ({ ...prev, ...autoMap }));
                setStep('map');
            },
            error: (err) => {
                setErrors([`Parse error: ${err.message}`]);
            },
        });
    };

    const validateData = useCallback(() => {
        const errs: string[] = [];
        parsedData.forEach((row, idx) => {
            const score = parseFloat(row[mapping.score]);
            const total = parseFloat(row[mapping.totalPossible] || '100');
            if (isNaN(score)) errs.push(`Row ${idx + 1}: Invalid score "${row[mapping.score]}"`);
            if (score < 0 || score > total) errs.push(`Row ${idx + 1}: Score ${score} out of range (0-${total})`);
            if (!row[mapping.enrollmentNumber]) errs.push(`Row ${idx + 1}: Missing enrollment number`);
        });
        setErrors(errs);
        if (errs.length === 0) setStep('preview');
    }, [parsedData, mapping]);

    const handleSubmit = async () => {
        // TODO: Wire to Supabase insert
        alert(`Submitting ${parsedData.length} records to database...`);
    };

    return (
        <div className="w-full">
            {/* Step 1: Upload */}
            {step === 'upload' && (
                <div className="card text-center py-12 px-6">
                    <div className="mb-8">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <h3 className="text-xl font-bold font-[family-name:var(--font-display)] mb-2">Upload Marks File</h3>
                        <p className="text-[var(--color-text-muted)] text-sm max-w-md mx-auto">
                            Upload a CSV or Excel file. Columns will be auto-detected for student name, enrollment number, subject, and score.
                        </p>
                    </div>
                    <label className="btn-primary cursor-pointer w-full sm:w-auto justify-center">
                        Choose File
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>
                </div>
            )}

            {/* Step 2: Column Mapping */}
            {step === 'map' && (
                <div className="card">
                    <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-4">Map Columns</h3>
                    <p className="text-[var(--color-text-muted)] text-sm mb-6">
                        We auto-detected your columns. Please verify or adjust the mapping below.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {(Object.keys(mapping) as (keyof ColumnMapping)[]).map((field) => (
                            <div key={field}>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1 capitalize">
                                    {field.replace(/([A-Z])/g, ' $1')}
                                </label>
                                <select
                                    className="input-field w-full"
                                    value={mapping[field]}
                                    onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                                >
                                    <option value="">-- Select Column --</option>
                                    {headers.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button className="btn-secondary w-full sm:w-auto justify-center" onClick={() => setStep('upload')}>Back</button>
                        <button className="btn-primary w-full sm:w-auto justify-center" onClick={validateData}>Validate & Preview</button>
                    </div>

                    {errors.length > 0 && (
                        <div className="mt-6 p-4 bg-red-500/10 rounded-md border border-red-500/30">
                            <div className="font-semibold text-[var(--color-danger)] mb-2 text-sm">
                                Validation Errors ({errors.length})
                            </div>
                            {errors.slice(0, 10).map((err, i) => (
                                <div key={i} className="text-xs text-[var(--color-text-secondary)] mb-[2px]">• {err}</div>
                            ))}
                            {errors.length > 10 && (
                                <div className="text-xs text-[var(--color-text-muted)] mt-2">
                                    ...and {errors.length - 10} more errors
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Step 3: Preview */}
            {step === 'preview' && (
                <div className="card overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-1">Preview ({parsedData.length} records)</h3>
                            <p className="text-[var(--color-text-muted)] text-sm">Review the data before submitting</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button className="btn-secondary w-full sm:w-auto justify-center" onClick={() => setStep('map')}>Back</button>
                            <button className="btn-primary w-full sm:w-auto justify-center" onClick={handleSubmit}>Submit All</button>
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                        <table className="data-table whitespace-nowrap">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Student</th>
                                    <th>Enrollment #</th>
                                    <th>Subject</th>
                                    <th>Score</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedData.slice(0, 20).map((row, i) => (
                                    <tr key={i}>
                                        <td className="text-[var(--color-text-muted)]">{i + 1}</td>
                                        <td className="font-medium">{row[mapping.studentName]}</td>
                                        <td>{row[mapping.enrollmentNumber]}</td>
                                        <td>{row[mapping.subject]}</td>
                                        <td>{row[mapping.score]}</td>
                                        <td>{row[mapping.totalPossible] || '100'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {parsedData.length > 20 && (
                        <p className="text-center text-[var(--color-text-muted)] text-xs mt-4">
                            Showing 20 of {parsedData.length} records
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
