import React, { useCallback, useEffect, useState } from 'react';
import { DateField } from '@/components/DateField';
import { Text, View } from 'react-native';
import { date as fmtDate, personName, today } from '@shared/ops/format';
import { WEEKDAYS, WEEKDAY_LABELS, describeQuality, type TimetableConfig, type TimetableLesson, type TimetableVersion } from '@shared/timetable/config';
import { periodIndexOf, type GridRow } from '@shared/timetable/layout';
import { timetablePdfUrl, type TimetablePdfView } from '@shared/timetable/pdf-url';
import { useDownload } from '@/lib/useDownload';
import {
    PUBLISH_TIMETABLE_WARNING, TIMETABLE_VIEWS, VERSION_TONES, lessonClasses, newDraftName, withAddedPeriod,
    type CoverNeed, type CoverRow, type TimetableView, type TimetableViewResult,
} from '@shared/ops/forms/academics';
import { Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ListCard, ListRow, LoadingView, Notice, SectionLabel, TextField, ToggleRow } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { LookupField, SelectField } from '@/components/ops/SelectField';
import { StatusPill, useRefreshSignal } from '@/components/ops/bits';
import { useApi, withQuery } from '@/lib/api';
import { confirmAlert } from '@/lib/confirm';
import { errorMessage, formatDate } from '@/lib/format';
import { opsGet, useOpsList } from '@/lib/ops';
import { spacing, fonts, useTheme } from '@/lib/theme';
import { TimetableGrid } from './TimetableGrid';

/** Saves a timetable PDF to the phone; reports failure as a toast. */
function useTimetablePdf() {
    const download = useDownload();
    const toast = useToast();
    const [busy, setBusy] = useState<TimetablePdfView | null>(null);
    const save = useCallback(async (opts: Parameters<typeof timetablePdfUrl>[0], fileName: string) => {
        setBusy(opts.view);
        try { await download(timetablePdfUrl(opts), fileName); }
        catch (err) { toast.error(errorMessage(err, 'Could not download the timetable')); }
        finally { setBusy(null); }
    }, [download, toast]);
    return { busy, save };
}

/** The published timetable: your own, or any class, teacher or room (for staff). */
export function TimetableViewer({ canBrowse }: { canBrowse: boolean }) {
    const api = useApi();
    const toast = useToast();
    const [view, setView] = useState<TimetableView>('mine');
    const [targetId, setTargetId] = useState('');
    const [data, setData] = useState<TimetableViewResult | null>(null);
    const rooms = useOpsList<{ id: string; name: string }>('rooms', {}, { enabled: canBrowse && view === 'room' });

    const load = useCallback(async () => {
        if (view !== 'mine' && !targetId) return;
        try { setData(await opsGet<TimetableViewResult>(api, withQuery('/api/academics/timetable/view', { view, id: targetId || undefined }))); }
        catch (err) { toast.error(errorMessage(err, 'Could not load the timetable')); }
    }, [api, view, targetId, toast]);
    useEffect(() => { void load(); }, [load]);
    useRefreshSignal(load);
    const pdf = useTimetablePdf();

    return (
        <View>
            {canBrowse ? (
                <>
                    <ChipSelect options={TIMETABLE_VIEWS.map((v) => ({ value: v.id, label: v.label }))} value={view} onChange={(v) => { setView(v); setTargetId(''); setData(null); }} />
                    {view === 'class' ? <LookupField label="Class" lookup="streams" value={targetId} onChange={setTargetId} /> : null}
                    {view === 'teacher' ? <LookupField label="Teacher" lookup="staff" value={targetId} onChange={setTargetId} /> : null}
                    {view === 'room' ? <SelectField label="Room" options={rooms.rows.map((r) => ({ id: r.id, label: r.name }))} loading={rooms.loading} value={targetId} onChange={setTargetId} /> : null}
                </>
            ) : null}
            {!data ? (
                view !== 'mine' && !targetId ? <EmptyState title="Choose whose timetable to show." /> : <LoadingView />
            ) : !data.published ? (
                <EmptyState title="No timetable has been published yet." />
            ) : data.lessons.length === 0 ? (
                <EmptyState title="No lessons on this timetable." />
            ) : (
                <>
                    <ButtonRow>
                        <Button size="sm" variant="secondary" label="Download PDF" loading={pdf.busy === view} onPress={() => void pdf.save({ view, id: targetId || undefined }, 'timetable.pdf')} />
                        {canBrowse ? <Button size="sm" variant="secondary" label="Whole school" loading={pdf.busy === 'master'} onPress={() => void pdf.save({ view: 'master' }, 'master-timetable.pdf')} /> : null}
                    </ButtonRow>
                    <TimetableGrid config={data.config} lessons={data.lessons} mode={data.mode} />
                </>
            )}
        </View>
    );
}

