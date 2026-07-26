import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import { ReportFooter } from './pdf/ReportFooter';
import { T, FONT_BODY, boldFont, displayFont, attainmentColor } from './pdf/pdfTheme';

export interface SubjectStats {
    mean: number;
    highest: number;
    lowest: number;
    studentCount: number;
    /** The class's mean in this subject at the previous round. */
    previousMean?: number;
    /** Who teaches it, when the school records subject assignments. */
    teacher?: string;
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
    /** The single round of exams this sheet describes, e.g. "End Term". */
    examRound?: string;
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
        /** The same learner at the previous round — the sheet's deviation column. */
        previousPercentage?: number;
        previousTotalPoints?: number;
        previousClassRank?: number;
    }[];
    gradeDistribution: Record<string, number>;
    meanGrade: string;
    meanPoints: number;
    /** Class mean percentage this round, and at the round being compared against. */
    classMeanPercentage?: number;
    previousClassMeanPercentage?: number;
    /** Name of that previous round, e.g. "Mid Term". */
    previousExamLabel?: string;
    subjectStats: Record<string, SubjectStats>;
    subjectRankings: SubjectRanking[];
}

/* ── Figures that read as movement ─────────────────────────── */

const signed = (value: number, unit = '') =>
    `${value > 0 ? '+' : value < 0 ? '-' : ''}${Math.abs(value)}${unit}`;

const deltaColor = (value: number) => (value > 0 ? T.green : value < 0 ? T.red : T.muted);

/** "Rachael Ng'ang'a" → "R. Ng'ang'a", clipped so a subject row stays one line. */
function shortTeacher(name?: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    const compact = parts.length > 1 ? `${parts[0].charAt(0)}. ${parts[parts.length - 1]}` : parts[0];
    return compact.length > 12 ? `${compact.slice(0, 11)}.` : compact;
}

const PAGE_X = 22;

/**
 * Class marksheet, typeset in the same design language as the report cards —
 * the product's indigo masthead, primary-blue table bands, Merriweather and
 * Syne — so a class sheet and the cards cut from it read as one document set.
 *
 * It carries the cards' analytics at class scale: every learner's movement
 * since the previous round, every subject's class mean against what that
 * subject scored last time, and who teaches it.
 */
