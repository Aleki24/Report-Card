import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { bandForGrade } from '@/lib/curriculum-bands';
import { WEEKDAY_LABELS, WEEKDAY_NAMES, sectionFor, type TimetableConfig, type TimetableLesson } from '@/lib/timetable/config';
import { gridRows, lessonsAt, type GridRow } from '@/lib/timetable/layout';
import { shortSubject, teacherName, type GridMode } from '@/lib/ops/forms/academics';

/**
 * Printable timetables, laid out the way Kenyan schools pin them up: days down
 * the side, periods across, breaks as shaded columns. A class, teacher or room
 * prints one page; the master copy prints a cover, the whole school day by
 * day (every class against every period), each class, each teacher, and the
 * teachers' weekly loads. Every page carries a faint Skulbase watermark.
 */

const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const BRAND = '#1A365D';
const ACCENT = '#2563EB';
const BREAK_FILL = '#FEF3C7';
const BLOCK_FILL = '#EDE9FE';

/** Soft fills so each subject reads at a glance, in colour or greyscale. */
const SUBJECT_FILLS = ['#DBEAFE', '#DCFCE7', '#FCE7F3', '#E0E7FF', '#CCFBF1', '#FFE4E6', '#FFEDD5', '#E0F2FE', '#ECFCCB', '#F3E8FF', '#FEF9C3', '#F1F5F9'] as const;

function fillFor(key: string): string {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return SUBJECT_FILLS[h % SUBJECT_FILLS.length];
}

const PAGE = { width: 842, height: 595, margin: 26 } as const;
const HEADER_H = 50;
const FOOTER_H = 20;
const HEAD_ROW_H = 28;
const LABEL_W = 58;
const BREAK_W = 15;

const st = StyleSheet.create({
    page: { padding: PAGE.margin, paddingBottom: PAGE.margin + FOOTER_H, fontFamily: 'Helvetica', fontSize: 8, color: INK },
    watermark: { position: 'absolute', top: 230, left: 0, right: 0, textAlign: 'center', fontSize: 120, fontFamily: 'Helvetica-Bold', color: BRAND, opacity: 0.045, transform: 'rotate(-24deg)', letterSpacing: 6 },
    header: { height: HEADER_H, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    logo: { width: 38, height: 38, objectFit: 'contain', marginRight: 10 },
    school: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
    title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND, marginTop: 1 },
    chip: { marginLeft: 'auto', alignItems: 'flex-end' },
    chipLabel: { fontSize: 7, color: '#FFFFFF', backgroundColor: BRAND, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3, textTransform: 'uppercase', letterSpacing: 0.8 },
    chipSub: { fontSize: 7.5, color: MUTED, marginTop: 4 },
    rule: { height: 3, backgroundColor: BRAND, borderRadius: 2, marginBottom: 10 },
    table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
    row: { flexDirection: 'row' },
    headCell: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2, borderLeftWidth: 1, borderLeftColor: LINE },
    headLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: BRAND },
    headTime: { fontSize: 6, color: MUTED, marginTop: 1 },
    rowLabel: { width: LABEL_W, justifyContent: 'center', paddingHorizontal: 6, backgroundColor: '#F8FAFC' },
    rowLabelText: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: BRAND },
    rowLabelSub: { fontSize: 6, color: MUTED, marginTop: 1 },
    cell: { padding: 1.5, borderLeftWidth: 1, borderLeftColor: LINE },
    lesson: { flex: 1, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 2, justifyContent: 'center' },
    top: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, lineHeight: 1.15 },
    bottom: { fontSize: 6, color: '#4B5563', marginTop: 1.5 },
    breakCol: { width: BREAK_W, backgroundColor: BREAK_FILL, borderLeftWidth: 1, borderLeftColor: LINE, justifyContent: 'center', alignItems: 'center' },
    breakText: { fontSize: 5.5, color: '#92400E', letterSpacing: 0.6, textTransform: 'uppercase', transform: 'rotate(-90deg)', width: 90, textAlign: 'center' },
    footer: { position: 'absolute', left: PAGE.margin, right: PAGE.margin, bottom: 12, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 5, fontSize: 6.5, color: MUTED },
    brandMark: { fontFamily: 'Helvetica-Bold', color: BRAND },
    coverBand: { backgroundColor: BRAND, borderRadius: 8, padding: 28, marginTop: 40 },
    coverEyebrow: { fontSize: 9, color: '#BFDBFE', textTransform: 'uppercase', letterSpacing: 2 },
    coverTitle: { fontSize: 30, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', marginTop: 6 },
    coverSub: { fontSize: 12, color: '#DBEAFE', marginTop: 6 },
    statRow: { flexDirection: 'row', marginTop: 26, gap: 14 },
    stat: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 12 },
    statValue: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: INK },
    statLabel: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
    contentsHead: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND, textTransform: 'uppercase', letterSpacing: 1, marginTop: 22, marginBottom: 6 },
    contentsLine: { fontSize: 9, color: INK, marginBottom: 3 },
    loadRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5 },
    loadName: { width: 170, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
    loadNum: { width: 60, fontSize: 8.5, textAlign: 'right', paddingRight: 10 },
    loadTrack: { width: 160, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, marginRight: 12 },
    loadClasses: { flex: 1, fontSize: 7.5, color: MUTED },
});

