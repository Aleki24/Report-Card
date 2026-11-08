import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { errorMessage, formatCurrency, formatDate } from '@/lib/format';
import { fonts, spacing, makeStyles } from '@/lib/theme';
import { Badge, Button, ButtonRow, Card, EmptyState, ErrorBanner, ListRow, LoadingView, Notice, SearchField, TextField } from '@/components/ui';
import { MATCH_REASON_LABELS } from '@shared/fee-matching';
import { UNMATCHED_URL, unmatchedAsLine, type DirectoryLearner, type PreviewLine, type UnmatchedResponse } from '@shared/fee-reconcile';
import { decisionProblem, queuePlan, recordTo, splitBetween, withShare, type ReconcilePlan } from '@shared/fee-reconcile-plan';

const learnerLine = (l: Pick<DirectoryLearner, 'name' | 'admissionNumber' | 'className'>) =>
    [l.name, l.admissionNumber ? `Adm ${l.admissionNumber}` : null, l.className].filter(Boolean).join(' · ');

/** At least this long to say why money is not school fees. */
const MIN_REASON = 3;

/**
 * Paybill money no learner has yet, each with who it most likely belongs to
 * (a mistyped admission number, the parent's phone, the payer's name), as on
 * the web's Reconcile tab: pick a learner, share it between brothers and
 * sisters, or set it aside as not school fees.
 */
