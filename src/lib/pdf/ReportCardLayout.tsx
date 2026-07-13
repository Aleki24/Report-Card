import React from 'react';
import { Text, View, Image } from '@react-pdf/renderer';
import { s, NAVY, ORANGE, WHITE, GRAY_400, GRAY_700 } from './pdfStyles';
import { gradeColor, generateShortFeedback, generateClassTeacherComment, generatePrincipalComment, barColor } from './pdfHelpers';
import type { ReportCardData } from '../pdfGenerator';

/**
 * Shared report card layout used by both ReportCardDocument (single) and ReportCardContent (bulk).
 * Renders everything between the navy bars: header, banner, info grid, table, badges, comments, signatures, footer.
 */
export function ReportCardLayout({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    const isKCSE = data.gradingSystemType === 'KCSE';
    const totalScore = data.totalScore ?? data.subjectMarks.reduce((sum, m) => sum + (m.score || 0), 0);
    // KCSE 8-4-4: only the best 7 subjects count toward the points total. When
    // a student takes more than 7, the surplus subjects are still listed (so
    // the learner sees the mark) but must be visibly flagged as not counted —
    // otherwise the printed points total looks wrong against the per-subject
    // points shown. Only flag when selection actually dropped something.
    const anyExcluded = isKCSE && data.subjectMarks.some(m => m.includedInPoints === false);
    const anyIncluded = data.subjectMarks.some(m => m.includedInPoints === true);
    const showExclusions = anyExcluded && anyIncluded;
    const includedCount = data.subjectMarks.filter(m => m.includedInPoints !== false).length;
    let rowCounter = 0;
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <>
            {/* Header Band */}
            <View style={s.headerBand}>
                <View>
                    {data.schoolLogoUrl ? (
                        <Image style={s.logo} src={data.schoolLogoUrl} />
                    ) : (
                        <View style={s.logoPlaceholder}><Text style={{ fontSize: 20, color: GRAY_400 }}>🏫</Text></View>
                    )}
                </View>
                <View style={s.headerCenter}>
                    <Text style={s.schoolName}>{data.schoolName}</Text>
                    {data.schoolAddress && <Text style={s.schoolAddress}>{data.schoolAddress}</Text>}
                </View>
                <View>
                    {qrCodeDataUri ? (
                        <Image style={{ width: 46, height: 52, borderRadius: 4, backgroundColor: WHITE, padding: 2 }} src={qrCodeDataUri} />
                    ) : (
                        <View style={s.photoPlaceholder}><Text style={s.photoSilhouette}>👤</Text></View>
                    )}
                </View>
            </View>

            {/* Banner Ribbon */}
            <View style={s.bannerRibbon}>
                <Text style={s.bannerText}>{isKCSE ? 'Learner Academic Report' : 'Learner Assessment Report'}</Text>
            </View>

            {/* Student Info Grid */}
            <View style={s.infoGrid}>
                <View style={s.infoItem}><Text style={s.infoLabel}>Name</Text><Text style={s.infoValue}>{data.studentName}</Text></View>
                <View style={[s.infoItem, { flex: 0.6 }]}><Text style={s.infoLabel}>Class</Text><Text style={s.infoValue}>{data.className}</Text></View>
                <View style={[s.infoItem, { flex: 0.6 }]}><Text style={s.infoLabel}>Adm No</Text><Text style={s.infoValue}>{data.enrollmentNumber || ''}</Text></View>
                <View style={[s.infoItem, { flex: 0.5 }]}><Text style={s.infoLabel}>Year</Text><Text style={s.infoValue}>{data.academicYear}</Text></View>
            </View>

            {/* Summary Strip */}
            <View style={s.summaryStrip}>
                <View style={s.summaryLeft}><Text style={s.summaryLabel}>Exam</Text><Text style={s.summaryVal}>{data.examTitle}</Text></View>
                <View style={s.summaryRight}>
                    <View style={{ alignItems: 'center' }}><Text style={s.summaryLabel}>Rank</Text><Text style={s.summaryVal}>{data.classRank > 0 ? `${data.classRank}/${data.totalStudents}` : '—'}</Text></View>
                    <View style={{ alignItems: 'center' }}><Text style={s.summaryLabel}>Total Marks</Text><Text style={s.summaryVal}>{totalScore}</Text></View>
                    {isKCSE && data.totalPoints !== undefined && (
                        <View style={{ alignItems: 'center' }}><Text style={s.summaryLabel}>Points</Text><Text style={s.summaryVal}>{data.totalPoints}</Text>{data.overallPointsGrade && <Text style={[s.summaryLabel, { marginTop: 2 }]}>({data.overallPointsGrade})</Text>}</View>
                    )}
                </View>
            </View>

            {/* Subject Table */}
            <View style={s.table}>
                {isKCSE ? (
                    <View style={s.tableHeader}>
                        <Text style={[s.thText, s.colNo]}>#</Text><Text style={[s.thText, s.colKcseSubject]}>Subject</Text>
                        <Text style={[s.thText, s.colKcseScore]}>Scores(%)</Text><Text style={[s.thText, s.colKcseRank]}>Rank</Text>
                        <Text style={[s.thText, s.colKcseGrade]}>Grade</Text><Text style={[s.thText, s.colKcsePoints]}>Pts</Text>
                        <Text style={[s.thText, s.colKcseComment]}>Comment</Text>
                    </View>
                ) : (
                    <View style={s.tableHeader}>
                        <Text style={[s.thText, s.colNo]}>#</Text><Text style={[s.thText, s.colSubject]}>Learning Area</Text>
                        <Text style={[s.thText, s.colMarks]}>Marks</Text><Text style={[s.thText, s.colGrade]}>Grade</Text>
                        <Text style={[s.thText, s.colRubric]}>Points</Text><Text style={[s.thText, s.colRank]}>Rank</Text>
                        <Text style={[s.thText, s.colComment]}>Comments</Text>
                    </View>
                )}

                {data.subjectMarks.map((sm) => {
                    rowCounter++;
                    const rowStyle = rowCounter % 2 === 0 ? s.tableRowAlt : s.tableRow;
                    const rankText = sm.subjectRank && sm.totalStudents ? `${sm.subjectRank}/${sm.totalStudents}` : '—';
                    const comment = sm.teacherComment || generateShortFeedback(sm.percentage, sm.grade);

                    if (isKCSE) {
                        const excluded = showExclusions && sm.includedInPoints === false;
                        return (
                            <View style={rowStyle} key={`${sm.subjectName}-${rowCounter}`}>
                                <Text style={[s.tdText, s.colNo]}>{rowCounter}</Text>
                                <Text style={[s.tdText, s.colKcseSubject, excluded ? { color: GRAY_400 } : {}]}>{sm.subjectName}{excluded ? ' *' : ''}</Text>
                                <Text style={[s.tdBold, s.colKcseScore]}>{sm.percentage != null ? `${sm.percentage}%` : '—'}</Text>
                                <Text style={[s.tdText, s.colKcseRank]}>{rankText}</Text>
                                <Text style={[s.tdBold, s.colKcseGrade, { color: gradeColor(sm.grade) }]}>{sm.grade}</Text>
                                <Text style={[s.tdText, s.colKcsePoints, excluded ? { color: GRAY_400, textDecoration: 'line-through' } : {}]}>{sm.points ?? '—'}</Text>
                                <Text style={[s.tdSmall, s.colKcseComment]}>{comment}</Text>
                            </View>
                        );
                    }
                    return (
                        <View style={rowStyle} key={`${sm.subjectName}-${rowCounter}`}>
                            <Text style={[s.tdText, s.colNo]}>{rowCounter}</Text>
                            <Text style={[s.tdText, s.colSubject]}>{sm.subjectName}</Text>
                            <Text style={[s.tdBold, s.colMarks]}>{sm.score != null ? `${sm.score}` : '—'}</Text>
                            <Text style={[s.tdBold, s.colGrade, { color: gradeColor(sm.grade) }]}>{sm.grade || '—'}</Text>
                            <Text style={[s.tdBold, s.colRubric]}>{sm.points != null ? `${sm.points}` : '—'}</Text>
                            <Text style={[s.tdText, s.colRank]}>{rankText}</Text>
                            <Text style={[s.tdSmall, s.colComment]}>{comment}</Text>
                        </View>
                    );
                })}

                {/* Totals Row */}
                <View style={s.totalsRow}>
                    <Text style={[s.tdBold, s.colNo]}></Text>
                    <Text style={[s.tdBold, isKCSE ? s.colKcseSubject : s.colSubject, { color: NAVY }]}>TOTAL</Text>
                    {isKCSE ? (
                        <>
                            <Text style={[s.tdBold, s.colKcseScore, { color: ORANGE }]}>{Math.round(data.overallPercentage)}%</Text>
                            <Text style={[s.tdBold, s.colKcseRank, { color: NAVY }]}>{data.classRank > 0 ? `${data.classRank}` : '—'}</Text>
                            <Text style={[s.tdBold, s.colKcseGrade, { color: gradeColor(data.overallPointsGrade || data.overallGrade) }]}>{data.overallPointsGrade || data.overallGrade}</Text>
                            <Text style={[s.tdBold, s.colKcsePoints, { color: NAVY }]}>{data.totalPoints ?? '—'}</Text>
                            <Text style={[s.tdBold, s.colKcseComment]}></Text>
                        </>
                    ) : (
                        <>
                            <Text style={[s.tdBold, s.colMarks, { color: ORANGE }]}>{totalScore}</Text>
                            <Text style={[s.tdBold, s.colGrade, { color: gradeColor(data.overallGrade) }]}>{data.overallGrade}</Text>
                            <Text style={[s.tdBold, s.colRubric]}></Text>
                            <Text style={[s.tdBold, s.colRank, { color: NAVY }]}>{data.classRank > 0 ? `${data.classRank}` : '—'}</Text>
                            <Text style={[s.tdBold, s.colComment]}></Text>
                        </>
                    )}
                </View>

                {/* KCSE best-7 footnote */}
                {showExclusions && (
                    <Text style={{ fontSize: 6.5, color: GRAY_700, marginTop: 3, paddingHorizontal: 4, fontStyle: 'italic' }}>
                        * Points count {includedCount} subjects (KCSE 8-4-4): English, Kiswahili &amp; Mathematics, the best 2 sciences, the best humanity, and the best of the remaining subjects. Starred subjects are shown but not counted toward points.
                    </Text>
                )}
            </View>

            {/* Average Badge + Performance Graph */}
            <View style={s.bottomRow}>
                <View style={s.avgBadge}>
                    <Text style={s.avgLabel}>Average</Text>
                    <Text style={s.avgValue}>{Math.round(data.overallPercentage)}%</Text>
                </View>
                <View style={s.gradingKey}>
                    <View style={s.gradingKeyHeader}><Text style={s.gradingKeyTitle}>Subject Performance Analysis</Text></View>
                    <PerformanceGraph data={data} />
                </View>
            </View>

            {/* Comments */}
            <View style={s.commentBox}>
                <Text style={s.commentTitle}>Class Teacher&apos;s Comment:</Text>
                <Text style={s.commentText}>{data.classTeacherComment || generateClassTeacherComment(data.overallPercentage, data.overallGrade, data.totalPoints)}</Text>
            </View>
            <View style={s.commentBox}>
                <Text style={s.commentTitle}>Principal&apos;s Comment:</Text>
                <Text style={s.commentText}>{data.principalComment || generatePrincipalComment(data.overallPercentage, data.overallGrade, data.totalPoints)}</Text>
            </View>

            {/* Signatures */}
            <View style={s.signaturesRow}>
                <View style={s.sigBlock}><Text style={s.sigLabel}>Parent&apos;s / Guardian&apos;s Signature</Text><View style={s.sigLine} /></View>
                <View style={s.sigBlock}><Text style={s.sigLabel}>Class Teacher&apos;s Signature</Text><View style={s.sigLine} /></View>
            </View>

            {/* Footer */}
            <View style={s.footer}>
                <Text style={s.footerLine}>Report generated on {today}</Text>
                {data.openingDate && <Text style={s.footerLine}>Next term begins on: {data.openingDate}</Text>}
                <Text style={s.footerLine}>Matokeo</Text>
                <Text>This document is electronically generated</Text>
            </View>
        </>
    );
}

