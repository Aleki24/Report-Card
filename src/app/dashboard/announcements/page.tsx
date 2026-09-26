"use client";

import React, { useCallback, useEffect, useId, useState } from 'react';
import { AlertTriangle, Bell, Edit3, Loader2, Megaphone, MessageSquare, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FormField, InputField } from '@/components/ui';
import { SearchBox } from '@/components/ui/SearchBox';
import { StatFilterTile } from '@/components/ui/StatFilterTile';
import { FormattedTextarea } from '@/components/ui/FormattedTextarea';
import { renderFormattedText } from '@/lib/formatted-text';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useAuth } from '@/components/AuthProvider';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
    ANNOUNCEMENT_CONTENT_MAX, ANNOUNCEMENT_SMS_CHARS, ANNOUNCEMENT_TITLE_MAX, announcementSmsText,
    type Announcement, type AnnouncementCounts, type AnnouncementFilter, type AnnouncementSmsResult, type AnnouncementsResponse,
} from '@/lib/announcements';

type Feed = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: Announcement[]; nextCursor: string | null };

interface Draft { title: string; content: string; important: boolean; sendSms: boolean }
const EMPTY_DRAFT: Draft = { title: '', content: '', important: false, sendSms: false };

const initialsOf = (name: string) => name.replace(/^(Admin|Class Teacher|Subject Teacher|Staff)\s+/, '').split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';

