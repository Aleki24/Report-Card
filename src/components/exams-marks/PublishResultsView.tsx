"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

interface GradeStreamOption { id: string; full_name: string; grade_id: string; }
interface TermOption { id: string; name: string; academic_year_id?: string }
interface ExamRow {
    id: string; name: string; exam_type: string; subject_id: string; subject_name: string;
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';
}

interface StudentGap { name: string; admission_number: string; missing?: string[] }
interface PublishReadiness {
    isMultiPaper: boolean;
    papers: { code: string; name: string }[];
    rosterCount: number;
    markedCount: number;
    fullyMarkedCount: number;
    unmarked: StudentGap[];
    partiallyMarked: StudentGap[];
    hasIssues: boolean;
}

type RankBy = 'mean_marks' | 'total_points' | 'mean_points';

const EXAM_TYPE_LABELS: Record<string, string> = {
    CAT: 'CAT', TOPICAL: 'Topical', MIDTERM: 'Midterm', ENDTERM: 'End Term',
    OPENER: 'Opener', MOCK: 'Mock', PRE_MOCK: 'Pre-Mock', POST_MOCK: 'Post-Mock',
    ZONE: 'Zone', SUB_COUNTY: 'Sub-County', COUNTY: 'County', REGIONAL: 'Regional', NATIONAL: 'National',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'var(--color-text-muted)' },
    PENDING_APPROVAL: { label: 'Pending Approval', color: '#F59E0B' },
    APPROVED: { label: 'Approved', color: '#10B981' },
};

/**
 * Publish Results — a class-level publish screen: pick a class and exam round,
 * see every subject's publish status, publish / approve / unpublish (per
 * subject or in bulk), and preview the class ranking by a chosen criterion.
 */
