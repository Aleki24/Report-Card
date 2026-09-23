import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { clearDraft, loadDraft, saveDraft } from '@/lib/drafts';
import { compositePercentage, gradeFromPercentage, isMultiPaper, scalesForSubject } from '@/lib/academics';
import { errorMessage, formatDate, pluralize, scoreColor } from '@/lib/format';
import { colors, radius, spacing } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, LoadingView, Notice, SearchField, TextField,
} from '@/components/ui';
import { PaperSetup } from './PaperSetup';
import type { AcademicStructure, ExamMark, ExamPaperScheme, ExamSlot, MarkEntryInput, StudentListItem } from '@/lib/types';

interface Entry {
    score: string;
    papers: Record<string, string>;
    grade: string;
    gradeManual: boolean;
    remarks: string;
}

type Entries = Record<string, Entry>;

const ALL_STREAMS = '__all__';

function entryFromMark(mark: ExamMark | undefined): Entry {
    return {
        score: mark ? String(mark.raw_score) : '',
        papers: Object.fromEntries(Object.entries(mark?.components ?? {}).map(([k, v]) => [k, String(v)])),
        grade: mark?.grade_symbol ?? '',
        gradeManual: false,
        remarks: mark?.remarks ?? '',
    };
}

function isBlank(v: string | undefined): boolean {
    return v === undefined || v.trim() === '';
}

