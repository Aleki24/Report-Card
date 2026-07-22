"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

interface StudentOption {
    id: string;
    name: string;
    admission_number: string;
}

interface StreamItem { id: string; full_name: string; grade_id: string; }

interface ScanRow {
    row: number;
    student_name: string;
    admission_number: string | null;
    score: number | null;
    confidence: 'high' | 'medium' | 'low';
}

interface ReviewRow {
    key: number;
    extractedName: string;
    extractedAdm: string | null;
    studentId: string;      // '' = unmatched
    ambiguous: boolean;     // matched, but not confidently — teacher should check
    score: string;
    grade: string;
    confidence: ScanRow['confidence'];
    error: string;
}

interface Props {
    examId: string;
    maxScore?: number;
    gradeId?: string;
    gradeStreamId?: string | null;
    /** The exam's subject — scopes name matching to enrolled takers */
    subjectId?: string;
}

/* ── Name matching ─────────────────────────────────────────── */

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const curr = [i];
        for (let j = 1; j <= n; j++) {
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = curr;
    }
    return prev[n];
}

/** 0..1 similarity between an extracted name and a roster name (token-order tolerant). */
function nameSimilarity(extracted: string, roster: string): number {
    const a = normalize(extracted), b = normalize(roster);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const aTokens = a.split(' '), bTokens = b.split(' ');
    // Score each extracted token against its best roster token
    let total = 0;
    for (const at of aTokens) {
        let best = 0;
        for (const bt of bTokens) {
            const d = levenshtein(at, bt);
            const sim = 1 - d / Math.max(at.length, bt.length);
            if (sim > best) best = sim;
        }
        total += best;
    }
    return total / aTokens.length;
}

function matchStudent(row: ScanRow, students: StudentOption[]): { id: string; ambiguous: boolean } {
    // 1. Exact admission-number match wins outright
    if (row.admission_number) {
        const adm = row.admission_number.trim().toLowerCase();
        const byAdm = students.find(s => s.admission_number.trim().toLowerCase() === adm);
        if (byAdm) return { id: byAdm.id, ambiguous: false };
    }
    // 2. Fuzzy name match
    const scored = students
        .map(s => ({ s, sim: nameSimilarity(row.student_name, s.name) }))
        .sort((x, y) => y.sim - x.sim);
    const best = scored[0], second = scored[1];
    if (!best || best.sim < 0.55) return { id: '', ambiguous: false };
    // Ambiguous when the runner-up is nearly as good, or the match itself is soft
    const ambiguous = best.sim < 0.8 || (second !== undefined && best.sim - second.sim < 0.12);
    return { id: best.s.id, ambiguous };
}

/* ── Image downscaling ─────────────────────────────────────── */

const MAX_EDGE = 1600;

async function fileToDataUrl(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.87);
}

/* ── Component ─────────────────────────────────────────────── */

