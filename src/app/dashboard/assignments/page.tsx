"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Briefcase, CalendarClock, CheckCircle2, Edit3, FileText, Inbox, Loader2, Paperclip, Plus, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FormField, InputField, SelectField, TextareaField } from '@/components/ui';
import { SearchBox } from '@/components/ui/SearchBox';
import { StatFilterTile } from '@/components/ui/StatFilterTile';
import { useAuth } from '@/components/AuthProvider';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import {
    ASSIGNMENT_DESCRIPTION_MAX, ASSIGNMENT_FEEDBACK_MAX, ASSIGNMENT_TITLE_MAX, dueLabel, dueState, localToday,
    type Assignment, type DueState, type Submission,
} from '@/lib/assignments';

interface StreamOption { id: string; full_name: string; academicLevelId: string | null }
interface SubjectOption { id: string; name: string; academicLevelId: string | null; band: string | null }

type View = 'upcoming' | 'past' | 'mine' | 'all';
type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

interface Draft { title: string; streamId: string; subjectId: string; dueDate: string; description: string; fileUrl: string }
const EMPTY_DRAFT: Draft = { title: '', streamId: '', subjectId: '', dueDate: '', description: '', fileUrl: '' };

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const DUE_TONE: Record<DueState, string> = {
    overdue: 'text-muted-foreground',
    today: 'text-rose-600 dark:text-rose-400',
    soon: 'text-amber-600 dark:text-amber-400',
    later: 'text-emerald-600 dark:text-emerald-400',
};

async function getJson<T>(url: string, fallback: string): Promise<T> {
    const res = await fetch(url, { cache: 'no-store' });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(json, fallback));
    return json as T;
}

