"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { LookupSelect } from '@/components/ops/SearchableSelect';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { date as fmtDate, personName, today } from '@/lib/ops/format';
import type { PersonName } from '@/lib/ops/resource';
import type { TimetableLesson } from '@/lib/timetable/config';

interface Candidate { id: string; name: string; sameSubject: boolean; weeklyLessons: number }
interface Need { lesson: TimetableLesson; candidates: Candidate[]; coveredBy: string | null }

interface CoverRow {
    id: string;
    cover_date: string;
    reason: string | null;
    lesson: { day: number; period: number; stream: { full_name: string } | null; subject: { name: string } | null } | null;
    cover: PersonName | null;
    absent: PersonName | null;
}

/** Arrange cover for an absent teacher: free colleagues ranked by subject match and load. */
export function CoverPanel() {
    const [day, setDay] = useState(today());
    const [teacher, setTeacher] = useState('');
    const [needs, setNeeds] = useState<Need[] | null>(null);
    const [loading, setLoading] = useState(false);
    const covers = useOpsList<CoverRow>('substitutions', { cover_date: day });

    const find = async () => {
        if (!teacher) { toast.error('Choose the absent teacher.'); return; }
        setLoading(true);
        try { setNeeds((await opsFetch<{ needs: Need[] }>(`/api/academics/timetable/cover-options?date=${day}&teacher_id=${teacher}`)).needs); }
        catch (err) { toast.error(errorText(err)); }
        finally { setLoading(false); }
    };

    const assign = async (lessonId: string, coverId: string) => {
        const ok = await covers.create({ lesson_id: lessonId, cover_date: day, absent_teacher_id: teacher, cover_teacher_id: coverId }, 'Cover arranged.');
        if (ok) await find();
    };

    return (
        <div className="flex flex-col gap-5">
            <section className="grid grid-cols-1 gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:grid-cols-[10rem_1fr_auto] sm:items-end sm:p-5">
                <FormField label="Date" htmlFor="cover-date"><InputField id="cover-date" type="date" value={day} onChange={e => { setDay(e.target.value); setNeeds(null); }} /></FormField>
                <FormField label="Absent teacher" htmlFor="cover-teacher"><LookupSelect id="cover-teacher" lookup="staff" value={teacher} onChange={v => { setTeacher(v); setNeeds(null); }} /></FormField>
                <Button onClick={find} disabled={loading}>{loading ? 'Checking…' : 'Find cover'}</Button>
            </section>

            {needs && (needs.length === 0 ? (
                <p className="text-sm text-muted-foreground">That teacher has no lessons on {fmtDate(day)}.</p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {needs.map(n => (
                        <li key={n.lesson.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                            <p className="text-sm font-semibold">{n.lesson.stream?.full_name} · {n.lesson.subject?.name}</p>
                            {n.coveredBy ? (
                                <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400"><UserCheck className="size-4" aria-hidden />Covered</p>
                            ) : n.candidates.length === 0 ? (
                                <p className="mt-1 text-sm text-destructive">Nobody is free in this period.</p>
                            ) : (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {n.candidates.map(c => (
                                        <Button key={c.id} size="sm" variant={c.sameSubject ? 'default' : 'outline'} onClick={() => void assign(n.lesson.id, c.id)}>
                                            {c.name}<span className="text-[10px] opacity-75">{c.sameSubject ? 'same subject · ' : ''}{c.weeklyLessons}/wk</span>
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            ))}

            <section>
                <h3 className="mb-2 text-sm font-semibold">Cover on {fmtDate(day)}</h3>
                {covers.rows.length === 0 ? <p className="text-sm text-muted-foreground">None arranged.</p> : (
                    <ul className="flex flex-col gap-2">
                        {covers.rows.map(c => (
                            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm">
                                <span>{c.lesson?.stream?.full_name} · {c.lesson?.subject?.name}: <strong>{personName(c.cover)}</strong> for {personName(c.absent)}</span>
                                <Button size="xs" variant="ghost" onClick={() => void covers.remove(c.id, 'Cover removed.')}>Remove</Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
