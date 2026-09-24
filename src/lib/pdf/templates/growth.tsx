/**
 * GROWTH — the progress-story card (template id "progress").
 * Teal and sand. Each subject gets a dumbbell: a hollow dot for the previous
 * round, a solid dot for this one and a gold tick for the class average, so a
 * parent sees at a glance where their child moved and how far.
 */
import React from 'react';
import { Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { FONTS } from '../pdfTheme';
import { buildReportModel, levelFamily, type ReportModel, type SubjectRow, type LevelFamily } from '../reportModel';
import { Crest, Trend, BrandFooter, reportFooterMeta, type TrendColors } from '../primitives';
import type { LayoutProps } from '../templates';

const C = {
    deep: '#0F3D3E',
    teal: '#0F766E',
    band: '#1B5E5B',
    gold: '#E8B04A',
    mint: '#A9C9C6',
    sand: '#FBF8F3',
    sandLine: '#E7DFD1',
    sandSoft: '#F0E9DD',
    sandHead: '#F1EBE0',
    chip: '#EDE6DA',
    rowLine: '#F3EEE5',
    ink: '#10302F',
    muted: '#7C8C8A',
    faint: '#8A9896',
    dotPrev: '#9AA8A6',
    up: '#15803D',
    upBg: '#DCFCE7',
    upSeg: '#86EFAC',
    down: '#C2410C',
    downBg: '#FFEDD5',
    downSeg: '#FDBA74',
    prevBar: '#CBD5D3',
    gradeBg: '#E6F2F0',
} as const;

const TREND: TrendColors = { up: C.up, down: C.down, flat: C.muted };
const X = 28.5;
const font = FONTS.manrope;
const display = FONTS.dmSerif;

const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: C.sand, fontFamily: font, color: C.ink },
    head: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.deep, paddingHorizontal: X, paddingTop: 16.5, paddingBottom: 13.5 },
    school: { fontFamily: display, fontSize: 19.5, color: '#FFFFFF', lineHeight: 1.05 },
    address: { fontSize: 6.8, color: C.mint, marginTop: 3 },
    qr: { width: 45, height: 45, backgroundColor: '#FFFFFF', borderRadius: 4.5, padding: 2 },
    band: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.band, paddingHorizontal: X, paddingVertical: 5 },
    tag: { backgroundColor: C.gold, borderRadius: 20, paddingHorizontal: 6.8, paddingVertical: 2 },
    tagText: { fontWeight: 800, fontSize: 6.4, color: C.deep, textTransform: 'uppercase', letterSpacing: 1 },
    bandText: { fontWeight: 600, fontSize: 7.1, color: '#FFFFFF', marginLeft: 9 },
    bandRight: { fontSize: 7.1, color: C.mint, marginLeft: 'auto' },

    profile: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: X, paddingTop: 12 },
    name: { fontFamily: display, fontSize: 18, lineHeight: 1.1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
    chipBox: { backgroundColor: C.chip, borderRadius: 4.5, paddingHorizontal: 6, paddingVertical: 2.2, marginRight: 6, marginBottom: 3 },
    chipText: { fontWeight: 600, fontSize: 6.8 },
    story: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 10.5, border: `0.75pt solid ${C.sandLine}` },
    storyCell: { paddingVertical: 7.5, paddingHorizontal: 10.5, borderLeft: `0.75pt solid ${C.sandSoft}`, justifyContent: 'center' },
    small: { fontWeight: 700, fontSize: 5.6, textTransform: 'uppercase', letterSpacing: 0.9, color: C.muted },
    hero: { fontWeight: 800, fontSize: 24, color: C.deep, lineHeight: 1.1 },
    heroSub: { fontSize: 6.4, color: C.muted },
    mini: { fontWeight: 800, fontSize: 15, marginTop: 2, marginBottom: 1 },
    miniUnit: { fontSize: 8.3, color: C.dotPrev },
    miniSub: { fontWeight: 600, fontSize: 6.4, color: C.muted },
    chg: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 5, paddingVertical: 1.5 },

    table: { marginHorizontal: X, marginTop: 10.5, backgroundColor: '#FFFFFF', borderRadius: 10.5, border: `0.75pt solid ${C.sandLine}` },
    th: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.sandHead, borderTopLeftRadius: 10.5, borderTopRightRadius: 10.5, paddingVertical: 5 },
    thText: { fontWeight: 700, fontSize: 5.6, textTransform: 'uppercase', letterSpacing: 0.75, color: '#5E6F6D', textAlign: 'center' },
    tr: { flexDirection: 'row', alignItems: 'center', borderTop: `0.75pt solid ${C.rowLine}` },
    subject: { fontWeight: 700, fontSize: 7.9 },
    teacher: { fontSize: 5.9, color: C.faint },
    n: { fontSize: 7.5, textAlign: 'center' },
    nb: { fontWeight: 800, fontSize: 8.6, textAlign: 'center' },
    nm: { fontSize: 7.5, textAlign: 'center', color: C.faint },
    grade: { alignSelf: 'center', minWidth: 19.5, borderRadius: 4.5, backgroundColor: C.gradeBg, paddingHorizontal: 4.5, paddingVertical: 1.5 },
    gradeText: { fontWeight: 800, fontSize: 7.5, color: C.deep, textAlign: 'center' },

    axis: { height: 10.5, position: 'relative', justifyContent: 'center' },
    axisLine: { height: 0.75, backgroundColor: '#EFE9DE' },
    seg: { position: 'absolute', top: 3.75, height: 3, borderRadius: 1.5 },
    dot: { position: 'absolute', top: 1.9, width: 6.8, height: 6.8, borderRadius: 3.4, marginLeft: -3.4 },
    avg: { position: 'absolute', top: 0, width: 1.1, height: 10.5, backgroundColor: C.gold },

    legend: { flexDirection: 'row', justifyContent: 'flex-end', marginHorizontal: X, marginTop: 4.5 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 10.5 },
    legendText: { fontSize: 5.9, color: '#6B7B79', marginLeft: 3 },

    panels: { flexDirection: 'row', marginHorizontal: X },
    panel: { backgroundColor: '#FFFFFF', border: `0.75pt solid ${C.sandLine}`, borderRadius: 10.5, paddingVertical: 9, paddingHorizontal: 10.5 },
    h3: { fontWeight: 800, fontSize: 6, textTransform: 'uppercase', letterSpacing: 1, color: C.band, marginBottom: 5.5 },
    cat: { flexDirection: 'row', alignItems: 'center', marginBottom: 6.5 },
    catName: { width: 60, fontSize: 6.8 },
    catBars: { flex: 1, marginHorizontal: 6 },
    catValue: { width: 22, fontWeight: 700, fontSize: 6.8, textAlign: 'right' },
    mv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3.5, borderBottom: `0.75pt dashed ${C.chip}` },
    mvText: { fontSize: 7.1 },
    note: { fontSize: 6.4, color: '#6B7B79', marginTop: 4.5 },
    vsBig: { fontFamily: display, fontSize: 25.5, color: C.deep, textAlign: 'center' },
    vsSub: { fontSize: 6.4, color: '#6B7B79', textAlign: 'center' },
    square: { width: 9, height: 9, borderRadius: 2.2, marginHorizontal: 1.5 },

    remarks: { flexDirection: 'row', marginHorizontal: X },
    remark: { flex: 1, backgroundColor: '#FFFFFF', border: `0.75pt solid ${C.sandLine}`, borderRadius: 10.5, paddingVertical: 7.5, paddingHorizontal: 10.5 },
    remarkText: { fontSize: 7.4, lineHeight: 1.55, flexGrow: 1, minHeight: 40 },
    sigLine: { borderBottom: `0.75pt solid ${C.dotPrev}`, height: 10.5, marginTop: 10 },
    sigText: { fontSize: 5.6, color: C.muted, marginTop: 2.5, textTransform: 'uppercase', letterSpacing: 0.75 },
});

