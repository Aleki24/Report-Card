import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';

export interface MarkSheetData {
    schoolName: string;
    schoolLogoUrl?: string;
    schoolAddress?: string;
    examTitle: string;
    academicYear: string;
    className: string;
    gradingSystemType: 'KCSE' | 'CBC';
    subjects: string[];
    students: {
        studentName: string;
        admissionNumber: string;
        marks: Record<string, number | null>;
        overallPercentage: number;
        overallGrade: string;
        totalPoints: number;
        classRank: number;
    }[];
    gradeDistribution: Record<string, number>;
    meanGrade: string;
    meanPercentage: number;
}

/* ── Colour palette (matching Report Card) ─────────────── */
const BLUE_DARK = '#1B2B5E';
const BLUE_MID = '#2E4A8E';
const BLUE_LIGHT = '#E8EDF6';
const BLUE_ACCENT = '#4A7CC9';
const ORANGE = '#E8850C';
const GREEN = '#22A86B';
const GRAY_50 = '#F7F8FA';
const GRAY_200 = '#E2E6ED';
const GRAY_400 = '#9CA3AF';
const GRAY_700 = '#374151';
const WHITE = '#FFFFFF';

const gradeColor = (grade: string) => {
    const base = grade.replace(/[+-\d]/g, '').toUpperCase();
    switch (base) {
        case 'A': case 'EE': return GREEN;
        case 'B': case 'ME': return BLUE_ACCENT;
        case 'C': case 'AE': return ORANGE;
        case 'D': case 'BE': return '#DC2626';
        default: return '#EF4444';
    }
};

const scoreColor = (score: number | null) => {
    if (score === null) return GRAY_400;
    if (score >= 80) return GREEN;
    if (score >= 60) return BLUE_ACCENT;
    if (score >= 40) return ORANGE;
    return '#EF4444';
};