/**
 * Generate drafts, inspect and adjust them class by class (tap a lesson,
 * then the slot to move or swap it into), pin lessons, and publish.
 */
export function TimetableBuilder() {
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [versions, setVersions] = useState<TimetableVersion[]>([]);
    const [config, setConfig] = useState<TimetableConfig | null>(null);
    const [activeId, setActiveId] = useState('');
    const [lessons, setLessons] = useState<TimetableLesson[]>([]);
    const [streamId, setStreamId] = useState('');
    const [selected, setSelected] = useState<TimetableLesson | null>(null);
    const [name, setName] = useState('');
    const [generating, setGenerating] = useState(false);
    const pdf = useTimetablePdf();

    const fail = useCallback((err: unknown) => toast.error(errorMessage(err, 'Something went wrong')), [toast]);

    const loadVersions = useCallback(async () => {
        try {
            const list = await opsGet<TimetableVersion[]>(api, '/api/academics/timetable/versions');
            setVersions(list);
            setActiveId((id) => id || list[0]?.id || '');
        } catch (err) { fail(err); }
    }, [api, fail]);

    const loadActive = useCallback(async (id: string) => {
        if (!id) return;
        try { setLessons((await opsGet<{ lessons: TimetableLesson[] }>(api, `/api/academics/timetable/versions/${id}`)).lessons); }
        catch (err) { fail(err); }
    }, [api, fail]);

    useEffect(() => {
        void loadVersions();
        opsGet<TimetableConfig>(api, '/api/academics/timetable/config').then(setConfig).catch(() => undefined);
    }, [api, loadVersions]);
    useEffect(() => { void loadActive(activeId); }, [activeId, loadActive]);
    useRefreshSignal(loadVersions);

    const active = versions.find((v) => v.id === activeId) ?? null;
    const streams = lessonClasses(lessons);
    const shownStream = streamId || streams[0]?.id || '';
    const classLessons = lessons.filter((l) => l.grade_stream_id === shownStream);
    const unplaced = active?.stats.unplaced ?? [];

    const generate = async () => {
        setGenerating(true);
        try {
            const r = await api.post<{ data: TimetableVersion }>('/api/academics/timetable/generate', { name: newDraftName(name), ...(activeId ? { keep_locked_from: activeId } : {}) });
            toast.success('Draft generated.');
            setName('');
            setActiveId(r.data.id);
            await loadVersions();
        } catch (err) { fail(err); }
        finally { setGenerating(false); }
    };

    const patchLesson = async (lesson: TimetableLesson, body: Record<string, unknown>) => {
        try {
            await api.patch(`/api/academics/timetable/lessons/${lesson.id}`, body);
            setSelected(null);
            await loadActive(activeId);
        } catch (err) { fail(err); }
    };

    const onCell = (day: number, row: GridRow, lesson: TimetableLesson | null) => {
        const period = selected && config ? periodIndexOf(config, selected, row) : -1;
        if (selected && period >= 0 && (selected.day !== day || selected.period !== period)) void patchLesson(selected, { day, period });
        else setSelected(lesson && lesson.id !== selected?.id ? lesson : null);
    };

    const publish = () => confirmAlert('Publish this timetable?', PUBLISH_TIMETABLE_WARNING, [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Publish',
            onPress: () => void api.patch(`/api/academics/timetable/versions/${activeId}`, { status: 'PUBLISHED' })
                .then(() => { toast.success('Timetable published. Teachers and learners now see it.'); return loadVersions(); })
                .catch(fail),
        },
    ]);

    const remove = () => confirmAlert('Delete this draft?', 'The draft and its lessons are removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Delete',
            style: 'destructive',
            onPress: () => void api.del(`/api/academics/timetable/versions/${activeId}`)
                .then(() => { toast.success('Draft deleted.'); setActiveId(''); setLessons([]); return loadVersions(); })
                .catch(fail),
        },
    ]);

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <TextField label="New draft name" value={name} onChangeText={setName} placeholder="e.g. Term 3 timetable" />
                <Button label={generating ? 'Generating…' : 'Generate timetable'} onPress={() => void generate()} loading={generating} block />
                {activeId ? <Text style={{ fontSize: 11, color: colors.muted, marginTop: spacing.sm }}>Pinned lessons in the selected draft keep their slots when you generate again.</Text> : null}
            </Card>

            {versions.length === 0 ? <EmptyState title="Set up the day and teaching loads, then generate your first draft." /> : (
                <>
                    <SelectField
                        label="Draft"
                        value={activeId}
                        onChange={(v) => { setActiveId(v); setSelected(null); }}
                        options={versions.map((v) => ({ id: v.id, label: v.name, hint: `${v.status.toLowerCase()} · ${formatDate(v.created_at)}` }))}
                    />
                    {streams.length > 0 ? <SelectField label="Class" value={shownStream} onChange={(v) => { setStreamId(v); setSelected(null); }} options={streams} /> : null}
                    {active ? (
                        <ButtonRow>
                            <StatusPill status={active.status} tones={VERSION_TONES} />
                            {active.stats.required !== undefined ? <Badge variant={unplaced.length === 0 ? 'success' : 'warning'} label={`${active.stats.placed} of ${active.stats.required} lessons placed`} /> : null}
                            <Button size="sm" variant="secondary" label="Master PDF" loading={pdf.busy === 'master'} onPress={() => void pdf.save({ view: 'master', version: active.id }, 'master-timetable.pdf')} />
                            {active.status !== 'PUBLISHED' ? <Button size="sm" label="Publish" onPress={publish} /> : null}
                            {active.status !== 'PUBLISHED' ? <Button size="sm" variant="danger" label="Delete" onPress={remove} /> : null}
                        </ButtonRow>
                    ) : null}
                    {selected ? (
                        <Card style={{ marginVertical: spacing.sm, padding: spacing.md, backgroundColor: colors.infoBg }}>
                            <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>Moving {selected.subject?.name}: tap a slot</Text>
                            <ButtonRow>
                                <Button size="sm" variant="secondary" label={selected.locked ? 'Unpin' : 'Pin here'} onPress={() => void patchLesson(selected, { locked: !selected.locked })} />
                                <Button size="sm" variant="ghost" label="Cancel" onPress={() => setSelected(null)} />
                            </ButtonRow>
                        </Card>
                    ) : null}
                    {active?.stats.quality ? <QualityCard quality={describeQuality(active.stats.quality)} reshuffling={generating} onReshuffle={() => void generate()} /> : null}
                    {unplaced.length > 0 ? (
                        <Notice tone="warning" message={`Not placed — lighten these loads, free the teacher, or add rooms, then generate again: ${unplaced.slice(0, 12).map((u) => `${u.label}: ${u.lessons}`).join('; ')}`} />
                    ) : null}
                    {config && active && classLessons.length > 0 ? (
                        <View style={{ marginTop: spacing.sm }}>
                            <TimetableGrid config={config} lessons={classLessons} mode="class" selectedId={selected?.id} onCellPress={onCell} />
                        </View>
                    ) : null}
                </>
            )}
        </View>
    );
}

