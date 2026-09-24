import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { gradeSymbolFromScales, gradeSymbolRank } from '@/lib/analytics';
import type { GradeBand } from '@/types';
import { FONTS } from './pdf/pdfTheme';
import { Crest, BrandFooter } from './pdf/primitives';
import { signed, shortName, firstWords } from './pdf/reportModel';
import { planPages, type PageDimensions } from './pdf/marksheetPagination';
import { abbreviateSubject } from './subject-abbreviations';

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
    /** The school's grading bands, so every mark can print its grade beside it. */
    gradeBands?: GradeBand[];
}

type Learner = MarkSheetData['students'][number];

/* ── Look ──────────────────────────────────────────────────────
   Landscape A4, in the Heritage family's navy and gold, so a class sheet and
   the cards cut from it read as one document set. */
const C = {
    navy: '#0B1F3A',
    navy2: '#16325A',
    navyLine: '#1E3A5F',
    gold: '#B8893A',
    goldText: '#C9B27A',
    cream: '#E9D3A0',
    ink: '#0F172A',
    body: '#334155',
    muted: '#64748B',
    faint: '#94A3B8',
    line: '#E5E9F0',
    lineSoft: '#F0F2F6',
    zebra: '#F8FAFC',
    summary: '#F1F5F9',
    hiBg: '#E3F4EA',
    hiText: '#14532D',
    loBg: '#FCE8E8',
    loText: '#991B1B',
    up: '#15803D',
    down: '#B91C1C',
    bar: '#1E4E8C',
    track: '#EEF2F7',
} as const;

const MEDAL = ['#C9A227', '#94A3B8', '#B87333'] as const;

/** One colour per grade, best to worst, so a grade looks the same on every sheet. */
const KCSE_TONES: Record<string, string> = {
    'A': '#14532D', 'A-': '#15803D', 'B+': '#1E4E8C', 'B': '#2563EB', 'B-': '#60A5FA', 'C+': '#B8893A',
    'C': '#D4A24C', 'C-': '#E8C27A', 'D+': '#EA580C', 'D': '#DC2626', 'D-': '#991B1B', 'E': '#7F1D1D',
};
const CBC_TONES: Record<string, string> = { EE: '#15803D', ME: '#2563EB', AE: '#D4A24C', BE: '#DC2626' };

/**
 * Sort key for a grade. The shared ranking knows CBC sub-levels (EE1…BE2) and
 * 8-4-4 letters; a bare CBC level (EE) sorts with its first sub-level.
 */
const gradeOrder = (g: string) => gradeSymbolRank(/^(EE|ME|AE|BE)$/i.test(g.trim()) ? `${g.trim()}1` : g);

function gradeTone(g: string): string {
    const symbol = g.trim().toUpperCase();
    return KCSE_TONES[symbol] ?? CBC_TONES[symbol.slice(0, 2)] ?? '#64748B';
}

const font = FONTS.inter;
const PAGE_W = 842;
const PAGE_H = 595;
const X = 18;

/* Fixed heights — the pagination plan is exact because of them. */
const H = {
    masthead: 52,
    kpis: 38,
    firstGap: 8,
    slim: 28,
    groupHead: 11,
    colHead: 20,
    row: 14.5,
    statRow: 13.5,
    legend: 13,
    footer: 26,
    panelHead: 24,
    panelRow: 10.2,
    signature: 30,
    summaryGap: 10,
} as const;