const s = StyleSheet.create({
    page: { padding: 0, paddingBottom: 38, display: 'flex', flexDirection: 'column', fontFamily: FONT_BODY, fontSize: 9, color: T.ink, backgroundColor: T.white },

    /* ── Masthead ── */
    masthead: { backgroundColor: T.indigo, paddingTop: 10, paddingBottom: 8, paddingHorizontal: PAGE_X, flexDirection: 'row', alignItems: 'center' },
    crestFrame: { width: 44, height: 44, borderRadius: 6, backgroundColor: T.white, padding: 3, alignItems: 'center', justifyContent: 'center' },
    crest: { width: 38, height: 38, objectFit: 'contain' },
    crestFallback: { width: 44, height: 44, borderRadius: 6, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
    crestFallbackText: { ...displayFont, fontSize: 17, color: T.white },
    mastheadCenter: { flex: 1, paddingHorizontal: 12 },
    mastheadSchool: { ...displayFont, fontSize: 13.5, color: T.white, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.2 },
    mastheadAddress: { fontSize: 7, color: '#C6CBEC', marginTop: 2.5 },
    mastheadDoc: { fontSize: 7.4, color: '#C6CBEC', textTransform: 'uppercase', letterSpacing: 1.3, marginTop: 3 },
    badge: { borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', paddingVertical: 4, paddingHorizontal: 8, alignItems: 'center', minWidth: 50 },
    badgeLabel: { fontSize: 6, color: '#C6CBEC', textTransform: 'uppercase', letterSpacing: 0.6 },
    badgeValue: { ...boldFont, fontSize: 15, color: T.white, marginTop: 1 },
    accentRule: { height: 3, backgroundColor: T.primary },

    /* ── Info cards ── */
    infoRow: { flexDirection: 'row', gap: 8, paddingHorizontal: PAGE_X, marginTop: 8, marginBottom: 7 },
    infoCard: { flex: 1, borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${T.line}`, backgroundColor: T.white },
    infoCardHead: { backgroundColor: T.surface, paddingVertical: 3, paddingHorizontal: 7, borderBottom: `0.8pt solid ${T.line}` },
    infoCardTitle: { ...boldFont, fontSize: 6.8, color: T.primary, textTransform: 'uppercase', letterSpacing: 0.9 },
    infoCardValue: { ...boldFont, fontSize: 11, color: T.ink, paddingTop: 4, paddingHorizontal: 7, paddingBottom: 2 },
    infoCardDelta: { ...boldFont, fontSize: 6.4, paddingHorizontal: 7, paddingBottom: 4 },

    /* ── Learner table ── */
    table: { marginHorizontal: PAGE_X, borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${T.line}` },
    thGroupRow: { flexDirection: 'row', backgroundColor: T.primary },
    thGroupCell: { paddingVertical: 4, alignItems: 'center', justifyContent: 'center', borderRight: '0.5pt solid rgba(255,255,255,0.3)' },
    thGroupText: { ...boldFont, fontSize: 7, color: T.white, textTransform: 'uppercase', letterSpacing: 0.7 },
    thSubRow: { flexDirection: 'row', backgroundColor: T.primaryDark },
    thSubCell: { paddingVertical: 2.5, alignItems: 'center', justifyContent: 'center', borderRight: '0.5pt solid rgba(255,255,255,0.25)' },
    thSubCellLast: { paddingVertical: 2.5, alignItems: 'center', justifyContent: 'center' },
    thSubText: { ...boldFont, fontSize: 6.4, color: T.white, textAlign: 'center' },

    row: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.5pt solid ${T.line}`, backgroundColor: T.white },
    rowAlt: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.5pt solid ${T.line}`, backgroundColor: T.surfaceSoft },
    rowTop: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.5pt solid ${T.line}`, backgroundColor: T.primarySoft },
    cell: { paddingVertical: 4.5, paddingHorizontal: 2, justifyContent: 'center', borderRight: `0.5pt solid ${T.line}` },
    cellLast: { paddingVertical: 4.5, paddingHorizontal: 2, justifyContent: 'center' },
    posText: { ...boldFont, fontSize: 8.2, color: T.ink, textAlign: 'center' },
    posTextTop: { ...boldFont, fontSize: 8.2, color: T.primary, textAlign: 'center' },
    nameText: { fontSize: 8.4, color: T.ink },
    admText: { fontSize: 6.6, color: T.muted, textAlign: 'center' },
    markText: { fontSize: 8.2, textAlign: 'center' },
    markMissing: { fontSize: 8.2, color: '#C7D0DC', textAlign: 'center' },
    summaryText: { ...boldFont, fontSize: 8.4, color: T.ink, textAlign: 'center' },
    devText: { ...boldFont, fontSize: 7.6, textAlign: 'center' },
    gradeText: { ...boldFont, fontSize: 8.6, textAlign: 'center' },
    meanRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.primarySoft, borderTop: `1pt solid ${T.primary}` },
    meanLabel: { ...boldFont, fontSize: 7.4, color: T.primary, textTransform: 'uppercase', letterSpacing: 0.7, paddingVertical: 4, paddingLeft: 6 },

    /* ── Analytics panels ── */
    analytics: { flexDirection: 'column' },
    panelRow: { flexDirection: 'row', gap: 8, paddingHorizontal: PAGE_X, marginTop: 8 },
    /* Rows spread through a grown panel rather than bunching at the top. */
    listGrow: { flexGrow: 1, justifyContent: 'space-around' },
    panel: { borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${T.line}`, flexDirection: 'column' },
    panelHead: { backgroundColor: T.surface, paddingVertical: 3.5, paddingHorizontal: 7, borderBottom: `0.8pt solid ${T.line}` },
    panelTitle: { ...boldFont, fontSize: 7, color: T.primary, textTransform: 'uppercase', letterSpacing: 0.9 },
    panelBody: { backgroundColor: T.white, paddingVertical: 5, paddingHorizontal: 7, flexGrow: 1 },

    /* Subject analysis rows: name, teacher, mean bar, movement, rank */
    subjRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2.2, borderBottom: `0.5pt solid ${T.line}` },
    subjRowLast: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2.2 },
    subjName: { ...boldFont, fontSize: 7.8, color: T.ink },
    subjTeacher: { fontSize: 5.8, color: T.muted },
    barTrack: { height: 6, backgroundColor: T.surface, borderRadius: 2.5, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 2.5 },
    barScale: { fontSize: 5.8, color: T.muted, textAlign: 'right' },
    subjMean: { ...boldFont, fontSize: 8.4, color: T.ink, textAlign: 'right' },
    subjDelta: { ...boldFont, fontSize: 7, textAlign: 'right' },
    subjRank: { fontSize: 6.8, color: T.muted, textAlign: 'center' },

    /* At a glance */
    statLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3.5, borderBottom: `0.5pt solid ${T.line}` },
    statLineLast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3.5 },
    statKey: { fontSize: 7.2, color: T.muted },
    statVal: { ...boldFont, fontSize: 8, color: T.ink, maxWidth: '62%', textAlign: 'right' },

    /* Grade distribution */
    distRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 },
    distCol: { flex: 1, alignItems: 'center' },
    distTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    distBar: { width: '68%', maxWidth: 13, borderRadius: 1.5 },
    distCount: { ...boldFont, fontSize: 6.4, color: T.ink, marginBottom: 1 },
    distLabel: { ...boldFont, fontSize: 7, marginTop: 2 },

    footerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

