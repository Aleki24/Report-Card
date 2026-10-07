"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BAND_LABELS, type CurriculumBand } from '@/lib/curriculum-bands';
import { errorText, opsFetch } from '@/lib/ops/client';
import { TOGETHER_URL, levelsOf, ruleScope, subjectsAt, toggled, type TogetherRules } from '@/lib/timetable/together';
import { cn } from '@/lib/utils';

/** A toggle chip for picking several values. */
function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={onClick}
            className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40',
            )}
        >
            {label}
        </button>
    );
}

/**
 * Subjects the school teaches at the same time: learners take one of them,
 * so the timetable gives them one slot. Built-in groups hold in every school;
 * the school adds its own by picking the subjects.
 */
export function TaughtTogether({ onChange }: { onChange: () => void }) {
    const [data, setData] = useState<TogetherRules | null>(null);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [bands, setBands] = useState<CurriculumBand[]>([]);
    const [picked, setPicked] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { setData(await opsFetch<TogetherRules>(TOGETHER_URL)); }
        catch (err) { toast.error(errorText(err)); }
    }, []);
    useEffect(() => { void load(); }, [load]);

    const save = async () => {
        setBusy(true);
        try {
            await opsFetch(TOGETHER_URL, { method: 'POST', json: { name: name.trim() || 'Taught together', bands, subject_ids: picked } });
            toast.success('Saved. The next draft teaches these at the same time.');
            setAdding(false); setName(''); setBands([]); setPicked([]);
            await load();
            onChange();
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };

    const remove = async (id: string, label: string) => {
        if (!window.confirm(`Remove “${label}”? These subjects will no longer be kept in one slot.`)) return;
        try { await opsFetch(`${TOGETHER_URL}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); await load(); onChange(); }
        catch (err) { toast.error(errorText(err)); }
    };

    if (!data) return <div className="skeleton-bone h-32 rounded-xl" />;
    const builtIn = data.rules.filter(r => r.builtIn);
    const own = data.rules.filter(r => !r.builtIn);

    return (
        <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Link2 className="size-4 text-primary" aria-hidden />Subjects taught at the same time</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Learners take one subject from each group, so its subjects share a slot. Add your school’s own option groups here.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                <div>
                    <p className="text-xs font-semibold">Every school</p>
                    <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                        {builtIn.map(r => <li key={r.name}>{r.name}{r.bands.length > 0 && ` (${ruleScope(r.bands)})`}</li>)}
                    </ul>
                </div>
                <div>
                    <p className="text-xs font-semibold">Your school</p>
                    {own.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">None yet.</p> : (
                        <ul className="mt-1 flex flex-col gap-1.5">
                            {own.map(r => (
                                <li key={r.id} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
                                    <span className="min-w-0 flex-1"><span className="font-semibold">{r.name}</span><span className="text-muted-foreground"> — {r.subjects.join(' / ')} · {ruleScope(r.bands)}</span></span>
                                    <button type="button" onClick={() => r.id && void remove(r.id, r.name)} aria-label={`Remove ${r.name}`} className="rounded p-1 text-rose-600 hover:bg-rose-500/10"><Trash2 className="size-3.5" /></button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            {adding ? (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <label className="text-xs font-semibold">
                        Group name
                        <input className="input-field mt-1 w-full sm:max-w-sm" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Humanities option" />
                    </label>
                    <p className="text-xs font-semibold">For which levels?</p>
                    <div className="flex flex-wrap gap-1.5">
                        <Chip label="Every level" on={bands.length === 0} onClick={() => setBands([])} />
                        {levelsOf(data.subjects).map(b => <Chip key={b} label={BAND_LABELS[b]} on={bands.includes(b)} onClick={() => { setBands(toggled(bands, b)); setPicked([]); }} />)}
                    </div>
                    <p className="text-xs font-semibold">Subjects taught together ({picked.length} picked)</p>
                    <div className="flex flex-wrap gap-1.5">
                        {subjectsAt(data.subjects, bands).map(s => <Chip key={s.id} label={s.name} on={picked.includes(s.id)} onClick={() => setPicked(toggled(picked, s.id))} />)}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                        <Button size="sm" onClick={() => void save()} disabled={busy || picked.length < 2}>{busy ? 'Saving…' : 'Save group'}</Button>
                    </div>
                </div>
            ) : (
                <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}>+ Add a group</Button>
            )}
        </section>
    );
}
