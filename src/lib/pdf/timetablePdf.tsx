import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { bandForGrade } from '@/lib/curriculum-bands';
import { WEEKDAY_LABELS, sectionFor, type TimetableConfig, type TimetableLesson } from '@/lib/timetable/config';
import { gridRows, lessonAt, type GridRow } from '@/lib/timetable/layout';
import { cellLines, teacherName, type GridMode } from '@/lib/ops/forms/academics';

/**
 * Printable timetables: one landscape page per class, teacher or room. The
 * master copy opens with a cover, then every class grouped by section (each
 * on its own bell), then every teacher.
 */

const INK = '#1F2937';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const BRAND = '#1A365D';

/** Soft fills so each subject reads at a glance, in colour or greyscale. */
const SUBJECT_FILLS = ['#DBEAFE', '#DCFCE7', '#FEF3C7', '#FCE7F3', '#E0E7FF', '#CCFBF1', '#FFE4E6', '#EDE9FE', '#FFEDD5', '#E0F2FE', '#ECFCCB', '#F5F5F4'] as const;

function fillFor(key: string): string {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return SUBJECT_FILLS[h % SUBJECT_FILLS.length];
}

const PAGE = { width: 842, height: 595, margin: 28 } as const;
const HEADER_H = 54;
const FOOTER_H = 18;
const BREAK_H = 14;
const HEAD_ROW_H = 20;

const st = StyleSheet.create({
    page: { padding: PAGE.margin, fontFamily: 'Helvetica', fontSize: 8, color: INK },
    header: { height: HEADER_H, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: BRAND, marginBottom: 8 },
    logo: { width: 34, height: 34, objectFit: 'contain', marginRight: 10 },
    school: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
    title: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: BRAND },
    tag: { marginLeft: 'auto', fontSize: 8, color: MUTED, textAlign: 'right' },
    row: { flexDirection: 'row' },
    timeCell: { width: 68, paddingHorizontal: 4, justifyContent: 'center', borderRightWidth: 1, borderRightColor: LINE },
    dayHead: { flex: 1, justifyContent: 'center', paddingHorizontal: 4, fontFamily: 'Helvetica-Bold', fontSize: 8, color: BRAND, textTransform: 'uppercase', letterSpacing: 0.6 },
    cell: { flex: 1, padding: 1.5 },
    lesson: { flex: 1, borderRadius: 3, paddingHorizontal: 4, justifyContent: 'center' },
    top: { fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
    bottom: { fontSize: 6.5, color: MUTED, marginTop: 1 },
    breakRow: { height: BREAK_H, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
    breakText: { fontSize: 6.5, color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase' },
    footer: { position: 'absolute', left: PAGE.margin, right: PAGE.margin, bottom: 12, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.5, color: MUTED },
    coverTitle: { fontSize: 30, fontFamily: 'Helvetica-Bold', color: BRAND, marginTop: 120 },
    coverSub: { fontSize: 12, color: MUTED, marginTop: 6 },
    statRow: { flexDirection: 'row', marginTop: 36 },
    stat: { marginRight: 40 },
    statValue: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: INK },
    statLabel: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
    contents: { marginTop: 36 },
    contentsHead: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
    contentsLine: { fontSize: 9, color: INK, marginBottom: 2 },
});

export interface TimetableSheet {
    title: string;
    /** e.g. "Upper Primary · Class timetable" */
    subtitle: string;
    mode: GridMode;
    lessons: TimetableLesson[];
}

export interface TimetablePdfData {
    schoolName: string;
    logoUrl?: string | null;
    /** e.g. "Term 3 timetable" or "Published timetable". */
    versionName: string;
    generatedAt: string;
    config: TimetableConfig;
    sheets: TimetableSheet[];
    /** The master copy's cover. */
    cover?: { classes: number; teachers: number; lessons: number; sections: { name: string; classes: string[] }[] };
}

function Grid({ config, sheet }: { config: TimetableConfig; sheet: TimetableSheet }) {
    const rows = gridRows(config, sheet.lessons);
    const lessonRows = rows.filter(r => !r.isBreak).length;
    const breaks = rows.length - lessonRows;
    const avail = PAGE.height - PAGE.margin * 2 - HEADER_H - 8 - FOOTER_H - HEAD_ROW_H - breaks * BREAK_H;
    const rowH = Math.min(52, Math.max(22, avail / Math.max(1, lessonRows)));

    const cell = (day: number, row: GridRow) => {
        const lesson = lessonAt(config, sheet.lessons, day, row);
        if (!lesson) return <View key={day} style={st.cell} />;
        const [top, bottom] = cellLines(lesson, sheet.mode);
        return (
            <View key={day} style={st.cell}>
                <View style={[st.lesson, { backgroundColor: fillFor(lesson.subject_id) }]}>
                    <Text style={st.top}>{top}</Text>
                    {bottom ? <Text style={st.bottom}>{bottom}</Text> : null}
                </View>
            </View>
        );
    };

    return (
        <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 4 }}>
            <View style={[st.row, { height: HEAD_ROW_H, borderBottomWidth: 1, borderBottomColor: LINE }]}>
                <View style={st.timeCell}><Text style={{ fontSize: 7, color: MUTED }}>TIME</Text></View>
                {config.days.map(d => <Text key={d} style={st.dayHead}>{WEEKDAY_LABELS[d]}</Text>)}
            </View>
            {rows.map(r => r.isBreak ? (
                <View key={r.key} style={st.breakRow}><Text style={st.breakText}>{r.label} · {r.time}</Text></View>
            ) : (
                <View key={r.key} style={[st.row, { height: rowH, borderBottomWidth: 1, borderBottomColor: LINE }]} wrap={false}>
                    <View style={st.timeCell}>
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>{r.label}</Text>
                        <Text style={{ fontSize: 6.5, color: MUTED }}>{r.time}</Text>
                    </View>
                    {config.days.map(d => cell(d, r))}
                </View>
            ))}
        </View>
    );
}

