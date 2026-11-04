"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Lock, ShieldCheck, Shuffle, Trash2, Unlock, Upload, Users } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { FormField, InputField, SelectField } from '@/components/ui/FormField';
import { StatusPill } from '@/components/ops/StatusPill';
import { errorText, opsFetch } from '@/lib/ops/client';
import { dateTime } from '@/lib/ops/format';
import { describeQuality, type TimetableConfig, type TimetableLesson, type TimetableVersion } from '@/lib/timetable/config';
import { timetablePdfUrl } from '@/lib/timetable/pdf-url';
import { PUBLISH_TIMETABLE_WARNING, VERSION_TONES as STATUS_TONES, lessonClasses, newDraftName, teacherName } from '@/lib/ops/forms/academics';
import { periodIndexOf, periodsOfLesson, type GridRow } from '@/lib/timetable/layout';
import { moveHint, type CellHint } from '@/lib/timetable/moves';
import { auditLessons, hoursCheck } from '@/lib/timetable/checks';
import type { TimetablePlan } from '@/lib/timetable/readiness';
import { QualityPanel } from './QualityPanel';
import { TimetableGrid } from './TimetableGrid';
import { cn } from '@/lib/utils';

type View = 'class' | 'teacher';

/** One of the three checks a school reads before publishing: what it says, and whether it holds. */
function Check({ ok, icon: Icon, title, detail }: { ok: boolean; icon: typeof ShieldCheck; title: string; detail: string }) {
    return (
        <div className={cn('flex items-start gap-3 rounded-2xl border p-3 sm:p-4', ok ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-amber-500/50 bg-amber-500/[0.08]')}>
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', ok ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>
                {ok ? <Icon className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{detail}</span>
            </span>
        </div>
    );
}

/**
 * Generate drafts, check them (every subject's lessons a week in place, nobody
 * booked twice, how well the week is spread), adjust them class by class
 * (pick a lesson and the grid shows where it can go), pin lessons, and publish.
 */
export function TimetableBuilder({ plan, onGenerated }: { plan?: TimetablePlan | null; onGenerated?: () => void }) {
    const [versions, setVersions] = useState<TimetableVersion[]>([]);
    const [config, setConfig] = useState<TimetableConfig | null>(null);
    const [activeId, setActiveId] = useState('');
    const [lessons, setLessons] = useState<TimetableLesson[]>([]);
    const [view, setView] = useState<View>('class');
    const [streamId, setStreamId] = useState('');
    const [teacherId, setTeacherId] = useState('');
    const [selected, setSelected] = useState<TimetableLesson | null>(null);
    const [generating, setGenerating] = useState(false);
    const [confirm, setConfirm] = useState<'publish' | 'delete' | null>(null);
    /** The name the published timetable goes out under, asked for when publishing. */
    const [publishName, setPublishName] = useState('');
    const [publishing, setPublishing] = useState(false);

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
    const streams = useMemo(() => lessonClasses(lessons), [lessons]);
    const teachers = useMemo(() => {
        const seen = new Map<string, string>();
        lessons.forEach(l => { if (l.teacher_id && !seen.has(l.teacher_id)) seen.set(l.teacher_id, teacherName(l.teacher) || 'A teacher'); });
        return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    }, [lessons]);
    const shownStream = streamId || streams[0]?.id || '';
    const shownTeacher = teacherId || teachers[0]?.id || '';
    const shown = view === 'class' ? lessons.filter(l => l.grade_stream_id === shownStream) : lessons.filter(l => l.teacher_id === shownTeacher);

    // Read back from the lessons themselves, so manual moves are checked too.
    const audit = useMemo(() => config ? auditLessons(lessons.map(l => ({ day: l.day, period: l.period, streamPeriods: periodsOfLesson(config, l), teacherId: l.teacher_id, roomId: l.room_id }))) : null, [config, lessons]);
    const hours = useMemo(() => {
        if (!plan) return null;
        const loads = plan.classes.flatMap(c => [...c.core, ...c.blocks.flatMap(b => b.loads)].map(l => ({ id: l.id, className: c.name, subject: l.subject, lessons: l.lessons })));
        return loads.length > 0 ? hoursCheck(loads, lessons) : null;
    }, [plan, lessons]);

    /** A new draft from the selected one: its pinned lessons stay, everything else is placed afresh. */
    const reshuffle = async () => {
        setGenerating(true);
        try {
            const v = await opsFetch<TimetableVersion>('/api/academics/timetable/generate', {
                method: 'POST',
                json: { name: newDraftName(''), ...(activeId ? { keep_locked_from: activeId } : {}) },
            });
            toast.success('New draft generated, pinned lessons kept. Compare it with the last one, then publish the better.');
            setActiveId(v.id);
            setSelected(null);
            await loadVersions();
            onGenerated?.();
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

    const hintAt = useCallback((day: number, row: GridRow): CellHint | null =>
        selected && config ? moveHint(config, lessons, selected, day, row) : null, [selected, config, lessons]);

    const onCell = (day: number, row: GridRow, lesson: TimetableLesson | null) => {
        if (view !== 'class') return;
        const hint = hintAt(day, row);
        if (selected && hint && hint.state !== 'blocked' && config) void moveTo(day, periodIndexOf(config, selected, row));
        else if (selected && hint?.state === 'blocked' && !lesson) toast.error(hint.reason ?? 'It cannot go there.');
        else setSelected(lesson && lesson.id !== selected?.id ? lesson : null);
    };

    const askPublish = () => {
        setPublishName(active && !/^Draft\b/i.test(active.name) ? active.name : '');
        setConfirm('publish');
    };

    const publish = async () => {
        setPublishing(true);
        try {
            const name = publishName.trim();
            await opsFetch(`/api/academics/timetable/versions/${activeId}`, { method: 'PATCH', json: { status: 'PUBLISHED', ...(name ? { name } : {}) } });
            toast.success('Timetable published. Teachers and learners now see it.');
            setConfirm(null);
            await loadVersions();
            onGenerated?.();
        } catch (err) { toast.error(errorText(err)); }
        finally { setPublishing(false); }
    };

    const remove = async () => {
        try {
            await opsFetch(`/api/academics/timetable/versions/${activeId}`, { method: 'DELETE' });
            toast.success('Draft deleted.');
            setActiveId('');
            setLessons([]);
            await loadVersions();
            onGenerated?.();
        } catch (err) { toast.error(errorText(err)); }
        finally { setConfirm(null); }
    };

    const unplaced = active?.stats.unplaced ?? [];
    const placedAll = active?.stats.required !== undefined && unplaced.length === 0;
    const clashes = audit ? audit.teacherClashes + audit.roomClashes : 0;
    const short = hours?.short.length ?? 0;
    // Lessons counted subject by subject (three electives in one slot are three lessons), as the loads are.
    const hoursTitle = !placedAll
        ? `${active?.stats.placed ?? 0} of ${active?.stats.required ?? 0} class periods filled`
        : short > 0 ? `${short} subject${short === 1 ? ' is' : 's are'} short of lessons` : 'Every subject has its lessons a week';
    const hoursDetail = !placedAll
        ? 'Some lessons did not fit: see below.'
        : short > 0 ? 'Loads changed after this draft was made. Generate a new draft.'
            : hours ? `${hours.placed} lessons in ${active?.stats.placed ?? hours.placed} class periods, as set in Subjects & hours.` : 'As set in Subjects & hours.';

    return (
        <div className="flex flex-col gap-5">
            {versions.length > 0 && (
                <section className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <FormField label="Draft" htmlFor="tt-version" className="sm:max-w-sm sm:flex-1">
                        <SelectField id="tt-version" value={activeId} placeholder={null} onChange={v => { setActiveId(v); setSelected(null); }}
                            options={versions.map(v => ({ id: v.id, label: `${v.name} · ${v.status.toLowerCase()} · ${dateTime(v.created_at)}` }))} />
                    </FormField>
                    {active && (
                        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                            <StatusPill status={active.status} tones={STATUS_TONES} />
                            <a href={timetablePdfUrl({ view: 'master', version: active.id })} download className={buttonVariants({ variant: 'outline' })}><Download />Master PDF</a>
                            {active.status !== 'PUBLISHED' && <Button onClick={askPublish}><Upload />Publish</Button>}
                            {active.status !== 'PUBLISHED' && <Button variant="destructive" onClick={() => setConfirm('delete')}><Trash2 />Delete</Button>}
                        </div>
                    )}
                </section>
            )}

            {active && (
                <div className="grid gap-3 lg:grid-cols-2">
                    <Check ok={placedAll && short === 0} icon={CheckCircle2} title={hoursTitle} detail={hoursDetail} />
                    <Check
                        ok={clashes === 0}
                        icon={ShieldCheck}
                        title={clashes === 0 ? 'No teacher or room booked twice' : `${clashes} double booking${clashes === 1 ? '' : 's'}`}
                        detail={clashes === 0 ? 'Checked lesson by lesson, across every class and bell, including the times teachers are away.' : 'Move one of the lessons, or generate again.'}
                    />
                </div>
            )}

            {active?.stats.quality && (
                <QualityPanel quality={describeQuality(active.stats.quality)} action={
                    <Button variant="outline" size="sm" onClick={() => void reshuffle()} disabled={generating} title="A new draft that keeps this one's pinned lessons"><Shuffle />{generating ? 'Reshuffling… (about 15 seconds)' : 'Reshuffle'}</Button>
                } />
            )}

            {unplaced.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                    <p className="font-medium">Not placed — free the teacher, lighten these loads, or add rooms, then generate again:</p>
                    <ul className="mt-1 list-inside list-disc text-muted-foreground">{unplaced.slice(0, 12).map((u, i) => <li key={i}>{u.label}: {u.lessons} lesson{u.lessons === 1 ? '' : 's'}</li>)}</ul>
                </div>
            )}

            {hours && hours.lines.length > 0 && active && (
                <details className="group rounded-2xl border border-border/70 bg-card shadow-sm">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 text-sm font-semibold">
                        Lessons a week, subject by subject ({hours.placed} of {hours.required})
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <ul className="grid gap-x-6 gap-y-1 border-t border-border/60 p-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                        {hours.lines.map(l => (
                            <li key={l.loadId} className="flex items-baseline justify-between gap-2">
                                <span className="truncate"><span className="text-muted-foreground">{l.className} ·</span> {l.subject}</span>
                                <span className={cn('shrink-0 tabular-nums', l.placed < l.required ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>{l.placed}/{l.required}</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {config && active && lessons.length > 0 && (
                <section className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div role="tablist" aria-label="Show the draft by" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:w-fit">
                            {(['class', 'teacher'] as const).map(v => (
                                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { setView(v); setSelected(null); }}
                                    className={cn('flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors', view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                                    {v === 'teacher' && <Users className="size-4" aria-hidden />}{v === 'class' ? 'By class' : 'By teacher'}
                                </button>
                            ))}
                        </div>
                        {view === 'class' ? (
                            <FormField label="Class" htmlFor="tt-class" className="sm:max-w-xs sm:flex-1">
                                <SelectField id="tt-class" value={shownStream} placeholder={null} onChange={v => { setStreamId(v); setSelected(null); }} options={streams} />
                            </FormField>
                        ) : (
                            <FormField label="Teacher" htmlFor="tt-teacher" className="sm:max-w-xs sm:flex-1">
                                <SelectField id="tt-teacher" value={shownTeacher} placeholder={null} onChange={setTeacherId} options={teachers} />
                            </FormField>
                        )}
                    </div>
                    {view === 'class' && (selected ? (
                        <div className="flex flex-col gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm sm:flex-row sm:items-center">
                            <span className="flex-1"><strong>Moving {selected.subject?.name}.</strong> Green: move it there. Blue: swap with that lesson. Faded: not possible (hover to see why).</span>
                            <span className="flex gap-2">
                                <Button size="xs" variant="outline" onClick={() => void toggleLock(selected)}>{selected.locked ? <><Unlock />Unpin</> : <><Lock />Pin here</>}</Button>
                                <Button size="xs" variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
                            </span>
                        </div>
                    ) : <p className="text-xs text-muted-foreground">Click a lesson to move or pin it: the grid then shows every slot it can go to. Pinned lessons keep their slots when you reshuffle.</p>)}
                    <TimetableGrid config={config} lessons={shown} mode={view} selectedId={selected?.id} onCellClick={view === 'class' ? onCell : undefined} hintAt={view === 'class' ? hintAt : undefined} />
                </section>
            )}
            {versions.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No drafts yet. When every step is ready, generate one with the button at the top.</p>}

            <Modal
                isOpen={confirm === 'publish'}
                onClose={() => setConfirm(null)}
                title="Publish this timetable?"
                footer={(
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setConfirm(null)} disabled={publishing}>Cancel</Button>
                        <Button onClick={() => void publish()} disabled={publishing}><Upload />{publishing ? 'Publishing…' : 'Publish'}</Button>
                    </div>
                )}
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">{PUBLISH_TIMETABLE_WARNING}</p>
                    <FormField label="Name it as teachers and learners will see it" htmlFor="tt-publish-name" hint={`Leave blank to keep “${active?.name ?? ''}”.`}>
                        <InputField id="tt-publish-name" value={publishName} placeholder="e.g. Term 1 2027 timetable" onChange={e => setPublishName(e.target.value)} />
                    </FormField>
                </div>
            </Modal>
            <ConfirmDialog
                isOpen={confirm === 'delete'}
                onClose={() => setConfirm(null)}
                onConfirm={() => void remove()}
                title="Delete this draft?"
                message="The draft and its lessons are removed."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
}
