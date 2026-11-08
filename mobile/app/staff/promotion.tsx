import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, CalendarDays, CircleCheck, Hourglass, School } from 'lucide-react-native';
import {
    OUTCOME_COPY, PROMOTION_URL, confirmCopy, hasSeniorStayers, nextGradeToAdd, pageDescription, planStatus, runLabel, tallyOutcomes, undoCopy,
    type PromotionCounts, type PromotionGrade, type PromotionOverview, type PromotionUndoResult,
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
    BackLink, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, IconTile, LoadingView, Notice,
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

/** The outcome tallies worth showing, shared by the plan and the finished run. */
function OutcomeTiles({ counts, grades }: { counts: PromotionCounts; grades: readonly PromotionGrade[] }) {
    const { tones } = useTheme();
    return (
        <StatGrid>
            {tallyOutcomes(grades, counts).map((o) => {
                const meta = OUTCOME_COPY[o];
                return <StatTile key={o} label={meta.tally} value={counts[meta.count]} sub={meta.hint} icon={OUTCOME_ICONS[o]} tone={tones[meta.hue].fg} />;
            })}
        </StatGrid>
    );
}

function PromotionContent() {
    const [yearId, setYearId] = useState<string | null>(null);
    const overview = useApiQuery<PromotionOverview>(yearId ? `${PROMOTION_URL}?year=${encodeURIComponent(yearId)}` : PROMOTION_URL);
    const [message, setMessage] = useState<Message | null>(null);
    const data = overview.data;
    const after = (m: Message) => { setMessage(m); overview.refresh(); };

    if (overview.loading && !data) return <LoadingView />;

    const year = data?.academicYear ?? null;
    const showYears = !!year && !!data && data.years.length > 1 && data.stage !== 'PENDING';

    return (
        <Screen onRefresh={overview.refresh} refreshing={overview.refreshing}>
            <BackLink label="Classes" />
            <ScreenHeader title="Promote students" eyebrow="School" hue="amber" icon={ArrowUpRight} description={pageDescription(data)} />
            {overview.error ? <ErrorBanner message={overview.error} onRetry={overview.reload} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

            {data && !year ? (
                <EmptyState icon={CalendarDays} title="No academic year yet" description="Promotion closes an academic year. Add the current year under Settings first." />
            ) : null}
            {showYears ? (
                <View style={{ marginBottom: spacing.md }}>
                    <ChipSelect label="Year being closed" options={data.years.map((y) => ({ value: y.id, label: y.name }))} value={year.id} onChange={setYearId} />
                </View>
            ) : null}
            {data && year && data.grades.length === 0 && data.stage !== 'DONE' ? (
                <EmptyState icon={School} title="No classes yet" description="Add your grades and classes first; promotion moves learners between them." />
            ) : null}
            {data && year && (data.grades.length > 0 || data.stage === 'DONE') ? (
                <View style={{ gap: spacing.lg }}>
                    {/* What the year's promotion did; absent only for learners set to pending by hand. */}
                    {data.run ? <PromotionSummary data={data} onUndone={after} /> : null}
                    {/* Keyed so a fresh plan starts after a step or an undo. */}
                    {data.stage !== 'DONE' ? <PromotionPlanner key={`${year.id}:${data.stage}:${data.run?.id ?? ''}`} data={data} onDone={after} /> : null}
                </View>
            ) : null}
        </Screen>
    );
}

/** What the year's promotion has done so far, and a way back from its latest step. */
function PromotionSummary({ data, onUndone }: { data: PromotionOverview; onUndone: (m: Message) => void }) {
    const api = useApi();
    const router = useRouter();
    const styles = useStyles();
    const [busy, setBusy] = useState(false);
    const run = data.run;
    const undoText = run ? undoCopy(run) : null;

    const undo = async () => {
        if (!run || !undoText) return;
        if (!(await askConfirm(undoText.title, undoText.message, undoText.button))) return;
        setBusy(true);
        try {
            const result = (await api.del<{ data: PromotionUndoResult }>(`${PROMOTION_URL}/${run.id}`)).data;
            const skipped = result.skipped > 0 ? ` ${pluralize(result.skipped, 'learner')} had changed since and were left as they are.` : '';
            onUndone({ tone: result.skipped > 0 ? 'warning' : 'success', text: `${undoText.done}: ${pluralize(result.restored, 'learner')} put back.${skipped}` });
        } catch (err) {
            onUndone({ tone: 'danger', text: errorMessage(err, 'Could not undo the promotion.') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={{ gap: spacing.md }}>
            <Card>
                <View style={styles.head}>
                    <IconTile icon={CircleCheck} hue="emerald" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Learners promoted for {data.academicYear?.name}</Text>
                        <Text style={styles.body}>
                            {run ? `Last step ${formatDate(run.created_at)}${run.run_by ? ` by ${run.run_by}` : ''}. ` : ''}Graduates and transfers are archived: find them under People by their status.
                        </Text>
                    </View>
                </View>
                <ButtonRow>
                    <Button variant="secondary" label="Open People" onPress={() => router.push('/staff/people')} />
                    {undoText ? <Button variant="danger" label={undoText.button} onPress={() => void undo()} loading={busy} /> : null}
                </ButtonRow>
            </Card>
            {data.totals ? <OutcomeTiles counts={data.totals} grades={data.grades} /> : null}
            {data.stage === 'DONE' ? (
                <>
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
                </>
            ) : null}
        </View>
    );
}

/** The plan for every grade (or every pending learner), and the button that applies it. */
function PromotionPlanner({ data, onDone }: { data: PromotionOverview; onDone: (m: Message) => void }) {
    const api = useApi();
    const router = useRouter();
    const styles = useStyles();
    const { colors } = useTheme();
    const plan = usePromotionPlan(data.grades);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const toAdd = nextGradeToAdd(data.grades);
    const status = planStatus(plan, data.stage);
    const pendingStage = data.stage === 'PENDING';
    const needle = query.trim().toLowerCase();

    const run = async () => {
        const copy = confirmCopy(plan, data.stage);
        if (!(await askConfirm(copy.title, copy.lines.join('\n\n'), pendingStage ? 'Decide learners' : 'Promote learners'))) return;
        setBusy(true);
        try {
            await api.post(PROMOTION_URL, { academic_year_id: data.academicYear!.id, decisions: plan.decisions() });
            onDone({ tone: 'success', text: pendingStage ? 'Pending learners decided.' : `Learners promoted for ${data.academicYear!.name}.` });
        } catch (err) {
            onDone({ tone: 'danger', text: errorMessage(err, 'Could not promote the learners.') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <View>
            {pendingStage ? (
                <Card>
                    <View style={styles.head}>
                        <IconTile icon={Hourglass} hue="amber" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{pluralize(plan.total, 'learner')} pending</Text>
                            <Text style={styles.body}>They keep their class and records but are off class lists, attendance, fees and SMS. Decide them when you are ready; anyone you leave stays pending.</Text>
                        </View>
                    </View>
                </Card>
            ) : (
                <OutcomeTiles counts={plan.counts} grades={data.grades} />
            )}
            {toAdd ? (
                <Card style={{ marginTop: spacing.md }}>
                    <Text style={styles.tipTitle}>{toAdd.title}</Text>
                    <Text style={styles.body}>{toAdd.body}</Text>
                    <ButtonRow><Button size="sm" variant="secondary" label={`Add ${toAdd.nextGradeName}`} onPress={() => router.push('/staff/classes')} /></ButtonRow>
                </Card>
            ) : null}
            <View style={{ marginVertical: spacing.md }}>
                <SearchField value={query} onChangeText={setQuery} placeholder="Find a learner by name or admission number" />
            </View>
            {data.grades.map((g) => <GradePromotionCard key={g.id} grade={g} plan={plan} query={needle} />)}

            <View style={styles.footer}>
                <Text style={[styles.body, !status.ready && { color: colors.warning, fontFamily: fonts.semibold }]}>{status.text}</Text>
                <Button block label={runLabel(plan, data.stage)} onPress={() => void run()} loading={busy} disabled={!status.ready} />
            </View>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    head: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    title: { fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    tipTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground, marginBottom: 4 },
    body: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted },
    footer: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.card, padding: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
}));
