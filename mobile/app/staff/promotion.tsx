import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, CalendarDays, CircleCheck, School } from 'lucide-react-native';
import {
    OUTCOME_COPY, OUTCOME_ORDER, PROMOTION_URL, archivesLearner, confirmCopy, hasSeniorStayers, missingSeniorGrade,
    type PromotionCounts, type PromotionOverview, type PromotionUndoResult,
} from '@shared/promotion';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { askConfirm } from '@/lib/confirm';
import { errorMessage, formatDate, pluralize } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { usePromotionPlan } from '@/lib/usePromotionPlan';
import { RequireScreen } from '@/components/RequireScreen';
import { GradePromotionCard, OUTCOME_ICONS } from '@/components/promotion/GradePromotionCard';
import {
    BackLink, Button, ButtonRow, Card, EmptyState, ErrorBanner, IconTile, LoadingView, Notice,
    Screen, ScreenHeader, SearchField, StatGrid, StatTile,
} from '@/components/ui';

/** Opened from Classes, so it has the same access (admins). */
export default function PromotionScreen() {
    return (
        <RequireScreen screen="classes">
            <PromotionContent />
        </RequireScreen>
    );
}

type Message = { tone: 'success' | 'warning' | 'danger'; text: string };

/** The four outcome tallies, shared by the plan and the finished run. */
function OutcomeTiles({ counts }: { counts: PromotionCounts }) {
    const { tones } = useTheme();
    return (
        <StatGrid>
            {OUTCOME_ORDER.map((o) => {
                const meta = OUTCOME_COPY[o];
                return <StatTile key={o} label={meta.tally} value={counts[meta.count]} sub={archivesLearner(o) ? 'archived' : 'stay active'} icon={OUTCOME_ICONS[o]} tone={tones[meta.hue].fg} />;
            })}
        </StatGrid>
    );
}

