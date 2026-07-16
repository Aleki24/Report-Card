"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Users } from 'lucide-react';

interface RosterStudent {
    id: string;
    admission_number: string;
    status: string;
    current_grade_stream_id: string | null;
    subject_combination_id: string | null;
    users: { first_name: string; last_name: string } | null;
    grade_streams: { id: string; full_name: string } | null;
    enrolled: boolean;
}

interface Props {
    subject: { id: string; name: string; code: string };
    onClose: () => void;
    onSaved?: () => void;
}

/**
 * "Who takes this subject" manager — used for 8-4-4 electives (e.g.
 * only the CRE takers, not the whole class) and for inspecting CBC
 * elective enrollment. Once at least one learner in a class is
 * enrolled, mark entry for this subject lists only enrolled learners.
 */
export default function SubjectEnrollmentManager({ subject, onClose, onSaved }: Props) {
    const [roster, setRoster] = useState<RosterStudent[]>([]);
    const [initialEnrolled, setInitialEnrolled] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [streamFilter, setStreamFilter] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/student-subjects?subject_id=${subject.id}`, { cache: 'no-store' });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Failed to load roster');
                const students: RosterStudent[] = json.data || [];
                setRoster(students);
                const enrolled = new Set<string>(students.filter(s => s.enrolled).map(s => s.id));
                setInitialEnrolled(enrolled);
                setSelected(new Set(enrolled));
            } catch (err) {
                setMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        })();
    }, [subject.id]);

    const streams = useMemo(() => {
        const map = new Map<string, string>();
        roster.forEach(s => { if (s.grade_streams) map.set(s.grade_streams.id, s.grade_streams.full_name); });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [roster]);

    const filtered = roster.filter(s => {
        const q = search.toLowerCase();
        const matchSearch = !q || `${s.users?.first_name ?? ''} ${s.users?.last_name ?? ''} ${s.admission_number}`.toLowerCase().includes(q);
        const matchStream = !streamFilter || s.current_grade_stream_id === streamFilter;
        return matchSearch && matchStream;
    });

    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const dirty = useMemo(() => {
        if (selected.size !== initialEnrolled.size) return true;
        for (const id of selected) if (!initialEnrolled.has(id)) return true;
        return false;
    }, [selected, initialEnrolled]);

    const save = async () => {
        const add = [...selected].filter(id => !initialEnrolled.has(id));
        const remove = [...initialEnrolled].filter(id => !selected.has(id));
        if (add.length === 0 && remove.length === 0) return;
        setSaving(true);
        setMsg('');
        try {
            const res = await fetch('/api/admin/student-subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject_id: subject.id, add, remove }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to save');
            setInitialEnrolled(new Set(selected));
            setMsg(`Saved — ${selected.size} learner(s) now take ${subject.name}.`);
            onSaved?.();
        } catch (err) {
            setMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col p-5" style={{ animation: 'fadeIn .2s ease' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-1">
                    <h2 className="text-sm font-bold font-display flex items-center gap-2">
                        <Users size={16} className="text-primary" /> Learners taking {subject.name} ({subject.code})
                    </h2>
                    <button onClick={onClose} className="w-7 h-7 rounded-md border border-border bg-surface flex items-center justify-center cursor-pointer text-muted-foreground"><X size={14} /></button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                    Tick the learners who take this subject. Once anyone in a class is enrolled, mark entry (manual, CSV, photo scan, quick entry) for this subject lists only enrolled learners in that class. Leave a class fully unticked to keep showing everyone there.
                </p>

                {msg && (
                    <div className={`mb-3 p-2.5 rounded-md text-xs ${!msg.startsWith('Failed') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                        {msg}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <select className="input-field text-xs" style={{ width: "auto", minWidth: "150px" }} value={streamFilter} onChange={e => setStreamFilter(e.target.value)}>
                        <option value="">All Classes</option>
                        {streams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                    <div className="flex items-center input-field overflow-hidden px-0 flex-1">
                        <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0"><Search size={14} /></span>
                        <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-xs" placeholder="Search learners..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <button
                        className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                        onClick={() => {
                            const allSelected = filtered.every(s => selected.has(s.id));
                            setSelected(prev => {
                                const next = new Set(prev);
                                filtered.forEach(s => { if (allSelected) next.delete(s.id); else next.add(s.id); });
                                return next;
                            });
                        }}
                        disabled={filtered.length === 0}
                    >
                        {filtered.length > 0 && filtered.every(s => selected.has(s.id)) ? 'Untick all' : `Tick all (${filtered.length})`}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 border border-border rounded-md min-h-[200px]">
                    {loading ? (
                        <p className="text-xs text-muted-foreground text-center py-8">Loading learners...</p>
                    ) : filtered.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">No learners on this subject&apos;s curriculum level match.</p>
                    ) : filtered.map(s => (
                        <label key={s.id} className="flex items-center gap-3 px-3 py-2 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-muted/40">
                            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                            <span className="text-xs font-medium flex-1">
                                {s.users?.first_name} {s.users?.last_name} <span className="font-mono text-muted-foreground">({s.admission_number})</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground">{s.grade_streams?.full_name || '—'}</span>
                            {s.subject_combination_id && (
                                <span className="text-[11px] text-amber-400" title="This learner's enrollment is managed by their subject combination — manual changes are overwritten when the combination re-syncs.">combo</span>
                            )}
                        </label>
                    ))}
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{selected.size} enrolled</span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-xs" onClick={onClose} disabled={saving}>Close</button>
                        <button className="btn-primary text-xs" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving...' : 'Save Enrollment'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