/* ── Column widths ─────────────────────────────────────────
   Fixed columns first; every subject shares what is left, so a sheet with
   four subjects and one with nine both fill the page evenly. */
const POS_W = 4.5;
const NAME_W = 17;
const ADM_W = 11;   // "ADM-2026-8736" needs the room
const TOTAL_W = 6.5;
const POINTS_W = 5.5;
const GRADE_W = 6;
const DEV_W = 6;

function subjectColumnWidth(subjectCount: number, isKCSE: boolean, showDev: boolean): number {
    const fixed = POS_W + NAME_W + ADM_W + TOTAL_W + GRADE_W
        + (isKCSE ? POINTS_W : 0) + (showDev ? DEV_W : 0);
    return Math.max(4, (100 - fixed) / Math.max(1, subjectCount));
}

const pct = (v: number) => `${v}%`;

function TableHeader({ data, subjectW, isKCSE, showDev }: {
    data: MarkSheetData; subjectW: number; isKCSE: boolean; showDev: boolean;
}) {
    return (
        <>
            <View style={s.thGroupRow}>
                <View style={[s.thGroupCell, { width: pct(POS_W + NAME_W + ADM_W) }]}>
                    <Text style={s.thGroupText}>Learner</Text>
                </View>
                <View style={[s.thGroupCell, { width: pct(data.subjects.length * subjectW) }]}>
                    <Text style={s.thGroupText}>{isKCSE ? 'Subjects' : 'Learning Areas'}</Text>
                </View>
                <View style={[s.thGroupCell, { flex: 1, borderRight: 'none' }]}>
                    <Text style={s.thGroupText}>Summary</Text>
                </View>
            </View>
            <View style={s.thSubRow}>
                <View style={[s.thSubCell, { width: pct(POS_W) }]}><Text style={s.thSubText}>Pos</Text></View>
                <View style={[s.thSubCell, { width: pct(NAME_W), alignItems: 'flex-start', paddingLeft: 5 }]}>
                    <Text style={s.thSubText}>Name</Text>
                </View>
                <View style={[s.thSubCell, { width: pct(ADM_W) }]}><Text style={s.thSubText}>Adm</Text></View>
                {data.subjects.map(subject => (
                    <View key={subject.code} style={[s.thSubCell, { width: pct(subjectW) }]}>
                        <Text style={s.thSubText}>{subject.code}</Text>
                    </View>
                ))}
                <View style={[s.thSubCell, { width: pct(TOTAL_W) }]}><Text style={s.thSubText}>Mean</Text></View>
                {isKCSE && <View style={[s.thSubCell, { width: pct(POINTS_W) }]}><Text style={s.thSubText}>Pts</Text></View>}
                {showDev && <View style={[s.thSubCell, { width: pct(DEV_W) }]}><Text style={s.thSubText}>Dev.</Text></View>}
                <View style={[s.thSubCellLast, { width: pct(GRADE_W) }]}><Text style={s.thSubText}>Grade</Text></View>
            </View>
        </>
    );
}

