import { useDownload } from '@/lib/useDownload';
import React, { useEffect, useMemo, useState } from 'react';
import { Square, SquareCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useAcademicYears, useGradeStreams, useTerms } from '@/lib/useSchoolData';
import { examTypeLabel } from '@/lib/academics';
import { CompareTerms } from '@/components/reports/CompareTerms';
import { errorMessage, fileSafe, fullName, pluralize } from '@/lib/format';
import { spacing, fonts, makeStyles, useTheme } from '@/lib/theme';
import {
    Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SearchField, SectionLabel, SegmentedTabs, TextField,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import { DEFAULT_TEMPLATE, REPORT_TEMPLATES, templateParam as toTemplateParam, type ReportTemplateId } from '@/lib/reportTemplates';
import type { StudentListItem } from '@/lib/types';

type Tab = 'download' | 'comments' | 'sms' | 'compare';

/** GET /api/reports/rounds (src/lib/reports/exam-round.ts): the sittings a class had this term. */
interface ReportRound {
    exam_type: string;
    label: string;
    subjects_total: number;
    subjects_with_marks: number;
    marks: number;
    date: string | null;
}
interface ReportRoundsResponse {
    rounds: ReportRound[];
    /** The most recent sitting with marks — the one the report routes would pick. */
    suggested: string | null;
}

interface Scope {
    yearId: string;
    termId: string;
    streamId: string;
    streamName: string;
    termName: string;
    examType: string | null;
}

export default function ReportsScreen() {
    return (
        <RequireScreen screen="reports">
            <ReportsContent />
        </RequireScreen>
    );
}

function ReportsContent() {
    const { years, loading: yearsLoading } = useAcademicYears();
    const { terms, activeTermId, loading: termsLoading } = useTerms();
    const { streams, loading: streamsLoading } = useGradeStreams();
    const [yearId, setYearId] = useState<string | null>(null);
    const [termId, setTermId] = useState<string | null>(null);
    const [streamId, setStreamId] = useState<string | null>(null);
    const [examType, setExamType] = useState<string>('');
    const [tab, setTab] = useState<Tab>('download');

    const effectiveTerm = terms.find((t) => t.id === (termId ?? activeTermId)) ?? null;
    const effectiveYearId = yearId ?? effectiveTerm?.academic_year_id ?? years[0]?.id ?? null;
    const termsInYear = terms.filter((t) => !effectiveYearId || t.academic_year_id === effectiveYearId);
    const effectiveStreamId = streamId ?? (streams.length === 1 ? streams[0].id : null);
    const stream = streams.find((s) => s.id === effectiveStreamId) ?? null;

    // Report cards describe one sitting, as on the web: the class's rounds this term with how much
    // is marked, the most recent one chosen for the user, and the choice always sent.
    const rounds = useApiQuery<ReportRoundsResponse>(
        effectiveTerm && stream ? withQuery('/api/reports/rounds', { grade_stream_id: stream.id, term_id: effectiveTerm.id }) : null,
        { raw: true },
    );
    useEffect(() => {
        const data = rounds.data;
        setExamType((prev) => (data?.rounds.some((r) => r.exam_type === prev) ? prev : data?.suggested ?? ''));
    }, [rounds.data]);

    if (yearsLoading || termsLoading || streamsLoading) return <LoadingView />;

    const scope: Scope | null =
        effectiveYearId && effectiveTerm && stream
            ? { yearId: effectiveYearId, termId: effectiveTerm.id, streamId: stream.id, streamName: stream.full_name, termName: effectiveTerm.name, examType: examType || null }
            : null;

    return (
        <Screen>
            <ScreenHeader title="Report Cards" description="Generate report cards and mark sheets, add comments and send results." />

            <ChipSelect label="Academic year" options={years.map((y) => ({ value: y.id, label: y.name }))} value={effectiveYearId} onChange={(v) => { setYearId(v); setTermId(null); }} />
            <ChipSelect label="Term" options={termsInYear.map((t) => ({ value: t.id, label: t.name }))} value={effectiveTerm?.id ?? null} onChange={setTermId} />
            {streams.length === 0 ? (
                <EmptyState title="No classes assigned" description="You need a class to generate its reports." />
            ) : (
                <ChipSelect label="Class" options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={effectiveStreamId} onChange={setStreamId} />
            )}
            {rounds.data && rounds.data.rounds.length > 0 ? (
                <ChipSelect
                    label="Sitting"
                    options={rounds.data.rounds.map((r) => ({
                        value: r.exam_type,
                        label: r.label || examTypeLabel(r.exam_type),
                        hint: `${r.subjects_with_marks}/${r.subjects_total} marked${r.exam_type === rounds.data?.suggested ? ' · latest' : ''}`,
                    }))}
                    value={examType || null}
                    onChange={setExamType}
                />
            ) : null}

            {streams.length > 0 ? (
                <SegmentedTabs
                    tabs={[
                        { value: 'download', label: 'Download' },
                        { value: 'comments', label: 'Comments' },
                        { value: 'sms', label: 'SMS' },
                        { value: 'compare', label: 'Compare' },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            ) : null}
            {tab === 'compare' ? (
                <CompareTerms years={years} terms={terms} streams={streams} initialStreamId={effectiveStreamId} initialTermId={effectiveTerm?.id ?? null} />
            ) : scope ? (
                <>
                    {tab === 'download' ? <DownloadPanel scope={scope} /> : null}
                    {tab === 'comments' ? <CommentsPanel key={`${scope.streamId}-${scope.termId}`} scope={scope} /> : null}
                    {tab === 'sms' ? <SmsPanel key={scope.streamId} scope={scope} /> : null}
                </>
            ) : (
                <Card>
                    <EmptyState title="Choose a year, term and class" />
                </Card>
            )}
        </Screen>
    );
}

// ── Downloads ──────────────────────────────────────────────

function DownloadPanel({ scope }: { scope: Scope }) {
    const download = useDownload();
    const styles = useStyles();
    const api = useApi();
    const [template, setTemplate] = useState<ReportTemplateId>(DEFAULT_TEMPLATE);
    const [title, setTitle] = useState('');
    const [busy, setBusy] = useState<'cards' | 'sheet' | string | null>(null);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
    const [search, setSearch] = useState('');
    const students = useApiQuery<StudentListItem[]>(withQuery('/api/school/data', { type: 'students', grade_stream_id: scope.streamId }));

    const baseQuery = { yearId: scope.yearId, termId: scope.termId, examType: scope.examType, customTitle: title.trim() || null };
    const templateParam = toTemplateParam(template);

    const run = async (key: string, work: () => Promise<void>) => {
        setBusy(key);
        setMessage(null);
        try {
            await work();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Download failed') });
        } finally {
            setBusy(null);
        }
    };

    const classCards = () =>
        run('cards', async () => {
            setMessage({ tone: 'info', text: 'Compiling grades and preparing the report cards — a full class takes a few seconds.' });
            // Same first step as the web: roll marks up into report cards (non-blocking if it fails).
            await api.post('/api/school/generate-reports', { term_id: scope.termId, grade_stream_id: scope.streamId }).catch(() => undefined);
            await download(
                withQuery(`/api/reports/class/${scope.streamId}`, { ...baseQuery, format: 'pdf', template: templateParam }),
                `Report_cards_${fileSafe(scope.streamName)}_${fileSafe(scope.termName)}.pdf`,
            );
            setMessage({ tone: 'success', text: 'Report cards ready.' });
        });

    const markSheet = () =>
        run('sheet', async () => {
            await download(
                withQuery(`/api/reports/marksheet/${scope.streamId}`, { ...baseQuery, format: 'pdf' }),
                `Mark_sheet_${fileSafe(scope.streamName)}_${fileSafe(scope.termName)}.pdf`,
            );
            setMessage({ tone: 'success', text: 'Mark sheet ready.' });
        });

    const studentCard = (s: StudentListItem) =>
        run(s.id, () =>
            download(
                withQuery(`/api/reports/student/${s.id}`, { year: scope.yearId, term: scope.termId, examType: scope.examType, customTitle: title.trim() || null, template: templateParam }),
                `Report_card_${fileSafe(fullName(s.users))}.pdf`,
            ),
        );

    const list = (students.data ?? []).filter((s) => {
        const q = search.trim().toLowerCase();
        return !q || `${fullName(s.users)} ${s.admission_number}`.toLowerCase().includes(q);
    });

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <ChipSelect label="Template" options={REPORT_TEMPLATES} value={template} onChange={setTemplate} />
            <TextField label="Custom title (optional)" value={title} onChangeText={setTitle} placeholder="e.g. End of Term 2 Report" />
            <Card>
                <Text style={styles.cardTitle}>{scope.streamName} · {scope.termName}{scope.examType ? ` · ${examTypeLabel(scope.examType)}` : ''}</Text>
                <Text style={styles.muted}>Files open in your share sheet, so you can save, print or send them.</Text>
                <ButtonRow>
                    <Button variant="secondary" label="Mark sheet" onPress={markSheet} loading={busy === 'sheet'} disabled={!!busy} />
                    <Button label="Class report cards" onPress={classCards} loading={busy === 'cards'} disabled={!!busy} />
                </ButtonRow>
            </Card>

            <SectionLabel>One learner's report card</SectionLabel>
            {(students.data?.length ?? 0) > 10 ? <SearchField value={search} onChangeText={setSearch} placeholder="Find a learner" /> : null}
            {students.loading ? (
                <LoadingView />
            ) : students.error ? (
                <ErrorBanner message={students.error} onRetry={students.reload} />
            ) : (
                <ListCard>
                    {list.map((s) => (
                        <ListRow
                            key={s.id}
                            title={fullName(s.users)}
                            subtitle={s.admission_number}
                            right={<Button size="sm" variant="secondary" label="PDF" onPress={() => studentCard(s)} loading={busy === s.id} disabled={!!busy} />}
                        />
                    ))}
                </ListCard>
            )}
        </View>
    );
}

// ── Comments ───────────────────────────────────────────────

interface StudentComment {
    student_id: string;
    admission_number: string;
    student_name: string;
    comments_class_teacher: string;
    comments_principal: string;
}

function CommentsPanel({ scope }: { scope: Scope }) {
    const styles = useStyles();
    const api = useApi();
    const { data, loading, error, reload } = useApiQuery<StudentComment[]>(
        withQuery('/api/reports/comments', { grade_stream_id: scope.streamId, term_id: scope.termId, academic_year_id: scope.yearId }),
    );
    const [edits, setEdits] = useState<Record<string, Partial<StudentComment>>>({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [search, setSearch] = useState('');

    const rows = (data ?? []).map((c) => ({ ...c, ...edits[c.student_id] }));
    const dirty = rows.filter((r) => r.student_id in edits);
    const visible = rows.filter((r) => {
        const q = search.trim().toLowerCase();
        return !q || `${r.student_name} ${r.admission_number}`.toLowerCase().includes(q);
    });

    const edit = (id: string, patch: Partial<StudentComment>) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    const saveAll = async () => {
        setSaving(true);
        setMessage(null);
        const results = await Promise.all(
            dirty.map((c) =>
                api
                    .post('/api/reports/comments', {
                        student_id: c.student_id,
                        term_id: scope.termId,
                        academic_year_id: scope.yearId,
                        grade_stream_id: scope.streamId,
                        comments_class_teacher: c.comments_class_teacher,
                        comments_principal: c.comments_principal,
                    })
                    .then(() => c.student_id)
                    .catch(() => null),
            ),
        );
        const saved = results.filter((id): id is string => id !== null);
        setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !saved.includes(id))));
        setMessage(saved.length === dirty.length ? { tone: 'success', text: `Saved comments for ${pluralize(saved.length, 'learner')}.` } : { tone: 'danger', text: `Saved ${saved.length} of ${dirty.length}. Try again for the rest.` });
        setSaving(false);
        reload();
    };

    if (loading) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={reload} />;

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            {rows.length > 10 ? <SearchField value={search} onChangeText={setSearch} placeholder="Find a learner" /> : null}
            {visible.length === 0 ? <EmptyState title="No learners in this class" /> : null}
            {visible.map((c) => (
                <Card key={c.student_id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                    <Text style={styles.cardTitle}>{c.student_name}</Text>
                    <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{c.admission_number}</Text>
                    <TextField label="Class teacher" value={c.comments_class_teacher} onChangeText={(v) => edit(c.student_id, { comments_class_teacher: v })} multiline />
                    <TextField label="Principal" value={c.comments_principal} onChangeText={(v) => edit(c.student_id, { comments_principal: v })} multiline />
                </Card>
            ))}
            <ButtonRow>
                <Button label={dirty.length ? `Save ${pluralize(dirty.length, 'comment')}` : 'All saved'} onPress={saveAll} loading={saving} disabled={dirty.length === 0} />
            </ButtonRow>
        </View>
    );
}

// ── SMS results to guardians ───────────────────────────────

interface SmsResult {
    sent: number;
    failed: number;
    skipped?: unknown[];
    results?: { success: boolean; error?: string }[];
    error?: string;
}

function SmsPanel({ scope }: { scope: Scope }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const students = useApiQuery<StudentListItem[]>(withQuery('/api/school/data', { type: 'students', grade_stream_id: scope.streamId }));
    const [deselected, setDeselected] = useState<Set<string>>(new Set());
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null);

    const list = students.data ?? [];
    const withPhone = list.filter((s) => s.guardian_phone);
    const selected = withPhone.filter((s) => !deselected.has(s.id));

    const toggle = (id: string) =>
        setDeselected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const send = async () => {
        setSending(true);
        setMessage(null);
        try {
            const res = await api.post<SmsResult>('/api/sms/send', { studentIds: selected.map((s) => s.id), termId: scope.termId, academicYearId: scope.yearId, gradeStreamId: scope.streamId });
            const reasons = [...new Set((res.results ?? []).filter((r) => !r.success && r.error).map((r) => r.error as string))];
            if (res.sent === 0) setMessage({ tone: 'danger', text: `SMS failed to send${res.error ? `: ${res.error}` : reasons[0] ? `: ${reasons[0]}` : ''}` });
            else if (res.failed > 0) setMessage({ tone: 'warning', text: `${res.sent} delivered, ${res.failed} failed${reasons[0] ? ` (${reasons[0]})` : ''}` });
            else setMessage({ tone: 'success', text: `${pluralize(res.sent, 'message')} delivered.` });
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'SMS send failed') });
        } finally {
            setSending(false);
        }
    };

    if (students.loading) return <LoadingView />;
    if (students.error) return <ErrorBanner message={students.error} onRetry={students.reload} />;

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <Card style={{ marginBottom: spacing.md }}>
                <Text style={styles.cardTitle}>Each guardian gets one text</Text>
                <Text style={styles.muted}>
                    [Student] — {scope.streamName}, {scope.termName}: each subject's % and grade, then the average, grade and rank.
                </Text>
                <Text style={[styles.muted, { marginTop: spacing.sm }]}>
                    {selected.length} selected · {list.length - withPhone.length} without a guardian phone
                </Text>
                <ButtonRow>
                    <Button label={`Send to ${selected.length}`} onPress={send} loading={sending} disabled={selected.length === 0} />
                </ButtonRow>
            </Card>
            <ListCard>
                {list.map((s) => {
                    const on = !!s.guardian_phone && !deselected.has(s.id);
                    return (
                        <ListRow
                            key={s.id}
                            title={fullName(s.users)}
                            subtitle={s.guardian_phone ?? 'No guardian phone'}
                            left={on ? <SquareCheck size={20} color={colors.primary} /> : <Square size={20} color={colors.muted} />}
                            onPress={s.guardian_phone ? () => toggle(s.id) : undefined}
                            right={<View />}
                        />
                    );
                })}
            </ListCard>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    cardTitle: { fontSize: 14, fontFamily: fonts.display, color: colors.foreground },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
}));
