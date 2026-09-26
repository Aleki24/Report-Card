"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SelectField, FormField } from '@/components/ui/FormField';
import { LookupSelect, SearchableSelect } from '@/components/ops/SearchableSelect';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import type { TimetableConfig, TimetableLesson } from '@/lib/timetable/config';
import { TimetableGrid, type GridMode } from './TimetableGrid';

type View = 'mine' | GridMode;

interface ViewResult { config: TimetableConfig; lessons: TimetableLesson[]; published: boolean }

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

    return (
        <div className="flex flex-col gap-4">
            {canBrowse && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
                    <FormField label="Show" htmlFor="tt-view">
                        <SelectField id="tt-view" value={view} placeholder={null} onChange={v => { setView(v as View); setTargetId(''); }}
                            options={[{ id: 'mine', label: 'My timetable' }, { id: 'class', label: 'A class' }, { id: 'teacher', label: 'A teacher' }, { id: 'room', label: 'A room' }]} />
                    </FormField>
                    {view === 'class' && <FormField label="Class" htmlFor="tt-target"><LookupSelect id="tt-target" lookup="streams" value={targetId} onChange={setTargetId} /></FormField>}
                    {view === 'teacher' && <FormField label="Teacher" htmlFor="tt-target"><LookupSelect id="tt-target" lookup="staff" value={targetId} onChange={setTargetId} /></FormField>}
                    {view === 'room' && <FormField label="Room" htmlFor="tt-target"><SearchableSelect id="tt-target" options={rooms.rows.map(r => ({ id: r.id, label: r.name }))} loading={rooms.loading} value={targetId} onChange={setTargetId} /></FormField>}
                </div>
            )}
            {!data ? (
                view !== 'mine' && !targetId
                    ? <p className="text-sm text-muted-foreground">Choose whose timetable to show.</p>
                    : <div className="skeleton-bone h-72 rounded-2xl" />
            ) : !data.published ? (
                <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">No timetable has been published yet.</p>
            ) : data.lessons.length === 0 ? (
                <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">No lessons on this timetable.</p>
            ) : (
                <TimetableGrid config={data.config} lessons={data.lessons} mode={view === 'mine' ? 'teacher' : view} />
            )}
        </div>
    );
}