export default function AssignmentsPage() {
    const { role, profile } = useAuth();
    const id = useId();
    const isAdmin = role === 'ADMIN';
    // The admin manages every assignment; a teacher the ones they set (as the API).
    const canManage = useCallback((a: Assignment) => isAdmin || (!!profile && a.createdById === profile.id), [isAdmin, profile]);

    const [load, setLoad] = useState<Load<Assignment[]>>({ status: 'loading' });
    const [streams, setStreams] = useState<StreamOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [view, setView] = useState<View>('upcoming');
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState('');

    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState<Assignment | null>(null);
    const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState<'idle' | 'uploading' | 'saving'>('idle');
    const fileInput = useRef<HTMLInputElement>(null);

    const [deleting, setDeleting] = useState<Assignment | null>(null);
    const [deletingBusy, setDeletingBusy] = useState(false);
    const [reviewing, setReviewing] = useState<Assignment | null>(null);

    const fetchAssignments = useCallback(async () => {
        try {
            const json = await getJson<{ data: Assignment[] }>('/api/school/assignments', 'Could not load assignments.');
            setLoad({ status: 'ready', data: json.data });
        } catch (err) {
            setLoad({ status: 'error', message: err instanceof Error ? err.message : 'Could not load assignments.' });
        }
    }, []);

    useEffect(() => {
        void fetchAssignments();
        // The classes this user can see (a teacher's own), and the school's subjects.
        getJson<{ data: { id: string; full_name: string; grades?: { academic_level_id?: string | null } | null }[] }>('/api/school/data?type=grade_streams', 'Could not load classes.')
            .then(json => setStreams(json.data.map(s => ({ id: s.id, full_name: s.full_name, academicLevelId: s.grades?.academic_level_id ?? null }))))
            .catch(() => toast.error('Could not load your classes.'));
        getJson<{ data: { id: string; name: string; academic_level_id: string | null; band: string | null }[] }>('/api/school/data?type=subjects', 'Could not load subjects.')
            .then(json => setSubjects(json.data.map(s => ({ id: s.id, name: s.name, academicLevelId: s.academic_level_id, band: s.band }))))
            .catch(() => toast.error('Could not load subjects.'));
    }, [fetchAssignments]);

    const all = useMemo(() => (load.status === 'ready' ? load.data : []), [load]);
    const today = localToday();
    const counts = useMemo(() => ({
        upcoming: all.filter(a => a.dueDate >= today).length,
        past: all.filter(a => a.dueDate < today).length,
        mine: all.filter(a => profile && a.createdById === profile.id).length,
        all: all.length,
    }), [all, today, profile]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = all.filter(a =>
            (view === 'all'
                || (view === 'upcoming' && a.dueDate >= today)
                || (view === 'past' && a.dueDate < today)
                || (view === 'mine' && !!profile && a.createdById === profile.id))
            && (!classFilter || a.streamId === classFilter)
            && (!q || a.title.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q) || (a.stream ?? '').toLowerCase().includes(q)));
        // Soonest first while it's coming up; most recent first once it's past.
        return view === 'past' ? [...list].reverse() : list;
    }, [all, view, classFilter, search, today, profile]);

    // Subjects for the chosen class's curriculum; the band tells apart subjects
    // offered at more than one level ("Mathematics" in Lower and Upper Primary).
    const subjectOptions = useMemo(() => {
        const level = streams.find(s => s.id === draft.streamId)?.academicLevelId ?? null;
        const pool = level ? subjects.filter(s => s.academicLevelId === level) : subjects;
        const repeated = new Set(pool.map(s => s.name).filter((n, i, arr) => arr.indexOf(n) !== i));
        return pool.map(s => ({ id: s.id, label: repeated.has(s.name) && s.band ? `${s.name} · ${s.band}` : s.name }));
    }, [streams, subjects, draft.streamId]);

    const openNew = () => {
        setEditing(null);
        setDraft({ ...EMPTY_DRAFT, streamId: classFilter || (streams.length === 1 ? streams[0].id : '') });
        setFile(null);
        setEditorOpen(true);
    };
    const openEdit = (a: Assignment) => {
        setEditing(a);
        setDraft({ title: a.title, streamId: a.streamId ?? '', subjectId: a.subjectId, dueDate: a.dueDate, description: a.description ?? '', fileUrl: a.fileUrl ?? '' });
        setFile(null);
        setEditorOpen(true);
    };

    const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0];
        e.target.value = '';
        if (!picked) return;
        if (picked.size > MAX_UPLOAD_BYTES) { toast.error('Attachments must be under 10 MB.'); return; }
        setFile(picked);
    };

    const canSave = Boolean(draft.title.trim() && draft.streamId && draft.subjectId && draft.dueDate) && saving === 'idle';

    const save = async () => {
        if (!canSave) return;
        try {
            let fileUrl = draft.fileUrl;
            if (file) {
                setSaving('uploading');
                const fd = new FormData();
                fd.append('file', file);
                const uploaded = await fetch('/api/school/upload', { method: 'POST', body: fd });
                const uploadJson: unknown = await uploaded.json().catch(() => null);
                if (!uploaded.ok) throw new Error(apiErrorMessage(uploadJson, 'The attachment did not upload.'));
                fileUrl = (uploadJson as { url: string }).url;
            }
            setSaving('saving');
            const res = await fetch(editing ? `/api/school/assignments/${editing.id}` : '/api/school/assignments', {
                method: editing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: draft.title,
                    subject_id: draft.subjectId,
                    grade_stream_id: draft.streamId,
                    due_date: draft.dueDate,
                    description: draft.description,
                    file_url: fileUrl || null,
                }),
            });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save the assignment.'));
            toast.success(editing ? 'Assignment updated.' : 'Assignment set.');
            setEditorOpen(false);
            await fetchAssignments();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save the assignment.');
        } finally {
            setSaving('idle');
        }
    };

    const confirmDelete = async () => {
        if (!deleting) return;
        setDeletingBusy(true);
        try {
            const res = await fetch(`/api/school/assignments/${deleting.id}`, { method: 'DELETE' });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not delete the assignment.'));
            toast.success('Assignment deleted.');
            setDeleting(null);
            await fetchAssignments();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not delete the assignment.');
        } finally {
            setDeletingBusy(false);
        }
    };

    const tiles = [
        { key: 'upcoming' as const, icon: CalendarClock, hue: 'violet' as const, label: 'Upcoming', value: counts.upcoming, hint: 'due today or later' },
        { key: 'past' as const, icon: CheckCircle2, hue: 'slate' as const, label: 'Past due', value: counts.past, hint: 'deadline passed' },
        { key: 'mine' as const, icon: UserRound, hue: 'blue' as const, label: 'Set by me', value: counts.mine, hint: 'that you created' },
        { key: 'all' as const, icon: Briefcase, hue: 'emerald' as const, label: 'All', value: counts.all, hint: 'across your classes' },
    ];

    return (
        <div className="mx-auto w-full max-w-6xl pb-10">
            <PageHeader
                title="Assignments"
                eyebrow="Communication"
                icon={Briefcase}
                hue="violet"
                description="Set homework for a class, attach files, and review and grade what learners hand in."
                action={
                    <button type="button" className="btn-primary" onClick={openNew}>
                        <Plus className="size-4" aria-hidden /> New assignment
                    </button>
                }
            />

            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {tiles.map(({ key, ...tile }) => (
                    <StatFilterTile key={key} {...tile} loading={load.status === 'loading'} selected={view === key} onClick={() => setView(key)} />
                ))}
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <SearchBox className="flex-1" value={search} onChange={setSearch} placeholder="Search title, subject or class" />
                {streams.length > 1 && (
                    <SelectField
                        className="sm:w-56"
                        aria-label="Filter by class"
                        value={classFilter}
                        onChange={setClassFilter}
                        placeholder="All classes"
                        options={streams.map(s => ({ id: s.id, label: s.full_name }))}
                    />
                )}
            </div>

            {load.status === 'loading' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-hidden>
                    {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted/60" />)}
                </div>
            ) : load.status === 'error' ? (
                <EmptyState hue="rose" icon={<AlertTriangle className="size-6" />} title="Couldn't load assignments" description={load.message}
                    action={<button type="button" className="btn-secondary" onClick={() => { setLoad({ status: 'loading' }); void fetchAssignments(); }}>Try again</button>} />
            ) : shown.length === 0 ? (
                <EmptyState
                    hue="violet"
                    icon={<Briefcase className="size-6" />}
                    title={search || classFilter ? 'Nothing matches these filters' : view === 'upcoming' ? 'Nothing due' : view === 'past' ? 'No past assignments' : view === 'mine' ? "You haven't set any assignments" : 'No assignments yet'}
                    description={search || classFilter ? 'Clear the search or pick another class.' : 'Set one for a class and learners see it on their dashboard.'}
                    action={!search && !classFilter ? <button type="button" className="btn-primary" onClick={openNew}><Plus className="size-4" aria-hidden /> New assignment</button> : undefined}
                />
            ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {shown.map(a => {
                        const state = dueState(a.dueDate, today);
                        return (
                            <li key={a.id} className="min-w-0">
                                <article className={cn('flex h-full flex-col rounded-2xl border bg-card p-4 shadow-sm sm:p-5', state === 'today' ? 'border-rose-500/40' : 'border-border/70')}>
                                    <header className="flex items-start gap-3">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400" aria-hidden>
                                            <FileText className="size-5" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">{a.title}</h2>
                                            <p className="mt-0.5 text-xs text-muted-foreground">{a.subject} · {a.stream ?? 'Whole school'}</p>
                                        </div>
                                        {canManage(a) && (
                                            <div className="flex shrink-0 gap-1">
                                                <button type="button" className="btn-icon" onClick={() => openEdit(a)} aria-label={`Edit ${a.title}`} title="Edit"><Edit3 className="size-4" /></button>
                                                <button type="button" className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => setDeleting(a)} aria-label={`Delete ${a.title}`} title="Delete"><Trash2 className="size-4" /></button>
                                            </div>
                                        )}
                                    </header>
                                    {a.description && <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-foreground/80">{a.description}</p>}
                                    <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 text-xs">
                                        <span className={cn('inline-flex items-center gap-1 font-semibold', DUE_TONE[state])}>
                                            <CalendarClock className="size-3.5" aria-hidden />{dueLabel(a.dueDate, today)}
                                        </span>
                                        {a.fileUrl && (
                                            <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                                                <Paperclip className="size-3.5" aria-hidden />Attachment
                                            </a>
                                        )}
                                        <span className="text-muted-foreground">by {a.createdBy}</span>
                                        <button type="button" className="btn-secondary ml-auto h-8 text-xs" onClick={() => setReviewing(a)}>
                                            <Inbox className="size-3.5" aria-hidden />
                                            {a.submissionCount} submission{a.submissionCount === 1 ? '' : 's'}
                                        </button>
                                    </footer>
                                </article>
                            </li>
                        );
                    })}
                </ul>
            )}

            <Drawer
                isOpen={editorOpen}
                onClose={() => { if (saving === 'idle') setEditorOpen(false); }}
                title={editing ? 'Edit assignment' : 'New assignment'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setEditorOpen(false)} disabled={saving !== 'idle'}>Cancel</button>
                        <button type="button" className="btn-primary" onClick={() => void save()} disabled={!canSave}>
                            {saving !== 'idle' && <Loader2 className="size-4 animate-spin" aria-hidden />}
                            {saving === 'uploading' ? 'Uploading…' : saving === 'saving' ? 'Saving…' : editing ? 'Save changes' : 'Set assignment'}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <FormField label="Class" required htmlFor={`${id}-class`}>
                            <SelectField id={`${id}-class`} value={draft.streamId} placeholder={streams.length ? 'Choose class' : 'No classes available'}
                                options={streams.map(s => ({ id: s.id, label: s.full_name }))}
                                onChange={v => setDraft(d => ({ ...d, streamId: v, subjectId: '' }))} />
                        </FormField>
                        <FormField label="Subject" required htmlFor={`${id}-subject`}>
                            <SelectField id={`${id}-subject`} value={draft.subjectId} options={subjectOptions} disabled={!draft.streamId}
                                placeholder={draft.streamId ? 'Choose subject' : 'Choose the class first'}
                                onChange={v => setDraft(d => ({ ...d, subjectId: v }))} />
                        </FormField>
                    </div>
                    <FormField label="Title" required htmlFor={`${id}-title`}>
                        <InputField id={`${id}-title`} value={draft.title} maxLength={ASSIGNMENT_TITLE_MAX} placeholder="e.g. Fractions worksheet, questions 1–20"
                            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                    </FormField>
                    <FormField label="Due date" required htmlFor={`${id}-due`} hint={draft.dueDate ? dueLabel(draft.dueDate, today) : undefined}>
                        <InputField id={`${id}-due`} type="date" className="sm:w-56" value={draft.dueDate} min={editing ? undefined : today}
                            onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} />
                    </FormField>
                    <FormField label="Instructions" htmlFor={`${id}-desc`} hint={`${draft.description.length}/${ASSIGNMENT_DESCRIPTION_MAX}`}>
                        <TextareaField id={`${id}-desc`} rows={8} value={draft.description} maxLength={ASSIGNMENT_DESCRIPTION_MAX} placeholder="What learners should do, and how to hand it in."
                            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                    </FormField>
                    <FormField label="Attachment" htmlFor={`${id}-file`} hint="A worksheet or notes: PDF, image or document, up to 10 MB.">
                        <input ref={fileInput} id={`${id}-file`} type="file" className="sr-only" onChange={pickFile} />
                        {file || draft.fileUrl ? (
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
                                {file ? (
                                    <span className="flex min-w-0 items-center gap-2"><Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden /><span className="truncate">{file.name}</span></span>
                                ) : (
                                    <a href={draft.fileUrl} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 text-primary hover:underline">
                                        <Paperclip className="size-4 shrink-0" aria-hidden /><span className="truncate">Current attachment</span>
                                    </a>
                                )}
                                <button type="button" className="btn-icon shrink-0" aria-label="Remove attachment" onClick={() => { setFile(null); setDraft(d => ({ ...d, fileUrl: '' })); }}>
                                    <X className="size-4" />
                                </button>
                            </div>
                        ) : (
                            <button type="button" className="btn-secondary w-full" onClick={() => fileInput.current?.click()}>
                                <Paperclip className="size-4" aria-hidden /> Attach a file
                            </button>
                        )}
                    </FormField>
                </div>
            </Drawer>

            {reviewing && (
                <SubmissionsDrawer
                    assignment={reviewing}
                    canGrade={canManage(reviewing)}
                    onClose={() => setReviewing(null)}
                    onGraded={() => void fetchAssignments()}
                />
            )}

            <ConfirmDialog
                isOpen={deleting !== null}
                onClose={() => { if (!deletingBusy) setDeleting(null); }}
                onConfirm={() => void confirmDelete()}
                title="Delete assignment?"
                message={deleting ? `“${deleting.title}” for ${deleting.stream ?? 'the whole school'} will be removed${deleting.submissionCount > 0 ? `, with the ${deleting.submissionCount} submission${deleting.submissionCount === 1 ? '' : 's'} handed in` : ''}.` : ''}
                confirmText="Delete"
                variant="danger"
                loading={deletingBusy}
            />
        </div>
    );
}

