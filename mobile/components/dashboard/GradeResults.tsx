import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { LifeBuoy, Trophy, type LucideIcon } from 'lucide-react-native';
import { gradeSymbolFromScales } from '@shared/analytics';
import { shortCurriculumLabel } from '@shared/curriculum-labels';
import { withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useGradeStreams, useTerms } from '@/lib/useSchoolData';
import { startingTermIndex, termsNewestFirst } from '@shared/term-fallback';
import { fonts, radius, spacing, makeStyles, type Palette, useTheme } from '@/lib/theme';
import { Card, ChipSelect, EmptyState, FilterGrid, LoadingView } from '@/components/ui';
import { SectionTitle } from './kit';
import { ColumnChart, Ring, type Column } from './charts';

/** GET /api/school/analytics (the parts the web's GradeResultsCard reads). */
interface Mark { subject_id: string | null; subject_name: string; percentage: number | null; exam_id: string; exam_name: string; exam_date: string | null }
interface SubjectMeta { id: string; name: string; academic_level_id: string | null; level_code: string | null; level_name: string | null; grading_system_id: string | null }
interface GradeBand { min_percentage: number; max_percentage: number; symbol: string }
interface AnalyticsResponse { marks?: Mark[]; subjects?: SubjectMeta[]; gradingScales?: Record<string, GradeBand[]> }

interface SubjectAgg { key: string; subject: string; levelId: string; levelLabel: string; avg: number; count: number; grade: string | null }
interface Series { key: string; name: string; date: number; examIds: Set<string> }

const ALL = 'all';
const UNKNOWN_LEVEL = '__unknown__';

