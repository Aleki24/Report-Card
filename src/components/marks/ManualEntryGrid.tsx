"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Cloud, CloudOff, Info, Loader2, Save, Search, X } from 'lucide-react';
import type { ExamSubjectComponent, ExamSubjectComponentScheme } from '@/types';
import type { RosterMode } from '@/lib/subject-roster';
import { calculateCompositeSubjectScore, isMultiPaper } from '@/lib/multi-paper';
import { useAuth } from '@/components/AuthProvider';
import {
    saveDraft, loadDraft, clearDraft,
    enqueueBatch, flushQueue, pendingCountForExam, isOnline,
} from '@/lib/offline-marks';
import {
    emptyEntry, hasScore, rowStatus, scoreToText, validateEntry,
    type EntryValues, type RowStatus, type SavedMark,
} from '@/lib/mark-entry';
import { cn } from '@/lib/utils';
import { MarkSheetRow, type GradeOption, type MarkSheetLearner } from './entry/MarkSheetRow';

/* ── API shapes ─────────────────────────────────────────── */

interface GradeItem { id: string; academic_level_id: string; }
interface StreamItem { id: string; full_name: string; grade_id: string; }
interface GradingSystem { id: string; academic_level_id: string; name: string; system_kind?: string; }
interface GradingScaleRow { grading_system_id: string; symbol: string; label: string | null; min_percentage: number; max_percentage: number; }

interface StructureResponse {
    grades?: GradeItem[];
    grade_streams?: StreamItem[];
    grading_systems?: GradingSystem[];
    grading_scales?: GradingScaleRow[];
    subjects?: { id: string; grading_system_id?: string | null }[];
}

interface ApiStudent {
    id: string;
    admission_number: string | null;
    current_grade_stream_id: string | null;
    users?: { first_name?: string | null; last_name?: string | null } | null;
}

interface ApiSavedMark {
    id: string;
    student_id: string;
    raw_score: number | string | null;
    grade_symbol: string | null;
    remarks: string | null;
    components?: Record<string, number>;
}

interface ExamMarksResponse {
    data?: ApiSavedMark[];
    scheme?: ExamSubjectComponentScheme | null;
    error?: string;
}

interface SavedRowResponse { id: string; student_id: string; }

/** Rows as stored in the local draft. Older drafts carried extra fields and `isGradeManuallySet`. */
type DraftRow = Partial<EntryValues> & { studentId?: string; isGradeManuallySet?: boolean };

type Filter = 'all' | 'todo' | 'entered' | 'unsaved';
type Notice = { tone: 'success' | 'error' | 'info'; text: string };

interface Props {
    examId: string;
    maxScore?: number;
    /** The exam's grade: learners in it load automatically. */
    gradeId: string;
    /** The exam's stream, if it targets a single stream. */
    gradeStreamId?: string | null;
    /** The exam's subject — narrows the roster to learners who take it (electives). */
    subjectId?: string;
}

const UNSAVED: ReadonlySet<RowStatus> = new Set<RowStatus>(['changed', 'new', 'removing']);

/* Each filter has its own hue, echoed by its count so the sheet's state
   reads at a glance: amber still to do, emerald done, blue waiting to save. */
