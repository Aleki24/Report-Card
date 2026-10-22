"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Save, Target } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { LookupSelect } from '@/components/ops/SearchableSelect';
import { errorText, opsFetch } from '@/lib/ops/client';
import { CBC_LEVELS, CBC_LEVEL_LABELS } from '@/lib/ops/resources/academics';
import { EMPTY_CBC_FILTER, cbcCounts, cbcFilterReady, type CbcLevel as Level, type CbcRow as Row, type StrandOption } from '@/lib/ops/forms/academics';
import { cn } from '@/lib/utils';

const LEVEL_STYLE: Record<Level, string> = {
    EE: 'bg-emerald-500 text-white',
    ME: 'bg-sky-500 text-white',
    AE: 'bg-amber-500 text-white',
    BE: 'bg-rose-500 text-white',
};

function RubricGrid() {
    const { can } = useAuth();
    const canAssess = can('cbc.assess');
    const listId = useId();
    const subListId = useId();
    const [filter, setFilter] = useState(EMPTY_CBC_FILTER);
    const [strands, setStrands] = useState<StrandOption[]>([]);
    const [rows, setRows] = useState<Row[] | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [opening, setOpening] = useState(false);
    // Only the latest "Open class list" may fill the list: a slow answer for the
    // previous strand or term used to land under the new one and be saved there.
    const openRequest = useRef(0);

    const ready = cbcFilterReady(filter);

    useEffect(() => {
        if (!filter.subject_id) return;
        let live = true;
        opsFetch<StrandOption[]>(`/api/academics/cbc/strands?subject_id=${filter.subject_id}`).then(s => { if (live) setStrands(s); }).catch(() => undefined);
        return () => { live = false; };
    }, [filter.subject_id]);

    const load = async () => {
        if (!ready) { toast.error('Choose a class, subject, term and strand.'); return; }
        if (dirty && !window.confirm('Discard the levels you have not saved?')) return;
        const request = ++openRequest.current;
        setOpening(true);
        try {
            const next = await opsFetch<Row[]>(`/api/academics/cbc?${new URLSearchParams(filter)}`);
            if (request !== openRequest.current) return;
            setRows(next);
            setDirty(false);
        } catch (err) {
            if (request === openRequest.current) toast.error(errorText(err));
        } finally {
            if (request === openRequest.current) setOpening(false);
        }
    };

    const save = async () => {
        if (!rows) return;
        setSaving(true);
        try {
            const r = await opsFetch<{ saved: number }>('/api/academics/cbc', {
                method: 'PUT',
                json: { ...filter, rows: rows.map(x => ({ student_id: x.studentId, level: x.level, comment: x.comment })) },
            });
            toast.success(`${r.saved} levels saved.`);
            setDirty(false);
        } catch (err) { toast.error(errorText(err)); }
        finally { setSaving(false); }
    };

    const setLevel = (id: string, level: Level) => {
        setRows(rs => rs && rs.map(r => (r.studentId === id ? { ...r, level: r.level === level ? null : level } : r)));
        setDirty(true);
    };

    const counts = useMemo(() => cbcCounts(rows), [rows]);
    const subStrands = strands.find(s => s.strand === filter.strand)?.subStrands ?? [];
    // Changing what is shown drops the list, so ask first when ratings are unsaved.
    const set = (patch: Partial<typeof filter>) => {
        if (dirty && !window.confirm('Discard the levels you have not saved?')) return;
        setFilter(f => ({ ...f, ...patch }));
        setRows(null);
        setDirty(false);
        openRequest.current++;
        setOpening(false);
    };
    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    return (
        <div className="flex flex-col gap-5">
            <section className="grid grid-cols-1 gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-3 sm:p-5">
                <FormField label="Class" htmlFor="cbc-class" required><LookupSelect id="cbc-class" lookup="streams" value={filter.grade_stream_id} onChange={v => set({ grade_stream_id: v })} /></FormField>
                <FormField label="Learning area" htmlFor="cbc-subject" required><LookupSelect id="cbc-subject" lookup="subjects" value={filter.subject_id} onChange={v => set({ subject_id: v, strand: '', sub_strand: '' })} /></FormField>
                <FormField label="Term" htmlFor="cbc-term" required><LookupSelect id="cbc-term" lookup="terms" value={filter.term_id} onChange={v => set({ term_id: v })} /></FormField>
                <FormField label="Strand" htmlFor="cbc-strand" required>
                    <InputField id="cbc-strand" list={listId} value={filter.strand} onChange={e => set({ strand: e.target.value })} placeholder="e.g. Numbers" />
                    <datalist id={listId}>{strands.map(s => <option key={s.strand} value={s.strand} />)}</datalist>
                </FormField>
                <FormField label="Sub-strand" htmlFor="cbc-sub">
                    <InputField id="cbc-sub" list={subListId} value={filter.sub_strand} onChange={e => set({ sub_strand: e.target.value })} placeholder="e.g. Fractions" />
                    <datalist id={subListId}>{subStrands.map(s => <option key={s} value={s} />)}</datalist>
                </FormField>
                <div className="flex items-end"><Button onClick={load} disabled={opening} className="w-full sm:w-auto">{opening ? 'Opening…' : 'Open class list'}</Button></div>
            </section>

            {rows && (
                <>
                    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl bg-background/95 px-1 py-2 backdrop-blur">
                        {CBC_LEVELS.map(l => (
                            <span key={l} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                                <span className={cn('rounded px-1.5 font-bold', LEVEL_STYLE[l])}>{l}</span>{CBC_LEVEL_LABELS[l]} · <strong className="tabular-nums">{counts[l]}</strong>
                            </span>
                        ))}
                        {canAssess && <Button className="ml-auto" onClick={save} disabled={saving || !dirty}><Save />{saving ? 'Saving…' : 'Save'}</Button>}
                    </div>
                    <ul className="flex flex-col gap-2">
                        {rows.map(r => (
                            <li key={r.studentId} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 sm:flex-row sm:items-center">
                                <span className="min-w-0 flex-1 truncate text-sm"><span className="font-medium">{r.name}</span> <span className="text-muted-foreground">{r.admissionNumber}</span></span>
                                <div role="radiogroup" aria-label={`Level for ${r.name}`} className="flex gap-1.5">
                                    {CBC_LEVELS.map(l => (
                                        <button key={l} type="button" role="radio" aria-checked={r.level === l} title={CBC_LEVEL_LABELS[l]} disabled={!canAssess || saving}
                                            onClick={() => setLevel(r.studentId, l)}
                                            className={cn('size-10 rounded-lg text-xs font-bold transition-colors', r.level === l ? LEVEL_STYLE[l] : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                    {rows.length === 0 && <p className="text-sm text-muted-foreground">No learners in this class.</p>}
                </>
            )}
        </div>
    );
}

export default function CbcPage() {
    return (
        <ModulePage
            module="cbc_assessment"
            title="CBC assessment"
            eyebrow="Academics"
            description="Rate each learner per strand and sub-strand: Exceeding, Meeting, Approaching or Below expectations."
            icon={Target}
            hue="emerald"
            tabs={[{ id: 'rubric', label: 'Rubric', icon: Target, hue: 'emerald', render: () => <RubricGrid /> }]}
        />
    );
}