const s = StyleSheet.create({
    page: { fontFamily: font, color: C.ink, backgroundColor: '#FFFFFF', paddingHorizontal: X, paddingBottom: H.footer },
    footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },

    masthead: { height: H.masthead, flexDirection: 'row', alignItems: 'center', borderBottom: `1.5pt solid ${C.navy}` },
    school: { fontFamily: FONTS.playfair, fontWeight: 700, fontSize: 15.5, color: C.navy },
    address: { fontSize: 6.8, color: C.muted, marginTop: 1.5 },
    doc: { marginLeft: 'auto', alignItems: 'flex-end' },
    tag: { backgroundColor: C.gold, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 3 },
    tagText: { fontWeight: 700, fontSize: 6, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 },
    docTitle: { fontWeight: 800, fontSize: 9.8, color: C.navy },
    docSub: { fontSize: 7, color: C.muted, marginTop: 1 },

    kpis: { height: H.kpis, flexDirection: 'row', marginTop: H.firstGap, border: `0.75pt solid #E2E8F0`, borderRadius: 6 },
    kpi: { flex: 1, paddingHorizontal: 9, justifyContent: 'center', borderLeft: `0.75pt solid #E2E8F0` },
    kpiLabel: { fontWeight: 700, fontSize: 5.6, textTransform: 'uppercase', letterSpacing: 0.8, color: C.muted },
    kpiValue: { fontWeight: 800, fontSize: 12.8, color: C.navy, marginTop: 1 },
    kpiUnit: { fontWeight: 600, fontSize: 7.5, color: C.faint },

    slim: { height: H.slim, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1.5pt solid ${C.navy}` },
    slimSchool: { fontFamily: FONTS.playfair, fontWeight: 700, fontSize: 10.5, color: C.navy },
    slimText: { fontSize: 7.5, color: C.muted },

    table: { marginTop: 6 },
    groupRow: { height: H.groupHead, flexDirection: 'row', backgroundColor: C.navy2 },
    groupText: { fontWeight: 700, fontSize: 5.3, color: '#D5DEEA', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
    headRow: { height: H.colHead, flexDirection: 'row', backgroundColor: C.navy },
    head: { justifyContent: 'center', alignItems: 'center', borderRight: `0.75pt solid ${C.navyLine}` },
    headText: { fontWeight: 700, fontSize: 6, color: '#FFFFFF', textAlign: 'center' },
    headSub: { fontSize: 4.9, color: '#9FB0C8', textAlign: 'center', marginTop: 0.5 },

    row: { flexDirection: 'row', borderBottom: `0.75pt solid ${C.line}` },
    cell: { justifyContent: 'center', alignItems: 'center', borderRight: `0.75pt solid ${C.lineSoft}` },
    pos: { fontWeight: 700, fontSize: 7.2, color: C.body },
    medal: { width: 12.5, height: 12.5, borderRadius: 6.25, alignItems: 'center', justifyContent: 'center' },
    medalText: { fontWeight: 800, fontSize: 6.8, color: '#FFFFFF' },
    name: { fontWeight: 600, fontSize: 7.2, maxLines: 1, textOverflow: 'ellipsis' },
    adm: { fontSize: 6.2, color: C.muted, maxLines: 1 },
    mark: { fontSize: 7.2 },
    markGrade: { fontWeight: 600, fontSize: 5.2, color: C.faint },
    none: { fontSize: 7.2, color: '#CBD5E1' },
    sumText: { fontWeight: 700, fontSize: 7.2 },

    stat: { height: H.statRow, flexDirection: 'row', borderBottom: `0.75pt solid #E2E8F0` },
    statLabel: { fontWeight: 700, fontSize: 5.6, letterSpacing: 0.75, textTransform: 'uppercase', color: '#475569', textAlign: 'right', paddingRight: 7.5 },
    statText: { fontSize: 6.8, textAlign: 'center' },

    legend: { height: H.legend, flexDirection: 'row', alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 10.5 },
    legendText: { fontSize: 6, color: C.muted },
    swatch: { width: 10.5, height: 6.8, borderRadius: 1.5, marginRight: 3 },

    panels: { flexDirection: 'row', marginTop: H.summaryGap },
    panel: { border: `0.75pt solid #E2E8F0`, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 9 },
    panelTitle: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    h3: { fontWeight: 800, fontSize: 5.9, textTransform: 'uppercase', letterSpacing: 1, color: C.navy },
    h3Note: { fontSize: 5.6, color: C.faint },
    rank: { height: H.panelRow, flexDirection: 'row', alignItems: 'center' },
    rankName: { width: 78, fontSize: 6.4, maxLines: 1 },
    rankTrack: { flex: 1, height: 5.2, borderRadius: 3, backgroundColor: C.track, position: 'relative', marginHorizontal: 4.5 },
    rankFill: { height: 5.2, borderRadius: 3, backgroundColor: C.bar },
    rankTick: { position: 'absolute', top: -1.5, width: 1.5, height: 8.2, backgroundColor: C.gold },
    rankMean: { width: 14, fontWeight: 700, fontSize: 6.4, textAlign: 'right' },
    rankDelta: { width: 18, fontWeight: 700, fontSize: 6, textAlign: 'right' },
    dist: { flexDirection: 'row', height: 16.5, borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
    distSeg: { alignItems: 'center', justifyContent: 'center' },
    distText: { fontWeight: 700, fontSize: 6.4, color: '#FFFFFF' },
    legendGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    gradeKey: { width: '16.66%', flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    gradeKeyText: { fontSize: 6.4, color: C.muted },
    passValue: { fontWeight: 800, fontSize: 18, color: C.navy },
    li: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 12, borderBottom: `0.75pt dashed #E2E8F0` },
    liText: { fontSize: 6.8, maxLines: 1 },
    liNo: { fontSize: 6.8, color: C.faint, width: 11 },

    signs: { height: H.signature, flexDirection: 'row', alignItems: 'flex-end' },
    sign: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', borderTop: `0.75pt solid ${C.body}`, paddingTop: 2.5 },
    signText: { fontSize: 5.8, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.75 },
});

/* ── Columns ──────────────────────────────────────────────── */

interface Columns {
    pos: number; name: number; adm: number; subject: number;
    total: number; mean: number; pts: number; grade: number; dev: number;
}

const CONTENT_W = PAGE_W - 2 * X;

function columnWidths(subjectCount: number, isKCSE: boolean, showDev: boolean): Columns {
    const fixed = { pos: 25, adm: 62, total: 34, mean: 30, pts: isKCSE ? 27 : 0, grade: 28, dev: showDev ? 27 : 0 };
    // The name keeps a generous column; subjects share whatever is left, and
    // the name gives some back only when a very wide timetable needs it.
    let name = 120;
    const rest = () => CONTENT_W - name - Object.values(fixed).reduce((a, b) => a + b, 0);
    const minSubject = 30;
    if (rest() / Math.max(1, subjectCount) < minSubject) name = Math.max(90, name - (minSubject * subjectCount - rest()));
    return { ...fixed, name, subject: rest() / Math.max(1, subjectCount) };
}

/* ── Helpers ─────────────────────────────────────────────── */

const gradeOf = (bands: GradeBand[] | undefined, pct: number) => gradeSymbolFromScales(pct, bands) ?? '';
const roundLabel = (d: MarkSheetData) => `${d.examTitle}${d.examRound ? ` ${d.examRound}` : ''} ${d.academicYear}`;

/** The pass line: C+ and above in 8-4-4, Meeting Expectations and above in CBC. */
function passes(grade: string, isKCSE: boolean): boolean {
    return gradeOrder(grade) <= gradeOrder(isKCSE ? 'C+' : 'ME2');
}

function learnerTotal(d: MarkSheetData, st: Learner) {
    const marks = d.subjects.map(sub => st.marks[sub.code]).filter((v): v is number => v != null);
    return { total: Math.round(marks.reduce((a, b) => a + b, 0)), sat: marks.length };
}

/* ── Header pieces ───────────────────────────────────────── */

function Masthead({ d }: { d: MarkSheetData }) {
    return (
        <View style={s.masthead}>
            <Crest logo={d.schoolLogoUrl} initial={(d.schoolName || 'S').trim().charAt(0).toUpperCase()} size={34} background={C.navy} color={C.cream} fontFamily={FONTS.playfair} ring={{ color: C.gold, gap: 1.2, width: 0.8 }} />
            <View style={{ marginLeft: 10 }}>
                <Text style={s.school}>{d.schoolName}</Text>
                {d.schoolAddress && <Text style={s.address}>{d.schoolAddress}</Text>}
            </View>
            <View style={s.doc}>
                <View style={s.tag}><Text style={s.tagText}>Class mark sheet</Text></View>
                <Text style={s.docTitle}>{d.className} · {roundLabel(d)}</Text>
                <Text style={s.docSub}>
                    Ranked by {d.gradingSystemType === 'KCSE' ? 'total points' : 'mean score'} · {d.gradingSystemType === 'KCSE' ? 'KCSE 12-point scale' : 'CBC competency levels'}
                </Text>
            </View>
        </View>
    );
}

function Kpis({ d, classMean, ranked }: { d: MarkSheetData; classMean: number; ranked: Learner[] }) {
    const isKCSE = d.gradingSystemType === 'KCSE';
    const delta = d.previousClassMeanPercentage != null ? Math.round(classMean - d.previousClassMeanPercentage) : null;
    const entered = d.students.filter(st => d.subjects.every(sub => st.marks[sub.code] != null)).length;
    const top = ranked[0];
    const best = [...d.subjectRankings].sort((a, b) => a.rank - b.rank)[0];
    const bestName = best ? d.subjects.find(sub => sub.code === best.code)?.name ?? best.code : undefined;
    const items: { label: string; value: string; unit?: string; note?: React.ReactNode; dark?: boolean }[] = [
        {
            label: 'Class mean', value: `${Math.round(classMean)}%`, dark: true,
            note: delta != null ? <Text style={{ fontWeight: 700, fontSize: 6.8, color: '#86EFAC' }}>  {signed(delta)} vs {d.previousExamLabel || 'last exam'}</Text> : undefined,
        },
        { label: isKCSE ? 'Mean grade' : 'Mean level', value: d.meanGrade || '-' },
        isKCSE ? { label: 'Mean points', value: `${d.meanPoints}` } : { label: 'Subjects', value: `${d.subjects.length}` },
        { label: 'Learners', value: `${d.students.length}`, unit: entered < d.students.length ? `  ${entered} with every mark` : '  all marks entered' },
    ];
    // Names can be long, so they keep one line and their figure rides in the label.
    if (top) items.push({ label: `Top learner · ${Math.round(top.overallPercentage)}%`, value: firstWords(top.studentName) });
    if (best && bestName) items.push({ label: `Best ${isKCSE ? 'subject' : 'area'} · ${best.mean}%`, value: bestName });
    return (
        <View style={s.kpis}>
            {items.map((k, i) => (
                <View key={k.label} style={[s.kpi, i === 0 ? { borderLeftWidth: 0, backgroundColor: C.navy, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 } : {}]}>
                    <Text style={[s.kpiLabel, k.dark ? { color: C.goldText } : {}]}>{k.label}</Text>
                    <Text style={[s.kpiValue, k.dark ? { color: '#FFFFFF' } : {}, k.value.length > 14 ? { fontSize: 9.8 } : {}, { maxLines: 1, textOverflow: 'ellipsis' }]}>
                        {k.value}{k.unit ? <Text style={s.kpiUnit}>{k.unit}</Text> : null}{k.note ?? null}
                    </Text>
                </View>
            ))}
        </View>
    );
}

function SlimHeader({ d, page, pages }: { d: MarkSheetData; page: number; pages: number }) {
    return (
        <View style={s.slim}>
            <Text style={s.slimText}><Text style={s.slimSchool}>{d.schoolName}</Text>   Class mark sheet · {d.className} · {roundLabel(d)}</Text>
            <Text style={s.slimText}>Page {page} of {pages}</Text>
        </View>
    );
}

/* ── Table ───────────────────────────────────────────────── */

function TableHead({ d, w, isKCSE, showDev }: { d: MarkSheetData; w: Columns; isKCSE: boolean; showDev: boolean }) {
    const summaryW = w.total + w.mean + w.pts + w.grade + w.dev;
    const sep: Style = { borderLeft: `1.5pt solid ${C.navy}` };
    return (
        <>
            <View style={s.groupRow}>
                <View style={{ width: w.pos + w.name + w.adm, justifyContent: 'center' }}><Text style={s.groupText}>Learner</Text></View>
                <View style={{ width: w.subject * d.subjects.length, justifyContent: 'center', borderLeft: `1.5pt solid ${C.navy}` }}>
                    <Text style={s.groupText}>{isKCSE ? 'Subjects' : 'Learning areas'} · mark &amp; {isKCSE ? 'grade' : 'level'}</Text>
                </View>
                <View style={{ width: summaryW, justifyContent: 'center', borderLeft: `1.5pt solid ${C.navy}` }}><Text style={s.groupText}>Summary</Text></View>
            </View>
            <View style={s.headRow}>
                <View style={[s.head, { width: w.pos }]}><Text style={s.headText}>Pos</Text></View>
                <View style={[s.head, { width: w.name, alignItems: 'flex-start', paddingLeft: 6 }]}><Text style={s.headText}>Name</Text></View>
                <View style={[s.head, { width: w.adm }]}><Text style={s.headText}>Adm No.</Text></View>
                {d.subjects.map((sub, i) => (
                    <View key={sub.code} style={[s.head, { width: w.subject }, i === 0 ? sep : {}]}>
                        <Text style={s.headText}>{abbreviateSubject(sub.name, sub.code)}</Text>
                        {sub.code && sub.code !== sub.name && <Text style={s.headSub}>{sub.code}</Text>}
                    </View>
                ))}
                <View style={[s.head, { width: w.total }, sep]}><Text style={s.headText}>Total</Text><Text style={s.headSub}>/{d.subjects.length * 100}</Text></View>
                <View style={[s.head, { width: w.mean }]}><Text style={s.headText}>Mean</Text><Text style={s.headSub}>%</Text></View>
                {isKCSE && <View style={[s.head, { width: w.pts }]}><Text style={s.headText}>Pts</Text></View>}
                <View style={[s.head, { width: w.grade }]}><Text style={s.headText}>{isKCSE ? 'Grade' : 'Level'}</Text></View>
                {showDev && <View style={[s.head, { width: w.dev, borderRightWidth: 0 }]}><Text style={s.headText}>Change</Text><Text style={s.headSub}>vs {d.previousExamLabel || 'last'}</Text></View>}
            </View>
        </>
    );
}

function LearnerRow({ d, st, index, w, height, isKCSE, showDev }: {
    d: MarkSheetData; st: Learner; index: number; w: Columns; height: number; isKCSE: boolean; showDev: boolean;
}) {
    const zebra: Style = index % 2 === 1 ? { backgroundColor: C.zebra } : {};
    const sep: Style = { borderLeft: `1.5pt solid ${C.navy}` };
    const sum: Style = { backgroundColor: C.summary, borderRight: `0.75pt solid #E2E8F0` };
    const medal = st.classRank >= 1 && st.classRank <= 3 ? MEDAL[st.classRank - 1] : undefined;
    const { total } = learnerTotal(d, st);
    const dev = st.previousPercentage != null ? Math.round(st.overallPercentage - st.previousPercentage) : null;
    return (
        <View style={[s.row, { height }, zebra]} wrap={false}>
            <View style={[s.cell, { width: w.pos }]}>
                {medal
                    ? <View style={[s.medal, { backgroundColor: medal }]}><Text style={s.medalText}>{st.classRank}</Text></View>
                    : <Text style={s.pos}>{st.classRank || '-'}</Text>}
            </View>
            <View style={[s.cell, { width: w.name, alignItems: 'flex-start', paddingLeft: 6, paddingRight: 3 }]}><Text style={s.name}>{st.studentName}</Text></View>
            <View style={[s.cell, { width: w.adm }]}><Text style={s.adm}>{st.admissionNumber || '-'}</Text></View>
            {d.subjects.map((sub, i) => {
                const v = st.marks[sub.code];
                if (v == null) return <View key={sub.code} style={[s.cell, { width: w.subject }, i === 0 ? sep : {}]}><Text style={s.none}>–</Text></View>;
                const mark = Math.round(v);
                const tone: Style = mark >= 80 ? { backgroundColor: C.hiBg } : mark < 40 ? { backgroundColor: C.loBg } : {};
                const color = mark >= 80 ? C.hiText : mark < 40 ? C.loText : C.ink;
                const grade = gradeOf(d.gradeBands, mark);
                return (
                    <View key={sub.code} style={[s.cell, { width: w.subject }, tone, i === 0 ? sep : {}]}>
                        <Text style={[s.mark, { color, fontWeight: tone.backgroundColor ? 600 : 400 }]}>
                            {mark}{grade ? <Text style={s.markGrade}> {grade}</Text> : null}
                        </Text>
                    </View>
                );
            })}
            <View style={[s.cell, { width: w.total }, sum, sep]}><Text style={s.sumText}>{total}</Text></View>
            <View style={[s.cell, { width: w.mean }, sum]}><Text style={s.sumText}>{Math.round(st.overallPercentage)}</Text></View>
            {isKCSE && <View style={[s.cell, { width: w.pts }, sum]}><Text style={s.sumText}>{st.totalPoints}</Text></View>}
            <View style={[s.cell, { width: w.grade }]}><Text style={[s.sumText, { fontWeight: 800, color: C.navy }]}>{st.overallGrade || '-'}</Text></View>
            {showDev && (
                <View style={[s.cell, { width: w.dev, borderRightWidth: 0 }]}>
                    {dev == null ? <Text style={s.none}>–</Text>
                        : <Text style={[s.sumText, { color: dev > 0 ? C.up : dev < 0 ? C.down : C.muted }]}>{signed(dev)}</Text>}
                </View>
            )}
        </View>
    );
}

/** Per-subject statistics under the last learner row. */
function StatRows({ d, w, isKCSE, showDev, classMean }: { d: MarkSheetData; w: Columns; isKCSE: boolean; showDev: boolean; classMean: number }) {
    const summaryW = w.total + w.mean + w.pts + w.grade + w.dev;
    const labelW = w.pos + w.name + w.adm;
    const sep: Style = { borderLeft: `1.5pt solid ${C.navy}` };
    const stat = (code: string) => d.subjectStats[code];
    const hasPrevious = d.subjects.some(sub => stat(sub.code)?.previousMean != null);
    const hasTeacher = d.subjects.some(sub => stat(sub.code)?.teacher);
    const rankOf = (code: string) => d.subjectRankings.find(r => r.code === code)?.rank;
    const classDelta = d.previousClassMeanPercentage != null ? Math.round(classMean - d.previousClassMeanPercentage) : null;

    const line = (label: string, render: (code: string) => React.ReactNode, style: Style = {}) => (
        <View style={[s.stat, style]}>
            <View style={{ width: labelW, justifyContent: 'center' }}><Text style={s.statLabel}>{label}</Text></View>
            {d.subjects.map((sub, i) => (
                <View key={sub.code} style={[s.cell, { width: w.subject, borderRightWidth: 0 }, i === 0 ? sep : {}]}>{render(sub.code)}</View>
            ))}
            <View style={[{ width: summaryW }, sep]} />
        </View>
    );

    return (
        <>
            <View style={[s.stat, { backgroundColor: C.navy, borderBottomWidth: 0 }]}>
                <View style={{ width: labelW, justifyContent: 'center' }}><Text style={[s.statLabel, { color: C.cream, fontSize: 6.4 }]}>{isKCSE ? 'Subject mean' : 'Learning area mean'}</Text></View>
                {d.subjects.map((sub, i) => {
                    const mean = stat(sub.code)?.mean;
                    const g = mean != null ? gradeOf(d.gradeBands, mean) : '';
                    return (
                        <View key={sub.code} style={[s.cell, { width: w.subject, borderRightWidth: 0 }, i === 0 ? sep : {}]}>
                            <Text style={[s.statText, { color: '#FFFFFF', fontWeight: 800 }]}>{mean ?? '-'}{g ? <Text style={{ fontSize: 5.2, color: C.goldText }}> {g}</Text> : null}</Text>
                        </View>
                    );
                })}
                <View style={[{ width: w.total }, sep]} />
                <View style={[s.cell, { width: w.mean, borderRightWidth: 0 }]}><Text style={[s.statText, { color: '#FFFFFF', fontWeight: 800 }]}>{Math.round(classMean)}</Text></View>
                {isKCSE && <View style={[s.cell, { width: w.pts, borderRightWidth: 0 }]}><Text style={[s.statText, { color: '#FFFFFF', fontWeight: 800 }]}>{Math.round(d.meanPoints)}</Text></View>}
                <View style={[s.cell, { width: w.grade, borderRightWidth: 0 }]}><Text style={[s.statText, { color: '#FFFFFF', fontWeight: 800 }]}>{d.meanGrade || '-'}</Text></View>
                {showDev && <View style={[s.cell, { width: w.dev, borderRightWidth: 0 }]}><Text style={[s.statText, { color: '#86EFAC', fontWeight: 800 }]}>{classDelta != null ? signed(classDelta) : ''}</Text></View>}
            </View>
            {hasPrevious && line(`vs ${d.previousExamLabel || 'last exam'}`, code => {
                const st = stat(code);
                if (st?.previousMean == null) return <Text style={s.none}>–</Text>;
                const change = Math.round(st.mean - st.previousMean);
                return <Text style={[s.statText, { fontWeight: 700, color: change > 0 ? C.up : change < 0 ? C.down : C.muted }]}>{signed(change)}</Text>;
            })}
            {line('Highest · lowest', code => {
                const st = stat(code);
                return <Text style={s.statText}>{st ? `${Math.round(st.highest)} · ${Math.round(st.lowest)}` : '-'}</Text>;
            })}
            {line(isKCSE ? 'Subject position' : 'Area position', code => <Text style={[s.statText, { fontWeight: 700 }]}>{rankOf(code) ?? '-'}</Text>)}
            {hasTeacher && line(isKCSE ? 'Subject teacher' : 'Teacher', code => <Text style={[s.statText, { fontSize: 5.4, color: C.muted, maxLines: 1 }]}>{shortName(stat(code)?.teacher)}</Text>)}
        </>
    );
}

function statRowCount(d: MarkSheetData): number {
    const has = (pick: (st: SubjectStats) => unknown) => d.subjects.some(sub => pick(d.subjectStats[sub.code] ?? ({} as SubjectStats)));
    return 3 + (has(st => st.previousMean != null) ? 1 : 0) + (has(st => st.teacher) ? 1 : 0);
}

function Legend({ d }: { d: MarkSheetData }) {
    return (
        <View style={s.legend}>
            <View style={s.legendItem}><View style={[s.swatch, { backgroundColor: C.hiBg }]} /><Text style={s.legendText}>80 and above</Text></View>
            <View style={s.legendItem}><View style={[s.swatch, { backgroundColor: C.loBg }]} /><Text style={s.legendText}>Below 40</Text></View>
            <View style={s.legendItem}><View style={[s.medal, { width: 9, height: 9, backgroundColor: MEDAL[0], marginRight: 3 }]} /><Text style={s.legendText}>Top three</Text></View>
            <Text style={s.legendText}>– no mark recorded{d.students.some(st => st.previousPercentage != null) ? `   ·   Change = movement in mean since ${d.previousExamLabel || 'the last exam'}` : ''}</Text>
        </View>
    );
}

/* ── Summary (last page) ─────────────────────────────────── */

function SubjectRanking({ d }: { d: MarkSheetData }) {
    const ranked = [...d.subjectRankings].sort((a, b) => a.rank - b.rank);
    return (
        <View style={[s.panel, { flex: 1.25, marginRight: 9 }]}>
            <View style={s.panelTitle}><Text style={s.h3}>{d.gradingSystemType === 'KCSE' ? 'Subject ranking' : 'Learning area ranking'}</Text><Text style={s.h3Note}>class mean · gold tick = {d.previousExamLabel || 'last exam'}</Text></View>
            {ranked.map(r => {
                const st = d.subjectStats[r.code];
                const name = d.subjects.find(sub => sub.code === r.code)?.name ?? r.code;
                const mean = st?.mean ?? r.mean;
                const change = st?.previousMean != null ? Math.round(mean - st.previousMean) : null;
                return (
                    <View key={r.code} style={s.rank}>
                        <Text style={s.rankName}>{r.rank}. {name}</Text>
                        <View style={s.rankTrack}>
                            <View style={[s.rankFill, { width: `${Math.max(1, Math.min(100, mean))}%` }]} />
                            {st?.previousMean != null && <View style={[s.rankTick, { left: `${Math.min(99, st.previousMean)}%` }]} />}
                        </View>
                        <Text style={s.rankMean}>{Math.round(mean)}</Text>
                        <Text style={[s.rankDelta, { color: change == null ? C.faint : change > 0 ? C.up : change < 0 ? C.down : C.muted }]}>{change == null ? '' : signed(change)}</Text>
                    </View>
                );
            })}
        </View>
    );
}

function GradePanel({ d }: { d: MarkSheetData }) {
    const isKCSE = d.gradingSystemType === 'KCSE';
    const order = Object.keys(d.gradeDistribution).filter(g => g && g !== '-')
        .sort((a, b) => gradeOrder(a) - gradeOrder(b) || a.localeCompare(b));
    const total = order.reduce((sum, g) => sum + d.gradeDistribution[g], 0);
    const passing = order.filter(g => passes(g, isKCSE)).reduce((sum, g) => sum + d.gradeDistribution[g], 0);
    return (
        <View style={[s.panel, { flex: 1, marginRight: 9 }]}>
            <View style={s.panelTitle}><Text style={s.h3}>Grade distribution</Text><Text style={s.h3Note}>{total} learners</Text></View>
            {total > 0 && (
                <View style={s.dist}>
                    {order.map(g => (
                        <View key={g} style={[s.distSeg, { flex: d.gradeDistribution[g], backgroundColor: gradeTone(g) }]}>
                            {d.gradeDistribution[g] / total >= 0.04 && <Text style={s.distText}>{d.gradeDistribution[g]}</Text>}
                        </View>
                    ))}
                </View>
            )}
            <View style={s.legendGrid}>
                {order.map(g => (
                    <View key={g} style={s.gradeKey}>
                        <View style={[s.swatch, { width: 6, height: 6, backgroundColor: gradeTone(g) }]} />
                        <Text style={s.gradeKeyText}>{g} <Text style={{ fontWeight: 700, color: C.ink }}>×{d.gradeDistribution[g]}</Text></Text>
                    </View>
                ))}
            </View>
            <View style={[s.panelTitle, { marginTop: 8 }]}><Text style={s.h3}>Pass rate</Text><Text style={s.h3Note}>{isKCSE ? 'C+ and above' : 'Meeting expectations and above'}</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text style={s.passValue}>{total > 0 ? Math.round((passing / total) * 100) : 0}%</Text>
                <Text style={[s.gradeKeyText, { marginLeft: 6, marginBottom: 3 }]}>{passing} of {total} learners</Text>
            </View>
        </View>
    );
}

function PeoplePanel({ d, ranked }: { d: MarkSheetData; ranked: Learner[] }) {
    const improved = d.students
        .filter(st => st.previousPercentage != null)
        .map(st => ({ st, change: Math.round(st.overallPercentage - (st.previousPercentage as number)) }))
        .filter(x => x.change > 0)
        .sort((a, b) => b.change - a.change)
        .slice(0, 5);
    return (
        <View style={[s.panel, { flex: 1, flexDirection: 'row' }]}>
            <View style={{ flex: 1, marginRight: improved.length > 0 ? 9 : 0 }}>
                <Text style={[s.h3, { marginBottom: 5 }]}>Top 5</Text>
                {ranked.slice(0, 5).map(st => (
                    <View key={`${st.admissionNumber}-${st.studentName}`} style={s.li}>
                        <Text style={s.liText}><Text style={s.liNo}>{st.classRank}  </Text>{firstWords(st.studentName)}</Text>
                        <Text style={[s.liText, { fontWeight: 700 }]}>{Math.round(st.overallPercentage)}</Text>
                    </View>
                ))}
            </View>
            {improved.length > 0 && (
                <View style={{ flex: 1 }}>
                    <Text style={[s.h3, { marginBottom: 5 }]}>Most improved</Text>
                    {improved.map(({ st, change }) => (
                        <View key={`${st.admissionNumber}-${st.studentName}`} style={s.li}>
                            <Text style={s.liText}>{firstWords(st.studentName)}</Text>
                            <Text style={[s.liText, { fontWeight: 700, color: C.up }]}>{signed(change)}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

function Signatures() {
    return (
        <View style={s.signs}>
            {[['Class teacher', 'Date'], ['Deputy principal (academics)', 'Date'], ['Principal', 'Stamp']].map(([role, right], i) => (
                <View key={role} style={[s.sign, i < 2 ? { marginRight: 16.5 } : {}]}>
                    <Text style={s.signText}>{role}</Text><Text style={s.signText}>{right}</Text>
                </View>
            ))}
        </View>
    );
}

/** Height the summary needs: statistics rows, the analysis panels and sign-off. */
function summaryHeight(d: MarkSheetData): number {
    const rankingPanel = H.panelHead + d.subjectRankings.length * H.panelRow;
    const gradePanel = 110;
    const panels = Math.max(rankingPanel, gradePanel, 80);
    return statRowCount(d) * H.statRow + H.summaryGap + panels + H.signature;
}

/* ── Document ────────────────────────────────────────────── */

export function MarkSheetDocument({ data }: { data: MarkSheetData }) {
    const d = data;
    const isKCSE = d.gradingSystemType === 'KCSE';
    const showDev = d.students.some(st => st.previousPercentage != null);
    const w = columnWidths(d.subjects.length, isKCSE, showDev);
    const ranked = [...d.students].sort((a, b) => (a.classRank || 9999) - (b.classRank || 9999));
    const classMean = d.classMeanPercentage
        ?? (ranked.reduce((sum, st) => sum + st.overallPercentage, 0) / Math.max(1, ranked.length));
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const dims: PageDimensions = {
        usable: PAGE_H - H.footer - 6,
        firstChrome: H.masthead + H.firstGap + H.kpis + 6 + H.legend,
        otherChrome: H.slim + 6,
        tableHead: H.groupHead + H.colHead,
        row: H.row,
        summary: summaryHeight(d),
        maxRowGrowth: 1.3,
    };
    const plan = planPages(ranked.length, dims);
    const totalPages = plan.rows.length + (plan.summaryOnOwnPage ? 1 : 0);

    let offset = 0;
    const chunks = plan.rows.map(n => {
        const chunk = ranked.slice(offset, offset + n);
        offset += n;
        return chunk;
    });

    const summary = (
        <View style={{ flexGrow: 1 }}>
            <View style={[s.panels, { flexGrow: 1 }]} wrap={false}>
                <SubjectRanking d={d} />
                <GradePanel d={d} />
                <PeoplePanel d={d} ranked={ranked} />
            </View>
            <Signatures />
        </View>
    );

    const footer = (page: number) => (
        <View style={s.footer} fixed>
            <BrandFooter
                ruleColor="#E2E8F0"
                meta={[`${d.className} · ${roundLabel(d)}`, `Generated ${today}`, `Page ${page} of ${totalPages}`]}
                paddingX={X}
                paddingBottom={9}
            />
        </View>
    );

    return (
        <Document>
            {chunks.map((chunk, p) => {
                const first = p === 0;
                const last = p === chunks.length - 1;
                let index = chunk.length > 0 ? ranked.indexOf(chunk[0]) : 0;
                return (
                    <Page key={p} size="A4" orientation="landscape" style={s.page}>
                        {first ? (<><Masthead d={d} /><Kpis d={d} classMean={classMean} ranked={ranked} /></>) : <SlimHeader d={d} page={p + 1} pages={totalPages} />}
                        <View style={s.table}>
                            <TableHead d={d} w={w} isKCSE={isKCSE} showDev={showDev} />
                            {chunk.map(st => (
                                <LearnerRow key={`${st.admissionNumber}-${st.studentName}`} d={d} st={st} index={index++} w={w} height={plan.rowHeight} isKCSE={isKCSE} showDev={showDev} />
                            ))}
                            {last && <StatRows d={d} w={w} isKCSE={isKCSE} showDev={showDev} classMean={classMean} />}
                        </View>
                        {first && <Legend d={d} />}
                        {last && !plan.summaryOnOwnPage && summary}
                        {footer(p + 1)}
                    </Page>
                );
            })}
            {plan.summaryOnOwnPage && (
                <Page size="A4" orientation="landscape" style={s.page}>
                    <SlimHeader d={d} page={totalPages} pages={totalPages} />
                    {summary}
                    {footer(totalPages)}
                </Page>
            )}
        </Document>
    );
}

export async function generateMarkSheetPDF(data: MarkSheetData): Promise<Buffer> {
    const buffer = await renderToBuffer(<MarkSheetDocument data={data} />);
    return Buffer.from(buffer);
}
