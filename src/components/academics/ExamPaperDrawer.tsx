"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, Upload } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { FormField, InputField, SelectField, TextareaField } from '@/components/ui/FormField';
import { StatusPill } from '@/components/ops/StatusPill';
import { useAuth } from '@/components/AuthProvider';
import { errorText, opsFetch } from '@/lib/ops/client';
import { dateTime, humanize, personName } from '@/lib/ops/format';
import {
    EDITABLE_BY_OWNER, PRINT_STATUSES, TRANSITIONS, canAct, canOpenFiles,
    type PaperAction, type PaperFileKind,
} from '@/lib/academics/exam-papers';
import { PAPER_STATUS_TONES, type ExamPaper, type PaperReview } from './examPaperTypes';

interface Props {
    paperId: string | null;
    onClose: () => void;
    onChanged: () => void;
}

const ACTION_ORDER: readonly PaperAction[] = ['SUBMIT', 'APPROVE', 'RETURN', 'LOCK', 'RELEASE'];

/** A paper's details, files, moderation history and the actions open to the viewer. */
export function ExamPaperDrawer({ paperId, onClose, onChanged }: Props) {
    const { profile, can } = useAuth();
    const [paper, setPaper] = useState<(ExamPaper & { reviews: PaperReview[] }) | null>(null);
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [replace, setReplace] = useState<{ paper: File | null; scheme: File | null }>({ paper: null, scheme: null });

    const load = useCallback(async () => {
        if (!paperId) return;
        try { setPaper(await opsFetch(`/api/academics/exam-papers/${paperId}`)); }
        catch (err) { toast.error(errorText(err)); onClose(); }
    }, [paperId, onClose]);

    // The parent keys this drawer by paper, so state starts fresh for each one.
    useEffect(() => { void load(); }, [load]);

    const actor = { userId: profile?.id ?? '', can };

    const run = async (action: PaperAction) => {
        setBusy(true);
        try {
            await opsFetch(`/api/academics/exam-papers/${paperId}/transition`, { method: 'POST', json: { action, comment: comment || undefined } });
            toast.success(`${TRANSITIONS[action].label}: done.`);
            setComment('');
            await load();
            onChanged();
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };

    const patch = async (body: FormData | Record<string, unknown>, success: string) => {
        setBusy(true);
        try {
            await opsFetch(`/api/academics/exam-papers/${paperId}`, body instanceof FormData ? { method: 'PATCH', body } : { method: 'PATCH', json: body });
            toast.success(success);
            await load();
            onChanged();
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };

    const uploadReplacements = () => {
        const form = new FormData();
        if (replace.paper) form.append('paper', replace.paper);
        if (replace.scheme) form.append('scheme', replace.scheme);
        void patch(form, 'Files replaced.').then(() => setReplace({ paper: null, scheme: null }));
    };

    const openFile = (kind: PaperFileKind) => window.open(`/api/academics/exam-papers/${paperId}/file?kind=${kind}`, '_blank', 'noopener');

    const actions = paper ? ACTION_ORDER.filter(a => canAct(a, paper, actor)) : [];
    const canComment = paper ? canAct('COMMENT', paper, actor) : false;
    const ownerEditable = !!paper && (paper.uploaded_by === actor.userId && EDITABLE_BY_OWNER.includes(paper.status) || can('exam_papers.manage'));

    return (
        <Drawer isOpen={paperId !== null} onClose={onClose} title={paper?.title ?? 'Exam paper'} size="lg">
            {!paper ? (
                <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-bone h-10 rounded-xl" />)}</div>
            ) : (
                <div className="flex flex-col gap-6">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-0.5"><StatusPill status={paper.status} tones={PAPER_STATUS_TONES} /></dd></div>
                        <div><dt className="text-xs text-muted-foreground">Subject</dt><dd className="mt-0.5 font-medium">{paper.subject?.name ?? '—'} {paper.paper_label && <span className="text-muted-foreground">({paper.paper_label})</span>}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Class</dt><dd className="mt-0.5">{paper.grade?.name_display ?? 'Any'}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Term / exam</dt><dd className="mt-0.5">{[paper.term?.name, paper.exam?.name].filter(Boolean).join(' · ') || '—'}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Set by</dt><dd className="mt-0.5">{personName(paper.uploader)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Moderated by</dt><dd className="mt-0.5">{paper.moderator ? personName(paper.moderator) : '—'}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Release</dt><dd className="mt-0.5">{dateTime(paper.release_at)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Copies</dt><dd className="mt-0.5 tabular-nums">{paper.copies_needed || '—'}</dd></div>
                    </dl>

                    {canOpenFiles(paper, actor) && (
                        <section className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => openFile('paper')} disabled={!paper.paper_path}><FileText />Open paper</Button>
                            <Button variant="outline" onClick={() => openFile('scheme')} disabled={!paper.scheme_path}><Download />Marking scheme</Button>
                            <p className="w-full text-[11px] text-muted-foreground">PDFs open stamped with your name and the time. Every download is logged.</p>
                        </section>
                    )}

                    {ownerEditable && (
                        <section className="rounded-2xl border border-dashed border-border p-4">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Upload className="size-4" aria-hidden />Replace files</h3>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <FormField label="Paper" htmlFor="replace-paper">
                                    <InputField id="replace-paper" type="file" accept=".pdf,.doc,.docx" onChange={e => setReplace(r => ({ ...r, paper: e.target.files?.[0] ?? null }))} />
                                </FormField>
                                <FormField label="Marking scheme" htmlFor="replace-scheme">
                                    <InputField id="replace-scheme" type="file" accept=".pdf,.doc,.docx" onChange={e => setReplace(r => ({ ...r, scheme: e.target.files?.[0] ?? null }))} />
                                </FormField>
                            </div>
                            <Button className="mt-3" size="sm" onClick={uploadReplacements} disabled={busy || (!replace.paper && !replace.scheme)}>Upload</Button>
                        </section>
                    )}

                    {can('exam_papers.manage') && (paper.status === 'APPROVED' || paper.status === 'LOCKED') && (
                        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <FormField label="Printing" htmlFor="print-status">
                                <SelectField id="print-status" value={paper.print_status} placeholder={null} options={PRINT_STATUSES.map(s => ({ id: s, label: humanize(s) }))} onChange={v => void patch({ print_status: v }, 'Printing updated.')} />
                            </FormField>
                        </section>
                    )}

                    {(actions.length > 0 || canComment) && (
                        <section className="flex flex-col gap-3">
                            <FormField label="Comment" htmlFor="paper-comment" hint="Required when returning a paper.">
                                <TextareaField id="paper-comment" value={comment} onChange={e => setComment(e.target.value)} rows={3} />
                            </FormField>
                            <div className="flex flex-wrap gap-2">
                                {actions.map(a => (
                                    <Button key={a} variant={a === 'RETURN' ? 'destructive' : 'default'} disabled={busy} onClick={() => void run(a)}>{TRANSITIONS[a].label}</Button>
                                ))}
                                {canComment && <Button variant="outline" disabled={busy || !comment.trim()} onClick={() => void run('COMMENT')}>Add comment</Button>}
                            </div>
                        </section>
                    )}

                    <section>
                        <h3 className="mb-2 text-sm font-semibold">History</h3>
                        {paper.reviews.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No moderation activity yet.</p>
                        ) : (
                            <ol className="flex flex-col gap-3 border-l border-border pl-4">
                                {paper.reviews.map(r => (
                                    <li key={r.id} className="text-sm">
                                        <p><span className="font-medium">{personName(r.reviewer)}</span> <span className="text-muted-foreground">· {humanize(r.action)} · {dateTime(r.created_at)}</span></p>
                                        {r.comment && <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{r.comment}</p>}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            )}
        </Drawer>
    );
}