export interface TimetableSheet {
    title: string;
    /** e.g. "Class timetable · Junior & Senior School" */
    subtitle: string;
    mode: GridMode;
    lessons: TimetableLesson[];
}

/** One day of the whole school: every class (rows) against the periods (columns). */
export interface DaySheet {
    day: number;
    section: string;
    classes: { name: string; lessons: TimetableLesson[] }[];
}

export interface TeacherLoadRow { name: string; lessons: number; capacity: number; classes: string }

export interface TimetablePdfData {
    schoolName: string;
    logoUrl?: string | null;
    /** e.g. "Term 3 timetable" or "Published timetable". */
    versionName: string;
    generatedAt: string;
    config: TimetableConfig;
    sheets: TimetableSheet[];
    /** The master copy: its cover, the whole school day by day, and teacher loads. */
    cover?: { classes: number; teachers: number; lessons: number; sections: { name: string; classes: string[] }[] };
    days?: DaySheet[];
    loads?: TeacherLoadRow[];
}

const lessonWidth = (rows: readonly GridRow[], labelW = LABEL_W) => {
    const teaching = rows.filter(r => !r.isBreak).length;
    const breaks = rows.length - teaching;
    return (PAGE.width - PAGE.margin * 2 - 2 - labelW - breaks * BREAK_W) / Math.max(1, teaching);
};

/** The short teacher label a cell has room for: "J. Otieno". */
const shortTeacher = (t: TimetableLesson['teacher']) => (t ? `${t.first_name.trim().charAt(0)}. ${t.last_name}`.trim() : '');

/** What a cell says, by whose timetable it is: subject names, never codes. */
function cellText(lessons: readonly TimetableLesson[], mode: GridMode | 'school'): [string, string] {
    if (lessons.length > 1) return [lessons.map(l => shortSubject(l.subject?.name)).join(' / '), 'Option block'];
    const l = lessons[0];
    const subject = shortSubject(l.subject?.name);
    if (mode === 'teacher') return [subject, [l.stream?.full_name, l.room?.name].filter(Boolean).join(' · ')];
    if (mode === 'room') return [subject, [l.stream?.full_name, shortTeacher(l.teacher)].filter(Boolean).join(' · ')];
    return [subject, [shortTeacher(l.teacher), mode === 'class' ? l.room?.name : null].filter(Boolean).join(' · ')];
}

function Cell({ lessons, width, mode, height }: { lessons: TimetableLesson[]; width: number; mode: GridMode | 'school'; height: number }) {
    if (lessons.length === 0) return <View style={[st.cell, { width, height }]} />;
    const [top, bottom] = cellText(lessons, mode);
    return (
        <View style={[st.cell, { width, height }]}>
            <View style={[st.lesson, { backgroundColor: lessons.length > 1 ? BLOCK_FILL : fillFor(lessons[0].subject_id) }]}>
                <Text style={st.top}>{top}</Text>
                {bottom ? <Text style={st.bottom}>{bottom}</Text> : null}
            </View>
        </View>
    );
}