/** "Today, 09:40", "Yesterday, 16:05", or "12 Sep 2026". */
function postedAt(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const dayDiff = Math.round((new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86_400_000);
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (dayDiff === 0) return `Today, ${time}`;
    if (dayDiff === 1) return `Yesterday, ${time}`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AnnouncementsPage() {
    const { role, profile } = useAuth();
    const id = useId();
    const isAdmin = role === 'ADMIN';
    // Non-teaching staff read announcements; posting is for admins and teachers.
    const canPost = isRoleIn(role, STAFF_TEACHING_ROLES);
    // The admin manages every announcement; others only their own (as the API).
    const canManage = (a: Announcement) => isAdmin || (!!profile && a.postedById === profile.id);

    const [filter, setFilter] = useState<AnnouncementFilter>('all');
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [feed, setFeed] = useState<Feed>({ status: 'loading' });
    const [counts, setCounts] = useState<AnnouncementCounts | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
    const [saving, setSaving] = useState(false);
    const [smsResult, setSmsResult] = useState<AnnouncementSmsResult | null>(null);
    const [deleting, setDeleting] = useState<Announcement | null>(null);
    const [deletingBusy, setDeletingBusy] = useState(false);

    // Searching runs on the server, a moment after typing stops.
    useEffect(() => {
        const timer = window.setTimeout(() => setQuery(search.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    const pageUrl = useCallback((before?: string) => {
        const params = new URLSearchParams();
        if (filter !== 'all') params.set('filter', filter);
        if (query) params.set('q', query);
        if (before) params.set('before', before);
        return `/api/school/announcements?${params.toString()}`;
    }, [filter, query]);

    useEffect(() => {
        const controller = new AbortController();
        fetch(pageUrl(), { signal: controller.signal, cache: 'no-store' })
            .then(async res => {
                const json: unknown = await res.json().catch(() => null);
                if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load announcements.'));
                const body = json as AnnouncementsResponse;
                setFeed({ status: 'ready', items: body.data, nextCursor: body.nextCursor });
                if (body.counts) setCounts(body.counts);
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setFeed({ status: 'error', message: err instanceof Error ? err.message : 'Could not load announcements.' });
            });
        return () => controller.abort();
    }, [pageUrl, reloadKey]);

    const reload = () => { setFeed({ status: 'loading' }); setReloadKey(k => k + 1); };

    const loadMore = async () => {
        if (feed.status !== 'ready' || !feed.nextCursor) return;
        setLoadingMore(true);
        try {
            const res = await fetch(pageUrl(feed.nextCursor), { cache: 'no-store' });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load older announcements.'));
            const body = json as AnnouncementsResponse;
            setFeed(prev => prev.status === 'ready'
                ? { status: 'ready', items: [...prev.items, ...body.data], nextCursor: body.nextCursor }
                : prev);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not load older announcements.');
        } finally {
            setLoadingMore(false);
        }
    };

    const selectFilter = (next: AnnouncementFilter) => {
        if (next === filter) return;
        setFeed({ status: 'loading' });
        setFilter(next);
    };

    const openNew = () => { setEditing(null); setDraft(EMPTY_DRAFT); setSmsResult(null); setEditorOpen(true); };
    const openEdit = (a: Announcement) => {
        setEditing(a);
        setDraft({ title: a.title, content: a.content, important: a.isImportant, sendSms: false });
        setSmsResult(null);
        setEditorOpen(true);
    };

    const titleTrimmed = draft.title.trim();
    const contentTrimmed = draft.content.trim();
    const canSave = titleTrimmed.length > 0 && contentTrimmed.length > 0 && !saving;

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const body = editing
                ? { title: titleTrimmed, content: contentTrimmed, is_important: draft.important }
                : { title: titleTrimmed, content: contentTrimmed, is_important: draft.important, send_sms: isAdmin && draft.sendSms };
            const res = await fetch(editing ? `/api/school/announcements/${editing.id}` : '/api/school/announcements', {
                method: editing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json().catch(() => null) as { sms?: AnnouncementSmsResult; warning?: string; error?: string } | null;
            if (!res.ok) throw new Error(apiErrorMessage(json, editing ? 'Could not update the announcement.' : 'Could not post the announcement.'));

            if (json?.warning) toast.warning(json.warning);
            if (!editing && json?.sms) {
                setSmsResult(json.sms);
            } else {
                toast.success(editing ? 'Announcement updated.' : 'Announcement posted.');
                setEditorOpen(false);
            }
            reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Something went wrong. Try again.');
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleting) return;
        setDeletingBusy(true);
        try {
            const res = await fetch(`/api/school/announcements/${deleting.id}`, { method: 'DELETE' });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not delete the announcement.'));
            toast.success('Announcement deleted.');
            setDeleting(null);
            reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not delete the announcement.');
        } finally {
            setDeletingBusy(false);
        }
    };

    const tiles = [
        { key: 'all' as const, icon: Megaphone, hue: 'rose' as const, label: 'All', value: counts?.all ?? 0, hint: 'posted to the school' },
        { key: 'important' as const, icon: AlertTriangle, hue: 'amber' as const, label: 'Important', value: counts?.important ?? 0, hint: 'flagged for attention' },
        ...(canPost ? [{ key: 'mine' as const, icon: UserRound, hue: 'blue' as const, label: 'Mine', value: counts?.mine ?? 0, hint: 'that you posted' }] : []),
    ];

    const smsPreview = announcementSmsText(draft.title, draft.content);

    return (
        <div className="mx-auto w-full max-w-5xl pb-10">
            <PageHeader
                title="Announcements"
                eyebrow="Communication"
                icon={Bell}
                hue="rose"
                description={canPost ? 'Post notices to the whole school, and text the important ones to guardians.' : 'Notices from the school.'}
                action={canPost ? (
                    <button type="button" className="btn-primary" onClick={openNew}>
                        <Plus className="size-4" aria-hidden /> New announcement
                    </button>
                ) : undefined}
            />

            <div className={cn('mb-4 grid gap-3', tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                {tiles.map(({ key, ...tile }) => (
                    <StatFilterTile key={key} {...tile} loading={counts === null} selected={filter === key} onClick={() => selectFilter(key)} />
                ))}
            </div>

            <SearchBox className="mb-4" value={search} onChange={setSearch} placeholder="Search announcements" />

            {feed.status === 'loading' ? (
                <div className="space-y-3" aria-hidden>
                    {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/60" />)}
                </div>
            ) : feed.status === 'error' ? (
                <EmptyState hue="rose" icon={<AlertTriangle className="size-6" />} title="Couldn't load announcements" description={feed.message}
                    action={<button type="button" className="btn-secondary" onClick={reload}>Try again</button>} />
            ) : feed.items.length === 0 ? (
                <EmptyState
                    hue="rose"
                    icon={<Bell className="size-6" />}
                    title={query ? 'Nothing matches that search' : filter === 'important' ? 'No important notices' : filter === 'mine' ? "You haven't posted yet" : 'No announcements yet'}
                    description={query ? 'Try other words, or clear the search.' : canPost ? 'Post one and it appears here and on everyone’s dashboard.' : 'Notices from the school will appear here.'}
                    action={canPost && !query ? <button type="button" className="btn-primary" onClick={openNew}><Plus className="size-4" aria-hidden /> New announcement</button> : undefined}
                />
            ) : (
                <>
                    <ul className="flex flex-col gap-3">
                        {feed.items.map(a => (
                            <li key={a.id}>
                                <article className={cn('rounded-2xl border bg-card p-4 shadow-sm sm:p-5', a.isImportant ? 'border-rose-500/40' : 'border-border/70')}>
                                    <header className="flex items-start gap-3">
                                        <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold', a.isImportant ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400' : 'bg-primary/10 text-primary')}>
                                            {initialsOf(a.postedBy)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-sm font-semibold text-foreground sm:text-base">{a.title}</h2>
                                                {a.isImportant && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                                                        <AlertTriangle className="size-3" aria-hidden /> Important
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {a.postedBy} · <time dateTime={a.createdAt}>{postedAt(a.createdAt)}</time>
                                            </p>
                                        </div>
                                        {canManage(a) && (
                                            <div className="flex shrink-0 gap-1">
                                                <button type="button" className="btn-icon" onClick={() => openEdit(a)} aria-label={`Edit ${a.title}`} title="Edit"><Edit3 className="size-4" /></button>
                                                <button type="button" className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => setDeleting(a)} aria-label={`Delete ${a.title}`} title="Delete"><Trash2 className="size-4" /></button>
                                            </div>
                                        )}
                                    </header>
                                    <div className="mt-3 text-sm leading-relaxed text-foreground/90 sm:pl-[3.25rem]">{renderFormattedText(a.content)}</div>
                                </article>
                            </li>
                        ))}
                    </ul>
                    {feed.nextCursor && (
                        <div className="mt-4 flex justify-center">
                            <button type="button" className="btn-secondary" onClick={() => void loadMore()} disabled={loadingMore}>
                                {loadingMore && <Loader2 className="size-4 animate-spin" aria-hidden />}
                                {loadingMore ? 'Loading…' : 'Show older announcements'}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* A side drawer, so the list stays in view while writing. */}
            <Drawer
                isOpen={editorOpen}
                onClose={() => { if (!saving) setEditorOpen(false); }}
                title={smsResult ? 'Announcement posted' : editing ? 'Edit announcement' : 'New announcement'}
                size="lg"
                footer={smsResult ? (
                    <button type="button" className="btn-primary" onClick={() => setEditorOpen(false)}>Done</button>
                ) : (
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
                        <button type="button" className="btn-primary" onClick={() => void save()} disabled={!canSave}>
                            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                            {saving ? 'Saving…' : editing ? 'Save changes' : draft.sendSms && isAdmin ? 'Post and text guardians' : 'Post'}
                        </button>
                    </>
                )}
            >
                {smsResult ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" aria-hidden>
                            <MessageSquare className="size-6" />
                        </span>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            {smsResult.total === 0
                                ? 'Posted. No guardian phone numbers are on file, so no texts went out.'
                                : <>Posted and texted to <strong className="text-foreground">{smsResult.sent}</strong> of {smsResult.total} guardians{smsResult.failed > 0 ? ` (${smsResult.failed} failed)` : ''}.</>}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        <FormField label="Title" required htmlFor={`${id}-title`} hint={`${draft.title.length}/${ANNOUNCEMENT_TITLE_MAX}`}>
                            <InputField id={`${id}-title`} value={draft.title} maxLength={ANNOUNCEMENT_TITLE_MAX} placeholder="e.g. Half-term break dates" onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                        </FormField>
                        <FormField label="Message" required htmlFor={`${id}-content`} hint={`${draft.content.length}/${ANNOUNCEMENT_CONTENT_MAX} · **bold**, *italic* and lists are supported`}>
                            <FormattedTextarea id={`${id}-content`} value={draft.content} maxLength={ANNOUNCEMENT_CONTENT_MAX} rows={10} minHeight={220} placeholder="Write the announcement…" onChange={content => setDraft(d => ({ ...d, content }))} />
                        </FormField>

                        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border p-4">
                            <span>
                                <span className="block text-sm font-medium">Mark as important</span>
                                <span className="block text-xs text-muted-foreground">Highlighted in red on the list and on dashboards.</span>
                            </span>
                            <input type="checkbox" role="switch" className="mt-1 size-5 shrink-0 accent-primary" checked={draft.important} onChange={e => setDraft(d => ({ ...d, important: e.target.checked }))} />
                        </label>

                        {!editing && isAdmin && (
                            <div className="rounded-xl border border-border p-4">
                                <label className="flex cursor-pointer items-start justify-between gap-4">
                                    <span>
                                        <span className="flex items-center gap-1.5 text-sm font-medium"><MessageSquare className="size-4" aria-hidden /> Also text every guardian</span>
                                        <span className="block text-xs text-muted-foreground">One SMS to each guardian phone on file for active learners. SMS costs apply.</span>
                                    </span>
                                    <input type="checkbox" role="switch" className="mt-1 size-5 shrink-0 accent-primary" checked={draft.sendSms} onChange={e => setDraft(d => ({ ...d, sendSms: e.target.checked }))} />
                                </label>
                                {draft.sendSms && (titleTrimmed || contentTrimmed) && (
                                    <div className="mt-3 rounded-lg bg-muted/50 p-3">
                                        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
                                            The text guardians receive ({smsPreview.length}/{ANNOUNCEMENT_SMS_CHARS} characters{`${titleTrimmed}: ${contentTrimmed}`.length > ANNOUNCEMENT_SMS_CHARS ? ', cut short' : ''})
                                        </p>
                                        <p className="whitespace-pre-wrap font-mono text-xs">{smsPreview}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Drawer>

            <ConfirmDialog
                isOpen={deleting !== null}
                onClose={() => { if (!deletingBusy) setDeleting(null); }}
                onConfirm={() => void confirmDelete()}
                title="Delete announcement?"
                message={deleting ? `“${deleting.title}” will be removed for everyone. Texts already sent can't be recalled.` : ''}
                confirmText="Delete"
                variant="danger"
                loading={deletingBusy}
            />
        </div>
    );
}
