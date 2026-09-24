/**
 * EDITORIAL — the ink-only card (template id "minimal").
 * Black on white and one grey: large serif figures, hairline rules and a
 * one-colour bar per subject, so it prints cleanly on any office printer.
 */
import React from 'react';
import { Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { FONTS } from '../pdfTheme';
import { buildReportModel, signed, type ReportModel, type SubjectRow } from '../reportModel';
import { BrandFooter, reportFooterMeta } from '../primitives';
import type { LayoutProps } from '../templates';

const INK = '#000000';
const GREY = '#666666';
const SOFT = '#555555';
const HAIR = '#D6D6D6';
const X = 34.5;

const sans = FONTS.inter;
const serif = FONTS.instrument;

const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: '#FFFFFF', fontFamily: sans, color: INK, paddingTop: 28.5, paddingHorizontal: X },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    school: { fontFamily: serif, fontSize: 22.5, lineHeight: 1 },
    address: { fontSize: 6.4, color: SOFT, marginTop: 5 },
    doc: { fontWeight: 600, fontSize: 6, textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'right', lineHeight: 1.5 },
    rule: { height: 2.25, backgroundColor: INK, marginTop: 10.5 },

    label: { fontWeight: 600, fontSize: 5.6, textTransform: 'uppercase', letterSpacing: 1.2, color: GREY, marginBottom: 3 },
    id: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 10.5, borderBottom: `0.6pt solid ${INK}` },
    name: { fontFamily: serif, fontSize: 22.5, lineHeight: 1 },
    kv: { fontWeight: 600, fontSize: 8.3 },
    qr: { width: 40, height: 40, marginLeft: 12 },

    figs: { flexDirection: 'row', borderBottom: `0.6pt solid ${INK}` },
    fig: { flex: 1, paddingVertical: 9, paddingLeft: 10.5, borderLeft: `0.45pt solid #CFCFCF` },
    figValue: { fontFamily: serif, fontSize: 25.5, lineHeight: 1 },
    figBig: { fontFamily: serif, fontSize: 46.5, lineHeight: 1 },
    figSub: { fontSize: 6.4, color: SOFT, marginTop: 3 },

    table: { marginTop: 10.5 },
    th: { flexDirection: 'row', alignItems: 'flex-end', borderBottom: `1pt solid ${INK}`, paddingBottom: 4.5 },
    thText: { fontWeight: 600, fontSize: 5.5, textTransform: 'uppercase', letterSpacing: 0.9, color: GREY, textAlign: 'center' },
    tr: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.4pt solid ${HAIR}` },
    no: { fontSize: 6.4, color: '#999999' },
    subject: { fontWeight: 600, fontSize: 7.9 },
    teacher: { fontSize: 5.9, color: '#888888' },
    n: { fontSize: 7.5, textAlign: 'center' },
    nb: { fontWeight: 700, fontSize: 7.5, textAlign: 'center' },
    nm: { fontSize: 7.5, textAlign: 'center', color: GREY },
    remark: { fontFamily: serif, fontStyle: 'italic', fontSize: 8.3, color: '#333333' },
    track: { height: 3.8, backgroundColor: '#EDEDED', position: 'relative' },
    fill: { height: 3.8, backgroundColor: INK },
    tick: { position: 'absolute', top: -2.2, width: 0.9, height: 8.2, backgroundColor: INK },
    tf: { flexDirection: 'row', alignItems: 'center', borderBottom: `1pt solid ${INK}`, paddingVertical: 5 },

    glance: { flexDirection: 'row', borderBottom: `0.6pt solid ${INK}` },
    glanceCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 10.5, borderLeft: `0.45pt solid #CFCFCF` },
    glanceValue: { fontFamily: serif, fontSize: 14.3, lineHeight: 1.1 },
    glanceSub: { fontSize: 6.4, color: SOFT, marginTop: 2 },

    key: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7.5, borderBottom: `0.6pt solid ${INK}` },
    keyItems: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
    keyItem: { fontSize: 6.4, color: '#444444', marginRight: 10.5, marginBottom: 2 },

    remarks: { flexDirection: 'row', paddingTop: 10.5 },
    remarkText: { flexGrow: 1, fontFamily: serif, fontSize: 10.5, lineHeight: 1.35, minHeight: 44 },
    sigLine: { borderBottom: `0.6pt solid ${INK}`, height: 16.5 },
    sigText: { fontSize: 6, color: SOFT, marginTop: 2.5 },
    parent: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 12 },
    open: { borderLeft: `2.25pt solid ${INK}`, paddingLeft: 7.5 },
    openValue: { fontFamily: serif, fontSize: 12.8 },
});

