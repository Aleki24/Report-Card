"use client";

import { useState } from 'react';
import { CheckCircle2, Download, FileText, Loader2, Paperclip, Send, Star, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui';
import { FormField, TextareaField } from '@/components/ui/FormField';
import { apiErrorMessage } from '@/lib/api-error-message';
import { uploadAttachment } from '@/lib/upload-client';
import {
    ASSIGNMENT_DESCRIPTION_MAX, ASSIGNMENT_UPLOAD_MAX_BYTES, dueLabel, dueState, localToday,
    type StudentAssignment,
} from '@/lib/assignments';
import { cn } from '@/lib/utils';
import { Panel, QuietEmpty } from './shared';

type Status = 'graded' | 'handed-in' | 'overdue' | 'due';

function statusOf(a: StudentAssignment, today: string): Status {
    if (a.submission?.gradedAt || a.submission?.grade != null) return 'graded';
    if (a.submission) return 'handed-in';
    return dueState(a.dueDate, today) === 'overdue' ? 'overdue' : 'due';
}

/** Work still to do first (soonest due), then late work, then what's handed in. */
const ORDER: Record<Status, number> = { due: 0, overdue: 1, 'handed-in': 2, graded: 3 };

function StatusChip({ a, status, today }: { a: StudentAssignment; status: Status; today: string }) {
    const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold';
    if (status === 'graded') {
        return <span className={cn(base, 'bg-violet-500/10 text-violet-700 dark:text-violet-300')}><Star size={11} aria-hidden />{a.submission?.grade != null ? `Marked · ${a.submission.grade}%` : 'Marked'}</span>;
    }
    if (status === 'handed-in') return <span className={cn(base, 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400')}><CheckCircle2 size={11} aria-hidden />Handed in</span>;
    if (status === 'overdue') return <span className={cn(base, 'bg-red-500/10 text-red-700 dark:text-red-400')}>{dueLabel(a.dueDate, today)}</span>;
    const soon = dueState(a.dueDate, today) !== 'later';
    return <span className={cn(base, soon ? 'bg-amber-500/12 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground')}>{dueLabel(a.dueDate, today)}</span>;
}

interface HandInDialogProps {
    assignment: StudentAssignment | null;
    onClose: () => void;
    onHandedIn: () => void;
}

/** The teacher's brief, and the learner's answer: typed, attached, or both. Read-only once marked. */
function HandInDialog({ assignment, onClose, onHandedIn }: HandInDialogProps) {
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState<'idle' | 'uploading' | 'sending'>('idle');
    const today = localToday();
    const status = assignment ? statusOf(assignment, today) : 'due';
    const locked = status === 'graded';

    const close = () => {
        if (busy !== 'idle') return;
        setText('');
        setFile(null);
        onClose();
    };

    const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0];
        e.target.value = '';
        if (!picked) return;
        if (picked.size > ASSIGNMENT_UPLOAD_MAX_BYTES) { toast.error('Files must be under 10 MB.'); return; }
        setFile(picked);
    };

    const handIn = async () => {
        if (!assignment || locked) return;
        try {
            let fileUrl: string | null = null;
            if (file) {
                setBusy('uploading');
                fileUrl = await uploadAttachment(file);
            }
            setBusy('sending');
            const res = await fetch('/api/school/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignment_id: assignment.id, submission_text: text || null, file_url: fileUrl }),
            });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Your work was not handed in.'));
            toast.success(status === 'handed-in' ? 'Your hand-in was updated.' : 'Handed in. Well done!');
            setText('');
            setFile(null);
            onHandedIn();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Your work was not handed in.');
        } finally {
            setBusy('idle');
        }
    };

    return (
        <Modal
            isOpen={assignment !== null}
            onClose={close}
            title={assignment?.title ?? 'Assignment'}
            footer={locked ? (
                <button type="button" onClick={close} className="btn-secondary">Close</button>
            ) : (
                <>
                    <button type="button" onClick={close} disabled={busy !== 'idle'} className="btn-secondary">Cancel</button>
                    <button type="button" onClick={() => void handIn()} disabled={busy !== 'idle' || (!text.trim() && !file)} className="btn-primary">
                        {busy === 'idle' ? <Send size={14} aria-hidden /> : <Loader2 size={14} className="animate-spin" aria-hidden />}
                        {busy === 'uploading' ? 'Uploading…' : busy === 'sending' ? 'Handing in…' : status === 'handed-in' ? 'Replace my hand-in' : 'Hand in'}
                    </button>
                </>
            )}
        >
            {assignment && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{assignment.subjectName}</span>
                        <StatusChip a={assignment} status={status} today={today} />
                    </div>

                    {(assignment.description || assignment.fileUrl) && (
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                            <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">From your teacher</p>
                            {assignment.description && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{assignment.description}</p>}
                            {assignment.fileUrl && (
                                <a href={assignment.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                                    <Download size={14} aria-hidden /> Open the attachment
                                </a>
                            )}
                        </div>
                    )}

                    {locked ? (
                        <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-3">
                            <p className="text-sm font-semibold text-foreground">
                                {assignment.submission?.grade != null ? `Your mark: ${assignment.submission.grade}%` : 'Your teacher has marked this.'}
                            </p>
                            {assignment.submission?.feedback && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">“{assignment.submission.feedback}”</p>}
                        </div>
                    ) : (
                        <>
                            {status === 'handed-in' && assignment.submission && (
                                <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                                    You handed this in on {new Date(assignment.submission.submittedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}. Handing in again replaces it.
                                </p>
                            )}
                            <FormField label="Your answer" htmlFor="hand-in-text" hint="Type your answer, attach a file, or both.">
                                <TextareaField id="hand-in-text" value={text} onChange={e => setText(e.target.value)} rows={5} maxLength={ASSIGNMENT_DESCRIPTION_MAX} placeholder="Type your work here…" />
                            </FormField>
                            <div>
                                {file ? (
                                    <div className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
                                        <Paperclip size={14} className="shrink-0 text-muted-foreground" aria-hidden />
                                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                        <button type="button" onClick={() => setFile(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Remove file"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                                        <UploadCloud size={16} aria-hidden /> Attach a file (photo, PDF or document, up to 10 MB)
                                        <input type="file" className="sr-only" onChange={pickFile} accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" />
                                    </label>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </Modal>
    );
}

/** The learner's homework on their dashboard: what's due, what's late, what's handed in and marked. */
interface HomeworkPanelProps {
    assignments: StudentAssignment[];
    /** Reload after a hand-in. */
    onChanged: () => void;
    title?: string;
    emptyText?: string;
}

export default function HomeworkPanel({ assignments, onChanged, title = 'Homework', emptyText = 'No homework set for your class right now.' }: HomeworkPanelProps) {
    const [open, setOpen] = useState<StudentAssignment | null>(null);
    const today = localToday();
    const rows = assignments
        .map(a => ({ a, status: statusOf(a, today) }))
        .sort((x, y) => ORDER[x.status] - ORDER[y.status] || x.a.dueDate.localeCompare(y.a.dueDate));
    const toDo = rows.filter(r => r.status === 'due' || r.status === 'overdue').length;

    return (
        <Panel title={title} subtitle={toDo > 0 ? `${toDo} to hand in` : assignments.length > 0 ? 'All handed in' : undefined}>
            {rows.length === 0 ? (
                <QuietEmpty icon={<FileText size={18} />}>{emptyText}</QuietEmpty>
            ) : (
                <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-0.5">
                    {rows.map(({ a, status }) => (
                        <li key={a.id}>
                            <button
                                type="button"
                                onClick={() => setOpen(a)}
                                className="flex w-full items-center gap-3 rounded-xl border border-border/60 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-foreground">{a.title}</span>
                                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                        <span className="truncate">{a.subjectName}</span>
                                        <StatusChip a={a} status={status} today={today} />
                                    </span>
                                </span>
                                <span className={cn(
                                    'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold',
                                    status === 'due' || status === 'overdue' ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                                )}>
                                    {status === 'due' || status === 'overdue' ? 'Hand in' : 'View'}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <HandInDialog assignment={open} onClose={() => setOpen(null)} onHandedIn={() => { setOpen(null); onChanged(); }} />
        </Panel>
    );
}