/* ── Pieces ────────────────────────────────────────────────── */

function Change({ value, big }: { value: number; big?: boolean }) {
    return (
        <View style={[s.chg, { backgroundColor: value >= 0 ? C.upBg : C.downBg }, big ? { paddingHorizontal: 6.8, paddingVertical: 2.2 } : {}]}>
            <Trend value={value} size={big ? 8.3 : 6.8} colors={TREND} fontFamily={font} fontWeight={800} />
        </View>
    );
}

/** Previous → current on a 0–100 axis, with the class average as a tick. */
function Dumbbell({ row }: { row: SubjectRow }) {
    const now = row.mark;
    const prev = row.previous;
    const rising = now != null && prev != null ? now >= prev : true;
    const lo = now != null && prev != null ? Math.min(now, prev) : 0;
    const hi = now != null && prev != null ? Math.max(now, prev) : 0;
    return (
        <View style={s.axis}>
            <View style={s.axisLine} />
            {hi > lo && <View style={[s.seg, { left: `${lo}%`, width: `${hi - lo}%`, backgroundColor: rising ? C.upSeg : C.downSeg }]} />}
            {row.classAverage != null && <View style={[s.avg, { left: `${row.classAverage}%` }]} />}
            {prev != null && <View style={[s.dot, { left: `${prev}%`, backgroundColor: '#FFFFFF', border: `1.2pt solid ${C.dotPrev}` }]} />}
            {now != null && <View style={[s.dot, { left: `${now}%`, backgroundColor: rising ? C.teal : C.down }]} />}
        </View>
    );
}

