/**
 * AURORA — the contemporary, dashboard-style card (template id "modern").
 * An indigo-to-violet hero, a learner card that overlaps it, a score ring,
 * KPI tiles, score bars with a class-average tick, and soft grade pills.
 */
import React from 'react';
import { Text, View, Image, StyleSheet, Svg, Rect, Defs, LinearGradient, Stop, Circle } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { FONTS } from '../pdfTheme';
import { buildReportModel, type ReportModel, type SubjectRow } from '../reportModel';
import { Crest, ScoreRing, Trend, BrandFooter, reportFooterMeta } from '../primitives';
import type { LayoutProps } from '../templates';

const C = {
    indigoDeep: '#312E81',
    indigo: '#4F46E5',
    indigoText: '#4338CA',
    violet: '#7C3AED',
    ringA: '#6366F1',
    ringB: '#A855F7',
    ink: '#1E1B4B',
    body: '#2E2B5F',
    muted: '#6B6B8A',
    faint: '#8B8BA7',
    faintest: '#A5A5C0',
    line: '#ECECF8',
    lineSoft: '#F3F3FA',
    track: '#F0F0FA',
    tint: '#F5F5FF',
    page: '#FAFAFF',
    lilac: '#DCD8FF',
    green: '#059669',
    greenBg: '#ECFDF5',
    red: '#DC2626',
    redBg: '#FEF2F2',
    amber: '#F59E0B',
} as const;

const TREND = { up: C.green, down: C.red, flat: C.muted };
const X = 27;
const CONTENT_W = 595 - 2 * X;
const font = FONTS.jakarta;

/** Attainment colour for a mark. */
const tone = (pct: number | null): string =>
    pct == null ? C.faint : pct >= 75 ? '#10B981' : pct >= 60 ? '#6366F1' : pct >= 50 ? '#0EA5E9' : C.amber;

