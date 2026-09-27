"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ChevronDown, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { FormField, InputField, TextareaField } from '@/components/ui/FormField';
import { StatusPill } from '@/components/ops/StatusPill';
import { errorText, opsFetch } from '@/lib/ops/client';
import { personName } from '@/lib/ops/format';
import {
    SCHEME_ACTION_DONE, SCHEME_DETAIL_FIELDS as DETAIL_FIELDS, SCHEME_TONES, nextSchemeEntry, schemeActions, schemeEntriesPayload, taughtRecord,
    type SchemeAction, type SchemeDetail, type SchemeEntry as Entry,
} from '@/lib/ops/forms/academics';
import { cn } from '@/lib/utils';

export { SCHEME_TONES };

interface Props { schemeId: string; canReview: boolean; userId: string; onClose: () => void; onChanged: () => void }

/** The weekly plan: edit rows, draft them with AI, submit for review, and tick lessons as taught. */
export function SchemeEditor({ schemeId, canReview, userId, onClose, onChanged }: Props) {
    const [scheme, setScheme] = useState<SchemeDetail | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [open, setOpen] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState({ weeks: '12', lessons: '4', topics: '' });
    const [comment, setComment] = useState('');

    const load = useCallback(async () => {
        try {
            const s = await opsFetch<SchemeDetail>(`/api/academics/schemes/${schemeId}`);
            setScheme(s);
            setEntries(s.entries);
            setDirty(false);
        } catch (err) { toast.error(errorText(err)); onClose(); }
    }, [schemeId, onClose]);
    useEffect(() => { void load(); }, [load]);

    const edit = (i: number, patch: Partial<Entry>) => { setEntries(es => es.map((e, j) => (j === i ? { ...e, ...patch } : e))); setDirty(true); };

    const save = async () => {
        setBusy(true);
        try {
            await opsFetch(`/api/academics/schemes/${schemeId}/entries`, { method: 'PUT', json: { entries: schemeEntriesPayload(entries) } });
            toast.success('Scheme saved.');
            await load();
            onChanged();
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };

    const runDraft = async () => {
        setBusy(true);
        try {
            const r = await opsFetch<{ entries: Entry[] }>(`/api/academics/schemes/${schemeId}/draft`, {
                method: 'POST', json: { weeks: Number(draft.weeks), lessons_per_week: Number(draft.lessons), topics: draft.topics },
            });
            setEntries(r.entries);
            setDirty(true);
            toast.success(`${r.entries.length} lessons drafted. Review them, then save.`);
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };

    const transition = async (action: SchemeAction) => {
        setBusy(true);
        try {
            await opsFetch(`/api/academics/schemes/${schemeId}/transition`, { method: 'POST', json: { action, comment: comment || undefined } });
            toast.success(SCHEME_ACTION_DONE[action]);
            setComment('');
            await load();
            onChanged();
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };

    const markTaught = async (e: Entry & { id: string }) => {
        if (!scheme) return;
        try {
            await opsFetch('/api/ops/records-of-work', { method: 'POST', json: taughtRecord(scheme, e) });
            toast.success('Recorded as taught.');
            await load();
            onChanged();
        } catch (err) { toast.error(errorText(err)); }
    };

    const isOwner = scheme?.teacher_id === userId;
    const covered = new Set(scheme?.covered ?? []);

    return (
        <Drawer isOpen onClose={onClose} title={scheme?.title ?? 'Scheme of work'} size="lg"
            footer={scheme?.editable ? <Button onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save scheme' : 'Saved'}</Button> : undefined}>
            {!scheme ? <div className="skeleton-bone h-64 rounded-2xl" /> : (
                <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <StatusPill status={scheme.status} tones={SCHEME_TONES} />
                        <span className="text-muted-foreground">{scheme.subject?.name} · {scheme.stream?.full_name} · {personName(scheme.teacher)}</span>
                        <span className="ml-auto tabular-nums text-muted-foreground">{covered.size}/{scheme.entries.length} taught</span>
                    </div>
                    {scheme.review_comment && (
                        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"><strong>Reviewer:</strong> {scheme.review_comment}</p>
                    )}

                    {scheme.editable && (
                        <details className="rounded-2xl border border-dashed border-border p-4">
                            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-violet-500" aria-hidden />Draft with AI</summary>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <FormField label="Teaching weeks" htmlFor="d-weeks"><InputField id="d-weeks" type="number" min={1} max={16} value={draft.weeks} onChange={e => setDraft(d => ({ ...d, weeks: e.target.value }))} /></FormField>
                                <FormField label="Lessons a week" htmlFor="d-lessons"><InputField id="d-lessons" type="number" min={1} max={10} value={draft.lessons} onChange={e => setDraft(d => ({ ...d, lessons: e.target.value }))} /></FormField>
                                <FormField label="Topics this term (optional)" htmlFor="d-topics" span="full"><TextareaField id="d-topics" value={draft.topics} onChange={e => setDraft(d => ({ ...d, topics: e.target.value }))} rows={2} /></FormField>
                            </div>
                            <Button className="mt-3" size="sm" onClick={runDraft} disabled={busy}><Sparkles />{busy ? 'Drafting…' : 'Draft entries'}</Button>
                            <p className="mt-2 text-[11px] text-muted-foreground">Replaces the rows below with a draft. Check every row before saving.</p>
                        </details>
                    )}

                    <ol className="flex flex-col gap-2">
                        {entries.map((e, i) => {
                            const taught = !!e.id && covered.has(e.id);
                            return (
                                <li key={e.id ?? `new-${i}`} className={cn('rounded-xl border bg-card', taught ? 'border-emerald-500/40' : 'border-border/60')}>
                                    <div className="flex flex-wrap items-center gap-2 p-2">
                                        <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">W{e.week} · L{e.lesson}</span>
                                        {scheme.editable ? (
                                            <InputField aria-label={`Topic, week ${e.week} lesson ${e.lesson}`} className="min-w-0 flex-1" value={e.topic} placeholder="Topic" onChange={ev => edit(i, { topic: ev.target.value })} />
                                        ) : <span className="min-w-0 flex-1 text-sm font-medium">{e.topic}{e.sub_topic && <span className="text-muted-foreground"> · {e.sub_topic}</span>}</span>}
                                        {taught && <CheckCircle2 className="size-4 text-emerald-600" aria-label="Taught" />}
                                        {!taught && e.id && isOwner && !dirty && <Button size="xs" variant="outline" onClick={() => void markTaught(e as Entry & { id: string })}>Taught</Button>}
                                        <Button size="icon-xs" variant="ghost" aria-label="Details" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}><ChevronDown className={cn(open === i && 'rotate-180')} /></Button>
                                        {scheme.editable && <Button size="icon-xs" variant="ghost" aria-label="Remove row" onClick={() => { setEntries(es => es.filter((_, j) => j !== i)); setDirty(true); }}><Trash2 className="text-destructive" /></Button>}
                                    </div>
                                    {open === i && (
                                        <div className="grid grid-cols-1 gap-3 border-t border-border/60 p-3 sm:grid-cols-2">
                                            {scheme.editable && (
                                                <>
                                                    <FormField label="Week" htmlFor={`w-${i}`}><InputField id={`w-${i}`} type="number" min={1} max={20} value={e.week} onChange={ev => edit(i, { week: Number(ev.target.value) })} /></FormField>
                                                    <FormField label="Lesson" htmlFor={`l-${i}`}><InputField id={`l-${i}`} type="number" min={1} max={20} value={e.lesson} onChange={ev => edit(i, { lesson: Number(ev.target.value) })} /></FormField>
                                                    <FormField label="Sub-topic / sub-strand" htmlFor={`st-${i}`} span="full"><InputField id={`st-${i}`} value={e.sub_topic ?? ''} onChange={ev => edit(i, { sub_topic: ev.target.value || null })} /></FormField>
                                                </>
                                            )}
                                            {DETAIL_FIELDS.map(([key, label]) => (
                                                <FormField key={key} label={label} htmlFor={`${key}-${i}`}>
                                                    {scheme.editable
                                                        ? <TextareaField id={`${key}-${i}`} rows={2} value={e[key] ?? ''} onChange={ev => edit(i, { [key]: ev.target.value || null })} />
                                                        : <p className="text-sm whitespace-pre-wrap">{e[key] || '—'}</p>}
                                                </FormField>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                    {scheme.editable && (
                        <Button variant="outline" size="sm" className="self-start" onClick={() => {
                            setEntries(es => [...es, nextSchemeEntry(es)]);
                            setOpen(entries.length);
                            setDirty(true);
                        }}><Plus />Add lesson</Button>
                    )}

                    {schemeActions(scheme, { owner: isOwner, reviewer: canReview }).length > 0 ? (
                        <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
                            {canReview && scheme.status !== 'DRAFT' && scheme.status !== 'RETURNED' && (
                                <FormField label="Review comment" htmlFor="scheme-comment"><TextareaField id="scheme-comment" value={comment} onChange={e => setComment(e.target.value)} rows={2} /></FormField>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {schemeActions(scheme, { owner: isOwner, reviewer: canReview }).map(a => (
                                    <Button key={a} variant={a === 'RETURN' ? 'destructive' : 'default'} onClick={() => void transition(a)} disabled={busy || (a === 'SUBMIT' && dirty)}>
                                        {a === 'SUBMIT' ? 'Submit for review' : a === 'APPROVE' ? 'Approve' : 'Return'}
                                    </Button>
                                ))}
                            </div>
                            {dirty && <p className="text-xs text-muted-foreground">Save your changes before submitting.</p>}
                        </section>
                    ) : null}
                </div>
            )}
        </Drawer>
    );
}