function StudentRow({ student, idx, data, subjectW, isKCSE, showDev }: {
    student: MarkSheetData['students'][number]; idx: number; data: MarkSheetData;
    subjectW: number; isKCSE: boolean; showDev: boolean;
}) {
    const isTop3 = student.classRank > 0 && student.classRank <= 3;
    const rowStyle = isTop3 ? s.rowTop : idx % 2 === 1 ? s.rowAlt : s.row;
    const dev = student.previousPercentage != null
        ? Math.round(student.overallPercentage - student.previousPercentage)
        : null;

    return (
        <View style={rowStyle} wrap={false}>
            <View style={[s.cell, { width: pct(POS_W) }]}>
                <Text style={isTop3 ? s.posTextTop : s.posText}>{student.classRank || '—'}</Text>
            </View>
            <View style={[s.cell, { width: pct(NAME_W), paddingLeft: 5 }]}>
                <Text style={s.nameText}>{student.studentName}</Text>
            </View>
            <View style={[s.cell, { width: pct(ADM_W) }]}>
                <Text style={s.admText}>{student.admissionNumber || '—'}</Text>
            </View>
            {data.subjects.map(subject => {
                const value = student.marks[subject.code];
                return (
                    <View key={subject.code} style={[s.cell, { width: pct(subjectW) }]}>
                        {value == null
                            ? <Text style={s.markMissing}>–</Text>
                            : <Text style={[s.markText, { color: attainmentColor(value) }]}>{Math.round(value)}</Text>}
                    </View>
                );
            })}
            <View style={[s.cell, { width: pct(TOTAL_W) }]}>
                <Text style={s.summaryText}>{Math.round(student.overallPercentage)}</Text>
            </View>
            {isKCSE && (
                <View style={[s.cell, { width: pct(POINTS_W) }]}>
                    <Text style={s.summaryText}>{student.totalPoints}</Text>
                </View>
            )}
            {showDev && (
                <View style={[s.cell, { width: pct(DEV_W) }]}>
                    {dev == null
                        ? <Text style={s.markMissing}>–</Text>
                        : <Text style={[s.devText, { color: deltaColor(dev) }]}>{signed(dev)}</Text>}
                </View>
            )}
            <View style={[s.cellLast, { width: pct(GRADE_W) }]}>
                <Text style={[s.gradeText, { color: attainmentColor(student.overallPercentage) }]}>
                    {student.overallGrade || '—'}
                </Text>
            </View>
        </View>
    );
}

/** The class's own row, closing the table the way the cards close theirs. */
function ClassMeanRow({ data, subjectW, isKCSE, showDev, classMean }: {
    data: MarkSheetData; subjectW: number; isKCSE: boolean; showDev: boolean; classMean: number;
}) {
    const dev = data.previousClassMeanPercentage != null
        ? Math.round(classMean - data.previousClassMeanPercentage)
        : null;

    return (
        <View style={s.meanRow}>
            <Text style={[s.meanLabel, { width: pct(POS_W + NAME_W + ADM_W) }]}>Class mean</Text>
            {data.subjects.map(subject => {
                const stat = data.subjectStats[subject.code];
                return (
                    <View key={subject.code} style={[s.cell, { width: pct(subjectW) }]}>
                        <Text style={[s.markText, { color: stat ? attainmentColor(stat.mean) : T.muted }]}>
                            {stat ? stat.mean : '–'}
                        </Text>
                    </View>
                );
            })}
            <View style={[s.cell, { width: pct(TOTAL_W) }]}>
                <Text style={[s.summaryText, { color: T.primary }]}>{Math.round(classMean)}</Text>
            </View>
            {isKCSE && (
                <View style={[s.cell, { width: pct(POINTS_W) }]}>
                    <Text style={[s.summaryText, { color: T.primary }]}>{Math.round(data.meanPoints)}</Text>
                </View>
            )}
            {showDev && (
                <View style={[s.cell, { width: pct(DEV_W) }]}>
                    {dev == null
                        ? <Text style={s.markMissing}>–</Text>
                        : <Text style={[s.devText, { color: deltaColor(dev) }]}>{signed(dev)}</Text>}
                </View>
            )}
            <View style={[s.cellLast, { width: pct(GRADE_W) }]}>
                <Text style={[s.gradeText, { color: attainmentColor(classMean) }]}>{data.meanGrade || '—'}</Text>
            </View>
        </View>
    );
}

