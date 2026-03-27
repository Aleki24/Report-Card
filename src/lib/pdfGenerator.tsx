import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer, Circle, Svg } from '@react-pdf/renderer';
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
        subjectCode?: string;
        subjectName: string;
        category: string;
        score: number;
        totalPossible: number;
        percentage: number;
        grade: string;
        points?: number;
        rubric?: string;
        teacherComment: string;
        subjectRank?: number;
        instructorName?: string;
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
    openingDate?: string;
    totalScore?: number;
    totalPossible?: number;
}

/* ── Colour helpers ─────────────────────────────────────── */
const NAVY = '#1A365D';
const SKY_BLUE = '#87CEEB';
const ORANGE = '#FF8C00';
const STEEL_BLUE = '#4682B4';
const LIGHT_GRAY = '#F2F2F2';
const GREEN = '#22A86B';
const GRAY_200 = '#E2E6ED';
const GRAY_400 = '#9CA3AF';
const GRAY_700 = '#374151';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const PHOTO_GRAY = '#E5E7EB';

const gradeColor = (grade: string) => {
    const base = grade.replace(/[+-\d]/g, '').toUpperCase();
    switch (base) {
        case 'A': case 'EE': return GREEN;
        case 'B': case 'ME': return '#2563EB';
        case 'C': case 'AE': return ORANGE;
        case 'D': case 'BE': return '#DC2626';
        default: return '#EF4444';
    }
};

/* ── Styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
    page: { padding: 0, fontFamily: 'Helvetica', fontSize: 9, color: GRAY_700 },

    /* Top / bottom navy decorative bars */
    navyBar: { height: 6, backgroundColor: NAVY, marginBottom: 0 },
    navyBarBottom: { height: 6, backgroundColor: NAVY, marginTop: 'auto' },

    /* Header – white background */
    headerBand: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: WHITE,
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    logo: { width: 52, height: 52, borderRadius: 26, objectFit: 'contain', backgroundColor: WHITE },
    logoPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: LIGHT_GRAY, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
    schoolName: { fontSize: 16, fontWeight: 'bold', color: BLACK, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.8 },
    schoolAddress: { fontSize: 8, color: GRAY_400, marginTop: 3, textAlign: 'center' },
    photoPlaceholder: { width: 46, height: 52, borderRadius: 4, backgroundColor: PHOTO_GRAY, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    photoSilhouette: { fontSize: 26, color: GRAY_400 },

    /* Banner ribbon – sky blue with rounded corners */
    bannerRibbon: {
        backgroundColor: SKY_BLUE,
        paddingVertical: 6,
        paddingHorizontal: 16,
        marginHorizontal: 24,
        alignItems: 'center',
        marginBottom: 12,
        borderRadius: 6,
    },
    bannerText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 2 },

    /* Student info grid */
    infoGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 26 },
    infoItem: { flex: 1, marginHorizontal: 3 },
    infoLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: BLACK, textTransform: 'uppercase', marginBottom: 1 },
    infoValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY, borderBottom: `1pt solid ${GRAY_200}`, paddingBottom: 3 },

    /* Exam + Performance summary row */
    summaryStrip: {
        flexDirection: 'row',
        backgroundColor: LIGHT_GRAY,
        borderRadius: 4,
        padding: 8,
        marginBottom: 12,
        marginHorizontal: 24,
        borderLeft: `3pt solid ${NAVY}`,
    },
    summaryLeft: { flex: 1, borderRight: `1pt solid ${GRAY_200}`, paddingRight: 8 },
    summaryRight: { flex: 1, paddingLeft: 8, flexDirection: 'row', justifyContent: 'space-around' },
    summaryLabel: { fontSize: 7, color: GRAY_400, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
    summaryVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: NAVY },

    /* Table */
    table: { marginBottom: 10, overflow: 'hidden', border: `1pt solid ${GRAY_200}`, marginHorizontal: 24 },
    tableHeader: { flexDirection: 'row', backgroundColor: NAVY, paddingVertical: 6, paddingHorizontal: 4 },
    thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 5, paddingHorizontal: 4, backgroundColor: WHITE },
    tableRowAlt: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 5, paddingHorizontal: 4, backgroundColor: LIGHT_GRAY },

    /* Column widths — CBC */
    colNo: { width: '5%', textAlign: 'center' },
    colSubject: { width: '22%' },
    colMarks: { width: '13%', textAlign: 'center' },
    colRank: { width: '8%', textAlign: 'center' },
    colPoints: { width: '10%', textAlign: 'center' },
    colComment: { width: '30%' },
    colInstructor: { width: '12%' },

    /* Column widths — KCSE */
    colKcseSubject: { width: '22%' },
    colKcseScore: { width: '10%', textAlign: 'center' },
    colKcsePct: { width: '10%', textAlign: 'center' },
    colKcseRank: { width: '8%', textAlign: 'center' },
    colKcseGrade: { width: '8%', textAlign: 'center' },
    colKcsePoints: { width: '8%', textAlign: 'center' },
    colKcseComment: { width: '29%' },

    tdText: { fontSize: 8.5, color: BLACK },
    tdSmall: { fontSize: 7.5, color: GRAY_700 },
    tdBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: BLACK },

    /* Totals row – sky blue bg */
    totalsRow: { flexDirection: 'row', backgroundColor: SKY_BLUE, paddingVertical: 6, paddingHorizontal: 4, borderTop: `1.5pt solid ${NAVY}` },

    /* Bottom: Average badge + Grading key */
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 12, paddingHorizontal: 24, alignItems: 'flex-start' },

    /* Average badge — circular */
    avgBadge: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: ORANGE,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
    },
    avgLabel: { fontSize: 7, color: WHITE, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 1 },
    avgValue: { fontSize: 20, color: WHITE, fontFamily: 'Helvetica-Bold' },
    avgGrade: { fontSize: 9, color: WHITE, marginTop: 1 },

    /* Grading key — Steel Blue body */
    gradingKey: {
        flex: 1,
        backgroundColor: STEEL_BLUE,
        borderRadius: 4,
        padding: 0,
        overflow: 'hidden',
    },
    gradingKeyHeader: { backgroundColor: NAVY, paddingVertical: 4, paddingHorizontal: 6 },
    gradingKeyTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase' },
    gradingContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 4 },
    gradingItem: { flexDirection: 'row', width: '25%', paddingVertical: 2, paddingHorizontal: 2, alignItems: 'center' },
    gradingSymbol: { width: 14, fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE },
    gradingLabel: { flex: 1, fontSize: 6, color: WHITE, overflow: 'hidden', textOverflow: 'ellipsis' },
    gradingRange: { width: 34, fontSize: 6, color: '#D0E8F5', textAlign: 'right' },

    /* Comments */
    commentBox: { borderLeft: `3pt solid ${NAVY}`, padding: 10, marginBottom: 8, backgroundColor: WHITE, marginHorizontal: 24, border: `1pt solid ${GRAY_200}` },
    commentTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 6 },
    commentText: { fontSize: 9, fontStyle: 'italic', color: GRAY_700, lineHeight: 1.6 },
    commentLine: { borderBottom: `1pt dotted ${GRAY_400}`, height: 18, width: '100%', marginBottom: 2 },

    /* Signatures */
    signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 6, paddingHorizontal: 28 },
    sigBlock: { width: '45%' },
    sigLabel: { fontSize: 8, color: GRAY_700, marginBottom: 2 },
    sigLine: { borderBottom: `1pt solid ${GRAY_700}`, height: 24 },

    /* Footer */
    footer: {
        textAlign: 'center',
        fontSize: 7,
        color: GRAY_400,
        paddingTop: 6,
        paddingBottom: 2,
    },
    footerLine: { marginBottom: 2 },
});

