import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { amountInWords, balanceState, formatKsh, methodLabel } from '../fee-account';
import type { FeeReceiptRecord } from '../fee-receipt-server';
import {
    FEE_ACCENT, FEE_FONT, FEE_GOOD, FEE_INK, FEE_MUTED, FEE_RULE, FEE_TINT, FEE_WARN,
    FeeField, FeeFooter, FeeLetterhead, docDateTime, type FeeSchool,
} from './fees/FeeDocParts';

const INSET = 30;

const s = StyleSheet.create({
    page: { padding: INSET, paddingBottom: INSET + 54, fontFamily: FEE_FONT, color: FEE_INK },
    fields: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },

    amount: { marginTop: 2, marginBottom: 12, padding: 12, borderRadius: 8, backgroundColor: '#ECFDF5', border: '0.75pt solid #A7F3D0' },
    amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    amountLabel: { fontSize: 6.5, fontWeight: 700, color: FEE_GOOD, textTransform: 'uppercase', letterSpacing: 1 },
    amountValue: { fontSize: 22, fontWeight: 800, color: FEE_GOOD, marginTop: 2, letterSpacing: -0.4 },
    amountWords: { fontSize: 7.5, color: FEE_MUTED, marginTop: 4 },
    method: { fontSize: 8, fontWeight: 600, color: FEE_INK, textAlign: 'right' },
    methodSub: { fontSize: 7, color: FEE_MUTED, textAlign: 'right', marginTop: 1.5 },

    heading: { fontSize: 6.5, fontWeight: 700, color: FEE_ACCENT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    table: { border: `0.75pt solid ${FEE_RULE}`, borderRadius: 4, marginBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8, borderBottom: `0.5pt solid ${FEE_RULE}` },
    rowLast: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8 },
    rowStrong: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: FEE_TINT, borderTop: `0.75pt solid ${FEE_INK}` },
    cell: { fontSize: 8 },
    cellMuted: { fontSize: 8, color: FEE_MUTED },
    cellStrong: { fontSize: 8.5, fontWeight: 800 },

    signRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginTop: 6 },
    sign: { flex: 1 },
    signLine: { borderBottom: `0.75pt solid ${FEE_INK}`, height: 20, marginBottom: 3 },
    signLabel: { fontSize: 6.5, color: FEE_MUTED },
    void: { position: 'absolute', top: 220, left: 40, right: 40, textAlign: 'center', fontSize: 64, fontWeight: 800, color: '#DC2626', opacity: 0.18, transform: 'rotate(-24deg)' },
});

export interface FeeReceiptData {
    school: FeeSchool;
    receipt: FeeReceiptRecord;
    /** The QR that opens the public check of this receipt. */
    qrDataUri: string | null;
    /** Where the QR leads, printed for anyone without a camera. */
    verifyUrl: string;
}

function balanceText(balance: number): string {
    const state = balanceState(balance);
    if (state === 'credit') return `${formatKsh(-balance)} credit`;
    if (state === 'clear') return 'Cleared';
    return formatKsh(balance);
}

const tone = (balance: number) => (balanceState(balance) === 'owing' ? FEE_WARN : FEE_GOOD);

