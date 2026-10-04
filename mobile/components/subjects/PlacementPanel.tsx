import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MATHS_CODES, MATHS_LABELS, SENIOR_CORE_SUBJECT_CODES, type MathsCode } from '@shared/pathway-definitions';
import type { ElectivePlacementResponse, PlacementResponse, SeniorLearnerRow, SeniorPlacementResponse } from '@shared/pathway/placement';
import {
    MATHS_DEFAULT_NOTE, choiceLabel, initialDraft, ministryChoiceOptions, placeableStreams, placedMessage, schoolChoiceOptions,
    seniorPlacements, suggestionCounts, suggestionOption,
    type SeniorDraft,
} from '@shared/pathway/placement-ui';
import { Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, LoadingView, Notice, ToggleRow } from '@/components/ui';
import { SelectField } from '@/components/ops/SelectField';
import { useApi, withQuery } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { radius, spacing, fonts, useTheme } from '@/lib/theme';
import type { AcademicStructure } from '@/lib/types';

type Apply = (body: object, summary: string) => Promise<void>;
const COMPULSORY = new Set<string>(SENIOR_CORE_SUBJECT_CODES);
const MATHS_OPTIONS = [{ value: '' as const, label: 'Default' }, ...MATHS_CODES.map((c) => ({ value: c, label: MATHS_LABELS[c] }))];

function SeniorStatus({ row, draft }: { row: SeniorLearnerRow; draft: SeniorDraft }) {
    const s = row.suggestion;
    if (row.currentCombinationId && draft.choice === `existing:${row.currentCombinationId}` && !draft.include) return <Badge label="Placed" />;
    if (s.kind === 'official') return <Badge variant="success" label={`Official ${s.code}`} />;
    if (s.kind === 'custom') return <Badge variant="warning" label="Not on Ministry list" />;
    if (s.kind === 'review') return <Badge variant="danger" label={s.reason} />;
    return <Badge label="No marks yet — choose" />;
}