export function ScanSheet({ examId, maxScore = 100, gradeId, gradeStreamId, subjectId }: Props) {
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [gradingScales, setGradingScales] = useState<{ symbol: string; label: string; min_percentage: number; max_percentage: number }[]>([]);
    const [photo, setPhoto] = useState<string | null>(null);
    const [phase, setPhase] = useState<'capture' | 'scanning' | 'review' | 'saving'>('capture');
    const [rows, setRows] = useState<ReviewRow[]>([]);
    const [scanNotes, setScanNotes] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /* Roster: the exam knows its class; filter students the same way ManualEntryGrid does */
    useEffect(() => {
        (async () => {
            try {
                const [studentsRes, structureRes] = await Promise.all([
                    fetch(`/api/school/data?type=students${subjectId ? `&subject_id=${subjectId}` : ''}`),
                    fetch('/api/admin/academic-structure'),
                ]);
                const { data: allStudents } = await studentsRes.json();
                const structure = await structureRes.json();
                const allStreams: StreamItem[] = structure.grade_streams || [];
                const filtered = (allStudents || []).filter((s: { current_grade_stream_id: string | null }) => {
                    if (gradeStreamId) return s.current_grade_stream_id === gradeStreamId;
                    if (gradeId) return allStreams.some(st => st.grade_id === gradeId && st.id === s.current_grade_stream_id);
                    return true;
                });
                setStudents(
                    filtered.map((s: { id: string; users?: { first_name?: string; last_name?: string } | null; admission_number?: string }) => ({
                        id: s.id,
                        name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
                        admission_number: s.admission_number || '',
                    }))
                );
            } catch (err) {
                console.error('Failed to load students for scan:', err);
            }
        })();
    }, [gradeId, gradeStreamId, subjectId]);

    /* Grading scales for auto-grade */
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/school/data?type=grading_scales');
                const dataObj = await res.json();
                const scales: { symbol: string; label: string; min_percentage: number; max_percentage: number }[] = [];
                (dataObj.data || []).forEach((sys: { grading_scales?: { symbol: string; label?: string; min_percentage: number; max_percentage: number }[] }) => {
                    sys.grading_scales?.forEach(sc => {
                        scales.push({ symbol: sc.symbol, label: sc.label || '', min_percentage: sc.min_percentage, max_percentage: sc.max_percentage });
                    });
                });
                setGradingScales(scales);
            } catch (err) {
                console.error('Failed to load grading scales:', err);
            }
        })();
    }, []);

    const resolveGrade = useCallback((score: number): string => {
        if (maxScore <= 0) return '';
        // Round before matching, consistent with the shared getGradeFromScales
        // helper, so gap percentages don't resolve differently per screen.
        const pct = Math.round((score / maxScore) * 100);
        for (const sc of gradingScales) {
            if (pct >= sc.min_percentage && pct <= sc.max_percentage) return sc.symbol;
        }
        return '';
    }, [gradingScales, maxScore]);

    const validateScore = useCallback((value: string): string => {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return 'Not a number';
        if (num < 0 || num > maxScore) return `Must be 0–${maxScore}`;
        return '';
    }, [maxScore]);

    /* ── Capture & scan ── */
    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        setMessage(null);
        setPhase('scanning');
        try {
            const dataUrl = await fileToDataUrl(file);
            setPhoto(dataUrl);
            const res = await fetch('/api/school/exam-marks/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl, max_score: maxScore }),
            });
            const json = await res.json();
            if (!res.ok) {
                setMessage({ type: 'error', text: json.error || 'Scan failed. Try again.' });
                setPhase('capture');
                return;
            }
            const scanRows: ScanRow[] = json.rows || [];
            setScanNotes(json.notes || null);
            const usedIds = new Set<string>();
            const reviewRows: ReviewRow[] = scanRows.map((r, i) => {
                const match = matchStudent(r, students.filter(s => !usedIds.has(s.id)));
                if (match.id) usedIds.add(match.id);
                const scoreStr = r.score != null ? String(r.score) : '';
                const err = validateScore(scoreStr);
                return {
                    key: i,
                    extractedName: r.student_name,
                    extractedAdm: r.admission_number,
                    studentId: match.id,
                    ambiguous: match.ambiguous,
                    score: scoreStr,
                    grade: !err && r.score != null ? resolveGrade(r.score) : '',
                    confidence: r.confidence,
                    error: err,
                };
            });
            setRows(reviewRows);
            setPhase('review');
        } catch (err) {
            console.error('Scan failed:', err);
            setMessage({ type: 'error', text: 'Could not process the photo. Try again.' });
            setPhase('capture');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    /* ── Review edits ── */
    const updateRow = (key: number, patch: Partial<ReviewRow>) => {
        setRows(prev => prev.map(r => {
            if (r.key !== key) return r;
            const next = { ...r, ...patch };
            if (patch.score !== undefined) {
                next.error = validateScore(patch.score);
                const num = parseFloat(patch.score);
                next.grade = !next.error && patch.score !== '' && !isNaN(num) ? resolveGrade(num) : '';
            }
            if (patch.studentId !== undefined) next.ambiguous = false;
            return next;
        }));
    };

    const removeRow = (key: number) => setRows(prev => prev.filter(r => r.key !== key));

    const selectedIds = useMemo(() => new Set(rows.map(r => r.studentId).filter(Boolean)), [rows]);
    const readyRows = rows.filter(r => r.studentId && r.score !== '' && !r.error && r.grade);
    const unmatchedCount = rows.filter(r => !r.studentId).length;
    const needsCheckCount = rows.filter(r => r.studentId && (r.ambiguous || r.confidence === 'low')).length;

    /* ── Save ── */
    const handleSave = async () => {
        if (readyRows.length === 0) {
            setMessage({ type: 'error', text: 'No complete rows to save — match students and fix scores first.' });
            return;
        }
        setPhase('saving');
        setMessage(null);
        try {
            const marks = readyRows.map(r => {
                const score = parseFloat(r.score);
                return {
                    exam_id: examId,
                    student_id: r.studentId,
                    raw_score: score,
                    percentage: maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0,
                    grade_symbol: r.grade,
                    remarks: null,
                };
            });
            const res = await fetch('/api/school/exam-marks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exam_id: examId, marks }),
            });
            const result = await res.json();
            if (!res.ok) {
                setMessage({ type: 'error', text: `Save failed: ${result.error}` });
                setPhase('review');
                return;
            }
            const skipped = rows.length - readyRows.length;
            setMessage({
                type: 'success',
                text: `✅ Saved ${readyRows.length} mark${readyRows.length !== 1 ? 's' : ''} from the scan${skipped > 0 ? ` · ${skipped} row${skipped !== 1 ? 's' : ''} skipped` : ''}.`,
            });
            setRows([]);
            setPhoto(null);
            setPhase('capture');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setMessage({ type: 'error', text: `Save failed: ${msg}` });
            setPhase('review');
        }
    };

    const reset = () => {
        setRows([]);
        setPhoto(null);
        setScanNotes(null);
        setMessage(null);
        setPhase('capture');
    };

    /* ── Render ── */
    return (
        <div className="card overflow-hidden">
            <div className="mb-6">
                <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-1">📷 Scan Marksheet</h3>
                <p className="text-muted-foreground text-sm">
                    Take a photo of a paper marksheet — names and marks are read automatically for you to review before saving.
                    · Max score: {maxScore} · {students.length} student{students.length !== 1 ? 's' : ''} in this class
                </p>
            </div>

            {message && (
                <div className={`mb-6 p-3 rounded-md text-sm border ${message.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
                    {message.text}
                </div>
            )}

            {/* Capture */}
            {phase === 'capture' && (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-10 text-center">
                    <div className="text-4xl" aria-hidden>📄</div>
                    <div className="max-w-md text-sm text-muted-foreground">
                        Photograph the whole sheet from directly above, in good light, with names and marks visible.
                        Multi-page sheets: scan one page at a time.
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => handleFile(e.target.files?.[0])}
                    />
                    <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                        📷 Take / Upload Photo
                    </button>
                </div>
            )}

            {/* Scanning */}
            {phase === 'scanning' && (
                <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                    <div className="skeleton-spinner" />
                    <div className="text-sm text-muted-foreground">Reading the marksheet… this takes a few seconds.</div>
                    {photo && <img src={photo} alt="Marksheet being scanned" className="mt-2 max-h-48 rounded-lg border border-border opacity-70" />}
                </div>
            )}

            {/* Review */}
            {(phase === 'review' || phase === 'saving') && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
                    {/* Photo side */}
                    <div>
                        {photo && (
                            <a href={photo} target="_blank" rel="noreferrer" title="Open full size">
                                <img src={photo} alt="Scanned marksheet" className="w-full rounded-xl border border-border" />
                            </a>
                        )}
                        {scanNotes && (
                            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">
                                ⚠️ {scanNotes}
                            </div>
                        )}
                        <div className="mt-3 text-xs text-muted-foreground">
                            {rows.length} row{rows.length !== 1 ? 's' : ''} read
                            {unmatchedCount > 0 && <> · <span className="text-destructive font-medium">{unmatchedCount} unmatched</span></>}
                            {needsCheckCount > 0 && <> · <span className="text-amber-600 font-medium">{needsCheckCount} need checking</span></>}
                        </div>
                    </div>

                    {/* Review grid */}
                    <div className="min-w-0">
                        <div className="overflow-x-auto">
                            <table className="data-table w-full sm:whitespace-nowrap">
                                <thead>
                                    <tr>
                                        <th className="w-8">#</th>
                                        <th>Read from sheet</th>
                                        <th>Student</th>
                                        <th className="w-24">Score *</th>
                                        <th className="w-24">Grade</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => {
                                        const flagged = !r.studentId || r.ambiguous || r.confidence === 'low' || !!r.error;
                                        return (
                                            <tr key={r.key} className={flagged ? 'bg-amber-500/5' : ''}>
                                                <td className="text-xs text-muted-foreground">{r.key + 1}</td>
                                                <td>
                                                    <div className="text-sm font-medium">{r.extractedName}</div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {r.extractedAdm && <span className="mr-2 font-mono">{r.extractedAdm}</span>}
                                                        {r.confidence === 'low' && <span className="text-amber-600 font-semibold">low confidence</span>}
                                                        {r.confidence !== 'low' && r.ambiguous && <span className="text-amber-600 font-semibold">check match</span>}
                                                        {!r.studentId && <span className="text-destructive font-semibold">no match found</span>}
                                                    </div>
                                                </td>
                                                <td>
                                                    <select
                                                        className="input-field w-full min-w-[170px] text-sm"
                                                        style={{ padding: '6px 10px' }}
                                                        value={r.studentId}
                                                        onChange={e => updateRow(r.key, { studentId: e.target.value })}
                                                    >
                                                        <option value="">— Assign student —</option>
                                                        {students.map(s => {
                                                            const taken = selectedIds.has(s.id) && r.studentId !== s.id;
                                                            return (
                                                                <option key={s.id} value={s.id} disabled={taken}>
                                                                    {s.name}{s.admission_number ? ` (${s.admission_number})` : ''}{taken ? ' — assigned' : ''}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        className={`input-field w-20 text-sm ${r.error ? 'border-[var(--color-danger)]' : ''}`}
                                                        style={{ padding: '6px 10px' }}
                                                        value={r.score}
                                                        placeholder={`0–${maxScore}`}
                                                        onChange={e => updateRow(r.key, { score: e.target.value })}
                                                    />
                                                    {r.error && <div className="mt-0.5 text-[11px] text-destructive">{r.error}</div>}
                                                </td>
                                                <td className="text-sm font-semibold">{r.grade || <span className="text-muted-foreground font-normal">—</span>}</td>
                                                <td>
                                                    <button onClick={() => removeRow(r.key)} className="cursor-pointer p-1 text-lg text-muted-foreground transition-colors hover:text-destructive" title="Discard row">×</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row">
                            <button className="btn-secondary justify-center" onClick={reset} disabled={phase === 'saving'}>
                                ↺ Scan another photo
                            </button>
                            <button
                                className="btn-primary justify-center disabled:opacity-50"
                                onClick={handleSave}
                                disabled={phase === 'saving' || readyRows.length === 0}
                            >
                                {phase === 'saving' ? '⏳ Saving…' : `Save ${readyRows.length} mark${readyRows.length !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                            Nothing is saved until you confirm. Rows without an assigned student or score are skipped.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