function PromotionContent() {
    const overview = useApiQuery<PromotionOverview>(PROMOTION_URL);
    const [message, setMessage] = useState<Message | null>(null);
    const data = overview.data;

    if (overview.loading && !data) return <LoadingView />;

    return (
        <Screen onRefresh={overview.refresh} refreshing={overview.refreshing}>
            <BackLink label="Classes" />
            <ScreenHeader
                title="Promote students"
                eyebrow="School"
                hue="amber"
                icon={ArrowUpRight}
                description={data?.academicYear
                    ? `Close ${data.academicYear.name}: learners move up a class, candidates graduate and are archived, and Grade 9s stay for Senior School only if you mark them.`
                    : 'Move learners up a class at the end of the year, and archive those who leave.'}
            />
            {overview.error ? <ErrorBanner message={overview.error} onRetry={overview.reload} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

            {data && !data.academicYear ? (
                <EmptyState icon={CalendarDays} title="No academic year yet" description="Promotion closes an academic year. Add the current year under Settings first." />
            ) : null}
            {data?.academicYear && data.grades.length === 0 ? (
                <EmptyState icon={School} title="No classes yet" description="Add your grades and classes first; promotion moves learners between them." />
            ) : null}
            {data?.academicYear && data.grades.length > 0 ? (
                data.run
                    ? <PromotionDone data={data} onUndone={(m) => { setMessage(m); overview.refresh(); }} />
                    // Keyed so a fresh plan starts after an undo.
                    : <PromotionPlanner key={data.academicYear.id} data={data} onDone={(m) => { setMessage(m); overview.refresh(); }} />
            ) : null}
        </Screen>
    );
}

/** This year's promotion has run: what it did, and a way back. */
function PromotionDone({ data, onUndone }: { data: PromotionOverview; onUndone: (m: Message) => void }) {
    const api = useApi();
    const router = useRouter();
    const styles = useStyles();
    const [busy, setBusy] = useState(false);
    const run = data.run!;

    const undo = async () => {
        const ok = await askConfirm(
            'Undo this promotion?',
            'Every learner goes back to the class and status they had before it, including those archived. Anyone you have moved or edited by hand since is left as they are.',
            'Undo promotion',
        );
        if (!ok) return;
        setBusy(true);
        try {
            const result = (await api.del<{ data: PromotionUndoResult }>(`${PROMOTION_URL}/${run.id}`)).data;
            const skipped = result.skipped > 0 ? ` ${pluralize(result.skipped, 'learner')} had changed since and were left as they are.` : '';
            onUndone({ tone: result.skipped > 0 ? 'warning' : 'success', text: `Promotion undone: ${pluralize(result.restored, 'learner')} put back.${skipped}` });
        } catch (err) {
            onUndone({ tone: 'danger', text: errorMessage(err, 'Could not undo the promotion.') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={{ gap: spacing.md }}>
            <Card>
                <View style={styles.doneHead}>
                    <IconTile icon={CircleCheck} hue="emerald" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.doneTitle}>Learners promoted for {data.academicYear?.name}</Text>
                        <Text style={styles.body}>
                            {formatDate(run.created_at)}{run.run_by ? ` by ${run.run_by}` : ''}. Graduates and transfers are archived: find them under People by their status.
                        </Text>
                    </View>
                </View>
                <ButtonRow>
                    <Button variant="secondary" label="Open People" onPress={() => router.push('/staff/people')} />
                    <Button variant="danger" label="Undo promotion" onPress={() => void undo()} loading={busy} />
                </ButtonRow>
            </Card>
            <OutcomeTiles counts={run} />
            <Card>
                <Text style={styles.tipTitle}>Next: set up the new year</Text>
                <Text style={styles.body}>Add the new academic year and its terms, then assign class teachers to the classes your learners moved into.</Text>
                <ButtonRow><Button size="sm" variant="secondary" label="Open Settings" onPress={() => router.push('/staff/settings')} /></ButtonRow>
            </Card>
            {hasSeniorStayers(data.grades) ? (
                <Card>
                    <Text style={styles.tipTitle}>New Senior School learners</Text>
                    <Text style={styles.body}>Learners who stayed for Senior School need a pathway and subject combination before their mark sheets are right.</Text>
                    <ButtonRow><Button size="sm" variant="secondary" label="Learner placement" onPress={() => router.push({ pathname: '/staff/subjects', params: { tab: 'placement' } })} /></ButtonRow>
                </Card>
            ) : null}
        </View>
    );
}

/** The plan for every grade, and the button that applies it. */
function PromotionPlanner({ data, onDone }: { data: PromotionOverview; onDone: (m: Message) => void }) {
    const api = useApi();
    const router = useRouter();
    const styles = useStyles();
    const { colors } = useTheme();
    const plan = usePromotionPlan(data.grades);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const noSenior = missingSeniorGrade(data.grades);
    const needle = query.trim().toLowerCase();

    const run = async () => {
        const copy = confirmCopy(plan);
        if (!(await askConfirm(copy.title, copy.lines.join('\n\n'), 'Promote learners'))) return;
        setBusy(true);
        try {
            await api.post(PROMOTION_URL, { academic_year_id: data.academicYear!.id, decisions: plan.decisions() });
            onDone({ tone: 'success', text: `Learners promoted for ${data.academicYear!.name}.` });
        } catch (err) {
            onDone({ tone: 'danger', text: errorMessage(err, 'Could not promote the learners.') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <View>
            <OutcomeTiles counts={plan.counts} />
            {noSenior ? (
                <Card style={{ marginTop: spacing.md }}>
                    <Text style={styles.tipTitle}>Do some {noSenior.name} learners stay for {noSenior.step.nextLevelName}?</Text>
                    <Text style={styles.body}>Only a school with a {noSenior.step.nextGradeName} class can keep them. Add one first, then come back.</Text>
                    <ButtonRow><Button size="sm" variant="secondary" label={`Add ${noSenior.step.nextGradeName}`} onPress={() => router.push('/staff/classes')} /></ButtonRow>
                </Card>
            ) : null}
            <View style={{ marginVertical: spacing.md }}>
                <SearchField value={query} onChangeText={setQuery} placeholder="Find a learner by name or admission number" />
            </View>
            {data.grades.map((g) => <GradePromotionCard key={g.id} grade={g} plan={plan} query={needle} />)}

            <View style={styles.footer}>
                <Text style={[styles.body, plan.blocked > 0 && { color: colors.warning, fontFamily: fonts.semibold }]}>
                    {plan.blocked > 0
                        ? `${pluralize(plan.blocked, 'learner')} still need${plan.blocked === 1 ? 's' : ''} a decision or a class.`
                        : 'Every learner is decided. Nothing changes until you promote.'}
                </Text>
                <Button block label={`Promote ${pluralize(plan.total, 'learner')}`} onPress={() => void run()} loading={busy} disabled={plan.blocked > 0 || plan.total === 0} />
            </View>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    doneHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    doneTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    tipTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground, marginBottom: 4 },
    body: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted },
    footer: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.card, padding: spacing.md, marginTop: spacing.sm },
}));