export function UnmatchedQueue({ onChanged }: { onChanged?: () => void }) {
    const styles = useStyles();
    const api = useApi();
    const { can } = useCurrentUser();
    const canAssign = can('fees.collect');
    const canSetAside = can('fees.manage');
    const query = useApiQuery<UnmatchedResponse>(UNMATCHED_URL, { raw: true });
    const payments = useMemo(() => query.data?.data ?? [], [query.data]);
    const lines = useMemo(() => payments.map((p, i) => unmatchedAsLine(p, i, query.data?.suggestions?.[p.id] ?? [])), [payments, query.data]);
    const learners = useMemo(() => query.data?.learners ?? [], [query.data]);
    const byId = useMemo(() => new Map(learners.map((l) => [l.id, l] as const)), [learners]);

    const [plan, setPlan] = useState<ReconcilePlan>({});
    useEffect(() => { setPlan(queuePlan(lines)); }, [lines]);
    const [open, setOpen] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [aside, setAside] = useState<{ id: string; reason: string } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    const act = async (id: string, run: () => Promise<unknown>, done: string) => {
        setBusy(id);
        setMessage(null);
        try {
            await run();
            setMessage({ tone: 'success', text: done });
            setOpen(null);
            setAside(null);
            query.refresh();
            onChanged?.();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Something went wrong') });
        } finally {
            setBusy(null);
        }
    };

    if (query.loading) return <LoadingView />;
    if (query.error && !query.data) return <ErrorBanner message={query.error} onRetry={query.reload} />;
    if (payments.length === 0) return <EmptyState title="Nothing unmatched" description="Every payment is on a learner." />;

    const q = search.trim().toLowerCase();
    const found = q ? learners.filter((l) => `${l.name} ${l.admissionNumber ?? ''} ${l.className ?? ''}`.toLowerCase().includes(q)).slice(0, 6) : [];
    const total = payments.reduce((n, p) => n + p.amount, 0);

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <Text style={styles.lead}>{payments.length} waiting · {formatCurrency(total)}. Match them this week, before parents ask.</Text>
            {payments.map((p, i) => {
                const line: PreviewLine = lines[i];
                const decision = plan[line.line];
                const chosen = decision?.action === 'RECORD' ? decision.allocations : [];
                const problem = decision?.action === 'RECORD' ? decisionProblem(line, decision) : null;
                const isOpen = open === p.id;
                return (
                    <Card key={p.id}>
                        <ListRow
                            title={`${formatCurrency(p.amount)} · ${line.accountRef ? `typed “${line.accountRef}”` : 'no account number'}`}
                            subtitle={`${formatDate(p.paidAt)} · ${[p.payerName, p.phoneNumber].filter(Boolean).join(' · ') || 'payer not shown'}${line.code ? ` · ${line.code}` : ''}`}
                            right={<Badge label={line.candidates.length > 0 ? 'Check' : 'No match'} variant={line.candidates.length > 0 ? 'warning' : 'danger'} />}
                            onPress={() => { setOpen(isOpen ? null : p.id); setSearch(''); }}
                        />
                        {chosen.length > 0 ? (
                            <Text style={styles.chosen}>
                                {chosen.length > 1 ? 'Shared: ' : 'To: '}{chosen.map((a) => `${byId.get(a.studentId)?.name ?? 'a learner'}${chosen.length > 1 ? ` ${formatCurrency(a.amount)}` : ''}`).join(', ')}
                            </Text>
                        ) : null}
                        {isOpen ? (
                            <View style={styles.panel}>
                                {line.candidates.map((c) => {
                                    const l = byId.get(c.studentId);
                                    const on = chosen.length === 1 && chosen[0].studentId === c.studentId;
                                    return (
                                        <ListRow
                                            key={c.studentId}
                                            title={l ? learnerLine(l) : 'A learner'}
                                            subtitle={`${MATCH_REASON_LABELS[c.reason]}${l ? ` · balance ${formatCurrency(l.balance)}` : ''}`}
                                            right={<Button size="sm" variant={on ? 'primary' : 'secondary'} label={on ? 'Chosen' : 'Choose'} onPress={() => setPlan((pl) => recordTo(pl, line, c.studentId))} />}
                                        />
                                    );
                                })}
                                {line.candidates.length > 1 ? (
                                    <ButtonRow align="start">
                                        <Button size="sm" variant="secondary" label="Split between them" onPress={() => setPlan((pl) => splitBetween(pl, line, line.candidates.map((c) => c.studentId)))} />
                                    </ButtonRow>
                                ) : null}
                                {chosen.length > 1 ? chosen.map((a) => (
                                    <TextField
                                        key={a.studentId}
                                        label={`Share for ${byId.get(a.studentId)?.name ?? 'this learner'} (KES)`}
                                        value={String(a.amount)}
                                        keyboardType="decimal-pad"
                                        onChangeText={(text) => setPlan((pl) => withShare(pl, line, a.studentId, Number(text.replace(/[^0-9.]/g, '')) || 0))}
                                    />
                                )) : null}
                                <SearchField value={search} onChangeText={setSearch} placeholder="Someone else: name or admission no." />
                                {found.map((l) => (
                                    <ListRow
                                        key={l.id}
                                        title={learnerLine(l)}
                                        subtitle={`balance ${formatCurrency(l.balance)}`}
                                        right={
                                            <View style={{ flexDirection: 'row', gap: 4 }}>
                                                <Button size="sm" variant="secondary" label="Choose" onPress={() => { setPlan((pl) => recordTo(pl, line, l.id)); setSearch(''); }} />
                                                {chosen.length > 0 && !chosen.some((a) => a.studentId === l.id) ? (
                                                    <Button size="sm" variant="ghost" label="Add" onPress={() => { setPlan((pl) => splitBetween(pl, line, [...chosen.map((a) => a.studentId), l.id])); setSearch(''); }} />
                                                ) : null}
                                            </View>
                                        }
                                    />
                                ))}
                                {problem ? <Text style={styles.problem}>{problem}</Text> : null}
                                {aside?.id === p.id ? (
                                    <View style={{ gap: spacing.sm }}>
                                        <TextField label="Why it is not school fees" value={aside.reason} onChangeText={(reason) => setAside({ id: p.id, reason })} placeholder="Refunded to the parent, paid in error…" />
                                        <ButtonRow>
                                            <Button variant="secondary" label="Cancel" onPress={() => setAside(null)} />
                                            <Button
                                                variant="danger" label="Set aside" loading={busy === p.id} disabled={aside.reason.trim().length < MIN_REASON}
                                                onPress={() => void act(p.id, () => api.post(`${UNMATCHED_URL}/${p.id}/resolve`, { reason: aside.reason.trim() }), 'Set aside as not school fees.')}
                                            />
                                        </ButtonRow>
                                    </View>
                                ) : (
                                    <ButtonRow>
                                        {canSetAside ? <Button variant="secondary" label="Not school fees" onPress={() => setAside({ id: p.id, reason: '' })} /> : null}
                                        {canAssign ? (
                                            <Button
                                                label={chosen.length > 1 ? `Share between ${chosen.length}` : 'Assign'}
                                                loading={busy === p.id}
                                                disabled={chosen.length === 0 || !!problem}
                                                onPress={() => void act(
                                                    p.id,
                                                    () => api.post(`${UNMATCHED_URL}/${p.id}/assign`, { allocations: chosen }),
                                                    chosen.length > 1 ? `Shared between ${chosen.length} learners.` : `Assigned to ${byId.get(chosen[0].studentId)?.name ?? 'the learner'}.`,
                                                )}
                                            />
                                        ) : null}
                                    </ButtonRow>
                                )}
                            </View>
                        ) : null}
                    </Card>
                );
            })}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    lead: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
    chosen: { fontFamily: fonts.semibold, fontSize: 12, color: colors.success, marginTop: 2 },
    panel: { gap: spacing.sm, marginTop: spacing.sm },
    problem: { fontFamily: fonts.semibold, fontSize: 12, color: colors.warning },
}));
