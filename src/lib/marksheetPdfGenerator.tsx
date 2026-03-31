import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';

export interface SubjectStats {
    mean: number;
    highest: number;
    lowest: number;
    studentCount: number;
}

export interface SubjectRanking {
    code: string;
    mean: number;
    rank: number;
}

export interface MarkSheetData {
    schoolName: string;
    schoolLogoUrl?: string;
    schoolAddress?: string;
    examTitle: string;
    academicYear: string;
    className: string;
    gradingSystemType: 'KCSE' | 'CBC';
    subjects: { code: string; name: string }[];
    students: {
        studentName: string;
        admissionNumber: string;
        marks: Record<string, number | null>;
        overallPercentage: number;
        overallGrade: string;
        totalPoints: number;
        overallPointsGrade?: string;
        classRank: number;
    }[];
    gradeDistribution: Record<string, number>;
    meanGrade: string;
    meanPercentage: number;
    subjectStats: Record<string, SubjectStats>;
    subjectRankings: SubjectRanking[];
}

/* ── Colour palette (aligned with Report Card) ────────── */
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

const scoreColor = (score: number | null) => {
    if (score === null) return GRAY_400;
    if (score >= 80) return GREEN;
    if (score >= 60) return '#2563EB';
    if (score >= 40) return ORANGE;
    return '#EF4444';
};

/* ── Styles (aligned with Report Card) ─────────────────── */
const s = StyleSheet.create({
    page: { padding: 0, fontFamily: 'Helvetica', fontSize: 8, color: GRAY_700, minHeight: '800px' },

    /* Top / bottom navy decorative bars — matching report card */
    navyBar: { height: 8, backgroundColor: NAVY, marginBottom: 0 },
    navyBarBottom: { height: 8, backgroundColor: NAVY, marginTop: 'auto' },

    /* Header – white background — matching report card */
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

    /* Banner ribbon — sky blue with rounded corners, matching report card */
    bannerRibbon: {
        backgroundColor: SKY_BLUE,
        paddingVertical: 6,
        paddingHorizontal: 16,
        marginHorizontal: 24,
        alignItems: 'center',
        marginBottom: 10,
        borderRadius: 6,
    },
    bannerText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 2 },

    /* Info strip — matching report card summary style */
    summaryStrip: {
        flexDirection: 'row',
        backgroundColor: LIGHT_GRAY,
        borderRadius: 4,
        padding: 8,
        marginBottom: 10,
        marginHorizontal: 24,
        borderLeft: `3pt solid ${NAVY}`,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryLabel: { fontSize: 7, color: GRAY_400, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
    summaryVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY },

    /* Table */
    table: { marginBottom: 10, overflow: 'hidden', border: `1pt solid ${GRAY_200}`, marginHorizontal: 24 },
    tableHeader: { flexDirection: 'row', backgroundColor: NAVY, paddingVertical: 5, paddingHorizontal: 2 },
    tableRow: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 4, paddingHorizontal: 2, backgroundColor: WHITE },
    tableRowAlt: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 4, paddingHorizontal: 2, backgroundColor: LIGHT_GRAY },
    tableRowHighlight: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 4, paddingHorizontal: 2, backgroundColor: '#FFF8ED' },

    /* Fixed column widths */
    colRank: { width: '5%', textAlign: 'center', paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' },
    colName: { width: '18%', paddingVertical: 3, paddingHorizontal: 3, justifyContent: 'center' },
    colAdm: { width: '8%', textAlign: 'center', paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' },
    colSummary: { width: '7%', textAlign: 'center', paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' },

    thText: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: WHITE },
    tdText: { fontSize: 6.5 },
    tdTextBold: { fontSize: 6.5, fontFamily: 'Helvetica-Bold' },

    /* Totals row – sky blue bg, matching report card */
    totalsRow: { flexDirection: 'row', backgroundColor: SKY_BLUE, paddingVertical: 5, paddingHorizontal: 2, borderTop: `1.5pt solid ${NAVY}` },

    /* Bottom summary — matching report card style */
    bottomRow: { flexDirection: 'row', gap: 8, marginBottom: 12, paddingHorizontal: 24 },
    bottomRowStack: { marginTop: 8, marginBottom: 10 },

    summaryCard: {
        flex: 1,
        backgroundColor: LIGHT_GRAY,
        borderRadius: 6,
        padding: 8,
        borderLeft: `3pt solid ${NAVY}`,
    },
    summaryCardTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 6, textTransform: 'uppercase' },
    summaryCardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    summaryCardLabel: { fontSize: 7, color: GRAY_700 },
    summaryCardValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY },

    gradeDistCard: {
        flex: 1,
        backgroundColor: LIGHT_GRAY,
        borderRadius: 6,
        padding: 6,
        borderLeft: `3pt solid ${GREEN}`,
    },
    gradeDistContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    gradeRow: { flexDirection: 'row', width: '30%', paddingVertical: 1, alignItems: 'center', gap: 4 },
    gradeLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
    gradeCount: { fontSize: 6, color: GRAY_700 },

    subjectPerfCard: {
        backgroundColor: '#F0F9FF',
        borderRadius: 8,
        padding: 12,
        border: `2pt solid ${STEEL_BLUE}`,
        marginHorizontal: 24,
        marginBottom: 10,
        minHeight: 80,
    },
    subjectPerfTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: STEEL_BLUE, marginBottom: 10, textTransform: 'uppercase', textAlign: 'center', letterSpacing: 1 },
    subjectPerfHeader: { flexDirection: 'row', backgroundColor: STEEL_BLUE, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 4, marginBottom: 4 },
    subjectPerfRow: { flexDirection: 'row', paddingVertical: 5, borderBottom: `1pt solid ${GRAY_200}`, paddingHorizontal: 4 },
    subjectPerfColCode: { width: '12%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY_700 },
    subjectPerfColMean: { width: '12%', fontSize: 7, textAlign: 'center', color: GRAY_700 },
    subjectPerfColHighest: { width: '14%', fontSize: 7, textAlign: 'center', color: GREEN },
    subjectPerfColLowest: { width: '14%', fontSize: 7, textAlign: 'center', color: '#EF4444' },
    subjectPerfColCount: { width: '18%', fontSize: 7, textAlign: 'center', color: GRAY_700 },
    subjectPerfColRank: { width: '30%', fontSize: 8, textAlign: 'center', fontFamily: 'Helvetica-Bold' },

    /* Footer — matching report card */
    footer: {
        textAlign: 'center',
        fontSize: 7,
        color: GRAY_400,
        paddingTop: 6,
        paddingBottom: 2,
    },
    footerLine: { marginBottom: 2 },
});

