import React from 'react';
import { Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { generateShortFeedback, generateClassTeacherComment } from './pdfHelpers';
import type { ReportCardData } from '../pdfGenerator';

/* ── Progress palette (teal banner on warm cream) ─────────── */
const TEAL_900 = '#14524F';
const TEAL_700 = '#1F6E6B';
const TEAL_500 = '#3A8E8A';
const TEAL_300 = '#6FAFAB';
const BRONZE = '#A67C52';
const BROWN = '#8A5A3B';
const CREAM = '#F7F2E9';
const CELL = '#F1E9DC';
const CELL_ALT = '#F8F3EA';
const LINE = '#D8CCBA';
const INK = '#2B2620';
const MUTED = '#6E6152';
const WHITE = '#FFFFFF';

/** Grade pill colors stay in the template's teal/bronze family. */
function pillColor(pct: number): string {
    if (pct >= 80) return TEAL_900;
    if (pct >= 70) return TEAL_700;
    if (pct >= 60) return TEAL_500;
    if (pct >= 50) return TEAL_300;
    if (pct >= 40) return BRONZE;
    return BROWN;
}

const CATEGORY_BAR_COLORS = [TEAL_900, TEAL_700, TEAL_500, TEAL_300];

const p = StyleSheet.create({
    sheet: { flex: 1, backgroundColor: CREAM },

    /* Header banner */
    header: {
        backgroundColor: TEAL_700, paddingVertical: 20, paddingHorizontal: 26,
        flexDirection: 'row', alignItems: 'center', gap: 16,
    },
    crest: { width: 54, height: 54, borderRadius: 27, backgroundColor: WHITE, objectFit: 'contain', border: `2pt solid ${CREAM}` },
    crestPlaceholder: {
        width: 54, height: 54, borderRadius: 27, backgroundColor: TEAL_900,
        border: `2pt solid ${CREAM}`, alignItems: 'center', justifyContent: 'center',
    },
    crestInitial: { fontSize: 22, color: CREAM, fontFamily: 'Times-Bold' },
    headerText: { flex: 1 },
    schoolName: { fontSize: 19, fontFamily: 'Times-Bold', color: CREAM, letterSpacing: 1.2, textTransform: 'uppercase' },
    headerSub: { fontSize: 10, color: '#BFDAD8', marginTop: 4 },
    qr: { width: 44, height: 44, borderRadius: 4, backgroundColor: WHITE, padding: 2 },

    body: { paddingHorizontal: 26, paddingTop: 14 },

    /* Student info grid */
    infoGrid: { border: `1pt solid ${LINE}`, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
    infoRow: { flexDirection: 'row', borderBottom: `1pt solid ${LINE}` },
    infoRowLast: { flexDirection: 'row' },
    infoCell: { flex: 1, backgroundColor: CELL_ALT, paddingVertical: 6, paddingHorizontal: 10, borderRight: `1pt solid ${LINE}` },
    infoCellLast: { flex: 1, backgroundColor: CELL_ALT, paddingVertical: 6, paddingHorizontal: 10 },
    infoLabel: { fontSize: 6.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 1.5, fontFamily: 'Helvetica-Bold' },
    infoValue: { fontSize: 9.5, color: INK, fontFamily: 'Helvetica-Bold' },

    /* Subjects table */
    table: { border: `1pt solid ${LINE}`, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
    thRow: { flexDirection: 'row', backgroundColor: CELL, borderBottom: `1pt solid ${LINE}` },
    th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: INK, paddingVertical: 6, paddingHorizontal: 6 },
    tr: { flexDirection: 'row', borderBottom: `0.5pt solid ${LINE}`, alignItems: 'center' },
    trAlt: { flexDirection: 'row', borderBottom: `0.5pt solid ${LINE}`, alignItems: 'center', backgroundColor: CELL_ALT },
    td: { fontSize: 8.5, color: INK, paddingVertical: 5, paddingHorizontal: 6 },
    tdBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, paddingVertical: 5, paddingHorizontal: 6 },
    tdMuted: { fontSize: 7.5, color: MUTED, paddingVertical: 5, paddingHorizontal: 6 },
    pill: { borderRadius: 9, paddingVertical: 2, paddingHorizontal: 8, alignSelf: 'center' },
    pillText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WHITE },

    /* Chart + stats row */
    midRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    panel: { flex: 1, border: `1pt solid ${LINE}`, borderRadius: 6, backgroundColor: CELL_ALT, padding: 10 },
    panelTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 },
    chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    chartLabel: { width: 62, fontSize: 7.5, color: INK, paddingRight: 4, textAlign: 'right' },
    chartTrack: { flex: 1, height: 9, backgroundColor: CELL, borderRadius: 2 },
    chartAxis: { flexDirection: 'row', marginTop: 3, marginLeft: 66 },
    chartTick: { flex: 1, fontSize: 6, color: MUTED },
    statsPanel: { flex: 1, border: `1pt solid ${LINE}`, borderRadius: 6, backgroundColor: CELL_ALT, flexDirection: 'row', alignItems: 'center' },
    statCell: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    statDivider: { width: 1, height: 34, backgroundColor: LINE },
    statValue: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: INK },
    statLabel: { fontSize: 7, color: MUTED, marginTop: 3 },

    /* Comment + signatures */
    commentBox: { border: `1pt solid ${LINE}`, borderRadius: 6, backgroundColor: CELL_ALT, padding: 12, marginBottom: 10 },
    commentTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 4 },
    commentText: { fontSize: 9, color: INK, fontFamily: 'Times-Italic', lineHeight: 1.5 },
    sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
    sigBlock: { width: '42%' },
    sigLine: { borderBottom: `1pt solid ${MUTED}`, height: 14, marginBottom: 3 },
    sigLabel: { fontSize: 7.5, color: INK },

    footer: { marginTop: 'auto', paddingVertical: 10, paddingHorizontal: 26, alignItems: 'center' },
    footerText: { fontSize: 7.5, color: MUTED, fontFamily: 'Times-Italic', textAlign: 'center' },
});