interface Column {
    key: string;
    title: string;
    width: number;
    align?: 'left';
    cell: (row: SubjectRow) => React.ReactNode;
}

function columns(m: ReportModel): Column[] {
    const cols: Column[] = [{
        key: 'subject', title: m.subjectNoun, width: 0, align: 'left',
        cell: r => (<View><Text style={s.subject}>{r.name}</Text>{r.teacher && !m.compact ? <Text style={s.teacher}>{r.teacher}</Text> : null}</View>),
    }];
    if (m.paperCodes.length > 0) {
        cols.push({ key: 'papers', title: 'Papers', width: 11, cell: r => <Text style={s.nm}>{r.papers.filter(p => p != null).join(' · ') || '-'}</Text> });
    }
    if (m.hasPrevious) cols.push({ key: 'prev', title: m.previousLabel, width: 8, cell: r => <Text style={s.nm}>{r.previous ?? '-'}</Text> });
    cols.push({ key: 'now', title: m.hasPrevious ? 'Now' : 'Mark', width: 7, cell: r => <Text style={s.nb}>{r.mark ?? '-'}</Text> });
    cols.push({ key: 'axis', title: '', width: 26, align: 'left', cell: r => <Dumbbell row={r} /> });
    if (m.hasPrevious) {
        cols.push({ key: 'chg', title: 'Change', width: 9, cell: r => (r.change == null ? <Text style={s.nm}>-</Text> : <View style={{ alignItems: 'center' }}><Change value={r.change} /></View>) });
    }
    cols.push({ key: 'grade', title: m.gradeNoun, width: 7.5, cell: r => <View style={s.grade}><Text style={s.gradeText}>{r.grade}</Text></View> });
    if (m.isKCSE) cols.push({ key: 'pts', title: 'Pts', width: 5, cell: r => <Text style={[s.n, r.countsForPoints ? {} : { color: C.dotPrev }]}>{r.points ?? '-'}</Text> });
    cols.push({ key: 'rank', title: 'Rank', width: 7, cell: r => <Text style={s.nm}>{r.rank ?? '-'}</Text> });
    cols[0].width = 100 - cols.reduce((sum, c) => sum + c.width, 0);
    return cols;
}

