"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { CheckCheck, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField, SelectField, TextareaField } from '@/components/ui/FormField';
import { SearchableSelect } from '@/components/ops/SearchableSelect';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { humanize, today } from '@/lib/ops/format';
import { ROLL_SESSIONS, ROLL_STATUSES, type RollSession, type RollStatus } from '@/lib/ops/resources/welfare';
import { cn } from '@/lib/utils';

interface Entry { studentId: string; name: string; admissionNumber: string | null; bed: string | null; status: RollStatus | null; suggested: RollStatus | null }
interface Roll { taken: boolean; notes: string | null; entries: Entry[] }

const STATUS_STYLE: Record<RollStatus, { short: string; on: string }> = {
    PRESENT: { short: 'P', on: 'bg-emerald-500 text-white' },
    ABSENT: { short: 'A', on: 'bg-rose-500 text-white' },
    LATE: { short: 'L', on: 'bg-amber-500 text-white' },
    EXEAT: { short: 'E', on: 'bg-sky-500 text-white' },
    SICK_BAY: { short: 'S', on: 'bg-violet-500 text-white' },
};

/** Morning, evening or night roll for a dorm, pre-filled for learners on exeat or in sick bay. */
export function RollCallPanel() {
    const dorms = useOpsList<{ id: string; name: string; house: string | null }>('dorms');
    const [dormId, setDormId] = useState('');
    const [session, setSession] = useState<RollSession>(() => (new Date().getHours() < 12 ? 'MORNING' : new Date().getHours() < 20 ? 'EVENING' : 'NIGHT'));
    const [day, setDay] = useState(today());
    const [roll, setRoll] = useState<Roll | null>(null);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const open = async () => {
        if (!dormId) { toast.error('Choose a dorm.'); return; }
        try {
            const r = await opsFetch<Roll>(`/api/welfare/rollcall?${new URLSearchParams({ dorm_id: dormId, session, date: day })}`);
            setRoll({ ...r, entries: r.entries.map(e => ({ ...e, status: e.status ?? e.suggested })) });
            setNotes(r.notes ?? '');
        } catch (err) { toast.error(errorText(err)); }
    };

    const setStatus = (id: string, status: RollStatus) => setRoll(r => r && { ...r, entries: r.entries.map(e => (e.studentId === id ? { ...e, status } : e)) });

    const save = async () => {
        if (!roll) return;
        const unmarked = roll.entries.filter(e => !e.status).length;
        if (unmarked > 0) { toast.error(`${unmarked} learners are not marked yet.`); return; }
        setSaving(true);
        try {
            const r = await opsFetch<{ saved: number; absent: number }>('/api/welfare/rollcall', {
                method: 'PUT',
                json: { dorm_id: dormId, session, date: day, notes: notes || undefined, entries: roll.entries.map(e => ({ student_id: e.studentId, status: e.status })) },
            });
            toast.success(r.absent > 0 ? `Roll saved. ${r.absent} absent — follow up now.` : 'Roll saved. Everyone accounted for.');
            setRoll(x => x && { ...x, taken: true });
        } catch (err) { toast.error(errorText(err)); }
        finally { setSaving(false); }
    };

    const counts = Object.fromEntries(ROLL_STATUSES.map(s => [s, roll?.entries.filter(e => e.status === s).length ?? 0])) as Record<RollStatus, number>;

    return (
        <div className="flex flex-col gap-4">
            <section className="grid grid-cols-1 gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end sm:p-5">
                <FormField label="Dorm" htmlFor="rc-dorm"><SearchableSelect id="rc-dorm" options={dorms.rows.map(d => ({ id: d.id, label: d.name, hint: d.house ?? undefined }))} loading={dorms.loading} value={dormId} onChange={v => { setDormId(v); setRoll(null); }} /></FormField>
                <FormField label="Session" htmlFor="rc-session"><SelectField id="rc-session" value={session} placeholder={null} onChange={v => { setSession(v as RollSession); setRoll(null); }} options={ROLL_SESSIONS.map(s => ({ id: s, label: humanize(s) }))} /></FormField>
                <FormField label="Date" htmlFor="rc-date"><InputField id="rc-date" type="date" value={day} onChange={e => { setDay(e.target.value); setRoll(null); }} /></FormField>
                <Button onClick={open}>Open roll</Button>
            </section>

            {roll && (
                <>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {ROLL_STATUSES.map(s => <span key={s} className="rounded-full bg-muted px-2.5 py-1">{humanize(s)} <strong className="tabular-nums">{counts[s]}</strong></span>)}
                        {roll.taken && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">Already taken — saving updates it</span>}
                        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setRoll(r => r && { ...r, entries: r.entries.map(e => ({ ...e, status: e.status ?? 'PRESENT' })) })}><CheckCheck />Rest present</Button>
                    </div>
                    <ul className="flex flex-col gap-2">
                        {roll.entries.map(e => (
                            <li key={e.studentId} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 sm:flex-row sm:items-center">
                                <span className="min-w-0 flex-1 text-sm">
                                    <span className="font-medium">{e.name}</span> <span className="text-muted-foreground">{e.admissionNumber}{e.bed ? ` · bed ${e.bed}` : ''}</span>
                                    {e.suggested && <span className="ml-2 text-[11px] text-sky-700 dark:text-sky-300">({humanize(e.suggested)})</span>}
                                </span>
                                <div role="radiogroup" aria-label={`Status for ${e.name}`} className="flex gap-1.5">
                                    {ROLL_STATUSES.map(s => (
                                        <button key={s} type="button" role="radio" aria-checked={e.status === s} title={humanize(s)} onClick={() => setStatus(e.studentId, s)}
                                            className={cn('size-10 rounded-lg text-xs font-bold', e.status === s ? STATUS_STYLE[s].on : 'bg-muted text-muted-foreground')}>
                                            {STATUS_STYLE[s].short}
                                        </button>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                    {roll.entries.length === 0 && <p className="text-sm text-muted-foreground">Nobody is allocated to this dorm yet. Allocate beds under Dorms.</p>}
                    {roll.entries.length > 0 && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <FormField label="Notes" htmlFor="rc-notes" className="sm:flex-1"><TextareaField id="rc-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></FormField>
                            <Button onClick={save} disabled={saving}><Save />{saving ? 'Saving…' : 'Save roll'}</Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