export function ReportCardLayoutProgress({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    const isKCSE = data.gradingSystemType === 'KCSE';
    const overallGrade = data.overallPointsGrade || data.overallGrade;
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    // Paper columns: as many as the widest subject uses (0 = single-score school)
    const paperCount = Math.min(4, Math.max(0, ...data.subjectMarks.map(sm => sm.paperScores?.length ?? 0)));

    // Category averages for the chart (table display order, max 4)
    const catAgg = new Map<string, { sum: number; n: number }>();
    for (const sm of data.subjectMarks) {
        const cat = sm.category || 'OTHER';
        const agg = catAgg.get(cat) || { sum: 0, n: 0 };
        agg.sum += sm.percentage || 0;
        agg.n += 1;
        catAgg.set(cat, agg);
    }
    const categories = [...catAgg.entries()].slice(0, 4).map(([name, { sum, n }]) => ({
        name: name.charAt(0) + name.slice(1).toLowerCase(),
        avg: n > 0 ? sum / n : 0,
    }));

    const totalScore = data.totalScore ?? data.subjectMarks.reduce((s, m) => s + (m.score || 0), 0);
    const statPoints = isKCSE && data.totalPoints !== undefined
        ? { value: String(data.totalPoints), label: 'Total Points' }
        : { value: String(totalScore), label: 'Total Marks' };

    // Column widths: subject + papers + final + grade + remark = 100%
    const paperW = paperCount > 0 ? 9 : 0;
    const subjectW = 24;
    const finalW = 10;
    const gradeW = 10;
    const remarkW = 100 - subjectW - finalW - gradeW - paperCount * paperW - (paperCount === 0 ? 12 : 0);

    return (
        <View style={p.sheet}>
            {/* Header banner */}
            <View style={p.header}>
                {data.schoolLogoUrl ? (
                    <Image style={p.crest} src={data.schoolLogoUrl} />
                ) : (
                    <View style={p.crestPlaceholder}><Text style={p.crestInitial}>{data.schoolName.charAt(0)}</Text></View>
                )}
                <View style={p.headerText}>
                    <Text style={p.schoolName}>{data.schoolName}</Text>
                    <Text style={p.headerSub}>Academic Progress Report — {data.examTitle}, {data.academicYear}</Text>
                </View>
                {qrCodeDataUri && <Image style={p.qr} src={qrCodeDataUri} />}
            </View>

            <View style={p.body}>
                {/* Student info grid */}
                <View style={p.infoGrid}>
                    <View style={p.infoRow}>
                        <View style={p.infoCellLast}>
                            <Text style={p.infoLabel}>Student Name</Text>
                            <Text style={p.infoValue}>{data.studentName}</Text>
                        </View>
                    </View>
                    <View style={p.infoRow}>
                        <View style={p.infoCell}><Text style={p.infoLabel}>Admission No</Text><Text style={p.infoValue}>{data.enrollmentNumber || '—'}</Text></View>
                        <View style={p.infoCell}><Text style={p.infoLabel}>Class</Text><Text style={p.infoValue}>{data.className}</Text></View>
                        <View style={p.infoCellLast}><Text style={p.infoLabel}>Academic Year</Text><Text style={p.infoValue}>{data.academicYear}</Text></View>
                    </View>
                    <View style={data.pathwayName ? p.infoRow : p.infoRowLast}>
                        <View style={p.infoCell}><Text style={p.infoLabel}>Exam / Report</Text><Text style={p.infoValue}>{data.examTitle}</Text></View>
                        <View style={p.infoCellLast}><Text style={p.infoLabel}>Date Issued</Text><Text style={p.infoValue}>{today}</Text></View>
                    </View>
                    {data.pathwayName && (
                        <View style={p.infoRowLast}>
                            <View style={p.infoCell}><Text style={p.infoLabel}>Pathway</Text><Text style={p.infoValue}>{data.pathwayName}{data.trackName ? ` — ${data.trackName}` : ''}</Text></View>
                            <View style={p.infoCellLast}><Text style={p.infoLabel}>Subject Combination</Text><Text style={p.infoValue}>{data.combinationCode ? `${data.combinationCode}${data.combinationName ? ` — ${data.combinationName}` : ''}` : '—'}</Text></View>
                        </View>
                    )}
                </View>

                {/* Subjects table */}
                <View style={p.table}>
                    <View style={p.thRow}>
                        <Text style={[p.th, { width: `${subjectW}%` }]}>Subject</Text>
                        {paperCount > 0
                            ? Array.from({ length: paperCount }, (_, i) => (
                                <Text key={i} style={[p.th, { width: `${paperW}%`, textAlign: 'center' }]}>Paper {i + 1}</Text>
                            ))
                            : <Text style={[p.th, { width: '12%', textAlign: 'center' }]}>Score</Text>}
                        <Text style={[p.th, { width: `${finalW}%`, textAlign: 'center' }]}>Final %</Text>
                        <Text style={[p.th, { width: `${gradeW}%`, textAlign: 'center' }]}>Grade</Text>
                        <Text style={[p.th, { width: `${remarkW}%` }]}>Teacher&apos;s Remark</Text>
                    </View>
                    {data.subjectMarks.map((sm, idx) => {
                        const pct = sm.percentage ?? 0;
                        return (
                            <View style={idx % 2 === 0 ? p.tr : p.trAlt} key={`${sm.subjectName}-${idx}`}>
                                <Text style={[p.tdBold, { width: `${subjectW}%` }]}>{sm.subjectName}</Text>
                                {paperCount > 0
                                    ? Array.from({ length: paperCount }, (_, i) => (
                                        <Text key={i} style={[p.td, { width: `${paperW}%`, textAlign: 'center' }]}>
                                            {sm.paperScores?.[i] != null ? sm.paperScores[i].score : '–'}
                                        </Text>
                                    ))
                                    : <Text style={[p.td, { width: '12%', textAlign: 'center' }]}>{sm.score}/{sm.totalPossible}</Text>}
                                <Text style={[p.tdBold, { width: `${finalW}%`, textAlign: 'center' }]}>{Math.round(pct)}</Text>
                                <View style={{ width: `${gradeW}%`, alignItems: 'center', paddingVertical: 3 }}>
                                    <View style={[p.pill, { backgroundColor: pillColor(pct) }]}>
                                        <Text style={p.pillText}>{sm.grade || '—'}</Text>
                                    </View>
                                </View>
                                <Text style={[p.tdMuted, { width: `${remarkW}%` }]}>{sm.teacherComment || generateShortFeedback(sm.percentage, sm.grade)}</Text>
                            </View>
                        );
                    })}
                </View>

                {/* Category chart + stats */}
                <View style={p.midRow}>
                    <View style={p.panel}>
                        <Text style={p.panelTitle}>Performance by Category (avg %)</Text>
                        {categories.map((c, i) => (
                            <View style={p.chartRow} key={c.name}>
                                <Text style={p.chartLabel}>{c.name}</Text>
                                <View style={p.chartTrack}>
                                    <View style={{
                                        height: 9, borderRadius: 2,
                                        width: `${Math.min(100, Math.max(2, c.avg))}%`,
                                        backgroundColor: CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length],
                                    }} />
                                </View>
                            </View>
                        ))}
                        {categories.length === 0 && <Text style={p.commentText}>No marks recorded yet.</Text>}
                        <View style={p.chartAxis}>
                            {[0, 20, 40, 60, 80, 100].map(t => <Text key={t} style={p.chartTick}>{t}</Text>)}
                        </View>
                    </View>
                    <View style={p.statsPanel}>
                        <View style={p.statCell}>
                            <Text style={p.statValue}>{statPoints.value}</Text>
                            <Text style={p.statLabel}>{statPoints.label}</Text>
                        </View>
                        <View style={p.statDivider} />
                        <View style={p.statCell}>
                            <Text style={p.statValue}>{overallGrade || `${Math.round(data.overallPercentage)}%`}</Text>
                            <Text style={p.statLabel}>Mean Grade</Text>
                        </View>
                        <View style={p.statDivider} />
                        <View style={p.statCell}>
                            <Text style={p.statValue}>{data.classRank > 0 ? data.classRank : '—'}</Text>
                            <Text style={p.statLabel}>Class Rank{data.totalStudents ? ` of ${data.totalStudents}` : ''}</Text>
                        </View>
                        {data.combinationRank !== undefined && (
                            <>
                                <View style={p.statDivider} />
                                <View style={p.statCell}>
                                    <Text style={p.statValue}>{data.combinationRank}</Text>
                                    <Text style={p.statLabel}>Pathway Rank{data.combinationSize ? ` of ${data.combinationSize}` : ''}</Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* Comment + signatures */}
                <View style={p.commentBox}>
                    <Text style={p.commentTitle}>Teacher&apos;s Comment</Text>
                    <Text style={p.commentText}>
                        {data.classTeacherComment || generateClassTeacherComment(data.overallPercentage, data.overallGrade, data.totalPoints)}
                    </Text>
                    {data.principalComment ? (
                        <Text style={[p.commentText, { marginTop: 4 }]}>Principal: {data.principalComment}</Text>
                    ) : null}
                    <View style={p.sigRow}>
                        <View style={p.sigBlock}><View style={p.sigLine} /><Text style={p.sigLabel}>Class teacher signature</Text></View>
                        <View style={p.sigBlock}><View style={p.sigLine} /><Text style={p.sigLabel}>Principal signature</Text></View>
                    </View>
                </View>
            </View>

            {/* Footer */}
            <View style={p.footer}>
                <Text style={p.footerText}>
                    {data.schoolAddress ? `${data.schoolAddress}  •  ` : ''}Generated {today}{data.openingDate ? `  •  Next term begins ${data.openingDate}` : ''}
                </Text>
            </View>
        </View>
    );
}