function SubjectTable({ m }: { m: ReportModel }) {
    const cols = columns(m);
    const pad = m.compact ? 2.6 : 5 * m.rowScale;
    const cell = (c: Column): Style => ({
        width: `${c.width}%`,
        paddingLeft: c.key === 'subject' ? 9 : c.key === 'axis' ? 7.5 : 3,
        paddingRight: c.key === 'axis' ? 10.5 : 3,
    });
    return (
        <View style={s.table}>
            <View style={s.th}>
                {cols.map(c => (
                    <View key={c.key} style={cell(c)}>
                        {c.key === 'axis' ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                {['0', '50', '100'].map(t => <Text key={t} style={s.thText}>{t}</Text>)}
                            </View>
                        ) : <Text style={[s.thText, c.align ? { textAlign: 'left' } : {}]}>{c.title}</Text>}
                    </View>
                ))}
            </View>
            {m.subjects.map((r, i) => (
                <View key={`${r.name}-${i}`} style={[s.tr, { paddingVertical: pad }]} wrap={false}>
                    {cols.map(c => <View key={c.key} style={cell(c)}>{c.cell(r)}</View>)}
                </View>
            ))}
        </View>
    );
}

function Legend({ m }: { m: ReportModel }) {
    const dot = (fill: boolean): Style => ({ width: 6.8, height: 6.8, borderRadius: 3.4, ...(fill ? { backgroundColor: C.teal } : { border: `1.2pt solid ${C.dotPrev}` }) });
    const items: { label: string; swatch: Style }[] = [];
    if (m.hasPrevious) items.push({ label: m.previousLabel, swatch: dot(false) });
    items.push({ label: m.hasPrevious ? 'Now' : 'Mark', swatch: dot(true) });
    if (m.hasClassAverage) items.push({ label: 'Class average', swatch: { width: 1.1, height: 7.5, backgroundColor: C.gold } });
    if (m.hasPrevious) {
        items.push({ label: 'Improvement', swatch: { width: 9, height: 3, borderRadius: 1.5, backgroundColor: C.upSeg } });
        items.push({ label: 'Decline', swatch: { width: 9, height: 3, borderRadius: 1.5, backgroundColor: C.downSeg } });
    }
    return (
        <View style={s.legend}>
            {items.map(({ label, swatch }) => <View key={label} style={s.legendItem}><View style={swatch} /><Text style={s.legendText}>{label}</Text></View>)}
        </View>
    );
}

/* ── Panels ────────────────────────────────────────────────── */

const LEVEL_NAMES: Record<LevelFamily, string> = { EE: 'Exceeding', ME: 'Meeting', AE: 'Approaching', BE: 'Below' };

function CategoryPanel({ m }: { m: ReportModel }) {
    // 8-4-4 reads by subject group; CBC by how many areas sit in each level.
    if (m.isKCSE) {
        return (
            <View style={[s.panel, { flex: 1.2 }]}>
                <Text style={s.h3}>Performance by category</Text>
                {m.categories.map(c => (
                    <View key={c.name} style={s.cat}>
                        <Text style={s.catName}>{c.name}</Text>
                        <View style={s.catBars}>
                            <View style={{ height: 5.2, borderRadius: 3, backgroundColor: C.teal, width: `${c.mean}%` }} />
                            {c.previous != null && <View style={{ height: 3, borderRadius: 1.5, backgroundColor: C.prevBar, width: `${c.previous}%`, marginTop: 1.5 }} />}
                        </View>
                        <Text style={s.catValue}>{c.mean}%</Text>
                    </View>
                ))}
            </View>
        );
    }
    const families: LevelFamily[] = ['EE', 'ME', 'AE', 'BE'];
    const total = Math.max(1, m.ranked.length);
    return (
        <View style={[s.panel, { flex: 1.2 }]}>
            <Text style={s.h3}>Competency spread</Text>
            {families.map(f => {
                const count = m.ranked.filter(r => levelFamily(r.grade, r.mark) === f).length;
                return (
                    <View key={f} style={s.cat}>
                        <Text style={s.catName}><Text style={{ fontWeight: 700 }}>{f}</Text> <Text style={{ color: C.faint }}>{LEVEL_NAMES[f]}</Text></Text>
                        <View style={s.catBars}><View style={{ height: 5.2, borderRadius: 3, backgroundColor: C.teal, width: `${(count / total) * 100}%` }} /></View>
                        <Text style={s.catValue}>{count}</Text>
                    </View>
                );
            })}
        </View>
    );
}