/* ── Document Component ─────────────────────────────────── */
export function MarkSheetDocument({ data }: { data: MarkSheetData }) {
    const numSubjects = data.subjects.length > 0 ? data.subjects.length : 1;
    // Fixed columns: Rank 5% + Name 18% + Adm 8% + Total% 7% + Points 7% + Grade 7% = 52%
    const remainingWidth = 48;
    const colSubjWidth = `${remainingWidth / numSubjects}%`;
    const isKCSE = data.gradingSystemType === 'KCSE';

    // Sort students by rank for display
    const sortedStudents = [...data.students].sort((a, b) => a.classRank - b.classRank);

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <Document>
            <Page size="A4" orientation="portrait" style={[s.page, { display: 'flex', flexDirection: 'column' }]}>
                {/* ═══ TOP NAVY BAR ═══ */}
                <View style={s.navyBar} />

                <View style={{ flex: 1, minHeight: 600 }}>

                    {/* ═══ HEADER BAND (white bg, matching report card) ═══ */}
                    <View style={s.headerBand}>
                        <View>
                            {data.schoolLogoUrl ? (
                                <Image style={s.logo} src={data.schoolLogoUrl} />
                            ) : (
                                <View style={s.logoPlaceholder}>
                                    <Text style={{ fontSize: 20, color: GRAY_400 }}>🏫</Text>
                                </View>
                            )}
                        </View>
                        <View style={s.headerCenter}>
                            <Text style={s.schoolName}>{data.schoolName}</Text>
                            {data.schoolAddress && (
                                <Text style={s.schoolAddress}>{data.schoolAddress}</Text>
                            )}
                        </View>
                        <View style={{ width: 52 }} />
                    </View>

                    {/* ═══ SKY BLUE BANNER RIBBON ═══ */}
                    <View style={s.bannerRibbon}>
                        <Text style={s.bannerText}>
                            {data.examTitle} — Class Marksheet
                        </Text>
                    </View>

                    {/* ═══ INFO STRIP (matching report card summary) ═══ */}
                    <View style={s.summaryStrip}>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryLabel}>Class</Text>
                            <Text style={s.summaryVal}>{data.className}</Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryLabel}>Year</Text>
                            <Text style={s.summaryVal}>{data.academicYear}</Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryLabel}>Students</Text>
                            <Text style={s.summaryVal}>{data.students.length}</Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryLabel}>Mean Grade</Text>
                            <Text style={[s.summaryVal, { color: gradeColor(data.meanGrade) }]}>{data.meanGrade}</Text>
                        </View>
                        <View style={s.summaryItem}>
                            <Text style={s.summaryLabel}>Mean %</Text>
                            <Text style={s.summaryVal}>{Math.round(data.meanPercentage)}%</Text>
                        </View>
                    </View>

                    {/* ═══ DATA TABLE ═══ */}
                    <View style={s.table}>
                        {/* Header Row */}
                        <View style={s.tableHeader}>
                            <View style={s.colRank}><Text style={s.thText}>Pos</Text></View>
                            <View style={s.colName}><Text style={s.thText}>Student Name</Text></View>
                            <View style={s.colAdm}><Text style={s.thText}>Adm No.</Text></View>

                            {data.subjects.map(subj => (
                                <View key={subj.code} style={{ width: colSubjWidth, textAlign: 'center', paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' }}>
                                    <Text style={[s.thText, { textAlign: 'center' }]}>{subj.code}</Text>
                                </View>
                            ))}

                            <View style={s.colSummary}><Text style={s.thText}>Total %</Text></View>
                            {isKCSE && <View style={s.colSummary}><Text style={s.thText}>Points</Text></View>}
                            <View style={s.colSummary}><Text style={s.thText}>Grade</Text></View>
                        </View>

                        {/* Student Rows */}
                        {sortedStudents.map((student, idx) => {
                            const isTop3 = student.classRank <= 3;
                            const rowStyle = isTop3 ? s.tableRowHighlight : (idx % 2 === 0 ? s.tableRowAlt : s.tableRow);
                            return (
                                <View key={student.admissionNumber || idx} style={rowStyle} wrap={false}>
                                    <View style={[s.colRank, { borderRight: `0.5pt solid ${GRAY_200}` }]}>
                                        <Text style={[s.tdTextBold, isTop3 ? { color: ORANGE } : {}]}>{student.classRank}</Text>
                                    </View>
                                    <View style={[s.colName, { borderRight: `0.5pt solid ${GRAY_200}` }]}>
                                        <Text style={s.tdTextBold}>{student.studentName}</Text>
                                    </View>
                                    <View style={[s.colAdm, { borderRight: `0.5pt solid ${GRAY_200}` }]}>
                                        <Text style={s.tdText}>{student.admissionNumber}</Text>
                                    </View>

                                    {data.subjects.map(subj => {
                                        const val = student.marks[subj.code];
                                        return (
                                            <View key={subj.code} style={{ width: colSubjWidth, textAlign: 'center', borderRight: `0.5pt solid ${GRAY_200}`, paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' }}>
                                                <Text style={[s.tdText, { textAlign: 'center', color: scoreColor(val) }]}>
                                                    {val !== null && val !== undefined ? val : '-'}
                                                </Text>
                                            </View>
                                        );
                                    })}

                                    <View style={[s.colSummary, { borderRight: `0.5pt solid ${GRAY_200}` }]}>
                                        <Text style={[s.tdTextBold, { color: scoreColor(student.overallPercentage) }]}>
                                            {Math.round(student.overallPercentage)}
                                        </Text>
                                    </View>
                                    {isKCSE && (
                                        <View style={[s.colSummary, { borderRight: `0.5pt solid ${GRAY_200}` }]}>
                                            <Text style={s.tdTextBold}>{student.totalPoints}</Text>
                                        </View>
                                    )}
                                    <View style={s.colSummary}>
                                        <Text style={[s.tdTextBold, { color: gradeColor(student.overallGrade) }]}>
                                            {student.overallGrade}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* ═══ BOTTOM SUMMARY (matching report card style) ═══ */}
                    <View style={s.bottomRow}>
                        {/* Class Summary */}
                        <View style={s.summaryCard}>
                            <Text style={s.summaryCardTitle}>Class Performance</Text>
                            <View style={s.summaryCardRow}>
                                <Text style={s.summaryCardLabel}>Total Students</Text>
                                <Text style={s.summaryCardValue}>{data.students.length}</Text>
                            </View>
                            <View style={s.summaryCardRow}>
                                <Text style={s.summaryCardLabel}>Mean %</Text>
                                <Text style={s.summaryCardValue}>{Math.round(data.meanPercentage)}%</Text>
                            </View>
                            <View style={s.summaryCardRow}>
                                <Text style={s.summaryCardLabel}>Mean Grade</Text>
                                <Text style={[s.summaryCardValue, { color: gradeColor(data.meanGrade) }]}>{data.meanGrade}</Text>
                            </View>
                        </View>

                        {/* Grade Distribution */}
                        {data.gradeDistribution && Object.keys(data.gradeDistribution).length > 0 && (
                            <View style={s.gradeDistCard}>
                                <Text style={[s.summaryCardTitle, { color: GREEN }]}>Grade Distribution</Text>
                                <View style={s.gradeDistContainer}>
                                    {Object.entries(data.gradeDistribution)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([grade, count]) => (
                                            <View key={grade} style={s.gradeRow}>
                                                <Text style={[s.gradeLabel, { color: gradeColor(grade) }]}>{grade}</Text>
                                                <Text style={s.gradeCount}>
                                                    {count} ({((count / data.students.length) * 100).toFixed(0)}%)
                                                </Text>
                                            </View>
                                        ))}
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Subject Performance - Full Width Below */}
                    {data.subjectRankings && data.subjectRankings.length > 0 && (
                        <View style={s.bottomRowStack}>
                            <View style={s.subjectPerfCard}>
                                <Text style={s.subjectPerfTitle}>📊 Subject Performance Ranking</Text>
                                <View style={s.subjectPerfHeader}>
                                    <Text style={[s.subjectPerfColCode, { color: WHITE }]}>Subject</Text>
                                    <Text style={[s.subjectPerfColMean, { color: WHITE }]}>Mean</Text>
                                    <Text style={[s.subjectPerfColHighest, { color: WHITE }]}>Highest</Text>
                                    <Text style={[s.subjectPerfColLowest, { color: WHITE }]}>Lowest</Text>
                                    <Text style={[s.subjectPerfColCount, { color: WHITE }]}>Students</Text>
                                    <Text style={[s.subjectPerfColRank, { color: WHITE }]}>Rank</Text>
                                </View>
                                {data.subjectRankings.map((subj, idx) => {
                                    const stats = data.subjectStats[subj.code];
                                    const isTop3 = subj.rank <= 3;
                                    return (
                                        <View key={subj.code} style={[s.subjectPerfRow, idx % 2 === 0 ? { backgroundColor: LIGHT_GRAY } : { backgroundColor: WHITE }]} wrap={false}>
                                            <Text style={[s.subjectPerfColCode, isTop3 ? { color: ORANGE } : { color: GRAY_700 }]}>{subj.code}</Text>
                                            <Text style={s.subjectPerfColMean}>{stats?.mean || '-'}</Text>
                                            <Text style={s.subjectPerfColHighest}>{stats?.highest || '-'}</Text>
                                            <Text style={s.subjectPerfColLowest}>{stats?.lowest || '-'}</Text>
                                            <Text style={s.subjectPerfColCount}>{stats?.studentCount || '-'}</Text>
                                            <Text style={[s.subjectPerfColRank, isTop3 ? { color: ORANGE, fontFamily: 'Helvetica-Bold' } : { color: GRAY_700 }]}>#{subj.rank}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                </View>

                {/* ═══ FOOTER (matching report card) ═══ */}
                <View style={s.footer}>
                    <Text style={s.footerLine}>Report generated on {today}</Text>
                    <Text style={s.footerLine}>System developed by: Matokeo</Text>
                    <Text>This document is electronically generated</Text>
                </View>

                {/* ═══ BOTTOM NAVY BAR ═══ */}
                <View style={s.navyBarBottom} />
            </Page>
        </Document>
    );
}

export async function generateMarkSheetPDF(data: MarkSheetData): Promise<Buffer> {
    const buffer = await renderToBuffer(<MarkSheetDocument data={data} />);
    return Buffer.from(buffer);
}
