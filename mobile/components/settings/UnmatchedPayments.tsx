import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FeePayment } from '@shared/fees';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useTerms } from '@/lib/useSchoolData';
import { errorMessage, formatCurrency } from '@/lib/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { Button, Card, ChipSelect, EmptyState, ErrorBanner, LoadingView, Notice, SectionLabel, TextField } from '@/components/ui';

/** The parts of GET /api/school/fees?term_id= used to find a learner's bill. */
interface TermFee { id: string; admissionNumber: string | null }

/**
 * The web's "Unmatched payments" (Settings → Payments): money confirmed by the
 * provider but not matched to a learner's current-term bill, assigned by hand
 * with an admission number and a term (/api/school/fees/unmatched).
 */
export function UnmatchedPayments() {
    const api = useApi();
    const query = useApiQuery<FeePayment[]>('/api/school/fees/unmatched');
    const { terms, activeTermId } = useTerms();
    const [admission, setAdmission] = useState<Record<string, string>>({});
    const [termFor, setTermFor] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    const assign = async (payment: FeePayment) => {
        const adm = (admission[payment.id] ?? '').trim();
        const termId = termFor[payment.id] ?? activeTermId;
        if (!adm || !termId) { setNotice({ tone: 'danger', text: 'Enter an admission number and pick a term.' }); return; }
        setBusy(payment.id);
        setNotice(null);
        try {
            const fees = await api.get<{ data?: TermFee[] }>(withQuery('/api/school/fees', { term_id: termId }));
            const match = (fees.data ?? []).find((f) => f.admissionNumber?.toLowerCase() === adm.toLowerCase());
            if (!match) {
                setNotice({ tone: 'danger', text: 'No fee record found for that admission number in this term. Create one from the Fees list first.' });
                return;
            }
            await api.post(`/api/school/fees/unmatched/${payment.id}/assign`, { student_fee_id: match.id });
            setNotice({ tone: 'success', text: `${formatCurrency(payment.amount)} assigned to ${adm}.` });
            query.refresh();
        } catch (err) {
            setNotice({ tone: 'danger', text: errorMessage(err, 'Failed to assign payment') });
        } finally {
            setBusy(null);
        }
    };

    const payments = query.data ?? [];
    return (
        <>
            <SectionLabel>Unmatched payments</SectionLabel>
            <Text style={styles.intro}>Money confirmed but not yet matched to a student’s current-term bill.</Text>
            {notice ? <Notice tone={notice.tone} message={notice.text} onDismiss={() => setNotice(null)} /> : null}
            {query.loading ? <LoadingView /> : query.error ? <ErrorBanner message={query.error} onRetry={query.reload} /> : payments.length === 0 ? (
                <Card><EmptyState title="Nothing to reconcile" description="All payments matched automatically." /></Card>
            ) : payments.map((p) => (
                <Card key={p.id} style={{ marginBottom: spacing.sm }}>
                    <View style={styles.head}>
                        <Text style={styles.amount}>{formatCurrency(p.amount)}</Text>
                        <Text style={styles.date}>{new Date(p.paidAt).toLocaleDateString('en-GB')}</Text>
                    </View>
                    <Text style={styles.meta}>Ref “{p.unmatchedAccountReference ?? '—'}” · {p.phoneNumber || 'no phone'}{p.payerName ? ` · ${p.payerName}` : ''}</Text>
                    <TextField
                        label="Admission number"
                        value={admission[p.id] ?? ''}
                        onChangeText={(v) => setAdmission((prev) => ({ ...prev, [p.id]: v }))}
                        placeholder="e.g. 2024/0153"
                        autoCapitalize="characters"
                    />
                    <ChipSelect
                        label="Term"
                        options={terms.map((t) => ({ value: t.id, label: t.name }))}
                        value={termFor[p.id] ?? activeTermId ?? null}
                        onChange={(id) => setTermFor((prev) => ({ ...prev, [p.id]: id }))}
                    />
                    <Button label="Assign payment" onPress={() => void assign(p)} loading={busy === p.id} block />
                </Card>
            ))}
        </>
    );
}

const styles = StyleSheet.create({
    intro: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.sm },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    amount: { fontSize: 18, fontFamily: fonts.bold, color: colors.foreground },
    date: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    meta: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginTop: 2, marginBottom: spacing.md, borderRadius: radius.sm },
});