/** A hex colour at the given opacity, as react-pdf understands it. */
function tint(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: C.page, fontFamily: font, color: C.ink },
    hero: { height: 112, position: 'relative' },
    heroTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: X, paddingTop: 19 },
    school: { fontWeight: 800, fontSize: 15, color: '#FFFFFF' },
    address: { fontSize: 6.8, color: '#FFFFFF', opacity: 0.78, marginTop: 1.5 },
    chip: { marginLeft: 'auto', backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 4.5, paddingHorizontal: 9 },
    chipText: { fontWeight: 700, fontSize: 7.1, color: C.indigoText },

    card: { marginTop: -43, marginHorizontal: X, backgroundColor: '#FFFFFF', borderRadius: 13, border: `0.75pt solid #E4E4F4`, paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' },
    who: { flex: 1, marginLeft: 12 },
    name: { fontWeight: 800, fontSize: 14.3, color: C.ink },
    meta: { flexDirection: 'row', marginTop: 4.5 },
    metaItem: { marginRight: 13.5 },
    metaLabel: { fontWeight: 600, fontSize: 5.6, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.75 },
    metaValue: { fontWeight: 600, fontSize: 7.9, color: C.ink },
    ringValue: { fontWeight: 800, fontSize: 19.5, color: C.ink },
    ringUnit: { fontSize: 9.8 },
    ringLabel: { fontWeight: 600, fontSize: 5.6, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.75 },
    qr: { width: 48, height: 48, marginLeft: 12, borderRadius: 6, border: `0.75pt solid #E7E7F5`, padding: 2 },

    kpis: { flexDirection: 'row', marginHorizontal: X, marginTop: 10.5 },
    kpi: { height: 58, borderRadius: 10.5, paddingVertical: 7.5, paddingHorizontal: 9, backgroundColor: '#FFFFFF', border: `0.75pt solid ${C.line}` },
    kpiLabel: { fontWeight: 700, fontSize: 5.6, textTransform: 'uppercase', letterSpacing: 0.75, color: C.faint },
    kpiValue: { fontWeight: 800, fontSize: 16.5, color: C.ink, marginVertical: 1.5 },
    kpiUnit: { fontWeight: 600, fontSize: 9, color: C.faintest },
    kpiSub: { fontWeight: 400, fontSize: 6.4, color: C.muted },

    table: { marginHorizontal: X, marginTop: 10.5, backgroundColor: '#FFFFFF', border: `0.75pt solid ${C.line}`, borderRadius: 10.5, paddingHorizontal: 10.5, paddingVertical: 3 },
    thead: { flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 4.5, borderBottom: `0.75pt solid ${C.line}` },
    th: { fontWeight: 700, fontSize: 5.6, textTransform: 'uppercase', letterSpacing: 0.75, color: C.faint },
    row: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.75pt solid ${C.lineSoft}` },
    accent: { width: 3, height: 16.5, borderRadius: 1.5, marginRight: 6 },
    subject: { fontWeight: 700, fontSize: 7.9, color: C.ink },
    sub: { fontSize: 5.9, color: C.faint, marginTop: 0.5 },
    score: { fontWeight: 800, fontSize: 9, width: 15 },
    track: { flex: 1, height: 5.2, borderRadius: 3, backgroundColor: C.track, position: 'relative', marginLeft: 4 },
    fill: { height: 5.2, borderRadius: 3 },
    tick: { position: 'absolute', top: -2.2, width: 1.5, height: 9.7, backgroundColor: C.ink, opacity: 0.55 },
    center: { textAlign: 'center', fontWeight: 600, fontSize: 7.5 },
    dev: { alignSelf: 'center', borderRadius: 8, paddingHorizontal: 4.5, paddingVertical: 1.5 },
    pill: { alignSelf: 'center', minWidth: 21, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
    pillText: { fontWeight: 800, fontSize: 7.5, textAlign: 'center' },

    grid: { flexDirection: 'row', marginHorizontal: X },
    box: { backgroundColor: '#FFFFFF', border: `0.75pt solid ${C.line}`, borderRadius: 10.5, paddingVertical: 7.5, paddingHorizontal: 10.5 },
    h3: { fontWeight: 800, fontSize: 6, textTransform: 'uppercase', letterSpacing: 0.9, color: C.ringA, marginBottom: 4 },
    li: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, borderBottom: `0.75pt dashed ${C.line}` },
    liText: { fontSize: 7.1, color: C.ink },
    liValue: { fontWeight: 800, fontSize: 7.1 },
    scaleCell: { backgroundColor: C.tint, borderRadius: 6, alignItems: 'center', paddingVertical: 4, marginBottom: 4 },
    scaleSymbol: { fontWeight: 800, fontSize: 9, color: C.indigoText },
    scaleRange: { fontSize: 5.6, color: C.muted },

    remarks: { flexDirection: 'row', marginHorizontal: X },
    remark: { flexGrow: 1, backgroundColor: '#FFFFFF', border: `0.75pt solid ${C.line}`, borderRadius: 10.5, paddingVertical: 7.5, paddingHorizontal: 10.5 },
    remarkHead: { flexDirection: 'row', alignItems: 'center' },
    remarkDot: { width: 6, height: 6, borderRadius: 2, marginRight: 4.5 },
    remarkRole: { fontWeight: 800, fontSize: 6, textTransform: 'uppercase', letterSpacing: 0.75, color: C.muted },
    remarkText: { flexGrow: 1, fontSize: 7.5, lineHeight: 1.55, color: C.body, marginTop: 4.5, minHeight: 34 },
    sig: { borderTop: `0.75pt solid #D9D9EC`, marginTop: 12, paddingTop: 2.5, width: '55%' },
    sigText: { fontSize: 5.6, color: C.faintest, textTransform: 'uppercase', letterSpacing: 0.75 },

    signRow: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: X, marginTop: 9 },
    signCell: { flex: 1, marginRight: 13.5 },
    signLine: { borderBottom: `0.75pt solid #C8C8DE`, height: 13.5, marginBottom: 2.5 },
    signLabel: { fontWeight: 600, fontSize: 5.6, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.75 },
    open: { backgroundColor: '#EEF0FF', borderRadius: 7.5, paddingVertical: 4.5, paddingHorizontal: 9 },
    openLabel: { fontSize: 5.3, textTransform: 'uppercase', letterSpacing: 0.75, color: C.faint },
    openValue: { fontWeight: 700, fontSize: 7.9, color: C.indigoText },
});

/* ── Gradient fills ─────────────────────────────────────────── */

/** A fixed-size rectangle painted with the Aurora gradient, drawn behind its children. */
function GradientPanel({ width, height, radius = 0, id, children, style }: {
    width: number; height: number; radius?: number; id: string; children?: React.ReactNode; style?: Style;
}) {
    return (
        <View style={[{ width, height, position: 'relative' }, style ?? {}]}>
            <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
                <Defs>
                    <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={C.indigo} />
                        <Stop offset="1" stopColor={C.violet} />
                    </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={width} height={height} rx={radius} ry={radius} fill={`url(#${id})`} />
            </Svg>
            {children}
        </View>
    );
}

