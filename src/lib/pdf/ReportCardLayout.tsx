import React from 'react';
import { Text, View, Image } from '@react-pdf/renderer';
import { c } from './pdfStyles';
import { FONT_BODY } from './pdfTheme';
import { T, attainmentColor } from './pdfTheme';
import { generateShortFeedback, generateClassTeacherComment, generatePrincipalComment } from './pdfHelpers';
import { ReportFooter } from './ReportFooter';
import type { ReportCardData } from '../pdfGenerator';

/* ── Competency bands (CBC) ──────────────────────────────────
   The mark is printed in the ONE band it falls into and the others
   show a dash, so a parent reads the attainment level without having
   to decode a symbol. Colours come from the project's chart tokens. */
const BAR_H = 58;

const CBC_BANDS = [
    { code: 'EE', name: 'Exceeding Expectations', color: T.green, min: 75 },
    { code: 'ME', name: 'Meeting Expectations', color: T.primary, min: 50 },
    { code: 'AE', name: 'Approaching Expectations', color: T.amber, min: 25 },
    { code: 'BE', name: 'Below Expectations', color: T.red, min: 0 },
] as const;

const bandFor = (pct: number | null | undefined) =>
    pct == null ? null : (CBC_BANDS.find(b => pct >= b.min) ?? CBC_BANDS[CBC_BANDS.length - 1]);

type SubjectMark = ReportCardData['subjectMarks'][number];

/** Movement in a subject since the previous round, or null when there is none. */
function deviation(sm: SubjectMark): number | null {
    if (sm.percentage == null || sm.previousPercentage == null) return null;
    return Math.round(sm.percentage - sm.previousPercentage);
}

/** Signed figures read as movement; unsigned ones read as a total.
    Kept to ASCII — an en-dash or a ± is a missing glyph away from a blank. */
const signed = (value: number, unit = '') =>
    `${value > 0 ? '+' : value < 0 ? '-' : ''}${Math.abs(value)}${unit}`;

const deltaColor = (value: number) => (value > 0 ? T.green : value < 0 ? T.red : T.muted);

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
 * Classic report card, typeset in the SkulBase design language — the
 * product's own blue, indigo and chart colours, set in Merriweather and
 * Syne. One structure serves both curricula: CBC prints competency
 * bands, 8-4-4 prints grade / points / rank, and multi-paper subjects
 * get PP1 / PP2 / … columns with a Total that is always out of 100.
 */
