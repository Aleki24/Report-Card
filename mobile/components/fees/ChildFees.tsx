import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Info, Receipt } from 'lucide-react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { useDownload } from '@/lib/useDownload';
import { errorMessage, formatDate } from '@/lib/format';
import { radius, spacing, fonts, makeStyles, useTheme } from '@/lib/theme';
import { Button, ButtonRow, ErrorBanner, LoadingView, Notice } from '@/components/ui';
import type { PaymentSettingsStatus } from '@/lib/types';
import {
    balanceState, feeAccountUrl, feeReceiptUrl, feeStatementUrl, formatKsh, methodLabel,
    type FeeAccountResponse,
} from '@shared/fee-account';
import { PayPanel, type PayableFee } from './PayPanel';

/** Receipts listed here; older ones are on the statement. */
const RECENT_RECEIPTS = 6;

/**
 * A child's fees for their parent, as on the web portal: the balance across
 * every term, each term with Pay when the school takes M-Pesa or Pesapal,
 * the latest receipts, the statement, and how else to pay.
 */
export function ChildFees({ studentId, provider, onPaid }: { studentId: string; provider: PaymentSettingsStatus['provider']; onPaid?: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const download = useDownload();
    const account = useApiQuery<FeeAccountResponse>(feeAccountUrl(studentId), { raw: true });
    const [paying, setPaying] = useState<PayableFee | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [failure, setFailure] = useState<string | null>(null);

    if (account.loading && !account.data) return <LoadingView />;
    if (account.error) return <ErrorBanner message={account.error} onRetry={account.reload} />;
    const data = account.data;
    if (!data) return null;
    if (data.terms.length === 0) return <Text style={styles.muted}>No fees billed yet.</Text>;

    const state = balanceState(data.totals.balance);
    const tone = state === 'owing' ? colors.warning : colors.success;
    const canPay = provider !== 'NONE';
    const owing = data.terms.filter((t) => t.balance > 0);
    const fileName = (data.learner.admissionNumber || data.learner.name).replace(/[^\w-]+/g, '_');

    const save = async (key: string, path: string, name: string) => {
        setBusy(key);
        setFailure(null);
        try {
            await download(path, name);
        } catch (err) {
            setFailure(errorMessage(err, 'Download failed'));
        } finally {
            setBusy(null);
        }
    };
    const payTerm = (t: FeeAccountResponse['terms'][number]): PayableFee => ({ id: t.feeId, termName: t.termName, balance: t.balance, learnerName: data.learner.name });
    const paid = () => {
        account.refresh();
        onPaid?.();
    };

    return (
        <View style={{ gap: spacing.md }}>
            {failure ? <Notice tone="danger" message={failure} onDismiss={() => setFailure(null)} /> : null}

            <View style={[styles.balance, { borderColor: tone, backgroundColor: state === 'owing' ? colors.warningBg : colors.successBg }]}>
                <Text style={styles.label}>{state === 'credit' ? 'In credit' : 'Balance to pay'}</Text>
                <Text style={[styles.amount, { color: state === 'owing' ? colors.warningText : colors.successText }]}>
                    {state === 'clear' ? 'All paid' : formatKsh(Math.abs(data.totals.balance))}
                </Text>
                <Text style={styles.muted}>
                    {formatKsh(data.totals.paid)} paid of {formatKsh(data.totals.billed)} across {data.terms.length} {data.terms.length === 1 ? 'term' : 'terms'}
                </Text>
                <ButtonRow>
                    <Button size="sm" variant="secondary" label="Statement" onPress={() => void save('statement', feeStatementUrl(studentId), `Fee_statement_${fileName}.pdf`)} loading={busy === 'statement'} />
                    {canPay && owing.length > 0 ? (
                        // The oldest term owing first, so arrears clear before the current bill.
                        <Button size="sm" label={`Pay ${owing[0].termName}`} onPress={() => setPaying(payTerm(owing[0]))} />
                    ) : null}
                </ButtonRow>
            </View>

            <View>
                {[...data.terms].reverse().map((t, n) => {
                    const termState = balanceState(t.balance);
                    return (
                        <View key={t.feeId}>
                            <View style={[styles.row, n > 0 && styles.rowBorder]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.title}>{t.termName}{t.yearName ? ` · ${t.yearName}` : ''}</Text>
                                    <Text style={styles.muted}>{formatKsh(t.paid)} of {formatKsh(t.billed)}{t.dueDate ? ` · due ${formatDate(t.dueDate)}` : ''}</Text>
                                </View>
                                <Text style={[styles.title, { color: termState === 'owing' ? colors.warningText : colors.successText }]}>
                                    {termState === 'owing' ? formatKsh(t.balance) : termState === 'credit' ? `${formatKsh(-t.balance)} credit` : 'Paid'}
                                </Text>
                                {canPay && termState === 'owing' && paying?.id !== t.feeId ? (
                                    <Button size="sm" variant="secondary" label="Pay" onPress={() => setPaying(payTerm(t))} />
                                ) : null}
                            </View>
                            {/* The payment opens under the term being paid. */}
                            {paying?.id === t.feeId ? (
                                <PayPanel key={t.feeId} fee={paying} provider={provider} onClose={() => setPaying(null)} onPaid={paid} />
                            ) : null}
                        </View>
                    );
                })}
            </View>

            {data.payments.length > 0 ? (
                <View>
                    <Text style={styles.section}>Receipts</Text>
                    {data.payments.slice(0, RECENT_RECEIPTS).map((p, n) => (
                        <View key={p.id} style={[styles.row, n > 0 && styles.rowBorder]}>
                            <Receipt size={16} color={colors.success} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>{formatKsh(p.amount)}<Text style={styles.muted}>  {methodLabel(p.method)}</Text></Text>
                                <Text style={styles.muted} numberOfLines={1}>{formatDate(p.paidAt)} · {p.receiptNumber}</Text>
                            </View>
                            <Button
                                size="sm"
                                variant="ghost"
                                label="Receipt"
                                onPress={() => void save(p.id, feeReceiptUrl(p.id), `Receipt_${p.receiptNumber}.pdf`)}
                                loading={busy === p.id}
                            />
                        </View>
                    ))}
                    {data.payments.length > RECENT_RECEIPTS ? <Text style={styles.muted}>Older receipts are on the statement.</Text> : null}
                </View>
            ) : null}

            {data.howToPay.length > 0 ? (
                <View style={[styles.howTo, { backgroundColor: colors.mutedBg }]}>
                    <Info size={14} color={colors.primary} />
                    <View style={{ flex: 1, gap: 4 }}>
                        {data.howToPay.map((line) => <Text key={line} selectable style={styles.muted}>{line}</Text>)}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    balance: { borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: 2 },
    label: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
    amount: { fontSize: 26, fontFamily: fonts.display, marginVertical: 2 },
    title: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground, flexShrink: 1 },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    section: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    howTo: { flexDirection: 'row', gap: spacing.sm, borderRadius: radius.xl, padding: spacing.md },
}));