/* ── Table ─────────────────────────────────────────────────── */

interface Column {
    key: string;
    title: string;
    width: number;
    align?: 'left';
    cell: (row: SubjectRow, index: number) => React.ReactNode;
    total?: React.ReactNode;
}

function Bar({ mark, avg }: { mark: number | null; avg?: number }) {
    return (
        <View style={s.track}>
            <View style={[s.fill, { width: `${mark ?? 0}%` }]} />
            {avg != null && <View style={[s.tick, { left: `${avg}%` }]} />}
        </View>
    );
}

function columns(m: ReportModel): Column[] {
    const cols: Column[] = [
        { key: 'no', title: 'No.', width: 4.5, align: 'left', cell: (_, i) => <Text style={s.no}>{String(i + 1).padStart(2, '0')}</Text> },
        {
            key: 'subject', title: m.subjectNoun, width: 0, align: 'left',
            cell: r => (
                <View>
                    <Text style={s.subject}>{r.name}</Text>
                    {r.teacher && !m.compact ? <Text style={s.teacher}>{r.teacher}</Text> : null}
                </View>
            ),
            total: <Text style={s.subject}>Overall</Text>,
        },
    ];
    if (m.paperCodes.length > 0) {
        cols.push({ key: 'papers', title: 'Papers', width: 11, cell: r => <Text style={s.nm}>{r.papers.filter(p => p != null).join(' / ')}</Text> });
    }
    cols.push({ key: 'mark', title: 'Mark', width: 6.5, cell: r => <Text style={s.nb}>{r.mark ?? '-'}</Text>, total: <Text style={s.nb}>{m.mean}</Text> });
    cols.push({
        key: 'bar', title: '0 — 50 — 100', width: 17, align: 'left',
        cell: r => <Bar mark={r.mark} avg={r.classAverage} />,
        total: <Bar mark={m.mean} avg={m.classMean} />,
    });
    if (m.hasPrevious) {
        cols.push({
            key: 'dev', title: 'Change', width: 7,
            cell: r => <Text style={s.nm}>{r.change == null ? '-' : signed(r.change)}</Text>,
            total: <Text style={s.n}>{m.meanChange == null ? '' : signed(m.meanChange)}</Text>,
        });
    }
    cols.push({ key: 'grade', title: m.gradeNoun, width: 6.5, cell: r => <Text style={s.nb}>{r.grade}</Text>, total: <Text style={s.nb}>{m.grade}</Text> });
    if (m.isKCSE) {
        cols.push({
            key: 'pts', title: 'Pts', width: 5,
            cell: r => <Text style={[s.n, r.countsForPoints ? {} : { color: '#AAAAAA' }]}>{r.points ?? '-'}</Text>,
            total: <Text style={s.nb}>{m.points ?? ''}</Text>,
        });
    }
    if (m.showPositions) cols.push({
        key: 'rank', title: 'Rank', width: 7, cell: r => <Text style={s.nm}>{r.rank ?? '-'}</Text>,
        total: <Text style={s.n}>{m.position ? `${m.position.rank}/${m.position.of}` : ''}</Text>,
    });
    cols.push({ key: 'remark', title: 'Remark', width: 0, align: 'left', cell: r => <Text style={s.remark}>{r.remark}</Text> });

    const fixed = cols.reduce((sum, c) => sum + c.width, 0);
    cols[1].width = (100 - fixed) * 0.5;
    cols[cols.length - 1].width = (100 - fixed) * 0.5;
    return cols;
}