/** The period header across the top: lessons with their times, breaks as narrow shaded columns. */
function HeadRow({ rows, width, corner }: { rows: GridRow[]; width: number; corner: string }) {
    return (
        <View style={[st.row, { height: HEAD_ROW_H, borderBottomWidth: 1, borderBottomColor: LINE }]}>
            <View style={[st.rowLabel, { backgroundColor: '#F1F5F9' }]}><Text style={{ fontSize: 6.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 }}>{corner}</Text></View>
            {rows.map(r => r.isBreak
                ? <View key={r.key} style={[st.breakCol, { backgroundColor: '#FDE68A' }]} />
                : (
                    <View key={r.key} style={[st.headCell, { width, backgroundColor: '#F1F5F9' }]}>
                        <Text style={st.headLabel}>{r.label}</Text>
                        <Text style={st.headTime}>{r.time}</Text>
                    </View>
                ))}
        </View>
    );
}

/** A break column through a run of rows, its name written up the column. */
const BreakColumn = ({ row, height }: { row: GridRow; height: number }) => (
    <View style={[st.breakCol, { height }]}><Text style={st.breakText}>{row.label}</Text></View>
);

/** One timetable: days down the side, periods across. */
function WeekGrid({ config, sheet }: { config: TimetableConfig; sheet: TimetableSheet }) {
    const rows = gridRows(config, sheet.lessons);
    const width = lessonWidth(rows);
    const avail = PAGE.height - PAGE.margin * 2 - FOOTER_H - HEADER_H - 23 - HEAD_ROW_H;
    const rowH = Math.min(78, avail / Math.max(1, config.days.length));
    return (
        <View style={st.table}>
            <HeadRow rows={rows} width={width} corner="Day" />
            {config.days.map((d, di) => (
                <View key={d} style={[st.row, { height: rowH }, di > 0 ? { borderTopWidth: 1, borderTopColor: LINE } : {}]} wrap={false}>
                    <View style={st.rowLabel}><Text style={st.rowLabelText}>{WEEKDAY_LABELS[d]}</Text></View>
                    {rows.map(r => r.isBreak
                        ? (di === 0 ? <View key={r.key} style={[st.breakCol, { height: rowH }]}><Text style={st.breakText}>{r.label}</Text></View> : <View key={r.key} style={[st.breakCol, { height: rowH }]} />)
                        : <Cell key={r.key} lessons={lessonsAt(config, sheet.lessons, d, r)} width={width} mode={sheet.mode} height={rowH} />)}
                </View>
            ))}
        </View>
    );
}

/** The whole school on one day: every class against every period. */
function DayGrid({ config, sheet }: { config: TimetableConfig; sheet: DaySheet }) {
    const all = sheet.classes.flatMap(c => c.lessons);
    const rows = gridRows(config, all);
    const labelW = 74;
    const width = lessonWidth(rows, labelW);
    const avail = PAGE.height - PAGE.margin * 2 - FOOTER_H - HEADER_H - 23 - HEAD_ROW_H;
    const rowH = Math.max(26, Math.min(56, avail / Math.max(1, sheet.classes.length)));
    return (
        <View style={st.table}>
            <View style={[st.row, { height: HEAD_ROW_H, borderBottomWidth: 1, borderBottomColor: LINE }]}>
                <View style={[st.rowLabel, { width: labelW, backgroundColor: '#F1F5F9' }]}><Text style={{ fontSize: 6.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 }}>Class</Text></View>
                {rows.map(r => r.isBreak
                    ? <View key={r.key} style={[st.breakCol, { backgroundColor: '#FDE68A' }]} />
                    : <View key={r.key} style={[st.headCell, { width, backgroundColor: '#F1F5F9' }]}><Text style={st.headLabel}>{r.label}</Text><Text style={st.headTime}>{r.time}</Text></View>)}
            </View>
            {sheet.classes.map((c, ci) => (
                <View key={c.name} style={[st.row, { height: rowH }, ci > 0 ? { borderTopWidth: 1, borderTopColor: LINE } : {}]} wrap={false}>
                    <View style={[st.rowLabel, { width: labelW }]}><Text style={st.rowLabelText}>{c.name}</Text></View>
                    {rows.map(r => r.isBreak
                        ? <BreakColumn key={r.key} row={ci === 0 ? r : { ...r, label: '' }} height={rowH} />
                        : <Cell key={r.key} lessons={lessonsAt(config, c.lessons, sheet.day, r)} width={width} mode="school" height={rowH} />)}
                </View>
            ))}
        </View>
    );
}

function Watermark() {
    return <Text style={st.watermark} fixed>Skulbase</Text>;
}