function PerformanceGraph({ data }: { data: ReportCardData }) {
    if (data.subjectTrendData && data.subjectTrendData.length > 0) {
        return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {data.subjectTrendData.slice(0, 6).map((subj, idx) => {
                    const currentScore = subj.scores[subj.scores.length - 1]?.percentage || 0;
                    const barHeight = (currentScore / 100) * 50;
                    return (
                        <View key={idx} style={{ width: 55, alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ height: 50, width: 20, backgroundColor: '#E5E7EB', borderRadius: 2, position: 'relative', justifyContent: 'flex-end' }}>
                                <View style={{ height: barHeight, width: 20, backgroundColor: barColor(currentScore), borderRadius: 2 }} />
                            </View>
                            <Text style={{ fontSize: 6, marginTop: 2, color: GRAY_700 }}>{currentScore.toFixed(0)}%</Text>
                            <Text style={{ fontSize: 5, color: GRAY_400, textAlign: 'center', marginTop: 1 }}>
                                {subj.subjectName.length > 10 ? subj.subjectName.substring(0, 8) + '..' : subj.subjectName}
                            </Text>
                        </View>
                    );
                })}
            </View>
        );
    }

    return (
        <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 7, color: GRAY_700, marginBottom: 6 }}>Current Term Performance</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {data.subjectMarks.slice(0, 8).map((subj, idx) => {
                    const currentScore = subj.percentage || 0;
                    const barHeight = (currentScore / 100) * 40;
                    return (
                        <View key={idx} style={{ width: 40, alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ height: 40, width: 14, backgroundColor: '#E5E7EB', borderRadius: 2, position: 'relative', justifyContent: 'flex-end' }}>
                                <View style={{ height: barHeight, width: 14, backgroundColor: barColor(currentScore), borderRadius: 2 }} />
                            </View>
                            <Text style={{ fontSize: 5, marginTop: 2, color: GRAY_700 }}>{currentScore.toFixed(0)}%</Text>
                        </View>
                    );
                })}
            </View>
            <Text style={{ fontSize: 6, color: GRAY_400, marginTop: 4 }}>Score distribution by subject</Text>
        </View>
    );
}
