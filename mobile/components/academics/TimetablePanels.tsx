import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react-native';
import { DateField } from '@/components/DateField';
import { Text, View } from 'react-native';
import { date as fmtDate, personName, today } from '@shared/ops/format';
import { BAND_LABELS } from '@shared/curriculum-bands';
import { CURRICULUM_BANDS, WEEKDAYS, WEEKDAY_LABELS, describeQuality, minutesOf, runsOn, type TimetablePeriod, type TimetableConfig, type TimetableLesson, type TimetableVersion } from '@shared/timetable/config';
import { periodIndexOf, periodsOfLesson, type GridRow } from '@shared/timetable/layout';
import { moveHint } from '@shared/timetable/moves';
import { auditLessons, hoursCheck } from '@shared/timetable/checks';
import type { TimetablePlan } from '@shared/timetable/readiness';
import { timetablePdfUrl, type TimetablePdfView } from '@shared/timetable/pdf-url';
import { useDownload } from '@/lib/useDownload';
import {
    PERIOD_KINDS, PUBLISH_TIMETABLE_WARNING, weekSummary, SECTIONS_NOTE, bellOrderProblem, bellSummary, periodKind, periodKindMismatch, TIMETABLE_VIEWS, VERSION_TONES, lessonClasses, newDraftName, openSectionPresets,
    withAddedPeriodTo, withPeriodDayToggled, withPeriodPatched, withSectionAdded, withSectionBandToggled, withSectionPatched, withSectionRemoved,
    type CoverNeed, type CoverRow, type TimetableView, type TimetableViewResult,
} from '@shared/ops/forms/academics';
import { Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice, SectionLabel, SegmentedTabs, TextField } from '@/components/ui';
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
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [view, setView] = useState<TimetableView>('mine');
    const [targetId, setTargetId] = useState('');
    const [data, setData] = useState<TimetableViewResult | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const rooms = useOpsList<{ id: string; name: string }>('rooms', {}, { enabled: canBrowse && view === 'room' });

    const load = useCallback(async () => {
        if (view !== 'mine' && !targetId) return;
        setLoadError(null);
        try { setData(await opsGet<TimetableViewResult>(api, withQuery('/api/academics/timetable/view', { view, id: targetId || undefined }))); }
        catch (err) {
            // With nothing on screen it says so, with Try again; it used to spin forever.
            const message = errorMessage(err, 'Could not load the timetable');
            setLoadError(message);
            toast.error(message);
        }
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
                view !== 'mine' && !targetId ? <EmptyState title="Choose whose timetable to show." />
                    : loadError ? <ErrorBanner message={loadError} onRetry={() => void load()} />
                    : <LoadingView />
            ) : !data.published ? (
                <EmptyState title="No timetable has been published yet." />
            ) : data.lessons.length === 0 ? (
                <EmptyState title="No lessons on this timetable." />
            ) : (
                <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
                        {weekSummary(data.lessons).map(([label, value]) => (
                            <View key={label} style={{ backgroundColor: colors.mutedBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                                <Text style={{ fontSize: 11, color: colors.muted, fontFamily: fonts.regular }}>{label}</Text>
                                <Text style={{ fontSize: 15, color: colors.foreground, fontFamily: fonts.bold }}>{value}</Text>
                            </View>
                        ))}
                    </View>
                    <ButtonRow>
                        <Button size="sm" variant="secondary" label="Download PDF" loading={pdf.busy === view} onPress={() => void pdf.save({ view, id: targetId || undefined }, 'timetable.pdf')} />
                        {canBrowse ? <Button size="sm" variant="secondary" label="Whole-school PDF" loading={pdf.busy === 'master'} onPress={() => void pdf.save({ view: 'master' }, 'master-timetable.pdf')} /> : null}
                    </ButtonRow>
                    <TimetableGrid config={data.config} lessons={data.lessons} mode={data.mode} />
                </>
            )}
        </View>
    );
}

/** One check a school reads before publishing: what it says, and whether it holds. */
function CheckRow({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
    const { colors } = useTheme();
    return (
        <View style={{ flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, borderColor: ok ? colors.success : colors.warning, backgroundColor: ok ? colors.successBg : colors.warningBg }}>
            <Text style={{ fontSize: 16 }}>{ok ? '✓' : '!'}</Text>
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, color: ok ? colors.successText : colors.warningText }}>{title}</Text>
                <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted }}>{detail}</Text>
            </View>
        </View>
    );
}

/**
 * Check drafts and adjust them class by class (tap a lesson: the grid shows
 * where it can go, then tap the slot to move or swap it), pin lessons,
 * reshuffle, and publish under the name teachers will see.
 */