function Header({ data, title, label, sub }: { data: TimetablePdfData; title: string; label: string; sub: string }) {
    return (
        <>
            <View style={st.header}>
                {data.logoUrl ? <Image src={data.logoUrl} style={st.logo} /> : null}
                <View>
                    <Text style={st.school}>{data.schoolName}</Text>
                    <Text style={st.title}>{title}</Text>
                </View>
                <View style={st.chip}>
                    <Text style={st.chipLabel}>{label}</Text>
                    <Text style={st.chipSub}>{sub}</Text>
                </View>
            </View>
            <View style={st.rule} />
        </>
    );
}

function Footer({ data }: { data: TimetablePdfData }) {
    return (
        <View style={st.footer} fixed>
            <Text>{data.schoolName} · {data.versionName}</Text>
            <Text render={({ pageNumber, totalPages }) => `Generated ${data.generatedAt} · Page ${pageNumber} of ${totalPages}`} />
            <Text>Made with <Text style={st.brandMark}>Skulbase</Text></Text>
        </View>
    );
}

function Cover({ data, cover }: { data: TimetablePdfData; cover: NonNullable<TimetablePdfData['cover']> }) {
    return (
        <Page size="A4" orientation="landscape" style={st.page}>
            <Watermark />
            <View style={st.row}>
                {data.logoUrl ? <Image src={data.logoUrl} style={{ width: 56, height: 56, objectFit: 'contain' }} /> : null}
            </View>
            <View style={st.coverBand}>
                <Text style={st.coverEyebrow}>Master timetable</Text>
                <Text style={st.coverTitle}>{data.schoolName}</Text>
                <Text style={st.coverSub}>{data.versionName}</Text>
            </View>
            <View style={st.statRow}>
                {([['Classes', cover.classes], ['Teachers', cover.teachers], ['Lessons a week', cover.lessons], ['School days', data.config.days.length]] as const).map(([label, value]) => (
                    <View key={label} style={st.stat}><Text style={st.statValue}>{value}</Text><Text style={st.statLabel}>{label}</Text></View>
                ))}
            </View>
            <Text style={st.contentsHead}>Inside</Text>
            <Text style={st.contentsLine}>1 · The whole school, day by day — every class against every period</Text>
            <Text style={st.contentsLine}>2 · Each class’s week{cover.sections.length > 1 ? `, by section (${cover.sections.map(s => s.name).join(', ')})` : ''}</Text>
            <Text style={st.contentsLine}>3 · Each teacher’s week</Text>
            <Text style={st.contentsLine}>4 · Teachers’ weekly loads</Text>
            <Footer data={data} />
        </Page>
    );
}

function TimetableDocument({ data }: { data: TimetablePdfData }) {
    return (
        <Document title={`${data.schoolName} timetable`} author={data.schoolName} creator="Skulbase" producer="Skulbase">
            {data.cover ? <Cover data={data} cover={data.cover} /> : null}
            {(data.days ?? []).map((d, i) => (
                <Page key={`day-${i}`} size="A4" orientation="landscape" style={st.page}>
                    <Watermark />
                    <Header data={data} title={WEEKDAY_NAMES[d.day]} label="Whole school" sub={d.section} />
                    <DayGrid config={data.config} sheet={d} />
                    <Footer data={data} />
                </Page>
            ))}
            {data.sheets.map((sheet, i) => (
                <Page key={i} size="A4" orientation="landscape" style={st.page}>
                    <Watermark />
                    <Header data={data} title={sheet.title} label={sheet.mode === 'class' ? 'Class' : sheet.mode === 'teacher' ? 'Teacher' : 'Room'} sub={sheet.subtitle} />
                    <WeekGrid config={data.config} sheet={sheet} />
                    <Footer data={data} />
                </Page>
            ))}
            {data.loads && data.loads.length > 0 ? (
                <Page size="A4" orientation="landscape" style={st.page}>
                    <Watermark />
                    <Header data={data} title="Teachers’ weekly loads" label="Summary" sub="Lessons a week across every class" />
                    {data.loads.map((t, i) => {
                        const pct = Math.min(1, t.lessons / Math.max(1, t.capacity));
                        const tone = t.lessons > t.capacity ? '#DC2626' : pct < 0.5 ? '#D97706' : '#059669';
                        return (
                            <View key={i} style={st.loadRow} wrap={false}>
                                <Text style={st.loadName}>{t.name}</Text>
                                <Text style={[st.loadNum, { color: tone }]}>{t.lessons} / {t.capacity}</Text>
                                <View style={st.loadTrack}><View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: tone, borderRadius: 3 }} /></View>
                                <Text style={st.loadClasses}>{t.classes}</Text>
                            </View>
                        );
                    })}
                    <Footer data={data} />
                </Page>
            ) : null}
        </Document>
    );
}