function MoversPanel({ m }: { m: ReportModel }) {
    if (!m.hasPrevious) {
        return (
            <View style={[s.panel, { flex: 1 }]}>
                <Text style={s.h3}>Top {m.subjectNounPlural}</Text>
                {m.ranked.slice(0, 4).map(r => (
                    <View key={r.name} style={s.mv}><Text style={s.mvText}>{r.name}</Text><Text style={[s.mvText, { fontWeight: 800 }]}>{r.mark}%</Text></View>
                ))}
            </View>
        );
    }
    const gains = m.movers.filter(r => (r.change ?? 0) > 0).slice(0, 3);
    const drop = m.movers.length > 0 ? m.movers[m.movers.length - 1] : undefined;
    const list = drop && (drop.change ?? 0) < 0 && !gains.includes(drop) ? [...gains, drop] : gains;
    return (
        <View style={[s.panel, { flex: 1 }]}>
            <Text style={s.h3}>Biggest movers</Text>
            {list.map(r => (
                <View key={r.name} style={s.mv}>
                    <Text style={s.mvText}>{r.name}</Text>
                    <Trend value={r.change ?? 0} size={7.1} colors={TREND} fontFamily={font} fontWeight={800} />
                </View>
            ))}
            <Text style={s.note}>{m.improvedCount} of {m.movers.length} {m.subjectNounPlural} improved this term.</Text>
        </View>
    );
}

function AgainstClass({ m }: { m: ReportModel }) {
    if (!m.hasClassAverage) return null;
    const rated = m.ranked.filter(r => r.classAverage != null);
    return (
        <View style={[s.panel, { flex: 1, marginLeft: 9, alignItems: 'center' }]}>
            <Text style={[s.h3, { alignSelf: 'flex-start' }]}>Against the class</Text>
            <Text style={s.vsBig}>{m.aboveClassCount}<Text style={{ fontSize: 12, color: C.dotPrev }}> / {rated.length}</Text></Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 4.5 }}>
                {rated.map((r, i) => <View key={`${r.name}-${i}`} style={[s.square, { backgroundColor: (r.mark ?? 0) >= (r.classAverage ?? 0) ? C.teal : C.sandLine, marginBottom: 3 }]} />)}
            </View>
            <Text style={s.vsSub}>{m.subjectNounPlural} at or above the class average</Text>
            {m.classMean != null && <Text style={s.vsSub}>Mean {m.mean}% vs class {m.classMean}%</Text>}
        </View>
    );
}

function Remark({ role, text, sign }: { role: string; text: string; sign: string }) {
    return (
        <View style={s.remark}>
            <Text style={s.h3}>{role}</Text>
            <Text style={s.remarkText}>{text}</Text>
            <View style={s.sigLine} />
            <Text style={s.sigText}>{sign}</Text>
        </View>
    );
}

