import React from 'react';
import { Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { generateShortFeedback, generateClassTeacherComment, generatePrincipalComment } from './pdfHelpers';
import type { ReportCardData } from '../pdfGenerator';

/* ── Minimal palette: monochrome, ink-friendly ──────────── */
const INK = '#111111';
const GRAY = '#555555';
const LIGHT = '#999999';
const RULE = '#CCCCCC';
const WHITE = '#FFFFFF';

const t = StyleSheet.create({
    wrap: { paddingHorizontal: 40, paddingTop: 28 },

    /* Letterhead */
    letterhead: { alignItems: 'center', marginBottom: 6 },
    logo: { width: 44, height: 44, borderRadius: 22, objectFit: 'contain', marginBottom: 6 },
    schoolName: { fontSize: 17, fontFamily: 'Times-Bold', color: INK, textAlign: 'center', letterSpacing: 1 },
    schoolAddress: { fontSize: 8, fontFamily: 'Times-Roman', color: GRAY, marginTop: 3, textAlign: 'center' },
    docTitle: { fontSize: 9, fontFamily: 'Times-Roman', color: INK, textTransform: 'uppercase', letterSpacing: 3, marginTop: 8, textAlign: 'center' },
    doubleRule: { borderBottom: `2pt solid ${INK}`, marginTop: 8 },
    thinRule: { borderBottom: `0.5pt solid ${INK}`, marginTop: 1.5, marginBottom: 12 },

    /* Student details — two columns of label/value lines */
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
    detailCol: { width: '48%' },
    detailLine: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-end' },
    detailLabel: { fontSize: 8, fontFamily: 'Times-Bold', color: INK, width: 78, textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 9.5, fontFamily: 'Times-Roman', color: INK, flex: 1, borderBottom: `0.5pt dotted ${LIGHT}`, paddingBottom: 1 },

    /* Table */
    thRow: { flexDirection: 'row', borderTop: `1pt solid ${INK}`, borderBottom: `1pt solid ${INK}`, paddingVertical: 5, marginBottom: 2 },
    th: { fontSize: 7.5, fontFamily: 'Times-Bold', color: INK, textTransform: 'uppercase', letterSpacing: 0.8 },
    tr: { flexDirection: 'row', paddingVertical: 4.5, borderBottom: `0.5pt solid ${RULE}` },
    td: { fontSize: 9, fontFamily: 'Times-Roman', color: INK },
    tdItalic: { fontSize: 8, fontFamily: 'Times-Italic', color: GRAY },
    tdBold: { fontSize: 9, fontFamily: 'Times-Bold', color: INK },
    totalRow: { flexDirection: 'row', paddingVertical: 6, borderTop: `1pt solid ${INK}`, borderBottom: `2pt solid ${INK}` },

    cNo: { width: '6%' },
    cSubject: { width: '26%' },
    cScore: { width: '12%', textAlign: 'center' },
    cGrade: { width: '10%', textAlign: 'center' },
    cPoints: { width: '9%', textAlign: 'center' },
    cRank: { width: '10%', textAlign: 'center' },
    cComment: { width: '27%' },

    /* Summary line */
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 },
    summaryItem: { alignItems: 'center', flex: 1 },
    summaryLabel: { fontSize: 7, fontFamily: 'Times-Roman', color: GRAY, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
    summaryValue: { fontSize: 13, fontFamily: 'Times-Bold', color: INK },

    /* Comments */
    commentBlock: { marginBottom: 10 },
    commentLabel: { fontSize: 8, fontFamily: 'Times-Bold', color: INK, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
    commentText: { fontSize: 9, fontFamily: 'Times-Italic', color: GRAY, lineHeight: 1.55, borderLeft: `1.5pt solid ${INK}`, paddingLeft: 8 },

    /* Grading key */
    keyLine: { fontSize: 7, fontFamily: 'Times-Roman', color: LIGHT, marginBottom: 12, textAlign: 'center' },

    /* Signatures */
    sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
    sigBlock: { width: '30%', alignItems: 'center' },
    sigLine: { borderBottom: `0.75pt solid ${INK}`, height: 22, width: '100%', marginBottom: 3 },
    sigLabel: { fontSize: 7.5, fontFamily: 'Times-Roman', color: GRAY },

    /* Footer */
    footer: { marginTop: 'auto', alignItems: 'center', paddingVertical: 10, borderTop: `0.5pt solid ${RULE}`, marginHorizontal: 40 },
    footerText: { fontSize: 6.5, fontFamily: 'Times-Roman', color: LIGHT, marginBottom: 1.5 },
    qr: { width: 40, height: 40, marginBottom: 4 },
});

export function ReportCardLayoutMinimal({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    const isKCSE = data.gradingSystemType === 'KCSE';
    const totalScore = data.totalScore ?? data.subjectMarks.reduce((sum, mk) => sum + (mk.score || 0), 0);
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const overallGrade = data.overallPointsGrade || data.overallGrade;
    const boundaries = (data.gradeBoundaries || []).slice(0, 8);

    return (
        <>
            <View style={t.wrap}>
                {/* Letterhead */}
                <View style={t.letterhead}>
                    {data.schoolLogoUrl && <Image style={t.logo} src={data.schoolLogoUrl} />}
                    <Text style={t.schoolName}>{data.schoolName.toUpperCase()}</Text>
                    {data.schoolAddress && <Text style={t.schoolAddress}>{data.schoolAddress}</Text>}
                    <Text style={t.docTitle}>{isKCSE ? 'Learner Academic Report' : 'Learner Assessment Report'}</Text>
                </View>
                <View style={t.doubleRule} />
                <View style={t.thinRule} />

                {/* Student details */}
                <View style={t.detailsRow}>
                    <View style={t.detailCol}>
                        <View style={t.detailLine}><Text style={t.detailLabel}>Name</Text><Text style={t.detailValue}>{data.studentName}</Text></View>
                        <View style={t.detailLine}><Text style={t.detailLabel}>Class</Text><Text style={t.detailValue}>{data.className}</Text></View>
                        <View style={t.detailLine}><Text style={t.detailLabel}>Adm No</Text><Text style={t.detailValue}>{data.enrollmentNumber || '—'}</Text></View>
                    </View>
                    <View style={t.detailCol}>
                        <View style={t.detailLine}><Text style={t.detailLabel}>Examination</Text><Text style={t.detailValue}>{data.examTitle}</Text></View>
                        <View style={t.detailLine}><Text style={t.detailLabel}>Year</Text><Text style={t.detailValue}>{data.academicYear}</Text></View>
                        <View style={t.detailLine}><Text style={t.detailLabel}>Class Rank</Text><Text style={t.detailValue}>{data.classRank > 0 ? `${data.classRank} of ${data.totalStudents}` : '—'}</Text></View>
                    </View>
                </View>

                {/* Subject table */}
                <View style={t.thRow}>
                    <Text style={[t.th, t.cNo]}>No.</Text>
                    <Text style={[t.th, t.cSubject]}>{isKCSE ? 'Subject' : 'Learning Area'}</Text>
                    <Text style={[t.th, t.cScore]}>Score</Text>
                    <Text style={[t.th, t.cGrade]}>Grade</Text>
                    <Text style={[t.th, t.cPoints]}>Pts</Text>
                    <Text style={[t.th, t.cRank]}>Rank</Text>
                    <Text style={[t.th, t.cComment]}>Remarks</Text>
                </View>
                {data.subjectMarks.map((sm, idx) => {
                    const rankText = sm.subjectRank && sm.totalStudents ? `${sm.subjectRank}/${sm.totalStudents}` : '—';
                    return (
                        <View style={t.tr} key={`${sm.subjectName}-${idx}`}>
                            <Text style={[t.td, t.cNo]}>{idx + 1}.</Text>
                            <Text style={[t.td, t.cSubject]}>{sm.subjectName}</Text>
                            <Text style={[t.td, t.cScore]}>{sm.percentage != null ? `${sm.percentage}%` : '—'}</Text>
                            <Text style={[t.tdBold, t.cGrade]}>{sm.grade || '—'}</Text>
                            <Text style={[t.td, t.cPoints]}>{sm.points ?? '—'}</Text>
                            <Text style={[t.td, t.cRank]}>{rankText}</Text>
                            <Text style={[t.tdItalic, t.cComment]}>{sm.teacherComment || generateShortFeedback(sm.percentage, sm.grade)}</Text>
                        </View>
                    );
                })}
                <View style={t.totalRow}>
                    <Text style={[t.tdBold, t.cNo]}></Text>
                    <Text style={[t.tdBold, t.cSubject]}>TOTAL</Text>
                    <Text style={[t.tdBold, t.cScore]}>{Math.round(data.overallPercentage)}%</Text>
                    <Text style={[t.tdBold, t.cGrade]}>{overallGrade || '—'}</Text>
                    <Text style={[t.tdBold, t.cPoints]}>{data.totalPoints ?? '—'}</Text>
                    <Text style={[t.tdBold, t.cRank]}>{data.classRank > 0 ? `${data.classRank}` : '—'}</Text>
                    <Text style={[t.tdBold, t.cComment]}></Text>
                </View>

                {/* Summary line */}
                <View style={t.summaryRow}>
                    <View style={t.summaryItem}><Text style={t.summaryLabel}>Average</Text><Text style={t.summaryValue}>{Math.round(data.overallPercentage)}%</Text></View>
                    <View style={t.summaryItem}><Text style={t.summaryLabel}>Overall Grade</Text><Text style={t.summaryValue}>{overallGrade || '—'}</Text></View>
                    <View style={t.summaryItem}><Text style={t.summaryLabel}>Total Marks</Text><Text style={t.summaryValue}>{totalScore}</Text></View>
                    {isKCSE && data.totalPoints !== undefined && (
                        <View style={t.summaryItem}><Text style={t.summaryLabel}>Points</Text><Text style={t.summaryValue}>{data.totalPoints}</Text></View>
                    )}
                </View>

                {/* Grading key */}
                {boundaries.length > 0 && (
                    <Text style={t.keyLine}>
                        Grading:  {boundaries.map(b => `${b.symbol} = ${b.min}–${b.max}`).join('   •   ')}
                    </Text>
                )}

                {/* Comments */}
                <View style={t.commentBlock}>
                    <Text style={t.commentLabel}>Class Teacher&apos;s Remarks</Text>
                    <Text style={t.commentText}>{data.classTeacherComment || generateClassTeacherComment(data.overallPercentage, data.overallGrade, data.totalPoints)}</Text>
                </View>
                <View style={t.commentBlock}>
                    <Text style={t.commentLabel}>Principal&apos;s Remarks</Text>
                    <Text style={t.commentText}>{data.principalComment || generatePrincipalComment(data.overallPercentage, data.overallGrade, data.totalPoints)}</Text>
                </View>

                {/* Signatures */}
                <View style={t.sigRow}>
                    <View style={t.sigBlock}><View style={t.sigLine} /><Text style={t.sigLabel}>Class Teacher</Text></View>
                    <View style={t.sigBlock}><View style={t.sigLine} /><Text style={t.sigLabel}>Principal</Text></View>
                    <View style={t.sigBlock}><View style={t.sigLine} /><Text style={t.sigLabel}>Parent / Guardian</Text></View>
                </View>
            </View>

            {/* Footer */}
            <View style={t.footer}>
                {qrCodeDataUri && <Image style={t.qr} src={qrCodeDataUri} />}
                <Text style={t.footerText}>Report generated on {today}{data.openingDate ? ` — next term begins ${data.openingDate}` : ''}</Text>
                <Text style={t.footerText}>Matokeo · This document is electronically generated</Text>
            </View>
        </>
    );
}