export function TimetableBuilder({ plan, onChanged }: { plan?: TimetablePlan | null; onChanged?: () => void }) {
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [versions, setVersions] = useState<TimetableVersion[]>([]);
    const [config, setConfig] = useState<TimetableConfig | null>(null);
    const [activeId, setActiveId] = useState('');
    const [lessons, setLessons] = useState<TimetableLesson[]>([]);
    const [streamId, setStreamId] = useState('');
    const [selected, setSelected] = useState<TimetableLesson | null>(null);
    const [generating, setGenerating] = useState(false);
    /** Set while publishing: the name the timetable goes out under. */
    const [publishName, setPublishName] = useState<string | null>(null);
    const [publishing, setPublishing] = useState(false);
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

    // Read back from the lessons themselves, so moves made by hand are checked too.
    const audit = useMemo(() => (config ? auditLessons(lessons.map((l) => ({ day: l.day, period: l.period, streamPeriods: periodsOfLesson(config, l), teacherId: l.teacher_id, roomId: l.room_id }))) : null), [config, lessons]);
    const hours = useMemo(() => {
        const loads = (plan?.classes ?? []).flatMap((c) => [...c.core, ...c.blocks.flatMap((b) => b.loads)].map((l) => ({ id: l.id, className: c.name, subject: l.subject, lessons: l.lessons })));
        return loads.length > 0 ? hoursCheck(loads, lessons) : null;
    }, [plan, lessons]);
    const placedAll = active?.stats.required !== undefined && unplaced.length === 0;
    const short = hours?.short.length ?? 0;
    const clashes = audit ? audit.teacherClashes + audit.roomClashes : 0;

    /** A new draft from the selected one: its pinned lessons stay, everything else is placed afresh. */
    const reshuffle = async () => {
        setGenerating(true);
        try {
            const r = await api.post<{ data: TimetableVersion }>('/api/academics/timetable/generate', { name: newDraftName(''), ...(activeId ? { keep_locked_from: activeId } : {}) });
            toast.success('New draft generated, pinned lessons kept.');
            setActiveId(r.data.id);
            setSelected(null);
            await loadVersions();
            onChanged?.();
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

    const hintAt = useCallback((day: number, row: GridRow) => (selected && config ? moveHint(config, lessons, selected, day, row) : null), [selected, config, lessons]);

    const onCell = (day: number, row: GridRow, lesson: TimetableLesson | null) => {
        const hint = hintAt(day, row);
        if (selected && config && hint && hint.state !== 'blocked') void patchLesson(selected, { day, period: periodIndexOf(config, selected, row) });
        else if (selected && hint?.state === 'blocked' && !lesson) toast.error(hint.reason ?? 'It cannot go there.');
        else setSelected(lesson && lesson.id !== selected?.id ? lesson : null);
    };

    const publish = async () => {
        setPublishing(true);
        try {
            const name = (publishName ?? '').trim();
            await api.patch(`/api/academics/timetable/versions/${activeId}`, { status: 'PUBLISHED', ...(name ? { name } : {}) });
            toast.success('Timetable published. Teachers and learners now see it.');
            setPublishName(null);
            await loadVersions();
            onChanged?.();
        } catch (err) { fail(err); }
        finally { setPublishing(false); }
    };

    const remove = () => confirmAlert('Delete this draft?', 'The draft and its lessons are removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Delete',
            style: 'destructive',
            onPress: () => void api.del(`/api/academics/timetable/versions/${activeId}`)
                .then(() => { toast.success('Draft deleted.'); setActiveId(''); setLessons([]); onChanged?.(); return loadVersions(); })
                .catch(fail),
        },
    ]);

    if (versions.length === 0) return <EmptyState title="No drafts yet." description="When every part is ready, generate one with the button at the top." />;

    return (
        <View>
            <SelectField
                label="Draft"
                value={activeId}
                onChange={(v) => { setActiveId(v); setSelected(null); setPublishName(null); }}
                options={versions.map((v) => ({ id: v.id, label: v.name, hint: `${v.status.toLowerCase()} · ${formatDate(v.created_at)}` }))}
            />
            {active ? (
                <ButtonRow>
                    <StatusPill status={active.status} tones={VERSION_TONES} />
                    <Button size="sm" variant="secondary" label="Master PDF" loading={pdf.busy === 'master'} onPress={() => void pdf.save({ view: 'master', version: active.id }, 'master-timetable.pdf')} />
                    {active.status !== 'PUBLISHED' ? <Button size="sm" label="Publish" onPress={() => setPublishName(/^Draft\b/i.test(active.name) ? '' : active.name)} /> : null}
                    {active.status !== 'PUBLISHED' ? <Button size="sm" variant="danger" label="Delete" onPress={remove} /> : null}
                </ButtonRow>
            ) : null}
            {active && publishName !== null ? (
                <Card style={{ marginVertical: spacing.sm, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>Publish this timetable?</Text>
                    <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.sm }}>{PUBLISH_TIMETABLE_WARNING}</Text>
                    <TextField label="Name it as teachers and learners will see it" value={publishName} onChangeText={setPublishName} placeholder={active.name} />
                    <ButtonRow>
                        <Button size="sm" variant="ghost" label="Cancel" onPress={() => setPublishName(null)} />
                        <Button size="sm" label={publishing ? 'Publishing…' : 'Publish'} loading={publishing} onPress={() => void publish()} />
                    </ButtonRow>
                </Card>
            ) : null}
            {active ? (
                <View style={{ marginTop: spacing.sm }}>
                    <CheckRow
                        ok={placedAll && short === 0}
                        title={!placedAll ? `${active.stats.placed ?? 0} of ${active.stats.required ?? 0} class periods filled` : short > 0 ? `${short} subject${short === 1 ? ' is' : 's are'} short of lessons` : 'Every subject has its lessons a week'}
                        detail={!placedAll ? 'Some lessons did not fit: see below.' : short > 0 ? 'Loads changed after this draft was made. Generate a new draft.' : hours ? `${hours.placed} lessons in ${active.stats.placed ?? hours.placed} class periods, as set in Subjects & hours.` : 'As set in Subjects & hours.'}
                    />
                    <CheckRow
                        ok={clashes === 0}
                        title={clashes === 0 ? 'No teacher or room booked twice' : `${clashes} double booking${clashes === 1 ? '' : 's'}`}
                        detail={clashes === 0 ? 'Checked lesson by lesson, across every class and bell, including the times teachers are away.' : 'Move one of the lessons, or reshuffle.'}
                    />
                </View>
            ) : null}
            {active?.stats.quality ? <QualityCard quality={describeQuality(active.stats.quality)} reshuffling={generating} onReshuffle={() => void reshuffle()} /> : null}
            {unplaced.length > 0 ? (
                <Notice tone="warning" message={`Not placed — free the teacher, lighten these loads, or add rooms, then generate again: ${unplaced.slice(0, 12).map((u) => `${u.label}: ${u.lessons}`).join('; ')}`} />
            ) : null}
            {streams.length > 0 ? <SelectField label="Class" value={shownStream} onChange={(v) => { setStreamId(v); setSelected(null); }} options={streams} /> : null}
            {selected ? (
                <Card style={{ marginVertical: spacing.sm, padding: spacing.md, backgroundColor: colors.infoBg }}>
                    <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>Moving {selected.subject?.name}</Text>
                    <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted }}>Green: move it there. Blue (⇄): swap with that lesson. Faded: not possible.</Text>
                    <ButtonRow>
                        <Button size="sm" variant="secondary" label={selected.locked ? 'Unpin' : 'Pin here'} onPress={() => void patchLesson(selected, { locked: !selected.locked })} />
                        <Button size="sm" variant="ghost" label="Cancel" onPress={() => setSelected(null)} />
                    </ButtonRow>
                </Card>
            ) : <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginVertical: spacing.sm }}>Tap a lesson to move or pin it. Pinned lessons keep their slots when you reshuffle.</Text>}
            {config && active && classLessons.length > 0 ? (
                <TimetableGrid config={config} lessons={classLessons} mode="class" selectedId={selected?.id} onCellPress={onCell} hintAt={hintAt} />
            ) : null}
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

