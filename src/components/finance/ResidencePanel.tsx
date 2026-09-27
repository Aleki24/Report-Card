"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { LookupSelect } from '@/components/ops/SearchableSelect';
import { errorText, opsFetch } from '@/lib/ops/client';
import { personName } from '@/lib/ops/format';
import type { PersonName } from '@/lib/ops/resource';
import type { Residence } from '@/lib/finance/billing';
import { cn } from '@/lib/utils';

interface Learner { id: string; admission_number: string | null; residence: Residence; user: PersonName | null }

/** Day scholar or boarder, class by class: decides fee structures and who sleeps in. */
export function ResidencePanel({ canEdit }: { canEdit: boolean }) {
    const [streamId, setStreamId] = useState('');
    const [learners, setLearners] = useState<Learner[]>([]);

    useEffect(() => {
        if (!streamId) return;
        let live = true;
        opsFetch<Learner[]>(`/api/finance/residence?grade_stream_id=${streamId}`)
            .then(rows => { if (live) setLearners(rows); })
            .catch(err => toast.error(errorText(err)));
        return () => { live = false; };
    }, [streamId]);

    const set = async (ids: string[], residence: Residence) => {
        try {
            await opsFetch('/api/finance/residence', { method: 'POST', json: { student_ids: ids, residence } });
            setLearners(ls => ls.map(l => (ids.includes(l.id) ? { ...l, residence } : l)));
        } catch (err) { toast.error(errorText(err)); }
    };

    const boarders = learners.filter(l => l.residence === 'BOARDER').length;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <FormField label="Class" htmlFor="res-class" className="sm:w-72"><LookupSelect id="res-class" lookup="streams" value={streamId} onChange={setStreamId} /></FormField>
                {canEdit && learners.length > 0 && (
                    <div className="flex gap-2 sm:ml-auto">
                        <Button variant="outline" size="sm" onClick={() => void set(learners.map(l => l.id), 'DAY')}>All day</Button>
                        <Button variant="outline" size="sm" onClick={() => void set(learners.map(l => l.id), 'BOARDER')}>All boarders</Button>
                    </div>
                )}
            </div>
            {learners.length > 0 && <p className="text-sm text-muted-foreground">{boarders} boarders · {learners.length - boarders} day scholars</p>}
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {learners.map(l => (
                    <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2">
                        <span className="min-w-0 truncate text-sm"><span className="font-medium">{personName(l.user)}</span> <span className="text-muted-foreground">{l.admission_number}</span></span>
                        <div role="radiogroup" aria-label={`Residence for ${personName(l.user)}`} className="flex shrink-0 rounded-lg bg-muted p-0.5">
                            {(['DAY', 'BOARDER'] as const).map(r => (
                                <button key={r} type="button" role="radio" aria-checked={l.residence === r} disabled={!canEdit}
                                    onClick={() => l.residence !== r && void set([l.id], r)}
                                    className={cn('rounded-md px-2.5 py-1 text-xs font-medium', l.residence === r ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                                    {r === 'DAY' ? 'Day' : 'Boarder'}
                                </button>
                            ))}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
