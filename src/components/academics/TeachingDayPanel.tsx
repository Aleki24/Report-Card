"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/FormField';
import { errorText, opsFetch } from '@/lib/ops/client';
import { addDays, date as fmtDate, today } from '@/lib/ops/format';
import { TEACHING_DAY_NOTE, nextStep, type TeachingDay, type TeachingDayAction, type TeachingDayLesson } from '@/lib/academics/teaching-day';
import { cn } from '@/lib/utils';

const URL = '/api/academics/lesson-records/day';

function LessonCard({ lesson, busy, onAction }: { lesson: TeachingDayLesson; busy: boolean; onAction: (l: TeachingDayLesson, a: TeachingDayAction) => void }) {
    const step = nextStep(lesson);
    const done = !!lesson.record;
    return (
        <li className={cn('grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-[6rem_1fr_auto] sm:items-center', done ? 'border-emerald-500/40' : 'border-border/70')}>
            <div className="flex items-baseline gap-2 sm:block">
                <p className="text-sm font-semibold tabular-nums">{lesson.start}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{lesson.end}{lesson.periods > 1 ? ' · double' : ''}</p>
            </div>
            <div className="min-w-0">
                <p className="font-semibold">{lesson.subject.name} <span className="font-normal text-muted-foreground">· {lesson.stream.name}{lesson.room ? ` · ${lesson.room}` : ''}</span></p>
                {lesson.entry ? (
                    <p className="mt-1 flex items-start gap-1.5 text-sm"><BookOpen className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden />
                        <span>Week {lesson.entry.week}, lesson {lesson.entry.lesson}: {lesson.entry.topic}{lesson.entry.sub_topic ? ` — ${lesson.entry.sub_topic}` : ''}</span></p>
                ) : (
                    <p className="mt-1 text-sm text-muted-foreground">{lesson.scheme ? 'Every lesson in the scheme is taught.' : 'No scheme of work for this class yet.'}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {lesson.plan && <span className="flex items-center gap-1"><NotebookPen className="size-3.5 text-blue-600" aria-hidden />Planned: {lesson.plan.topic}</span>}
                    {lesson.record && <span className="flex items-center gap-1"><CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />Taught</span>}
                </div>
            </div>
            {step && (
                <Button variant={step.action === 'plan' ? 'default' : 'outline'} disabled={busy} onClick={() => onAction(lesson, step.action)}>
                    {step.action === 'plan' ? <NotebookPen /> : <ClipboardCheck />}{step.label}
                </Button>
            )}
        </li>
    );
}

/** A teacher's lessons for a day, each tied to its scheme of work, lesson plan and record of work. */
export function TeachingDayPanel({ onChanged }: { onChanged?: () => void }) {
    const [day, setDay] = useState(today());
    const [data, setData] = useState<TeachingDay | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        try { setData(await opsFetch<TeachingDay>(`${URL}?date=${day}`)); }
        catch (err) { toast.error(errorText(err)); }
    }, [day]);
    useEffect(() => { setData(null); void load(); }, [load]);

    const act = async (lesson: TeachingDayLesson, action: TeachingDayAction) => {
        setBusy(lesson.lessonId);
        try {
            await opsFetch(URL, { method: 'POST', json: { action, date: day, subject_id: lesson.subject.id, grade_stream_id: lesson.stream.id, scheme_entry_id: lesson.entry?.id ?? null } });
            toast.success(action === 'plan' ? 'Lesson plan created from the scheme. Edit it under Lesson plans.' : 'Recorded as taught.');
            await load();
            onChanged?.();
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(null); }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-sm text-muted-foreground">{TEACHING_DAY_NOTE}</p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setDay(d => addDays(d, -1))}><ChevronLeft /></Button>
                    <InputField type="date" aria-label="Day" value={day} onChange={e => e.target.value && setDay(e.target.value)} className="w-40" />
                    <Button variant="outline" size="icon" aria-label="Next day" onClick={() => setDay(d => addDays(d, 1))}><ChevronRight /></Button>
                </div>
            </div>
            {!data ? <div className="skeleton-bone h-40 rounded-2xl" />
                : !data.published ? <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">Your lessons appear here once the school publishes a timetable.</p>
                    : data.lessons.length === 0 ? <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">No lessons on {fmtDate(day)}.</p>
                        : <ol className="flex flex-col gap-3">{data.lessons.map(l => <LessonCard key={l.lessonId} lesson={l} busy={busy === l.lessonId} onAction={(x, a) => void act(x, a)} />)}</ol>}
        </div>
    );
}