/** One bell: its periods and breaks with their times and the days each runs (a Friday ninth lesson). */
function PeriodsEditor({ periods, schoolDays, onChange }: { periods: readonly TimetablePeriod[]; schoolDays: readonly number[]; onChange: (next: TimetablePeriod[]) => void }) {
    const { colors } = useTheme();
    const problem = bellOrderProblem(periods);
    return (
        <View>
            <Text style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground, marginBottom: spacing.sm }}>{bellSummary(periods, schoolDays)}</Text>
            {problem ? <Notice tone="danger" message={`${problem} Fix the times before saving.`} /> : null}
            {periods.map((p, i) => {
                const minutes = minutesOf(p.end) - minutesOf(p.start);
                return (
                    <Card key={i} style={{ marginBottom: spacing.sm, padding: spacing.md, borderColor: p.is_break ? colors.warning : colors.border, backgroundColor: p.is_break ? colors.warningBg : colors.card }}>
                        <TextField label="Name" value={p.label} onChangeText={(v) => onChange(withPeriodPatched(periods, i, { label: v }))} />
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            <View style={{ flex: 1 }}><TextField label="Starts" value={p.start} onChangeText={(v) => onChange(withPeriodPatched(periods, i, { start: v }))} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
                            <View style={{ flex: 1 }}><TextField label={`Ends${minutes > 0 ? ` · ${minutes} min` : ''}`} value={p.end} onChangeText={(v) => onChange(withPeriodPatched(periods, i, { end: v }))} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
                        </View>
                        <SegmentedTabs tabs={PERIOD_KINDS} value={periodKind(p)} onChange={(k) => onChange(withPeriodPatched(periods, i, { is_break: k === 'break' }))} />
                        {periodKindMismatch(p) ? <Text style={{ fontSize: 12, color: colors.warningText, marginTop: 4 }}>{periodKindMismatch(p)}</Text> : null}
                        <Text style={{ fontSize: 12, fontFamily: fonts.semibold, color: colors.muted, marginTop: spacing.sm }}>{schoolDays.every((d) => runsOn(p, d)) ? 'Runs every day' : 'Runs only on'}</Text>
                        <ButtonRow align="start">
                            {schoolDays.map((d) => (
                                <Button key={d} size="sm" variant={runsOn(p, d) ? 'primary' : 'secondary'} label={WEEKDAY_LABELS[d]} onPress={() => onChange(withPeriodDayToggled(periods, i, d, schoolDays))} />
                            ))}
                        </ButtonRow>
                        <ButtonRow>
                            <Button size="sm" variant="ghost" label={`Remove ${p.label}`} onPress={() => onChange(periods.filter((_, j) => j !== i))} />
                        </ButtonRow>
                    </Card>
                );
            })}
            <ButtonRow align="start">
                <Button size="sm" variant="secondary" icon={Plus} label="Lesson period" onPress={() => onChange(withAddedPeriodTo(periods, false))} />
                <Button size="sm" variant="secondary" icon={Plus} label="Break" onPress={() => onChange(withAddedPeriodTo(periods, true))} />
            </ButtonRow>
        </View>
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

    const update = (fn: (c: TimetableConfig) => TimetableConfig) => setConfig((c) => c && fn(c));
    const problem = [config.periods, ...config.sections.map((sec) => sec.periods)].map(bellOrderProblem).find(Boolean);

    const save = async () => {
        setSaving(true);
        try {
            setConfig((await api.put<{ data: TimetableConfig }>('/api/academics/timetable/config', config)).data);
            toast.success('School day saved.');
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

            <SectionLabel>{config.sections.length > 0 ? 'Main school day' : 'Periods and breaks'}</SectionLabel>
            {config.sections.length > 0 ? <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>For classes in no section below.</Text> : null}
            <PeriodsEditor periods={config.periods} schoolDays={config.days} onChange={(periods) => update((c) => ({ ...c, periods }))} />

            <SectionLabel>Sections with their own bell</SectionLabel>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>{SECTIONS_NOTE}</Text>
            {config.sections.map((sec) => (
                <Card key={sec.id} style={{ marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.mutedBg }}>
                    <TextField label="Section name" value={sec.name} onChangeText={(v) => update((c) => withSectionPatched(c, sec.id, { name: v }))} />
                    <Text style={{ fontSize: 12, fontFamily: fonts.semibold, color: colors.muted, marginBottom: spacing.xs }}>Levels on this bell</Text>
                    <ButtonRow>
                        {CURRICULUM_BANDS.map((b) => (
                            <Button key={b} size="sm" variant={sec.bands.includes(b) ? 'primary' : 'secondary'} label={BAND_LABELS[b]} onPress={() => update((c) => withSectionBandToggled(c, sec.id, b))} />
                        ))}
                    </ButtonRow>
                    <PeriodsEditor periods={sec.periods} schoolDays={config.days} onChange={(periods) => update((c) => withSectionPatched(c, sec.id, { periods }))} />
                    <ButtonRow>
                        <Button size="sm" variant="danger" label={`Remove ${sec.name}`} onPress={() => update((c) => withSectionRemoved(c, sec.id))} />
                    </ButtonRow>
                </Card>
            ))}
            <ButtonRow align="start">
                {openSectionPresets(config).map((p) => <Button key={p.key} size="sm" variant="secondary" icon={Plus} label={p.name} onPress={() => update((c) => withSectionAdded(c, p.key))} />)}
                <Button size="sm" variant="ghost" icon={Plus} label="Custom section" onPress={() => update((c) => withSectionAdded(c, null))} />
            </ButtonRow>

            <View style={{ marginTop: spacing.md }}>
                <Button label={saving ? 'Saving…' : 'Save school day'} onPress={() => void save()} loading={saving} disabled={!!problem} block />
            </View>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: spacing.sm }}>Changing the day after publishing? Generate the timetable again so lessons follow the new times.</Text>
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
