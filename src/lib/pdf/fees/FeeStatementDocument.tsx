import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { balanceState, formatKsh, type FeeAccount } from '../../fee-account';
import {
    FEE_ACCENT, FEE_FAINT, FEE_FONT, FEE_GOOD, FEE_INK, FEE_MUTED, FEE_RULE, FEE_TINT, FEE_WARN,
    FeeField, FeeFooter, FeeLetterhead, docDate, type FeeSchool,
} from './FeeDocParts';

const INSET = 36;

const s = StyleSheet.create({
    page: { padding: INSET, paddingBottom: INSET + 40, fontFamily: FEE_FONT, color: FEE_INK },
    fields: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },

    summary: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 16 },
    tile: { flex: 1, borderRadius: 6, padding: 10, backgroundColor: FEE_TINT, border: `0.75pt solid ${FEE_RULE}` },
    tileLabel: { fontSize: 6.5, fontWeight: 700, color: FEE_FAINT, textTransform: 'uppercase', letterSpacing: 0.8 },
    tileValue: { fontSize: 13, fontWeight: 800, marginTop: 3 },
    tileHint: { fontSize: 7, color: FEE_MUTED, marginTop: 2 },

    heading: { fontSize: 8, fontWeight: 800, color: FEE_ACCENT, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, marginTop: 4 },
    table: { border: `0.75pt solid ${FEE_RULE}`, borderRadius: 4, marginBottom: 16 },
    th: { flexDirection: 'row', backgroundColor: FEE_TINT, borderBottom: `0.75pt solid ${FEE_RULE}` },
    tr: { flexDirection: 'row', borderBottom: `0.5pt solid ${FEE_RULE}` },
    trLast: { flexDirection: 'row' },
    thCell: { fontSize: 6.5, fontWeight: 700, color: FEE_MUTED, textTransform: 'uppercase', letterSpacing: 0.6, paddingVertical: 5, paddingHorizontal: 6 },
    cell: { fontSize: 8, paddingVertical: 4.5, paddingHorizontal: 6 },
    num: { textAlign: 'right' },
    sub: { fontSize: 6.5, color: FEE_FAINT, marginTop: 1 },
    totalRow: { flexDirection: 'row', backgroundColor: FEE_TINT, borderTop: `0.75pt solid ${FEE_INK}` },
    note: { fontSize: 7.5, color: FEE_MUTED, lineHeight: 1.5 },
});

export interface FeeStatementData {
    school: FeeSchool;
    account: FeeAccount;
    /** ISO time the statement was produced. */
    generatedAt: string;
    /** How to pay, printed at the end (Paybill, bank). */
    payInstructions: string[];
}

const LEDGER_COLS = { date: '13%', desc: '39%', term: '12%', debit: '12%', credit: '12%', balance: '12%' } as const;
const TERM_COLS = { term: '28%', billed: '18%', awards: '18%', paid: '18%', balance: '18%' } as const;

const toneOf = (balance: number) => {
    const state = balanceState(balance);
    return state === 'owing' ? FEE_WARN : FEE_GOOD;
};

/** "Owes", "In credit" or "Cleared", with the figure. */
function balanceText(balance: number): string {
    const state = balanceState(balance);
    if (state === 'credit') return `${formatKsh(-balance)} credit`;
    if (state === 'clear') return 'Cleared';
    return formatKsh(balance);
}

