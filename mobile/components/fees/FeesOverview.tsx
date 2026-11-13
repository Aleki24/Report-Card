import React from 'react';
import { Text, View } from 'react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatCurrency } from '@/lib/format';
import { fonts, spacing, makeStyles, useTheme } from '@/lib/theme';
import { Button, Card, ErrorBanner, ListCard, ListRow, LoadingView, ProgressBar, SectionLabel, StatGrid, StatTile } from '@/components/ui';
import { GRADE_COPY, OVERVIEW_URL, TARGET_RATE, type FeesOverview as Overview, type FixTarget, type TermCollection } from '@shared/fee-overview';

/** Where a fix is done in the app; null when it is web-only. */
export type OverviewTab = 'unmatched' | 'daybook' | 'balances';

const tabFor = (target: FixTarget): OverviewTab | null =>
    target.kind !== 'tab' ? null : target.tab === 'reconcile' ? 'unmatched' : target.tab === 'daybook' ? 'daybook' : 'balances';

const termLabel = (t: TermCollection) => `${t.termName}${t.yearName ? ` ${t.yearName}` : ''}`;

/**
 * The web's fees Overview: the health score out of 100 with the three fixes
 * that would lift it most, this term's collection against last term's, and
 * what is owed by class.
 */
export function FeesOverview({ onGo }: { onGo: (tab: OverviewTab) => void }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const query = useApiQuery<Overview>(OVERVIEW_URL);
    if (query.loading && !query.data) return <LoadingView />;
    if (!query.data) return <ErrorBanner message={query.error ?? 'Could not load the overview'} onRetry={query.reload} />;

    const { current, previous, health } = query.data;
    const grade = GRADE_COPY[health.grade];
    const tone = { emerald: colors.success, amber: colors.warning, rose: colors.danger }[grade.hue];
    const rateTone = (rate: number) => (rate >= TARGET_RATE ? colors.success : rate >= 50 ? colors.warning : colors.danger);
    const change = current && previous && previous.expected > 0 ? current.rate - previous.rate : null;

    return (
        <View>
            <Card>
                <Text style={styles.eyebrow}>Fees health</Text>
                <Text style={styles.score}>{health.score}<Text style={styles.outOf}>  out of 100</Text></Text>
                <ProgressBar value={health.score} color={tone} />
                <Text style={[styles.grade, { color: tone }]}>{grade.label}</Text>
            </Card>

            <SectionLabel>{health.fixes.length > 0 ? 'Fix these first' : 'Nothing urgent'}</SectionLabel>
            <ListCard>
                {health.fixes.length === 0 ? <ListRow title="Money is matched, checked and chased." /> : health.fixes.map((item, i) => {
                    const tab = tabFor(item.target);
                    return (
                        <ListRow
                            key={item.id}
                            title={`${i + 1}. ${item.label}`}
                            subtitle={`${item.detail} ${item.fix}`}
                            right={tab ? <Button size="sm" variant="secondary" label="Go" onPress={() => onGo(tab)} /> : null}
                        />
                    );
                })}
            </ListCard>

            <StatGrid>
                <StatTile label="Billed this term" value={current ? formatCurrency(current.expected) : '—'} sub={current ? termLabel(current) : 'No current term'} />
                <StatTile label="Collected" value={current ? `${current.rate}%` : '—'} sub={current ? `${formatCurrency(current.collected)}${change !== null && previous ? ` · ${change >= 0 ? '+' : '−'}${Math.abs(change)} pts on ${previous.termName}` : ''}` : undefined} />
                <StatTile label="Owed, all terms" value={formatCurrency(query.data.totalOwed)} sub={`${query.data.learnersOwing.toLocaleString()} learners owing`} />
                <StatTile label="Paid nothing" value={current ? current.paidNothing : '—'} sub="billed this term" />
            </StatGrid>

            <SectionLabel>Collection rate</SectionLabel>
            <Card>
                {[current, previous].filter((t): t is TermCollection => !!t).map((t, i) => (
                    <View key={t.termId} style={{ marginBottom: spacing.md }}>
                        <Text style={styles.body}>{termLabel(t)}{i === 0 ? ' (this term)' : ''}: {t.rate}%</Text>
                        <ProgressBar value={t.rate} color={rateTone(t.rate)} />
                        <Text style={styles.muted}>{formatCurrency(t.collected)} of {formatCurrency(t.expected)} · {t.paidNothing} paid nothing</Text>
                    </View>
                ))}
                <Text style={styles.muted}>Target: {TARGET_RATE}% collected.</Text>
            </Card>

            {query.data.arrearsByClass.length > 0 ? (
                <>
                    <SectionLabel>Owed by class</SectionLabel>
                    <ListCard>
                        {query.data.arrearsByClass.map((b) => (
                            <ListRow key={b.key} title={b.label} subtitle={`${b.count} learners owing`} right={<Text style={styles.amount}>{formatCurrency(b.amount)}</Text>} />
                        ))}
                    </ListCard>
                </>
            ) : null}

            <SectionLabel>How the score is made</SectionLabel>
            <ListCard>
                {health.items.map((item) => (
                    <ListRow
                        key={item.id}
                        title={item.label}
                        subtitle={item.detail}
                        right={<Text style={[styles.amount, { color: item.status === 'ok' ? colors.success : item.status === 'warn' ? colors.warning : colors.danger }]}>{Math.round(item.points)}/{item.weight}</Text>}
                    />
                ))}
            </ListCard>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
    score: { fontFamily: fonts.bold, fontSize: 48, color: colors.foreground, marginVertical: spacing.xs },
    outOf: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
    grade: { fontFamily: fonts.semibold, fontSize: 14, marginTop: spacing.sm },
    body: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground, marginBottom: 4 },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
    amount: { fontFamily: fonts.semibold, fontSize: 13, color: colors.foreground },
}));