/** How well a draft spreads subjects, with what still breaks a preference. */
function QualityCard({ quality, reshuffling, onReshuffle }: { quality: ReturnType<typeof describeQuality>; reshuffling: boolean; onReshuffle: () => void }) {
    const { colors } = useTheme();
    const tone = { good: { bg: colors.successBg, fg: colors.success }, fair: { bg: colors.warningBg, fg: colors.warning }, poor: { bg: colors.dangerBg, fg: colors.danger } }[quality.tone];
    return (
        <Card style={{ marginVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20, fontFamily: fonts.bold, color: tone.fg }}>{quality.score}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>{quality.verdict}</Text>
                <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted }}>
                    {quality.notes.length > 0 ? quality.notes.join(' · ') : 'Subjects are spread across the week with core lessons in the morning.'}
                </Text>
                <View style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}>
                    <Button size="sm" variant="secondary" label={reshuffling ? 'Reshuffling…' : 'Reshuffle'} loading={reshuffling} onPress={onReshuffle} />
                </View>
            </View>
        </Card>
    );
}

/** The school day: which weekdays run, and each period and break with its times. */
export function DayStructureEditor({ onSaved }: { onSaved?: () => void } = {}) {
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [config, setConfig] = useState<TimetableConfig | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        opsGet<TimetableConfig>(api, '/api/academics/timetable/config').then(setConfig).catch((err: unknown) => toast.error(errorMessage(err, 'Could not load the day')));
    }, [api, toast]);

    if (!config) return <LoadingView />;

    const setPeriod = (i: number, patch: Partial<TimetableConfig['periods'][number]>) =>
        setConfig((c) => c && ({ ...c, periods: c.periods.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

    const save = async () => {
        setSaving(true);
        try {
            setConfig((await api.put<{ data: TimetableConfig }>('/api/academics/timetable/config', config)).data);
            toast.success('Day structure saved.');
            onSaved?.();
        } catch (err) { toast.error(errorMessage(err, 'Could not save')); }
        finally { setSaving(false); }
    };

    return (
        <Card style={{ marginBottom: spacing.md }}>
            <SectionLabel>School days</SectionLabel>
            <ButtonRow>
                {WEEKDAYS.map((d) => {
                    const on = config.days.includes(d);
                    return (
                        <Button
                            key={d}
                            size="sm"
                            variant={on ? 'primary' : 'secondary'}
                            label={WEEKDAY_LABELS[d]}
                            onPress={() => setConfig((c) => c && ({ ...c, days: on ? c.days.filter((x) => x !== d) : [...c.days, d].sort() }))}
                        />
                    );
                })}
            </ButtonRow>

            <SectionLabel>Periods and breaks</SectionLabel>
            {config.periods.map((p, i) => (
                <Card key={i} style={{ marginBottom: spacing.sm, padding: spacing.md, borderStyle: p.is_break ? 'dashed' : 'solid' }}>
                    <TextField label="Name" value={p.label} onChangeText={(v) => setPeriod(i, { label: v })} />
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <View style={{ flex: 1 }}><TextField label="Starts" value={p.start} onChangeText={(v) => setPeriod(i, { start: v })} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
                        <View style={{ flex: 1 }}><TextField label="Ends" value={p.end} onChangeText={(v) => setPeriod(i, { end: v })} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
                    </View>
                    <ToggleRow label="Break" value={p.is_break} onValueChange={(v) => setPeriod(i, { is_break: v })} />
                    <ButtonRow>
                        <Button size="sm" variant="ghost" label={`Remove ${p.label}`} onPress={() => setConfig((c) => c && ({ ...c, periods: c.periods.filter((_, j) => j !== i) }))} />
                    </ButtonRow>
                </Card>
            ))}
            <ButtonRow>
                <Button size="sm" variant="secondary" label="+ Lesson period" onPress={() => setConfig((c) => c && withAddedPeriod(c, false))} />
                <Button size="sm" variant="secondary" label="+ Break" onPress={() => setConfig((c) => c && withAddedPeriod(c, true))} />
            </ButtonRow>

            <View style={{ marginTop: spacing.md }}>
                <TextField
                    label="Most lessons in a row for one teacher"
                    value={String(config.rules.max_consecutive)}
                    onChangeText={(v) => setConfig((c) => c && ({ ...c, rules: { ...c.rules, max_consecutive: Number(v) || 1 } }))}
                    keyboardType="number-pad"
                />
            </View>
            <Button label={saving ? 'Saving…' : onSaved ? 'Save and continue' : 'Save day structure'} onPress={() => void save()} loading={saving} block />
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: spacing.sm }}>Changing periods after publishing? Generate the timetable again so lessons line up with the new day.</Text>
        </Card>
    );
}

