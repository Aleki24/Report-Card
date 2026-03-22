import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { getCategoryOrder, getCategoryLabel } from './analytics';

/* ── Data Interface ─────────────────────────────────────── */

export interface ReportCardData {
    schoolName: string;
    schoolLogoUrl?: string;
    schoolAddress?: string;
    examTitle: string;
    academicYear: string;
    studentName: string;
    enrollmentNumber: string;
    className: string;
    gradingSystemType: 'KCSE' | 'CBC';
    subjectMarks: {
        subjectName: string;
        category: string;
        score: number;
        totalPossible: number;
        percentage: number;
        grade: string;
        points?: number;
        rubric?: string;
        teacherComment: string;
    }[];
    overallPercentage: number;
    overallGrade: string;
    totalPoints?: number;
    classRank: number;
    totalStudents: number;
    classTeacherComment?: string;
    principalComment?: string;
    gradeBoundaries: { symbol: string; label: string; min: number; max: number; points?: number }[];
    resultUrl?: string;
}

/* ── Colour helpers ─────────────────────────────────────── */
const gradeColor = (grade: string) => {
    const base = grade.replace(/[+-\d]/g, '').toUpperCase();
    switch (base) {
        case 'A': case 'EE': return '#10B981';
        case 'B': case 'ME': return '#3B82F6';
        case 'C': case 'AE': return '#F59E0B';
        case 'D': case 'BE': return '#EA580C';
        default: return '#EF4444';
    }
};

const categoryBgColor = '#E0E7FF';

/* ── Styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
    page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },

    /* Header */
    headerWrap: { flexDirection: 'row', alignItems: 'center', borderBottom: '2pt solid #1E3A8A', paddingBottom: 12, marginBottom: 8, justifyContent: 'space-between' },
    logo: { width: 52, height: 52 },
    qrCode: { width: 52, height: 52 },
    headerTextWrap: { flex: 1, alignItems: 'center' },
    schoolName: { fontSize: 18, fontWeight: 'bold', color: '#1E3A8A', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
    schoolAddress: { fontSize: 9, color: '#64748B', marginTop: 2, textAlign: 'center' },
    reportTitle: { textAlign: 'center', fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1E3A8A', marginVertical: 8, paddingVertical: 4, backgroundColor: '#F0F4FF', borderRadius: 3 },

    /* Student info */
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 4, marginBottom: 12 },
    infoGroup: { flexDirection: 'column' },
    infoLabel: { fontSize: 7, color: '#64748B', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginBottom: 1 },
    infoValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0F172A' },

    /* Table */
    table: { marginBottom: 12 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#1E3A8A', paddingVertical: 5, paddingHorizontal: 4 },
    thText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },

    categoryRow: { flexDirection: 'row', backgroundColor: categoryBgColor, paddingVertical: 4, paddingHorizontal: 6, borderBottom: '0.5pt solid #CBD5E1' },
    categoryText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#3730A3' },

    tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #E2E8F0', paddingVertical: 5, paddingHorizontal: 4 },
    tableRowAlt: { flexDirection: 'row', borderBottom: '0.5pt solid #E2E8F0', paddingVertical: 5, paddingHorizontal: 4, backgroundColor: '#F8FAFC' },

    /* Column widths */
    colNo: { width: '5%', textAlign: 'center' },
    colSubject: { width: '25%' },
    colScore: { width: '10%', textAlign: 'right' },
    colPct: { width: '10%', textAlign: 'right' },
    colGrade: { width: '10%', textAlign: 'center' },
    colPoints: { width: '15%', textAlign: 'center' },
    colComment: { width: '25%' },

    tdText: { fontSize: 9 },
    tdSmall: { fontSize: 8, color: '#475569' },

    /* Totals row */
    totalsRow: { flexDirection: 'row', backgroundColor: '#EFF6FF', paddingVertical: 6, paddingHorizontal: 4, borderTop: '1.5pt solid #1E3A8A' },
    totalsLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E3A8A' },
    totalsValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0F172A' },

    /* Summary box */
    summaryBox: { border: '1pt solid #CBD5E1', borderRadius: 4, padding: 12, marginBottom: 12 },
    summaryTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1E3A8A', marginBottom: 8, borderBottom: '0.5pt solid #E2E8F0', paddingBottom: 4 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around', textAlign: 'center', marginBottom: 10 },
    summaryItem: { alignItems: 'center' },
    summaryItemLabel: { fontSize: 7, color: '#64748B', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginBottom: 1 },
    summaryItemValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0F172A' },

    /* Comments */
    commentsContainer: { marginTop: 'auto', paddingTop: 12 },
    commentBox: { border: '1pt solid #CBD5E1', borderRadius: 4, padding: 10, marginBottom: 8 },
    commentTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1E3A8A', marginBottom: 6 },
    commentText: { fontSize: 9, fontStyle: 'italic', color: '#334155', lineHeight: 1.4 },
    commentLines: { borderBottom: '1pt dotted #CBD5E1', height: 16, width: '100%', marginBottom: 4 },

    /* Grade boundaries */
    boundaryBox: { backgroundColor: '#F8FAFC', borderRadius: 4, padding: 8, marginBottom: 8 },
    boundaryTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748B', marginBottom: 4 },
    boundaryText: { fontSize: 7, color: '#475569' },

    /* Footer */
    footer: { position: 'absolute', bottom: 24, left: 32, right: 32, textAlign: 'center', fontSize: 7, color: '#94A3B8', borderTop: '0.5pt solid #E2E8F0', paddingTop: 6 },
});

