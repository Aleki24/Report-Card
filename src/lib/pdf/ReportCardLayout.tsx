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
const BAR_H = 66;

const CBC_BANDS = [
    { code: 'EE', name: 'Exceeding Expectations', color: T.green, min: 75 },
    { code: 'ME', name: 'Meeting Expectations', color: T.primary, min: 50 },
    { code: 'AE', name: 'Approaching Expectations', color: T.amber, min: 25 },
    { code: 'BE', name: 'Below Expectations', color: T.red, min: 0 },
] as const;

const bandFor = (pct: number | null | undefined) =>
    pct == null ? null : (CBC_BANDS.find(b => pct >= b.min) ?? CBC_BANDS[CBC_BANDS.length - 1]);

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
                ? <KcseTable data={data} paperCodes={paperCodes} />
                : <CbcTable data={data} paperCodes={paperCodes} />}

            {/* ── Overall ── */}
            <View style={c.averageBar}>
                <View style={c.averageLabelWrap}>
                    <Text style={c.averageLabel}>Overall Performance</Text>
                    <Text style={c.averageSub}>{data.subjectMarks.length} subjects assessed</Text>
                </View>
                <View style={c.averageValueWrap}>
                    <View style={c.averageStat}>
                        <Text style={c.averageStatLabel}>Mean Score</Text>
                        <Text style={c.averageHero}>{Math.round(data.overallPercentage)}%</Text>
                    </View>
                    {isKCSE && data.totalPoints !== undefined && (
                        <View style={c.averageStat}>
                            <Text style={c.averageStatLabel}>Points</Text>
                            <Text style={c.averageStatValue}>{data.totalPoints}</Text>
                        </View>
                    )}
                    <View style={c.averageStat}>
                        <Text style={c.averageStatLabel}>Position</Text>
                        <Text style={c.averageStatValue}>{data.classRank > 0 ? `${data.classRank}/${data.totalStudents}` : '—'}</Text>
                    </View>
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

