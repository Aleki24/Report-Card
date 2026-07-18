import React from 'react';
import { Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { gradeColor, generateShortFeedback, generateClassTeacherComment, generatePrincipalComment, barColor } from './pdfHelpers';
import type { ReportCardData } from '../pdfGenerator';

/* ── Modern palette ─────────────────────────────────────── */
const INDIGO = '#4F46E5';
const INDIGO_DARK = '#3730A3';
const INDIGO_TINT = '#EEF2FF';
const SLATE_900 = '#0F172A';
const SLATE_600 = '#475569';
const SLATE_400 = '#94A3B8';
const SLATE_200 = '#E2E8F0';
const SLATE_50 = '#F8FAFC';
const WHITE = '#FFFFFF';

const m = StyleSheet.create({
    /* Header — full-width indigo block */
    header: {
        backgroundColor: INDIGO, paddingVertical: 18, paddingHorizontal: 28,
        flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    logoFrame: { width: 52, height: 52, borderRadius: 10, backgroundColor: WHITE, padding: 4, alignItems: 'center' as const, justifyContent: 'center' as const },
    logo: { width: 44, height: 44, objectFit: 'contain' },
    logoPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: INDIGO_DARK, alignItems: 'center', justifyContent: 'center' },
    logoInitial: { fontSize: 22, color: WHITE, fontFamily: 'Helvetica-Bold' },
    headerText: { flex: 1 },
    schoolName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: 0.5 },
    schoolAddress: { fontSize: 8, color: '#C7D2FE', marginTop: 2 },
    reportTag: { fontSize: 7, color: '#C7D2FE', textTransform: 'uppercase', letterSpacing: 2, marginTop: 5 },
    qr: { width: 48, height: 48, borderRadius: 6, backgroundColor: WHITE, padding: 3 },

    /* Student ribbon */
    studentRibbon: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: INDIGO_TINT, paddingVertical: 10, paddingHorizontal: 28, marginBottom: 14,
    },
    studentName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    studentMeta: { fontSize: 8, color: SLATE_600, marginTop: 2 },
    examChip: { backgroundColor: INDIGO, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 12 },
    examChipText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: WHITE },

    /* Stat tiles */
    statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 28, marginBottom: 14 },
    statTile: { flex: 1, borderRadius: 8, backgroundColor: SLATE_50, border: `1pt solid ${SLATE_200}`, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
    statTileAccent: { flex: 1, borderRadius: 8, backgroundColor: INDIGO, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
    statLabel: { fontSize: 6.5, color: SLATE_400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, fontFamily: 'Helvetica-Bold' },
    statLabelOnAccent: { fontSize: 6.5, color: '#C7D2FE', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, fontFamily: 'Helvetica-Bold' },
    statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    statValueOnAccent: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: WHITE },

    /* Table */
    table: { marginHorizontal: 28, marginBottom: 12 },
    thRow: { flexDirection: 'row', borderBottom: `2pt solid ${INDIGO}`, paddingBottom: 5, paddingHorizontal: 4 },
    th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: INDIGO_DARK, textTransform: 'uppercase', letterSpacing: 0.6 },
    tr: { flexDirection: 'row', borderBottom: `0.5pt solid ${SLATE_200}`, paddingVertical: 5.5, paddingHorizontal: 4, alignItems: 'center' },
    td: { fontSize: 8.5, color: SLATE_900 },
    tdMuted: { fontSize: 7.5, color: SLATE_600 },
    tdBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    gradePill: { borderRadius: 8, paddingVertical: 1.5, paddingHorizontal: 6, alignSelf: 'center' },
    gradePillText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WHITE },
    scoreBarTrack: { height: 3, backgroundColor: SLATE_200, borderRadius: 2, marginTop: 2.5, width: '90%' },
    totalRow: { flexDirection: 'row', backgroundColor: INDIGO_TINT, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 4, marginTop: 4, alignItems: 'center' },

    /* Columns (CBC) */
    cNo: { width: '5%', textAlign: 'center' },
    cSubject: { width: '25%' },
    cScore: { width: '17%' },
    cGrade: { width: '11%', textAlign: 'center' },
    cPoints: { width: '9%', textAlign: 'center' },
    cRank: { width: '9%', textAlign: 'center' },
    cComment: { width: '24%' },

    /* Comments */
    commentsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 28, marginBottom: 12 },
    commentCard: { flex: 1, borderRadius: 8, border: `1pt solid ${SLATE_200}`, padding: 10, backgroundColor: WHITE },
    commentHead: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: INDIGO_DARK, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
    commentBody: { fontSize: 8.5, color: SLATE_600, lineHeight: 1.5 },

    /* Signatures + footer */
    sigRow: { flexDirection: 'row', gap: 24, paddingHorizontal: 28, marginTop: 4, marginBottom: 8 },
    sigBlock: { flex: 1 },
    sigLine: { borderBottom: `1pt solid ${SLATE_400}`, height: 20, marginBottom: 3 },
    sigLabel: { fontSize: 7, color: SLATE_600 },
    footer: { marginTop: 'auto', backgroundColor: SLATE_50, borderTop: `1pt solid ${SLATE_200}`, paddingVertical: 8, paddingHorizontal: 28, flexDirection: 'row', justifyContent: 'space-between' },
    footerText: { fontSize: 6.5, color: SLATE_400 },
});

