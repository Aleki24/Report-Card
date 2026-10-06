import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { gradeSymbolFromScales } from '@shared/analytics';
import { shortCurriculumLabel } from '@shared/curriculum-labels';
import { withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useGradeStreams } from '@/lib/useSchoolData';
import { fonts, radius, spacing, makeStyles, type Palette, useTheme } from '@/lib/theme';
import { Card, ChipSelect, EmptyState, LoadingView } from '@/components/ui';
import { Meter, SectionTitle } from './kit';

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

/** The web admin dashboard's GradeResultsCard: the latest sitting's results by subject, per class. */
export function GradeResults() {
    const { colors } = useTheme();
    const styles = useStyles();
    const { streams } = useGradeStreams();
    const [scope, setScope] = useState<string>(ALL);
    const [seriesKey, setSeriesKey] = useState<string | null>(null);
    const [levelId, setLevelId] = useState<string | null>(null);
    const query = useApiQuery<AnalyticsResponse>(withQuery('/api/school/analytics', { stream_id: scope === ALL ? null : scope }), { raw: true });

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

    return (
        <>
            <SectionTitle title="Class results" />
            <Card>
                <ChipSelect
                    label="Class"
                    options={[{ value: ALL, label: 'All classes' }, ...streams.map((s) => ({ value: s.id, label: s.full_name }))]}
                    value={scope}
                    onChange={(v) => { setScope(v); setSeriesKey(null); }}
                />
                {query.loading ? <LoadingView /> : series.length === 0 ? (
                    <EmptyState title="No marks yet" description="Once exams are marked, each subject’s average appears here." />
                ) : (
                    <>
                        {series.length > 1 ? (
                            <ChipSelect label="Sitting" options={series.slice(0, 8).map((s) => ({ value: s.key, label: s.name }))} value={active?.key ?? null} onChange={setSeriesKey} />
                        ) : null}
                        {levels.length > 1 ? (
                            <ChipSelect label="Curriculum" options={levels.map((l) => ({ value: l.id, label: l.label }))} value={activeLevel} onChange={setLevelId} />
                        ) : null}
                        <Text style={styles.meta}>
                            {[active?.name, date, `${subjects.length} subjects`, average != null ? `average ${average}%` : null].filter(Boolean).join(' · ')}
                        </Text>
                        {subjects.map((s) => (
                            <View key={s.key} style={styles.row}>
                                <Text style={styles.subject} numberOfLines={1}>{s.subject}</Text>
                                <View style={styles.track}><Meter value={Math.max(2, s.avg)} color={sevColor(colors, s.avg)} track={colors.mutedBg} /></View>
                                <Text style={styles.avg}>{s.avg}%</Text>
                                <Text style={[styles.grade, !s.grade && styles.noGrade]}>{s.grade ?? '–'}</Text>
                            </View>
                        ))}
                        {subjects.some((s) => !s.grade) ? (
                            <Text style={styles.note}>“–” means the subject has no grading system yet; set one in Settings → Grading.</Text>
                        ) : null}
                    </>
                )}
            </Card>
        </>
    );
}

const useStyles = makeStyles((colors) => ({
    meta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
    subject: { width: 108, fontSize: 13, fontFamily: fonts.medium, color: colors.foreground },
    track: { flex: 1 },
    avg: { width: 40, textAlign: 'right', fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
    grade: { width: 32, textAlign: 'center', fontSize: 12, fontFamily: fonts.bold, color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingVertical: 2, overflow: 'hidden' },
    noGrade: { color: colors.muted, backgroundColor: colors.mutedBg },
    note: { fontSize: 11, lineHeight: 16, fontFamily: fonts.regular, color: colors.muted, marginTop: spacing.sm },
}));
