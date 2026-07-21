import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

const INK = '#111111';
const GRAY = '#555555';
const LIGHT = '#8A8A8A';
const RULE = '#D8D8D8';
const GOOD = '#0F7A3D';

const s = StyleSheet.create({
    page: { paddingHorizontal: 44, paddingTop: 36, paddingBottom: 36, fontFamily: 'Helvetica' },

    letterhead: { alignItems: 'center', marginBottom: 10 },
    logo: { width: 40, height: 40, objectFit: 'contain', marginBottom: 6 },
    schoolName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'center' },
    schoolAddress: { fontSize: 8, color: GRAY, marginTop: 2, textAlign: 'center' },

    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 4 },
    docTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK, textTransform: 'uppercase', letterSpacing: 1.5 },
    receiptNo: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK },
    doubleRule: { borderBottom: `2pt solid ${INK}`, marginBottom: 14 },

    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    col: { width: '48%' },
    label: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    value: { fontSize: 10, color: INK },

    amountBox: { marginTop: 18, marginBottom: 18, padding: 14, borderRadius: 6, backgroundColor: '#F3F7F4', borderWidth: 1, borderColor: '#D9E6DC', alignItems: 'center' },
    amountLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', letterSpacing: 1 },
    amountValue: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: GOOD, marginTop: 4 },
    amountWords: { fontSize: 8, color: GRAY, marginTop: 4, textAlign: 'center' },

    summaryTable: { borderTop: `1pt solid ${INK}`, borderBottom: `1pt solid ${INK}`, paddingVertical: 8, marginBottom: 18 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    summaryLabel: { fontSize: 9, color: GRAY },
    summaryValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK },

    sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
    sigBlock: { width: '45%', alignItems: 'center' },
    sigLine: { borderBottom: `0.75pt solid ${INK}`, height: 24, width: '100%', marginBottom: 3 },
    sigLabel: { fontSize: 7.5, color: GRAY },

    footer: { marginTop: 'auto', paddingTop: 10, borderTop: `0.5pt solid ${RULE}`, alignItems: 'center' },
    footerText: { fontSize: 6.5, color: LIGHT, marginBottom: 1.5 },
});

const METHOD_LABELS: Record<string, string> = {
    MPESA: 'M-Pesa',
    CASH: 'Cash',
    BANK: 'Bank Transfer',
    CHEQUE: 'Cheque',
    OTHER: 'Other',
};

export interface FeeReceiptData {
    schoolName: string;
    schoolLogoUrl?: string;
    schoolAddress?: string;
    receiptNumber: string;
    paidAt: string;
    studentName: string;
    admissionNumber: string;
    className?: string;
    termName?: string;
    amount: number;
    method: string;
    mpesaReceiptNumber?: string | null;
    payerName?: string | null;
    phoneNumber?: string | null;
    notes?: string | null;
    recordedByName?: string | null;
    totalFee: number;
    totalPaidToDate: number;
    balance: number;
}

function formatKES(n: number): string {
    return `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FeeReceiptDocument({ data }: { data: FeeReceiptData }) {
    const paidAtLabel = new Date(data.paidAt).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return (
        <Document>
            <Page size="A5" style={s.page}>
                <View style={s.letterhead}>
                    {data.schoolLogoUrl && <Image src={data.schoolLogoUrl} style={s.logo} />}
                    <Text style={s.schoolName}>{data.schoolName}</Text>
                    {data.schoolAddress && <Text style={s.schoolAddress}>{data.schoolAddress}</Text>}
                </View>

                <View style={s.titleRow}>
                    <Text style={s.docTitle}>Payment Receipt</Text>
                    <Text style={s.receiptNo}>{data.receiptNumber}</Text>
                </View>
                <View style={s.doubleRule} />

                <View style={s.row}>
                    <View style={s.col}>
                        <Text style={s.label}>Student</Text>
                        <Text style={s.value}>{data.studentName}</Text>
                    </View>
                    <View style={s.col}>
                        <Text style={s.label}>Admission No.</Text>
                        <Text style={s.value}>{data.admissionNumber}</Text>
                    </View>
                </View>
                <View style={s.row}>
                    <View style={s.col}>
                        <Text style={s.label}>Class</Text>
                        <Text style={s.value}>{data.className || '—'}</Text>
                    </View>
                    <View style={s.col}>
                        <Text style={s.label}>Term</Text>
                        <Text style={s.value}>{data.termName || '—'}</Text>
                    </View>
                </View>
                <View style={s.row}>
                    <View style={s.col}>
                        <Text style={s.label}>Date Received</Text>
                        <Text style={s.value}>{paidAtLabel}</Text>
                    </View>
                    <View style={s.col}>
                        <Text style={s.label}>Payment Method</Text>
                        <Text style={s.value}>
                            {METHOD_LABELS[data.method] || data.method}
                            {data.mpesaReceiptNumber ? ` — ${data.mpesaReceiptNumber}` : ''}
                        </Text>
                    </View>
                </View>
                {(data.payerName || data.phoneNumber) && (
                    <View style={s.row}>
                        <View style={s.col}>
                            <Text style={s.label}>Paid By</Text>
                            <Text style={s.value}>{data.payerName || '—'}</Text>
                        </View>
                        <View style={s.col}>
                            <Text style={s.label}>Phone</Text>
                            <Text style={s.value}>{data.phoneNumber || '—'}</Text>
                        </View>
                    </View>
                )}

                <View style={s.amountBox}>
                    <Text style={s.amountLabel}>Amount Received</Text>
                    <Text style={s.amountValue}>{formatKES(data.amount)}</Text>
                </View>

                <View style={s.summaryTable}>
                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Total Fee for Term</Text>
                        <Text style={s.summaryValue}>{formatKES(data.totalFee)}</Text>
                    </View>
                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Total Paid to Date</Text>
                        <Text style={s.summaryValue}>{formatKES(data.totalPaidToDate)}</Text>
                    </View>
                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Balance Remaining</Text>
                        <Text style={s.summaryValue}>{formatKES(data.balance)}</Text>
                    </View>
                </View>

                {data.notes && (
                    <View style={{ marginBottom: 14 }}>
                        <Text style={s.label}>Notes</Text>
                        <Text style={s.value}>{data.notes}</Text>
                    </View>
                )}

                <View style={s.sigRow}>
                    <View style={s.sigBlock}>
                        <View style={s.sigLine} />
                        <Text style={s.sigLabel}>{data.recordedByName || 'Bursar / Accounts'}</Text>
                    </View>
                    <View style={s.sigBlock}>
                        <View style={s.sigLine} />
                        <Text style={s.sigLabel}>Official Stamp</Text>
                    </View>
                </View>

                <View style={s.footer}>
                    <Text style={s.footerText}>This is a system-generated receipt and is valid without a physical signature.</Text>
                    <Text style={s.footerText}>Generated by {data.schoolName} — Report Card</Text>
                </View>
            </Page>
        </Document>
    );
}