/** Per-subject exam records grouped back into a sitting: the subject's name is taken out of the exam name. */
function seriesNameOf(examName: string, subjectName: string): string {
    const subj = subjectName.trim();
    let n = subj ? examName.replace(new RegExp(subj.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '') : examName;
    n = n.replace(/\(\s*\)/g, ' ').replace(/\s*[-–—:/]\s*(?=$)/g, '').replace(/^\s*[-–—:/]\s*/g, '').replace(/\s{2,}/g, ' ').trim();
    return n || examName;
}

function seriesOf(marks: readonly Mark[]): Series[] {
    const byKey = new Map<string, Series>();
    for (const m of marks) {
        const name = seriesNameOf(m.exam_name || 'Exam', m.subject_name || '');
        const time = m.exam_date ? new Date(m.exam_date).getTime() : 0;
        // Year-scoped so a recurring series name doesn't merge across years.
        const key = `${name.toLowerCase()}|${time ? new Date(time).getFullYear() : 0}`;
        const cur = byKey.get(key) ?? { key, name, date: 0, examIds: new Set<string>() };
        cur.date = Math.max(cur.date, time);
        cur.examIds.add(m.exam_id);
        byKey.set(key, cur);
    }
    return [...byKey.values()].sort((a, b) => b.date - a.date);
}

/** Averages by subject id (two curricula can share a subject name); the grade is the school's own scale applied to the average. */
function bySubject(marks: readonly Mark[], subjects: ReadonlyMap<string, SubjectMeta>, scales: Readonly<Record<string, GradeBand[]>>): SubjectAgg[] {
    const by = new Map<string, { name: string; meta?: SubjectMeta; sum: number; n: number }>();
    for (const m of marks) {
        if (m.percentage == null) continue;
        const meta = m.subject_id ? subjects.get(m.subject_id) : undefined;
        const key = m.subject_id ?? `name:${m.subject_name}`;
        const bucket = by.get(key) ?? { name: (meta?.name || m.subject_name || '').trim(), meta, sum: 0, n: 0 };
        bucket.sum += Number(m.percentage);
        bucket.n += 1;
        by.set(key, bucket);
    }
    return [...by.entries()].map(([key, v]) => {
        const avg = Math.round(v.sum / v.n);
        const system = v.meta?.grading_system_id;
        return {
            key,
            subject: v.name || 'Unknown',
            levelId: v.meta?.academic_level_id ?? UNKNOWN_LEVEL,
            levelLabel: (v.meta && shortCurriculumLabel(v.meta.level_code, v.meta.level_name)) ?? 'Other',
            avg,
            count: v.n,
            grade: system ? gradeSymbolFromScales(avg, scales[system]) : null,
        };
    }).sort((a, b) => b.avg - a.avg);
}

/** Red only for genuinely alarming scores; calm colours otherwise, as on the web. */
function sevColor(colors: Palette, avg: number): string {
    if (avg <= 20) return colors.danger;
    if (avg >= 80) return colors.success;
    if (avg >= 60) return colors.warning;
    return colors.info;
}

/** The four colour bands of sevColor, for the legend under the summary. */
const BANDS = [
    { label: '80+', min: 80, max: 100, color: (c: Palette) => c.success },
    { label: '60–79', min: 60, max: 79, color: (c: Palette) => c.warning },
    { label: '21–59', min: 21, max: 59, color: (c: Palette) => c.info },
    { label: '≤20', min: 0, max: 20, color: (c: Palette) => c.danger },
] as const;

/** One highlighted subject: the strongest, or the one that needs help. */
function Spotlight({ title, subject, color, icon: Icon }: { title: string; subject: SubjectAgg; color: string; icon: LucideIcon }) {
    const styles = useStyles();
    return (
        <View style={[styles.spot, { borderColor: `${color}55`, backgroundColor: `${color}14` }]}>
            <View style={styles.spotHead}>
                <Icon size={14} color={color} />
                <Text style={[styles.spotTitle, { color }]}>{title.toUpperCase()}</Text>
            </View>
            <Text style={styles.spotSubject} numberOfLines={2}>{subject.subject}</Text>
            <Text style={styles.spotFigure}>{subject.avg}%{subject.grade ? <Text style={styles.spotGrade}>  {subject.grade}</Text> : null}</Text>
        </View>
    );
}

/**
 * The web admin dashboard's GradeResultsCard, drawn for a phone: the sitting's
 * average as a ring, how subjects spread across the bands, the strongest and
 * weakest subject, then every subject as a column you can tap.
 */
export function GradeResults({ passMark }: { passMark?: number }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const { streams } = useGradeStreams();
    const [scope, setScope] = useState<string>(ALL);
    const [seriesKey, setSeriesKey] = useState<string | null>(null);
    const [levelId, setLevelId] = useState<string | null>(null);
    const { data: termRows } = useTerms();
    const terms = useMemo(() => termsNewestFirst(termRows ?? []), [termRows]);
    // An explicit choice wins; otherwise start at the current term and step back past empty ones.
    const [termId, setTermId] = useState<string | null>(null);
    const [autoIndex, setAutoIndex] = useState<number | null>(null);
    const startIndex = startingTermIndex(terms);
    const autoTerm = terms[autoIndex ?? startIndex] ?? null;
    const activeTermId = termId ?? autoTerm?.id ?? null;
    const query = useApiQuery<AnalyticsResponse>(
        terms.length === 0 && !termRows ? null : withQuery('/api/school/analytics', { stream_id: scope === ALL ? null : scope, term_id: activeTermId }),
        { raw: true },
    );
    const empty = !!query.data && (query.data.marks ?? []).length === 0;
    useEffect(() => {
        if (termId || !empty || query.loading) return;
        const i = autoIndex ?? startIndex;
        if (i < terms.length - 1) setAutoIndex(i + 1);
    }, [empty, termId, query.loading, autoIndex, startIndex, terms.length]);
    const steppedBack = !termId && autoIndex !== null && autoIndex !== startIndex && !empty ? terms[startIndex] : null;

    const marks = useMemo(() => query.data?.marks ?? [], [query.data]);
    const series = useMemo(() => seriesOf(marks), [marks]);
    const active = series.find((s) => s.key === seriesKey) ?? series[0] ?? null;
    const subjectMeta = useMemo(() => new Map((query.data?.subjects ?? []).map((s) => [s.id, s])), [query.data]);
    const all = useMemo(
        () => (active ? bySubject(marks.filter((m) => active.examIds.has(m.exam_id)), subjectMeta, query.data?.gradingScales ?? {}) : []),
        [marks, active, subjectMeta, query.data],
    );
    // One curriculum at a time: CBC and 8-4-4 are graded on different tables.
    const levels = useMemo(() => {
        const by = new Map<string, { id: string; label: string; count: number }>();
        for (const s of all) {
            const cur = by.get(s.levelId) ?? { id: s.levelId, label: s.levelLabel, count: 0 };
            cur.count += s.count;
            by.set(s.levelId, cur);
        }
        return [...by.values()].sort((a, b) => b.count - a.count);
    }, [all]);
    const activeLevel = levelId && levels.some((l) => l.id === levelId) ? levelId : levels[0]?.id ?? null;
    const subjects = activeLevel ? all.filter((s) => s.levelId === activeLevel) : all;
    const totalCount = subjects.reduce((n, s) => n + s.count, 0);
    const average = totalCount ? Math.round(subjects.reduce((sum, s) => sum + s.avg * s.count, 0) / totalCount) : null;
    const date = active?.date ? new Date(active.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    // A subject offered in two classes appears twice: say which is which.
    const nameCount = new Map<string, number>();
    for (const s of subjects) nameCount.set(s.subject, (nameCount.get(s.subject) ?? 0) + 1);
    const columns: Column[] = subjects.map((s) => ({
        key: s.key,
        label: s.subject,
        value: s.avg,
        color: sevColor(colors, s.avg),
        detail: [`${s.avg}%`, s.grade ? `grade ${s.grade}` : 'no grading system', `${s.count} mark${s.count === 1 ? '' : 's'}`, (nameCount.get(s.subject) ?? 0) > 1 ? s.levelLabel : null].filter(Boolean).join(' · '),
    }));
    const best = subjects[0];
    const weakest = subjects.length > 1 ? subjects[subjects.length - 1] : null;

    return (
        <>
            <SectionTitle title="Class results" />
            <Card>
                <FilterGrid>
                    <ChipSelect
                        label="Class"
                        options={[{ value: ALL, label: 'All classes' }, ...streams.map((s) => ({ value: s.id, label: s.full_name }))]}
                        value={scope}
                        onChange={(v) => { setScope(v); setSeriesKey(null); setAutoIndex(null); }}
                    />
                    {terms.length > 1 ? (
                        <ChipSelect label="Term" options={terms.map((t) => ({ value: t.id, label: t.name, hint: t.is_current ? 'Current term' : undefined }))} value={activeTermId} onChange={(v) => { setTermId(v); setSeriesKey(null); }} />
                    ) : null}
                    {series.length > 1 ? (
                        <ChipSelect label="Sitting" options={series.slice(0, 8).map((s) => ({ value: s.key, label: s.name }))} value={active?.key ?? null} onChange={setSeriesKey} />
                    ) : null}
                </FilterGrid>
                {steppedBack ? (
                    <Text style={styles.stepNote}>No marks in {steppedBack.name} yet, so this shows {autoTerm?.name}.</Text>
                ) : null}
                {query.loading || (!termId && empty && (autoIndex ?? startIndex) < terms.length - 1) ? <LoadingView /> : series.length === 0 ? (
                    <EmptyState title="No marks yet" description={termId ? 'No marks in this term. Pick another term.' : 'Once exams are marked, each subject’s average appears here.'} />
                ) : (
                    <>
                        {levels.length > 1 ? (
                            <ChipSelect layout="segmented" options={levels.map((l) => ({ value: l.id, label: l.label }))} value={activeLevel} onChange={setLevelId} />
                        ) : null}

                        <View style={styles.summary}>
                            {average != null ? (
                                <Ring value={average} size={92} color={sevColor(colors, average)} track={colors.mutedBg} textColor={colors.foreground} caption="Average" />
                            ) : null}
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.sitting} numberOfLines={2}>{active?.name}</Text>
                                <Text style={styles.meta}>{[date, `${subjects.length} subjects`].filter(Boolean).join(' · ')}</Text>
                                <View style={styles.bands}>
                                    {BANDS.map((b) => {
                                        const n = subjects.filter((s) => s.avg >= b.min && s.avg <= b.max).length;
                                        return n > 0 ? <View key={b.label} style={{ flex: n, backgroundColor: b.color(colors) }} /> : null;
                                    })}
                                </View>
                                <View style={styles.legend}>
                                    {BANDS.map((b) => {
                                        const n = subjects.filter((s) => s.avg >= b.min && s.avg <= b.max).length;
                                        return (
                                            <View key={b.label} style={styles.legendItem}>
                                                <View style={[styles.legendDot, { backgroundColor: b.color(colors) }]} />
                                                <Text style={styles.legendText}><Text style={styles.legendCount}>{n}</Text> {b.label}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>

                        {best ? (
                            <View style={styles.spots}>
                                <Spotlight title="Strongest" subject={best} color={colors.success} icon={Trophy} />
                                {weakest ? <Spotlight title="Needs support" subject={weakest} color={sevColor(colors, weakest.avg) === colors.success ? colors.warning : colors.danger} icon={LifeBuoy} /> : null}
                            </View>
                        ) : null}

                        <Text style={styles.chartTitle}>Every subject, highest first</Text>
                        <ColumnChart columns={columns} guide={passMark} guideLabel={passMark != null ? `Pass ${passMark}%` : undefined} />
                        {subjects.some((s) => !s.grade) ? (
                            <Text style={styles.note}>Some subjects have no grading system yet; set one in Settings → Grading.</Text>
                        ) : null}
                    </>
                )}
            </Card>
        </>
    );
}

const useStyles = makeStyles((colors) => ({
    stepNote: { fontSize: 12, fontFamily: fonts.medium, color: colors.warningText, backgroundColor: colors.warningBg, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, marginBottom: spacing.md, overflow: 'hidden' },
    summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.md },
    sitting: { fontSize: 16, lineHeight: 21, fontFamily: fonts.display, color: colors.foreground },
    meta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    bands: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginTop: spacing.sm, backgroundColor: colors.mutedBg },
    legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 4, marginTop: 6 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 2 },
    legendText: { fontSize: 11, fontFamily: fonts.medium, color: colors.muted },
    legendCount: { fontFamily: fonts.bold, color: colors.foreground },
    spots: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    spot: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
    spotHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    spotTitle: { fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.8 },
    spotSubject: { fontSize: 14, lineHeight: 18, fontFamily: fonts.bold, color: colors.foreground, marginTop: 6 },
    spotFigure: { fontSize: 22, fontFamily: fonts.display, color: colors.foreground, marginTop: 2, letterSpacing: -0.5 },
    spotGrade: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted },
    chartTitle: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted, marginBottom: spacing.sm },
    note: { fontSize: 11, lineHeight: 16, fontFamily: fonts.regular, color: colors.muted, marginTop: spacing.md },
}));