function Header({ data, title, subtitle }: { data: TimetablePdfData; title: string; subtitle: string }) {
    return (
        <View style={st.header}>
            {data.logoUrl ? <Image src={data.logoUrl} style={st.logo} /> : null}
            <View>
                <Text style={st.school}>{data.schoolName}</Text>
                <Text style={st.title}>{title}</Text>
            </View>
            <Text style={st.tag}>{subtitle}{'\n'}{data.versionName}</Text>
        </View>
    );
}

function Footer({ data }: { data: TimetablePdfData }) {
    return (
        <View style={st.footer} fixed>
            <Text>{data.schoolName} · {data.versionName}</Text>
            <Text render={({ pageNumber, totalPages }) => `Generated ${data.generatedAt} · Page ${pageNumber} of ${totalPages}`} />
        </View>
    );
}

function Cover({ data, cover }: { data: TimetablePdfData; cover: NonNullable<TimetablePdfData['cover']> }) {
    return (
        <Page size="A4" orientation="landscape" style={st.page}>
            {data.logoUrl ? <Image src={data.logoUrl} style={{ width: 64, height: 64, objectFit: 'contain' }} /> : null}
            <Text style={st.coverTitle}>{data.schoolName}</Text>
            <Text style={st.coverSub}>Master timetable · {data.versionName}</Text>
            <View style={st.statRow}>
                {([['Classes', cover.classes], ['Teachers', cover.teachers], ['Lessons a week', cover.lessons]] as const).map(([label, value]) => (
                    <View key={label} style={st.stat}><Text style={st.statValue}>{value}</Text><Text style={st.statLabel}>{label}</Text></View>
                ))}
            </View>
            <View style={[st.contents, st.row]}>
                {cover.sections.map(s => (
                    <View key={s.name} style={{ marginRight: 36, maxWidth: 220 }}>
                        <Text style={st.contentsHead}>{s.name}</Text>
                        <Text style={st.contentsLine}>{s.classes.join(', ')}</Text>
                    </View>
                ))}
            </View>
            <Footer data={data} />
        </Page>
    );
}

function TimetableDocument({ data }: { data: TimetablePdfData }) {
    return (
        <Document title={`${data.schoolName} timetable`} author={data.schoolName}>
            {data.cover ? <Cover data={data} cover={data.cover} /> : null}
            {data.sheets.map((sheet, i) => (
                <Page key={i} size="A4" orientation="landscape" style={st.page}>
                    <Header data={data} title={sheet.title} subtitle={sheet.subtitle} />
                    <Grid config={data.config} sheet={sheet} />
                    <Footer data={data} />
                </Page>
            ))}
        </Document>
    );
}

export function renderTimetablePdf(data: TimetablePdfData): Promise<Buffer> {
    return renderToBuffer(<TimetableDocument data={data} />);
}

const byName = <T,>(items: Map<string, T>, name: (t: T) => string) => [...items.entries()].sort((a, b) => name(a[1]).localeCompare(name(b[1]), undefined, { numeric: true }));

/** Pages for the whole school: classes by section (in bell order), then teachers. */
export function masterSheets(config: TimetableConfig, lessons: readonly TimetableLesson[]): { sheets: TimetableSheet[]; cover: NonNullable<TimetablePdfData['cover']> } {
    const classes = new Map<string, TimetableLesson[]>();
    const teachers = new Map<string, TimetableLesson[]>();
    for (const l of lessons) {
        classes.set(l.grade_stream_id, [...(classes.get(l.grade_stream_id) ?? []), l]);
        if (l.teacher_id) teachers.set(l.teacher_id, [...(teachers.get(l.teacher_id) ?? []), l]);
    }

    const sectionOrder = [...config.sections.map(s => s.id), 'main'];
    const groups = new Map<string, { name: string; sheets: TimetableSheet[] }>();
    for (const [, list] of byName(classes, l => l[0].stream?.full_name ?? '')) {
        const section = sectionFor(config, bandForGrade(list[0].stream?.grade ?? null));
        const group = groups.get(section.id) ?? { name: section.name, sheets: [] };
        group.sheets.push({ title: list[0].stream?.full_name ?? 'Class', subtitle: `${section.name} · Class timetable`, mode: 'class', lessons: list });
        groups.set(section.id, group);
    }
    const classSheets = [...groups.entries()].sort((a, b) => sectionOrder.indexOf(a[0]) - sectionOrder.indexOf(b[0])).flatMap(([, g]) => g.sheets);
    const teacherSheets = byName(teachers, l => teacherName(l[0].teacher)).map(([, list]) => ({
        title: teacherName(list[0].teacher) || 'Teacher', subtitle: `Teacher timetable · ${list.length} lessons a week`, mode: 'teacher' as const, lessons: list,
    }));

    return {
        sheets: [...classSheets, ...teacherSheets],
        cover: {
            classes: classes.size,
            teachers: teachers.size,
            lessons: lessons.length,
            sections: [...groups.values()].map(g => ({ name: g.name, classes: g.sheets.map(s => s.title) })),
        },
    };
}