function SeniorTable({ data, onApply }: { data: SeniorPlacementResponse; onApply: Apply }) {
    const { colors } = useTheme();
    const [drafts, setDrafts] = useState<Record<string, SeniorDraft>>({});
    const [saving, setSaving] = useState(false);
    const offeredCodes = useMemo(() => new Set(data.offeredCodes), [data.offeredCodes]);
    const school = useMemo(() => schoolChoiceOptions(data.combinations), [data.combinations]);
    const ministry = useMemo(() => ministryChoiceOptions(data.combinations, offeredCodes).filter((o) => o.runnable), [data.combinations, offeredCodes]);

    useEffect(() => { setDrafts(Object.fromEntries(data.learners.map((l) => [l.studentId, initialDraft(l)]))); }, [data]);

    const update = (id: string, patch: Partial<SeniorDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch, include: patch.include ?? true } }));
    const setForTicked = (patch: Partial<SeniorDraft>) => setDrafts((d) => Object.fromEntries(Object.entries(d).map(([id, draft]) => [id, draft.include ? { ...draft, ...patch } : draft])));

    const ticked = data.learners.filter((l) => drafts[l.studentId]?.include);
    const chosen = ticked.filter((l) => drafts[l.studentId].choice);
    const counts = suggestionCounts(data.learners);
    const allChoices = (row: SeniorLearnerRow | null) => {
        const suggestion = row ? suggestionOption(row, data.combinations) : null;
        const rest = [...school, ...ministry].filter((o) => o.value !== suggestion?.value);
        return [...(suggestion ? [{ ...suggestion, detail: `Suggested · ${suggestion.detail}` }] : []), ...rest].map((o) => ({ id: o.value, label: `${o.code} · ${o.name}`, hint: o.detail }));
    };

    const submit = async () => {
        setSaving(true);
        try { await onApply({ mode: 'senior', placements: seniorPlacements(chosen, drafts) }, `Placed ${chosen.length} learner(s).`); }
        finally { setSaving(false); }
    };

    return (
        <View>
            <ButtonRow>
                <Badge variant="success" label={`${counts.official ?? 0} official match`} />
                <Badge variant="warning" label={`${counts.custom ?? 0} not on Ministry list`} />
                <Badge variant="danger" label={`${counts.review ?? 0} need review`} />
                <Badge label={`${counts['no-marks'] ?? 0} no marks yet`} />
            </ButtonRow>
            <Card style={{ marginVertical: spacing.md, padding: spacing.md }}>
                <ToggleRow label={ticked.length > 0 ? `${ticked.length} ticked` : 'Tick all'} value={data.learners.length > 0 && ticked.length === data.learners.length}
                    onValueChange={(on) => setDrafts((d) => Object.fromEntries(Object.entries(d).map(([id, draft]) => [id, { ...draft, include: on }])))} />
                {ticked.length > 0 ? (
                    <>
                        <SelectField label="Set combination for ticked" value="" onChange={(choice) => setForTicked({ choice })} options={allChoices(null)} />
                        <ChipSelect label="Set maths for ticked" options={MATHS_CODES.map((c) => ({ value: c, label: MATHS_LABELS[c] }))} value={null} onChange={(maths) => setForTicked({ maths })} />
                    </>
                ) : null}
            </Card>

            {data.learners.map((row) => {
                const draft = drafts[row.studentId];
                if (!draft) return null;
                const marked = row.markedSubjects.filter((m) => !COMPULSORY.has(m.code)).map((m) => m.name).join(', ');
                return (
                    <Card key={row.studentId} style={{ marginBottom: spacing.sm, padding: spacing.md, borderColor: draft.include ? colors.primary : colors.border }}>
                        <Pressable onPress={() => update(row.studentId, { include: !draft.include })} accessibilityRole="checkbox" accessibilityState={{ checked: draft.include }} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                            <View style={{ width: 22, height: 22, borderRadius: radius.sm - 2, borderWidth: 2, borderColor: colors.primary, backgroundColor: draft.include ? colors.primary : 'transparent' }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>{row.name}</Text>
                                <Text style={{ fontSize: 12, color: colors.muted }}>{row.admissionNumber} · marks in: {marked || '—'}</Text>
                            </View>
                        </Pressable>
                        <View style={{ marginTop: spacing.sm }}>
                            <SelectField
                                label="Combination"
                                placeholder={choiceLabel(draft.choice, row, data.combinations) ?? 'Choose a combination…'}
                                value={draft.choice}
                                onChange={(choice) => update(row.studentId, { choice, include: choice !== '' })}
                                options={allChoices(row)}
                            />
                            <ChipSelect label="Maths" options={MATHS_OPTIONS} value={draft.maths} onChange={(maths: MathsCode | '') => update(row.studentId, { maths })} />
                            <SeniorStatus row={row} draft={draft} />
                        </View>
                    </Card>
                );
            })}
            <Text style={{ fontSize: 12, color: colors.muted, marginVertical: spacing.sm }}>
                {ticked.length - chosen.length > 0 ? `${ticked.length - chosen.length} ticked learner(s) still need a combination. ` : ''}{MATHS_DEFAULT_NOTE}
            </Text>
            <Button label={saving ? 'Placing…' : `Place ${chosen.length} learner${chosen.length === 1 ? '' : 's'}`} loading={saving} disabled={chosen.length === 0} onPress={() => void submit()} block />
        </View>
    );
}