export function renderTimetablePdf(data: TimetablePdfData): Promise<Buffer> {
    return renderToBuffer(<TimetableDocument data={data} />);
}

const byName = <T,>(items: Map<string, T>, name: (t: T) => string) => [...items.entries()].sort((a, b) => name(a[1]).localeCompare(name(b[1]), undefined, { numeric: true }));

/** The master copy: the school day by day, classes by section, teachers, and teacher loads. */
export function masterSheets(config: TimetableConfig, lessons: readonly TimetableLesson[]): Pick<TimetablePdfData, 'sheets' | 'cover' | 'days' | 'loads'> {
    const classes = new Map<string, TimetableLesson[]>();
    const teachers = new Map<string, TimetableLesson[]>();
    for (const l of lessons) {
        classes.set(l.grade_stream_id, [...(classes.get(l.grade_stream_id) ?? []), l]);
        if (l.teacher_id) teachers.set(l.teacher_id, [...(teachers.get(l.teacher_id) ?? []), l]);
    }

    const sectionOrder = [...config.sections.map(s => s.id), 'main'];
    const groups = new Map<string, { name: string; periods: number; sheets: TimetableSheet[] }>();
    for (const [, list] of byName(classes, l => l[0].stream?.full_name ?? '')) {
        const section = sectionFor(config, bandForGrade(list[0].stream?.grade ?? null));
        const group = groups.get(section.id) ?? { name: section.name, periods: section.periods.filter(p => !p.is_break).length, sheets: [] };
        group.sheets.push({ title: list[0].stream?.full_name ?? 'Class', subtitle: `Class timetable · ${section.name}`, mode: 'class', lessons: list });
        groups.set(section.id, group);
    }
    const ordered = [...groups.entries()].sort((a, b) => sectionOrder.indexOf(a[0]) - sectionOrder.indexOf(b[0]));
    const classSheets = ordered.flatMap(([, g]) => g.sheets);

    // A teacher's lessons in one slot can be one option block taught to two classes; count slots, not rows.
    const slots = (list: readonly TimetableLesson[]) => new Set(list.map(l => `${l.day}|${l.period}|${l.grade_stream_id}`)).size;
    const teacherSheets = byName(teachers, l => teacherName(l[0].teacher)).map(([, list]) => ({
        title: teacherName(list[0].teacher) || 'Teacher', subtitle: `Teacher timetable · ${slots(list)} lessons a week`, mode: 'teacher' as const, lessons: list,
    }));

    // The whole school, a page per day (and per section, since sections keep their own bells).
    const days: DaySheet[] = config.days.flatMap(day => ordered.map(([, g]) => ({
        day,
        section: g.name,
        classes: g.sheets.map(s => ({ name: s.title, lessons: s.lessons.filter(l => l.day === day) })),
    })));

    const capacityOf = (list: readonly TimetableLesson[]) => config.days.length * sectionFor(config, bandForGrade(list[0].stream?.grade ?? null)).periods.filter(p => !p.is_break).length;
    const loads: TeacherLoadRow[] = byName(teachers, l => teacherName(l[0].teacher))
        .map(([, list]) => ({
            name: teacherName(list[0].teacher) || 'Teacher',
            lessons: slots(list),
            capacity: capacityOf(list),
            classes: [...new Set(list.map(l => `${l.stream?.full_name ?? ''} ${shortSubject(l.subject?.name)}`.trim()))].join(' · '),
        }))
        .sort((a, b) => b.lessons - a.lessons);

    return {
        sheets: [...classSheets, ...teacherSheets],
        days,
        loads,
        cover: {
            classes: classes.size,
            teachers: teachers.size,
            lessons: lessons.length,
            sections: ordered.map(([, g]) => ({ name: g.name, classes: g.sheets.map(s => s.title) })),
        },
    };
}
