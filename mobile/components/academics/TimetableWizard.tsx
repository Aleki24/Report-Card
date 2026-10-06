import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle, CalendarClock, ChevronDown, FlaskConical, Layers, Users, type LucideIcon } from 'lucide-react-native';
import { humanize, personName } from '@shared/ops/format';
import { basisLine, daySummary, firstCard, loadsSummary, overloadMessage, type StudioCard as StudioCardId, type TimetablePlan } from '@shared/timetable/readiness';
import {
    LOAD_DEFAULTS, LOAD_FIELDS, MINISTRY_LOADS_NOTE, ROOM_DEFAULTS, ROOM_FIELDS, importLoadsMessage, loadLessonsLabel, newDraftName,
    type ImportLoadsResult, type Room, type TeachingLoad,
} from '@shared/ops/forms/academics';
import { Button, ButtonRow, Card, LoadingView, ProgressBar, TextField } from '@/components/ui';
import { useRefreshSignal } from '@/components/ops/bits';
import { ResourceList } from '@/components/ops/ResourceList';
import { useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { DayStructureEditor, TimetableBuilder } from './TimetablePanels';

/** Teaching loads: which teacher takes which subject with which class, and how often. */
function Loads({ onChange }: { onChange: () => void }) {
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
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>Creates a load for every subject each teacher is assigned to a class this year. Adjust any of them below.</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>{MINISTRY_LOADS_NOTE}</Text>
                <TextField label="Other subjects: lessons a week" value={perWeek} onChangeText={setPerWeek} keyboardType="number-pad" />
                <ButtonRow>
                    <Button label={busy === 'import' ? 'Importing…' : 'Import loads'} onPress={() => void importLoads('import')} loading={busy === 'import'} disabled={busy !== null} />
                    <Button variant="secondary" label={busy === 'reset' ? 'Resetting…' : 'Reset to Ministry'} onPress={() => void importLoads('reset')} loading={busy === 'reset'} disabled={busy !== null} />
                </ButtonRow>
            </Card>
            <ResourceList<'timetable-requirements', TeachingLoad>
                key={version}
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

type CardState = 'done' | 'attention' | 'optional' | 'todo';
const STATE_LABEL: Record<CardState, string> = { done: 'Done', attention: 'Needs attention', optional: 'Optional', todo: 'To do' };

/** One part of the studio: a summary line that opens into its editor. */
function StudioCard({ icon: Icon, title, summary, state, open, onToggle, children }: {
    icon: LucideIcon; title: string; summary: string; state: CardState; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const tone = state === 'done' ? { bg: colors.successBg, fg: colors.successText } : state === 'attention' ? { bg: colors.warningBg, fg: colors.warningText } : { bg: colors.mutedBg, fg: colors.muted };
    return (
        <View style={[styles.card, open && { borderColor: colors.primary }]}>
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

/** Each class's week against its periods, with the option blocks its electives run in. */
function ClassFit({ plan }: { plan: TimetablePlan }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View>
            {plan.classes.map((c) => (
                <View key={c.streamId} style={[styles.fit, !c.fits && { borderColor: colors.danger, backgroundColor: colors.dangerBg }]}>
                    <View style={styles.fitHead}>
                        <Text style={styles.fitName}>{c.name}</Text>
                        <Text style={[styles.fitCount, !c.fits && { color: colors.danger, fontFamily: fonts.bold }]}>{c.needed} / {c.capacity} periods</Text>
                    </View>
                    <ProgressBar value={(c.needed / Math.max(1, c.capacity)) * 100} color={c.fits ? colors.success : colors.danger} />
                    <Text style={styles.fitLine}>Whole class: {c.core.map((l) => `${l.subject} ${l.lessons}`).join(' · ') || '—'}</Text>
                    {basisLine(c) ? <Text style={styles.fitLine}>{basisLine(c)}</Text> : null}
                    {!c.fits ? <Text style={[styles.fitLine, { color: colors.danger }]}>{overloadMessage(c)}</Text> : null}
                    {c.blocks.map((b) => (
                        <View key={b.number} style={[styles.block, b.teacherClash && { backgroundColor: colors.warningBg }]}>
                            <Text style={styles.blockTitle}>{b.label}{b.manual ? '' : ' (auto)'} · {b.lessons}/wk</Text>
                            <Text style={styles.fitLine}>{b.loads.map((l) => l.subject).join(' · ')}</Text>
                            {b.teacherClash ? <Text style={[styles.fitLine, { color: colors.warningText }]}>One teacher has two of these at once: move one to another block.</Text> : null}
                        </View>
                    ))}
                    {c.unassigned > 0 ? <Text style={[styles.fitLine, { color: colors.warningText }]}>{c.unassigned} load{c.unassigned === 1 ? '' : 's'} without a teacher.</Text> : null}
                </View>
            ))}
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
            <View style={[styles.hero, { borderColor: ready ? colors.success : colors.warning, backgroundColor: ready ? colors.successBg : colors.warningBg }]}>
                <Text style={styles.heroEyebrow}>{plan.published ? `PUBLISHED: ${plan.published.toUpperCase()}` : 'NOT PUBLISHED YET'}</Text>
                <Text style={styles.heroTitle}>{ready ? 'Ready to generate' : `${plan.blockers.length} thing${plan.blockers.length === 1 ? '' : 's'} to sort first`}</Text>
                <Text style={styles.heroText}>{ready ? 'Every class fits its week. Generate a draft, check it, then publish.' : 'Tap one to open the part of the setup it is about.'}</Text>
                {plan.blockers.map((b, i) => (
                    <Pressable key={i} onPress={() => setOpen(b.card)} style={styles.blocker} accessibilityRole="button">
                        <AlertTriangle size={16} color={colors.warning} />
                        <Text style={styles.blockerText}>{b.message}</Text>
                        <Text style={styles.fix}>Fix</Text>
                    </Pressable>
                ))}
                {plan.notes.length > 0 ? (
                    <View style={[styles.blocker, { flexDirection: 'column', gap: 4 }]}>
                        <Text style={[styles.blockerText, { fontFamily: fonts.bold }]}>Worth checking — these don’t stop generating</Text>
                        {plan.notes.map((n, i) => <Text key={i} style={styles.fitLine} onPress={() => setOpen(n.card)}>• {n.message}</Text>)}
                    </View>
                ) : null}
                <View style={{ marginTop: spacing.md }}>
                    <Button label={generating ? 'Generating…' : plan.drafts > 0 ? 'Generate a new draft' : 'Generate timetable'} onPress={() => void generate()} loading={generating} disabled={!ready} block />
                </View>
            </View>

            <StudioCard icon={CalendarClock} title="School day" summary={daySummary(plan.day)} state={stateOf('day')} open={open === 'day'} onToggle={() => toggle('day')}>
                <DayStructureEditor onSaved={() => { void refresh(); setOpen('loads'); }} />
            </StudioCard>
            <StudioCard icon={Users} title="Classes & teaching loads" summary={loadsSummary(plan)} state={stateOf('loads')} open={open === 'loads'} onToggle={() => toggle('loads')}>
                <View style={styles.explain}>
                    <Text style={styles.blockTitle}>How electives fit: option blocks</Text>
                    <Text style={styles.fitLine}>Electives in one block run at the same time, each learner in the subject they chose. When a class has more subjects than periods, blocks are worked out for you; set a load’s Option block to choose them yourself.</Text>
                </View>
                <ClassFit plan={plan} />
                <Loads onChange={() => void refresh()} />
            </StudioCard>
            <StudioCard icon={FlaskConical} title="Labs & special rooms" summary={plan.rooms > 0 ? `${plan.rooms} room${plan.rooms === 1 ? '' : 's'}` : 'Optional — skip if lessons stay in class'} state={stateOf('rooms')} open={open === 'rooms'} onToggle={() => toggle('rooms')}>
                <Rooms />
            </StudioCard>
            <StudioCard icon={Layers} title="Drafts & publish" summary={plan.published ? `Published: ${plan.published}` : plan.drafts > 0 ? `${plan.drafts} draft${plan.drafts === 1 ? '' : 's'} — check one and publish` : 'Generate your first draft above'} state={stateOf('drafts')} open={open === 'drafts'} onToggle={() => toggle('drafts')}>
                <TimetableBuilder key={builderKey} />
            </StudioCard>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    hero: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md },
    heroEyebrow: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, letterSpacing: 1 },
    heroTitle: { fontSize: 20, fontFamily: fonts.display, color: colors.foreground, marginTop: 2, letterSpacing: -0.3 },
    heroText: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    blocker: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
    blockerText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: fonts.regular, color: colors.foreground },
    fix: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
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
    blockTitle: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
}));