function SubjectTable({ m }: { m: ReportModel }) {
    const cols = columns(m);
    const pad = m.compact ? 3 : 5.6 * m.rowScale;
    const cell = (c: Column): Style => ({ width: `${c.width}%`, paddingHorizontal: 3, alignItems: c.align ? 'flex-start' : 'center' });
    return (
        <View style={s.table}>
            <View style={s.th}>
                {cols.map(c => <View key={c.key} style={cell(c)}><Text style={[s.thText, c.align ? { textAlign: 'left' } : {}]}>{c.title}</Text></View>)}
            </View>
            {m.subjects.map((r, i) => (
                <View key={`${r.name}-${i}`} style={[s.tr, { paddingVertical: pad }]} wrap={false}>
                    {cols.map(c => <View key={c.key} style={[cell(c), c.key === 'bar' ? { alignItems: 'stretch' } : {}]}>{c.cell(r, i)}</View>)}
                </View>
            ))}
            <View style={s.tf}>
                {cols.map(c => (
                    <View key={c.key} style={[cell(c), c.key === 'bar' ? { alignItems: 'stretch' } : {}]}>
                        {c.total ?? (c.key === 'remark' && m.hasClassAverage ? <Text style={[s.remark, { fontSize: 7.5 }]}>Bar = mark · tick = class average</Text> : null)}
                    </View>
                ))}
            </View>
        </View>
    );
}

/* ── Sections ─────────────────────────────────────────────── */

function Figure({ label, value, sub, first, big }: { label: string; value: string; sub?: string; first?: boolean; big?: boolean }) {
    return (
        <View style={[s.fig, big ? { flex: 1.6 } : {}, first ? { borderLeftWidth: 0, paddingLeft: 0 } : {}]}>
            <Text style={s.label}>{label}</Text>
            <Text style={big ? s.figBig : s.figValue}>{value}</Text>
            {sub ? <Text style={s.figSub}>{sub}</Text> : null}
        </View>
    );
}

function Glance({ m }: { m: ReportModel }) {
    const best = m.ranked[0];
    const weakest = m.ranked.length > 1 ? m.ranked[m.ranked.length - 1] : undefined;
    const mover = m.movers[0];
    const cells: { label: string; value: string; sub: string }[] = [];
    if (best) cells.push({ label: 'Strongest', value: best.name, sub: `${best.mark}%${best.rank ? ` · rank ${best.rank}` : ''}` });
    if (weakest) cells.push({ label: 'Needs focus', value: weakest.name, sub: `${weakest.mark}%${weakest.classAverage != null ? ` · class avg ${weakest.classAverage}%` : ''}` });
    if (mover && (mover.change ?? 0) > 0) cells.push({ label: 'Most improved', value: mover.name, sub: `${signed(mover.change ?? 0)} since ${m.previousLabel}` });
    if (m.hasClassAverage) cells.push({ label: 'Above class average', value: `${m.aboveClassCount} of ${m.ranked.length}`, sub: m.subjectNounPlural });
    if (cells.length === 0) return null;
    return (
        <View style={s.glance} wrap={false}>
            {cells.map((c, i) => (
                <View key={c.label} style={[s.glanceCell, i === 0 ? { borderLeftWidth: 0, paddingLeft: 0 } : {}]}>
                    <Text style={s.label}>{c.label}</Text>
                    <Text style={s.glanceValue}>{c.value}</Text>
                    <Text style={s.glanceSub}>{c.sub}</Text>
                </View>
            ))}
        </View>
    );
}

function Signature({ name }: { name: string }) {
    return <View><View style={s.sigLine} /><Text style={s.sigText}>{name}</Text></View>;
}