const FILTERS: { id: Filter; label: string; active: string; count: string }[] = [
    { id: 'all', label: 'All', active: 'bg-foreground text-background', count: 'bg-muted text-muted-foreground' },
    { id: 'todo', label: 'Not entered', active: 'bg-amber-500 text-white', count: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    { id: 'entered', label: 'Entered', active: 'bg-emerald-500 text-white', count: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    { id: 'unsaved', label: 'Unsaved', active: 'bg-blue-500 text-white', count: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
];

function toSavedMark(m: ApiSavedMark): SavedMark {
    const componentScores: Record<string, string> = {};
    for (const [componentId, score] of Object.entries(m.components ?? {})) {
        componentScores[componentId] = scoreToText(score);
    }
    return {
        id: m.id,
        score: scoreToText(m.raw_score),
        componentScores,
        grade: m.grade_symbol ?? '',
        remarks: m.remarks ?? '',
        gradeOverridden: false,
    };
}

function fromDraftRow(row: DraftRow): EntryValues {
    return {
        score: row.score ?? '',
        componentScores: row.componentScores ?? {},
        grade: row.grade ?? '',
        remarks: row.remarks ?? '',
        gradeOverridden: row.gradeOverridden ?? row.isGradeManuallySet ?? false,
    };
}

export function ManualEntryGrid({ examId, maxScore = 100, gradeId, gradeStreamId, subjectId }: Props) {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'ADMIN';

    /* ── Loaded data ── */
    const [grades, setGrades] = useState<GradeItem[]>([]);
    const [streams, setStreams] = useState<StreamItem[]>([]);
    const [gradingSystems, setGradingSystems] = useState<GradingSystem[]>([]);
    const [gradingScales, setGradingScales] = useState<GradingScaleRow[]>([]);
    const [subjectGradingSystemId, setSubjectGradingSystemId] = useState<string | null>(null);
    const [apiStudents, setApiStudents] = useState<ApiStudent[]>([]);
    const [rosterMode, setRosterMode] = useState<RosterMode>('whole-class');
    const [saved, setSaved] = useState<Record<string, SavedMark>>({});
    const [scheme, setScheme] = useState<ExamSubjectComponentScheme | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    /* ── Working state ── */
    const [edits, setEdits] = useState<Record<string, EntryValues>>({});
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [streamFilter, setStreamFilter] = useState('');
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [restoredDraft, setRestoredDraft] = useState(false);

    /* ── Grading system choice ── */
    const [manualGradingSystemId, setManualGradingSystemId] = useState<string | null>(null);
    const [savingGradingSystemLink, setSavingGradingSystemLink] = useState(false);
    const [gradingSystemLinkMsg, setGradingSystemLinkMsg] = useState('');

    /* ── Offline-first entry ── */
    const [offline, setOffline] = useState(false);
    const [pendingSync, setPendingSync] = useState(0);
    const [lastDraftAt, setLastDraftAt] = useState<number | null>(null);
    // Autosave only once the draft for this exam has been read back, so the
    // empty initial state never overwrites a draft that is still loading.
    const draftLoadedRef = useRef<string | null>(null);

    const multiPaper = isMultiPaper(scheme);
    const components: ExamSubjectComponent[] = useMemo(
        () => (multiPaper ? [...(scheme?.components ?? [])].sort((a, b) => a.display_order - b.display_order) : []),
        [multiPaper, scheme],
    );

    const flash = useCallback((next: Notice, ms = 4000) => {
        setNotice(next);
        if (next.tone !== 'error') window.setTimeout(() => setNotice(n => (n === next ? null : n)), ms);
    }, []);

    /* ── Saved marks (and the paper scheme, which the same call returns) ── */
    const fetchSaved = useCallback(async (): Promise<{ saved: Record<string, SavedMark>; scheme: ExamSubjectComponentScheme | null }> => {
        const res = await fetch(`/api/school/exam-marks?exam_id=${encodeURIComponent(examId)}`, { cache: 'no-store' });
        const json = (await res.json()) as ExamMarksResponse;
        if (!res.ok) throw new Error(json.error || 'Could not load saved marks');
        const map: Record<string, SavedMark> = {};
        for (const m of json.data ?? []) map[m.student_id] = toSavedMark(m);
        return { saved: map, scheme: json.scheme ?? null };
    }, [examId]);

    const refreshSaved = useCallback(async () => {
        try {
            const result = await fetchSaved();
            setSaved(result.saved);
        } catch (err) {
            console.error('Failed to refresh saved marks:', err);
        }
    }, [fetchSaved]);

    /* ── Initial load: structure, roster, saved marks, then any local draft ── */
    useEffect(() => {
        let cancelled = false;
        draftLoadedRef.current = null;

        (async () => {
            try {
                const [structureRes, studentsRes, savedResult] = await Promise.all([
                    fetch('/api/admin/academic-structure', { cache: 'no-store' }),
                    fetch(`/api/school/data?type=students${subjectId ? `&subject_id=${encodeURIComponent(subjectId)}` : ''}`, { cache: 'no-store' }),
                    fetchSaved(),
                ]);
                const structure = (await structureRes.json()) as StructureResponse;
                const students = (await studentsRes.json()) as { data?: ApiStudent[]; roster?: RosterMode; error?: string };
                if (!studentsRes.ok) throw new Error(students.error || 'Could not load learners');
                if (cancelled) return;

                setGrades(structure.grades ?? []);
                setStreams(structure.grade_streams ?? []);
                // Only SUBJECT-kind systems grade a subject's marks; OVERALL
                // systems use point bands and would wrongly match percentages.
                setGradingSystems((structure.grading_systems ?? []).filter(gs => gs.system_kind !== 'OVERALL'));
                setGradingScales(structure.grading_scales ?? []);
                setSubjectGradingSystemId(structure.subjects?.find(s => s.id === subjectId)?.grading_system_id ?? null);
                setApiStudents(students.data ?? []);
                setRosterMode(students.roster ?? 'whole-class');
                setSaved(savedResult.saved);
                setScheme(savedResult.scheme);

                // Bring back anything typed on this device but not yet saved.
                const draftComponents = isMultiPaper(savedResult.scheme) ? savedResult.scheme?.components ?? [] : [];
                const draft = loadDraft<DraftRow>(examId);
                const restored: Record<string, EntryValues> = {};
                for (const row of draft?.rows ?? []) {
                    if (!row.studentId) continue;
                    const values = fromDraftRow(row);
                    const status = rowStatus(savedResult.saved[row.studentId], values, draftComponents);
                    if (UNSAVED.has(status)) restored[row.studentId] = values;
                }
                setEdits(restored);
                setRestoredDraft(Object.keys(restored).length > 0);
                setLastDraftAt(Object.keys(restored).length > 0 ? draft?.savedAt ?? null : null);
                setPendingSync(pendingCountForExam(examId));
                draftLoadedRef.current = examId;
            } catch (err) {
                if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load the mark sheet');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [examId, subjectId, fetchSaved]);

    /* ── Autosave edits on this device as they are typed ── */
    useEffect(() => {
        if (draftLoadedRef.current !== examId) return;
        const t = window.setTimeout(() => {
            const rows: DraftRow[] = Object.entries(edits).map(([studentId, values]) => ({ studentId, ...values }));
            if (rows.length > 0) {
                const at = saveDraft(examId, rows);
                if (at) setLastDraftAt(at);
            } else {
                clearDraft(examId);
                setLastDraftAt(null);
            }
        }, 500);
        return () => window.clearTimeout(t);
    }, [edits, examId]);

    /* ── Connectivity + flush of marks queued while offline ── */
    useEffect(() => {
        setOffline(!isOnline());
        const syncNow = async () => {
            const result = await flushQueue();
            setPendingSync(pendingCountForExam(examId));
            if (result.sent > 0) {
                await refreshSaved();
                flash({ tone: 'success', text: `Synced ${result.sent} batch${result.sent !== 1 ? 'es' : ''} of marks that were saved offline.` });
            }
        };
        const handleOnline = () => { setOffline(false); void syncNow(); };
        const handleOffline = () => setOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        if (isOnline()) void syncNow();
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [examId, refreshSaved, flash]);

    /* ── Roster: the exam's class, sorted by name ── */
    const streamNameById = useMemo(() => new Map(streams.map(s => [s.id, s.full_name])), [streams]);
    const examStreams = useMemo(() => streams.filter(s => s.grade_id === gradeId), [streams, gradeId]);
    const showStreamColumn = !gradeStreamId && examStreams.length > 1;

    const learners: (MarkSheetLearner & { streamId: string | null })[] = useMemo(() => {
        const inScope = (s: ApiStudent) => gradeStreamId
            ? s.current_grade_stream_id === gradeStreamId
            : examStreams.some(st => st.id === s.current_grade_stream_id);
        return apiStudents
            .filter(inScope)
            .map(s => ({
                id: s.id,
                name: `${s.users?.first_name ?? ''} ${s.users?.last_name ?? ''}`.trim() || 'Unnamed learner',
                admissionNumber: s.admission_number ?? '',
                streamId: s.current_grade_stream_id,
                streamName: showStreamColumn && s.current_grade_stream_id ? streamNameById.get(s.current_grade_stream_id) ?? null : null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [apiStudents, gradeStreamId, examStreams, showStreamColumn, streamNameById]);

    /* ── Grading: the teacher's pick, else the subject default, else the level's systems ── */
    const academicLevelId = grades.find(g => g.id === gradeId)?.academic_level_id ?? null;
    const selectableGradingSystems = useMemo(
        () => (academicLevelId ? gradingSystems.filter(sys => sys.academic_level_id === academicLevelId) : gradingSystems),
        [gradingSystems, academicLevelId],
    );
    const assignedSystem = subjectGradingSystemId ? gradingSystems.find(sys => sys.id === subjectGradingSystemId) ?? null : null;
    const activeSystem = manualGradingSystemId ? gradingSystems.find(sys => sys.id === manualGradingSystemId) ?? null : assignedSystem;
    const relevantSystems = useMemo(
        () => (activeSystem ? [activeSystem] : selectableGradingSystems),
        [activeSystem, selectableGradingSystems],
    );
    const relevantScales = useMemo(
        () => relevantSystems.flatMap(sys => gradingScales.filter(sc => sc.grading_system_id === sys.id)),
        [relevantSystems, gradingScales],
    );
    const groupedGrades: [string, GradeOption[]][] = useMemo(
        () => relevantSystems
            .map((sys): [string, GradeOption[]] => [
                sys.name,
                gradingScales
                    .filter(sc => sc.grading_system_id === sys.id)
                    .map(sc => ({ symbol: sc.symbol, label: sc.label ?? '', systemName: sys.name })),
            ])
            .filter(([, options]) => options.length > 0),
        [relevantSystems, gradingScales],
    );

    const linkGradingSystemToSubject = async (systemId: string) => {
        if (!subjectId) return;
        setSavingGradingSystemLink(true);
        setGradingSystemLinkMsg('');
        try {
            const res = await fetch('/api/admin/academic-structure', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'subject', id: subjectId, grading_system_id: systemId }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            setSubjectGradingSystemId(systemId);
            setGradingSystemLinkMsg('Saved — this subject will use this grading system automatically from now on.');
        } catch (err) {
            setGradingSystemLinkMsg(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSavingGradingSystemLink(false);
        }
    };

    /* ── Scores → percentage → grade ── */
    const composite = useCallback((values: EntryValues) => calculateCompositeSubjectScore(
        components.map(c => {
            const text = (values.componentScores[c.id] ?? '').trim();
            return { componentId: c.id, code: c.component_code, maxScore: Number(c.max_score), score: text === '' ? null : Number(text), displayOrder: c.display_order };
        }),
        scheme?.aggregation_method ?? 'sum_then_percentage',
    ), [components, scheme?.aggregation_method]);

    const percentageOf = useCallback((values: EntryValues): number | null => {
        if (!hasScore(values, components) || validateEntry(values, maxScore, components)) return null;
        if (components.length > 0) return composite(values).finalPercentage;
        return maxScore > 0 ? (Number(values.score) / maxScore) * 100 : null;
    }, [components, composite, maxScore]);

    const resolveGrade = useCallback((pct: number): string => {
        // Round first so a percentage between integer-bounded bands resolves
        // the same way as the shared getGradeFromScales helper.
        const rounded = Math.round(pct);
        return relevantScales.find(sc => rounded >= sc.min_percentage && rounded <= sc.max_percentage)?.symbol ?? '';
    }, [relevantScales]);

    const withAutoGrade = useCallback((values: EntryValues): EntryValues => {
        if (values.gradeOverridden) return values;
        const pct = percentageOf(values);
        return { ...values, grade: pct === null ? '' : resolveGrade(pct) };
    }, [percentageOf, resolveGrade]);

    /* ── Editing ── */
    const valuesFor = useCallback(
        (studentId: string): EntryValues => edits[studentId] ?? saved[studentId] ?? emptyEntry(),
        [edits, saved],
    );

    const change = (studentId: string, update: (v: EntryValues) => EntryValues) => {
        setEdits(prev => ({ ...prev, [studentId]: update(prev[studentId] ?? saved[studentId] ?? emptyEntry()) }));
    };

    const undo = (studentId: string) => {
        setEdits(prev => {
            const next = { ...prev };
            delete next[studentId];
            return next;
        });
    };

    const discardAll = () => {
        if (!window.confirm('Discard every unsaved change on this sheet? Saved marks are not affected.')) return;
        setEdits({});
        setRestoredDraft(false);
    };

    /* ── Derived rows ── */
    const rows = useMemo(() => learners.map(learner => {
        const values = valuesFor(learner.id);
        const status = rowStatus(saved[learner.id], edits[learner.id], components);
        // Only rows about to be saved can be wrong; a saved row was checked by the server.
        const editing = status === 'new' || status === 'changed';
        let error = editing ? validateEntry(values, maxScore, components) : null;
        if (!error && editing && !values.grade) {
            error = groupedGrades.length > 0 ? 'No grade matches this score — pick one' : 'No grading system is set up for this subject — ask your admin';
        }
        const finalPercentage = components.length > 0 && hasScore(values, components) && !error ? composite(values).finalPercentage : null;
        const incompletePapers = components.length > 0 && hasScore(values, components)
            && components.some(c => (values.componentScores[c.id] ?? '').trim() === '');
        return { learner, values, status, error, finalPercentage, incompletePapers };
    }), [learners, valuesFor, saved, edits, components, maxScore, groupedGrades.length, composite]);

    const counts = useMemo(() => {
        let entered = 0, unsaved = 0, invalid = 0, removals = 0;
        for (const r of rows) {
            if (r.status === 'saved' || r.status === 'changed' || r.status === 'new') entered++;
            if (UNSAVED.has(r.status)) unsaved++;
            if (r.status === 'removing') removals++;
            if (r.error) invalid++;
        }
        return { total: rows.length, entered, unsaved, invalid, removals, todo: rows.length - entered };
    }, [rows]);

    const visibleRows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter(r => {
            if (streamFilter && r.learner.streamId !== streamFilter) return false;
            if (q && !r.learner.name.toLowerCase().includes(q) && !r.learner.admissionNumber.toLowerCase().includes(q)) return false;
            switch (filter) {
                case 'todo': return r.status === 'empty' || r.status === 'removing';
                case 'entered': return r.status === 'saved' || r.status === 'changed' || r.status === 'new';
                case 'unsaved': return UNSAVED.has(r.status);
                default: return true;
            }
        });
    }, [rows, query, filter, streamFilter]);

    /* ── Keyboard: Enter / arrows move down the same score column ── */
    const handleScoreKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, column: string) => {
        if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-score-col="${column}"]`));
        const idx = inputs.indexOf(e.currentTarget);
        const next = e.key === 'ArrowUp' ? inputs[idx - 1] : inputs[idx + 1];
        next?.focus();
    };

    /* ── Save ── */
    const buildPayloadRow = (studentId: string, values: EntryValues) => {
        const remarks = values.remarks.trim() || null;
        if (components.length > 0) {
            const scores: Record<string, number> = {};
            for (const c of components) {
                const text = (values.componentScores[c.id] ?? '').trim();
                if (text !== '') scores[c.id] = Number(text);
            }
            const pct = composite(values).finalPercentage;
            return {
                exam_id: examId, student_id: studentId,
                raw_score: maxScore > 0 ? Math.round((pct / 100) * maxScore * 100) / 100 : 0,
                percentage: pct, grade_symbol: values.grade, remarks, components: scores,
            };
        }
        const score = Number(values.score);
        return {
            exam_id: examId, student_id: studentId, raw_score: score,
            percentage: maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0,
            grade_symbol: values.grade, remarks,
        };
    };

    /** Move the given edits into `saved` (with ids when the server returned them) and drop them from `edits`. */
    const commit = (upserted: { studentId: string; values: EntryValues }[], ids: Map<string, string>, removed: string[]) => {
        setSaved(prev => {
            const next = { ...prev };
            for (const { studentId, values } of upserted) {
                next[studentId] = { ...values, gradeOverridden: false, id: ids.get(studentId) ?? prev[studentId]?.id };
            }
            for (const studentId of removed) delete next[studentId];
            return next;
        });
        const done = new Set([...upserted.map(u => u.studentId), ...removed]);
        setEdits(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !done.has(id))));
    };

    const handleSave = async () => {
        if (saving) return;
        const pending = rows.filter(r => UNSAVED.has(r.status));
        if (pending.length === 0) {
            flash({ tone: 'info', text: 'Nothing to save — every mark on this sheet is already saved.' });
            return;
        }
        const invalid = pending.filter(r => r.error);
        if (invalid.length > 0) {
            setFilter('unsaved');
            flash({ tone: 'error', text: `${invalid.length} row${invalid.length !== 1 ? 's need' : ' needs'} fixing before saving — they are highlighted in red.` });
            return;
        }

        const upserts = pending.filter(r => r.status === 'new' || r.status === 'changed');
        const removals = pending.filter(r => r.status === 'removing');
        if (removals.length > 0) {
            const names = removals.slice(0, 3).map(r => r.learner.name).join(', ') + (removals.length > 3 ? ` and ${removals.length - 3} more` : '');
            if (!window.confirm(`Remove the saved mark for ${names}? This cannot be undone.`)) return;
        }

        setSaving(true);
        setNotice(null);
        const marks = upserts.map(r => buildPayloadRow(r.learner.id, r.values));
        const upserted = upserts.map(r => ({ studentId: r.learner.id, values: r.values }));
        const payload = { exam_id: examId, marks };

        const queueOffline = (reason: string) => {
            if (marks.length > 0) {
                enqueueBatch({ examId, payload, label: `${marks.length} marks` });
                setPendingSync(pendingCountForExam(examId));
                commit(upserted, new Map(), []);
            }
            flash({
                tone: removals.length > 0 ? 'error' : 'info',
                text: `${reason} — ${marks.length} mark${marks.length !== 1 ? 's' : ''} kept on this device and will sync automatically.`
                    + (removals.length > 0 ? ' Removing marks needs a connection; try again once you are back online.' : ''),
            }, 6000);
        };

        try {
            if (!isOnline()) { queueOffline('You are offline'); return; }

            const ids = new Map<string, string>();
            if (marks.length > 0) {
                const res = await fetch('/api/school/exam-marks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const result = (await res.json()) as { data?: SavedRowResponse[]; error?: string };
                if (!res.ok) {
                    flash({ tone: 'error', text: result.error || 'The marks could not be saved. Please try again.' });
                    return;
                }
                for (const row of result.data ?? []) ids.set(row.student_id, row.id);
            }

            const removed: string[] = [];
            const failedRemovals: string[] = [];
            for (const r of removals) {
                const id = saved[r.learner.id]?.id;
                if (!id) { failedRemovals.push(r.learner.name); continue; }
                const res = await fetch(`/api/school/exam-marks?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
                if (res.ok) removed.push(r.learner.id); else failedRemovals.push(r.learner.name);
            }

            commit(upserted, ids, removed);
            setRestoredDraft(false);
            if (failedRemovals.length > 0) {
                flash({ tone: 'error', text: `Saved, but could not remove the mark for ${failedRemovals.join(', ')}. Refresh and try again.` });
            } else {
                const parts = [
                    upserts.length > 0 && `${upserts.length} mark${upserts.length !== 1 ? 's' : ''} saved`,
                    removed.length > 0 && `${removed.length} removed`,
                ].filter(Boolean);
                flash({ tone: 'success', text: `${parts.join(' · ')}.` });
            }
            if (filter === 'unsaved') setFilter('all');
        } catch {
            // Dropped connection mid-request: queue the upserts rather than lose
            // them. The server upserts, so a resend is safe if part landed.
            queueOffline('Network problem');
        } finally {
            setSaving(false);
        }
    };

    // Ctrl/Cmd + S saves the sheet.
    const saveRef = useRef(handleSave);
    useEffect(() => { saveRef.current = handleSave; });
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void saveRef.current();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    /* ── Layout ── */
    // [track, narrowest width in rem]. The narrowest widths add up to the
    // sheet's minimum width: below it the sheet scrolls sideways inside its
    // card instead of being cut off by the page (which hides horizontal overflow).
    const columns: [string, number][] = [
        ['2rem', 2],
        ['minmax(12rem, 1.6fr)', 12],
        ...(components.length > 0
            ? [...components.map((): [string, number] => ['5rem', 5]), ['4.5rem', 4.5] as [string, number]]
            : [['6rem', 6] as [string, number]]),
        ['7rem', 7],
        ['minmax(7rem, 1fr)', 7],
        ['9.5rem', 9.5],
    ];
    const sheetCols = columns.map(([track]) => track).join(' ');
    const COLUMN_GAP_REM = 0.75;
    const ROW_PADDING_REM = 2.5;
    const sheetMinWidth = `${columns.reduce((sum, [, min]) => sum + min, 0) + COLUMN_GAP_REM * (columns.length - 1) + ROW_PADDING_REM}rem`;
    const progress = counts.total > 0 ? Math.round((counts.entered / counts.total) * 100) : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card p-10 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" aria-hidden /> Loading the class list and saved marks…
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-600 dark:text-red-400">
                <p className="font-semibold">The mark sheet could not be loaded.</p>
                <p className="mt-1">{loadError}</p>
            </div>
        );
    }

    return (
        <section className="rounded-2xl border border-border/70 bg-card shadow-sm" aria-label="Mark sheet">
            {/* ── Header: progress + connection ── */}
            <header className="flex flex-col gap-4 border-b border-border/60 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="font-display text-lg font-bold tracking-tight">Mark sheet</h3>
                        <span className="text-sm text-muted-foreground">
                            <strong className={cn('tabular-nums', progress === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>{counts.entered}</strong> of <span className="tabular-nums">{counts.total}</span> entered
                            {counts.total > 0 && <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', progress === 100 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-blue-500/10 text-blue-700 dark:text-blue-400')}>{progress}%</span>}
                            {' · '}
                            {components.length > 0
                                ? <>Papers {components.map(c => `${c.component_code}/${Number(c.max_score)}`).join(' + ')}</>
                                : <>Out of {maxScore}</>}
                        </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Marks entered">
                        <div className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-500', progress === 100 ? 'from-emerald-500 to-teal-400' : 'from-blue-500 to-violet-500')} style={{ width: `${progress}%` }} />
                    </div>
                </div>
                <div className="flex flex-col items-start gap-1 md:items-end">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                            offline ? 'border-amber-500/30 bg-amber-500/10 text-amber-600' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                        )}
                    >
                        {offline ? <CloudOff size={13} aria-hidden /> : <Cloud size={13} aria-hidden />}
                        {offline ? 'Offline — keeping marks on this device' : 'Online'}
                    </span>
                    {pendingSync > 0 && (
                        <span className="text-[11px] text-amber-600">{pendingSync} batch{pendingSync !== 1 ? 'es' : ''} waiting to sync</span>
                    )}
                    {lastDraftAt && counts.unsaved > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                            Unsaved changes kept on this device · {new Date(lastDraftAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
            </header>

            {/* ── How to correct a mark: said once, where the teacher is looking ── */}
            <div className="flex items-start gap-2 border-b border-border/60 bg-primary/[0.04] px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                <Info size={14} className="mt-px shrink-0 text-primary" aria-hidden />
                <p>
                    Saved marks are already filled in. <strong className="text-foreground">To correct a mistake</strong>, search for the learner, type the right score over the old one and press <strong className="text-foreground">Save changes</strong>.
                    Use <strong className="text-foreground">Undo</strong> to put a mark back, or the bin to remove a mark for a learner who did not sit the exam.
                </p>
            </div>

            {restoredDraft && counts.unsaved > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300 sm:px-5">
                    <span>We brought back {counts.unsaved} unsaved change{counts.unsaved !== 1 ? 's' : ''} from your last visit on this device.</span>
                    <button type="button" onClick={discardAll} className="font-semibold underline-offset-2 hover:underline">Discard them</button>
                </div>
            )}

            {/* ── Toolbar: find a learner, filter, grading system ── */}
            <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-72">
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <input
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Find a learner by name or adm. no."
                            aria-label="Find a learner"
                            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        {query && (
                            <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Clear search">
                                <X size={14} aria-hidden />
                            </button>
                        )}
                    </div>
                    {showStreamColumn && (
                        <select
                            value={streamFilter}
                            onChange={e => setStreamFilter(e.target.value)}
                            aria-label="Filter by stream"
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="">All streams</option>
                            {examStreams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                    )}
                </div>

                <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:pb-0" role="tablist" aria-label="Show">
                    {FILTERS.map(f => {
                        const count = f.id === 'all' ? counts.total : f.id === 'todo' ? counts.todo : f.id === 'entered' ? counts.entered : counts.unsaved;
                        const active = filter === f.id;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setFilter(f.id)}
                                className={cn(
                                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                                    active ? f.active : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )}
                            >
                                {f.label}
                                <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-white/25 text-inherit' : f.count)}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectableGradingSystems.length > 1 || (!activeSystem && selectableGradingSystems.length > 0) || (isAdmin && activeSystem && activeSystem.id !== subjectGradingSystemId) ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5 text-xs sm:px-5">
                    <label htmlFor={`grading-${examId}`} className="text-muted-foreground">Grading system</label>
                    <select
                        id={`grading-${examId}`}
                        className="h-9 min-w-[12rem] rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                        value={activeSystem?.id ?? ''}
                        onChange={e => setManualGradingSystemId(e.target.value || null)}
                    >
                        {!activeSystem && <option value="">Several match — pick one</option>}
                        {selectableGradingSystems.map(sys => (
                            <option key={sys.id} value={sys.id}>{sys.name}{sys.id === subjectGradingSystemId ? ' (subject default)' : ''}</option>
                        ))}
                    </select>
                    {isAdmin && subjectId && activeSystem && activeSystem.id !== subjectGradingSystemId && (
                        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => linkGradingSystemToSubject(activeSystem.id)} disabled={savingGradingSystemLink}>
                            {savingGradingSystemLink ? 'Saving…' : 'Save as subject default'}
                        </button>
                    )}
                    {gradingSystemLinkMsg && <span className="w-full text-muted-foreground">{gradingSystemLinkMsg}</span>}
                </div>
            ) : null}

            {notice && (
                <div
                    role={notice.tone === 'error' ? 'alert' : 'status'}
                    className={cn(
                        'flex items-start gap-2 border-b px-4 py-2.5 text-sm sm:px-5',
                        notice.tone === 'success' && 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                        notice.tone === 'error' && 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400',
                        notice.tone === 'info' && 'border-border/60 bg-muted/50 text-foreground',
                    )}
                >
                    {notice.tone === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden /> : <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />}
                    <span className="flex-1">{notice.text}</span>
                    <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss"><X size={14} aria-hidden /></button>
                </div>
            )}

            {/* ── The sheet ── */}
            {learners.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                    {rosterMode === 'enrolled' ? (
                        <>Nobody in this class is enrolled in this subject yet, so there is no one to enter marks for. An admin sets who takes it on the <strong>Subjects</strong> page (Placement tab, or &ldquo;who takes this&rdquo; on the subject).</>
                    ) : (
                        <>No learners found in this class. Add learners on the <strong>People</strong> page first.</>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto">
                <div role="table" aria-label="Marks" className="lg:min-w-[var(--sheet-min)]" style={{ '--sheet-cols': sheetCols, '--sheet-min': sheetMinWidth } as React.CSSProperties}>
                    <div role="row" className="hidden gap-3 border-b border-border/60 bg-muted/40 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:[grid-template-columns:var(--sheet-cols)]">
                        <span role="columnheader">#</span>
                        <span role="columnheader">Learner</span>
                        {components.length > 0 ? (
                            <>
                                {components.map(c => <span key={c.id} role="columnheader" title={c.component_name}>{c.component_code} <span className="font-normal normal-case opacity-70">/{Number(c.max_score)}</span></span>)}
                                <span role="columnheader">Final</span>
                            </>
                        ) : (
                            <span role="columnheader">Score <span className="font-normal normal-case opacity-70">/{maxScore}</span></span>
                        )}
                        <span role="columnheader">Grade</span>
                        <span role="columnheader">Remarks</span>
                        <span role="columnheader" className="text-right">Status</span>
                    </div>

                    {visibleRows.length === 0 ? (
                        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                            {query ? <>No learner matches &ldquo;{query}&rdquo;.</> : filter === 'unsaved' ? 'No unsaved changes.' : filter === 'todo' ? 'Everyone has a mark. 🎉' : 'Nothing to show.'}
                        </div>
                    ) : visibleRows.map((r, i) => (
                        <MarkSheetRow
                            key={r.learner.id}
                            index={i}
                            learner={r.learner}
                            values={r.values}
                            status={r.status}
                            error={r.error}
                            finalPercentage={r.finalPercentage}
                            incompletePapers={r.incompletePapers}
                            maxScore={maxScore}
                            components={components}
                            groupedGrades={groupedGrades}
                            onScore={value => change(r.learner.id, v => withAutoGrade({ ...v, score: value }))}
                            onPaper={(componentId, value) => change(r.learner.id, v => withAutoGrade({ ...v, componentScores: { ...v.componentScores, [componentId]: value } }))}
                            onGrade={value => change(r.learner.id, v => (value ? { ...v, grade: value, gradeOverridden: true } : withAutoGrade({ ...v, gradeOverridden: false })))}
                            onRemarks={value => change(r.learner.id, v => ({ ...v, remarks: value }))}
                            onUndo={() => undo(r.learner.id)}
                            onRemove={() => change(r.learner.id, () => emptyEntry())}
                            onScoreKeyDown={handleScoreKeyDown}
                        />
                    ))}
                </div>
                </div>
            )}

            {/* ── Save bar: sticks to the bottom (above the phone nav) while there is something to save ── */}
            {learners.length > 0 && (
                <div
                    className={cn(
                        'sticky bottom-[calc(64px_+_env(safe-area-inset-bottom))] z-30 flex flex-col gap-3 rounded-b-2xl border-t border-border/60 bg-card/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5 md:bottom-0',
                        counts.unsaved > 0 && 'shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)]',
                    )}
                >
                    <p className="text-sm text-muted-foreground">
                        {counts.unsaved > 0 ? (
                            <>
                                <strong className="text-foreground">{counts.unsaved} unsaved change{counts.unsaved !== 1 ? 's' : ''}</strong>
                                {counts.removals > 0 && <> · {counts.removals} to remove</>}
                                {counts.invalid > 0 && <span className="text-red-600 dark:text-red-400"> · {counts.invalid} to fix</span>}
                                <span className="hidden lg:inline"> · Enter moves down · Ctrl+S saves</span>
                            </>
                        ) : (
                            <>All changes saved{counts.todo > 0 ? ` · ${counts.todo} learner${counts.todo !== 1 ? 's' : ''} still without a mark` : ''}</>
                        )}
                    </p>
                    <div className="flex gap-2">
                        {counts.unsaved > 0 && (
                            <button type="button" onClick={discardAll} className="btn-secondary flex-1 justify-center px-4 py-2 sm:flex-none">
                                Discard
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving || counts.unsaved === 0}
                            className="btn-primary flex-1 justify-center gap-2 px-5 py-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
                            {saving ? 'Saving…' : counts.unsaved > 0 ? `Save changes (${counts.unsaved})` : 'Saved'}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