function SubjectCell({ name, width }: { name: string; width: string }) {
    return (
        <View style={[c.subjectCell, { width }]}>
            <View style={[c.subjectDot, { backgroundColor: T.primary }]} />
            <Text style={c.subjectName}>{name}</Text>
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
function CbcTable({ data, paperCodes }: { data: ReportCardData; paperCodes: string[] }) {
    const n = paperCodes.length;
    const paperW = n > 0 ? 7 : 0;
    const subjectW = 26 - (n > 0 ? 2 : 0);
    const totalW = 11;
    const bandW = (100 - subjectW - n * paperW - totalW) / CBC_BANDS.length;
    const pct = (v: number) => `${v}%`;

    return (
        <View style={c.table}>
            <View style={c.thGroupRow}>
                <View style={[c.thGroupCell, { width: pct(subjectW) }]}><Text style={c.thGroupText}>Learning Area</Text></View>
                {n > 0 && (
                    <View style={[c.thGroupCell, { width: pct(n * paperW) }]}><Text style={c.thGroupText}>Papers</Text></View>
                )}
                <View style={[c.thGroupCell, { width: pct(totalW) }]}><Text style={c.thGroupText}>Total</Text></View>
                <View style={[c.thGroupCell, { flex: 1 }]}><Text style={c.thGroupText}>Competency Level</Text></View>
            </View>
            <View style={c.thSubRow}>
                <View style={{ width: pct(subjectW) }} />
                {paperCodes.map(code => (
                    <View key={code} style={[c.thSubCell, { width: pct(paperW) }]}><Text style={c.thSubText}>{code}</Text></View>
                ))}
                <View style={[c.thSubCell, { width: pct(totalW) }]}><Text style={c.thSubNote}>out of 100</Text></View>
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
                        <SubjectCell name={sm.subjectName} width={pct(subjectW)} />
                        <PaperCells papers={sm.paperScores} count={n} width={pct(paperW)} />
                        <View style={[c.cellPad, { width: pct(totalW) }]}>
                            <Text style={c.tdCenterBold}>{sm.percentage != null ? sm.percentage : '—'}</Text>
                        </View>
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
                <View style={{ flex: 1 }} />
            </View>
        </View>
    );
}

/* ── 8-4-4 table ──────────────────────────────────────────── */
function KcseTable({ data, paperCodes }: { data: ReportCardData; paperCodes: string[] }) {
    const n = paperCodes.length;
    const paperW = n > 0 ? 7 : 0;
    const subjectW = 23;
    const totalW = 9;
    const gradeW = 8;
    const pointsW = 7;
    const rankW = 10;
    const pct = (v: number) => `${v}%`;

    return (
        <View style={c.table}>
            <View style={c.thGroupRow}>
                <View style={[c.thGroupCell, { width: pct(subjectW) }]}><Text style={c.thGroupText}>Subject</Text></View>
                {n > 0 && <View style={[c.thGroupCell, { width: pct(n * paperW) }]}><Text style={c.thGroupText}>Papers</Text></View>}
                <View style={[c.thGroupCell, { width: pct(totalW) }]}><Text style={c.thGroupText}>Total</Text></View>
                <View style={[c.thGroupCell, { width: pct(gradeW + pointsW + rankW) }]}><Text style={c.thGroupText}>Attainment</Text></View>
                <View style={[c.thGroupCell, { flex: 1 }]}><Text style={c.thGroupText}>Remark</Text></View>
            </View>
            <View style={c.thSubRow}>
                <View style={{ width: pct(subjectW) }} />
                {paperCodes.map(code => (
                    <View key={code} style={[c.thSubCell, { width: pct(paperW) }]}><Text style={c.thSubText}>{code}</Text></View>
                ))}
                <View style={[c.thSubCell, { width: pct(totalW) }]}><Text style={c.thSubNote}>out of 100</Text></View>
                <View style={[c.thSubCell, { width: pct(gradeW) }]}><Text style={c.thSubText}>Grade</Text></View>
                <View style={[c.thSubCell, { width: pct(pointsW) }]}><Text style={c.thSubText}>Pts</Text></View>
                <View style={[c.thSubCell, { width: pct(rankW) }]}><Text style={c.thSubText}>Rank</Text></View>
                <View style={{ flex: 1 }} />
            </View>

            {data.subjectMarks.map((sm, i) => (
                <View style={i % 2 === 1 ? c.rowAlt : c.row} key={`${sm.subjectName}-${i}`}>
                    <SubjectCell name={sm.subjectName} width={pct(subjectW)} />
                    <PaperCells papers={sm.paperScores} count={n} width={pct(paperW)} />
                    <View style={[c.cellPad, { width: pct(totalW) }]}>
                        <Text style={c.tdCenterBold}>{sm.percentage != null ? sm.percentage : '—'}</Text>
                    </View>
                    <View style={[c.cellPad, { width: pct(gradeW) }]}>
                        <Text style={[c.bandMark, { color: attainmentColor(sm.percentage) }]}>{sm.grade || '—'}</Text>
                    </View>
                    <View style={[c.cellPad, { width: pct(pointsW) }]}>
                        <Text style={c.tdCenter}>{sm.points ?? '—'}</Text>
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

    return (
        <View style={c.chartRow}>
            {charted.map((m, i) => {
                const p = m.percentage || 0;
                return (
                    <View key={i} style={c.chartCol}>
                        <View style={[c.chartTrack, { height: BAR_H }]}>
                            <View style={[c.chartFill, { height: Math.max(2, (p / 100) * BAR_H), backgroundColor: attainmentColor(p) }]} />
                        </View>
                        <Text style={c.chartPct}>{Math.round(p)}</Text>
                        <Text style={c.chartLabel}>{short(m.subjectName)}</Text>
                    </View>
                );
            })}
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

    const rows: [string, string, string?][] = [
        ['Strongest', `${short(best.subjectName)} · ${Math.round(best.percentage || 0)}%`, attainmentColor(best.percentage)],
        ['Needs focus', `${short(weakest.subjectName)} · ${Math.round(weakest.percentage || 0)}%`, attainmentColor(weakest.percentage)],
        ['At / above mean', `${atOrAbove} of ${marks.length}`],
        ['Class position', data.classRank > 0 ? `${data.classRank} of ${data.totalStudents}` : '—'],
    ];

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