export function EditorialLayout({ data, qrCodeDataUri }: LayoutProps) {
    const m = buildReportModel(data, qrCodeDataUri);
    return (
        <View style={s.page}>
            <View style={s.head}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={s.school}>{m.school.name}</Text>
                    {m.school.address && <Text style={s.address}>{m.school.address}</Text>}
                </View>
                <Text style={s.doc}>{'Learner\nAcademic\nReport'}</Text>
            </View>
            <View style={s.rule} />

            <View style={s.id}>
                <View style={{ flex: 2.4, paddingRight: 10 }}>
                    <Text style={s.label}>Learner</Text>
                    <Text style={s.name}>{m.learner.name}</Text>
                </View>
                <View style={{ flex: 1 }}><Text style={s.label}>Admission</Text><Text style={s.kv}>{m.learner.admission}</Text></View>
                <View style={{ flex: 1 }}><Text style={s.label}>Class</Text><Text style={s.kv}>{m.learner.className}</Text></View>
                <View style={{ flex: 1.5 }}><Text style={s.label}>Assessment</Text><Text style={s.kv}>{m.exam.title}</Text><Text style={[s.kv, { fontWeight: 400, color: SOFT }]}>{m.exam.year}</Text></View>
                {m.qrCode && <Image src={m.qrCode} style={s.qr} />}
            </View>

            <View style={s.figs} wrap={false}>
                <Figure first big label="Mean score" value={`${m.mean}%`} sub={m.meanChange != null ? `${signed(m.meanChange)} since ${m.previousLabel}` : undefined} />
                <Figure label={m.isKCSE ? 'Mean grade' : 'Level'} value={m.grade} sub={m.gradeCaption} />
                {m.isKCSE && m.points != null && <Figure label="Points" value={`${m.points}`} sub={m.pointsChange != null ? `${signed(m.pointsChange)} since ${m.previousLabel}` : 'Best-seven total'} />}
                {m.position && <Figure label="Position" value={`${m.position.rank}`} sub={`of ${m.position.of} learners${m.overallPosition ? ` · overall ${m.overallPosition.rank}/${m.overallPosition.of}` : ''}`} />}
                {m.classMean != null && <Figure label="Class mean" value={`${m.classMean}`} sub={m.vsClassMean != null ? `${signed(m.vsClassMean)} difference` : undefined} />}
            </View>

            <SubjectTable m={m} />

            <View style={{ flexGrow: 1, paddingTop: 9 }}>
                <Glance m={m} />
                <View style={s.key} wrap={false}>
                    <Text style={[s.label, { width: 80, marginBottom: 0, marginTop: 1 }]}>{m.isKCSE ? 'Grading scale' : 'Competency levels'}</Text>
                    <View style={s.keyItems}>
                        {m.scale.map(row => (
                            <Text key={row.symbol} style={s.keyItem}>
                                <Text style={{ fontWeight: 700, color: INK }}>{row.symbol}</Text> {row.range}{!m.isKCSE && row.label && m.scale.length <= 4 ? ` · ${row.label}` : ''}
                            </Text>
                        ))}
                    </View>
                </View>
                <View style={[s.remarks, { flexGrow: 1 }]} wrap={false}>
                    <View style={{ flex: 1, marginRight: 19.5 }}>
                        <Text style={s.label}>Class teacher</Text>
                        <Text style={[s.remarkText, m.compact ? { minHeight: 28 } : {}]}>{m.teacherComment}</Text>
                        <Signature name="Class teacher's signature" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.label}>Principal</Text>
                        <Text style={[s.remarkText, m.compact ? { minHeight: 28 } : {}]}>{m.principalComment}</Text>
                        <Signature name="Principal's signature" />
                    </View>
                </View>
                <View style={s.parent} wrap={false}>
                    <View style={{ flex: 1, marginRight: 19.5 }}><Signature name="Parent / Guardian" /></View>
                    <View style={{ flex: 0.6, marginRight: 19.5 }}><Signature name="Date" /></View>
                    <View style={[{ flex: 1 }, m.exam.openingDate ? s.open : {}]}>
                        {m.exam.openingDate && (<><Text style={s.label}>Next term opens</Text><Text style={s.openValue}>{m.exam.openingDate}</Text></>)}
                    </View>
                </View>
            </View>

            <BrandFooter mono ruleColor={INK} meta={reportFooterMeta(!!m.qrCode, m.exam.issued)} paddingX={0} paddingBottom={16} textColor={SOFT} />
        </View>
    );
}