export function MarkEntry({ exam, structure }: { exam: ExamSlot; structure: AcademicStructure | null }) {
    const api = useApi();
    const draftKey = `marks-${exam.id}`;

    const students = useApiQuery<StudentListItem[]>(withQuery('/api/school/data', { type: 'students', subject_id: exam.subject_id }));
    const marks = useApiQuery<ExamMark[]>(`/api/school/exam-marks?exam_id=${exam.id}`);
    const schemeQuery = useApiQuery<ExamPaperScheme | null>(`/api/school/exams/${exam.id}/components`);
    const scheme = isMultiPaper(schemeQuery.data) ? schemeQuery.data : null;
    const papers = useMemo(() => [...(scheme?.components ?? [])].sort((a, b) => a.display_order - b.display_order), [scheme]);

    const [entries, setEntries] = useState<Entries>({});
    const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
    const draftLoaded = useRef(false);
    const [stream, setStream] = useState<string>(ALL_STREAMS);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
    const [editingPapers, setEditingPapers] = useState(false);
    const inputs = useRef<Record<string, TextInput | null>>({});

    // ── Grading: the subject's own system, else the level's subject systems ──
    const scales = useMemo(() => {
        const levelId = structure?.grades?.find((g) => g.id === exam.grade_id)?.academic_level_id ?? null;
        const subjectSystemId = structure?.subjects?.find((s) => s.id === exam.subject_id)?.grading_system_id ?? null;
        return scalesForSubject(structure?.grading_systems ?? [], structure?.grading_scales ?? [], levelId, subjectSystemId);
    }, [structure, exam.grade_id, exam.subject_id]);
    const gradeOptions = useMemo(() => [...new Set(scales.map((s) => s.symbol))], [scales]);

    // ── Roster: the exam's stream, or every stream in its grade ──
    const roster = useMemo(() => {
        const list = (students.data ?? []).filter((s) =>
            exam.grade_stream_id ? s.current_grade_stream_id === exam.grade_stream_id : s.grade_streams?.grade_id === exam.grade_id,
        );
        return list.sort((a, b) => `${a.users?.first_name} ${a.users?.last_name}`.localeCompare(`${b.users?.first_name} ${b.users?.last_name}`));
    }, [students.data, exam.grade_stream_id, exam.grade_id]);

    const streams = useMemo(() => {
        const map = new Map<string, string>();
        for (const s of roster) if (s.grade_streams) map.set(s.grade_streams.id, s.grade_streams.full_name);
        return [...map.entries()].map(([value, label]) => ({ value, label }));
    }, [roster]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return roster.filter((s) => {
            if (stream !== ALL_STREAMS && s.current_grade_stream_id !== stream) return false;
            if (!q) return true;
            return `${s.users?.first_name} ${s.users?.last_name} ${s.admission_number}`.toLowerCase().includes(q);
        });
    }, [roster, stream, search]);

    const marksByStudent = useMemo(() => new Map((marks.data ?? []).map((m) => [m.student_id, m])), [marks.data]);

    // ── Drafts: restore once, then autosave what has been typed ──
    useEffect(() => {
        if (draftLoaded.current) return;
        draftLoaded.current = true;
        void loadDraft<Entries>(draftKey).then((draft) => {
            if (draft && Object.keys(draft.value).length > 0) {
                setEntries((prev) => ({ ...draft.value, ...prev }));
                setDraftSavedAt(draft.savedAt);
                setMessage({ tone: 'info', text: `Restored ${pluralize(Object.keys(draft.value).length, 'unsaved mark')} from this device.` });
            }
        });
    }, [draftKey]);

    useEffect(() => {
        if (!draftLoaded.current) return;
        const t = setTimeout(() => {
            if (Object.keys(entries).length === 0) {
                clearDraft(draftKey);
                setDraftSavedAt(null);
            } else {
                setDraftSavedAt(saveDraft(draftKey, entries));
            }
        }, 600);
        return () => clearTimeout(t);
    }, [entries, draftKey]);

    const current = useCallback((studentId: string): Entry => entries[studentId] ?? entryFromMark(marksByStudent.get(studentId)), [entries, marksByStudent]);

    const percentFor = useCallback(
        (e: Entry): number | null => {
            if (scheme) {
                const c = compositePercentage(scheme, e.papers);
                return c.entered > 0 ? c.percentage : null;
            }
            if (isBlank(e.score)) return null;
            const n = Number(e.score);
            return Number.isNaN(n) ? null : (n / (exam.max_score || 100)) * 100;
        },
        [scheme, exam.max_score],
    );

    const errorFor = useCallback(
        (e: Entry): string | null => {
            if (scheme) {
                for (const p of papers) {
                    const v = e.papers[p.id];
                    if (isBlank(v)) continue;
                    const n = Number(v);
                    if (Number.isNaN(n) || n < 0 || n > Number(p.max_score)) return `${p.component_code} must be 0–${p.max_score}`;
                }
                return null;
            }
            if (isBlank(e.score)) return null;
            const n = Number(e.score);
            if (Number.isNaN(n)) return 'Score must be a number';
            if (n < 0 || n > exam.max_score) return `Score must be 0–${exam.max_score}`;
            return null;
        },
        [scheme, papers, exam.max_score],
    );

    const update = (studentId: string, patch: (e: Entry) => Entry) => {
        setEntries((prev) => {
            const next = patch(prev[studentId] ?? entryFromMark(marksByStudent.get(studentId)));
            // Auto-grade from the scale unless the teacher picked a grade by hand.
            if (!next.gradeManual) {
                const pct = percentFor(next);
                next.grade = pct === null || errorFor(next) ? '' : gradeFromPercentage(pct, scales);
            }
            return { ...prev, [studentId]: next };
        });
    };

    const focusNext = (studentId: string) => {
        const idx = visible.findIndex((s) => s.id === studentId);
        const next = visible[idx + 1];
        if (next) inputs.current[next.id]?.focus();
    };

    const hasValue = (e: Entry) => (scheme ? papers.some((p) => !isBlank(e.papers[p.id])) : !isBlank(e.score));
    const pendingIds = Object.keys(entries).filter((id) => hasValue(entries[id]));
    const invalid = pendingIds.filter((id) => errorFor(entries[id]));
    const markedCount = roster.filter((s) => marksByStudent.has(s.id)).length;

    const handleSave = async () => {
        if (pendingIds.length === 0) return;
        if (invalid.length > 0) {
            setMessage({ tone: 'danger', text: `Fix ${pluralize(invalid.length, 'score')} before saving.` });
            return;
        }
        setSaving(true);
        setMessage(null);
        const payload: MarkEntryInput[] = pendingIds.map((id) => {
            const e = entries[id];
            const base = { student_id: id, grade_symbol: e.grade, remarks: e.remarks.trim() || null };
            if (scheme) {
                const components: Record<string, number> = {};
                for (const p of papers) if (!isBlank(e.papers[p.id])) components[p.id] = Number(e.papers[p.id]);
                return { ...base, components };
            }
            return { ...base, raw_score: Number(e.score) };
        });
        try {
            await api.post('/api/school/exam-marks', { exam_id: exam.id, marks: payload });
            setEntries({});
            clearDraft(draftKey);
            setMessage({ tone: 'success', text: `Saved ${pluralize(payload.length, 'mark')}.` });
            marks.refresh();
        } catch (err) {
            // The marks stay in the draft, so nothing typed is lost.
            setMessage({ tone: 'danger', text: `${errorMessage(err, 'Could not save')}. Your marks are kept on this device — tap Save to try again.` });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (student: StudentListItem) => {
        const mark = marksByStudent.get(student.id);
        if (!mark) return;
        Alert.alert('Remove mark?', `Delete ${student.users?.first_name}'s mark for ${exam.subject_name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.del(`/api/school/exam-marks?id=${mark.id}`);
                        setEntries((prev) => {
                            const { [student.id]: _removed, ...rest } = prev;
                            return rest;
                        });
                        marks.refresh();
                    } catch (err) {
                        setMessage({ tone: 'danger', text: errorMessage(err, 'Could not remove the mark') });
                    }
                },
            },
        ]);
    };

    if (students.loading || marks.loading || schemeQuery.loading) return <LoadingView />;
    const loadError = students.error ?? marks.error ?? schemeQuery.error;

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <Text style={styles.title}>{exam.subject_name}</Text>
                <Text style={styles.sub}>
                    {exam.name} · {exam.grade_stream_name ?? exam.grade_name} · out of {scheme ? `${papers.map((p) => `${p.component_code}/${p.max_score}`).join(' + ')}` : exam.max_score}
                </Text>
                <Text style={styles.sub}>
                    {markedCount} of {pluralize(roster.length, 'learner')} marked
                    {exam.status === 'APPROVED' ? ' · released — changes show to students immediately' : ''}
                </Text>
                <ButtonRow>
                    <Button size="sm" variant="secondary" label={scheme ? 'Edit papers' : 'Set up papers (P1/P2…)'} onPress={() => setEditingPapers((v) => !v)} />
                </ButtonRow>
            </Card>

            {editingPapers ? (
                <PaperSetup
                    examId={exam.id}
                    maxScore={exam.max_score}
                    scheme={schemeQuery.data ?? null}
                    onSaved={() => {
                        setEditingPapers(false);
                        schemeQuery.reload();
                    }}
                    onCancel={() => setEditingPapers(false)}
                />
            ) : null}

            {loadError ? <ErrorBanner message={loadError} onRetry={() => { students.reload(); marks.reload(); }} /> : null}
            {message ? <Notice message={message.text} tone={message.tone} onDismiss={() => setMessage(null)} /> : null}
            {scales.length === 0 ? (
                <Notice tone="warning" message="No grading system is set for this subject, so grades can't be worked out automatically. Pick a grade per learner, or ask your admin to set one." />
            ) : null}

            {streams.length > 1 && !exam.grade_stream_id ? (
                <ChipSelect options={[{ value: ALL_STREAMS, label: 'All streams' }, ...streams]} value={stream} onChange={setStream} />
            ) : null}
            {roster.length > 12 ? <SearchField value={search} onChangeText={setSearch} placeholder="Find a learner" /> : null}

            {roster.length === 0 ? (
                <EmptyState title="No learners to mark" description="No students in this class take this subject yet." />
            ) : (
                <View style={styles.list}>
                    {visible.map((s) => {
                        const e = current(s.id);
                        const pct = percentFor(e);
                        const err = errorFor(e);
                        const saved = marksByStudent.get(s.id);
                        const isDirty = s.id in entries;
                        const open = expanded === s.id;
                        return (
                            <View key={s.id} style={[styles.row, isDirty && styles.rowDirty]}>
                                <View style={styles.rowMain}>
                                    <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => setExpanded(open ? null : s.id)}>
                                        <Text style={styles.name} numberOfLines={1}>
                                            {s.users?.first_name} {s.users?.last_name}
                                        </Text>
                                        <Text style={styles.adm}>
                                            {s.admission_number ?? '—'}
                                            {saved && !isDirty ? ' · saved' : isDirty ? ' · unsaved' : ''}
                                        </Text>
                                    </Pressable>
                                    {scheme ? null : (
                                        <TextInput
                                            ref={(r) => {
                                                inputs.current[s.id] = r;
                                            }}
                                            value={e.score}
                                            onChangeText={(v) => update(s.id, (prev) => ({ ...prev, score: v }))}
                                            keyboardType="decimal-pad"
                                            returnKeyType="next"
                                            blurOnSubmit={false}
                                            onSubmitEditing={() => focusNext(s.id)}
                                            placeholder={`/${exam.max_score}`}
                                            placeholderTextColor={colors.muted}
                                            style={[styles.scoreInput, err ? { borderColor: colors.danger } : null]}
                                            accessibilityLabel={`Score for ${s.users?.first_name}`}
                                        />
                                    )}
                                    <View style={styles.gradeBox}>
                                        <Text style={[styles.grade, { color: scoreColor(pct) }]}>{e.grade || '—'}</Text>
                                        <Text style={styles.pct}>{pct === null ? '' : `${Math.round(pct)}%`}</Text>
                                    </View>
                                </View>

                                {scheme ? (
                                    <View style={styles.papers}>
                                        {papers.map((p, i) => (
                                            <View key={p.id} style={styles.paper}>
                                                <Text style={styles.paperLabel}>{p.component_code}/{p.max_score}</Text>
                                                <TextInput
                                                    ref={i === 0 ? (r) => { inputs.current[s.id] = r; } : undefined}
                                                    value={e.papers[p.id] ?? ''}
                                                    onChangeText={(v) => update(s.id, (prev) => ({ ...prev, papers: { ...prev.papers, [p.id]: v } }))}
                                                    keyboardType="decimal-pad"
                                                    style={styles.paperInput}
                                                    accessibilityLabel={`${p.component_name} for ${s.users?.first_name}`}
                                                />
                                            </View>
                                        ))}
                                    </View>
                                ) : null}

                                {err ? <Text style={styles.error}>{err}</Text> : null}

                                {open ? (
                                    <View style={styles.details}>
                                        {gradeOptions.length > 0 ? (
                                            <ChipSelect
                                                label="Grade (override)"
                                                options={gradeOptions.map((g) => ({ value: g, label: g }))}
                                                value={e.grade || null}
                                                onChange={(g) => update(s.id, (prev) => ({ ...prev, grade: g, gradeManual: true }))}
                                            />
                                        ) : (
                                            <TextField
                                                label="Grade"
                                                value={e.grade}
                                                onChangeText={(g) => update(s.id, (prev) => ({ ...prev, grade: g.toUpperCase(), gradeManual: true }))}
                                                autoCapitalize="characters"
                                            />
                                        )}
                                        <TextField label="Remarks" value={e.remarks} onChangeText={(v) => update(s.id, (prev) => ({ ...prev, remarks: v }))} placeholder="Optional" />
                                        <ButtonRow>
                                            {e.gradeManual ? (
                                                <Button size="sm" variant="ghost" label="Auto grade" onPress={() => update(s.id, (prev) => ({ ...prev, gradeManual: false }))} />
                                            ) : null}
                                            {isDirty ? (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    label="Undo changes"
                                                    onPress={() =>
                                                        setEntries((prev) => {
                                                            const { [s.id]: _undo, ...rest } = prev;
                                                            return rest;
                                                        })
                                                    }
                                                />
                                            ) : null}
                                            {saved ? <Button size="sm" variant="danger" label="Remove mark" onPress={() => handleDelete(s)} /> : null}
                                        </ButtonRow>
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}
                </View>
            )}

            <View style={styles.saveBar}>
                <Text style={styles.sub}>
                    {pendingIds.length > 0
                        ? `${pluralize(pendingIds.length, 'unsaved mark')}${draftSavedAt ? ` · kept on device ${formatDate(new Date(draftSavedAt), { hour: '2-digit', minute: '2-digit' })}` : ''}`
                        : 'All changes saved'}
                </Text>
                <Button label={saving ? 'Saving…' : `Save ${pendingIds.length || ''}`.trim()} onPress={handleSave} loading={saving} disabled={pendingIds.length === 0} />
            </View>
            {invalid.length > 0 ? <Badge label={`${invalid.length} invalid`} variant="danger" /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 17, fontWeight: '800', color: colors.foreground },
    sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card },
    row: { padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    rowDirty: { backgroundColor: colors.infoBg },
    rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    adm: { fontSize: 11, color: colors.muted, marginTop: 2 },
    scoreInput: { width: 72, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.foreground, backgroundColor: colors.card },
    gradeBox: { width: 48, alignItems: 'center' },
    grade: { fontSize: 15, fontWeight: '800' },
    pct: { fontSize: 10, color: colors.muted },
    papers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    paper: { alignItems: 'center', gap: 2 },
    paperLabel: { fontSize: 10, fontWeight: '700', color: colors.muted },
    paperInput: { width: 64, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.foreground, backgroundColor: colors.card },
    error: { fontSize: 12, color: colors.danger, marginTop: 4 },
    details: { marginTop: spacing.md },
    saveBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.lg },
});