/** Arrange cover for an absent teacher: free colleagues ranked by subject match and load. */
export function CoverPanel() {
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [day, setDay] = useState(today());
    const [teacher, setTeacher] = useState('');
    const [needs, setNeeds] = useState<CoverNeed[] | null>(null);
    const [loading, setLoading] = useState(false);
    const covers = useOpsList<CoverRow>('substitutions', { cover_date: day });
    useRefreshSignal(covers.reload);

    const find = async () => {
        if (!teacher) { toast.error('Choose the absent teacher.'); return; }
        setLoading(true);
        try { setNeeds((await opsGet<{ needs: CoverNeed[] }>(api, withQuery('/api/academics/timetable/cover-options', { date: day, teacher_id: teacher }))).needs); }
        catch (err) { toast.error(errorMessage(err, 'Could not check cover')); }
        finally { setLoading(false); }
    };

    const assign = async (lessonId: string, coverId: string) => {
        const ok = await covers.create({ lesson_id: lessonId, cover_date: day, absent_teacher_id: teacher, cover_teacher_id: coverId }, 'Cover arranged.');
        if (ok) await find();
    };

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <DateField label="Date" value={day} onChange={(v) => { setDay(v); setNeeds(null); }} />
                <LookupField label="Absent teacher" lookup="staff" value={teacher} onChange={(v) => { setTeacher(v); setNeeds(null); }} />
                <Button label={loading ? 'Checking…' : 'Find cover'} onPress={() => void find()} loading={loading} block />
            </Card>

            {needs ? (needs.length === 0 ? (
                <EmptyState title={`That teacher has no lessons on ${fmtDate(day)}.`} />
            ) : needs.map((n) => (
                <Card key={n.lesson.id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>{n.lesson.stream?.full_name} · {n.lesson.subject?.name}</Text>
                    {n.coveredBy ? <Text style={{ color: colors.success, marginTop: 4 }}>✓ Covered</Text>
                        : n.candidates.length === 0 ? <Text style={{ color: colors.danger, marginTop: 4 }}>Nobody is free in this period.</Text>
                            : (
                                <ButtonRow>
                                    {n.candidates.map((c) => (
                                        <Button key={c.id} size="sm" variant={c.sameSubject ? 'primary' : 'secondary'} label={`${c.name} · ${c.sameSubject ? 'same subject · ' : ''}${c.weeklyLessons}/wk`} onPress={() => void assign(n.lesson.id, c.id)} />
                                    ))}
                                </ButtonRow>
                            )}
                </Card>
            ))) : null}

            <SectionLabel>{`Cover on ${fmtDate(day)}`}</SectionLabel>
            {covers.rows.length === 0 ? <Text style={{ color: colors.muted }}>None arranged.</Text> : (
                <ListCard>
                    {covers.rows.map((c) => (
                        <ListRow
                            key={c.id}
                            title={`${c.lesson?.stream?.full_name} · ${c.lesson?.subject?.name}`}
                            subtitle={`${personName(c.cover)} for ${personName(c.absent)}`}
                            right={<Button size="sm" variant="ghost" label="Remove" onPress={() => void covers.remove(c.id, 'Cover removed.')} />}
                        />
                    ))}
                </ListCard>
            )}
        </View>
    );
}