export function ReportCardLayout({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    const isKCSE = data.gradingSystemType === 'KCSE';
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    // Paper columns appear only when a subject actually uses them, and only
    // as many as the widest subject needs (capped so the row stays legible).
    // CBC reports an achievement LEVEL, not a letter grade. Reading
    // overallGrade/overallPointsGrade here printed an 8-4-4 symbol ("B-") under
    // "Level", contradicting the competency bands in the table right above it.
    // Derive the level from the same bands the table uses so the two agree.
    const overallLevel = isKCSE
        ? (data.overallPointsGrade || data.overallGrade || '—')
        : (bandFor(Math.round(data.overallPercentage))?.code ?? '—');

    const paperCount = Math.min(3, Math.max(0, ...data.subjectMarks.map(m => m.paperScores?.length ?? 0)));
    const paperCodes = Array.from({ length: paperCount }, (_, i) => {
        const found = data.subjectMarks.find(m => (m.paperScores?.length ?? 0) > i)?.paperScores?.[i];
        return found?.code || `PP${i + 1}`;
    });

    // The deviation column earns its width only when there is an earlier round
    // to compare against — a school's first exam prints the table as before.
    const showDev = data.subjectMarks.some(m => m.previousPercentage != null);
    // 8-4-4 grades the best 7 subjects, so a learner taking 9 sees nine rows of
    // points that don't add up to the total. Say so, and grey the two that were
    // left out, rather than leaving a parent to wonder about the arithmetic.
    const pointsCounted = isKCSE && data.subjectMarks.some(m => m.includedInPoints === false)
        ? data.subjectMarks.filter(m => m.includedInPoints !== false).length
        : null;

    return (
        <View style={{ flex: 1, fontFamily: FONT_BODY }}>
            {/* ── Masthead ── */}
            <View style={c.masthead}>
                {data.schoolLogoUrl ? (
                    <View style={c.crestFrame}><Image style={c.crest} src={data.schoolLogoUrl} /></View>
                ) : (
                    <View style={c.crestFallback}>
                        <Text style={c.crestFallbackText}>{(data.schoolName || 'S').trim().charAt(0).toUpperCase()}</Text>
                    </View>
                )}
                <View style={c.mastheadCenter}>
                    <Text style={c.mastheadSchool}>{data.schoolName}</Text>
                    {data.schoolAddress && <Text style={c.mastheadAddress}>{data.schoolAddress}</Text>}
                    <Text style={c.mastheadDoc}>{data.examTitle} · {data.academicYear}</Text>
                </View>
                <View style={c.badge}>
                    <Text style={c.badgeLabel}>Mean</Text>
                    <Text style={c.badgeValue}>{Math.round(data.overallPercentage)}%</Text>
                </View>
                {qrCodeDataUri && <Image style={c.qrImg} src={qrCodeDataUri} />}
            </View>
            <View style={c.accentRule} />

            {/* ── Info cards ── */}
            <View style={c.infoRow}>
                <View style={c.infoCard}>
                    <View style={c.infoCardHead}><Text style={c.infoCardTitle}>Learner</Text></View>
                    <View style={c.infoCardBody}>
                        <InfoLine label="Name" value={data.studentName} />
                        <InfoLine label="Admission No" value={data.enrollmentNumber} />
                        <InfoLine label="Class" value={data.className} />
                        {data.pathwayName && (
                            <InfoLine label="Pathway" value={`${data.pathwayName}${data.combinationCode ? ` (${data.combinationCode})` : ''}`} />
                        )}
                    </View>
                </View>
                <View style={c.infoCard}>
                    <View style={c.infoCardHead}><Text style={c.infoCardTitle}>Assessment</Text></View>
                    <View style={c.infoCardBody}>
                        <InfoLine label="Examination" value={data.examTitle} />
                        <InfoLine label="Position in Class" value={data.classRank > 0 ? `${data.classRank} of ${data.totalStudents}` : '—'} />
                        <InfoLine label="Subjects" value={`${data.subjectMarks.length}`} />
                        {data.combinationRank !== undefined && (
                            <InfoLine label="Pathway Position" value={`${data.combinationRank} of ${data.combinationSize}`} />
                        )}
                    </View>
                </View>
            </View>

            {/* ── Subject table ── */}
            {isKCSE
                ? <KcseTable data={data} paperCodes={paperCodes} showDev={showDev} />
                : <CbcTable data={data} paperCodes={paperCodes} showDev={showDev} />}

            {/* ── Overall (with movement since the previous round) ── */}
            <View style={c.averageBar}>
                <View style={c.averageLabelWrap}>
                    <Text style={c.averageLabel}>Overall Performance</Text>
                    <Text style={c.averageSub}>
                        {data.subjectMarks.length} subjects assessed
                        {pointsCounted != null ? ` · best ${pointsCounted} count for points` : ''}
                        {data.previousExamLabel ? ` · change vs ${data.previousExamLabel}` : ''}
                    </Text>
                </View>
                <View style={c.averageValueWrap}>
                    <View style={c.averageStat}>
                        <Text style={c.averageStatLabel}>Mean Score</Text>
                        <Text style={c.averageHero}>{Math.round(data.overallPercentage)}%</Text>
                        <Delta
                            value={data.previousOverallPercentage != null
                                ? Math.round(data.overallPercentage - data.previousOverallPercentage)
                                : null}
                        />
                    </View>
                    {isKCSE && data.totalPoints !== undefined && (
                        <View style={c.averageStat}>
                            <Text style={c.averageStatLabel}>Points</Text>
                            <Text style={c.averageStatValue}>{data.totalPoints}</Text>
                            <Delta
                                value={data.previousTotalPoints != null
                                    ? data.totalPoints - data.previousTotalPoints
                                    : null}
                            />
                        </View>
                    )}
                    <View style={c.averageStat}>
                        <Text style={c.averageStatLabel}>Position</Text>
                        <Text style={c.averageStatValue}>{data.classRank > 0 ? `${data.classRank}/${data.totalStudents}` : '—'}</Text>
                        {/* Moving from 8th to 5th is +3: a smaller rank is a better one. */}
                        <Delta
                            value={data.previousClassRank && data.classRank > 0
                                ? data.previousClassRank - data.classRank
                                : null}
                        />
                    </View>
                    {data.classMeanPercentage !== undefined && (
                        <View style={c.averageStat}>
                            <Text style={c.averageStatLabel}>Class Mean</Text>
                            <Text style={c.averageStatValue}>{Math.round(data.classMeanPercentage)}%</Text>
                        </View>
                    )}
                    <View style={c.averageStat}>
                        <Text style={c.averageStatLabel}>{isKCSE ? 'Mean Grade' : 'Level'}</Text>
                        <Text style={[c.averageStatValue, { color: attainmentColor(data.overallPercentage) }]}>
                            {overallLevel}
                        </Text>
                    </View>
                </View>
            </View>

            {/* ── Analysis + summary (both grow to fill the sheet) ── */}
            <View style={[c.panelRow, c.grow]}>
                <View style={[c.panel, { flex: 1.7 }]}>
                    <View style={c.panelHead}><Text style={c.panelTitle}>Subject Performance Analysis</Text></View>
                    <View style={c.panelBody}><SubjectAnalysis data={data} /></View>
                </View>
                <View style={[c.panel, { flex: 1 }]}>
                    <View style={c.panelHead}><Text style={c.panelTitle}>At a Glance</Text></View>
                    <View style={c.panelBody}><AtAGlance data={data} /></View>
                </View>
            </View>

            {/* ── Remarks (auto-generated unless a teacher wrote their own) ── */}
            <View style={c.commentWrap}>
                <View style={c.commentHead}><Text style={c.commentHeadText}>Remarks</Text></View>
                <View style={c.commentBody}>
                    <Text style={c.commentRole}>Class Teacher</Text>
                    <Text style={c.commentText}>
                        {data.classTeacherComment?.trim()
                            || generateClassTeacherComment(data.overallPercentage, data.overallGrade, data.totalPoints)}
                    </Text>
                    <View style={c.commentDivider} />
                    <Text style={c.commentRole}>Principal</Text>
                    <Text style={c.commentText}>
                        {data.principalComment?.trim()
                            || generatePrincipalComment(data.overallPercentage, data.overallGrade, data.totalPoints)}
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
        </View>
    );
}

/* ── Shared row pieces ────────────────────────────────────── */

/** A small signed figure under a headline number. Renders nothing without one. */
function Delta({ value, unit = '' }: { value: number | null; unit?: string }) {
    if (value == null) return null;
    return <Text style={[c.averageStatDelta, { color: deltaColor(value) }]}>{signed(value, unit)}</Text>;
}

/** Subject name, with the teacher set beneath it when the school records one. */
function SubjectCell({ name, teacher, width }: { name: string; teacher?: string; width: string }) {
    return (
        <View style={[c.subjectCell, { width }]}>
            <View style={[c.subjectDot, { backgroundColor: T.primary }]} />
            <View style={{ flex: 1 }}>
                <Text style={c.subjectName}>{name}</Text>
                {teacher ? <Text style={c.subjectTeacher}>{teacher}</Text> : null}
            </View>
        </View>
    );
}

/** Movement in this subject since the previous round. */
function DevCell({ value, width }: { value: number | null; width: string }) {
    return (
        <View style={[c.cellPad, { width }]}>
            {value == null
                ? <Text style={c.bandDash}>–</Text>
                : <Text style={value > 0 ? c.devUp : value < 0 ? c.devDown : c.devFlat}>{signed(value)}</Text>}
        </View>
    );
}

/** Per-paper cells. A blank paper prints a dash rather than a zero. */
function PaperCells({ papers, count, width }: {
    papers?: { code: string; score: number; maxScore: number }[];
    count: number; width: string;
}) {
    return (
        <>
            {Array.from({ length: count }, (_, i) => {
                const p = papers?.[i];
                return (
                    <View key={i} style={[c.cellPad, { width }]}>
                        <Text style={p ? c.tdCenter : c.bandDash}>{p ? p.score : '–'}</Text>
                    </View>
                );
            })}
        </>
    );
}

/* ── CBC table ────────────────────────────────────────────── */
function CbcTable({ data, paperCodes, showDev }: { data: ReportCardData; paperCodes: string[]; showDev: boolean }) {
    const n = paperCodes.length;
    const paperW = n > 0 ? 7 : 0;
    const subjectW = 26 - (n > 0 ? 2 : 0);
    const totalW = 11;
    const devW = showDev ? 7 : 0;
    const bandW = (100 - subjectW - n * paperW - totalW - devW) / CBC_BANDS.length;
    const pct = (v: number) => `${v}%`;

    return (
        <View style={c.table}>
            <View style={c.thGroupRow}>
                <View style={[c.thGroupCell, { width: pct(subjectW) }]}><Text style={c.thGroupText}>Learning Area</Text></View>
                {n > 0 && (
                    <View style={[c.thGroupCell, { width: pct(n * paperW) }]}><Text style={c.thGroupText}>Papers</Text></View>
                )}
                <View style={[c.thGroupCell, { width: pct(totalW + devW) }]}><Text style={c.thGroupText}>Total</Text></View>
                <View style={[c.thGroupCell, { flex: 1 }]}><Text style={c.thGroupText}>Competency Level</Text></View>
            </View>
            <View style={c.thSubRow}>
                <View style={{ width: pct(subjectW) }} />
                {paperCodes.map(code => (
                    <View key={code} style={[c.thSubCell, { width: pct(paperW) }]}><Text style={c.thSubText}>{code}</Text></View>
                ))}
                <View style={[c.thSubCell, { width: pct(totalW) }]}><Text style={c.thSubNote}>out of 100</Text></View>
                {showDev && (
                    <View style={[c.thSubCell, { width: pct(devW) }]}><Text style={c.thSubText}>Dev.</Text></View>
                )}
                {CBC_BANDS.map(b => (
                    <View key={b.code} style={[c.thSubCell, { width: pct(bandW), backgroundColor: b.color }]}>
                        <Text style={c.thSubText}>{b.code}</Text>
                    </View>
                ))}
            </View>

            {data.subjectMarks.map((sm, i) => {
                const band = bandFor(sm.percentage);
                return (
                    <View style={i % 2 === 1 ? c.rowAlt : c.row} key={`${sm.subjectName}-${i}`}>
                        <SubjectCell name={sm.subjectName} teacher={sm.instructorName} width={pct(subjectW)} />
                        <PaperCells papers={sm.paperScores} count={n} width={pct(paperW)} />
                        <View style={[c.cellPad, { width: pct(totalW) }]}>
                            <Text style={c.tdCenterBold}>{sm.percentage != null ? sm.percentage : '—'}</Text>
                        </View>
                        {showDev && <DevCell value={deviation(sm)} width={pct(devW)} />}
                        {CBC_BANDS.map(b => (
                            <View key={b.code} style={[c.cellPad, { width: pct(bandW) }]}>
                                {band?.code === b.code
                                    ? <Text style={[c.bandMark, { color: b.color }]}>{sm.percentage}</Text>
                                    : <Text style={c.bandDash}>–</Text>}
                            </View>
                        ))}
                    </View>
                );
            })}

            <View style={c.totalRow}>
                <Text style={[c.totalLabel, { width: pct(subjectW) }]}>Mean</Text>
                {n > 0 && <View style={{ width: pct(n * paperW) }} />}
                <View style={[c.cellPad, { width: pct(totalW) }]}>
                    <Text style={[c.tdCenterBold, { color: T.primary }]}>{Math.round(data.overallPercentage)}</Text>
                </View>
                {showDev && (
                    <DevCell
                        value={data.previousOverallPercentage != null
                            ? Math.round(data.overallPercentage - data.previousOverallPercentage)
                            : null}
                        width={pct(devW)}
                    />
                )}
                <View style={{ flex: 1 }} />
            </View>
        </View>
    );
}

/* ── 8-4-4 table ──────────────────────────────────────────── */
function KcseTable({ data, paperCodes, showDev }: { data: ReportCardData; paperCodes: string[]; showDev: boolean }) {
    const n = paperCodes.length;
    const paperW = n > 0 ? 7 : 0;
    const subjectW = 23;
    const totalW = 9;
    const devW = showDev ? 7 : 0;
    const gradeW = 8;
    const pointsW = 7;
    // The rank column gives up a point of width to the deviation column so the
    // remark keeps the room it needs to stay readable.
    const rankW = showDev ? 9 : 10;
    // Every subject carries a class mean once the room has been ranked — but
    // paper columns are the greedier feature, and with both the remark column
    // is squeezed to nothing, so the class mean stands down when papers print.
    const showClassAvg = n === 0 && data.subjectMarks.some(m => m.classAverage != null);
    const classW = showClassAvg ? 8 : 0;
    const pct = (v: number) => `${v}%`;

    return (
        <View style={c.table}>
            <View style={c.thGroupRow}>
                <View style={[c.thGroupCell, { width: pct(subjectW) }]}><Text style={c.thGroupText}>Subject</Text></View>
                {n > 0 && <View style={[c.thGroupCell, { width: pct(n * paperW) }]}><Text style={c.thGroupText}>Papers</Text></View>}
                <View style={[c.thGroupCell, { width: pct(totalW + devW + classW) }]}><Text style={c.thGroupText}>Mark</Text></View>
                <View style={[c.thGroupCell, { width: pct(gradeW + pointsW + rankW) }]}><Text style={c.thGroupText}>Attainment</Text></View>
                <View style={[c.thGroupCell, { flex: 1 }]}><Text style={c.thGroupText}>Remark</Text></View>
            </View>
            <View style={c.thSubRow}>
                <View style={{ width: pct(subjectW) }} />
                {paperCodes.map(code => (
                    <View key={code} style={[c.thSubCell, { width: pct(paperW) }]}><Text style={c.thSubText}>{code}</Text></View>
                ))}
                <View style={[c.thSubCell, { width: pct(totalW) }]}><Text style={c.thSubNote}>out of 100</Text></View>
                {showDev && <View style={[c.thSubCell, { width: pct(devW) }]}><Text style={c.thSubText}>Dev.</Text></View>}
                {showClassAvg && <View style={[c.thSubCell, { width: pct(classW) }]}><Text style={c.thSubText}>Class</Text></View>}
                <View style={[c.thSubCell, { width: pct(gradeW) }]}><Text style={c.thSubText}>Grade</Text></View>
                <View style={[c.thSubCell, { width: pct(pointsW) }]}><Text style={c.thSubText}>Pts</Text></View>
                <View style={[c.thSubCell, { width: pct(rankW) }]}><Text style={c.thSubText}>Rank</Text></View>
                <View style={{ flex: 1 }} />
            </View>

            {data.subjectMarks.map((sm, i) => (
                <View style={i % 2 === 1 ? c.rowAlt : c.row} key={`${sm.subjectName}-${i}`}>
                    <SubjectCell name={sm.subjectName} teacher={sm.instructorName} width={pct(subjectW)} />
                    <PaperCells papers={sm.paperScores} count={n} width={pct(paperW)} />
                    <View style={[c.cellPad, { width: pct(totalW) }]}>
                        <Text style={c.tdCenterBold}>{sm.percentage != null ? sm.percentage : '—'}</Text>
                    </View>
                    {showDev && <DevCell value={deviation(sm)} width={pct(devW)} />}
                    {showClassAvg && (
                        <View style={[c.cellPad, { width: pct(classW) }]}>
                            <Text style={c.tdMuted}>{sm.classAverage != null ? Math.round(sm.classAverage) : '—'}</Text>
                        </View>
                    )}
                    <View style={[c.cellPad, { width: pct(gradeW) }]}>
                        <Text style={[c.bandMark, { color: attainmentColor(sm.percentage) }]}>{sm.grade || '—'}</Text>
                    </View>
                    <View style={[c.cellPad, { width: pct(pointsW) }]}>
                        <Text style={sm.includedInPoints === false ? c.tdCenterExcluded : c.tdCenter}>
                            {sm.points ?? '—'}
                        </Text>
                    </View>
                    <View style={[c.cellPad, { width: pct(rankW) }]}>
                        <Text style={c.tdMuted}>{sm.subjectRank && sm.totalStudents ? `${sm.subjectRank}/${sm.totalStudents}` : '—'}</Text>
                    </View>
                    <Text style={[c.tdComment, { flex: 1 }]}>
                        {sm.teacherComment || generateShortFeedback(sm.percentage, sm.grade)}
                    </Text>
                </View>
            ))}

            <View style={c.totalRow}>
                <Text style={[c.totalLabel, { width: pct(subjectW) }]}>Mean</Text>
                {n > 0 && <View style={{ width: pct(n * paperW) }} />}
                <View style={[c.cellPad, { width: pct(totalW) }]}>
                    <Text style={[c.tdCenterBold, { color: T.primary }]}>{Math.round(data.overallPercentage)}</Text>
                </View>
                {showDev && (
                    <DevCell
                        value={data.previousOverallPercentage != null
                            ? Math.round(data.overallPercentage - data.previousOverallPercentage)
                            : null}
                        width={pct(devW)}
                    />
                )}
                {showClassAvg && (
                    <View style={[c.cellPad, { width: pct(classW) }]}>
                        <Text style={c.tdMuted}>
                            {data.classMeanPercentage != null ? Math.round(data.classMeanPercentage) : '—'}
                        </Text>
                    </View>
                )}
                <View style={[c.cellPad, { width: pct(gradeW) }]}>
                    <Text style={[c.bandMark, { color: attainmentColor(data.overallPercentage) }]}>
                        {data.overallPointsGrade || data.overallGrade || '—'}
                    </Text>
                </View>
                <View style={[c.cellPad, { width: pct(pointsW) }]}>
                    <Text style={[c.tdCenter, { color: T.primary }]}>{data.totalPoints ?? '—'}</Text>
                </View>
                <View style={{ width: pct(rankW) }} />
                <View style={{ flex: 1 }} />
            </View>
        </View>
    );
}

/* ── Analysis ─────────────────────────────────────────────── */
function SubjectAnalysis({ data }: { data: ReportCardData }) {
    const marks = data.subjectMarks.filter(m => m.percentage != null);
    if (marks.length === 0) {
        return <Text style={{ fontSize: 7, color: T.muted }}>No subject marks recorded for this assessment.</Text>;
    }
    const charted = marks.slice(0, 10);
    const short = (n: string) => (n.length > 7 ? `${n.substring(0, 6)}.` : n);
    // The bar says how the learner did; the rule across it says how the room
    // did. Together they answer the question a bare mark never can.
    const hasClassMean = charted.some(m => m.classAverage != null);

    return (
        <View>
            <View style={c.chartRow}>
                {charted.map((m, i) => {
                    const p = m.percentage || 0;
                    const avg = m.classAverage;
                    return (
                        <View key={i} style={c.chartCol}>
                            <View style={[c.chartTrack, { height: BAR_H }]}>
                                <View style={[c.chartFill, { height: Math.max(2, (p / 100) * BAR_H), backgroundColor: attainmentColor(p) }]} />
                                {avg != null && (
                                    <View style={[c.chartMeanMark, { bottom: Math.min(BAR_H - 1, (avg / 100) * BAR_H) }]} />
                                )}
                            </View>
                            <Text style={c.chartPct}>{Math.round(p)}</Text>
                            <Text style={c.chartLabel}>{short(m.subjectName)}</Text>
                        </View>
                    );
                })}
            </View>
            {hasClassMean && (
                <View style={c.chartLegend}>
                    <View style={c.chartLegendItem}>
                        <View style={[c.chartLegendSwatch, { backgroundColor: T.primary }]} />
                        <Text style={c.chartLegendText}>Learner</Text>
                    </View>
                    <View style={c.chartLegendItem}>
                        <View style={c.chartLegendRule} />
                        <Text style={c.chartLegendText}>Class mean</Text>
                    </View>
                </View>
            )}
        </View>
    );
}

/* ── At a glance ──────────────────────────────────────────── */
function AtAGlance({ data }: { data: ReportCardData }) {
    const marks = data.subjectMarks.filter(m => m.percentage != null);
    if (marks.length === 0) {
        return <Text style={{ fontSize: 7, color: T.muted }}>—</Text>;
    }
    const sorted = [...marks].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    const best = sorted[0];
    const weakest = sorted[sorted.length - 1];
    const mean = marks.reduce((s, m) => s + (m.percentage || 0), 0) / marks.length;
    const atOrAbove = marks.filter(m => (m.percentage || 0) >= mean).length;
    const short = (n: string) => (n.length > 12 ? `${n.substring(0, 11)}.` : n);

    // How the learner sits against the room, subject by subject.
    const vsClass = marks.filter(m => m.classAverage != null);
    const aboveClass = vsClass.filter(m => (m.percentage || 0) >= (m.classAverage || 0)).length;

    // Movement since the previous round: the mean, and the subjects that moved.
    const compared = marks.filter(m => m.previousPercentage != null);
    const improved = compared.filter(m => (m.percentage || 0) > (m.previousPercentage || 0)).length;
    const meanChange = data.previousOverallPercentage != null
        ? Math.round(data.overallPercentage - data.previousOverallPercentage)
        : null;

    const rows: [string, string, string?][] = [
        ['Strongest', `${short(best.subjectName)} · ${Math.round(best.percentage || 0)}%`, attainmentColor(best.percentage)],
        ['Needs focus', `${short(weakest.subjectName)} · ${Math.round(weakest.percentage || 0)}%`, attainmentColor(weakest.percentage)],
    ];

    // Measuring the learner against their own average only earns a line when
    // there is nothing better to measure them against; the class does it better.
    if (vsClass.length === 0) {
        rows.push(['At / above own mean', `${atOrAbove} of ${marks.length}`]);
    }
    if (data.classMeanPercentage !== undefined) {
        const gap = Math.round(data.overallPercentage - data.classMeanPercentage);
        rows.push(['Vs class mean', `${Math.round(data.classMeanPercentage)}% · ${signed(gap)}`, deltaColor(gap)]);
    }
    if (vsClass.length > 0) {
        rows.push(['Above class average', `${aboveClass} of ${vsClass.length}`]);
    }
    if (meanChange != null) {
        rows.push([`Mean vs ${data.previousExamLabel || 'last exam'}`, signed(meanChange, '%'), deltaColor(meanChange)]);
    }
    if (compared.length > 0) {
        rows.push(['Subjects improved', `${improved} of ${compared.length}`]);
    }
    rows.push(['Class position', data.classRank > 0 ? `${data.classRank} of ${data.totalStudents}` : '—']);

    return (
        <View style={c.statList}>
            {rows.map(([k, v, color], i) => (
                <View key={k} style={i === rows.length - 1 ? c.statLineLast : c.statLine}>
                    <Text style={c.statKey}>{k}</Text>
                    <Text style={[c.statVal, color ? { color } : {}]}>{v}</Text>
                </View>
            ))}
        </View>
    );
}