export function ReportCardLayoutModern({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    const isKCSE = data.gradingSystemType === 'KCSE';
    const totalScore = data.totalScore ?? data.subjectMarks.reduce((sum, mk) => sum + (mk.score || 0), 0);
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const overallGrade = data.overallPointsGrade || data.overallGrade;

    return (
        <>
            {/* Header */}
            <View style={m.header}>
                {data.schoolLogoUrl ? (
                    <View style={m.logoFrame}><Image style={m.logo} src={data.schoolLogoUrl} /></View>
                ) : (
                    <View style={m.logoPlaceholder}><Text style={m.logoInitial}>{data.schoolName.charAt(0)}</Text></View>
                )}
                <View style={m.headerText}>
                    <Text style={m.schoolName}>{data.schoolName}</Text>
                    {data.schoolAddress && <Text style={m.schoolAddress}>{data.schoolAddress}</Text>}
                    <Text style={m.reportTag}>{isKCSE ? 'Academic Report' : 'Assessment Report'} • {data.academicYear}</Text>
                </View>
                {qrCodeDataUri && <Image style={m.qr} src={qrCodeDataUri} />}
            </View>

            {/* Student ribbon */}
            <View style={m.studentRibbon}>
                <View>
                    <Text style={m.studentName}>{data.studentName}</Text>
                    <Text style={m.studentMeta}>{data.className}{data.enrollmentNumber ? `  •  Adm No ${data.enrollmentNumber}` : ''}</Text>
                    {data.pathwayName && (
                        <Text style={m.studentMeta}>{data.pathwayName}{data.trackName ? ` — ${data.trackName}` : ''}{data.combinationCode ? `  •  ${data.combinationCode}` : ''}</Text>
                    )}
                </View>
                <View style={m.examChip}><Text style={m.examChipText}>{data.examTitle}</Text></View>
            </View>

            {/* Stat tiles */}
            <View style={m.statRow}>
                <View style={m.statTileAccent}>
                    <Text style={m.statLabelOnAccent}>Average</Text>
                    <Text style={m.statValueOnAccent}>{Math.round(data.overallPercentage)}%</Text>
                </View>
                <View style={m.statTile}>
                    <Text style={m.statLabel}>Grade</Text>
                    <Text style={[m.statValue, { color: gradeColor(overallGrade) }]}>{overallGrade || '—'}</Text>
                </View>
                {data.combinationRank !== undefined && (
                    <View style={m.statTile}>
                        <Text style={m.statLabel}>Pathway Rank</Text>
                        <Text style={m.statValue}>{`${data.combinationRank}/${data.combinationSize}`}</Text>
                    </View>
                )}
                <View style={m.statTile}>
                    <Text style={m.statLabel}>Class Rank</Text>
                    <Text style={m.statValue}>{data.classRank > 0 ? `${data.classRank}/${data.totalStudents}` : '—'}</Text>
                </View>
                <View style={m.statTile}>
                    <Text style={m.statLabel}>{isKCSE && data.totalPoints !== undefined ? 'Points' : 'Total Marks'}</Text>
                    <Text style={m.statValue}>{isKCSE && data.totalPoints !== undefined ? data.totalPoints : totalScore}</Text>
                </View>
            </View>

            {/* Subject table */}
            <View style={m.table}>
                <View style={m.thRow}>
                    <Text style={[m.th, m.cNo]}>#</Text>
                    <Text style={[m.th, m.cSubject]}>{isKCSE ? 'Subject' : 'Learning Area'}</Text>
                    <Text style={[m.th, m.cScore]}>Score</Text>
                    <Text style={[m.th, m.cGrade]}>Grade</Text>
                    <Text style={[m.th, m.cPoints]}>Pts</Text>
                    <Text style={[m.th, m.cRank]}>Rank</Text>
                    <Text style={[m.th, m.cComment]}>Remarks</Text>
                </View>
                {data.subjectMarks.map((sm, idx) => {
                    const pct = sm.percentage ?? 0;
                    const rankText = sm.subjectRank && sm.totalStudents ? `${sm.subjectRank}/${sm.totalStudents}` : '—';
                    return (
                        <View style={m.tr} key={`${sm.subjectName}-${idx}`}>
                            <Text style={[m.td, m.cNo]}>{idx + 1}</Text>
                            <Text style={[m.tdBold, m.cSubject]}>{sm.subjectName}</Text>
                            <View style={m.cScore}>
                                <Text style={m.td}>{sm.percentage != null ? `${sm.percentage}%` : '—'}</Text>
                                <View style={m.scoreBarTrack}>
                                    <View style={{ height: 3, width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: barColor(pct), borderRadius: 2 }} />
                                </View>
                            </View>
                            <View style={m.cGrade}>
                                <View style={[m.gradePill, { backgroundColor: gradeColor(sm.grade) }]}>
                                    <Text style={m.gradePillText}>{sm.grade || '—'}</Text>
                                </View>
                            </View>
                            <Text style={[m.td, m.cPoints]}>{sm.points ?? '—'}</Text>
                            <Text style={[m.td, m.cRank]}>{rankText}</Text>
                            <Text style={[m.tdMuted, m.cComment]}>{sm.teacherComment || generateShortFeedback(sm.percentage, sm.grade)}</Text>
                        </View>
                    );
                })}
                <View style={m.totalRow}>
                    <Text style={[m.tdBold, m.cNo]}></Text>
                    <Text style={[m.tdBold, m.cSubject, { color: INDIGO_DARK }]}>OVERALL</Text>
                    <Text style={[m.tdBold, m.cScore, { color: INDIGO_DARK }]}>{Math.round(data.overallPercentage)}%</Text>
                    <Text style={[m.tdBold, m.cGrade, { color: gradeColor(overallGrade) }]}>{overallGrade || '—'}</Text>
                    <Text style={[m.tdBold, m.cPoints, { color: INDIGO_DARK }]}>{data.totalPoints ?? '—'}</Text>
                    <Text style={[m.tdBold, m.cRank, { color: INDIGO_DARK }]}>{data.classRank > 0 ? `${data.classRank}` : '—'}</Text>
                    <Text style={[m.tdBold, m.cComment]}></Text>
                </View>
            </View>

            {/* Comments */}
            <View style={m.commentsRow}>
                <View style={m.commentCard}>
                    <Text style={m.commentHead}>Class Teacher</Text>
                    <Text style={m.commentBody}>{data.classTeacherComment || generateClassTeacherComment(data.overallPercentage, data.overallGrade, data.totalPoints)}</Text>
                </View>
                <View style={m.commentCard}>
                    <Text style={m.commentHead}>Principal</Text>
                    <Text style={m.commentBody}>{data.principalComment || generatePrincipalComment(data.overallPercentage, data.overallGrade, data.totalPoints)}</Text>
                </View>
            </View>

            {/* Signatures */}
            <View style={m.sigRow}>
                <View style={m.sigBlock}><View style={m.sigLine} /><Text style={m.sigLabel}>Parent / Guardian Signature</Text></View>
                <View style={m.sigBlock}><View style={m.sigLine} /><Text style={m.sigLabel}>Class Teacher Signature</Text></View>
                <View style={m.sigBlock}><View style={m.sigLine} /><Text style={m.sigLabel}>Date</Text></View>
            </View>

            {/* Footer */}
            <View style={m.footer}>
                <Text style={m.footerText}>Generated {today}{data.openingDate ? `  •  Next term begins ${data.openingDate}` : ''}</Text>
                <Text style={m.footerText}>Skulbase — electronically generated document</Text>
            </View>
        </>
    );
}