/* ── Helpers ────────────────────────────────────────────── */

function groupByCategory(marks: ReportCardData['subjectMarks']) {
    // Sort by category order, then by subject name
    const sorted = [...marks].sort((a, b) => {
        const catDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
        if (catDiff !== 0) return catDiff;
        return a.subjectName.localeCompare(b.subjectName);
    });

    // Group into categories
    const groups: { category: string; label: string; subjects: typeof marks }[] = [];
    let currentCat = '';
    for (const subject of sorted) {
        if (subject.category !== currentCat) {
            currentCat = subject.category;
            groups.push({ category: currentCat, label: getCategoryLabel(currentCat), subjects: [] });
        }
        groups[groups.length - 1].subjects.push(subject);
    }
    return groups;
}

/* ── React-PDF Document ─────────────────────────────────── */
export function ReportCardDocument({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    const groups = groupByCategory(data.subjectMarks);
    const isKCSE = data.gradingSystemType === 'KCSE';
    const pointsLabel = isKCSE ? 'Points' : 'Rubric';

    const totalScore = data.subjectMarks.reduce((sum, m) => sum + m.score, 0);
    const totalPossible = data.subjectMarks.reduce((sum, m) => sum + m.totalPossible, 0);

    let rowCounter = 0;

    return (
        <Document>
            <Page size="A4" style={[s.page, { display: 'flex', flexDirection: 'column' }]}>
                {/* ── Wrapper to push comments to the bottom ── */}
                <View style={{ flex: 1 }}>
                    {/* ── Header with logo and QR ── */}
                    <View style={s.headerWrap}>
                        <View style={{ width: 52 }}>
                            {qrCodeDataUri && <Image style={s.qrCode} src={qrCodeDataUri} />}
                        </View>
                        <View style={s.headerTextWrap}>
                            <Text style={s.schoolName}>{data.schoolName}</Text>
                            {data.schoolAddress && (
                                <Text style={s.schoolAddress}>{data.schoolAddress}</Text>
                            )}
                        </View>
                    {data.schoolLogoUrl ? (
                         <Image style={s.logo} src={data.schoolLogoUrl} />
                    ) : (
                         <View style={{ width: 52 }} />
                    )}
                </View>

                {/* ── Report Title ── */}
                <Text style={s.reportTitle}>
                    {data.examTitle} Report Card — {data.academicYear}
                </Text>

                {/* ── Student Info ── */}
                <View style={s.infoRow}>
                    <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Student Name</Text>
                        <Text style={s.infoValue}>{data.studentName}</Text>
                    </View>
                    <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Adm No.</Text>
                        <Text style={s.infoValue}>{data.enrollmentNumber || '—'}</Text>
                    </View>
                    <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Class</Text>
                        <Text style={s.infoValue}>{data.className}</Text>
                    </View>
                </View>

                {/* ── Subject Marks Table ── */}
                <View style={s.table}>
                    {/* Header */}
                    <View style={s.tableHeader}>
                        <Text style={[s.thText, s.colNo]}>#</Text>
                        <Text style={[s.thText, s.colSubject]}>Subject</Text>
                        <Text style={[s.thText, s.colScore]}>Score</Text>
                        <Text style={[s.thText, s.colPct]}>%</Text>
                        <Text style={[s.thText, s.colGrade]}>Grade</Text>
                        <Text style={[s.thText, s.colPoints]}>{pointsLabel}</Text>
                        <Text style={[s.thText, s.colComment]}>Comment</Text>
                    </View>

                    {/* Grouped rows */}
                    {groups.map((group) => (
                        <React.Fragment key={group.category}>
                            {/* Subject rows */}
                            {group.subjects.map((sm) => {
                                rowCounter++;
                                const rowStyle = rowCounter % 2 === 0 ? s.tableRowAlt : s.tableRow;
                                return (
                                    <View style={rowStyle} key={`${group.category}-${sm.subjectName}`}>
                                        <Text style={[s.tdText, s.colNo]}>{rowCounter}</Text>
                                        <Text style={[s.tdText, s.colSubject]}>{sm.subjectName}</Text>
                                        <Text style={[s.tdText, s.colScore]}>{sm.score}</Text>
                                        <Text style={[s.tdText, s.colPct]}>{sm.percentage}%</Text>
                                        <Text style={[s.tdText, s.colGrade, { color: gradeColor(sm.grade) }]}>
                                            {sm.grade}
                                        </Text>
                                        <Text style={[s.tdText, s.colPoints]}>
                                            {isKCSE ? (sm.points ?? '—') : (sm.rubric ?? '—')}
                                        </Text>
                                        <Text style={[s.tdSmall, s.colComment]}>{sm.teacherComment}</Text>
                                    </View>
                                );
                            })}
                        </React.Fragment>
                    ))}

                    {/* Totals */}
                    <View style={s.totalsRow}>
                        <Text style={[s.totalsLabel, s.colNo]}></Text>
                        <Text style={[s.totalsLabel, s.colSubject]}>Total</Text>
                        <Text style={[s.totalsValue, s.colScore]}>{totalScore}</Text>
                        <Text style={[s.totalsValue, s.colPct]}>{data.overallPercentage}%</Text>
                        <Text style={[s.totalsValue, s.colGrade, { color: gradeColor(data.overallGrade) }]}>
                            {data.overallGrade}
                        </Text>
                        <Text style={[s.totalsValue, s.colPoints]}>
                            {isKCSE ? (data.totalPoints ?? '—') : '—'}
                        </Text>
                        <Text style={[s.totalsLabel, s.colComment]}></Text>
                    </View>
                </View>

                {/* ── Performance Summary ── */}
                <View style={s.summaryBox}>
                    <Text style={s.summaryTitle}>Performance Summary</Text>
                    <View style={s.summaryRow}>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryItemLabel}>Overall %</Text>
                            <Text style={s.summaryItemValue}>{data.overallPercentage}%</Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryItemLabel}>Grade</Text>
                            <Text style={s.summaryItemValue}>{data.overallGrade}</Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryItemLabel}>
                                {isKCSE ? 'Total Points' : 'Overall Rubric'}
                            </Text>
                            <Text style={s.summaryItemValue}>
                                {isKCSE ? (data.totalPoints ?? '—') : data.overallGrade}
                            </Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryItemLabel}>Class Rank</Text>
                            <Text style={s.summaryItemValue}>
                                {data.classRank > 0 ? `${data.classRank} / ${data.totalStudents}` : '—'}
                            </Text>
                        </View>
                    </View>
                </View>

                </View>

                {/* ── Comments at the Bottom ── */}
                <View style={s.commentsContainer}>
                    <View style={s.commentBox}>
                        <Text style={s.commentTitle}>📝 Class Teacher's Comment:</Text>
                        {data.classTeacherComment ? (
                            <Text style={s.commentText}>{data.classTeacherComment}</Text>
                        ) : (
                            <View>
                                <View style={s.commentLines} />
                                <View style={s.commentLines} />
                            </View>
                        )}
                    </View>

                    <View style={s.commentBox}>
                        <Text style={s.commentTitle}>📝 Principal's Comment:</Text>
                        {data.principalComment ? (
                            <Text style={s.commentText}>{data.principalComment}</Text>
                        ) : (
                            <View>
                                <View style={s.commentLines} />
                                <View style={s.commentLines} />
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Footer ── */}
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
    let qrCodeDataUri = undefined;
    if (data.resultUrl) {
        try {
            qrCodeDataUri = await QRCode.toDataURL(data.resultUrl, { margin: 1, width: 64 });
        } catch (e) {
            console.error("Failed to generate QR code", e);
        }
    }

    const buffer = await renderToBuffer(
        <ReportCardDocument data={data} qrCodeDataUri={qrCodeDataUri} />
    );
    return Buffer.from(buffer);
}
