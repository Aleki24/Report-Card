import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer';

export interface ReportCardData {
    schoolName: string;
    examTitle: string;
    academicYear: string;
    studentName: string;
    enrollmentNumber: string;
    className: string;
    subjectMarks: {
        subjectName: string;
        score: number;
        totalPossible: number;
        percentage: number;
        grade: string;
        gradeBase: string;
        remarks: string;
    }[];
    overallPercentage: number;
    overallGrade: string;
    gpa: number;
    classRank: number;
    totalStudents: number;
    actionableFeedback: string;
}

/* ── Colour helpers ─────────────────────────────────────── */
const gradeColor = (base: string) => {
    switch (base) {
        case 'A': return '#10B981';
        case 'B': return '#3B82F6';
        case 'C': return '#F59E0B';
        case 'D': return '#EA580C';
        default: return '#EF4444';
    }
};

/* ── Styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#333' },

    /* Header */
    header: { textAlign: 'center', borderBottom: '2pt solid #2563EB', paddingBottom: 16, marginBottom: 24 },
    schoolName: { fontSize: 22, fontWeight: 'bold', color: '#1E3A8A', fontFamily: 'Helvetica-Bold' },
    headerSub: { fontSize: 11, color: '#64748B', marginTop: 4 },

    /* Student info row */
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 6, marginBottom: 24 },
    infoGroup: { flexDirection: 'column' },
    infoLabel: { fontSize: 8, color: '#64748B', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    infoValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0F172A' },

    /* Table */
    table: { marginBottom: 24, borderRadius: 4 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#EFF6FF', borderBottom: '2pt solid #BFDBFE', paddingVertical: 8, paddingHorizontal: 6 },
    tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #E2E8F0', paddingVertical: 8, paddingHorizontal: 6 },
    thSubject: { width: '28%', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E3A8A' },
    thScore: { width: '10%', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E3A8A', textAlign: 'right' },
    thTotal: { width: '10%', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E3A8A', textAlign: 'right' },
    thPct: { width: '10%', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E3A8A', textAlign: 'right' },
    thGrade: { width: '10%', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E3A8A', textAlign: 'center' },
    thRemarks: { width: '32%', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E3A8A' },

    tdSubject: { width: '28%', fontSize: 10 },
    tdScore: { width: '10%', fontSize: 10, textAlign: 'right' },
    tdTotal: { width: '10%', fontSize: 10, textAlign: 'right' },
    tdPct: { width: '10%', fontSize: 10, textAlign: 'right' },
    tdGrade: { width: '10%', fontSize: 10, textAlign: 'center' },
    tdRemarks: { width: '32%', fontSize: 9, color: '#475569' },

    /* Summary box */
    summaryBox: { border: '1pt solid #E2E8F0', borderRadius: 6, padding: 16 },
    summaryTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1E3A8A', marginBottom: 12, borderBottom: '0.5pt solid #E2E8F0', paddingBottom: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around', textAlign: 'center', marginBottom: 16 },
    summaryItem: { alignItems: 'center' },
    summaryItemLabel: { fontSize: 8, color: '#64748B', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    summaryItemValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0F172A' },

    feedbackLabel: { fontSize: 8, color: '#64748B', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginBottom: 4 },
    feedbackText: { fontSize: 10, fontStyle: 'italic', color: '#475569' },

    /* Footer */
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#94A3B8', borderTop: '0.5pt solid #E2E8F0', paddingTop: 10 },
});

/* ── React-PDF Document ─────────────────────────────────── */
function ReportCardDocument({ data }: { data: ReportCardData }) {
    return (
        <Document>
            <Page size="A4" style={s.page}>
                {/* Header */}
                <View style={s.header}>
                    <Text style={s.schoolName}>{data.schoolName}</Text>
                    <Text style={s.headerSub}>
                        Official {data.examTitle} Report Card — {data.academicYear}
                    </Text>
                </View>

                {/* Student Info */}
                <View style={s.infoRow}>
                    <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Student Name</Text>
                        <Text style={s.infoValue}>{data.studentName}</Text>
                    </View>
                    <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Enrollment ID</Text>
                        <Text style={s.infoValue}>{data.enrollmentNumber || '—'}</Text>
                    </View>
                    <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Class</Text>
                        <Text style={s.infoValue}>{data.className}</Text>
                    </View>
                </View>

                {/* Subject Marks Table */}
                <View style={s.table}>
                    {/* Header row */}
                    <View style={s.tableHeader}>
                        <Text style={s.thSubject}>Subject</Text>
                        <Text style={s.thScore}>Score</Text>
                        <Text style={s.thTotal}>Total</Text>
                        <Text style={s.thPct}>%</Text>
                        <Text style={s.thGrade}>Grade</Text>
                        <Text style={s.thRemarks}>Teacher Remarks</Text>
                    </View>

                    {/* Data rows */}
                    {data.subjectMarks.map((sm, idx) => (
                        <View style={s.tableRow} key={idx}>
                            <Text style={s.tdSubject}>{sm.subjectName}</Text>
                            <Text style={s.tdScore}>{sm.score}</Text>
                            <Text style={s.tdTotal}>{sm.totalPossible}</Text>
                            <Text style={s.tdPct}>{sm.percentage}%</Text>
                            <Text style={[s.tdGrade, { color: gradeColor(sm.gradeBase) }]}>
                                {sm.grade}
                            </Text>
                            <Text style={s.tdRemarks}>{sm.remarks}</Text>
                        </View>
                    ))}
                </View>

                {/* Performance Summary */}
                <View style={s.summaryBox}>
                    <Text style={s.summaryTitle}>Performance Summary</Text>
                    <View style={s.summaryRow}>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryItemLabel}>Overall Percentage</Text>
                            <Text style={s.summaryItemValue}>{data.overallPercentage}%</Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryItemLabel}>Overall Grade</Text>
                            <Text style={s.summaryItemValue}>{data.overallGrade}</Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryItemLabel}>GPA</Text>
                            <Text style={s.summaryItemValue}>{data.gpa}</Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryItemLabel}>Class Rank</Text>
                            <Text style={s.summaryItemValue}>
                                {data.classRank > 0 ? `${data.classRank} / ${data.totalStudents}` : '—'}
                            </Text>
                        </View>
                    </View>
                    <View>
                        <Text style={s.feedbackLabel}>Actionable Feedback</Text>
                        <Text style={s.feedbackText}>{data.actionableFeedback}</Text>
                    </View>
                </View>

                {/* Footer */}
                <Text style={s.footer}>
                    Generated by ResultsApp • This document is electronically generated and requires no physical signature.
                </Text>
            </Page>
        </Document>
    );
}

/**
 * Generate a PDF buffer for a student report card.
 * Uses @react-pdf/renderer — no Chromium, serverless-safe, ~50ms per PDF.
 */
export async function generateStudentReportCardPDF(data: ReportCardData): Promise<Buffer> {
    const buffer = await renderToBuffer(
        <ReportCardDocument data={data} />
    );
    return Buffer.from(buffer);
}
