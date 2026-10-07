import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, FlaskConical, Info, Layers, Users, type LucideIcon } from 'lucide-react-native';
import { humanize, personName } from '@shared/ops/format';
import { basisLine, daySummary, firstCard, isLightLoad, loadsSummary, overloadMessage, type Blocker, type StudioCard as StudioCardId, type TimetablePlan } from '@shared/timetable/readiness';
import type { TimetableConfig } from '@shared/timetable/config';
import {
    IMPORT_LOADS_NOTE, LOAD_DEFAULTS, LOAD_FIELDS, MINISTRY_LOADS_NOTE, ROOM_DEFAULTS, ROOM_FIELDS, importLoadsMessage, loadLessonsLabel, newDraftName, withBreaksFixed,
    type ImportLoadsResult, type Room, type TeachingLoad,
} from '@shared/ops/forms/academics';
import { Button, ButtonRow, Card, LoadingView, ProgressBar, TextField, useScrollToView } from '@/components/ui';
import { useRefreshSignal } from '@/components/ops/bits';
import { ResourceList } from '@/components/ops/ResourceList';
import { useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { confirmAlert } from '@/lib/confirm';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { DayStructureEditor, TimetableBuilder } from './TimetablePanels';

/** Teaching loads: which teacher takes which subject with which class, and how often. */
function Loads({ onChange, filter }: { onChange: () => void; filter: string }) {
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [perWeek, setPerWeek] = useState('5');
    const [version, setVersion] = useState(0);
    const [busy, setBusy] = useState<'import' | 'reset' | null>(null);

    const importLoads = async (mode: 'import' | 'reset') => {
        setBusy(mode);
        try {
            const r = await api.post<{ data: ImportLoadsResult }>('/api/academics/timetable/requirements/import', { lessons_per_week: Number(perWeek) || 5, update_existing: mode === 'reset' });
            toast.success(importLoadsMessage(r.data));
            setVersion((v) => v + 1);
            onChange();
        } catch (err) {
            toast.error(errorMessage(err, 'Import failed'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>Start from subject assignments</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>{IMPORT_LOADS_NOTE}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>{MINISTRY_LOADS_NOTE}</Text>
                <TextField label="Other subjects: lessons a week" value={perWeek} onChangeText={setPerWeek} keyboardType="number-pad" />
                <ButtonRow>
                    <Button label={busy === 'import' ? 'Importing…' : 'Import loads'} onPress={() => void importLoads('import')} loading={busy === 'import'} disabled={busy !== null} />
                    <Button variant="secondary" label={busy === 'reset' ? 'Resetting…' : 'Reset to Ministry'} onPress={() => void importLoads('reset')} loading={busy === 'reset'} disabled={busy !== null} />
                </ButtonRow>
            </Card>
            <ResourceList<'timetable-requirements', TeachingLoad>
                key={`${version}-${filter}`}
                initialQuery={filter}
                resource="timetable-requirements"
                fields={LOAD_FIELDS}
                canCreate
                canEdit
                canDelete
                defaults={LOAD_DEFAULTS}
                searchText={(l) => `${l.stream?.full_name} ${l.subject?.name} ${personName(l.teacher)}`}
                title={(l) => `${l.stream?.full_name ?? ''} · ${l.subject?.name ?? ''}`}
                subtitle={(l) => (l.teacher ? personName(l.teacher) : 'Unassigned')}
                details={(l) => [
                    ['Lessons', loadLessonsLabel(l)],
                    ['Room', l.room_type ? humanize(l.room_type) : 'Any'],
                ]}
            />
        </View>
    );
}

/** Specialist rooms (labs, workshops) so practicals land in one. */
export function Rooms() {
    return (
        <ResourceList<'rooms', Room>
            resource="rooms"
            fields={ROOM_FIELDS}
            canCreate
            canEdit
            canDelete
            defaults={ROOM_DEFAULTS}
            title={(r) => r.name}
            subtitle={(r) => `${humanize(r.room_type)} · ${r.capacity ?? '—'} seats`}
            emptyText="No rooms yet. Add labs so practicals get one; ordinary lessons run in the class's own room."
        />
    );
}

type FitFix = 'longer-day' | 'fewer-lessons';

type CardState = 'done' | 'attention' | 'optional' | 'todo';
const STATE_LABEL: Record<CardState, string> = { done: 'Done', attention: 'Needs attention', optional: 'Optional', todo: 'To do' };

/** One part of the studio: a summary line that opens into its editor. */
function StudioCard({ icon: Icon, title, summary, state, open, onToggle, children, viewRef }: {
    icon: LucideIcon; title: string; summary: string; state: CardState; open: boolean; onToggle: () => void; children: React.ReactNode;
    viewRef?: (view: View | null) => void;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const tone = state === 'done' ? { bg: colors.successBg, fg: colors.successText } : state === 'attention' ? { bg: colors.warningBg, fg: colors.warningText } : { bg: colors.mutedBg, fg: colors.muted };
    return (
        <View ref={viewRef} collapsable={false} style={[styles.card, open && { borderColor: colors.primary }]}>
            <Pressable onPress={onToggle} style={styles.cardHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                <View style={[styles.cardIcon, { backgroundColor: state === 'attention' ? colors.warningBg : colors.primarySoft }]}>
                    <Icon size={20} color={state === 'attention' ? colors.warning : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSummary} numberOfLines={2}>{summary}</Text>
                    <View style={[styles.chip, { backgroundColor: tone.bg }]}><Text style={[styles.chipText, { color: tone.fg }]}>{STATE_LABEL[state]}</Text></View>
                </View>
                <ChevronDown size={20} color={colors.muted} style={open ? { transform: [{ rotate: '180deg' }] } : undefined} />
            </Pressable>
            {open ? <View style={styles.cardBody}>{children}</View> : null}
        </View>
    );
}

/** One ready-made way to make a class fit, with what it changes and a button. */
function FitOption({ title, recommended, lines, busy, onUse }: { title: string; recommended?: boolean; lines: string[]; busy: boolean; onUse: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View style={[styles.fitOption, recommended && { borderColor: colors.primary }]}>
            <View style={styles.fitOptionHead}>
                <Text style={styles.fitOptionTitle}>{title}</Text>
                {recommended ? <View style={[styles.pill, { backgroundColor: colors.primarySoft }]}><Text style={[styles.pillText, { color: colors.primary }]}>Recommended</Text></View> : null}
            </View>
            {lines.map((l) => <Text key={l} style={styles.fitLine}>{l}</Text>)}
            <ButtonRow>
                <Button size="sm" variant={recommended ? 'primary' : 'secondary'} label="Use this" onPress={onUse} loading={busy} />
            </ButtonRow>
        </View>
    );
}

/**
 * A class with more lessons than its week, put as a simple choice: two
 * ready-made fixes worked out from the school's own day and loads, applied
 * with one tap. Why it does not fit is there for whoever wants it.
 */
function FitChooser({ c, onApplied, onEditLoads }: { c: TimetablePlan['classes'][number]; onApplied: () => void; onEditLoads: () => void }) {
    const styles = useStyles();
    const api = useApi();
    const toast = useToast();
    const [busy, setBusy] = useState<FitFix | null>(null);
    const [why, setWhy] = useState(false);
    const over = c.needed - c.capacity;
    const day = c.fixes?.longerDay ?? null;
    const cuts = c.fixes?.fewerLessons ?? null;

    const apply = (fix: FitFix, title: string, detail: string) => confirmAlert(title, detail, [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Apply', onPress: () => void (async () => {
                setBusy(fix);
                try {
                    const r = await api.post<{ data: { message: string } }>('/api/academics/timetable/fit', { stream_id: c.streamId, fix });
                    toast.success(`${r.data.message} Generate a new draft to see it.`);
                    onApplied();
                } catch (err) { toast.error(errorMessage(err, 'Could not apply that')); }
                finally { setBusy(null); }
            })(),
        },
    ]);

    return (
        <View style={{ gap: spacing.sm }}>
            <Text style={styles.fitProblem}>{c.name} has {over} more lesson{over === 1 ? '' : 's'} than its week ({c.needed} needed, {c.capacity} periods). Pick one way to fix it:</Text>
            {day ? (
                <FitOption
                    title="Make the day longer"
                    recommended
                    lines={[`${day.level} get ${day.perDay} more lesson${day.perDay === 1 ? '' : 's'} at the end of each day: ${day.times.join(', ')}.`, 'Every other class keeps its day. No lessons are cut.']}
                    busy={busy === 'longer-day'}
                    onUse={() => apply('longer-day', 'Make the day longer?', `${day.level} will end at ${day.times[day.times.length - 1]?.split('–')[1] ?? 'a later time'}.`)}
                />
            ) : null}
            {cuts ? (
                <FitOption
                    title="Teach fewer lessons a week"
                    lines={[cuts.map((x) => `${x.subject} ${x.from} → ${x.to}`).join(' · '), 'The day stays as it is. Some subjects go below the Ministry’s figure.']}
                    busy={busy === 'fewer-lessons'}
                    onUse={() => apply('fewer-lessons', 'Teach fewer lessons?', `${cuts.length} subjects in ${c.name} get fewer lessons a week.`)}
                />
            ) : null}
            <Pressable onPress={() => setWhy((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: why }}>
                <Text style={styles.link}>{why ? 'Hide why' : 'Why doesn’t it fit?'}</Text>
            </Pressable>
            {why ? (
                <View style={{ gap: 4 }}>
                    <Text style={styles.fitLine}>Whole class: {c.core.map((l) => `${l.subject} ${l.lessons}`).join(' · ')}.</Text>
                    {basisLine(c) ? <Text style={styles.fitLine}>{basisLine(c)}</Text> : null}
                    <Pressable onPress={onEditLoads} accessibilityRole="button"><Text style={styles.link}>Edit {c.name}’s lessons yourself</Text></Pressable>
                </View>
            ) : null}
        </View>
    );
}

/** Each class's week against its periods, with the option blocks its electives run in. */
function ClassFit({ plan, onApplied, onEditLoads }: { plan: TimetablePlan; onApplied: () => void; onEditLoads: (className: string) => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View>
            {plan.classes.map((c) => (
                <View key={c.streamId} style={[styles.fit, !c.fits && { borderColor: colors.danger }]}>
                    <View style={styles.fitHead}>
                        <Text style={styles.fitName}>{c.name}</Text>
                        <Text style={[styles.fitCount, !c.fits && { color: colors.danger, fontFamily: fonts.bold }]}>{c.needed} / {c.capacity} periods</Text>
                    </View>
                    <ProgressBar value={(c.needed / Math.max(1, c.capacity)) * 100} color={c.fits ? colors.success : colors.danger} />
                    <Text style={styles.fitLine}>Whole class: {c.core.map((l) => `${l.subject} ${l.lessons}`).join(' · ') || '—'}</Text>
                    {c.fits && basisLine(c) ? <Text style={styles.fitLine}>{basisLine(c)}</Text> : null}
                    {!c.fits ? <FitChooser c={c} onApplied={onApplied} onEditLoads={() => onEditLoads(c.name)} /> : null}
                    {c.unfit.length > 0 ? (
                        <View style={[styles.block, { backgroundColor: colors.warningBg }]}>
                            <Text style={[styles.blockTitle, { color: colors.warningText }]}>{c.unfit.length} learner{c.unfit.length === 1 ? '' : 's'} must change a subject</Text>
                            {c.unfit.map((u) => <Text key={u.name + u.subjects.join()} style={styles.fitLine}>{u.name}: {u.subjects.join(' and ')} are in the same group</Text>)}
                        </View>
                    ) : null}
                    {c.blocks.map((b) => (
                        <View key={b.number} style={[styles.block, b.teacherClash && { backgroundColor: colors.warningBg }]}>
                            <Text style={styles.blockTitle}>{b.label} · {b.lessons}/wk</Text>
                            <Text style={styles.fitLine}>{b.loads.map((l) => l.subject).join(' / ')}</Text>
                            {b.teacherClash ? <Text style={[styles.fitLine, { color: colors.warningText }]}>One teacher has two of these at once: move one to another block.</Text> : null}
                        </View>
                    ))}
                    {c.unassigned > 0 ? <Text style={[styles.fitLine, { color: colors.warningText }]}>{c.unassigned} load{c.unassigned === 1 ? '' : 's'} without a teacher.</Text> : null}
                </View>
            ))}
        </View>
    );
}

/** Every teacher's week across all their classes and levels, light and over-full loads marked. */
function TeacherLoads({ plan }: { plan: TimetablePlan }) {
    const { colors } = useTheme();
    const styles = useStyles();
    if (plan.teachers.length === 0) return null;
    return (
        <View style={{ marginTop: spacing.md }}>
            <Text style={styles.blockTitle}>Teacher loads · lessons a week across every class</Text>
            {plan.teachers.map((t) => {
                const over = t.lessons > t.capacity;
                const light = isLightLoad(t);
                const tone = over ? colors.danger : light ? colors.warning : colors.success;
                return (
                    <View key={t.name} style={[styles.fit, { borderColor: over || light ? tone : colors.border }]}>
                        <View style={styles.fitHead}>
                            <Text style={styles.fitName} numberOfLines={1}>{t.name}</Text>
                            <Text style={[styles.fitCount, (over || light) && { color: tone }]}>{t.lessons} / {t.capacity}</Text>
                        </View>
                        <ProgressBar value={(t.lessons / Math.max(1, t.capacity)) * 100} color={tone} />
                        <Text style={styles.fitLine} numberOfLines={1}>{t.classes.join(' · ')}</Text>
                    </View>
                );
            })}
        </View>
    );
}

/** One thing in the way, with the button that fixes it or opens where it is fixed. */
function BlockerRow({ blocker, busy, onFix, onOpen }: { blocker: Blocker; busy: boolean; onFix: () => void; onOpen: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.blocker}>
            <View style={styles.blockerHead}>
                <AlertTriangle size={16} color={colors.warning} style={{ marginTop: 2 }} />
                <Text style={styles.blockerText}>{blocker.message}</Text>
            </View>
            <View style={styles.blockerActions}>
                {blocker.fix === 'set-breaks'
                    ? <Button size="sm" label="Set as breaks" onPress={onFix} loading={busy} />
                    : <Button size="sm" variant="secondary" label="Open" onPress={onOpen} />}
            </View>
        </View>
    );
}

/** Notes that do not stop generating: one line until opened. */
function Notes({ notes, onOpen }: { notes: readonly Blocker[]; onOpen: (n: Blocker) => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const [shown, setShown] = useState(false);
    if (notes.length === 0) return null;
    return (
        <View style={styles.notes}>
            <Pressable onPress={() => setShown((v) => !v)} style={styles.notesHead} accessibilityRole="button" accessibilityState={{ expanded: shown }}>
                <Info size={16} color={colors.muted} />
                <Text style={styles.notesTitle}>{notes.length} {notes.length === 1 ? 'tip' : 'tips'} worth a look</Text>
                <ChevronDown size={18} color={colors.muted} style={shown ? { transform: [{ rotate: '180deg' }] } : undefined} />
            </Pressable>
            {shown ? notes.map((n, i) => (
                <Pressable key={i} onPress={() => onOpen(n)} style={styles.note} accessibilityRole="button">
                    <Text style={styles.noteText}>{n.message}</Text>
                    {n.details?.map((d) => <Text key={d} style={styles.noteDetail}>• {d}</Text>)}
                </Pressable>
            )) : null}
        </View>
    );
}

/**
 * The timetable studio: the whole setup on one screen, in the order it has
 * to happen, with what blocks generating said up front instead of at the
 * end. Each part opens in place, the first that needs attention already open.
 */
export function TimetableWizard() {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const toast = useToast();
    const [plan, setPlan] = useState<TimetablePlan | null>(null);
    const [open, setOpen] = useState<StudioCardId | null>(null);
    const [generating, setGenerating] = useState(false);
    const [builderKey, setBuilderKey] = useState(0);
    const [dayKey, setDayKey] = useState(0);
    const [fixing, setFixing] = useState(false);
    const [loadsFilter, setLoadsFilter] = useState('');
    const loadsListRef = useRef<View | null>(null);
    const scrollToView = useScrollToView();
    const cardViews = useRef<Partial<Record<StudioCardId, View | null>>>({});
    const cardRef = (card: StudioCardId) => (view: View | null) => { cardViews.current[card] = view; };

    const refresh = useCallback(async () => {
        try {
            const next = await opsGet<TimetablePlan>(api, '/api/academics/timetable/plan');
            setPlan(next);
            setOpen((o) => o ?? firstCard(next));
        } catch (err) { toast.error(errorMessage(err, 'Could not load the timetable setup')); }
    }, [api, toast]);
    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshSignal(refresh);

    const generate = async () => {
        setGenerating(true);
        try {
            await api.post('/api/academics/timetable/generate', { name: newDraftName('') });
            toast.success('Draft generated. Check it, move anything you like, then publish.');
            setBuilderKey((k) => k + 1);
            await refresh();
            setOpen('drafts');
        } catch (err) { toast.error(errorMessage(err, 'Could not generate')); }
        finally { setGenerating(false); }
    };

    /** Open a part of the setup and bring it into view. */
    const show = (card: StudioCardId) => {
        setOpen(card);
        setTimeout(() => scrollToView(cardViews.current[card] ?? null), 80);
    };

    const setBreaks = async () => {
        setFixing(true);
        try {
            const config = await opsGet<TimetableConfig>(api, '/api/academics/timetable/config');
            await api.put('/api/academics/timetable/config', withBreaksFixed(config));
            toast.success('Breaks set. No lessons will be put in them.');
            setDayKey((k) => k + 1);
            await refresh();
        } catch (err) { toast.error(errorMessage(err, 'Could not update the school day')); }
        finally { setFixing(false); }
    };

    if (!plan) return <LoadingView />;
    const ready = plan.blockers.length === 0;
    const stateOf = (card: StudioCardId): CardState => {
        if (plan.blockers.some((b) => b.card === card)) return 'attention';
        if (card === 'day') return 'done';
        if (card === 'loads') return plan.loads > 0 ? 'done' : 'todo';
        if (card === 'rooms') return plan.rooms > 0 ? 'done' : 'optional';
        return plan.published ? 'done' : 'todo';
    };
    const toggle = (card: StudioCardId) => setOpen((o) => (o === card ? null : card));

    return (
        <View>
            <View style={styles.hero}>
                <View style={styles.heroHead}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.heroEyebrow}>{plan.published ? `Published · ${plan.published}` : 'Not published yet'}</Text>
                        <Text style={styles.heroTitle}>{ready ? 'Ready to generate' : plan.blockers.length === 1 ? 'One thing to fix first' : `${plan.blockers.length} things to fix first`}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: ready ? colors.successBg : colors.warningBg }]}>
                        {ready ? <CheckCircle2 size={14} color={colors.successText} /> : <AlertTriangle size={14} color={colors.warningText} />}
                        <Text style={[styles.pillText, { color: ready ? colors.successText : colors.warningText }]}>{ready ? 'Ready' : 'Not ready'}</Text>
                    </View>
                </View>
                <Text style={styles.heroText}>{ready ? 'Every class fits its week. Generate a draft, check it, then publish.' : 'Fix these, then generate.'}</Text>
                {plan.blockers.map((b, i) => (
                    <BlockerRow key={i} blocker={b} busy={fixing} onFix={() => void setBreaks()} onOpen={() => show(b.card)} />
                ))}
                <Notes notes={plan.notes} onOpen={(n) => show(n.card)} />
                <View style={{ marginTop: spacing.md }}>
                    <Button label={generating ? 'Generating…' : plan.drafts > 0 ? 'Generate a new draft' : 'Generate timetable'} onPress={() => void generate()} loading={generating} disabled={!ready} block />
                </View>
            </View>

            <StudioCard viewRef={cardRef('day')} icon={CalendarClock} title="School day" summary={daySummary(plan.day)} state={stateOf('day')} open={open === 'day'} onToggle={() => toggle('day')}>
                <DayStructureEditor key={dayKey} onSaved={() => { void refresh(); setOpen('loads'); }} />
            </StudioCard>
            <StudioCard viewRef={cardRef('loads')} icon={Users} title="Classes & teaching loads" summary={loadsSummary(plan)} state={stateOf('loads')} open={open === 'loads'} onToggle={() => toggle('loads')}>
                <View style={styles.explain}>
                    <Text style={styles.blockTitle}>How electives fit: option blocks</Text>
                    <Text style={styles.fitLine}>Electives in one block run at the same time, each learner in the subject they chose. When a class has more subjects than periods, blocks are worked out for you; set a load’s Option block to choose them yourself.</Text>
                </View>
                <ClassFit
                    plan={plan}
                    onApplied={() => { setDayKey((k) => k + 1); void refresh(); }}
                    onEditLoads={(name) => { setLoadsFilter(name); setTimeout(() => scrollToView(loadsListRef.current), 120); }}
                />
                <TeacherLoads plan={plan} />
                <View ref={loadsListRef} collapsable={false}>
                    <Loads filter={loadsFilter} onChange={() => void refresh()} />
                </View>
            </StudioCard>
            <StudioCard viewRef={cardRef('rooms')} icon={FlaskConical} title="Labs & special rooms" summary={plan.rooms > 0 ? `${plan.rooms} room${plan.rooms === 1 ? '' : 's'}` : 'Optional — skip if lessons stay in class'} state={stateOf('rooms')} open={open === 'rooms'} onToggle={() => toggle('rooms')}>
                <Rooms />
            </StudioCard>
            <StudioCard viewRef={cardRef('drafts')} icon={Layers} title="Drafts & publish" summary={plan.published ? `Published: ${plan.published}` : plan.drafts > 0 ? `${plan.drafts} draft${plan.drafts === 1 ? '' : 's'} — check one and publish` : 'Generate your first draft above'} state={stateOf('drafts')} open={open === 'drafts'} onToggle={() => toggle('drafts')}>
                <TimetableBuilder key={builderKey} />
            </StudioCard>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    hero: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.md },
    heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    heroEyebrow: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted },
    heroTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.foreground, marginTop: 2 },
    heroText: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    pillText: { fontSize: 12, fontFamily: fonts.semibold },
    blocker: { borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.warning, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm, gap: spacing.sm },
    blockerHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    blockerText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.foreground },
    blockerActions: { flexDirection: 'row', justifyContent: 'flex-end' },
    notes: { backgroundColor: colors.mutedBg, borderRadius: radius.md, marginTop: spacing.sm, overflow: 'hidden' },
    notesHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
    notesTitle: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
    note: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, gap: 2 },
    noteText: { fontSize: 12, lineHeight: 17, fontFamily: fonts.medium, color: colors.foreground },
    noteDetail: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, paddingLeft: spacing.sm },
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.card, marginBottom: spacing.md, overflow: 'hidden' },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    cardIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    cardSummary: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    chip: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
    chipText: { fontSize: 11, fontFamily: fonts.bold },
    cardBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
    explain: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
    fit: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: 6 },
    fitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    fitName: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    fitCount: { fontSize: 12, fontFamily: fonts.semibold, color: colors.muted },
    fitLine: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted },
    block: { backgroundColor: colors.mutedBg, borderRadius: radius.md, padding: spacing.sm },
    fitProblem: { fontSize: 13, lineHeight: 19, fontFamily: fonts.semibold, color: colors.foreground },
    fitOption: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4, backgroundColor: colors.card },
    fitOptionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    fitOptionTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    link: { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },
    blockTitle: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
}));