function Hero({ m }: { m: ReportModel }) {
    const w = 595;
    const h = 112;
    return (
        <View style={s.hero}>
            <Svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
                <Defs>
                    <LinearGradient id="auroraHero" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={C.indigoDeep} />
                        <Stop offset="0.55" stopColor={C.indigo} />
                        <Stop offset="1" stopColor={C.violet} />
                    </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={w} height={h} fill="url(#auroraHero)" />
                <Circle cx={525} cy={-15} r={128} fill="#FFFFFF" fillOpacity={0.06} />
                <Circle cx={570} cy={150} r={82} fill="#FFFFFF" fillOpacity={0.05} />
            </Svg>
            <View style={s.heroTop}>
                <Crest logo={m.school.logo} initial={m.school.initial} size={36} radius={10.5} background="rgba(255,255,255,0.18)" color="#FFFFFF" fontFamily={font} fontWeight={800} />
                <View style={{ marginLeft: 10.5, flex: 1 }}>
                    <Text style={s.school}>{m.school.name}</Text>
                    {m.school.address && <Text style={s.address}>{m.school.address}</Text>}
                </View>
                <View style={s.chip}><Text style={s.chipText}>{m.exam.title} · {m.exam.year}</Text></View>
            </View>
        </View>
    );
}

function LearnerCard({ m }: { m: ReportModel }) {
    return (
        <View style={s.card}>
            <GradientPanel width={42} height={42} radius={12} id="auroraAvatar" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: 800, fontSize: 14, color: '#FFFFFF' }}>{m.learner.initials}</Text>
            </GradientPanel>
            <View style={s.who}>
                <Text style={s.name}>{m.learner.name}</Text>
                <View style={s.meta}>
                    <View style={s.metaItem}><Text style={s.metaLabel}>Adm No</Text><Text style={s.metaValue}>{m.learner.admission}</Text></View>
                    <View style={s.metaItem}><Text style={s.metaLabel}>Class</Text><Text style={s.metaValue}>{m.learner.className}</Text></View>
                    {m.learner.pathway
                        ? <View style={s.metaItem}><Text style={s.metaLabel}>Pathway</Text><Text style={s.metaValue}>{m.learner.pathway}</Text></View>
                        : <View style={s.metaItem}><Text style={s.metaLabel}>{m.subjectNounPlural}</Text><Text style={s.metaValue}>{m.subjects.length}</Text></View>}
                </View>
            </View>
            <ScoreRing size={78} stroke={7.5} pct={m.mean} color={C.ringA} track="#EEF0FF">
                <Text style={s.ringValue}>{m.mean}<Text style={s.ringUnit}>%</Text></Text>
                <Text style={s.ringLabel}>Mean score</Text>
            </ScoreRing>
            {m.qrCode && <Image src={m.qrCode} style={s.qr} />}
        </View>
    );
}

/* ── KPI tiles ─────────────────────────────────────────────── */

interface Kpi { label: string; value: string; unit?: string; sub: React.ReactNode }

function kpis(m: ReportModel): Kpi[] {
    const trend = (value: number | null, suffix: string, fallback: string) =>
        value == null ? <Text style={s.kpiSub}>{fallback}</Text>
            : <Trend value={value} size={6.4} colors={TREND} fontFamily={font} suffix={suffix} />;
    const list: Kpi[] = [
        { label: m.isKCSE ? 'Mean grade' : 'Overall level', value: m.grade, sub: m.gradeCaption },
        m.position
            ? { label: 'Class position', value: `${m.position.rank}`, unit: `/${m.position.of}`, sub: trend(m.positionChange, `places since ${m.previousLabel}`, 'In the class') }
            : { label: m.subjectNounPlural, value: `${m.subjects.length}`, sub: 'Assessed this exam' },
        m.isKCSE && m.points != null
            ? { label: 'Total points', value: `${m.points}`, sub: trend(m.pointsChange, 'points', 'Best-seven total') }
            : { label: 'Mean change', value: m.meanChange == null ? '-' : `${m.meanChange > 0 ? '+' : ''}${m.meanChange}`, unit: m.meanChange == null ? '' : '%', sub: `vs ${m.previousLabel}` },
        m.vsClassMean != null
            ? { label: 'vs Class mean', value: `${m.vsClassMean > 0 ? '+' : ''}${m.vsClassMean}`, unit: '%', sub: `Class averaged ${m.classMean}%` }
            : { label: 'Strongest', value: m.ranked[0] ? `${m.ranked[0].mark}` : '-', unit: '%', sub: m.ranked[0]?.name ?? '' },
    ];
    return list;
}

