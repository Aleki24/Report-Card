import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { dateTime, personName } from '@shared/ops/format';
import type { PaperStatus } from '@shared/academics/exam-papers';
import {
    EMPTY_PAPER_FORM, PAPER_FILE_TYPES, PAPER_STATUS_TONES, PRINT_STATUS_TONES, paperFormFields, paperSearchText, papersToPrint,
    type ExamPaper, type PaperForm,
} from '@shared/ops/forms/academics';
import { Button, ButtonRow, Card, EmptyState, ErrorBanner, InfoRow, LoadingView, SearchField, StatGrid, StatTile, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { ExamPaperSheet } from '@/components/academics/ExamPaperSheet';
import { FormSheet } from '@/components/ops/FormSheet';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { LookupField } from '@/components/ops/SelectField';
import { StatusPill, toneColor, useRefreshSignal } from '@/components/ops/bits';
import { useApi, type PickedFile } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useOpsData } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { spacing, useTheme } from '@/lib/theme';

type Extra = 'setBy' | 'print';

function PaperList({ papers, empty, extra, onOpen }: { papers: ExamPaper[]; empty: string; extra?: Extra; onOpen: (id: string) => void }) {
    if (papers.length === 0) return <EmptyState title={empty} />;
    return (
        <View>
            {papers.map((p) => (
                <Card key={p.id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                    <InfoRow label={p.subject?.name ?? 'Subject'} value={`${p.title}${p.paper_label ? ` · ${p.paper_label}` : ''}`} />
                    <InfoRow label="Class" value={p.grade?.name_display ?? 'Any'} />
                    {extra === 'setBy' ? <InfoRow label="Set by" value={personName(p.uploader)} /> : null}
                    {extra === 'print' ? (
                        <>
                            <InfoRow label="Copies" value={p.copies_needed || '—'} />
                            <InfoRow label="Release" value={dateTime(p.release_at)} />
                        </>
                    ) : null}
                    <InfoRow label="Updated" value={dateTime(p.updated_at)} />
                    <ButtonRow>
                        <StatusPill status={p.status} tones={PAPER_STATUS_TONES} />
                        {extra === 'print' ? <StatusPill status={p.print_status} tones={PRINT_STATUS_TONES} /> : null}
                        <Button size="sm" variant="secondary" label="Open" onPress={() => onOpen(p.id)} />
                    </ButtonRow>
                </Card>
            ))}
        </View>
    );
}

function UploadSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const api = useApi();
    const toast = useToast();
    const [form, setForm] = useState<PaperForm>(EMPTY_PAPER_FORM);
    const [files, setFiles] = useState<{ paper: PickedFile | null; scheme: PickedFile | null }>({ paper: null, scheme: null });
    const [saving, setSaving] = useState(false);
    const set = (k: keyof PaperForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
    const pick = async (kind: 'paper' | 'scheme') => {
        const file = await api.pickFile(PAPER_FILE_TYPES).catch(() => null);
        if (file) setFiles((f) => ({ ...f, [kind]: file }));
    };

    const submit = async () => {
        if (!form.title.trim() || !form.subject_id || !files.paper) { toast.error('Add a title, subject and the paper file.'); return; }
        setSaving(true);
        try {
            await api.sendForm('POST', '/api/academics/exam-papers', paperFormFields({ ...form, release_at: form.release_at.replace(' ', 'T') }), files);
            toast.success('Paper uploaded as a draft. Submit it when ready.');
            onDone();
        } catch (err) {
            toast.error(errorMessage(err, 'Upload failed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <FormSheet visible title="Upload an exam paper" onClose={onClose} onSubmit={() => void submit()} submitLabel="Upload" submitting={saving}>
            <TextField label="Title *" value={form.title} onChangeText={set('title')} placeholder="e.g. End of Term 2 Mathematics" />
            <LookupField label="Subject" required lookup="subjects" value={form.subject_id} onChange={set('subject_id')} />
            <LookupField label="Class level" lookup="grades" value={form.grade_id} onChange={set('grade_id')} clearable />
            <LookupField label="Term" lookup="terms" value={form.term_id} onChange={set('term_id')} clearable />
            <TextField label="Paper (e.g. P1, P2)" value={form.paper_label} onChangeText={set('paper_label')} />
            <TextField label="Copies needed" value={form.copies_needed} onChangeText={set('copies_needed')} keyboardType="number-pad" />
            <TextField label="Release after (when the exam is over)" value={form.release_at} onChangeText={set('release_at')} placeholder="YYYY-MM-DD HH:MM" keyboardType="numbers-and-punctuation" />
            <ButtonRow>
                <Button variant="secondary" label={files.paper ? `Paper: ${files.paper.name}` : 'Choose paper (PDF or Word) *'} onPress={() => void pick('paper')} />
                <Button variant="secondary" label={files.scheme ? `Scheme: ${files.scheme.name}` : 'Choose marking scheme'} onPress={() => void pick('scheme')} />
            </ButtonRow>
        </FormSheet>
    );
}

export default function ExamPapersScreen() {
    const { can, profile } = useCurrentUser();
    const { data, loading, error, reload } = useOpsData<ExamPaper[]>('/api/academics/exam-papers');
    const [openId, setOpenId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [query, setQuery] = useState('');
    const papers = useMemo(() => data ?? [], [data]);
    const moderator = can('exam_papers.moderate') || can('exam_papers.manage');
    const manager = can('exam_papers.manage');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? papers.filter((p) => paperSearchText(p).toLowerCase().includes(q)) : papers;
    }, [papers, query]);
    const byStatus = (...statuses: PaperStatus[]) => filtered.filter((p) => statuses.includes(p.status));
    const waiting = papers.filter((p) => p.status === 'SUBMITTED').length;
    const toPrint = papersToPrint(papers);

    const stats: PaperStats = {
        waiting,
        toPrint,
        locked: papers.filter((p) => p.status === 'LOCKED').length,
        released: papers.filter((p) => p.status === 'RELEASED').length,
    };
    const frame = { stats, query, setQuery, error, loading: loading && !data, reload };

    return (
        <>
            <ModuleScreen
                screen="exam-papers"
                title="Exam paper bank"
                description="Upload papers securely, moderate them, print the right number of copies and release them after the exam."
                action={can('exam_papers.upload') ? <Button size="sm" label="+ Upload" onPress={() => setUploading(true)} /> : undefined}
                tabs={[
                    {
                        id: 'mine', label: 'My papers', visible: can('exam_papers.upload'),
                        render: () => <PaperFrame {...frame}><PaperList papers={filtered.filter((p) => p.uploaded_by === profile?.id)} empty="You have not uploaded any papers yet." onOpen={setOpenId} /></PaperFrame>,
                    },
                    {
                        id: 'moderation', label: `Moderation${waiting ? ` (${waiting})` : ''}`, visible: moderator,
                        render: () => <PaperFrame {...frame} figures><PaperList papers={byStatus('SUBMITTED', 'RETURNED')} empty="No papers are waiting for moderation." extra="setBy" onOpen={setOpenId} /></PaperFrame>,
                    },
                    {
                        id: 'print', label: `Print & release${toPrint ? ` (${toPrint})` : ''}`, visible: manager,
                        render: () => <PaperFrame {...frame} figures><PaperList papers={byStatus('APPROVED', 'LOCKED')} empty="Approved papers appear here for printing." extra="print" onOpen={setOpenId} /></PaperFrame>,
                    },
                    {
                        id: 'archive', label: 'Past papers',
                        render: () => <PaperFrame {...frame}><PaperList papers={byStatus('RELEASED')} empty="Released papers become a revision library here." onOpen={setOpenId} /></PaperFrame>,
                    },
                ]}
            />
            {openId ? <ExamPaperSheet key={openId} paperId={openId} onClose={() => setOpenId(null)} onChanged={() => void reload()} /> : null}
            {uploading ? <UploadSheet onClose={() => setUploading(false)} onDone={() => { setUploading(false); void reload(); }} /> : null}
        </>
    );
}

interface PaperStats { waiting: number; toPrint: number; locked: number; released: number }

/** Figures, search and loading state around a tab's papers; reloads on pull-to-refresh. */
function PaperFrame({ stats, figures, query, setQuery, error, loading, reload, children }: {
    stats: PaperStats;
    figures?: boolean;
    query: string;
    setQuery: (q: string) => void;
    error: string | null;
    loading: boolean;
    reload: () => Promise<void>;
    children: React.ReactNode;
}) {
    const { colors } = useTheme();
    useRefreshSignal(reload);
    return (
        <View>
            {figures ? (
                <StatGrid>
                    <StatTile label="Awaiting moderation" value={stats.waiting} tone={toneColor(colors, stats.waiting > 0 ? 'warn' : 'good')} />
                    <StatTile label="To print" value={stats.toPrint} />
                    <StatTile label="Locked" value={stats.locked} />
                    <StatTile label="Released" value={stats.released} />
                </StatGrid>
            ) : null}
            <View style={{ marginTop: figures ? spacing.md : 0 }}><SearchField value={query} onChangeText={setQuery} placeholder="Search papers" /></View>
            {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}
            {loading ? <LoadingView /> : children}
        </View>
    );
}