/* ── Styles (Report Card-aligned) ──────────────────────── */
const s = StyleSheet.create({
    page: { padding: 24, fontFamily: 'Helvetica', fontSize: 8, color: GRAY_700 },

    /* Header band — identical to report card */
    headerBand: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: BLUE_DARK,
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginHorizontal: -24,
        marginTop: -24,
    },
    logo: { width: 52, height: 52, borderRadius: 26, objectFit: 'contain', backgroundColor: WHITE },
    logoPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: BLUE_MID },
    headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
    schoolName: { fontSize: 16, fontWeight: 'bold', color: WHITE, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.8 },

    /* Banner ribbon — matching report card */
    bannerRibbon: {
        backgroundColor: BLUE_ACCENT,
        paddingVertical: 6,
        paddingHorizontal: 16,
        marginHorizontal: -24,
        alignItems: 'center',
        marginBottom: 10,
    },
    bannerText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 2 },

    /* Info strip — matching report card summary style */
    summaryStrip: {
        flexDirection: 'row',
        backgroundColor: BLUE_LIGHT,
        borderRadius: 4,
        padding: 8,
        marginBottom: 10,
        borderLeft: `3pt solid ${BLUE_DARK}`,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryLabel: { fontSize: 7, color: GRAY_400, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
    summaryVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLUE_DARK },

    /* Table */
    table: { marginBottom: 10, borderRadius: 4, overflow: 'hidden', border: `1pt solid ${GRAY_200}` },
    tableHeader: { flexDirection: 'row', backgroundColor: BLUE_DARK, paddingVertical: 5, paddingHorizontal: 2 },
    tableRow: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 4, paddingHorizontal: 2, backgroundColor: WHITE },
    tableRowAlt: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 4, paddingHorizontal: 2, backgroundColor: GRAY_50 },
    tableRowHighlight: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 4, paddingHorizontal: 2, backgroundColor: '#FFF8ED' },

    /* Fixed column widths */
    colRank: { width: '5%', textAlign: 'center', paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' },
    colName: { width: '18%', paddingVertical: 3, paddingHorizontal: 3, justifyContent: 'center' },
    colAdm: { width: '8%', textAlign: 'center', paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' },
    colSummary: { width: '7%', textAlign: 'center', paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' },

    thText: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: WHITE },
    tdText: { fontSize: 6.5 },
    tdTextBold: { fontSize: 6.5, fontFamily: 'Helvetica-Bold' },

    /* Totals row */
    totalsRow: { flexDirection: 'row', backgroundColor: BLUE_LIGHT, paddingVertical: 5, paddingHorizontal: 2, borderTop: `1.5pt solid ${BLUE_DARK}` },

    /* Bottom summary — matching report card style */
    bottomRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },

    summaryCard: {
        flex: 1,
        backgroundColor: BLUE_LIGHT,
        borderRadius: 6,
        padding: 8,
        borderLeft: `3pt solid ${BLUE_ACCENT}`,
    },
    summaryCardTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLUE_DARK, marginBottom: 6, textTransform: 'uppercase' },
    summaryCardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    summaryCardLabel: { fontSize: 7, color: GRAY_700 },
    summaryCardValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLUE_DARK },

    gradeDistCard: {
        flex: 1,
        backgroundColor: BLUE_LIGHT,
        borderRadius: 6,
        padding: 8,
        borderLeft: `3pt solid ${GREEN}`,
    },
    gradeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    gradeLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
    gradeCount: { fontSize: 7, color: GRAY_700 },

    /* Footer — matching report card */
    footer: {
        textAlign: 'center',
        fontSize: 7,
        color: GRAY_400,
        borderTop: `1pt solid ${GRAY_200}`,
        paddingTop: 6,
        marginTop: 'auto',
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
                <View style={{ flex: 1 }}>

                    {/* ═══ HEADER BAND (matching report card) ═══ */}
                    <View style={s.headerBand}>
                        <View>
                            {data.schoolLogoUrl ? (
                                <Image style={s.logo} src={data.schoolLogoUrl} />
                            ) : (
                                <View style={s.logoPlaceholder} />
                            )}
                        </View>
                        <View style={s.headerCenter}>
                            <Text style={s.schoolName}>{data.schoolName}</Text>
                        </View>
                        <View style={{ width: 52 }} />
                    </View>

                    {/* ═══ BANNER RIBBON (matching report card) ═══ */}
                    <View style={s.bannerRibbon}>
                        <Text style={s.bannerText}>
                            {data.examTitle} — Class Broad Sheet
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
                            <Text style={s.summaryVal}>{data.meanPercentage.toFixed(1)}%</Text>
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
                                <View key={subj} style={{ width: colSubjWidth, textAlign: 'center', paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' }}>
                                    <Text style={[s.thText, { textAlign: 'center' }]}>{subj.length > 6 ? subj.substring(0, 5) + '.' : subj}</Text>
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
                                        const val = student.marks[subj];
                                        return (
                                            <View key={subj} style={{ width: colSubjWidth, textAlign: 'center', borderRight: `0.5pt solid ${GRAY_200}`, paddingVertical: 3, paddingHorizontal: 1, justifyContent: 'center' }}>
                                                <Text style={[s.tdText, { textAlign: 'center', color: scoreColor(val) }]}>
                                                    {val !== null && val !== undefined ? val : '-'}
                                                </Text>
                                            </View>
                                        );
                                    })}

                                    <View style={[s.colSummary, { borderRight: `0.5pt solid ${GRAY_200}` }]}>
                                        <Text style={[s.tdTextBold, { color: scoreColor(student.overallPercentage) }]}>
                                            {student.overallPercentage.toFixed(1)}
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
                            <Text style={s.summaryCardTitle}>Class Performance Summary</Text>
                            <View style={s.summaryCardRow}>
                                <Text style={s.summaryCardLabel}>Total Students</Text>
                                <Text style={s.summaryCardValue}>{data.students.length}</Text>
                            </View>
                            <View style={s.summaryCardRow}>
                                <Text style={s.summaryCardLabel}>Mean Percentage</Text>
                                <Text style={s.summaryCardValue}>{data.meanPercentage.toFixed(2)}%</Text>
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
                                {Object.entries(data.gradeDistribution)
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([grade, count]) => (
                                        <View key={grade} style={s.gradeRow}>
                                            <Text style={[s.gradeLabel, { color: gradeColor(grade) }]}>{grade}</Text>
                                            <Text style={s.gradeCount}>
                                                {count} student{count !== 1 ? 's' : ''} ({((count / data.students.length) * 100).toFixed(0)}%)
                                            </Text>
                                        </View>
                                    ))}
                            </View>
                        )}
                    </View>

                </View>

                {/* ═══ FOOTER (matching report card) ═══ */}
                <View style={s.footer}>
                    <Text style={s.footerLine}>Report generated on {today}</Text>
                    <Text>Generated by Matokeo • Class Broad Sheet • {data.academicYear}</Text>
                </View>
            </Page>
        </Document>
    );
}

export async function generateMarkSheetPDF(data: MarkSheetData): Promise<Buffer> {
    const buffer = await renderToBuffer(<MarkSheetDocument data={data} />);
    return Buffer.from(buffer);
}
