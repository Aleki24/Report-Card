"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ExamSubjectComponentScheme } from '@/types';
import { calculateCompositeSubjectScore, isMultiPaper } from '@/lib/multi-paper';

interface GradeOption {
    symbol: string;
    label: string;
    systemName: string;
}

interface StudentOption {
    id: string;
    name: string;
    admission_number: string;
}

interface AcademicLevel { id: string; code: string; name: string; }
interface GradeItem { id: string; name_display: string; academic_level_id: string; }
interface StreamItem { id: string; full_name: string; grade_id: string; }

interface MarkRow {
    studentId: string;       // Selected student ID
    studentName: string;     // Display name (auto-filled)
    admissionNumber: string; // Auto-filled from selection
    score: string;
    componentScores: Record<string, string>; // per-paper scores keyed by component id (multi-paper exams)
    grade: string;
    remarks: string;
    error: string;
    isGradeManuallySet: boolean; // True when teacher manually overrides the grade
}

interface Props {
    examId: string;
    maxScore?: number;
    /** The exam's grade — when provided, students load automatically (no manual class re-selection) */
    gradeId?: string;
    /** The exam's stream, if it targets a single stream */
    gradeStreamId?: string | null;
}

const emptyRow = (): MarkRow => ({
    studentId: '', studentName: '', admissionNumber: '', score: '', componentScores: {}, grade: '', remarks: '', error: '', isGradeManuallySet: false,
});