function InfoCard({ title, value, delta, deltaSuffix }: {
    title: string; value: string; delta?: number | null; deltaSuffix?: string;
}) {
    return (
        <View style={s.infoCard}>
            <View style={s.infoCardHead}><Text style={s.infoCardTitle}>{title}</Text></View>
            <Text style={s.infoCardValue}>{value}</Text>
            {delta != null && (
                <Text style={[s.infoCardDelta, { color: deltaColor(delta) }]}>
                    {signed(delta)}{deltaSuffix || ''}
                </Text>
            )}
        </View>
    );
}

/** Subject means as bars, with movement since the previous round and rank. */
function SubjectAnalysis({ data }: { data: MarkSheetData }) {
    const ranked = [...data.subjectRankings].sort((a, b) => a.rank - b.rank);
    if (ranked.length === 0) return <Text style={{ fontSize: 6, color: T.muted }}>No subject data.</Text>;

    return (
        <View style={s.listGrow}>
            {ranked.map((subject, i) => {
                const stat = data.subjectStats[subject.code];
                const mean = Number.isFinite(stat?.mean) ? (stat as SubjectStats).mean : (Number.isFinite(subject.mean) ? subject.mean : 0);
                const dev = stat?.previousMean != null ? Math.round(mean - stat.previousMean) : null;
                const name = data.subjects.find(entry => entry.code === subject.code)?.name || subject.code;
                return (
                    <View key={subject.code} style={i === ranked.length - 1 ? s.subjRowLast : s.subjRow}>
                        {/* One text run, not two side by side: as separate
                            elements the teacher's name drew over the subject's. */}
                        <View style={{ width: '44%', paddingRight: 5 }}>
                            <Text style={s.subjName}>
                                {name.length > 14 ? `${name.slice(0, 13)}.` : name}
                                {stat?.teacher ? (
                                    <Text style={s.subjTeacher}>{`  ${shortTeacher(stat.teacher)}`}</Text>
                                ) : null}
                            </Text>
                        </View>
                        <View style={{ flex: 1, paddingRight: 5 }}>
                            <View style={s.barTrack}>
                                <View style={[s.barFill, { width: `${Math.min(100, Math.max(2, mean))}%`, backgroundColor: attainmentColor(mean) }]} />
                            </View>
                        </View>
                        <View style={{ width: '11%' }}>
                            <Text style={s.subjMean}>{mean}</Text>
                        </View>
                        <View style={{ width: '11%' }}>
                            {dev == null
                                ? <Text style={[s.subjDelta, { color: T.muted }]}>–</Text>
                                : <Text style={[s.subjDelta, { color: deltaColor(dev) }]}>{signed(dev)}</Text>}
                        </View>
                        <View style={{ width: '9%' }}>
                            <Text style={s.subjRank}>#{subject.rank}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

/** Colour a grade band the way a mark in that band would be coloured. */
function gradeToApproxPercentage(grade: string): number {
    const base = grade.trim().toUpperCase();
    if (base.startsWith('A') || base === 'EE') return 85;
    if (base.startsWith('B') || base === 'ME') return 68;
    if (base.startsWith('C') || base === 'AE') return 52;
    if (base.startsWith('D')) return 35;
    return 15;
}

/** Grade distribution as a small column chart rather than a list of chips. */
function GradeDistribution({ data }: { data: MarkSheetData }) {
    const entries = Object.entries(data.gradeDistribution);
    if (entries.length === 0) return <Text style={{ fontSize: 6, color: T.muted }}>No grades yet.</Text>;

    const order = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E', 'EE', 'ME', 'AE', 'BE'];
    const sorted = entries.sort(([a], [b]) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
    const peak = Math.max(...sorted.map(([, count]) => count));
    const BAR_H = 34;
    const total = sorted.reduce((sum, [, count]) => sum + count, 0);

    return (
        <View style={s.distRow}>
            {sorted.map(([grade, count]) => {
                const color = attainmentColor(gradeToApproxPercentage(grade));
                return (
                    <View key={grade} style={s.distCol}>
                        <View style={[s.distTrack, { height: BAR_H }]}>
                            <Text style={s.distCount}>{count}</Text>
                            <View style={[s.distBar, { height: Math.max(2, (count / peak) * (BAR_H - 9)), backgroundColor: color }]} />
                        </View>
                        <Text style={[s.distLabel, { color }]}>{grade}</Text>
                        <Text style={{ fontSize: 4.8, color: T.muted }}>
                            {total > 0 ? `${Math.round((count / total) * 100)}%` : ''}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

function AtAGlance({ data, isKCSE, classMean }: { data: MarkSheetData; isKCSE: boolean; classMean: number }) {
    const withMarks = data.students.filter(st => st.overallPercentage > 0);
    const top = [...withMarks].sort((a, b) => (a.classRank || 999) - (b.classRank || 999))[0];
    const aboveMean = withMarks.filter(st => st.overallPercentage >= classMean).length;

    const moved = withMarks
        .filter(st => st.previousPercentage != null)
        .map(st => ({ student: st, change: st.overallPercentage - (st.previousPercentage as number) }));
    const improved = moved.filter(m => m.change > 0).length;
    const mostImproved = [...moved].sort((a, b) => b.change - a.change)[0];

    const best = [...data.subjectRankings].sort((a, b) => b.mean - a.mean)[0];
    const weakest = [...data.subjectRankings].sort((a, b) => a.mean - b.mean)[0];
    const short = (name: string, limit = 16) => (name.length > limit ? `${name.slice(0, limit - 1)}.` : name);

    const rows: [string, string, string?][] = [
        ['Entered', `${withMarks.length} of ${data.students.length}`],
        ['Class mean', `${Math.round(classMean)}%${data.meanGrade && !/^[-–—]$/.test(data.meanGrade) ? ` · ${data.meanGrade}` : ''}`, attainmentColor(classMean)],
    ];
    if (isKCSE) rows.push(['Mean points', `${data.meanPoints}`]);
    if (top) rows.push(['Top', `${short(top.studentName, 14)} · ${Math.round(top.overallPercentage)}%`, attainmentColor(top.overallPercentage)]);
    rows.push(['At / above mean', `${aboveMean} of ${withMarks.length}`]);
    if (best) rows.push(['Strongest', `${best.code} · ${best.mean}%`, attainmentColor(best.mean)]);
    if (weakest && data.subjectRankings.length > 1) {
        rows.push(['Weakest', `${weakest.code} · ${weakest.mean}%`, attainmentColor(weakest.mean)]);
    }
    if (data.previousClassMeanPercentage != null) {
        const change = Math.round(classMean - data.previousClassMeanPercentage);
        rows.push([`Mean vs ${data.previousExamLabel || 'last exam'}`, signed(change, '%'), deltaColor(change)]);
    }
    if (moved.length > 0) rows.push(['Improved', `${improved} of ${moved.length}`]);
    if (mostImproved && mostImproved.change > 0) {
        rows.push(['Top gain', `${short(mostImproved.student.studentName, 13)} · ${signed(Math.round(mostImproved.change))}`, T.green]);
    }

    return (
        <View style={s.listGrow}>
            {rows.map(([key, value, color], i) => (
                <View key={key} style={i === rows.length - 1 ? s.statLineLast : s.statLine}>
                    <Text style={s.statKey}>{key}</Text>
                    <Text style={[s.statVal, color ? { color } : {}]}>{value}</Text>
                </View>
            ))}
        </View>
    );
}

/* ── Pagination ────────────────────────────────────────────
   Measured in points rather than row counts, because how much room the
   analytics need depends on how many subjects the class sits. The masthead
   prints on the first page only, so that page holds fewer rows; the analytics
   ride on the last page whenever the space left there can hold them. */
const PAGE_H = 842;          // A4 portrait
const FOOTER_H = 46;         // the fixed footer band
const ROW_H = 20.5;          // one learner row
const TABLE_HEAD_H = 28;     // group + sub header
const MEAN_ROW_H = 21;       // the closing class-mean row
const FIRST_PAGE_CHROME = 136;  // masthead + rule + info cards + margins (measured)
const OTHER_PAGE_CHROME = 14;

/** Height the analytics band needs for this class, panel heads included. */
function analyticsHeight(data: MarkSheetData, glanceRows: number): number {
    const PANEL_CHROME = 38;                  // head + body padding
    const subjectPanel = PANEL_CHROME + data.subjectRankings.length * 14.5;
    const glancePanel = PANEL_CHROME + glanceRows * 15;
    const distributionPanel = PANEL_CHROME + 60;
    return 8 + Math.max(subjectPanel, glancePanel, distributionPanel);
}

/**
 * Fill each page before starting the next, so the table runs to the foot of
 * the sheet with only a margin under it.
 *
 * An earlier version balanced the rows evenly across pages, which left a band
 * of white at the bottom of every one. A class list is read down the page, so
 * a full first sheet and a shorter last one is what a school expects.
 * The analytics band rides under the final table when the room is there, and
 * takes a page of its own only when it isn't.
 */
function paginate<T>(students: T[], analytics: number) {
    const usable = PAGE_H - FOOTER_H;
    const room = (chrome: number, reserve = 0) =>
        Math.max(1, Math.floor((usable - chrome - TABLE_HEAD_H - reserve) / ROW_H));

    const firstCapacity = room(FIRST_PAGE_CHROME);
    const otherCapacity = room(OTHER_PAGE_CHROME);
    const analyticsLoad = MEAN_ROW_H + analytics;

    const pages: T[][] = [students.slice(0, firstCapacity)];
    for (let i = firstCapacity; i < students.length; i += otherCapacity) {
        pages.push(students.slice(i, i + otherCapacity));
    }
    const filled = pages.filter(page => page.length > 0);
    const lastPages = filled.length > 0 ? filled : [[] as T[]];

    // Does the final page still have room for the band beneath its rows?
    const last = lastPages[lastPages.length - 1];
    const chrome = lastPages.length === 1 ? FIRST_PAGE_CHROME : OTHER_PAGE_CHROME;
    const spare = usable - (chrome + TABLE_HEAD_H + last.length * ROW_H + analyticsLoad);

    // The band rides under the final table when the room is there; when it
    // isn't it takes a page of its own. Pulling rows off the full page to make
    // space for it only moved the white space back to page one, which is the
    // thing a class list must not have.
    return { pages: lastPages, summaryOnOwnPage: spare < 0 };
}

function Analytics({ data, isKCSE, classMean, fill }: {
    data: MarkSheetData; isKCSE: boolean; classMean: number; fill: boolean;
}) {
    // Three panels in one band: stacking them left a strip of white between
    // the table and the foot of the sheet. On a page of its own they grow to
    // fill it, since nothing follows them there.
    return (
        <View style={[s.panelRow, fill ? { marginTop: 14 } : {}]} wrap={false}>
            <View style={[s.panel, { flex: 1.5 }]}>
                <View style={s.panelHead}><Text style={s.panelTitle}>Subject Performance</Text></View>
                <View style={s.panelBody}><SubjectAnalysis data={data} /></View>
            </View>
            <View style={[s.panel, { flex: 1 }]}>
                <View style={s.panelHead}><Text style={s.panelTitle}>At a Glance</Text></View>
                <View style={s.panelBody}><AtAGlance data={data} isKCSE={isKCSE} classMean={classMean} /></View>
            </View>
            <View style={[s.panel, { flex: 0.72 }]}>
                <View style={s.panelHead}><Text style={s.panelTitle}>Grades</Text></View>
                <View style={[s.panelBody, { justifyContent: 'center' }]}><GradeDistribution data={data} /></View>
            </View>
        </View>
    );
}

export function MarkSheetDocument({ data }: { data: MarkSheetData }) {
    const isKCSE = data.gradingSystemType === 'KCSE';
    const showDev = data.students.some(st => st.previousPercentage != null);
    const subjectW = subjectColumnWidth(data.subjects.length, isKCSE, showDev);
    const sorted = [...data.students].sort((a, b) => (a.classRank || 999) - (b.classRank || 999));
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    // Rows "At a glance" will print, so the space estimate matches reality.
    const glanceRows = 3
        + (isKCSE ? 1 : 0)
        + (sorted.length > 0 ? 1 : 0)
        + (data.subjectRankings.length > 0 ? 1 : 0)
        + (data.subjectRankings.length > 1 ? 1 : 0)
        + (data.previousClassMeanPercentage != null ? 1 : 0)
        + (data.students.some(st => st.previousPercentage != null) ? 2 : 0);
    const { pages, summaryOnOwnPage } = paginate(sorted, analyticsHeight(data, glanceRows));

    const classMean = data.classMeanPercentage
        ?? (sorted.reduce((sum, st) => sum + st.overallPercentage, 0) / Math.max(1, sorted.length));
    const meanDelta = data.previousClassMeanPercentage != null
        ? Math.round(classMean - data.previousClassMeanPercentage)
        : null;

    return (
        <Document>
            {pages.map((pageStudents, pageIndex) => {
                const isFirst = pageIndex === 0;
                const isLast = pageIndex === pages.length - 1;
                return (
                    <Page key={`page-${pageIndex}`} size="A4" orientation="portrait" style={s.page}>
                        <View style={s.footerWrap} fixed><ReportFooter generatedOn={today} /></View>

                        {isFirst && (
                            <>
                                <View style={s.masthead}>
                                    {data.schoolLogoUrl ? (
                                        <View style={s.crestFrame}><Image style={s.crest} src={data.schoolLogoUrl} /></View>
                                    ) : (
                                        <View style={s.crestFallback}>
                                            <Text style={s.crestFallbackText}>
                                                {(data.schoolName || 'S').trim().charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={s.mastheadCenter}>
                                        <Text style={s.mastheadSchool}>{data.schoolName}</Text>
                                        {data.schoolAddress && <Text style={s.mastheadAddress}>{data.schoolAddress}</Text>}
                                        <Text style={s.mastheadDoc}>
                                            Class Marksheet · {data.examTitle}{data.examRound ? ` ${data.examRound}` : ''} · {data.academicYear}
                                        </Text>
                                    </View>
                                    <View style={s.badge}>
                                        <Text style={s.badgeLabel}>Class Mean</Text>
                                        <Text style={s.badgeValue}>{Math.round(classMean)}%</Text>
                                    </View>
                                </View>
                                <View style={s.accentRule} />
                                <View style={s.infoRow}>
                                    <InfoCard title="Class" value={data.className} />
                                    <InfoCard title="Learners" value={`${data.students.length}`} />
                                    <InfoCard
                                        title={isKCSE ? 'Mean Points' : 'Mean Score'}
                                        value={isKCSE ? `${data.meanPoints}` : `${Math.round(classMean)}%`}
                                    />
                                    <InfoCard
                                        title="Mean Grade"
                                        value={data.meanGrade || '—'}
                                        delta={meanDelta}
                                        deltaSuffix={data.previousExamLabel ? `% vs ${data.previousExamLabel}` : '%'}
                                    />
                                </View>
                            </>
                        )}

                        <View style={[s.table, isFirst ? {} : { marginTop: 14 }]}>
                            <TableHeader data={data} subjectW={subjectW} isKCSE={isKCSE} showDev={showDev} />
                            {pageStudents.map((student, idx) => (
                                <StudentRow
                                    key={`${student.admissionNumber || student.studentName}-${pageIndex}-${idx}`}
                                    student={student} idx={idx} data={data}
                                    subjectW={subjectW} isKCSE={isKCSE} showDev={showDev}
                                />
                            ))}
                            {isLast && (
                                <ClassMeanRow data={data} subjectW={subjectW} isKCSE={isKCSE} showDev={showDev} classMean={classMean} />
                            )}
                        </View>

                        {isLast && !summaryOnOwnPage && <Analytics data={data} isKCSE={isKCSE} classMean={classMean} fill={false} />}
                    </Page>
                );
            })}

            {summaryOnOwnPage && (
                <Page size="A4" orientation="portrait" style={[s.page, { paddingTop: 18 }]}>
                    <View style={s.footerWrap} fixed><ReportFooter generatedOn={today} /></View>
                    <Analytics data={data} isKCSE={isKCSE} classMean={classMean} fill />
                </Page>
            )}
        </Document>
    );
}

export async function generateMarkSheetPDF(data: MarkSheetData): Promise<Buffer> {
    const buffer = await renderToBuffer(<MarkSheetDocument data={data} />);
    return Buffer.from(buffer);
}