export function FeeStatementDocument({ data }: { data: FeeStatementData }) {
    const { school, account } = data;
    const { learner, totals } = account;
    const guardian = account.guardians.find(g => g.isPrimary) ?? account.guardians[0];

    return (
        <Document title={`Fee statement · ${learner.name}`} author={school.name}>
            <Page size="A4" style={s.page}>
                <FeeLetterhead school={school} title="Fee statement" meta={`As at ${docDate(data.generatedAt)}`} sub={learner.admissionNumber ? `Adm. ${learner.admissionNumber}` : undefined} />

                <View style={s.fields}>
                    <FeeField label="Learner" value={learner.name} width="34%" />
                    <FeeField label="Class" value={learner.className ?? '—'} width="22%" />
                    <FeeField label="Admission no." value={learner.admissionNumber ?? '—'} width="22%" />
                    <FeeField label="Day / boarder" value={learner.residence === 'BOARDER' ? 'Boarder' : 'Day scholar'} width="22%" />
                    {guardian ? <FeeField label="Parent / guardian" value={`${guardian.name}${guardian.phone ? ` · ${guardian.phone}` : ''}`} width="100%" /> : null}
                </View>

                <View style={s.summary}>
                    <View style={s.tile}>
                        <Text style={s.tileLabel}>Total billed</Text>
                        <Text style={s.tileValue}>{formatKsh(totals.billed)}</Text>
                        <Text style={s.tileHint}>{account.terms.length} {account.terms.length === 1 ? 'term' : 'terms'}, after bursaries</Text>
                    </View>
                    <View style={s.tile}>
                        <Text style={s.tileLabel}>Total paid</Text>
                        <Text style={[s.tileValue, { color: FEE_GOOD }]}>{formatKsh(totals.paid)}</Text>
                        <Text style={s.tileHint}>{account.payments.length} {account.payments.length === 1 ? 'payment' : 'payments'}</Text>
                    </View>
                    <View style={[s.tile, { borderColor: toneOf(totals.balance) }]}>
                        <Text style={s.tileLabel}>{balanceState(totals.balance) === 'credit' ? 'In credit' : 'Balance due'}</Text>
                        <Text style={[s.tileValue, { color: toneOf(totals.balance) }]}>{balanceText(totals.balance)}</Text>
                        <Text style={s.tileHint}>Across every term</Text>
                    </View>
                </View>

                <Text style={s.heading}>By term</Text>
                <View style={s.table}>
                    <View style={s.th}>
                        <Text style={[s.thCell, { width: TERM_COLS.term }]}>Term</Text>
                        <Text style={[s.thCell, s.num, { width: TERM_COLS.billed }]}>Fees</Text>
                        <Text style={[s.thCell, s.num, { width: TERM_COLS.awards }]}>Bursary / waiver</Text>
                        <Text style={[s.thCell, s.num, { width: TERM_COLS.paid }]}>Paid</Text>
                        <Text style={[s.thCell, s.num, { width: TERM_COLS.balance }]}>Balance</Text>
                    </View>
                    {account.terms.map((t, i) => (
                        <View key={t.feeId} style={i === account.terms.length - 1 ? s.trLast : s.tr} wrap={false}>
                            <View style={[s.cell, { width: TERM_COLS.term }]}>
                                <Text>{t.termName}{t.yearName ? ` · ${t.yearName}` : ''}</Text>
                                {t.dueDate ? <Text style={s.sub}>Due {docDate(t.dueDate)}</Text> : null}
                            </View>
                            <Text style={[s.cell, s.num, { width: TERM_COLS.billed }]}>{formatKsh(t.gross)}</Text>
                            <Text style={[s.cell, s.num, { width: TERM_COLS.awards }]}>{t.awards > 0 ? `− ${formatKsh(t.awards)}` : '—'}</Text>
                            <Text style={[s.cell, s.num, { width: TERM_COLS.paid }]}>{formatKsh(t.paid)}</Text>
                            <Text style={[s.cell, s.num, { width: TERM_COLS.balance, fontWeight: 700, color: toneOf(t.balance) }]}>{balanceText(t.balance)}</Text>
                        </View>
                    ))}
                </View>

                <Text style={s.heading}>Statement of account</Text>
                <View style={s.table}>
                    <View style={s.th} fixed>
                        <Text style={[s.thCell, { width: LEDGER_COLS.date }]}>Date</Text>
                        <Text style={[s.thCell, { width: LEDGER_COLS.desc }]}>Details</Text>
                        <Text style={[s.thCell, { width: LEDGER_COLS.term }]}>Term</Text>
                        <Text style={[s.thCell, s.num, { width: LEDGER_COLS.debit }]}>Charged</Text>
                        <Text style={[s.thCell, s.num, { width: LEDGER_COLS.credit }]}>Paid / off</Text>
                        <Text style={[s.thCell, s.num, { width: LEDGER_COLS.balance }]}>Balance</Text>
                    </View>
                    {account.ledger.length === 0 ? (
                        <Text style={[s.cell, { color: FEE_MUTED }]}>Nothing billed yet.</Text>
                    ) : account.ledger.map((e, i) => (
                        <View key={`${e.kind}-${e.paymentId ?? e.termName}-${i}`} style={s.tr} wrap={false}>
                            <Text style={[s.cell, { width: LEDGER_COLS.date }]}>{e.date ? docDate(e.date) : '—'}</Text>
                            <View style={[s.cell, { width: LEDGER_COLS.desc }]}>
                                <Text>{e.description}</Text>
                                {e.receiptNumber ? <Text style={s.sub}>Receipt {e.receiptNumber}</Text> : null}
                            </View>
                            <Text style={[s.cell, { width: LEDGER_COLS.term }]}>{e.termName}</Text>
                            <Text style={[s.cell, s.num, { width: LEDGER_COLS.debit }]}>{e.debit ? formatKsh(e.debit) : ''}</Text>
                            <Text style={[s.cell, s.num, { width: LEDGER_COLS.credit, color: e.credit ? FEE_GOOD : FEE_INK }]}>{e.credit ? formatKsh(e.credit) : ''}</Text>
                            <Text style={[s.cell, s.num, { width: LEDGER_COLS.balance, fontWeight: 600 }]}>{balanceText(e.balance)}</Text>
                        </View>
                    ))}
                    <View style={s.totalRow} wrap={false}>
                        <Text style={[s.cell, { width: '64%', fontWeight: 800 }]}>{balanceState(totals.balance) === 'credit' ? 'In credit' : 'Balance due'}</Text>
                        <Text style={[s.cell, s.num, { width: LEDGER_COLS.debit, fontWeight: 700 }]}>{formatKsh(account.ledger.reduce((n, e) => n + e.debit, 0))}</Text>
                        <Text style={[s.cell, s.num, { width: LEDGER_COLS.credit, fontWeight: 700 }]}>{formatKsh(account.ledger.reduce((n, e) => n + e.credit, 0))}</Text>
                        <Text style={[s.cell, s.num, { width: LEDGER_COLS.balance, fontWeight: 800, color: toneOf(totals.balance) }]}>{balanceText(totals.balance)}</Text>
                    </View>
                </View>

                {data.payInstructions.length > 0 ? (
                    <View wrap={false}>
                        <Text style={s.heading}>How to pay</Text>
                        {data.payInstructions.map(line => <Text key={line} style={s.note}>{line}</Text>)}
                    </View>
                ) : null}

                <FeeFooter
                    inset={INSET}
                    lines={[
                        `Statement for ${learner.name}, produced ${docDate(data.generatedAt)}. Payments received after this date are not shown.`,
                        `Queries: ${school.name}${school.phone ? ` · ${school.phone}` : ''}${school.email ? ` · ${school.email}` : ''}. Produced with Skulbase.`,
                    ]}
                />
                <Text style={{ position: 'absolute', bottom: INSET - 26, right: INSET, fontSize: 6.5, color: FEE_FAINT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
            </Page>
        </Document>
    );
}