function KpiRow({ m }: { m: ReportModel }) {
    const gap = 7.5;
    const w = (CONTENT_W - 3 * gap) / 4;
    return (
        <View style={s.kpis} wrap={false}>
            {kpis(m).map((k, i) => {
                const body = (
                    <>
                        <Text style={[s.kpiLabel, i === 0 ? { color: C.lilac } : {}]}>{k.label}</Text>
                        <Text style={[s.kpiValue, i === 0 ? { color: '#FFFFFF' } : {}]}>{k.value}{k.unit ? <Text style={s.kpiUnit}>{k.unit}</Text> : null}</Text>
                        {typeof k.sub === 'string' ? <Text style={[s.kpiSub, i === 0 ? { color: C.lilac } : {}]}>{k.sub}</Text> : k.sub}
                    </>
                );
                return i === 0 ? (
                    <GradientPanel key={k.label} width={w} height={58} radius={10.5} id="auroraKpi" style={{ marginRight: gap }}>
                        <View style={{ paddingVertical: 7.5, paddingHorizontal: 9 }}>{body}</View>
                    </GradientPanel>
                ) : (
                    <View key={k.label} style={[s.kpi, { width: w, marginRight: i === 3 ? 0 : gap }]}>{body}</View>
                );
            })}
        </View>
    );
}

/* ── Subject table ─────────────────────────────────────────── */

function subLine(r: SubjectRow, codes: string[]): string {
    const papers = r.papers.map((p, i) => (p == null ? null : `${codes[i]} ${p}`)).filter(Boolean).join(' · ');
    return [r.teacher, papers].filter(Boolean).join(' · ');
}

