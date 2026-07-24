import React from 'react';
import { Text, View, Image, Svg, Path } from '@react-pdf/renderer';
import {
    c, INK, GOLD, WHITE, GRAY_400, KENYA_GREEN, KENYA_RED,
    EE_GREEN, ME_BLUE, AE_ORANGE, BE_RED, INK_MUTED,
} from './pdfStyles';
import { generateShortFeedback, generateClassTeacherComment, generatePrincipalComment } from './pdfHelpers';
import { ReportFooter } from './ReportFooter';
import type { ReportCardData } from '../pdfGenerator';

/* ── Competency bands (CBC) ──────────────────────────────────
   A learner's mark is printed in the ONE band it falls into, and the
   other bands show a dash — exactly how the reference report reads,
   so a parent can see the achieved level at a glance without decoding
   a grade symbol. Bands are the standard CBC four. */
const CBC_BANDS = [
    { code: 'EE', name: 'Exceeding\nExpectations', color: EE_GREEN, min: 76 },
    { code: 'ME', name: 'Meeting\nExpectations', color: ME_BLUE, min: 51 },
    { code: 'AE', name: 'Approaching\nExpectations', color: AE_ORANGE, min: 26 },
    { code: 'BE', name: 'Below\nExpectations', color: BE_RED, min: 0 },
] as const;

function bandFor(percentage: number | null | undefined) {
    if (percentage == null) return null;
    return CBC_BANDS.find(b => percentage >= b.min) ?? CBC_BANDS[CBC_BANDS.length - 1];
}

/** Subject accent dot — keyed to performance, the page's only per-row colour. */
function perfColor(pct: number | null | undefined): string {
    if (pct == null) return GRAY_400;
    if (pct >= 76) return EE_GREEN;
    if (pct >= 51) return ME_BLUE;
    if (pct >= 26) return AE_ORANGE;
    return BE_RED;
}

/**
 * The national ribbon that separates the masthead from the report body.
 * Drawn as a real curve rather than flat bars so the page opens with
 * something crafted — it is the single decorative flourish on the sheet.
 */
function FlagRibbon() {
    return (
        <Svg width="100%" height="14" viewBox="0 0 600 14" style={{ marginTop: -1 }}>
            <Path d="M0 0 C 150 12, 300 -6, 600 6 L600 0 L0 0 Z" fill={INK} />
            <Path d="M0 1 C 150 13, 300 -5, 600 7 L600 10 C 300 -2, 150 16, 0 4 Z" fill={KENYA_GREEN} />
            <Path d="M0 4 C 150 16, 300 -2, 600 10 L600 12 C 300 0, 150 18, 0 6 Z" fill={WHITE} />
            <Path d="M0 6 C 150 18, 300 0, 600 12 L600 14 L0 14 Z" fill={KENYA_RED} />
        </Svg>
    );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
    return (
        <View style={c.infoLine}>
            <Text style={c.infoKey}>{label}</Text>
            <View style={c.infoLeader} />
            <Text style={c.infoVal}>{value || '—'}</Text>
        </View>
    );
}

/**
 * Classic report card — an institutional sheet built around one navy
 * masthead, one gold accent and a single column rhythm. Serves both
 * curricula: CBC prints competency bands, 8-4-4 prints grade / points /
 * rank in the same grouped table so the two never diverge in feel.
 */