/** One assignment's submissions: ungraded first, each graded in place. */
function SubmissionsDrawer({ assignment, canGrade, onClose, onGraded }: { assignment: Assignment; canGrade: boolean; onClose: () => void; onGraded: () => void }) {
    const id = useId();
    const [load, setLoad] = useState<Load<Submission[]>>({ status: 'loading' });
    const [gradingId, setGradingId] = useState<string | null>(null);
    const [grade, setGrade] = useState('');
    const [feedback, setFeedback] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchSubmissions = useCallback(async () => {
        try {
            const json = await getJson<{ data: Submission[] }>(`/api/school/submissions?assignment_id=${encodeURIComponent(assignment.id)}`, 'Could not load submissions.');
            setLoad({ status: 'ready', data: [...json.data].sort((a, b) => Number(a.grade != null) - Number(b.grade != null)) });
        } catch (err) {
            setLoad({ status: 'error', message: err instanceof Error ? err.message : 'Could not load submissions.' });
        }
    }, [assignment.id]);

    useEffect(() => { void fetchSubmissions(); }, [fetchSubmissions]);

    const startGrading = (s: Submission) => {
        setGradingId(s.id);
        setGrade(s.grade != null ? String(s.grade) : '');
        setFeedback(s.feedback ?? '');
    };

    const gradeNumber = grade.trim() === '' ? null : Number(grade);
    const gradeInvalid = gradeNumber != null && (Number.isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 100);

    const saveGrade = async () => {
        if (!gradingId || gradeInvalid) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/school/submissions/${gradingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grade: gradeNumber, feedback }),
            });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save the grade.'));
            toast.success('Grade saved.');
            setGradingId(null);
            await fetchSubmissions();
            onGraded();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save the grade.');
        } finally {
            setSaving(false);
        }
    };

    const graded = load.status === 'ready' ? load.data.filter(s => s.grade != null).length : 0;
    const total = load.status === 'ready' ? load.data.length : 0;

    return (
        <Drawer isOpen onClose={onClose} title={assignment.title} size="lg">
            <p className="mb-4 text-sm text-muted-foreground">
                {assignment.subject} · {assignment.stream ?? 'Whole school'} · {dueLabel(assignment.dueDate)}
                {load.status === 'ready' && total > 0 && <> · <strong className="text-foreground">{graded} of {total}</strong> graded</>}
            </p>
            {!canGrade && <p className="mb-4 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">Only the teacher who set this assignment, or the admin, can grade it.</p>}

            {load.status === 'loading' ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading submissions…</p>
            ) : load.status === 'error' ? (
                <p className="py-10 text-center text-sm text-destructive">{load.message}</p>
            ) : load.data.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nothing handed in yet.</p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {load.data.map(s => (
                        <li key={s.id} className="rounded-xl border border-border/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{s.studentName ?? 'Unknown learner'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {s.admissionNumber ? `${s.admissionNumber} · ` : ''}
                                        Handed in {new Date(s.submittedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        {s.submittedAt.slice(0, 10) > assignment.dueDate && <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">· late</span>}
                                    </p>
                                </div>
                                {s.grade != null && gradingId !== s.id && (
                                    <span className="shrink-0 rounded-full bg-emerald-500/12 px-2.5 py-1 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{s.grade}%</span>
                                )}
                            </div>
                            {s.submissionText && <p className="mt-3 whitespace-pre-line rounded-lg bg-muted/40 p-3 text-sm">{s.submissionText}</p>}
                            {s.fileUrl && (
                                <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
                                    <Paperclip className="size-3.5" aria-hidden /> Open their file
                                </a>
                            )}
                            {s.feedback && gradingId !== s.id && <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold">Feedback:</span> {s.feedback}</p>}

                            {canGrade && (gradingId === s.id ? (
                                <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
                                    <FormField label="Grade (%)" htmlFor={`${id}-${s.id}-grade`} error={gradeInvalid ? '0 to 100' : undefined}>
                                        <InputField id={`${id}-${s.id}-grade`} type="number" inputMode="decimal" min={0} max={100} value={grade} onChange={e => setGrade(e.target.value)} />
                                    </FormField>
                                    <FormField label="Feedback" htmlFor={`${id}-${s.id}-feedback`}>
                                        <InputField id={`${id}-${s.id}-feedback`} value={feedback} maxLength={ASSIGNMENT_FEEDBACK_MAX} placeholder="Optional" onChange={e => setFeedback(e.target.value)} />
                                    </FormField>
                                    <div className="flex gap-2 sm:col-span-2">
                                        <button type="button" className="btn-primary h-9 text-sm" onClick={() => void saveGrade()} disabled={saving || gradeInvalid}>
                                            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}Save grade
                                        </button>
                                        <button type="button" className="btn-secondary h-9 text-sm" onClick={() => setGradingId(null)} disabled={saving}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <button type="button" className="btn-secondary mt-3 h-8 text-xs" onClick={() => startGrading(s)}>
                                    {s.grade != null ? 'Change grade' : 'Grade'}
                                </button>
                            ))}
                        </li>
                    ))}
                </ul>
            )}
        </Drawer>
    );
}