export function ManualEntryGrid({ examId, maxScore = 100, gradeId, gradeStreamId }: Props) {
    // When the exam's class is known, students load automatically and the
    // manual Level/Grade/Stream re-selection is skipped entirely.
    const examScoped = !!gradeId;

    // Class/stream filter
    const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
    const [selectedLevelId, setSelectedLevelId] = useState('');
    const [grades, setGrades] = useState<GradeItem[]>([]);
    const [allStreams, setAllStreams] = useState<StreamItem[]>([]);
    const [selectedGradeId, setSelectedGradeId] = useState('');
    const [selectedStreamId, setSelectedStreamId] = useState('');

    // Students for the selected class
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [studentsLoading, setStudentsLoading] = useState(false);

    // Grade scale options
    const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);

    // Grading scales for auto-grade
    const [gradingScales, setGradingScales] = useState<{ symbol: string; min_percentage: number; max_percentage: number }[]>([]);

    // Entry rows
    const [rows, setRows] = useState<MarkRow[]>([emptyRow(), emptyRow(), emptyRow()]);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Multi-paper scheme for this exam (null = normal single-paper flow)
    const [scheme, setScheme] = useState<ExamSubjectComponentScheme | null>(null);
    const multiPaper = isMultiPaper(scheme);
    const schemeComponents = useMemo(
        () => (multiPaper ? (scheme?.components || []) : []),
        [multiPaper, scheme]
    );

    // ── Fetch paper configuration for this exam ──────────
    useEffect(() => {
        if (!examId) { setScheme(null); return; }
        (async () => {
            try {
                const res = await fetch(`/api/school/exams/${examId}/components`, { cache: 'no-store' });
                const json = await res.json();
                setScheme(json.data || null);
            } catch (err) {
                console.error('Failed to load paper configuration:', err);
                setScheme(null);
            }
        })();
    }, [examId]);

    // ── Live composite result for a multi-paper row ──────
    const compositeForRow = useCallback((row: MarkRow) => {
        return calculateCompositeSubjectScore(
            schemeComponents.map(c => ({
                componentId: c.id,
                code: c.component_code,
                maxScore: Number(c.max_score),
                score: row.componentScores[c.id] !== undefined && row.componentScores[c.id] !== ''
                    ? parseFloat(row.componentScores[c.id])
                    : null,
                displayOrder: c.display_order,
            })),
            scheme?.aggregation_method || 'sum_then_percentage'
        );
    }, [schemeComponents, scheme?.aggregation_method]);

    // ── Fetch grades + streams on mount ──────────────────
    useEffect(() => {
        const fetchStructure = async () => {
            try {
                const res = await fetch('/api/admin/academic-structure');
                const data = await res.json();
                if (data.academic_levels) setAcademicLevels(data.academic_levels);
                if (data.grades) setGrades(data.grades);
                if (data.grade_streams) setAllStreams(data.grade_streams);
            } catch (err) {
                console.error('Failed to load class structure:', err);
            }
        };
        fetchStructure();
    }, []);

    // ── Fetch grading scales + grade options on mount ────
    useEffect(() => {
        const fetchGrades = async () => {
            try {
                const res = await fetch('/api/school/data?type=grading_scales');
                const dataObj = await res.json();
                if (dataObj.data) {
                    const scales: any[] = [];
                    dataObj.data.forEach((sys: any) => {
                        sys.grading_scales?.forEach((sc: any) => {
                            scales.push({
                                symbol: sc.symbol,
                                label: sc.label || '',
                                systemName: sys.name,
                                min_percentage: sc.min_percentage,
                                max_percentage: sc.max_percentage,
                            });
                        });
                    });
                    setGradeOptions(scales);
                    setGradingScales(scales);
                }
            } catch (err) {
                console.error('Failed to load grading scales:', err);
            }
        };
        fetchGrades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Reset grade & stream when level changes ──────────
    useEffect(() => { setSelectedGradeId(''); setSelectedStreamId(''); }, [selectedLevelId]);

    // ── Reset stream when grade changes ──────────────────
    useEffect(() => { setSelectedStreamId(''); }, [selectedGradeId]);

    // ── Fetch students when grade or stream changes ──────
    const fetchStudents = useCallback(async () => {
        if (examScoped) {
            // Exam already knows its class — wait for streams to load, then fetch
            if (allStreams.length === 0) {
                return;
            }
        } else {
            if (!selectedGradeId) {
                setStudents([]);
                return;
            }
            const hasStreams = allStreams.some(s => s.grade_id === selectedGradeId);
            if (hasStreams && !selectedStreamId) {
                setStudents([]);
                return;
            }
        }

        setStudentsLoading(true);
        try {
            const res = await fetch('/api/school/data?type=students');
            const { data } = await res.json();

            const filteredStudents = (data || []).filter((s: any) => {
                if (examScoped) {
                    // Exam targets one stream → that stream's students.
                    // Exam covers the whole grade → every stream in the grade
                    // (optionally narrowed by the stream filter).
                    if (gradeStreamId) return s.current_grade_stream_id === gradeStreamId;
                    if (selectedStreamId) return s.current_grade_stream_id === selectedStreamId;
                    return allStreams.some(st => st.grade_id === gradeId && st.id === s.current_grade_stream_id);
                }
                const hasStreams = allStreams.some(st => st.grade_id === selectedGradeId);
                if (hasStreams) {
                    return s.current_grade_stream_id === selectedStreamId;
                } else {
                    const gradeObj = grades.find(g => g.id === selectedGradeId);
                    return gradeObj ? s.academic_level_id === gradeObj.academic_level_id : false;
                }
            });

            const list: StudentOption[] = filteredStudents
                .map((s: any) => ({
                    id: s.id,
                    name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
                    admission_number: s.admission_number || '',
                }))
                .sort((a: StudentOption, b: StudentOption) => a.name.localeCompare(b.name));

            setStudents(list);
        } catch (err) {
            console.error('Failed to load students:', err);
        } finally {
            setStudentsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [examScoped, gradeId, gradeStreamId, selectedGradeId, selectedStreamId, allStreams]);

    useEffect(() => { fetchStudents(); }, [fetchStudents]);

    // ── Filtered grades by level ─────────────────────────
    const filteredGrades = selectedLevelId
        ? grades.filter(g => g.academic_level_id === selectedLevelId)
        : grades;

    // ── Filtered streams ─────────────────────────────────
    const filteredStreams = allStreams.filter(s => s.grade_id === selectedGradeId);

    // Streams in the exam's grade (exam-scoped mode)
    const examStreams = allStreams.filter(s => s.grade_id === gradeId);

    // Whether the entry table can be shown
    const entryReady = examScoped || ((filteredStreams.length === 0 && !!selectedGradeId) || !!selectedStreamId);

    // ── Already-selected student IDs (prevent duplicate selection) ──
    const selectedStudentIds = new Set(rows.map(r => r.studentId).filter(Boolean));

    // ── Auto-resolve grade from percentage ───────────────
    const resolveGradeFromPct = (pct: number): string => {
        for (const scale of gradingScales) {
            if (pct >= scale.min_percentage && pct <= scale.max_percentage) {
                return scale.symbol;
            }
        }
        return '';
    };

    // ── Auto-resolve grade from score ────────────────────
    const autoResolveGrade = (scoreStr: string): string => {
        const num = parseFloat(scoreStr);
        if (!scoreStr || isNaN(num) || maxScore <= 0) return '';
        return resolveGradeFromPct((num / maxScore) * 100);
    };

    // ── Per-paper score update (multi-paper exams) ───────
    const updateComponentScore = (index: number, componentId: string, value: string) => {
        setRows(prev => {
            const updated = [...prev];
            const row = { ...updated[index], componentScores: { ...updated[index].componentScores, [componentId]: value }, error: '' };

            // Validate each entered paper against its own max score
            for (const c of schemeComponents) {
                const v = row.componentScores[c.id];
                if (v === undefined || v === '') continue;
                const num = parseFloat(v);
                if (isNaN(num)) { row.error = `${c.component_code} score must be a number`; break; }
                if (num < 0 || num > Number(c.max_score)) {
                    row.error = `${c.component_code} score must be between 0 and ${c.max_score}`;
                    break;
                }
            }

            // Live final score + auto grade (unless manually overridden)
            if (!row.error && !row.isGradeManuallySet) {
                const composite = compositeForRow(row);
                if (composite.enteredCount > 0) {
                    const resolved = resolveGradeFromPct(composite.finalPercentage);
                    if (resolved) row.grade = resolved;
                }
            }

            updated[index] = row;
            return updated;
        });
    };

    // ── Row helpers ──────────────────────────────────────
    const updateRow = (index: number, field: keyof MarkRow, value: string) => {
        setRows(prev => {
            const updated = [...prev];
            const row = { ...updated[index], [field]: value, error: '' };

            // When student is selected, auto-fill name and admission number
            if (field === 'studentId') {
                const student = students.find(s => s.id === value);
                if (student) {
                    row.studentName = student.name;
                    row.admissionNumber = student.admission_number;
                } else {
                    row.studentName = '';
                    row.admissionNumber = '';
                }
            }

            // When grade is manually changed by the teacher, mark it
            if (field === 'grade') {
                row.isGradeManuallySet = true;
            }

            // When score changes, validate and auto-resolve grade (unless manually overridden)
            if (field === 'score') {
                const num = parseFloat(value);
                if (value && isNaN(num)) {
                    row.error = 'Score must be a number';
                } else if (value && (num < 0 || num > maxScore)) {
                    row.error = `Score must be between 0 and ${maxScore}`;
                } else if (!row.isGradeManuallySet) {
                    // Auto-resolve grade only if teacher hasn't manually set one
                    const resolved = autoResolveGrade(value);
                    if (resolved) row.grade = resolved;
                }
            }

            updated[index] = row;
            return updated;
        });
    };

    const addRow = () => setRows(prev => [...prev, emptyRow()]);

    const removeRow = (index: number) => {
        if (rows.length <= 1) return;
        setRows(prev => prev.filter((_, i) => i !== index));
    };

    // ── Register mode: one row per student, ready for score entry ──
    const loadAllStudents = () => {
        setRows(prev => {
            const existing = new Set(prev.map(r => r.studentId).filter(Boolean));
            const newRows = students
                .filter(s => !existing.has(s.id))
                .map(s => ({ ...emptyRow(), studentId: s.id, studentName: s.name, admissionNumber: s.admission_number }));
            // Keep rows the teacher already started; drop untouched empty ones
            const kept = prev.filter(r => r.studentId || r.score || Object.values(r.componentScores).some(v => v !== ''));
            return [...kept, ...newRows];
        });
    };

    // ── Keyboard-first entry: Enter/arrows move down the score column ──
    const handleScoreKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, col: string) => {
        if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const inputs = Array.from(
            document.querySelectorAll<HTMLInputElement>(`input[data-score-col="${col}"]`)
        );
        const idx = inputs.indexOf(e.currentTarget);
        const next = e.key === 'ArrowUp' ? inputs[idx - 1] : inputs[idx + 1];
        next?.focus();
        next?.select();
    };

    // ── Submit ───────────────────────────────────────────
    const handleSubmit = async () => {
        if (!examId) {
            setSaveMessage({ type: 'error', text: 'Please select an exam first.' });
            return;
        }

        // Filter to only rows that have at least a student selected and a score
        // (for multi-paper subjects: at least one paper score)
        const filledRows = rows.filter(r => r.studentId && (
            multiPaper
                ? schemeComponents.some(c => r.componentScores[c.id] !== undefined && r.componentScores[c.id] !== '')
                : r.score
        ));
        if (filledRows.length === 0) {
            setSaveMessage({ type: 'error', text: multiPaper ? 'Please select at least one student and enter at least one paper score.' : 'Please select at least one student and enter a score.' });
            return;
        }

        const hasErrors = filledRows.some(r => r.error !== '');
        if (hasErrors) {
            setSaveMessage({ type: 'error', text: 'Please fix all errors before submitting.' });
            return;
        }

        // Check for missing grades
        const missingGrade = filledRows.some(r => !r.grade);
        if (missingGrade) {
            setSaveMessage({ type: 'error', text: 'Please ensure all rows have a grade selected.' });
            return;
        }

        setSaving(true);
        setSaveMessage(null);

        try {
            // Fetch exam max_score for accurate percentage
            const examRes = await fetch('/api/school/data?type=exams');
            const { data: examsData } = await examRes.json();
            const examData = examsData?.find((e: any) => e.id === examId);
            const examMaxScore = examData?.max_score || maxScore;

            const insertRows = filledRows.map(r => {
                if (multiPaper) {
                    // Send per-paper scores; the server resolves the final
                    // subject score using the configured aggregation method.
                    const components: Record<string, number> = {};
                    for (const c of schemeComponents) {
                        const v = r.componentScores[c.id];
                        if (v !== undefined && v !== '') components[c.id] = parseFloat(v);
                    }
                    const composite = compositeForRow(r);
                    return {
                        exam_id: examId,
                        student_id: r.studentId,
                        raw_score: examMaxScore > 0 ? Math.round((composite.finalPercentage / 100) * examMaxScore * 100) / 100 : 0,
                        percentage: composite.finalPercentage,
                        grade_symbol: r.grade,
                        remarks: r.remarks || null,
                        components,
                    };
                }
                const score = parseFloat(r.score);
                const percentage = examMaxScore > 0 ? Math.round((score / examMaxScore) * 10000) / 100 : 0;
                return {
                    exam_id: examId,
                    student_id: r.studentId,
                    raw_score: score,
                    percentage,
                    grade_symbol: r.grade,
                    remarks: r.remarks || null,
                };
            });

            const res = await fetch('/api/school/exam-marks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exam_id: examId, marks: insertRows }),
            });
            const result = await res.json();

            if (!res.ok) {
                setSaveMessage({ type: 'error', text: `Database error: ${result.error}` });
            } else {
                setSaveMessage({ type: 'success', text: `✅ Successfully saved ${filledRows.length} mark${filledRows.length !== 1 ? 's' : ''}!` });
                // Refresh students list (some are now entered) and reset rows
                await fetchStudents();
                setTimeout(() => {
                    setRows([emptyRow(), emptyRow(), emptyRow()]);
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

    // ── Group grade options ──────────────────────────────
    const groupedOptions = gradeOptions.reduce<Record<string, GradeOption[]>>((acc, g) => {
        if (!acc[g.systemName]) acc[g.systemName] = [];
        acc[g.systemName].push(g);
        return acc;
    }, {});

    return (
        <div className="card overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-1">Manual Entry</h3>
                    <p className="text-muted-foreground text-sm">
                        {examScoped ? 'Load the whole class (or pick students) and type marks — Enter jumps to the next student' : 'Select a class, then pick students from the dropdown'}
                        {multiPaper
                            ? <> · <span style={{ color: 'var(--color-accent)' }}>📑 Multi-paper: {schemeComponents.map(c => `${c.component_code}/${Number(c.max_score)}`).join(' + ')}</span></>
                            : <> · Max score: {maxScore}</>}
                    </p>
                </div>
            </div>

            {/* ── Exam-scoped: students auto-load from the exam's class ── */}
            {examScoped && (
                <div className="flex flex-wrap items-center gap-4 mb-6 p-3 rounded-lg bg-muted border border-border">
                    {!gradeStreamId && examStreams.length > 1 && (
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Stream</label>
                            <select
                                className="input-field text-sm"
                                style={{ padding: '6px 10px' }}
                                value={selectedStreamId}
                                onChange={e => setSelectedStreamId(e.target.value)}
                            >
                                <option value="">All Streams</option>
                                {examStreams.map(s => (
                                    <option key={s.id} value={s.id}>{s.full_name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="text-xs text-primary font-semibold">
                        {studentsLoading ? 'Loading students…' : `${students.length} student${students.length !== 1 ? 's' : ''} in this class`}
                    </div>
                    {!studentsLoading && students.length > 0 && (
                        <button
                            onClick={loadAllStudents}
                            className="btn-secondary text-xs px-3 py-1.5"
                            title="Add one row per student so you can type straight down the score column (Enter moves to the next student)"
                        >
                            ⚡ Load whole class
                        </button>
                    )}
                </div>
            )}

            {/* ── Level / Grade / Stream Filter (legacy: exam class unknown) ── */}
            {!examScoped && (
            <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 rounded-lg bg-muted border border-border">
                <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Level</label>
                    <select
                        className="input-field w-full"
                        value={selectedLevelId}
                        onChange={e => setSelectedLevelId(e.target.value)}
                    >
                        <option value="">— All Levels —</option>
                        {academicLevels.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Grade / Class</label>
                    <select
                        className="input-field w-full"
                        value={selectedGradeId}
                        onChange={e => setSelectedGradeId(e.target.value)}
                        disabled={!selectedLevelId && academicLevels.length > 0}
                    >
                        <option value="">{!selectedLevelId && academicLevels.length > 0 ? 'Select level first' : '— Select Grade —'}</option>
                        {filteredGrades.map(g => (
                            <option key={g.id} value={g.id}>{g.name_display}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Stream</label>
                    <select
                        className="input-field w-full"
                        value={selectedStreamId}
                        onChange={e => setSelectedStreamId(e.target.value)}
                        disabled={!selectedGradeId || filteredStreams.length === 0}
                    >
                        <option value="">{!selectedGradeId ? 'Select grade first' : filteredStreams.length === 0 ? 'No stream' : '— Select Stream —'}</option>
                        {filteredStreams.map(s => (
                            <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                    </select>
                </div>
                {((filteredStreams.length === 0 && selectedGradeId) || selectedStreamId) && (
                    <div className="flex items-end gap-3">
                        <div className="text-xs text-primary font-semibold py-2">
                            {studentsLoading ? 'Loading…' : `${students.length} student${students.length !== 1 ? 's' : ''}`}
                        </div>
                        {!studentsLoading && students.length > 0 && (
                            <button onClick={loadAllStudents} className="btn-secondary text-xs px-3 py-1.5" title="Add one row per student for straight-down score entry">
                                ⚡ Load whole class
                            </button>
                        )}
                    </div>
                )}
            </div>
            )}

            {/* No level selected hint */}
            {!examScoped && !selectedLevelId && academicLevels.length > 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                    👆 Select a <strong>Level</strong> above to load grades
                </div>
            )}

            {/* No grade selected hint */}
            {!examScoped && selectedLevelId && !selectedGradeId && filteredGrades.length > 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                    👆 Select a <strong>Grade / Class</strong> above to load students
                </div>
            )}

            {/* Level selected but no grades for it */}
            {!examScoped && selectedLevelId && filteredGrades.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                    No grades found for this level.
                </div>
            )}

            {/* No stream selected hint */}
            {!examScoped && selectedGradeId && filteredStreams.length > 0 && !selectedStreamId && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                    👆 Select a <strong>Stream</strong> above to load students
                </div>
            )}

            {/* ── Entry Table ── */}
            {entryReady && students.length > 0 && (
                <>
                    {saveMessage && (
                        <div className={`mb-6 p-3 rounded-md text-sm ${saveMessage.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                            }`}>
                            {saveMessage.text}
                        </div>
                    )}

                    <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                        <table className="data-table sm:whitespace-nowrap w-full sm:min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className="w-10">#</th>
                                    <th>Student</th>
                                    <th>Adm No</th>
                                    {multiPaper ? (
                                        <>
                                            {schemeComponents.map(c => (
                                                <th key={c.id} className="w-24" title={c.component_name}>
                                                    {c.component_code} <span className="font-normal opacity-60">/{Number(c.max_score)}</span>
                                                </th>
                                            ))}
                                            <th className="w-20">Final %</th>
                                        </>
                                    ) : (
                                        <th className="w-24">Score *</th>
                                    )}
                                    <th className="w-40">Grade *</th>
                                    <th>Remarks</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={i} className={row.error ? 'bg-red-500/5' : ''}>
                                        <td data-label="#" className="text-muted-foreground text-xs">{i + 1}</td>
                                        {/* Student dropdown */}
                                        <td data-label="Student">
                                            <select
                                                className="input-field text-sm w-full min-w-[200px]"
                                                style={{ padding: '8px 12px' }}
                                                value={row.studentId}
                                                onChange={e => updateRow(i, 'studentId', e.target.value)}
                                            >
                                                <option value="">— Select Student —</option>
                                                {students.map(s => {
                                                    // Show already-selected students as disabled (except current row)
                                                    const taken = selectedStudentIds.has(s.id) && row.studentId !== s.id;
                                                    return (
                                                        <option key={s.id} value={s.id} disabled={taken}>
                                                            {s.name}{taken ? ' (already added)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </td>
                                        {/* Admission number (auto-filled, read-only) */}
                                        <td data-label="Adm No">
                                            <span className="text-sm text-muted-foreground">
                                                {row.admissionNumber || '—'}
                                            </span>
                                        </td>
                                        {/* Score — single input, or one input per paper */}
                                        {multiPaper ? (
                                            <>
                                                {schemeComponents.map(c => (
                                                    <td key={c.id} data-label={c.component_code}>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            data-score-col={c.id}
                                                            className={`input-field text-sm ${row.error ? 'border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]' : ''}`}
                                                            style={{ padding: '8px 12px', minWidth: 64 }}
                                                            placeholder={`0-${Number(c.max_score)}`}
                                                            value={row.componentScores[c.id] || ''}
                                                            onChange={e => updateComponentScore(i, c.id, e.target.value)}
                                                            onKeyDown={e => handleScoreKeyDown(e, c.id)}
                                                        />
                                                    </td>
                                                ))}
                                                <td data-label="Final %">
                                                    {(() => {
                                                        const composite = compositeForRow(row);
                                                        return composite.enteredCount > 0 && !row.error ? (
                                                            <span className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }} title={composite.isComplete ? 'All papers entered' : 'Some papers missing (counted as 0)'}>
                                                                {composite.finalPercentage.toFixed(1)}%{!composite.isComplete && <span className="opacity-60">*</span>}
                                                            </span>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">—</span>
                                                        );
                                                    })()}
                                                </td>
                                            </>
                                        ) : (
                                            <td data-label="Score">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    data-score-col="score"
                                                    className={`input-field text-sm ${row.error ? 'border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]' : ''}`}
                                                    style={{ padding: '8px 12px' }}
                                                    placeholder={`0-${maxScore}`}
                                                    value={row.score}
                                                    onChange={e => updateRow(i, 'score', e.target.value)}
                                                    onKeyDown={e => handleScoreKeyDown(e, 'score')}
                                                />
                                            </td>
                                        )}
                                        {/* Grade (auto-resolved but editable) */}
                                        <td data-label="Grade">
                                            <select
                                                className="input-field text-sm"
                                                style={{ padding: '8px 12px' }}
                                                value={row.grade}
                                                onChange={e => updateRow(i, 'grade', e.target.value)}
                                            >
                                                <option value="">Select grade</option>
                                                {Object.entries(groupedOptions).map(([systemName, opts]) => (
                                                    <optgroup key={systemName} label={systemName}>
                                                        {opts.map(o => (
                                                            <option key={o.symbol} value={o.symbol}>
                                                                {o.symbol} — {o.label}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </td>
                                        {/* Remarks */}
                                        <td data-label="Remarks">
                                            <input
                                                className="input-field text-sm"
                                                style={{ padding: '8px 12px' }}
                                                placeholder="Optional"
                                                value={row.remarks}
                                                onChange={e => updateRow(i, 'remarks', e.target.value)}
                                            />
                                        </td>
                                        {/* Remove */}
                                        <td data-label="Action">
                                            <button
                                                onClick={() => removeRow(i)}
                                                className="text-muted-foreground hover:text-destructive p-2 text-lg transition-colors cursor-pointer"
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
                                <div key={i} className="text-xs text-destructive mb-1">
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
                </>
            )}

            {/* Class/Stream selected but no students */}
            {entryReady && !studentsLoading && students.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                    No students found in this class. Add students in the <strong>Students</strong> page first.
                </div>
            )}
        </div>
    );
}
