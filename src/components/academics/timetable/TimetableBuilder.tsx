"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Lock, Sparkles, Trash2, Unlock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FormField, InputField, SelectField } from '@/components/ui/FormField';
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import { errorText, opsFetch } from '@/lib/ops/client';
import { dateTime } from '@/lib/ops/format';
import type { TimetableConfig, TimetableLesson, TimetableVersion } from '@/lib/timetable/config';
import { TimetableGrid } from './TimetableGrid';

const STATUS_TONES: Record<TimetableVersion['status'], PillTone> = { DRAFT: 'neutral', PUBLISHED: 'good', ARCHIVED: 'warn' };

/**
 * Generate drafts, inspect and adjust them class by class (click a lesson,
 * then the slot to move or swap it into), pin lessons, and publish.
 */
export function TimetableBuilder() {
    const [versions, setVersions] = useState<TimetableVersion[]>([]);
    const [config, setConfig] = useState<TimetableConfig | null>(null);
    const [activeId, setActiveId] = useState('');
    const [lessons, setLessons] = useState<TimetableLesson[]>([]);
    const [streamId, setStreamId] = useState('');
    const [selected, setSelected] = useState<TimetableLesson | null>(null);
    const [name, setName] = useState('');
    const [generating, setGenerating] = useState(false);
    const [confirm, setConfirm] = useState<'publish' | 'delete' | null>(null);

    const loadVersions = useCallback(async () => {
        try {
            const list = await opsFetch<TimetableVersion[]>('/api/academics/timetable/versions');
            setVersions(list);
            setActiveId(id => id || list[0]?.id || '');
        } catch (err) { toast.error(errorText(err)); }
    }, []);

    const loadActive = useCallback(async (id: string) => {
        if (!id) return;
        try {
            const r = await opsFetch<{ lessons: TimetableLesson[] }>(`/api/academics/timetable/versions/${id}`);
            setLessons(r.lessons);
        } catch (err) { toast.error(errorText(err)); }
    }, []);

    useEffect(() => {
        void loadVersions();
        opsFetch<TimetableConfig>('/api/academics/timetable/config').then(setConfig).catch(() => undefined);
    }, [loadVersions]);
    useEffect(() => { void loadActive(activeId); }, [activeId, loadActive]);

    const active = versions.find(v => v.id === activeId) ?? null;
    const streams = useMemo(() => {
        const seen = new Map<string, string>();
        lessons.forEach(l => seen.set(l.grade_stream_id, l.stream?.full_name ?? ''));
        return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    }, [lessons]);
    const shownStream = streamId || streams[0]?.id || '';
    const classLessons = lessons.filter(l => l.grade_stream_id === shownStream);

    const generate = async () => {
        setGenerating(true);
        try {
            const v = await opsFetch<TimetableVersion>('/api/academics/timetable/generate', {
                method: 'POST',
                json: { name: name.trim() || `Draft ${new Date().toLocaleDateString('en-KE')}`, ...(activeId ? { keep_locked_from: activeId } : {}) },
            });
            toast.success('Draft generated.');
            setName('');
            setActiveId(v.id);
            await loadVersions();
        } catch (err) { toast.error(errorText(err)); }
        finally { setGenerating(false); }
    };

    const moveTo = async (day: number, period: number) => {
        if (!selected) return;
        try {
            await opsFetch(`/api/academics/timetable/lessons/${selected.id}`, { method: 'PATCH', json: { day, period } });
            setSelected(null);
            await loadActive(activeId);
        } catch (err) { toast.error(errorText(err)); }
    };

    const toggleLock = async (lesson: TimetableLesson) => {
        try {
            await opsFetch(`/api/academics/timetable/lessons/${lesson.id}`, { method: 'PATCH', json: { locked: !lesson.locked } });
            setSelected(null);
            await loadActive(activeId);
        } catch (err) { toast.error(errorText(err)); }
    };

    const onCell = (day: number, period: number, lesson: TimetableLesson | null) => {
        if (selected && (selected.day !== day || selected.period !== period)) void moveTo(day, period);
        else setSelected(lesson && lesson.id !== selected?.id ? lesson : null);
    };

    const setStatus = async (status: 'PUBLISHED') => {
        try {
            await opsFetch(`/api/academics/timetable/versions/${activeId}`, { method: 'PATCH', json: { status } });
            toast.success('Timetable published. Teachers and learners now see it.');
            await loadVersions();
        } catch (err) { toast.error(errorText(err)); }
        finally { setConfirm(null); }
    };

    const remove = async () => {
        try {
            await opsFetch(`/api/academics/timetable/versions/${activeId}`, { method: 'DELETE' });
            toast.success('Draft deleted.');
            setActiveId('');
            setLessons([]);
            await loadVersions();
        } catch (err) { toast.error(errorText(err)); }
        finally { setConfirm(null); }
    };

    const unplaced = active?.stats.unplaced ?? [];

    return (
        <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:p-5">
                <FormField label="New draft name" htmlFor="tt-name" className="sm:flex-1">
                    <InputField id="tt-name" value={name} placeholder="e.g. Term 3 timetable" onChange={e => setName(e.target.value)} />
                </FormField>
                <Button onClick={generate} disabled={generating}><Sparkles />{generating ? 'Generating…' : 'Generate timetable'}</Button>
            </section>
            {activeId && <p className="-mt-3 text-xs text-muted-foreground">Pinned lessons in the selected draft keep their slots when you generate again.</p>}

            {versions.length > 0 && (
                <section className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <FormField label="Draft" htmlFor="tt-version" className="sm:max-w-sm sm:flex-1">
                        <SelectField id="tt-version" value={activeId} placeholder={null} onChange={v => { setActiveId(v); setSelected(null); }}
                            options={versions.map(v => ({ id: v.id, label: `${v.name} · ${v.status.toLowerCase()} · ${dateTime(v.created_at)}` }))} />
                    </FormField>
                    {streams.length > 0 && (
                        <FormField label="Class" htmlFor="tt-class" className="sm:max-w-xs sm:flex-1">
                            <SelectField id="tt-class" value={shownStream} placeholder={null} onChange={v => { setStreamId(v); setSelected(null); }} options={streams} />
                        </FormField>
                    )}
                    {active && (
                        <div className="flex flex-wrap gap-2 sm:ml-auto">
                            {active.status !== 'PUBLISHED' && <Button onClick={() => setConfirm('publish')}><Upload />Publish</Button>}
                            {active.status !== 'PUBLISHED' && <Button variant="destructive" onClick={() => setConfirm('delete')}><Trash2 />Delete</Button>}
                        </div>
                    )}
                </section>
            )}

            {active && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <StatusPill status={active.status} tones={STATUS_TONES} />
                    {active.stats.required !== undefined && (
                        <span className="flex items-center gap-1.5">
                            {unplaced.length === 0 ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : <AlertTriangle className="size-4 text-amber-600" aria-hidden />}
                            {active.stats.placed} of {active.stats.required} lessons placed
                        </span>
                    )}
                    {selected && (
                        <span className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5">
                            Moving {selected.subject?.name}: pick a slot
                            <Button size="xs" variant="outline" onClick={() => void toggleLock(selected)}>{selected.locked ? <><Unlock />Unpin</> : <><Lock />Pin here</>}</Button>
                            <Button size="xs" variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
                        </span>
                    )}
                </div>
            )}

            {unplaced.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                    <p className="font-medium">Not placed — lighten these loads, free the teacher, or add rooms, then generate again:</p>
                    <ul className="mt-1 list-inside list-disc text-muted-foreground">{unplaced.slice(0, 12).map((u, i) => <li key={i}>{u.label}: {u.lessons} lesson{u.lessons === 1 ? '' : 's'}</li>)}</ul>
                </div>
            )}

            {config && active && classLessons.length > 0 && (
                <TimetableGrid config={config} lessons={classLessons} mode="class" selectedId={selected?.id} onCellClick={onCell} />
            )}
            {versions.length === 0 && <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">Set up the day and teaching loads, then generate your first draft.</p>}

            <ConfirmDialog
                isOpen={confirm !== null}
                onClose={() => setConfirm(null)}
                onConfirm={() => void (confirm === 'publish' ? setStatus('PUBLISHED') : remove())}
                title={confirm === 'publish' ? 'Publish this timetable?' : 'Delete this draft?'}
                message={confirm === 'publish' ? 'It replaces the timetable teachers and learners see now; the current one is archived.' : 'The draft and its lessons are removed.'}
                confirmText={confirm === 'publish' ? 'Publish' : 'Delete'}
                variant={confirm === 'delete' ? 'danger' : 'default'}
            />
        </div>
    );
}