/* ── React-PDF Document ─────────────────────────────────── */
export function ReportCardDocument({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    const isKCSE = data.gradingSystemType === 'KCSE';

    const totalScore = data.totalScore ?? data.subjectMarks.reduce((sum, m) => sum + (m.score || 0), 0);
    const totalPossible = data.totalPossible ?? data.subjectMarks.reduce((sum, m) => sum + m.totalPossible, 0);

    let rowCounter = 0;

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <Document>
            <Page size="A4" style={[s.page, { display: 'flex', flexDirection: 'column' }]}>
                {/* ═══ TOP NAVY BAR ═══ */}
                <View style={s.navyBar} />

                <View style={{ flex: 1 }}>

                    {/* ═══ HEADER BAND (white bg) ═══ */}
                    <View style={s.headerBand}>
                        {/* Logo */}
                        <View>
                            {data.schoolLogoUrl ? (
                                <Image style={s.logo} src={data.schoolLogoUrl} />
                            ) : (
                                <View style={s.logoPlaceholder}>
                                    <Text style={{ fontSize: 20, color: GRAY_400 }}>🏫</Text>
                                </View>
                            )}
                        </View>

                        {/* School Name */}
                        <View style={s.headerCenter}>
                            <Text style={s.schoolName}>{data.schoolName}</Text>
                            {data.schoolAddress && (
                                <Text style={s.schoolAddress}>{data.schoolAddress}</Text>
                            )}
                        </View>

                        {/* QR Code */}
                        <View>
                            {qrCodeDataUri ? (
                                <Image style={{ width: 46, height: 52, borderRadius: 4, backgroundColor: WHITE, padding: 2 }} src={qrCodeDataUri} />
                            ) : (
                                <View style={s.photoPlaceholder}>
                                    <Text style={s.photoSilhouette}>👤</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ═══ SKY BLUE BANNER RIBBON ═══ */}
                    <View style={s.bannerRibbon}>
                        <Text style={s.bannerText}>
                            {isKCSE ? 'Learner Academic Report' : 'Learner Assessment Report'}
                        </Text>
                    </View>

                    {/* ═══ STUDENT INFO GRID ═══ */}
                    <View style={s.infoGrid}>
                        <View style={s.infoItem}>
                            <Text style={s.infoLabel}>Name</Text>
                            <Text style={s.infoValue}>{data.studentName}</Text>
                        </View>
                        <View style={[s.infoItem, { flex: 0.6 }]}>
                            <Text style={s.infoLabel}>Class</Text>
                            <Text style={s.infoValue}>{data.className}</Text>
                        </View>
                        <View style={[s.infoItem, { flex: 0.6 }]}>
                            <Text style={s.infoLabel}>Adm No</Text>
                            <Text style={s.infoValue}>{data.enrollmentNumber || ''}</Text>
                        </View>
                        <View style={[s.infoItem, { flex: 0.5 }]}>
                            <Text style={s.infoLabel}>Year</Text>
                            <Text style={s.infoValue}>{data.academicYear}</Text>
                        </View>
                    </View>

                    {/* ═══ EXAM DETAILS + PERFORMANCE SUMMARY ═══ */}
                    <View style={s.summaryStrip}>
                        <View style={s.summaryLeft}>
                            <Text style={s.summaryLabel}>Exam</Text>
                            <Text style={s.summaryVal}>{data.examTitle}</Text>
                        </View>
                        <View style={s.summaryRight}>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={s.summaryLabel}>Rank</Text>
                                <Text style={s.summaryVal}>
                                    {data.classRank > 0 ? `${data.classRank}/${data.totalStudents}` : '—'}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={s.summaryLabel}>Total Marks</Text>
                                <Text style={s.summaryVal}>{totalScore}</Text>
                            </View>
                            {isKCSE && data.totalPoints !== undefined && (
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={s.summaryLabel}>Points</Text>
                                    <Text style={s.summaryVal}>{data.totalPoints}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ═══ SUBJECT TABLE ═══ */}
                    <View style={s.table}>
                        {/* Table header */}
                        {isKCSE ? (
                            <View style={s.tableHeader}>
                                <Text style={[s.thText, s.colNo]}>#</Text>
                                <Text style={[s.thText, s.colKcseSubject]}>Subject</Text>
                                <Text style={[s.thText, s.colKcseScore]}>Score</Text>
                                <Text style={[s.thText, s.colKcsePct]}>%</Text>
                                <Text style={[s.thText, s.colKcseRank]}>Rank</Text>
                                <Text style={[s.thText, s.colKcseGrade]}>Grade</Text>
                                <Text style={[s.thText, s.colKcsePoints]}>Pts</Text>
                                <Text style={[s.thText, s.colKcseComment]}>Comment</Text>
                            </View>
                        ) : (
                            <View style={s.tableHeader}>
                                <Text style={[s.thText, s.colNo]}>#</Text>
                                <Text style={[s.thText, s.colSubject]}>Learning Area</Text>
                                <Text style={[s.thText, s.colMarks]}>Marks / %</Text>
                                <Text style={[s.thText, s.colRank]}>Rank</Text>
                                <Text style={[s.thText, s.colPoints]}>Points</Text>
                                <Text style={[s.thText, s.colComment]}>Comments</Text>
                                <Text style={[s.thText, s.colInstructor]}>Instructor</Text>
                            </View>
                        )}

                        {/* Subject rows */}
                        {data.subjectMarks.map((sm) => {
                            rowCounter++;
                            const rowStyle = rowCounter % 2 === 0 ? s.tableRowAlt : s.tableRow;

                            if (isKCSE) {
                                return (
                                    <View style={rowStyle} key={`${sm.subjectName}-${rowCounter}`}>
                                        <Text style={[s.tdText, s.colNo]}>{rowCounter}</Text>
                                        <Text style={[s.tdText, s.colKcseSubject]}>{sm.subjectCode || sm.subjectName}</Text>
                                        <Text style={[s.tdBold, s.colKcseScore]}>{sm.score ?? '—'}</Text>
                                        <Text style={[s.tdText, s.colKcsePct]}>{sm.percentage != null ? `${sm.percentage}%` : '—'}</Text>
                                        <Text style={[s.tdText, s.colKcseRank]}>{sm.subjectRank ? `${sm.subjectRank}/${data.totalStudents}` : '—'}</Text>
                                        <Text style={[s.tdBold, s.colKcseGrade, { color: gradeColor(sm.grade) }]}>{sm.grade}</Text>
                                        <Text style={[s.tdText, s.colKcsePoints]}>{sm.points ?? '—'}</Text>
                                        <Text style={[s.tdSmall, s.colKcseComment]}>{sm.teacherComment || generateShortFeedback(sm.percentage, sm.grade)}</Text>
                                    </View>
                                );
                            }

                            // CBC layout
                            return (
                                <View style={rowStyle} key={`${sm.subjectName}-${rowCounter}`}>
                                    <Text style={[s.tdText, s.colNo]}>{rowCounter}</Text>
                                    <Text style={[s.tdText, s.colSubject]}>{sm.subjectCode || sm.subjectName}</Text>
                                    <Text style={[s.tdBold, s.colMarks]}>
                                        {sm.score != null ? `${sm.score} / ${sm.percentage}%` : '—'}
                                    </Text>
                                    <Text style={[s.tdText, s.colRank]}>{sm.subjectRank ? `${sm.subjectRank}/${data.totalStudents}` : '—'}</Text>
                                    <Text style={[s.tdBold, s.colPoints, { color: gradeColor(sm.grade) }]}>
                                        {sm.rubric || sm.grade || '—'}
                                    </Text>
                                    <Text style={[s.tdSmall, s.colComment]}>{sm.teacherComment || generateShortFeedback(sm.percentage, sm.grade)}</Text>
                                    <Text style={[s.tdSmall, s.colInstructor]}>{sm.instructorName || ''}</Text>
                                </View>
                            );
                        })}

                        {/* Totals row – sky blue bg */}
                        <View style={s.totalsRow}>
                            <Text style={[s.tdBold, s.colNo]}></Text>
                            <Text style={[s.tdBold, isKCSE ? s.colKcseSubject : s.colSubject, { color: NAVY }]}>TOTAL</Text>
                            {isKCSE ? (
                                <>
                                    <Text style={[s.tdBold, s.colKcseScore, { color: ORANGE }]}>{totalScore}</Text>
                                    <Text style={[s.tdBold, s.colKcsePct, { color: NAVY }]}>{data.overallPercentage}%</Text>
                                    <Text style={[s.tdBold, s.colKcseRank, { color: NAVY }]}>{data.classRank > 0 ? `${data.classRank}` : '—'}</Text>
                                    <Text style={[s.tdBold, s.colKcseGrade, { color: gradeColor(data.overallGrade) }]}>{data.overallGrade}</Text>
                                    <Text style={[s.tdBold, s.colKcsePoints, { color: NAVY }]}>{data.totalPoints ?? '—'}</Text>
                                    <Text style={[s.tdBold, s.colKcseComment]}></Text>
                                </>
                            ) : (
                                <>
                                    <Text style={[s.tdBold, s.colMarks, { color: ORANGE }]}>{totalScore}</Text>
                                    <Text style={[s.tdBold, s.colRank, { color: NAVY }]}>{data.classRank > 0 ? `${data.classRank}` : '—'}</Text>
                                    <Text style={[s.tdBold, s.colPoints, { color: gradeColor(data.overallGrade) }]}>{data.overallGrade}</Text>
                                    <Text style={[s.tdBold, s.colComment]}></Text>
                                    <Text style={[s.tdBold, s.colInstructor]}></Text>
                                </>
                            )}
                        </View>
                    </View>

                    {/* ═══ AVERAGE BADGE + GRADING KEY ═══ */}
                    <View style={s.bottomRow}>
                        {/* Circular orange badge */}
                        <View style={s.avgBadge}>
                            <Text style={s.avgLabel}>Average</Text>
                            <Text style={s.avgValue}>{data.overallPercentage}%</Text>
                            <Text style={s.avgGrade}>{data.overallGrade}</Text>
                        </View>

                        {/* Grading key — Steel Blue */}
                        <View style={s.gradingKey}>
                            <View style={s.gradingKeyHeader}>
                                <Text style={s.gradingKeyTitle}>Grading Key</Text>
                            </View>
                            <View style={s.gradingContainer}>
                                {data.gradeBoundaries.map((gb) => (
                                    <View style={s.gradingItem} key={gb.symbol}>
                                        <Text style={s.gradingSymbol}>{gb.symbol}</Text>
                                        <Text style={s.gradingLabel}>{gb.label}</Text>
                                        <Text style={s.gradingRange}>{gb.min}-{gb.max}%</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* ═══ COMMENTS ═══ */}
                    <View style={s.commentBox}>
                        <Text style={s.commentTitle}>Class Teacher&apos;s Comment:</Text>
                        {data.classTeacherComment ? (
                            <Text style={s.commentText}>{data.classTeacherComment}</Text>
                        ) : (
                            <View>
                                <View style={s.commentLine} />
                                <View style={s.commentLine} />
                            </View>
                        )}
                    </View>

                    <View style={s.commentBox}>
                        <Text style={s.commentTitle}>Principal&apos;s Comment:</Text>
                        {data.principalComment ? (
                            <Text style={s.commentText}>{data.principalComment}</Text>
                        ) : (
                            <View>
                                <View style={s.commentLine} />
                                <View style={s.commentLine} />
                            </View>
                        )}
                    </View>


                    {/* ═══ SIGNATURES ═══ */}
                    <View style={s.signaturesRow}>
                        <View style={s.sigBlock}>
                            <Text style={s.sigLabel}>Parent&apos;s / Guardian&apos;s Signature</Text>
                            <View style={s.sigLine} />
                        </View>
                        <View style={s.sigBlock}>
                            <Text style={s.sigLabel}>Class Teacher&apos;s Signature</Text>
                            <View style={s.sigLine} />
                        </View>
                    </View>

                </View>

                {/* ═══ FOOTER ═══ */}
                <View style={s.footer}>
                    <Text style={s.footerLine}>Report generated on {today}</Text>
                    {data.openingDate && (
                        <Text style={s.footerLine}>Next term begins on: {data.openingDate}</Text>
                    )}
                    <Text style={s.footerLine}>System developed by: Matokeo</Text>
                    <Text>This document is electronically generated</Text>
                </View>

                {/* ═══ BOTTOM NAVY BAR ═══ */}
                <View style={s.navyBarBottom} />
            </Page>
        </Document>
    );
}

/* ── Short feedback helper ──────────────────────────────── */
function generateShortFeedback(percentage: number | null, grade: string): string {
    if (percentage == null) return '';
    if (percentage >= 80) return 'Excellent work';
    if (percentage >= 60) return 'Good progress';
    if (percentage >= 40) return 'Fair, needs improvement';
    return 'Needs more effort';
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
