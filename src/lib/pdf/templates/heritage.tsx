/**
 * HERITAGE — the formal, certificate-grade card (template id "classic").
 * Navy and antique gold on ivory, a double keyline frame, a serif masthead
 * and a grade seal. Printed the way a school's own letterhead would be.
 */
import React from 'react';
import { Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { FONTS } from '../pdfTheme';
import { buildReportModel, signed, levelFamily, type ReportModel, type SubjectRow, type LevelFamily } from '../reportModel';
import { Crest, ScoreRing, Trend, BrandFooter, reportFooterMeta } from '../primitives';
import type { LayoutProps } from '../templates';

const C = {
    navy: '#0B1F3A',
    gold: '#B8893A',
    goldSoft: '#D9C18F',
    goldText: '#8A6A2E',
    cream: '#E9D3A0',
    paper: '#FFFDF8',
    stripe: '#F7F2E7',
    rule: '#EAE1CD',
    track: '#F1EADB',
    ink: '#1B2433',
    body: '#4A5466',
    muted: '#7A8494',
    faint: '#8A93A3',
    green: '#1F6B45',
    red: '#A3262A',
} as const;

const LEVEL: Record<LevelFamily, string> = { EE: '#1F6B45', ME: '#1E4E8C', AE: '#A8620D', BE: '#A3262A' };
const TREND = { up: C.green, down: C.red, flat: C.muted };
const X = 33;

const sans = FONTS.sourceSans;
const serif = FONTS.playfair;

/** Playfair's numerals are old-style, so "ME1" reads as "ME₁"; symbols with a digit use the sans. */
const symbolFont = (symbol: string): Style => (/\d/.test(symbol) ? { fontFamily: sans } : { fontFamily: serif });

const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: C.paper, fontFamily: sans, color: C.ink, position: 'relative' },
    frameOuter: { position: 'absolute', top: 10.5, left: 10.5, right: 10.5, bottom: 10.5, border: `1.1pt solid ${C.gold}` },
    frameInner: { position: 'absolute', top: 13, left: 13, right: 13, bottom: 13, border: `0.45pt solid ${C.goldSoft}` },

    head: { flexDirection: 'row', alignItems: 'center', paddingTop: 23, paddingHorizontal: X, paddingBottom: 7 },
    title: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
    school: { fontFamily: serif, fontWeight: 700, fontSize: 18.5, color: C.navy, textAlign: 'center' },
    address: { fontSize: 6.8, color: '#5B6576', marginTop: 3, textAlign: 'center' },
    qrWrap: { alignItems: 'center', width: 60 },
    qr: { width: 48, height: 48 },
    qrLabel: { fontSize: 5.2, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 },

    orn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: X, paddingTop: 4 },
    ornLine: { flex: 1, height: 4, borderTop: `1pt solid ${C.navy}`, borderBottom: `0.45pt solid ${C.navy}` },
    ornText: { fontWeight: 600, fontSize: 7.3, color: C.navy, textTransform: 'uppercase', letterSpacing: 1.8, marginHorizontal: 9 },

    learner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: X, paddingTop: 9, paddingBottom: 8 },
    fields: { flex: 1, marginRight: 16 },
    fieldRow: { flexDirection: 'row', marginTop: 8 },
    field: { flex: 1, marginRight: 10 },
    label: { fontWeight: 600, fontSize: 6, textTransform: 'uppercase', letterSpacing: 1.05, color: C.goldText, marginBottom: 1.5 },
    value: { fontWeight: 700, fontSize: 9, color: C.navy, borderBottom: `0.6pt solid #E3D8C0`, paddingBottom: 2.5 },
    valueSmall: { fontWeight: 400, fontSize: 7.5, color: '#5B6576' },
    name: { fontFamily: serif, fontWeight: 700, fontSize: 15, color: C.navy },

    sealIn: { width: 67, height: 67, borderRadius: 33.5, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
    sealLabel: { fontSize: 5.2, letterSpacing: 1, textTransform: 'uppercase', color: C.cream },
    sealGrade: { fontFamily: serif, fontWeight: 700, fontSize: 22, color: '#FFFFFF', lineHeight: 1.1 },
    sealPct: { fontSize: 7.5, color: '#CBD3E1' },

    table: { marginHorizontal: X },
    th: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.navy, borderBottom: `1.5pt solid ${C.gold}` },
    thText: { fontWeight: 600, fontSize: 5.9, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.75, textAlign: 'center', paddingVertical: 4.5, paddingHorizontal: 2 },
    tr: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.45pt solid ${C.rule}` },
    subject: { paddingLeft: 7.5, paddingRight: 3 },
    subjectName: { fontWeight: 600, fontSize: 7.9, color: C.navy },
    teacher: { fontSize: 6, color: C.faint },
    num: { fontSize: 7.5, textAlign: 'center' },
    mark: { fontWeight: 700, fontSize: 8.3, color: C.navy, textAlign: 'center' },
    grade: { fontFamily: serif, fontWeight: 700, fontSize: 9, color: C.navy, textAlign: 'center' },
    remark: { fontFamily: FONTS.sourceSerif, fontStyle: 'italic', fontSize: 6.8, color: C.body, paddingRight: 4 },
    level: { alignSelf: 'center', borderRadius: 2, borderWidth: 0.75, paddingHorizontal: 3.5, paddingVertical: 0.5 },
    levelText: { fontWeight: 700, fontSize: 6.8 },
    tf: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.navy, paddingVertical: 4.5 },
    tfLabel: { fontWeight: 700, fontSize: 6.8, color: C.cream, textTransform: 'uppercase', letterSpacing: 1.05, paddingLeft: 7.5 },
    tfNum: { fontWeight: 700, fontSize: 7.9, color: '#FFFFFF', textAlign: 'center' },

    stats: { flexDirection: 'row', marginHorizontal: X, marginTop: 9, borderTop: `0.6pt solid ${C.goldSoft}`, borderBottom: `0.6pt solid ${C.goldSoft}` },
    stat: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRight: `0.45pt solid ${C.rule}` },
    statLabel: { fontWeight: 600, fontSize: 5.6, textTransform: 'uppercase', letterSpacing: 1, color: C.goldText },
    statValue: { fontFamily: serif, fontWeight: 700, fontSize: 16.5, color: C.navy, marginVertical: 1 },
    statSub: { fontSize: 6.4, color: '#5B6576' },

    two: { flexDirection: 'row', marginHorizontal: X, marginTop: 9 },
    h3: { fontWeight: 600, fontSize: 6.4, textTransform: 'uppercase', letterSpacing: 1.2, color: C.navy, borderBottom: `0.9pt solid ${C.navy}`, paddingBottom: 3, marginBottom: 5 },
    bar: { flexDirection: 'row', alignItems: 'center', marginBottom: 2.6 },
    barLabel: { width: 60, fontSize: 6.4, color: C.body },
    barTrack: { flex: 1, height: 5.2, backgroundColor: C.track, position: 'relative', marginHorizontal: 4.5 },
    barFill: { height: 5.2, backgroundColor: C.navy },
    barMean: { position: 'absolute', top: -1.5, width: 1.5, height: 8.2, backgroundColor: C.gold },
    barValue: { width: 12, fontWeight: 700, fontSize: 6.4, color: C.navy, textAlign: 'right' },
    legend: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
    legendText: { fontSize: 5.6, color: C.muted },

    keyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2, borderBottom: `0.4pt dotted ${C.goldSoft}` },
    keySymbol: { fontFamily: serif, fontWeight: 700, fontSize: 7.9, color: C.navy, width: 17 },
    keyText: { flex: 1, fontSize: 6.4, color: C.body },
    keyPts: { fontSize: 6, color: C.goldText },

    remarks: { flexGrow: 1, flexDirection: 'row', alignItems: 'stretch', marginHorizontal: X, marginTop: 9 },
    remark2: { flex: 1, marginRight: 12 },
    remarkText: { flexGrow: 1, fontFamily: FONTS.sourceSerif, fontStyle: 'italic', fontSize: 7.5, lineHeight: 1.5, color: C.ink, minHeight: 30 },
    sig: { borderTop: `0.6pt solid ${C.ink}`, marginTop: 11, paddingTop: 2.5, flexDirection: 'row', justifyContent: 'space-between' },
    sigText: { fontSize: 5.3, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.75 },
    stamp: { alignSelf: 'flex-end', width: 64, height: 64, borderRadius: 32, border: `0.9pt dashed ${C.gold}`, alignItems: 'center', justifyContent: 'center' },
    stampText: { fontSize: 5.3, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.75, textAlign: 'center' },

    parent: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: X, marginTop: 10 },
    parentText: { fontSize: 6.4, color: '#5B6576' },
    parentLine: { flex: 1, borderBottom: `0.6pt solid ${C.ink}`, height: 9, marginHorizontal: 7 },
    open: { marginLeft: 9, paddingVertical: 4, paddingHorizontal: 7.5, backgroundColor: C.navy, borderRadius: 1.5 },
    openText: { fontSize: 6.8, color: C.cream },
});

/* ── Table columns ──────────────────────────────────────────── */

interface Column {
    key: string;
    title: string;
    width: number;
    align?: 'left';
    cell: (row: SubjectRow) => React.ReactNode;
    total?: (m: ReportModel) => React.ReactNode;
}

/** The papers a subject actually sat, or a dash. */
const paperText = (r: SubjectRow) => r.papers.filter(p => p != null).join(' · ') || '-';

const muted = (text: string | number | undefined) => <Text style={[s.num, { color: C.muted }]}>{text ?? '-'}</Text>;
const change = (value: number | null) =>
    value == null ? muted('-') : <Text style={[s.num, { fontWeight: 600, color: value > 0 ? C.green : value < 0 ? C.red : C.muted }]}>{signed(value)}</Text>;

function columns(m: ReportModel): Column[] {
    const cols: Column[] = [{
        key: 'subject', title: m.subjectNoun, width: 0, align: 'left',
        cell: r => (
            <View style={s.subject}>
                <Text style={s.subjectName}>{r.name}</Text>
                {r.teacher && !m.compact ? <Text style={s.teacher}>{r.teacher}</Text> : null}
            </View>
        ),
    }];
    if (m.paperCodes.length > 0) {
        cols.push({ key: 'papers', title: 'Papers', width: 12, cell: r => muted(paperText(r)) });
    }
    cols.push({ key: 'mark', title: 'Mark', width: 7, cell: r => <Text style={s.mark}>{r.mark ?? '-'}</Text>, total: x => x.mean });
    if (m.hasClassAverage) cols.push({ key: 'avg', title: 'Class avg', width: 7, cell: r => muted(r.classAverage), total: x => x.classMean ?? '' });
    if (m.hasPrevious) {
        cols.push({
            key: 'dev', title: `vs ${m.previousLabel}`, width: 9, cell: r => change(r.change),
            total: x => (x.meanChange == null ? '' : signed(x.meanChange)),
        });
    }
    if (m.isKCSE) {
        cols.push({ key: 'grade', title: 'Grade', width: 7, cell: r => <Text style={s.grade}>{r.grade}</Text>, total: x => x.grade });
        cols.push({
            key: 'pts', title: 'Pts', width: 5.5,
            cell: r => <Text style={[s.num, { color: r.countsForPoints ? C.ink : '#B6BDC8' }]}>{r.points ?? '-'}</Text>,
            total: x => x.points ?? '',
        });
    } else {
        cols.push({
            key: 'level', title: 'Level', width: 8,
            cell: r => {
                const color = LEVEL[levelFamily(r.grade, r.mark)];
                return <View style={[s.level, { borderColor: color }]}><Text style={[s.levelText, { color }]}>{r.grade}</Text></View>;
            },
            total: x => x.grade,
        });
    }
    cols.push({ key: 'rank', title: 'Rank', width: 7, cell: r => muted(r.rank), total: x => (x.position ? `${x.position.rank}/${x.position.of}` : '') });
    cols.push({ key: 'remark', title: 'Remark', width: 0, align: 'left', cell: r => <Text style={s.remark}>{r.remark}</Text> });

    // Subject and remark share what the fixed columns leave, 55 / 45.
    const fixed = cols.reduce((sum, c) => sum + c.width, 0);
    cols[0].width = (100 - fixed) * 0.55;
    cols[cols.length - 1].width = (100 - fixed) * 0.45;
    return cols;
}

function SubjectTable({ m }: { m: ReportModel }) {
    const cols = columns(m);
    const pad = m.compact ? 1.6 : 2.6 * m.rowScale;
    const cellStyle = (c: Column): Style => ({ width: `${c.width}%`, paddingHorizontal: c.align ? 0 : 2 });
    return (
        <View style={s.table}>
            <View style={s.th}>
                {cols.map(c => (
                    <View key={c.key} style={cellStyle(c)}>
                        <Text style={[s.thText, c.align ? { textAlign: 'left', paddingLeft: 7.5 } : {}]}>{c.title}</Text>
                    </View>
                ))}
            </View>
            {m.subjects.map((row, i) => (
                <View key={`${row.name}-${i}`} style={[s.tr, { paddingVertical: pad, backgroundColor: i % 2 === 1 ? C.stripe : C.paper }]} wrap={false}>
                    {cols.map(c => <View key={c.key} style={cellStyle(c)}>{c.cell(row)}</View>)}
                </View>
            ))}
            <View style={s.tf}>
                {cols.map(c => (
                    <View key={c.key} style={cellStyle(c)}>
                        {c.key === 'subject'
                            ? <Text style={s.tfLabel}>Overall</Text>
                            : <Text style={[s.tfNum, c.key === 'dev' ? { color: '#9FE0BC' } : {}]}>{c.total?.(m) ?? ''}</Text>}
                    </View>
                ))}
            </View>
        </View>
    );
}

/* ── Sections ───────────────────────────────────────────────── */

function Field({ label, value, small }: { label: string; value: string; small?: string }) {
    return (
        <View style={s.field}>
            <Text style={s.label}>{label}</Text>
            <Text style={s.value}>{value}{small ? <Text style={s.valueSmall}>{` ${small}`}</Text> : null}</Text>
        </View>
    );
}

function Stat({ label, value, valueStyle, children }: { label: string; value: string; valueStyle?: Style; children?: React.ReactNode }) {
    return (
        <View style={s.stat}>
            <Text style={s.statLabel}>{label}</Text>
            <Text style={[s.statValue, valueStyle ?? {}]}>{value}</Text>
            {children}
        </View>
    );
}

function Stats({ m }: { m: ReportModel }) {
    const up = (value: number | null, suffix: string) =>
        value == null ? null : <Trend value={value} size={6.4} colors={TREND} fontFamily={sans} fontWeight={600} suffix={suffix} />;
    return (
        <View style={[s.stats, m.compact ? { marginTop: 6 } : {}]} wrap={false}>
            <Stat label="Mean score" value={`${m.mean}%`}>{up(m.meanChange, `vs ${m.previousLabel}`)}</Stat>
            <Stat label={m.isKCSE ? 'Mean grade' : 'Overall level'} value={m.grade} valueStyle={symbolFont(m.grade)}><Text style={s.statSub}>{m.gradeCaption}</Text></Stat>
            {m.isKCSE && m.points != null && <Stat label="Total points" value={`${m.points}`}>{up(m.pointsChange, 'points')}</Stat>}
            {m.position && <Stat label="Class position" value={`${m.position.rank}/${m.position.of}`}>{up(m.positionChange, 'places')}</Stat>}
            {m.classMean != null && (
                <Stat label="Class mean" value={`${m.classMean}%`}>
                    <Text style={s.statSub}>{m.vsClassMean != null ? `${signed(m.vsClassMean)} vs class` : ''}</Text>
                </Stat>
            )}
        </View>
    );
}

function ClassBars({ m }: { m: ReportModel }) {
    const rows = m.subjects.filter(r => r.mark != null);
    return (
        <View>
            <Text style={s.h3}>{m.hasClassAverage ? 'Performance against the class' : `Performance by ${m.subjectNoun.toLowerCase()}`}</Text>
            {rows.map((r, i) => (
                <View key={`${r.name}-${i}`} style={[s.bar, m.compact ? { marginBottom: 0.8 } : {}]}>
                    <Text style={s.barLabel} >{r.name}</Text>
                    <View style={[s.barTrack, m.compact ? { height: 4 } : {}]}>
                        <View style={[s.barFill, { width: `${r.mark}%` }, m.compact ? { height: 4 } : {}]} />
                        {r.classAverage != null && <View style={[s.barMean, { left: `${r.classAverage}%` }]} />}
                    </View>
                    <Text style={s.barValue}>{r.mark}</Text>
                </View>
            ))}
            {m.hasClassAverage && (
                <View style={s.legend}>
                    <View style={s.legendItem}><View style={{ width: 7, height: 4.5, backgroundColor: C.navy, marginRight: 3 }} /><Text style={s.legendText}>Learner</Text></View>
                    <View style={s.legendItem}><View style={{ width: 1.5, height: 7, backgroundColor: C.gold, marginRight: 3 }} /><Text style={s.legendText}>Class average</Text></View>
                </View>
            )}
        </View>
    );
}

function ScaleKey({ m }: { m: ReportModel }) {
    const twoColumns = m.scale.length > 6;
    const half = Math.ceil(m.scale.length / 2);
    const groups = twoColumns ? [m.scale.slice(0, half), m.scale.slice(half)] : [m.scale];
    return (
        <View>
            <Text style={s.h3}>{m.isKCSE ? 'Grading scale' : 'Competency levels'}</Text>
            <View style={{ flexDirection: 'row' }}>
                {groups.map((group, g) => (
                    <View key={g} style={{ flex: 1, marginRight: g === 0 && twoColumns ? 9 : 0 }}>
                        {group.map(row => (
                            <View key={row.symbol} style={[s.keyRow, !m.isKCSE && !twoColumns ? { paddingVertical: 4.5 } : {}]}>
                                <Text style={[s.keySymbol, symbolFont(row.symbol), m.isKCSE ? {} : { color: LEVEL[levelFamily(row.symbol)], width: twoColumns ? 20 : 22 }]}>{row.symbol}</Text>
                                <Text style={s.keyText}>{m.isKCSE || twoColumns ? row.range : (row.label ?? row.range)}</Text>
                                <Text style={s.keyPts}>{row.points != null ? `${row.points} pt` : (twoColumns ? '' : row.range)}</Text>
                            </View>
                        ))}
                    </View>
                ))}
            </View>
        </View>
    );
}

export function HeritageLayout({ data, qrCodeDataUri }: LayoutProps) {
    const m = buildReportModel(data, qrCodeDataUri);
    return (
        <View style={s.page}>
            <View style={s.frameOuter} fixed />
            <View style={s.frameInner} fixed />

            <View style={s.head}>
                <Crest logo={m.school.logo} initial={m.school.initial} size={46} background={C.navy} color={C.cream} fontFamily={serif} ring={{ color: C.gold, gap: 1.5, width: 1.1 }} />
                <View style={s.title}>
                    <Text style={s.school}>{m.school.name}</Text>
                    {m.school.address && <Text style={s.address}>{m.school.address}</Text>}
                </View>
                <View style={s.qrWrap}>
                    {m.qrCode ? (<><Image src={m.qrCode} style={s.qr} /><Text style={s.qrLabel}>Verify online</Text></>) : null}
                </View>
            </View>
            <View style={s.orn}>
                <View style={s.ornLine} />
                <Text style={s.ornText}>Academic Report  ·  {m.exam.title}  ·  {m.exam.year}</Text>
                <View style={s.ornLine} />
            </View>

            <View style={s.learner}>
                <View style={s.fields}>
                    <Text style={s.label}>Learner</Text>
                    <Text style={s.name}>{m.learner.name}</Text>
                    <View style={s.fieldRow}>
                        <Field label="Admission No." value={m.learner.admission} />
                        <Field label="Class" value={m.learner.className} />
                        {m.position
                            ? <Field label="Position" value={`${m.position.rank}`} small={`of ${m.position.of}`} />
                            : <Field label={m.subjectNounPlural} value={`${m.subjects.length}`} />}
                        {m.learner.pathway
                            ? <Field label="Pathway" value={m.learner.pathway} />
                            : m.isKCSE && m.points != null
                                ? <Field label="Total points" value={`${m.points}`} />
                                : <Field label={m.subjectNounPlural} value={`${m.subjects.length}`} />}
                    </View>
                </View>
                <ScoreRing size={86} stroke={3.8} pct={m.mean} color={C.gold} track="#EFE6D2">
                    <View style={s.sealIn}>
                        <Text style={s.sealLabel}>{m.isKCSE ? 'Mean grade' : 'Level'}</Text>
                        <Text style={[s.sealGrade, symbolFont(m.grade)]}>{m.grade}</Text>
                        <Text style={s.sealPct}>{m.mean}%</Text>
                    </View>
                </ScoreRing>
            </View>

            <SubjectTable m={m} />
            {/* The remarks take whatever height the subject list leaves, so a
                short report fills the sheet and teachers get room to write. */}
            <View style={{ flexGrow: 1 }}>
            <Stats m={m} />

            <View style={[s.two, m.compact ? { marginTop: 6 } : {}]} wrap={false}>
                <View style={{ flex: 1.35, marginRight: 12 }}><ClassBars m={m} /></View>
                <View style={{ flex: 1 }}><ScaleKey m={m} /></View>
            </View>

            <View style={[s.remarks, m.compact ? { marginTop: 6 } : {}]} wrap={false}>
                <View style={s.remark2}>
                    <Text style={s.h3}>Class teacher’s remarks</Text>
                    <Text style={[s.remarkText, m.compact ? { minHeight: 18 } : {}]}>{m.teacherComment}</Text>
                    <View style={s.sig}><Text style={s.sigText}>Class teacher</Text><Text style={s.sigText}>Signature</Text></View>
                </View>
                <View style={s.remark2}>
                    <Text style={s.h3}>Principal’s remarks</Text>
                    <Text style={[s.remarkText, m.compact ? { minHeight: 18 } : {}]}>{m.principalComment}</Text>
                    <View style={s.sig}><Text style={s.sigText}>Principal</Text><Text style={s.sigText}>Signature</Text></View>
                </View>
                <View style={[s.stamp, m.compact ? { width: 52, height: 52, borderRadius: 26 } : {}]}><Text style={s.stampText}>{'Official\nschool stamp'}</Text></View>
            </View>

            <View style={[s.parent, m.compact ? { marginTop: 5 } : {}]} wrap={false}>
                <Text style={s.parentText}>Parent / Guardian signature</Text>
                <View style={s.parentLine} />
                <Text style={s.parentText}>Date</Text>
                <View style={[s.parentLine, { flex: 0.45 }]} />
                {m.exam.openingDate && (
                    <View style={s.open}>
                        <Text style={s.openText}>Next term opens <Text style={{ fontWeight: 700, color: '#FFFFFF' }}>{m.exam.openingDate}</Text></Text>
                    </View>
                )}
            </View>
            </View>

            <BrandFooter ruleColor={C.navy} ruleOpacity={0.35} meta={reportFooterMeta(!!m.qrCode, m.exam.issued)} paddingX={X} paddingBottom={20} />
        </View>
    );
}