export function FeeReceiptDocument({ data }: { data: FeeReceiptData }) {
    const { school, receipt: r } = data;
    const arrears = Math.round((r.accountBalance - r.termBalance) * 100) / 100;
    return (
        <Document title={`Receipt ${r.receiptNumber}`} author={school.name}>
            <Page size="A5" style={s.page}>
                <FeeLetterhead school={school} title="Official receipt" meta={`No. ${r.receiptNumber}`} sub={docDateTime(r.paidAt)} />

                <View style={s.fields}>
                    <FeeField label="Received from" value={r.payerName || 'Parent / guardian'} width="50%" />
                    <FeeField label="For learner" value={r.learner.name} width="50%" />
                    <FeeField label="Admission no." value={r.learner.admissionNumber || '—'} width="33%" />
                    <FeeField label="Class" value={r.learner.className || '—'} width="33%" />
                    <FeeField label="Term" value={`${r.termName}${r.yearName ? ` ${r.yearName}` : ''}`} width="34%" />
                </View>

                <View style={s.amount}>
                    <View style={s.amountRow}>
                        <View>
                            <Text style={s.amountLabel}>Amount received</Text>
                            <Text style={s.amountValue}>{formatKsh(r.amount)}</Text>
                        </View>
                        <View>
                            <Text style={s.method}>{methodLabel(r.method)}</Text>
                            {r.reference ? <Text style={s.methodSub}>{r.reference}</Text> : null}
                            {r.phoneNumber ? <Text style={s.methodSub}>{r.phoneNumber}</Text> : null}
                        </View>
                    </View>
                    <Text style={s.amountWords}>{amountInWords(r.amount)}</Text>
                </View>

                {r.allocation.length > 0 ? (
                    <View wrap={false}>
                        <Text style={s.heading}>This payment paid for</Text>
                        <View style={s.table}>
                            {r.allocation.map((a, i) => (
                                <View key={a.description} style={i === r.allocation.length - 1 ? s.rowLast : s.row}>
                                    <Text style={s.cellMuted}>{a.description}</Text>
                                    <Text style={s.cell}>{formatKsh(a.amount)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}

                <View wrap={false}>
                    <Text style={s.heading}>Account after this payment</Text>
                    <View style={s.table}>
                        <View style={s.row}>
                            <Text style={s.cellMuted}>{r.termName} fees</Text>
                            <Text style={s.cell}>{formatKsh(r.termBilled)}</Text>
                        </View>
                        <View style={s.row}>
                            <Text style={s.cellMuted}>Paid this term to date</Text>
                            <Text style={[s.cell, { color: FEE_GOOD }]}>{formatKsh(r.termPaidToDate)}</Text>
                        </View>
                        <View style={arrears !== 0 ? s.row : s.rowLast}>
                            <Text style={s.cellMuted}>{r.termName} balance</Text>
                            <Text style={[s.cell, { color: tone(r.termBalance) }]}>{balanceText(r.termBalance)}</Text>
                        </View>
                        {arrears !== 0 ? (
                            <View style={s.rowLast}>
                                <Text style={s.cellMuted}>{arrears > 0 ? 'Arrears from earlier terms' : 'Credit from earlier terms'}</Text>
                                <Text style={s.cell}>{balanceText(arrears)}</Text>
                            </View>
                        ) : null}
                        <View style={s.rowStrong}>
                            <Text style={s.cellStrong}>{balanceState(r.accountBalance) === 'credit' ? 'In credit' : 'Total balance due'}</Text>
                            <Text style={[s.cellStrong, { color: tone(r.accountBalance) }]}>{balanceText(r.accountBalance)}</Text>
                        </View>
                    </View>
                </View>

                {r.notes ? <Text style={[s.cellMuted, { fontSize: 7.5, marginBottom: 10 }]}>Note: {r.notes}</Text> : null}

                <View style={s.signRow} wrap={false}>
                    <View style={s.sign}>
                        <View style={s.signLine} />
                        <Text style={s.signLabel}>Received by{r.recordedByName ? `: ${r.recordedByName}` : ' (bursar / accounts)'}</Text>
                    </View>
                    <View style={s.sign}>
                        <View style={s.signLine} />
                        <Text style={s.signLabel}>School stamp</Text>
                    </View>
                </View>

                {r.status !== 'COMPLETED' ? <Text style={s.void} fixed>VOID</Text> : null}

                <FeeFooter
                    inset={INSET}
                    qrDataUri={data.qrDataUri}
                    lines={[
                        'Official receipt produced by the school’s system; valid without a signature.',
                        'Scan the code to check it is genuine, or open:',
                        data.verifyUrl,
                        `${school.name}${school.phone ? ` · ${school.phone}` : ''} · Skulbase`,
                    ]}
                />
            </Page>
        </Document>
    );
}
