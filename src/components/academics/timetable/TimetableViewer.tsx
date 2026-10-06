"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/ui/FormField';
import { LookupSelect, SearchableSelect } from '@/components/ops/SearchableSelect';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { TIMETABLE_VIEWS, weekSummary, type TimetableView as View, type TimetableViewResult as ViewResult } from '@/lib/ops/forms/academics';
import { cn } from '@/lib/utils';
import { TimetableGrid } from './TimetableGrid';
import { Download } from 'lucide-react';
import { buttonVariants } from '@/components/ui/Button';
import { timetablePdfUrl } from '@/lib/timetable/pdf-url';

/** The published timetable: your own, or any class, teacher or room (for staff). */
export function TimetableViewer({ canBrowse }: { canBrowse: boolean }) {
    const [view, setView] = useState<View>('mine');
    const [targetId, setTargetId] = useState('');
    const [data, setData] = useState<ViewResult | null>(null);
    const rooms = useOpsList<{ id: string; name: string }>('rooms', {}, { enabled: canBrowse && view === 'room' });

    useEffect(() => {
        if (view !== 'mine' && !targetId) return;
        const q = new URLSearchParams({ view, ...(targetId ? { id: targetId } : {}) });
        let live = true;
        opsFetch<ViewResult>(`/api/academics/timetable/view?${q}`)
            .then(r => { if (live) setData(r); })
            .catch(err => toast.error(errorText(err)));
        return () => { live = false; };
    }, [view, targetId]);

    const summary = data && data.lessons.length > 0 ? weekSummary(data.lessons) : null;

    return (
        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                {canBrowse && (
                    <div role="tablist" aria-label="Whose timetable" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:inline-grid sm:w-fit sm:grid-cols-4">
                        {TIMETABLE_VIEWS.map(v => (
                            <button key={v.id} type="button" role="tab" aria-selected={view === v.id}
                                onClick={() => { setView(v.id); setTargetId(''); }}
                                className={cn('min-h-9 rounded-lg px-4 text-sm font-medium transition-colors', view === v.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                                {v.label}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    {canBrowse && view !== 'mine' && (
                        <div className="lg:w-80">
                            {view === 'class' && <FormField label="Class" htmlFor="tt-target"><LookupSelect id="tt-target" lookup="streams" value={targetId} onChange={setTargetId} /></FormField>}
                            {view === 'teacher' && <FormField label="Teacher" htmlFor="tt-target"><LookupSelect id="tt-target" lookup="staff" value={targetId} onChange={setTargetId} /></FormField>}
                            {view === 'room' && <FormField label="Room" htmlFor="tt-target"><SearchableSelect id="tt-target" options={rooms.rows.map(r => ({ id: r.id, label: r.name }))} loading={rooms.loading} value={targetId} onChange={setTargetId} /></FormField>}
                        </div>
                    )}
                    {summary && (
                        <dl className="flex flex-wrap gap-2 text-sm">
                            {summary.map(([label, value]) => (
                                <div key={label} className="rounded-xl bg-muted/60 px-3 py-1.5"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>
                            ))}
                        </dl>
                    )}
                    <div className="flex flex-wrap gap-2 lg:ml-auto">
                        {data && data.lessons.length > 0 && <a href={timetablePdfUrl({ view, id: targetId || undefined })} download className={buttonVariants({ variant: 'outline' })}><Download />This timetable</a>}
                        {canBrowse && data?.published && <a href={timetablePdfUrl({ view: 'master' })} download className={buttonVariants()}><Download />Whole-school PDF</a>}
                    </div>
                </div>
            </section>
            {!data ? (
                view !== 'mine' && !targetId
                    ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Choose a {view} to see its week.</p>
                    : <div className="skeleton-bone h-72 rounded-2xl" />
            ) : !data.published ? (
                <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">No timetable has been published yet.</p>
            ) : data.lessons.length === 0 ? (
                <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">No lessons on this timetable.</p>
            ) : (
                <TimetableGrid config={data.config} lessons={data.lessons} mode={data.mode} />
            )}
        </div>
    );
}
