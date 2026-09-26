"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Archive, ClipboardCheck, FileLock2, FilePlus2, FolderOpen, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import { FormField, FormGrid, InputField } from '@/components/ui/FormField';
import { StatTile } from '@/components/ui/StatTile';
import { SearchBox } from '@/components/ui/SearchBox';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage, type ModuleTab } from '@/components/ops/ModulePage';
import { LookupSelect } from '@/components/ops/SearchableSelect';
import { StatusPill } from '@/components/ops/StatusPill';
import { ExamPaperDrawer } from '@/components/academics/ExamPaperDrawer';
import { PAPER_STATUS_TONES, PRINT_STATUS_TONES, type ExamPaper } from '@/components/academics/examPaperTypes';
import { errorText, opsFetch } from '@/lib/ops/client';
import { dateTime, personName } from '@/lib/ops/format';
import type { PaperStatus } from '@/lib/academics/exam-papers';

type TabId = 'mine' | 'moderation' | 'print' | 'archive';

const EMPTY_FORM = { title: '', subject_id: '', grade_id: '', term_id: '', exam_id: '', paper_label: '', copies_needed: '', release_at: '' };

export default function ExamPapersPage() {
    const { can, profile } = useAuth();
    const [papers, setPapers] = useState<ExamPaper[]>([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [files, setFiles] = useState<{ paper: File | null; scheme: File | null }>({ paper: null, scheme: null });
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');

    const load = useCallback(async () => {
        try { setPapers(await opsFetch<ExamPaper[]>('/api/academics/exam-papers')); }
        catch (err) { toast.error(errorText(err)); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { void load(); }, [load]);

    const moderator = can('exam_papers.moderate') || can('exam_papers.manage');
    const manager = can('exam_papers.manage');
    const me = profile?.id;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? papers.filter(p => `${p.title} ${p.subject?.name ?? ''} ${personName(p.uploader)}`.toLowerCase().includes(q)) : papers;
    }, [papers, query]);
    const byStatus = (...statuses: PaperStatus[]) => filtered.filter(p => statuses.includes(p.status));

    const columns = (extra: DataTableColumn<ExamPaper>[] = []): DataTableColumn<ExamPaper>[] => [
        { key: 'title', header: 'Paper', render: p => <span className="font-medium">{p.title}{p.paper_label && <span className="ml-1 text-muted-foreground">· {p.paper_label}</span>}</span> },
        { key: 'subject', header: 'Subject', render: p => p.subject?.name ?? '—' },
        { key: 'grade', header: 'Class', hideOnMobile: true, render: p => p.grade?.name_display ?? 'Any' },
        { key: 'status', header: 'Status', render: p => <StatusPill status={p.status} tones={PAPER_STATUS_TONES} /> },
        ...extra,
        { key: 'updated', header: 'Updated', hideOnMobile: true, render: p => dateTime(p.updated_at) },
    ];

    const table = (rows: ExamPaper[], empty: string, extra?: DataTableColumn<ExamPaper>[]) => (
        <DataTable columns={columns(extra)} rows={rows} rowKey={p => p.id} loading={loading} onRowClick={p => setOpenId(p.id)} emptyState={empty} />
    );

    const submitUpload = async () => {
        if (!form.title.trim() || !form.subject_id || !files.paper) { toast.error('Add a title, subject and the paper file.'); return; }
        const body = new FormData();
        Object.entries(form).forEach(([k, v]) => {
            if (!v) return;
            body.append(k, k === 'release_at' ? new Date(v).toISOString() : v);
        });
        body.append('paper', files.paper);
        if (files.scheme) body.append('scheme', files.scheme);
        setSaving(true);
        try {
            await opsFetch('/api/academics/exam-papers', { method: 'POST', body });
            toast.success('Paper uploaded as a draft. Submit it when ready.');
            setUploading(false);
            setForm(EMPTY_FORM);
            setFiles({ paper: null, scheme: null });
            await load();
        } catch (err) { toast.error(errorText(err)); }
        finally { setSaving(false); }
    };

    const waiting = papers.filter(p => p.status === 'SUBMITTED').length;
    const toPrint = papers.filter(p => (p.status === 'APPROVED' || p.status === 'LOCKED') && p.print_status !== 'PACKED').length;

    const tabs: ModuleTab<TabId>[] = [
        {
            id: 'mine', label: 'My papers', icon: FolderOpen, hue: 'blue', visible: can('exam_papers.upload'),
            render: () => table(filtered.filter(p => p.uploaded_by === me), 'You have not uploaded any papers yet.'),
        },
        {
            id: 'moderation', label: 'Moderation', icon: ClipboardCheck, hue: 'amber', badge: waiting, visible: moderator,
            render: () => table(byStatus('SUBMITTED', 'RETURNED'), 'No papers are waiting for moderation.', [
                { key: 'by', header: 'Set by', render: p => personName(p.uploader) },
            ]),
        },
        {
            id: 'print', label: 'Print & release', shortLabel: 'Print', icon: Printer, hue: 'violet', badge: toPrint, visible: manager,
            render: () => table(byStatus('APPROVED', 'LOCKED'), 'Approved papers appear here for printing.', [
                { key: 'copies', header: 'Copies', numeric: true, render: p => p.copies_needed || '—' },
                { key: 'print', header: 'Printing', render: p => <StatusPill status={p.print_status} tones={PRINT_STATUS_TONES} /> },
                { key: 'release', header: 'Release', hideOnMobile: true, render: p => dateTime(p.release_at) },
            ]),
        },
        {
            id: 'archive', label: 'Past papers', shortLabel: 'Archive', icon: Archive, hue: 'emerald',
            render: () => table(byStatus('RELEASED'), 'Released papers become a revision library here.'),
        },
    ];

    return (
        <>
            <ModulePage
                module="exam_papers"
                title="Exam paper bank"
                eyebrow="Academics"
                description="Upload papers securely, moderate them, print the right number of copies and release them after the exam."
                icon={FileLock2}
                hue="violet"
                action={can('exam_papers.upload') ? <Button onClick={() => setUploading(true)}><FilePlus2 />Upload paper</Button> : undefined}
                tabs={tabs.map(t => ({
                    ...t,
                    render: () => (
                        <div className="flex flex-col gap-4">
                            {t.id === 'moderation' || t.id === 'print' ? (
                                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    <StatTile icon={ClipboardCheck} label="Awaiting moderation" value={waiting} tone={waiting > 0 ? 'warn' : 'good'} />
                                    <StatTile icon={Printer} label="To print" value={toPrint} hue="violet" />
                                    <StatTile icon={FileLock2} label="Locked" value={papers.filter(p => p.status === 'LOCKED').length} hue="blue" />
                                    <StatTile icon={Archive} label="Released" value={papers.filter(p => p.status === 'RELEASED').length} hue="emerald" />
                                </div>
                            ) : null}
                            <SearchBox value={query} onChange={setQuery} placeholder="Search papers" className="sm:max-w-sm" />
                            {t.render()}
                        </div>
                    ),
                }))}
            />

            {openId && <ExamPaperDrawer key={openId} paperId={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}

            <Modal
                isOpen={uploading}
                onClose={() => setUploading(false)}
                title="Upload an exam paper"
                size="lg"
                footer={<>
                    <Button variant="outline" onClick={() => setUploading(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={submitUpload} disabled={saving}>{saving ? 'Uploading…' : 'Upload'}</Button>
                </>}
            >
                <FormGrid>
                    <FormField label="Title" htmlFor="ep-title" required span="full">
                        <InputField id="ep-title" value={form.title} placeholder="e.g. End of Term 2 Mathematics" onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    </FormField>
                    <FormField label="Subject" htmlFor="ep-subject" required>
                        <LookupSelect id="ep-subject" lookup="subjects" value={form.subject_id} onChange={v => setForm(f => ({ ...f, subject_id: v }))} />
                    </FormField>
                    <FormField label="Class level" htmlFor="ep-grade">
                        <LookupSelect id="ep-grade" lookup="grades" value={form.grade_id} onChange={v => setForm(f => ({ ...f, grade_id: v }))} clearable />
                    </FormField>
                    <FormField label="Term" htmlFor="ep-term">
                        <LookupSelect id="ep-term" lookup="terms" value={form.term_id} onChange={v => setForm(f => ({ ...f, term_id: v }))} clearable />
                    </FormField>
                    <FormField label="Paper" htmlFor="ep-label" hint="e.g. P1, P2">
                        <InputField id="ep-label" value={form.paper_label} onChange={e => setForm(f => ({ ...f, paper_label: e.target.value }))} />
                    </FormField>
                    <FormField label="Copies needed" htmlFor="ep-copies">
                        <InputField id="ep-copies" type="number" min={0} inputMode="numeric" value={form.copies_needed} onChange={e => setForm(f => ({ ...f, copies_needed: e.target.value }))} />
                    </FormField>
                    <FormField label="Release after" htmlFor="ep-release" hint="When the exam is over.">
                        <InputField id="ep-release" type="datetime-local" value={form.release_at} onChange={e => setForm(f => ({ ...f, release_at: e.target.value }))} />
                    </FormField>
                    <FormField label="Paper (PDF or Word)" htmlFor="ep-file" required>
                        <InputField id="ep-file" type="file" accept=".pdf,.doc,.docx" onChange={e => setFiles(f => ({ ...f, paper: e.target.files?.[0] ?? null }))} />
                    </FormField>
                    <FormField label="Marking scheme" htmlFor="ep-scheme">
                        <InputField id="ep-scheme" type="file" accept=".pdf,.doc,.docx" onChange={e => setFiles(f => ({ ...f, scheme: e.target.files?.[0] ?? null }))} />
                    </FormField>
                </FormGrid>
            </Modal>
        </>
    );
}