export function ReportCardLayout({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    const isKCSE = data.gradingSystemType === 'KCSE';
    const totalScore = data.totalScore ?? data.subjectMarks.reduce((sum, m) => sum + (m.score || 0), 0);
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const curriculum = isKCSE ? '8-4-4 System · KCSE' : 'Competency-Based Curriculum (CBC)';

    return (
        <>
            {/* ── Masthead ── */}
            <View style={c.masthead}>
                {data.schoolLogoUrl ? (
                    <View style={c.crestFrame}><Image style={c.crest} src={data.schoolLogoUrl} /></View>
                ) : (
                    <View style={c.crestFallback}>
                        <Text style={c.crestFallbackText}>
                            {(data.schoolName || 'S').trim().charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
                <View style={c.mastheadCenter}>
                    <Text style={c.mastheadSchool}>{data.schoolName}</Text>
                    <Text style={c.mastheadCurriculum}>{curriculum}</Text>
                    {data.schoolAddress && <Text style={c.mastheadAddress}>{data.schoolAddress}</Text>}
                </View>
                {qrCodeDataUri ? (
                    <View style={c.photoFrame}><Image style={c.photoImg} src={qrCodeDataUri} /></View>
                ) : (
                    <View style={c.photoEmpty}><Text style={{ fontSize: 8, color: GOLD, fontFamily: 'Helvetica-Bold' }}>REPORT</Text></View>
                )}
            </View>
            <FlagRibbon />

            {/* ── Title ── */}
            <View style={c.titleStrip}>
                <Text style={c.titleText}>{isKCSE ? 'Academic Report' : 'Learner Assessment Report'}</Text>
                <View style={c.titleRule}>
                    <View style={c.titleRuleBar} />
                    <View style={c.titleRuleDot} />
                    <View style={c.titleRuleBar} />
                </View>
            </View>

            {/* ── Paired info cards ── */}
            <View style={c.infoRow}>
                <View style={c.infoCard}>
                    <View style={c.infoCardHead}><Text style={c.infoCardTitle}>Learner Information</Text></View>
                    <View style={c.infoCardBody}>
                        <InfoLine label="Name" value={data.studentName} />
                        <InfoLine label="Admission No" value={data.enrollmentNumber} />
                        <InfoLine label="Class" value={data.className} />
                        {data.pathwayName
                            ? <InfoLine label="Pathway" value={`${data.pathwayName}${data.combinationCode ? ` (${data.combinationCode})` : ''}`} />
                            : <InfoLine label="Curriculum" value={isKCSE ? '8-4-4' : 'CBC'} />}
                    </View>
                </View>
                <View style={c.infoCard}>
                    <View style={c.infoCardHead}><Text style={c.infoCardTitle}>Assessment Information</Text></View>
                    <View style={c.infoCardBody}>
                        <InfoLine label="Examination" value={data.examTitle} />
                        <InfoLine label="Academic Year" value={data.academicYear} />
                        <InfoLine label="Position in Class" value={data.classRank > 0 ? `${data.classRank} of ${data.totalStudents}` : '—'} />
                        {data.combinationRank !== undefined
                            ? <InfoLine label="Pathway Position" value={`${data.combinationRank} of ${data.combinationSize}`} />
                            : <InfoLine label="Subjects Taken" value={`${data.subjectMarks.length}`} />}
                    </View>
                </View>
            </View>

            {/* ── Subject table ── */}
            {isKCSE ? <KcseTable data={data} /> : <CbcTable data={data} />}

            {/* ── Overall average ── */}
            <View style={c.averageBar}>
                <View style={c.averageLabelWrap}>
                    <Text style={c.averageLabel}>Overall {isKCSE ? 'Performance' : 'Average'}</Text>
                </View>
                <View style={c.averageValueWrap}>
                    <View style={c.averageStat}>
                        <Text style={c.averageStatLabel}>Mean</Text>
                        <Text style={c.averageHero}>{Math.round(data.overallPercentage)}%</Text>
                    </View>
                    <View style={c.averageStat}>
                        <Text style={c.averageStatLabel}>Total Marks</Text>
                        <Text style={c.averageStatValue}>{totalScore}</Text>
                    </View>
                    {isKCSE && data.totalPoints !== undefined && (
                        <View style={c.averageStat}>
                            <Text style={c.averageStatLabel}>Points</Text>
                            <Text style={c.averageStatValue}>{data.totalPoints}</Text>
                        </View>
                    )}
                    <View style={c.averageStat}>
                        <Text style={c.averageStatLabel}>{isKCSE ? 'Mean Grade' : 'Level'}</Text>
                        <Text style={[c.averageStatValue, { color: perfColor(data.overallPercentage) }]}>
                            {data.overallPointsGrade || data.overallGrade || '—'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* ── Analysis + grading key ── */}
            <View style={c.panelRow}>
                <View style={[c.panel, { flex: 1.55 }]}>
                    <View style={c.panelHead}><Text style={c.panelTitle}>Subject Performance Analysis</Text></View>
                    <View style={c.panelBody}><SubjectAnalysis data={data} /></View>
                </View>
                <View style={[c.panel, { flex: 1 }]}>
                    <View style={c.panelHead}><Text style={c.panelTitle}>{isKCSE ? 'Grading Key' : 'Competency Key'}</Text></View>
                    <View style={c.panelBody}><GradingKey data={data} isKCSE={isKCSE} /></View>
                </View>
            </View>

            {/* ── Comments ── */}
            <View style={c.commentWrap}>
                <View style={c.commentHead}><Text style={c.commentHeadText}>Remarks</Text></View>
                <View style={c.commentBody}>
                    <Text style={c.commentRole}>Class Teacher</Text>
                    <Text style={c.commentText}>
                        {data.classTeacherComment || generateClassTeacherComment(data.overallPercentage, data.overallGrade, data.totalPoints)}
                    </Text>
                    <View style={c.commentDivider} />
                    <Text style={c.commentRole}>Principal</Text>
                    <Text style={c.commentText}>
                        {data.principalComment || generatePrincipalComment(data.overallPercentage, data.overallGrade, data.totalPoints)}
                    </Text>
                </View>
            </View>

            {/* ── Signatures ── */}
            <View style={c.signRow}>
                <View style={c.signBlock}><View style={c.signLine} /><Text style={c.signLabel}>Class Teacher</Text></View>
                <View style={c.signBlock}><View style={c.signLine} /><Text style={c.signLabel}>Principal</Text></View>
                <View style={c.signBlock}><View style={c.signLine} /><Text style={c.signLabel}>Parent / Guardian</Text></View>
            </View>

            <ReportFooter generatedOn={today} openingDate={data.openingDate} />
        </>
    );
}

/* ── CBC table: Subject | Score | Competency bands ─────────── */
const CBC_W = { subject: '30%', score: '13%', band: '14.25%' };

function CbcTable({ data }: { data: ReportCardData }) {
    return (
        <View style={c.table}>
            <View style={c.thGroupRow}>
                <View style={[c.thGroupCell, { width: CBC_W.subject }]}><Text style={c.thGroupText}>Learning Area</Text></View>
                <View style={[c.thGroupCell, { width: CBC_W.score, borderLeft: `0.5pt solid ${INK_MUTED}` }]}>
                    <Text style={c.thGroupText}>Score</Text>
                </View>
                <View style={[c.thGroupCell, { flex: 1, borderLeft: `0.5pt solid ${INK_MUTED}` }]}>
                    <Text style={c.thGroupText}>Competency Level</Text>
                </View>
            </View>
            <View style={[c.thSubRow, { backgroundColor: INK }]}>
                <View style={{ width: CBC_W.subject }} />
                <View style={[c.thSubCell, { width: CBC_W.score }]}><Text style={c.thSubNote}>out of 100</Text></View>
                {CBC_BANDS.map(b => (
                    <View key={b.code} style={[c.thSubCell, { width: CBC_W.band, backgroundColor: b.color }]}>
                        <Text style={c.thSubText}>{b.code}</Text>
                    </View>
                ))}
            </View>

            {data.subjectMarks.map((sm, i) => {
                const band = bandFor(sm.percentage);
                return (
                    <View style={i % 2 === 1 ? c.rowAlt : c.row} key={`${sm.subjectName}-${i}`}>
                        <View style={[c.subjectCell, { width: CBC_W.subject }]}>
                            <View style={[c.subjectDot, { backgroundColor: perfColor(sm.percentage) }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={c.subjectName}>{sm.subjectName}</Text>
                                {sm.paperScores && sm.paperScores.length > 0 && (
                                    <Text style={c.subjectPapers}>
                                        {sm.paperScores.map(p => `${p.code} ${p.score}/${p.maxScore}`).join('  ')}
                                    </Text>
                                )}
                            </View>
                        </View>
                        <View style={[c.cellPad, { width: CBC_W.score }]}>
                            <Text style={c.tdCenterBold}>{sm.percentage != null ? sm.percentage : '—'}</Text>
                        </View>
                        {CBC_BANDS.map(b => (
                            <View key={b.code} style={[c.cellPad, { width: CBC_W.band }]}>
                                {band?.code === b.code
                                    ? <Text style={[c.bandMark, { color: b.color }]}>{sm.percentage}</Text>
                                    : <Text style={c.bandDash}>–</Text>}
                            </View>
                        ))}
                    </View>
                );
            })}
        </View>
    );
}

/* ── 8-4-4 table: Subject | Score | Grade/Points/Rank | Remark ── */
const K_W = { subject: '24%', score: '10%', grade: '9%', points: '8%', rank: '11%' };

function KcseTable({ data }: { data: ReportCardData }) {
    return (
        <View style={c.table}>
            <View style={c.thGroupRow}>
                <View style={[c.thGroupCell, { width: K_W.subject }]}><Text style={c.thGroupText}>Subject</Text></View>
                <View style={[c.thGroupCell, { width: K_W.score, borderLeft: `0.5pt solid ${INK_MUTED}` }]}><Text style={c.thGroupText}>Score</Text></View>
                <View style={[c.thGroupCell, { width: `${28}%`, borderLeft: `0.5pt solid ${INK_MUTED}` }]}><Text style={c.thGroupText}>Attainment</Text></View>
                <View style={[c.thGroupCell, { flex: 1, borderLeft: `0.5pt solid ${INK_MUTED}` }]}><Text style={c.thGroupText}>Remark</Text></View>
            </View>
            <View style={[c.thSubRow, { backgroundColor: INK }]}>
                <View style={{ width: K_W.subject }} />
                <View style={[c.thSubCell, { width: K_W.score }]}><Text style={c.thSubNote}>%</Text></View>
                <View style={[c.thSubCell, { width: K_W.grade }]}><Text style={c.thSubText}>Grade</Text></View>
                <View style={[c.thSubCell, { width: K_W.points }]}><Text style={c.thSubText}>Pts</Text></View>
                <View style={[c.thSubCell, { width: K_W.rank }]}><Text style={c.thSubText}>Rank</Text></View>
                <View style={{ flex: 1 }} />
            </View>

            {data.subjectMarks.map((sm, i) => {
                const rank = sm.subjectRank && sm.totalStudents ? `${sm.subjectRank}/${sm.totalStudents}` : '—';
                return (
                    <View style={i % 2 === 1 ? c.rowAlt : c.row} key={`${sm.subjectName}-${i}`}>
                        <View style={[c.subjectCell, { width: K_W.subject }]}>
                            <View style={[c.subjectDot, { backgroundColor: perfColor(sm.percentage) }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={c.subjectName}>{sm.subjectName}</Text>
                                {sm.paperScores && sm.paperScores.length > 0 && (
                                    <Text style={c.subjectPapers}>
                                        {sm.paperScores.map(p => `${p.code} ${p.score}/${p.maxScore}`).join('  ')}
                                    </Text>
                                )}
                            </View>
                        </View>
                        <View style={[c.cellPad, { width: K_W.score }]}>
                            <Text style={c.tdCenterBold}>{sm.percentage != null ? sm.percentage : '—'}</Text>
                        </View>
                        <View style={[c.cellPad, { width: K_W.grade }]}>
                            <Text style={[c.bandMark, { color: perfColor(sm.percentage) }]}>{sm.grade || '—'}</Text>
                        </View>
                        <View style={[c.cellPad, { width: K_W.points }]}>
                            <Text style={c.tdCenter}>{sm.points ?? '—'}</Text>
                        </View>
                        <View style={[c.cellPad, { width: K_W.rank }]}>
                            <Text style={c.tdMuted}>{rank}</Text>
                        </View>
                        <Text style={[c.tdComment, { flex: 1 }]}>
                            {sm.teacherComment || generateShortFeedback(sm.percentage, sm.grade)}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

/* ── Subject analysis ─────────────────────────────────────── */
function SubjectAnalysis({ data }: { data: ReportCardData }) {
    const marks = data.subjectMarks.filter(m => m.percentage != null);
    if (marks.length === 0) {
        return <Text style={{ fontSize: 7, color: INK_MUTED }}>No subject marks recorded for this assessment.</Text>;
    }

    // Chart the first 9 so the bars stay legible; the table above is the
    // complete record, this panel is for shape-of-performance at a glance.
    const charted = marks.slice(0, 9);
    const sorted = [...marks].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    const best = sorted[0];
    const weakest = sorted[sorted.length - 1];
    const mean = marks.reduce((sum, m) => sum + (m.percentage || 0), 0) / marks.length;
    const aboveMean = marks.filter(m => (m.percentage || 0) >= mean).length;

    const shortName = (n: string) => (n.length > 7 ? `${n.substring(0, 6)}.` : n);

    return (
        <View>
            <View style={c.chartRow}>
                {charted.map((m, i) => {
                    const pct = m.percentage || 0;
                    return (
                        <View key={i} style={c.chartCol}>
                            <View style={c.chartTrack}>
                                <View style={[c.chartFill, { height: Math.max(2, (pct / 100) * 38), backgroundColor: perfColor(pct) }]} />
                            </View>
                            <Text style={c.chartPct}>{Math.round(pct)}</Text>
                            <Text style={c.chartLabel}>{shortName(m.subjectName)}</Text>
                        </View>
                    );
                })}
            </View>
            <View style={c.calloutRow}>
                <View style={c.callout}>
                    <Text style={c.calloutLabel}>Strongest</Text>
                    <Text style={c.calloutValue}>{shortName(best.subjectName)} · {Math.round(best.percentage || 0)}%</Text>
                </View>
                <View style={c.callout}>
                    <Text style={c.calloutLabel}>Needs Focus</Text>
                    <Text style={c.calloutValue}>{shortName(weakest.subjectName)} · {Math.round(weakest.percentage || 0)}%</Text>
                </View>
                <View style={c.callout}>
                    <Text style={c.calloutLabel}>At / Above Mean</Text>
                    <Text style={c.calloutValue}>{aboveMean} of {marks.length}</Text>
                </View>
            </View>
        </View>
    );
}

/* ── Grading / competency key ─────────────────────────────── */
function GradingKey({ data, isKCSE }: { data: ReportCardData; isKCSE: boolean }) {
    if (!isKCSE) {
        return (
            <View>
                {CBC_BANDS.map(b => (
                    <View key={b.code} style={c.keyItem}>
                        <View style={[c.keyChip, { backgroundColor: b.color }]}><Text style={c.keyChipText}>{b.code}</Text></View>
                        <Text style={c.keyText}>{b.name.replace('\n', ' ')}</Text>
                        <Text style={c.keyRange}>{b.min}+</Text>
                    </View>
                ))}
            </View>
        );
    }

    const bounds = (data.gradeBoundaries || []).slice(0, 12);
    if (bounds.length === 0) {
        return <Text style={{ fontSize: 6.5, color: INK_MUTED }}>No grading scale configured.</Text>;
    }
    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {bounds.map((g, i) => (
                <View key={i} style={[c.keyItem, { width: '50%', paddingRight: 4 }]}>
                    <View style={[c.keyChip, { backgroundColor: perfColor(g.min), width: 16 }]}>
                        <Text style={c.keyChipText}>{g.symbol}</Text>
                    </View>
                    <Text style={c.keyRange}>{g.min}–{g.max}</Text>
                    {g.points !== undefined && (
                        <Text style={[c.keyText, { textAlign: 'right', fontSize: 5.6 }]}> {g.points}pt</Text>
                    )}
                </View>
            ))}
        </View>
    );
}