export function PublishResultsView() {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'ADMIN';

    const [streams, setStreams] = useState<GradeStreamOption[]>([]);
    const [terms, setTerms] = useState<TermOption[]>([]);
    const [streamId, setStreamId] = useState('');
    const [termId, setTermId] = useState('');
    const [examType, setExamType] = useState('');

    const [exams, setExams] = useState<ExamRow[]>([]);
    const [loadingExams, setLoadingExams] = useState(false);
    const [busyExamId, setBusyExamId] = useState<string | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [confirmExam, setConfirmExam] = useState<{ id: string; name: string; subject: string; readiness: PublishReadiness } | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    // Ranking preview
    const [rankBy, setRankBy] = useState<RankBy>('mean_marks');
    const [minSubjects, setMinSubjects] = useState(7);
    const [marks, setMarks] = useState<any[]>([]);
    const [pointsBySymbol, setPointsBySymbol] = useState<Record<string, number>>({});
    const [loadingPreview, setLoadingPreview] = useState(false);

    // ── Load streams + terms ──
    useEffect(() => {
        (async () => {
            try {
                const [gsRes, tRes] = await Promise.all([
                    fetch('/api/school/data?type=grade_streams'),
                    fetch('/api/school/data?type=terms'),
                ]);
                const gsJson = await gsRes.json();
                const tJson = await tRes.json();
                setStreams(gsJson.data || []);
                setTerms(tJson.data || []);
            } catch (err) {
                console.error('Failed to load classes/terms', err);
            }
        })();
    }, []);

    // ── Load exams for the class (optionally scoped by term + type) ──
    const loadExams = useCallback(async () => {
        if (!streamId) { setExams([]); return; }
        const stream = streams.find(s => s.id === streamId);
        if (!stream) return;
        setLoadingExams(true);
        try {
            const params = new URLSearchParams({ stream_id: streamId, grade_id: stream.grade_id });
            if (termId) params.set('term_id', termId);
            if (examType) params.set('exam_type', examType);
            const res = await fetch(`/api/school/exams?${params.toString()}`);
            const json = await res.json();
            const mapped: ExamRow[] = (json.data || []).map((e: any) => ({
                id: e.id, name: e.name, exam_type: e.exam_type,
                subject_id: e.subject_id, subject_name: e.subject_name || 'N/A',
                status: e.status || 'DRAFT',
            }));
            setExams(mapped);
        } catch (err) {
            console.error('Failed to load exams', err);
            setExams([]);
        } finally {
            setLoadingExams(false);
        }
    }, [streamId, termId, examType, streams]);

    useEffect(() => { loadExams(); }, [loadExams]);

    // Available exam types for the class (for the round filter)
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);
    useEffect(() => {
        setExamType('');
        if (!streamId) { setAvailableTypes([]); return; }
        const stream = streams.find(s => s.id === streamId);
        if (!stream) return;
        (async () => {
            try {
                const params = new URLSearchParams({ stream_id: streamId, grade_id: stream.grade_id });
                if (termId) params.set('term_id', termId);
                const res = await fetch(`/api/school/exams?${params.toString()}`);
                const json = await res.json();
                setAvailableTypes(Array.from(new Set((json.data || []).map((e: any) => e.exam_type).filter(Boolean))) as string[]);
            } catch { setAvailableTypes([]); }
        })();
    }, [streamId, termId, streams]);

    // ── Ranking preview data (marks + points map) ──
    const loadPreview = useCallback(async () => {
        if (!streamId || exams.length === 0) { setMarks([]); return; }
        setLoadingPreview(true);
        try {
            const scopeExamId = exams[0].id; // scopes the stream endpoint to this term
            const [marksRes, structRes] = await Promise.all([
                fetch(`/api/school/exam-marks/stream?stream_id=${streamId}&exam_id=${scopeExamId}`),
                fetch('/api/admin/academic-structure'),
            ]);
            const marksJson = await marksRes.json();
            const struct = await structRes.json();
            const overallIds = new Set((struct.grading_systems || []).filter((g: any) => g.system_kind === 'OVERALL').map((g: any) => g.id));
            const map: Record<string, number> = {};
            (struct.grading_scales || []).forEach((sc: any) => {
                if (overallIds.has(sc.grading_system_id)) return;
                map[sc.symbol] = sc.points ?? 0;
            });
            setPointsBySymbol(map);
            // Keep only marks for the exams currently listed (the selected round/term)
            const examIds = new Set(exams.map(e => e.id));
            setMarks((marksJson.data || []).filter((m: any) => examIds.has(m.exam_id)));
        } catch (err) {
            console.error('Failed to load preview', err);
            setMarks([]);
        } finally {
            setLoadingPreview(false);
        }
    }, [streamId, exams]);

    useEffect(() => { loadPreview(); }, [loadPreview]);

    // ── Publish workflow actions ──
    // Publishing is a two-step confirm (see status route): the first POST with
    // no `confirm` returns a readiness report; only the confirmed POST commits.
    const runAction = async (examId: string, action: 'publish' | 'approve' | 'unpublish') => {
        setBusyExamId(examId);
        try {
            const res = await fetch(`/api/school/exams/${examId}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || 'Action failed'); return; }
            if (action === 'publish' && data.requiresConfirmation) {
                const ex = exams.find(e => e.id === examId);
                setConfirmExam({ id: examId, name: ex?.name || '', subject: ex?.subject_name || '', readiness: data.readiness });
                return;
            }
            await loadExams();
        } catch { toast.error('Network error'); }
        finally { setBusyExamId(null); }
    };

    const confirmPublish = async () => {
        if (!confirmExam) return;
        setConfirmBusy(true);
        try {
            const res = await fetch(`/api/school/exams/${confirmExam.id}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'publish', confirm: true }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || 'Action failed'); return; }
            setConfirmExam(null);
            await loadExams();
        } catch { toast.error('Network error'); }
        finally { setConfirmBusy(false); }
    };

    const runBulk = async (action: 'publish' | 'approve', fromStatus: 'DRAFT' | 'PENDING_APPROVAL') => {
        const targets = exams.filter(e => e.status === fromStatus);
        if (targets.length === 0) { toast.info('Nothing to do.'); return; }
        if (action === 'publish' && !confirm(`Publish ${targets.length} subject(s) for review? Students with no marks are excluded, and any missing papers are scored on what was entered.`)) return;
        setBulkBusy(true);
        let ok = 0, fail = 0;
        for (const ex of targets) {
            try {
                const res = await fetch(`/api/school/exams/${ex.id}/status`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    // Bulk is an explicit, already-confirmed intent.
                    body: JSON.stringify(action === 'publish' ? { action, confirm: true } : { action }),
                });
                if (res.ok) ok++; else fail++;
            } catch { fail++; }
        }
        setBulkBusy(false);
        toast[fail === 0 ? 'success' : 'warning'](`${action === 'publish' ? 'Published' : 'Approved'} ${ok} subject(s)${fail ? `, ${fail} failed` : ''}.`);
        await loadExams();
    };

    // ── Ranking computation ──
    const ranking = useMemo(() => {
        const byStudent = new Map<string, { name: string; adm: string; pcts: number[]; pts: number[] }>();
        for (const m of marks) {
            const sid = m.student_id;
            const u = m.students?.users;
            if (!byStudent.has(sid)) byStudent.set(sid, { name: `${u?.first_name || ''} ${u?.last_name || ''}`.trim(), adm: m.students?.admission_number || '', pcts: [], pts: [] });
            const rec = byStudent.get(sid)!;
            rec.pcts.push(Number(m.percentage) || 0);
            rec.pts.push(m.grade_symbol && pointsBySymbol[m.grade_symbol] != null ? pointsBySymbol[m.grade_symbol] : 0);
        }
        const rows = Array.from(byStudent.entries()).map(([sid, r]) => {
            const meanMarks = r.pcts.length ? r.pcts.reduce((a, b) => a + b, 0) / r.pcts.length : 0;
            const bestPts = [...r.pts].sort((a, b) => b - a).slice(0, Math.max(1, minSubjects));
            const totalPoints = bestPts.reduce((a, b) => a + b, 0);
            const meanPoints = bestPts.length ? totalPoints / bestPts.length : 0;
            return { sid, name: r.name, adm: r.adm, subjects: r.pcts.length, meanMarks, totalPoints, meanPoints };
        });
        const key = rankBy === 'mean_marks' ? 'meanMarks' : rankBy === 'total_points' ? 'totalPoints' : 'meanPoints';
        rows.sort((a, b) => (b as any)[key] - (a as any)[key]);
        let rank = 0, prev: number | null = null;
        return rows.map((r, i) => {
            const v = (r as any)[key];
            if (prev === null || v !== prev) { rank = i + 1; prev = v; }
            return { ...r, rank };
        });
    }, [marks, pointsBySymbol, rankBy, minSubjects]);

    const draftCount = exams.filter(e => e.status === 'DRAFT').length;
    const pendingCount = exams.filter(e => e.status === 'PENDING_APPROVAL').length;

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
            {/* Scope pickers */}
            <div className="card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs text-muted-foreground mb-1">Class / Stream</label>
                    <select className="input-field w-full" value={streamId} onChange={e => setStreamId(e.target.value)}>
                        <option value="">-- Select Class --</option>
                        {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-muted-foreground mb-1">Term (optional)</label>
                    <select className="input-field w-full" value={termId} onChange={e => setTermId(e.target.value)} disabled={!streamId}>
                        <option value="">All terms</option>
                        {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-muted-foreground mb-1">Exam</label>
                    <select className="input-field w-full" value={examType} onChange={e => setExamType(e.target.value)} disabled={!streamId || availableTypes.length === 0}>
                        <option value="">{availableTypes.length === 0 ? 'No exams yet' : 'All exams'}</option>
                        {availableTypes.map(t => <option key={t} value={t}>{EXAM_TYPE_LABELS[t] || t}</option>)}
                    </select>
                </div>
            </div>

            {!streamId ? (
                <div className="card text-center py-16 text-sm text-muted-foreground">Select a class to publish its results.</div>
            ) : (
                <>
                    {/* Subject publish status */}
                    <div className="card overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-border">
                            <h3 className="font-bold text-base font-[family-name:var(--font-display)]">Status of subject results</h3>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className="btn-secondary text-xs disabled:opacity-50" onClick={() => runBulk('publish', 'DRAFT')} disabled={bulkBusy || draftCount === 0}>
                                    📤 Publish all drafts{draftCount ? ` (${draftCount})` : ''}
                                </button>
                                {isAdmin && (
                                    <button type="button" className="btn-primary text-xs disabled:opacity-50" onClick={() => runBulk('approve', 'PENDING_APPROVAL')} disabled={bulkBusy || pendingCount === 0}>
                                        ✅ Approve all pending{pendingCount ? ` (${pendingCount})` : ''}
                                    </button>
                                )}
                            </div>
                        </div>
                        {loadingExams ? (
                            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
                        ) : exams.length === 0 ? (
                            <div className="p-6 text-sm text-muted-foreground">No exams found for this selection.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="data-table w-full text-left">
                                    <thead className="bg-muted border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Subject</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Exam</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border)]">
                                        {exams.map(ex => {
                                            const meta = STATUS_META[ex.status];
                                            const busy = busyExamId === ex.id;
                                            return (
                                                <tr key={ex.id} className="hover:bg-muted/50 transition-colors">
                                                    <td className="px-4 py-3 text-sm font-medium">{ex.subject_name}</td>
                                                    <td className="px-4 py-3 text-xs text-muted-foreground">{ex.name}</td>
                                                    <td className="px-4 py-3">
                                                        <span style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }} className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold">{meta.label}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex justify-end gap-2 flex-wrap">
                                                            {ex.status === 'DRAFT' && <button className="btn-secondary text-xs" onClick={() => runAction(ex.id, 'publish')} disabled={busy}>{busy ? '…' : 'Publish'}</button>}
                                                            {ex.status === 'PENDING_APPROVAL' && isAdmin && <button className="btn-primary text-xs" onClick={() => runAction(ex.id, 'approve')} disabled={busy}>{busy ? '…' : 'Approve'}</button>}
                                                            {(ex.status === 'PENDING_APPROVAL' || (ex.status === 'APPROVED' && isAdmin)) && <button className="btn-secondary text-xs" onClick={() => runAction(ex.id, 'unpublish')} disabled={busy}>{busy ? '…' : 'Unpublish'}</button>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Ranking preview */}
                    <div className="card overflow-hidden">
                        <div className="flex flex-wrap items-end justify-between gap-3 p-5 border-b border-border">
                            <h3 className="font-bold text-base font-[family-name:var(--font-display)]">Class ranking preview</h3>
                            <div className="flex flex-wrap items-end gap-3">
                                <div>
                                    <label className="block text-[11px] text-muted-foreground mb-1">Ranking criteria</label>
                                    <select className="input-field text-sm" value={rankBy} onChange={e => setRankBy(e.target.value as RankBy)}>
                                        <option value="mean_marks">Rank by Mean marks</option>
                                        <option value="total_points">Rank by Total points</option>
                                        <option value="mean_points">Rank by Mean points</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] text-muted-foreground mb-1">Best subjects</label>
                                    <input type="number" min={1} max={20} className="input-field text-sm w-20 text-center" value={minSubjects} onChange={e => setMinSubjects(Math.max(1, parseInt(e.target.value) || 1))} />
                                </div>
                            </div>
                        </div>
                        {loadingPreview ? (
                            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
                        ) : ranking.length === 0 ? (
                            <div className="p-6 text-sm text-muted-foreground">No marks entered yet for this selection.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="data-table w-full text-left">
                                    <thead className="bg-muted border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-center">Pos</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Student</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Adm No</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-center">Subjects</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-center">Mean %</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-center">Total pts</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-center">Mean pts</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border)]">
                                        {ranking.map(r => (
                                            <tr key={r.sid} className="hover:bg-muted/50 transition-colors">
                                                <td className="px-4 py-3 text-center font-bold text-[var(--color-accent)]">{r.rank}</td>
                                                <td className="px-4 py-3 text-sm">{r.name}</td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">{r.adm}</td>
                                                <td className="px-4 py-3 text-center text-sm">{r.subjects}</td>
                                                <td className="px-4 py-3 text-center text-sm font-semibold">{r.meanMarks.toFixed(1)}%</td>
                                                <td className="px-4 py-3 text-center text-sm">{r.totalPoints}</td>
                                                <td className="px-4 py-3 text-center text-sm">{r.meanPoints.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">Preview only — the official report-card ranking uses the full 8-4-4 subject clustering. &quot;Best subjects&quot; sums each student&apos;s top-N grade points.</p>
                    </div>
                </>
            )}

            {confirmExam && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => !confirmBusy && setConfirmExam(null)}>
                    <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-base font-bold font-[family-name:var(--font-display)] mb-1">Publish {confirmExam.subject} results?</h2>
                        <p className="text-xs text-muted-foreground mb-4">{confirmExam.name} — once published, an admin reviews and approves before report cards can be downloaded.</p>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="p-3 rounded-lg bg-surface-raised text-center">
                                <div className="text-lg font-bold text-emerald-400">{confirmExam.readiness.fullyMarkedCount}</div>
                                <div className="text-[11px] text-muted-foreground">Fully marked</div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-raised text-center">
                                <div className="text-lg font-bold text-amber-400">{confirmExam.readiness.partiallyMarked.length}</div>
                                <div className="text-[11px] text-muted-foreground">Missing papers</div>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-raised text-center">
                                <div className="text-lg font-bold text-muted-foreground">{confirmExam.readiness.unmarked.length}</div>
                                <div className="text-[11px] text-muted-foreground">No marks</div>
                            </div>
                        </div>

                        {confirmExam.readiness.partiallyMarked.length > 0 && (
                            <div className="mb-3">
                                <p className="text-xs font-semibold text-amber-500 mb-1">⚠️ Missing some papers — scored on the papers they have:</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto pl-1">
                                    {confirmExam.readiness.partiallyMarked.slice(0, 50).map((s, i) => (
                                        <li key={i}><strong className="text-foreground">{s.name || s.admission_number}</strong>{s.missing && s.missing.length > 0 && <span> — missing {s.missing.join(', ')}</span>}</li>
                                    ))}
                                    {confirmExam.readiness.partiallyMarked.length > 50 && <li>…and {confirmExam.readiness.partiallyMarked.length - 50} more</li>}
                                </ul>
                            </div>
                        )}

                        {confirmExam.readiness.unmarked.length > 0 && (
                            <div className="mb-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">No marks — will not be included:</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto pl-1">
                                    {confirmExam.readiness.unmarked.slice(0, 50).map((s, i) => <li key={i}>{s.name || s.admission_number}</li>)}
                                    {confirmExam.readiness.unmarked.length > 50 && <li>…and {confirmExam.readiness.unmarked.length - 50} more</li>}
                                </ul>
                            </div>
                        )}

                        {!confirmExam.readiness.hasIssues && <p className="text-xs text-emerald-400 mb-3">✅ Every student in this class is fully marked.</p>}

                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                            <button type="button" className="btn-secondary text-xs" onClick={() => setConfirmExam(null)} disabled={confirmBusy}>Cancel</button>
                            <button type="button" className="btn-primary text-xs disabled:opacity-50" onClick={confirmPublish} disabled={confirmBusy}>
                                {confirmBusy ? 'Publishing…' : confirmExam.readiness.hasIssues ? 'Publish anyway' : 'Publish for review'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