function SubjectTable({ m }: { m: ReportModel }) {
    // Flex weights of the columns; the ones a report has no data for drop out.
    const w = { subject: 2.1, score: 1.7, dev: m.hasPrevious ? 0.8 : 0, grade: 0.6, pts: m.isKCSE ? 0.5 : 0, rank: 0.6 };
    const pad = m.compact ? 2.4 : 3.8 * m.rowScale;
    return (
        <View style={s.table}>
            <View style={s.thead}>
                <Text style={[s.th, { flex: w.subject }]}>{m.subjectNoun}</Text>
                <Text style={[s.th, { flex: w.score }]}>Score{m.hasClassAverage ? <Text style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>  · tick = class avg</Text> : null}</Text>
                {w.dev > 0 && <Text style={[s.th, { flex: w.dev, textAlign: 'center' }]}>vs {m.previousLabel}</Text>}
                <Text style={[s.th, { flex: w.grade, textAlign: 'center' }]}>{m.gradeNoun}</Text>
                {w.pts > 0 && <Text style={[s.th, { flex: w.pts, textAlign: 'center' }]}>Pts</Text>}
                <Text style={[s.th, { flex: w.rank, textAlign: 'center' }]}>Rank</Text>
            </View>
            {m.subjects.map((r, i) => {
                const color = tone(r.mark);
                const line = m.compact ? '' : subLine(r, m.paperCodes);
                return (
                    <View key={`${r.name}-${i}`} style={[s.row, { paddingVertical: pad }, i === m.subjects.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
                        <View style={{ flex: w.subject, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[s.accent, { backgroundColor: color }, m.compact ? { height: 10 } : {}]} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.subject}>{r.name}</Text>
                                {line ? <Text style={s.sub}>{line}</Text> : null}
                            </View>
                        </View>
                        <View style={{ flex: w.score, flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
                            <Text style={[s.score, { color: C.ink }]}>{r.mark ?? '-'}</Text>
                            <View style={s.track}>
                                <View style={[s.fill, { width: `${r.mark ?? 0}%`, backgroundColor: color }]} />
                                {r.classAverage != null && <View style={[s.tick, { left: `${r.classAverage}%` }]} />}
                            </View>
                        </View>
                        {w.dev > 0 && (
                            <View style={{ flex: w.dev }}>
                                {r.change == null ? <Text style={[s.center, { color: C.faintest }]}>-</Text> : (
                                    <View style={[s.dev, { backgroundColor: r.change >= 0 ? C.greenBg : C.redBg }]}>
                                        <Trend value={r.change} size={6.4} colors={TREND} fontFamily={font} />
                                    </View>
                                )}
                            </View>
                        )}
                        <View style={{ flex: w.grade }}>
                            <View style={[s.pill, { backgroundColor: tint(color, 0.12) }]}><Text style={[s.pillText, { color }]}>{r.grade}</Text></View>
                        </View>
                        {w.pts > 0 && <Text style={[s.center, { flex: w.pts, color: r.countsForPoints ? C.ink : C.faintest }]}>{r.points ?? '-'}</Text>}
                        <Text style={[s.center, { flex: w.rank, color: C.muted }]}>{r.rank ?? '-'}</Text>
                    </View>
                );
            })}
        </View>
    );
}

/* ── Lower sections ────────────────────────────────────────── */

function Highlights({ m }: { m: ReportModel }) {
    const strengths = m.ranked.slice(0, 3);
    const focus = m.ranked.length > 3 ? m.ranked.slice(-2).reverse() : [];
    return (
        <View style={[s.box, { flex: 1, marginRight: 7.5 }]}>
            <Text style={s.h3}>Strengths</Text>
            {strengths.map(r => (
                <View key={r.name} style={s.li}><Text style={s.liText}>{r.name}</Text><Text style={[s.liValue, { color: '#10B981' }]}>{r.mark}%</Text></View>
            ))}
            {focus.length > 0 && <Text style={[s.h3, { marginTop: 7.5 }]}>Focus areas</Text>}
            {focus.map(r => (
                <View key={r.name} style={s.li}><Text style={s.liText}>{r.name}</Text><Text style={[s.liValue, { color: C.amber }]}>{r.mark}%</Text></View>
            ))}
        </View>
    );
}

function ScaleTiles({ m }: { m: ReportModel }) {
    const perRow = m.scale.length > 8 ? 6 : 4;
    const gap = 4;
    return (
        <View style={[s.box, { flex: 1.25 }]}>
            <Text style={s.h3}>{m.isKCSE ? 'Grading scale' : 'Competency levels'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginRight: -gap }}>
                {m.scale.map(row => (
                    <View key={row.symbol} style={{ width: `${100 / perRow}%`, paddingRight: gap }}>
                        <View style={s.scaleCell}>
                            <Text style={s.scaleSymbol}>{row.symbol}</Text>
                            <Text style={s.scaleRange}>{row.range}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

function Remark({ role, text, color }: { role: string; text: string; color: string }) {
    return (
        <View style={s.remark}>
            <View style={s.remarkHead}><View style={[s.remarkDot, { backgroundColor: color }]} /><Text style={s.remarkRole}>{role}</Text></View>
            <Text style={s.remarkText}>{text}</Text>
            <View style={s.sig}><Text style={s.sigText}>Signature</Text></View>
        </View>
    );
}

export function AuroraLayout({ data, qrCodeDataUri }: LayoutProps) {
    const m = buildReportModel(data, qrCodeDataUri);
    return (
        <View style={s.page}>
            <Hero m={m} />
            <LearnerCard m={m} />
            <KpiRow m={m} />
            <SubjectTable m={m} />

            <View style={{ flexGrow: 1, paddingTop: m.compact ? 7 : 9 }}>
                <View style={s.grid} wrap={false}>
                    <Highlights m={m} />
                    <ScaleTiles m={m} />
                </View>
                <View style={[s.remarks, { flexGrow: 1, marginTop: 9 }]} wrap={false}>
                    <View style={{ flex: 1, marginRight: 7.5 }}><Remark role="Class teacher" text={m.teacherComment} color={C.ringA} /></View>
                    <View style={{ flex: 1 }}><Remark role="Principal" text={m.principalComment} color={C.ringB} /></View>
                </View>
                <View style={s.signRow} wrap={false}>
                    <View style={s.signCell}><View style={s.signLine} /><Text style={s.signLabel}>Parent / Guardian</Text></View>
                    <View style={s.signCell}><View style={s.signLine} /><Text style={s.signLabel}>Date</Text></View>
                    {m.exam.openingDate && (
                        <View style={s.open}><Text style={s.openLabel}>Next term opens</Text><Text style={s.openValue}>{m.exam.openingDate}</Text></View>
                    )}
                </View>
            </View>

            <BrandFooter ruleColor={C.indigo} ruleOpacity={0.35} meta={reportFooterMeta(!!m.qrCode, m.exam.issued)} paddingX={X} paddingBottom={13} />
        </View>
    );
}