function ElectiveTable({ data, onApply }: { data: ElectivePlacementResponse; onApply: Apply }) {
    const { colors } = useTheme();
    const [picked, setPicked] = useState<Record<string, ReadonlySet<string>>>({});
    const [saving, setSaving] = useState(false);
    // Start from what is enrolled; a learner with no enrolments starts from their marks.
    useEffect(() => {
        setPicked(Object.fromEntries(data.learners.map((l) => [l.studentId, new Set(l.enrolledSubjectIds.length > 0 ? l.enrolledSubjectIds : l.markedSubjectIds)])));
    }, [data]);
    const same = (a: ReadonlySet<string>, b: readonly string[]) => a.size === b.length && b.every((id) => a.has(id));
    const changed = data.learners.filter((l) => picked[l.studentId] && !same(picked[l.studentId], l.enrolledSubjectIds));
    const toggle = (sid: string, subjectId: string) => setPicked((p) => {
        const next = new Set(p[sid]);
        if (next.has(subjectId)) next.delete(subjectId); else next.add(subjectId);
        return { ...p, [sid]: next };
    });

    if (data.electives.length === 0) return <EmptyState title="No 8-4-4 electives" description="Every subject is compulsory, so every student is on every mark sheet." />;

    return (
        <View>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>Tick the electives each student takes — pre-filled from the marks already recorded (• marks a subject the student has marks in).</Text>
            {data.learners.map((l) => {
                const set = picked[l.studentId] ?? new Set<string>();
                const marked = new Set(l.markedSubjectIds);
                return (
                    <Card key={l.studentId} style={{ marginBottom: spacing.sm, padding: spacing.md, borderColor: changed.includes(l) ? colors.primary : colors.border }}>
                        <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>{l.name} <Text style={{ fontFamily: fonts.regular, color: colors.muted }}>{l.admissionNumber}</Text></Text>
                        <ButtonRow>
                            {data.electives.map((e) => (
                                <Button key={e.id} size="sm" variant={set.has(e.id) ? 'primary' : 'secondary'} label={`${marked.has(e.id) ? '• ' : ''}${e.name}`} onPress={() => toggle(l.studentId, e.id)} />
                            ))}
                        </ButtonRow>
                    </Card>
                );
            })}
            <Button
                label={saving ? 'Saving…' : `Save electives for ${changed.length} student${changed.length === 1 ? '' : 's'}`}
                loading={saving}
                disabled={changed.length === 0}
                onPress={() => {
                    setSaving(true);
                    void onApply({ mode: '844', enrolments: changed.map((l) => ({ student_id: l.studentId, subject_ids: [...picked[l.studentId]] })) }, `Saved electives for ${changed.length} student(s).`)
                        .finally(() => setSaving(false));
                }}
                block
            />
        </View>
    );
}

/** Place learners into combinations (Senior School) or electives (8-4-4) from their marks — the web's Placement tab. */
export function PlacementPanel({ structure }: { structure: AcademicStructure | null }) {
    const { colors } = useTheme();
    const api = useApi();
    const streams = useMemo(
        () => placeableStreams(structure?.grades ?? [], structure?.grade_streams ?? [], structure?.academic_levels ?? []),
        [structure],
    );
    const [streamId, setStreamId] = useState('');
    const [data, setData] = useState<PlacementResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    // Only the latest request may land when classes are switched quickly.
    const latest = useRef(0);

    const load = async (id: string) => {
        const request = ++latest.current;
        setData(null);
        if (!id) return;
        setLoading(true);
        try {
            const r = await api.get<PlacementResponse>(withQuery('/api/admin/placement', { grade_stream_id: id }));
            if (request === latest.current) setData(r);
        } catch (err) {
            if (request === latest.current) setMsg({ tone: 'danger', text: errorMessage(err, 'Could not load the class') });
        } finally {
            if (request === latest.current) setLoading(false);
        }
    };

    const apply: Apply = async (body, summary) => {
        setMsg(null);
        try {
            const r = await api.post<{ combinationsCreated?: number }>('/api/admin/placement', { grade_stream_id: streamId, ...body });
            setMsg({ tone: 'success', text: placedMessage(summary, r) });
            await load(streamId);
        } catch (err) {
            setMsg({ tone: 'danger', text: errorMessage(err, 'Could not save') });
        }
    };

    return (
        <View>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>
                Teachers only record marks for learners who take a subject, so those marks show what each learner studies. Pick a class, check the suggestions, adjust anything that is wrong, and apply. Nothing changes until you apply.
            </Text>
            {streams.length === 0 ? <EmptyState title="No CBC Grade 10-12 or 8-4-4 classes found." /> : (
                <SelectField label="Class" value={streamId} onChange={(id) => { setStreamId(id); setMsg(null); void load(id); }} options={streams.map((s) => ({ id: s.id, label: s.full_name }))} />
            )}
            {msg ? (msg.tone === 'danger' ? <ErrorBanner message={msg.text} /> : <Notice tone="success" message={msg.text} onDismiss={() => setMsg(null)} />) : null}
            {loading ? <LoadingView /> : null}
            {data?.mode === 'senior' ? <SeniorTable data={data} onApply={apply} /> : null}
            {data?.mode === '844' ? <ElectiveTable data={data} onApply={apply} /> : null}
        </View>
    );
}