export function GrowthLayout({ data, qrCodeDataUri }: LayoutProps) {
    const m = buildReportModel(data, qrCodeDataUri);
    return (
        <View style={s.page}>
            <View style={s.head}>
                <Crest logo={m.school.logo} initial={m.school.initial} size={37.5} background={C.gold} color={C.deep} fontFamily={display} fontWeight={400} />
                <View style={{ flex: 1, marginLeft: 10.5 }}>
                    <Text style={s.school}>{m.school.name}</Text>
                    {m.school.address && <Text style={s.address}>{m.school.address}</Text>}
                </View>
                {m.qrCode && <Image src={m.qrCode} style={s.qr} />}
            </View>
            <View style={s.band}>
                <View style={s.tag}><Text style={s.tagText}>Progress report</Text></View>
                <Text style={s.bandText}>{m.exam.title} · {m.exam.year}</Text>
                {m.hasPrevious && <Text style={s.bandRight}>Compared with {m.previousLabel}</Text>}
            </View>

            <View style={s.profile}>
                <View style={{ flex: 1, justifyContent: 'center', paddingRight: 12 }}>
                    <Text style={s.name}>{m.learner.name}</Text>
                    <View style={s.chips}>
                        {[m.learner.admission, m.learner.className, m.learner.pathway ?? `${m.subjects.length} ${m.subjectNounPlural}`].map(t => (
                            <View key={t} style={s.chipBox}><Text style={s.chipText}>{t}</Text></View>
                        ))}
                    </View>
                </View>
                <View style={s.story}>
                    <View style={[s.storyCell, { borderLeftWidth: 0 }]}>
                        <Text style={s.small}>Mean score</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={s.hero}>{m.mean}%</Text>
                            {m.meanChange != null && <View style={{ marginLeft: 6 }}><Change value={m.meanChange} big /></View>}
                        </View>
                        {m.meanChange != null && <Text style={s.heroSub}>from {m.mean - m.meanChange}% in {m.previousLabel}</Text>}
                    </View>
                    {m.position && (
                        <View style={s.storyCell}>
                            <Text style={s.small}>Position</Text>
                            <Text style={s.mini}>{m.position.rank}<Text style={s.miniUnit}>/{m.position.of}</Text></Text>
                            {m.positionChange != null
                                ? <Trend value={m.positionChange} size={6.4} colors={TREND} fontFamily={font} suffix="places" />
                                : <Text style={s.miniSub}>in the class</Text>}
                        </View>
                    )}
                    {m.isKCSE && m.points != null && (
                        <View style={s.storyCell}>
                            <Text style={s.small}>Points</Text>
                            <Text style={s.mini}>{m.points}</Text>
                            {m.pointsChange != null
                                ? <Trend value={m.pointsChange} size={6.4} colors={TREND} fontFamily={font} />
                                : <Text style={s.miniSub}>best seven</Text>}
                        </View>
                    )}
                    <View style={s.storyCell}>
                        <Text style={s.small}>{m.gradeNoun}</Text>
                        <Text style={s.mini}>{m.grade}</Text>
                        <Text style={s.miniSub}>{m.classMean != null ? `class mean ${m.classMean}%` : m.gradeCaption}</Text>
                    </View>
                </View>
            </View>

            <SubjectTable m={m} />
            <Legend m={m} />

            <View style={{ flexGrow: 1, paddingTop: 9 }}>
                <View style={s.panels} wrap={false}>
                    <CategoryPanel m={m} />
                    <View style={{ width: 9 }} />
                    <MoversPanel m={m} />
                    <AgainstClass m={m} />
                </View>
                <View style={[s.remarks, { flexGrow: 1, marginTop: 9 }]} wrap={false}>
                    <Remark role="Class teacher" text={m.teacherComment} sign="Signature" />
                    <View style={{ width: 9 }} />
                    <Remark role="Principal" text={m.principalComment} sign="Signature" />
                    <View style={{ width: 9 }} />
                    <View style={[s.remark, { flex: 0.72, backgroundColor: C.deep, borderColor: C.deep }]}>
                        <Text style={[s.h3, { color: C.gold }]}>{m.exam.openingDate ? 'Next term opens' : 'Parent / Guardian'}</Text>
                        <Text style={{ fontFamily: display, fontSize: 14.3, color: '#FFFFFF', flexGrow: 1 }}>{m.exam.openingDate ?? ''}</Text>
                        <View style={[s.sigLine, { borderBottomColor: '#6D9A96' }]} />
                        <Text style={[s.sigText, { color: C.mint }]}>Parent / Guardian</Text>
                    </View>
                </View>
            </View>

            <BrandFooter ruleColor={C.deep} ruleOpacity={0.35} meta={reportFooterMeta(!!m.qrCode, m.exam.issued)} paddingX={X} paddingBottom={12} />
        </View>
    );
}
